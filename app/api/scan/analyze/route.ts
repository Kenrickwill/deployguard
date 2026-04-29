import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanSnippet, runScan } from "@/lib/scanner";
import { generateReport } from "@/lib/reporting";
import { generateScanDocumentation } from "@/lib/documentation";
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
});

type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ─── Response Shape ───────────────────────────────────────────────────────────

interface AnalyzeResponse {
  scan:          ScanResult;
  report?:       string;
  documentation?: ReturnType<typeof generateScanDocumentation>;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AnalyzeResponse>>> {
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

    return NextResponse.json({ data: { scan, report, documentation } });
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
    accepts:  "{ snippet?: string, filePath?: string, files?: FileInput[], reportFormat?: 'json'|'markdown'|'html'|'csv' }",
  });
}
