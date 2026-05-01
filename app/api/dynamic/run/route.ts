import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { runDynamicTest } from "@/lib/dynamic-testing";
import type { ProbeResult } from "@/lib/dynamic-testing";
import { validateApiKey } from "@/lib/auth/api-key";
import prisma from "@/lib/db/client";
import type { ApiResponse } from "@/types/api";
import type { DynamicTestEntry, DynamicTestSession } from "@/types";

// ─── Request Schema ───────────────────────────────────────────────────────────

const RunRequestSchema = z.object({
  targetUrl:   z.string().url("targetUrl must be a valid URL."),
  authorizedBy: z.string().min(1, "authorizedBy is required."),
  acknowledgments: z.object({
    hasAuthority:        z.literal(true, { errorMap: () => ({ message: "You must confirm you have authority to test this target." }) }),
    isNotProduction:     z.literal(true, { errorMap: () => ({ message: "Dynamic tests must only be run against non-production environments." }) }),
    understandsReadOnly: z.literal(true, { errorMap: () => ({ message: "You must confirm you understand the read-only scope of testing." }) }),
  }),
  /** Auth type drives which extraHeaders are injected into the probe request. */
  authType:    z.enum(["none", "bearer", "basic", "cookie"]).optional(),
  credentials: z.object({
    token:    z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    cookie:   z.string().optional(),
  }).optional(),
  timeoutMs: z.number().int().min(5_000).max(60_000).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the extra headers to send with every probe request based on auth selection. */
function buildAuthHeaders(
  authType: string | undefined,
  credentials: { token?: string; username?: string; password?: string; cookie?: string } | undefined,
): Record<string, string> {
  if (!authType || authType === "none" || !credentials) return {};
  switch (authType) {
    case "bearer":
      return credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {};
    case "basic": {
      if (!credentials.username) return {};
      const encoded = Buffer.from(`${credentials.username}:${credentials.password ?? ""}`).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
    case "cookie":
      return credentials.cookie ? { Cookie: credentials.cookie } : {};
    default:
      return {};
  }
}

/** Convert a single ProbeResult from the engine into a DynamicTestEntry for the UI. */
function probeToEntry(probe: ProbeResult, targetUrl: string, responseTimeMs: number): DynamicTestEntry {
  return {
    id:           randomUUID(),
    endpoint:     targetUrl,
    testType:     probe.name,
    vulnerable:   !probe.passed,
    severity:     probe.finding?.severity ?? "info",
    details:      probe.finding?.description ?? probe.description,
    payload:      probe.finding?.evidence    ?? "Passive header inspection — no payload sent to target.",
    responseTime: `${responseTimeMs}ms`,
    remediation:  probe.finding?.remediation,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<DynamicTestSession>>> {
  // API key validation (no-op in dev when DB is unavailable)
  const auth = await validateApiKey(req, "scan:write");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Parse + validate body
  let body: z.infer<typeof RunRequestSchema>;
  try {
    const raw = await req.json();
    const parsed = RunRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join("; ") },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Build auth headers from credentials
  const extraHeaders = buildAuthHeaders(body.authType, body.credentials);

  try {
    const startMs = Date.now();

    const result = await runDynamicTest(
      {
        targetUrl:    body.targetUrl,
        authorizedBy: body.authorizedBy,
        acknowledgments: body.acknowledgments,
      },
      {
        timeoutMs:    body.timeoutMs ?? 15_000,
        extraHeaders,
      },
    );

    const responseTimeMs = Date.now() - startMs;

    // Convert probe results → display entries
    const entries: DynamicTestEntry[] = result.results.map(probe =>
      probeToEntry(probe, body.targetUrl, responseTimeMs),
    );

    const session: DynamicTestSession = {
      id:             randomUUID(),
      targetUrl:      body.targetUrl,
      authorizedBy:   body.authorizedBy,
      runAt:          result.probedAt,
      responseTimeMs,
      entries,
      findings:       result.findings,
    };

    // ── Persist to database (best-effort) ──────────────────────────────────────
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = prisma as any;
      const vulnEntries = entries.filter(e => e.vulnerable);
      await db.sandboxJob.create({
        data: {
          targetUrl:   body.targetUrl,
          status:      "COMPLETED",
          startedAt:   new Date(result.probedAt),
          completedAt: new Date(),
        },
      });
      // Audit log
      void db.auditLog.create({
        data: {
          actor:      auth.userId ?? body.authorizedBy,
          action:     "dynamic_test.run",
          resource:   "DynamicTest",
          resourceId: session.id,
          metadata:   {
            targetUrl:     body.targetUrl,
            probesRun:     entries.length,
            vulnerabilities: vulnEntries.length,
          },
        },
      }).catch(() => { /* non-critical */ });
    } catch {
      // DB write failure is non-fatal
    }

    return NextResponse.json({ data: session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dynamic test failed.";
    // Distinguish "couldn't reach target" from internal errors
    const status = message.startsWith("Failed to reach target") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Confirm the endpoint is alive. */
export function GET(): NextResponse {
  return NextResponse.json({
    endpoint: "/api/dynamic/run",
    methods:  ["POST"],
    sandbox:  "/api/dynamic/sandbox",
    accepts: {
      targetUrl:       "string (URL)",
      authorizedBy:    "string",
      acknowledgments: "{ hasAuthority: true, isNotProduction: true, understandsReadOnly: true }",
      authType:        "'none' | 'bearer' | 'basic' | 'cookie'",
      credentials:     "{ token?, username?, password?, cookie? }",
      timeoutMs:       "number (5000–60000)",
    },
  });
}
