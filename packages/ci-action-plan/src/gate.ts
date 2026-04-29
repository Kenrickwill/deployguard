/**
 * Gate evaluator — decides whether the CI scan passes or blocks.
 *
 * Three independent checks, all must pass:
 *   1. Score gate:    overall score >= min-score
 *   2. Severity gate: no findings at or above blocked severities
 *   3. Recommendation gate: score.recommendation !== "block"
 *
 * Each check is reported individually so engineers know exactly why CI failed.
 */

import type { ScanResult, GateResult, SeverityLevel } from "./types";

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

interface GateOptions {
  minScore: number;
  blockOn:  string[];   // e.g. ["critical", "high"]
}

export function evaluateGate(result: ScanResult, options: GateOptions): GateResult {
  const checks: GateResult["checks"] = [];
  const { score, summary, findings } = result;
  const blockOnSet = new Set(options.blockOn.map(s => s.toLowerCase()));

  // ── Check 1: Minimum score ─────────────────────────────────────────────────

  const scorePassed = score.overall >= options.minScore;
  checks.push({
    name:   "Minimum score",
    passed: scorePassed,
    detail: scorePassed
      ? `Score ${score.overall} meets threshold of ${options.minScore}.`
      : `Score ${score.overall} is below the required minimum of ${options.minScore}.`,
  });

  // ── Check 2: Blocked severities ────────────────────────────────────────────

  const blockedFindings = findings.filter(
    f => !f.falsePositive && blockOnSet.has(f.severity),
  );
  const severityPassed = blockedFindings.length === 0;

  const blockedCounts = [...blockOnSet].map(sev => {
    const count = findings.filter(f => !f.falsePositive && f.severity === sev).length;
    return count > 0 ? `${count} ${sev}` : null;
  }).filter(Boolean);

  checks.push({
    name:   `Severity gate (block-on: ${options.blockOn.join(", ")})`,
    passed: severityPassed,
    detail: severityPassed
      ? `No findings at blocked severity levels.`
      : `Found: ${blockedCounts.join(", ")}. These severities are set to block deployment.`,
  });

  // ── Check 3: Recommendation ────────────────────────────────────────────────

  const recPassed = score.recommendation !== "block";
  checks.push({
    name:   "Deploy recommendation",
    passed: recPassed,
    detail: recPassed
      ? `Recommendation: ${score.recommendation.toUpperCase()}.`
      : `DeployGuard recommends BLOCK. Resolve critical findings before deploying.`,
  });

  // ── Aggregate ──────────────────────────────────────────────────────────────

  const allPassed = checks.every(c => c.passed);
  const failedChecks = checks.filter(c => !c.passed).map(c => c.detail);

  return {
    passed: allPassed,
    reason: allPassed
      ? `Score: ${score.overall}/100 · ${score.recommendation.toUpperCase()} · ${findings.filter(f => !f.falsePositive).length} findings`
      : failedChecks.join(" | "),
    checks,
  };
}

/** Format gate results as a compact text summary for log output. */
export function formatGateLog(gate: GateResult): string {
  const icon = (p: boolean) => p ? "✓" : "✗";
  return gate.checks.map(c => `  ${icon(c.passed)} ${c.name}: ${c.detail}`).join("\n");
}
