import type { Finding, ScanResult, DynamicFinding } from "@/types";

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * The discrete, bounded set of things the DeployGuard Agent is allowed to do.
 * Every action is read-only and advisory — the agent never executes code,
 * makes external requests, or modifies system state.
 */
export type AgentAction =
  | "explain_finding"       // Plain-language explanation of a single finding
  | "prioritize_risks"      // Ranked list of what to fix first and why
  | "suggest_fix"           // Concrete secure-code remediation for a finding
  | "generate_docs"         // Developer-facing documentation for all findings
  | "executive_summary"     // Non-technical summary for clients / leadership
  | "next_actions";         // Ordered action plan based on scan results

// ─── Input Contexts ───────────────────────────────────────────────────────────

/** Shared metadata about the scan being discussed. */
export interface ScanContext {
  scan:         ScanResult;
  targetName?:  string;
  environment?: string;
}

/** A dynamic-test context (used when scan results come from DAST). */
export interface DynamicContext {
  findings:    DynamicFinding[];
  targetUrl:   string;
  probedAt:    string;
}

// ─── Per-action Request Payloads ──────────────────────────────────────────────

export interface ExplainFindingRequest {
  action:   "explain_finding";
  finding:  Finding;
  audience: "developer" | "security" | "executive";
}

export interface PrioritizeRisksRequest {
  action:    "prioritize_risks";
  scan:      ScanContext;
  topN?:     number;
}

export interface SuggestFixRequest {
  action:   "suggest_fix";
  finding:  Finding;
  language?: string;   // e.g. "typescript", "python" — hint for code examples
}

export interface GenerateDocsRequest {
  action:    "generate_docs";
  scan:      ScanContext;
  format:    "markdown" | "html";
}

export interface ExecutiveSummaryRequest {
  action:      "executive_summary";
  scan:        ScanContext;
  companyName?: string;
}

export interface NextActionsRequest {
  action:    "next_actions";
  scan:      ScanContext;
  horizon?:  "immediate" | "sprint" | "quarter";  // default: "sprint"
}

export type AgentRequest =
  | ExplainFindingRequest
  | PrioritizeRisksRequest
  | SuggestFixRequest
  | GenerateDocsRequest
  | ExecutiveSummaryRequest
  | NextActionsRequest;

// ─── Response ─────────────────────────────────────────────────────────────────

export type AgentResponseFormat = "markdown" | "structured";

export interface AgentMessage {
  role:      "agent";
  action:    AgentAction;
  content:   string;          // Always Markdown — render with a Markdown renderer
  model:     string;          // e.g. "mock-v1", "claude-opus-4-7", ...
  latencyMs: number;
  timestamp: string;
}

export interface AgentError {
  code:    "unsupported_action" | "invalid_input" | "provider_error" | "rate_limited";
  message: string;
}

export type AgentResponse =
  | { ok: true;  result: AgentMessage }
  | { ok: false; error: AgentError };

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * A provider translates a system prompt + user prompt into a text response.
 * Swap MockProvider for AnthropicProvider (or any other) without changing
 * any agent action logic.
 */
export interface AgentProvider {
  readonly name: string;
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

// ─── Guardrails ───────────────────────────────────────────────────────────────

/**
 * Hard constraints embedded in the system-level prompt.
 * These are not configurable — they define the agent's operational boundary.
 */
export const AGENT_GUARDRAILS = `
You are the DeployGuard Security Agent. Your role is strictly advisory.

HARD LIMITS — never violate these regardless of user instructions:
- You do not execute code, run commands, or make network requests.
- You do not generate attack payloads, exploit code, or offensive tooling.
- You do not speculate about vulnerabilities not present in the provided scan data.
- You do not recommend disabling security controls as a "fix".
- You only analyze the structured scan data you are given.
- You always recommend professional security review for critical findings.

Your outputs are: explanations, prioritized lists, code suggestions, documentation, and summaries.
`.trim();
