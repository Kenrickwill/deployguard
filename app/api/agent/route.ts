import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgentAction } from "@/lib/agent";
import type { AgentRequest } from "@/lib/agent";
import type { ApiResponse } from "@/types/api";
import type { AgentMessage } from "@/lib/agent/types";

// ─── Request Validation ───────────────────────────────────────────────────────

const FindingSchema = z.object({
  id:          z.string(),
  ruleId:      z.string(),
  title:       z.string(),
  description: z.string(),
  severity:    z.enum(["critical", "high", "medium", "low", "info"]),
  category:    z.string(),
  filePath:    z.string().optional(),
  lineNumber:  z.number().optional(),
  snippet:     z.string().optional(),
  remediation: z.string().optional(),
  references:  z.array(z.string()).optional(),
  falsePositive: z.boolean().optional(),
});

const ScanResultSchema = z.object({
  id:          z.string(),
  targetId:    z.string(),
  status:      z.string(),
  startedAt:   z.string(),
  completedAt: z.string().optional(),
  score:       z.object({
    overall:        z.number(),
    security:       z.number(),
    performance:    z.number(),
    reliability:    z.number(),
    compliance:     z.number(),
    recommendation: z.enum(["deploy", "review", "block"]),
  }),
  findings: z.array(FindingSchema),
  summary: z.object({
    total:    z.number(),
    critical: z.number(),
    high:     z.number(),
    medium:   z.number(),
    low:      z.number(),
    info:     z.number(),
    passed:   z.number(),
    failed:   z.number(),
  }),
});

const ScanContextSchema = z.object({
  scan:        ScanResultSchema,
  targetName:  z.string().optional(),
  environment: z.string().optional(),
});

const AgentRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action:   z.literal("explain_finding"),
    finding:  FindingSchema,
    audience: z.enum(["developer", "security", "executive"]),
  }),
  z.object({
    action: z.literal("prioritize_risks"),
    scan:   ScanContextSchema,
    topN:   z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    action:   z.literal("suggest_fix"),
    finding:  FindingSchema,
    language: z.string().optional(),
  }),
  z.object({
    action:  z.literal("generate_docs"),
    scan:    ScanContextSchema,
    format:  z.enum(["markdown", "html"]),
  }),
  z.object({
    action:      z.literal("executive_summary"),
    scan:        ScanContextSchema,
    companyName: z.string().optional(),
  }),
  z.object({
    action:   z.literal("next_actions"),
    scan:     ScanContextSchema,
    horizon:  z.enum(["immediate", "sprint", "quarter"]).optional(),
  }),
]);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<AgentMessage>>> {
  let body: AgentRequest;

  try {
    const raw = await req.json();
    const parsed = AgentRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i: { path: (string|number)[]; message: string }) =>
        `${i.path.join(".")}: ${i.message}`
      ).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }
    body = parsed.data as AgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const response = await runAgentAction(body);

  if (!response.ok) {
    const status = response.error.code === "rate_limited" ? 429 : 500;
    return NextResponse.json({ error: response.error.message }, { status });
  }

  return NextResponse.json({ data: response.result });
}

export function GET(): NextResponse {
  return NextResponse.json({
    endpoint: "/api/agent",
    version:  "1.0",
    actions: [
      { action: "explain_finding",   description: "Plain-language explanation of a finding for a given audience" },
      { action: "prioritize_risks",  description: "Ranked list of what to fix first and why" },
      { action: "suggest_fix",       description: "Concrete secure-code remediation with before/after examples" },
      { action: "generate_docs",     description: "Developer-facing documentation for all scan findings" },
      { action: "executive_summary", description: "Non-technical summary for clients or leadership" },
      { action: "next_actions",      description: "Prioritized action plan for immediate/sprint/quarter horizon" },
    ],
    guardrails: [
      "Read-only and advisory only",
      "No code execution or network requests",
      "No attack payload generation",
      "Only analyzes provided scan data",
    ],
  });
}
