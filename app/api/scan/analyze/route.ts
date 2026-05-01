import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanSnippet, runScan } from "@/lib/scanner";
import { generateReport } from "@/lib/reporting";
import { generateScanDocumentation } from "@/lib/documentation";
import { validateApiKey } from "@/lib/auth/api-key";
import prisma from "@/lib/db/client";
import type { ApiResponse } from "@/types/api";
import type { ScanResult } from "@/types";

// ─── Request Schemas ──────────────────────────────────────────────────────────

const FileSchema = z.object({
  path:    z.string().min(1),
  content: z.string(),
});

const AnalyzeRequestSchema = z.object({
  /** Single code snippet — analyzed as a synthetic file. */
  snippet: z.string().optional(),
  /** Snippet file path hint for language detection (e.g. "auth.ts"). */
  filePath: z.string().optional(),
  /** Multiple files for a full project scan. */
  files: z.array(FileSchema).optional(),
  /** Report format to return alongside findings. Defaults to "json". */
  reportFormat: z.enum(["json", "markdown", "html", "csv"]).optional(),
  includeSnippets:    z.boolean().optional(),
  includeRemediation: z.boolean().optional(),
  enabledRuleIds:    z.array(z.string()).optional(),
  disabledRuleIds:   z.array(z.string()).optional(),
  skipTestFiles:     z.boolean().optional(),
  maxFindingsPerFile: z.number().int().positive().optional(),
  /** Optional project ID to associate the scan with. */
  projectId: z.string().optional(),
  /** CI trigger metadata */
  triggerSource: z.enum(["MANUAL", "CLI", "GITHUB_ACTIONS", "GITLAB_CI", "API"]).optional(),
  commitSha:     z.string().optional(),
  branch:        z.string().optional(),
});

type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ─── Response Shape ───────────────────────────────────────────────────────────

interface AnalyzeResponse {
  scan:          ScanResult;
  report?:       string;
  documentation?: ReturnType<typeof generateScanDocumentation>;
  /** Persisted DB scan id, if the database is connected. */
  dbScanId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Severity string → Prisma enum value */
function toSeverityEnum(s: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" {
  const map: Record<string, "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"> = {
    critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW", info: "INFO",
  };
  return map[s.toLowerCase()] ?? "INFO";
}

/** Category string → Prisma enum value */
function toCategoryEnum(c: string): "SECURITY" | "PERFORMANCE" | "RELIABILITY" | "DEPENDENCY" | "CONFIGURATION" | "SECRETS" | "COMPLIANCE" {
  const map: Record<string, "SECURITY" | "PERFORMANCE" | "RELIABILITY" | "DEPENDENCY" | "CONFIGURATION" | "SECRETS" | "COMPLIANCE"> = {
    security: "SECURITY", performance: "PERFORMANCE", reliability: "RELIABILITY",
    dependency: "DEPENDENCY", configuration: "CONFIGURATION", secrets: "SECRETS", compliance: "COMPLIANCE",
  };
  return map[c.toLowerCase()] ?? "SECURITY";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AnalyzeResponse>>> {
  // API key validation (no-op in dev when DB is unavailable)
  const auth = await validateApiKey(req, "scan:write");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: AnalyzeRequest;
  try {
    const raw = await req.json();
    const parsed = AnalyzeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.snippet && (!body.files || body.files.length === 0)) {
    return NextResponse.json(
      { error: "Provide either `snippet` or `files`." },
      { status: 400 },
    );
  }

  try {
    let scan: ScanResult;

    if (body.snippet) {
      scan = await scanSnippet(body.snippet, body.filePath ?? "snippet.ts");
    } else {
      const target = {
        id:          crypto.randomUUID(),
        name:        "api-upload",
        environment: "staging" as const,
      };
      scan = await runScan(target, body.files!, {
        enabledRuleIds:    body.enabledRuleIds,
        disabledRuleIds:   body.disabledRuleIds,
        skipTestFiles:     body.skipTestFiles,
        maxFindingsPerFile: body.maxFindingsPerFile,
      });
    }

    const format = body.reportFormat ?? "json";
    const report = generateReport(scan, {
      format,
      includeSnippets:    body.includeSnippets ?? true,
      includeRemediation: body.includeRemediation ?? true,
    });

    const documentation = generateScanDocumentation(scan, body.filePath ?? "Uploaded Code");

    // ── Persist to database (best-effort — skip if DB not connected) ──────────
    let dbScanId: string | undefined;

    if (body.projectId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any;
        const dbScan = await db.scan.create({
          data: {
            projectId:       body.projectId,
            userId:          auth.userId ?? undefined,
            branch:          body.branch,
            commitSha:       body.commitSha,
            triggerSource:   body.triggerSource ?? "MANUAL",
            triggeredBy:     auth.userId ?? "anonymous",
            environment:     "STAGING",
            status:          "COMPLETED",
            completedAt:     new Date(),
            normalizedScore: scan.score?.overall ?? null,
            scoreJson:       (scan.score as object) ?? undefined,
            summaryJson:     {
              totalFindings:    scan.findings.length,
              criticalCount:    scan.findings.filter(f => f.severity === "critical").length,
              highCount:        scan.findings.filter(f => f.severity === "high").length,
            },
            findings: {
              create: scan.findings.map(f => ({
                ruleId:      f.ruleId,
                title:       f.title,
                description: f.description,
                severity:    toSeverityEnum(f.severity),
                category:    toCategoryEnum(f.category),
                filePath:    f.filePath,
                lineNumber:  f.lineNumber,
                snippet:     f.snippet,
                remediation: f.remediation,
                references:  f.references ?? [],
              })),
            },
          },
        });
        dbScanId = dbScan.id;
      } catch (dbErr) {
        // DB write failure is non-fatal — we still return the scan result
        console.warn("[analyze] DB write failed (non-fatal):", dbErr);
      }
    }

    return NextResponse.json({ data: { scan, report, documentation, dbScanId } });
  } catch (err) {
    console.error("[analyze] scan failed", err);
    return NextResponse.json({ error: "Scan failed. Check your input and try again." }, { status: 500 });
  }
}

/** Quick GET to confirm the endpoint is alive. */
export function GET(): NextResponse {
  return NextResponse.json({
    endpoint: "/api/scan/analyze",
    methods:  ["POST"],
    accepts:  {
      snippet:       "string",
      filePath:      "string",
      files:         "FileInput[]",
      reportFormat:  "'json'|'markdown'|'html'|'csv'",
      projectId:     "string (optional — persists to DB)",
      triggerSource: "'MANUAL'|'CLI'|'GITHUB_ACTIONS'|'GITLAB_CI'|'API'",
      commitSha:     "string",
      branch:        "string",
    },
    auth: "Bearer <dg_live_*> or X-DeployGuard-Key header",
  });
}
