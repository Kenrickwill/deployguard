import { AGENT_GUARDRAILS } from "./types";
import type {
  AgentRequest,
  AgentProvider,
  AgentMessage,
  ExplainFindingRequest,
  PrioritizeRisksRequest,
  SuggestFixRequest,
  GenerateDocsRequest,
  ExecutiveSummaryRequest,
  NextActionsRequest,
} from "./types";

// ─── System Prompt ────────────────────────────────────────────────────────────

function systemPrompt(): string {
  return AGENT_GUARDRAILS;
}

// ─── Action: explain_finding ──────────────────────────────────────────────────

export async function explainFinding(
  req: ExplainFindingRequest,
  provider: AgentProvider,
): Promise<string> {
  const { finding, audience } = req;

  const userPrompt = [
    "ACTION:explain_finding",
    `FINDING_TITLE: ${finding.title}`,
    `RULE_ID: ${finding.ruleId}`,
    `SEVERITY: ${finding.severity}`,
    `CATEGORY: ${finding.category}`,
    `DESCRIPTION: ${finding.description}`,
    finding.filePath ? `LOCATION: ${finding.filePath}:${finding.lineNumber ?? 0}` : "",
    finding.snippet  ? `SNIPPET: ${finding.snippet}` : "",
    finding.remediation ? `REMEDIATION_HINT: ${finding.remediation}` : "",
    `AUDIENCE: ${audience}`,
    "",
    `Explain this security finding for a ${audience} audience.`,
  ].filter(Boolean).join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Action: prioritize_risks ─────────────────────────────────────────────────

export async function prioritizeRisks(
  req: PrioritizeRisksRequest,
  provider: AgentProvider,
): Promise<string> {
  const { scan, topN = 5 } = req;
  const { score, summary, findings } = scan.scan;

  const topFindings = [...findings]
    .filter(f => !f.falsePositive)
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, topN);

  const findingsList = topFindings.map((f, i) =>
    `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.ruleId}) — ${f.filePath ?? "unknown file"}`
  ).join("\n");

  const userPrompt = [
    "ACTION:prioritize_risks",
    `TARGET: ${scan.targetName ?? "Unknown"}`,
    `OVERALL_SCORE: ${score.overall}`,
    `RECOMMENDATION: ${score.recommendation}`,
    `CRITICAL_COUNT: ${summary.critical}`,
    `HIGH_COUNT: ${summary.high}`,
    `MEDIUM_COUNT: ${summary.medium}`,
    `LOW_COUNT: ${summary.low}`,
    `INFO_COUNT: ${summary.info}`,
    `TOP_FINDINGS:\n${findingsList || "None"}`,
    "",
    `Prioritize these risks and explain what to fix first and why.`,
  ].join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Action: suggest_fix ──────────────────────────────────────────────────────

export async function suggestFix(
  req: SuggestFixRequest,
  provider: AgentProvider,
): Promise<string> {
  const { finding, language = "typescript" } = req;

  const userPrompt = [
    "ACTION:suggest_fix",
    `FINDING_TITLE: ${finding.title}`,
    `RULE_ID: ${finding.ruleId}`,
    `SEVERITY: ${finding.severity}`,
    `DESCRIPTION: ${finding.description}`,
    finding.filePath  ? `LOCATION: ${finding.filePath}:${finding.lineNumber ?? 0}` : "",
    finding.snippet   ? `SNIPPET: ${finding.snippet}` : "",
    finding.remediation ? `REMEDIATION_HINT: ${finding.remediation}` : "",
    (finding.references?.length ?? 0) > 0
      ? `REFERENCES: ${finding.references!.join(", ")}` : "",
    `LANGUAGE: ${language}`,
    "",
    `Provide a concrete, secure fix for this finding with before/after code examples.`,
  ].filter(Boolean).join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Action: generate_docs ────────────────────────────────────────────────────

export async function generateDocs(
  req: GenerateDocsRequest,
  provider: AgentProvider,
): Promise<string> {
  const { scan, format } = req;
  const { score, summary, findings } = scan.scan;

  const active = findings.filter(f => !f.falsePositive);
  const findingLines = active.map(f =>
    `- [${f.severity.toUpperCase()}] ${f.title} (${f.ruleId}) at ${f.filePath ?? "unknown"}:${f.lineNumber ?? 0}`
  ).join("\n");

  const userPrompt = [
    "ACTION:generate_docs",
    `TARGET_NAME: ${scan.targetName ?? "Application"}`,
    `OVERALL_SCORE: ${score.overall}`,
    `RECOMMENDATION: ${score.recommendation}`,
    `TOTAL_FINDINGS: ${summary.total}`,
    `CRITICAL_COUNT: ${summary.critical}`,
    `HIGH_COUNT: ${summary.high}`,
    `MEDIUM_COUNT: ${summary.medium}`,
    `FORMAT: ${format}`,
    `FINDINGS:\n${findingLines || "No active findings"}`,
    "",
    `Generate developer-facing documentation for all findings in ${format} format.`,
  ].join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Action: executive_summary ────────────────────────────────────────────────

export async function executiveSummary(
  req: ExecutiveSummaryRequest,
  provider: AgentProvider,
): Promise<string> {
  const { scan, companyName } = req;
  const { score, summary } = scan.scan;

  const userPrompt = [
    "ACTION:executive_summary",
    `TARGET_NAME: ${scan.targetName ?? "Application"}`,
    `COMPANY_NAME: ${companyName ?? ""}`,
    `ENVIRONMENT: ${scan.environment ?? "staging"}`,
    `OVERALL_SCORE: ${score.overall}`,
    `RECOMMENDATION: ${score.recommendation}`,
    `CRITICAL_COUNT: ${summary.critical}`,
    `HIGH_COUNT: ${summary.high}`,
    `MEDIUM_COUNT: ${summary.medium}`,
    `LOW_COUNT: ${summary.low}`,
    `SECURITY_SCORE: ${score.security}`,
    `COMPLIANCE_SCORE: ${score.compliance}`,
    "",
    `Write a non-technical executive summary suitable for a client or leadership report.`,
  ].join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Action: next_actions ─────────────────────────────────────────────────────

export async function nextActions(
  req: NextActionsRequest,
  provider: AgentProvider,
): Promise<string> {
  const { scan, horizon = "sprint" } = req;
  const { score, summary } = scan.scan;

  const userPrompt = [
    "ACTION:next_actions",
    `TARGET_NAME: ${scan.targetName ?? "Application"}`,
    `HORIZON: ${horizon}`,
    `OVERALL_SCORE: ${score.overall}`,
    `RECOMMENDATION: ${score.recommendation}`,
    `CRITICAL_COUNT: ${summary.critical}`,
    `HIGH_COUNT: ${summary.high}`,
    `MEDIUM_COUNT: ${summary.medium}`,
    `LOW_COUNT: ${summary.low}`,
    "",
    `Produce a prioritized, actionable next-steps plan for the ${horizon} horizon.`,
  ].join("\n");

  return provider.complete(systemPrompt(), userPrompt);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatchAction(
  req: AgentRequest,
  provider: AgentProvider,
): Promise<AgentMessage> {
  const start = Date.now();

  let content: string;
  switch (req.action) {
    case "explain_finding":   content = await explainFinding(req, provider);   break;
    case "prioritize_risks":  content = await prioritizeRisks(req, provider);  break;
    case "suggest_fix":       content = await suggestFix(req, provider);       break;
    case "generate_docs":     content = await generateDocs(req, provider);     break;
    case "executive_summary": content = await executiveSummary(req, provider); break;
    case "next_actions":      content = await nextActions(req, provider);      break;
    default: {
      const _exhaustive: never = req;
      throw new Error(`Unknown action: ${(_exhaustive as AgentRequest).action}`);
    }
  }

  return {
    role:      "agent",
    action:    req.action,
    content,
    model:     provider.name,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}
