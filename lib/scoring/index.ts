import type { DeployScore, Finding, FindingCategory, ScanSummary } from "@/types";

// ─── Weights ──────────────────────────────────────────────────────────────────

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 25,
  high:     10,
  medium:    4,
  low:       1,
  info:      0,
};

const CATEGORY_WEIGHT: Record<FindingCategory, number> = {
  security:      1.5,
  reliability:   1.0,
  performance:   0.8,
  compliance:    1.2,
  configuration: 0.9,
  dependency:    1.1,
  secrets:       2.0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryScore(findings: Finding[], category: FindingCategory): number {
  const relevant = findings.filter(f => !f.falsePositive && f.category === category);
  if (relevant.length === 0) return 100;
  const penalty = relevant.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity] * CATEGORY_WEIGHT[category], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateScore(summary: ScanSummary, findings: Finding[] = []): DeployScore {
  const rawPenalty =
    summary.critical * SEVERITY_PENALTY.critical +
    summary.high     * SEVERITY_PENALTY.high +
    summary.medium   * SEVERITY_PENALTY.medium +
    summary.low      * SEVERITY_PENALTY.low;

  const overall = Math.max(0, Math.min(100, 100 - rawPenalty));

  const security     = findings.length > 0 ? categoryScore(findings, "security")     : (summary.critical === 0 && summary.high === 0 ? 90 : Math.max(0, 80 - summary.critical * 30 - summary.high * 10));
  const performance  = findings.length > 0 ? categoryScore(findings, "performance")  : Math.max(0, 100 - summary.medium * 5);
  const reliability  = findings.length > 0 ? categoryScore(findings, "reliability")  : Math.max(0, 100 - summary.high * 8 - summary.medium * 3);
  const compliance   = findings.length > 0 ? categoryScore(findings, "compliance")   : (summary.critical === 0 ? 85 : 40);

  let recommendation: DeployScore["recommendation"] = "deploy";
  if (summary.critical > 0 || overall < 50) recommendation = "block";
  else if (summary.high > 0 || overall < 75) recommendation = "review";

  return { overall, security, performance, reliability, compliance, recommendation };
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

export function recommendationColor(rec: DeployScore["recommendation"]): string {
  return { deploy: "green", review: "yellow", block: "red" }[rec];
}

export function scoreTrend(scores: number[]): "up" | "down" | "stable" {
  if (scores.length < 2) return "stable";
  const delta = scores[scores.length - 1] - scores[0];
  if (delta > 3) return "up";
  if (delta < -3) return "down";
  return "stable";
}
