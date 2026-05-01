/**
 * Gate evaluator — decides PASS / WARN / FAIL from a scan or dynamic result.
 * Shared by both the CLI and the GitHub Action.
 */

import type { ScanResult, DynamicSession, GateResult, GateOptions } from "../types";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

export function evaluateScanGate(result: ScanResult, opts: GateOptions): GateResult {
  const checks: GateResult["checks"] = [];
  const { score, findings } = result;
  const blockOnSet = new Set(opts.blockOn.map(s => s.toLowerCase()));

  // Check 1: minimum score
  const scorePassed = score.overall >= opts.minScore;
  checks.push({
    name:   "Minimum score",
    passed: scorePassed,
    detail: scorePassed
      ? `Score ${score.overall}/100 meets the threshold of ${opts.minScore}.`
      : `Score ${score.overall}/100 is below the required minimum of ${opts.minScore}.`,
  });

  // Check 2: no blocked severities
  const blocked = findings.filter(f => blockOnSet.has(f.severity));
  const severityPassed = blocked.length === 0;
  const counts = [...blockOnSet]
    .map(sev => {
      const n = findings.filter(f => f.severity === sev).length;
      return n > 0 ? `${n} ${sev}` : null;
    })
    .filter(Boolean);
  checks.push({
    name:   `Severity gate (block-on: ${opts.blockOn.join(", ")})`,
    passed: severityPassed,
    detail: severityPassed
      ? "No findings at blocked severity levels."
      : `Found: ${counts.join(", ")}.`,
  });

  // Check 3: recommendation
  const recPassed = score.recommendation !== "block";
  checks.push({
    name:   "Deploy recommendation",
    passed: recPassed,
    detail: recPassed
      ? `Recommendation: ${score.recommendation.toUpperCase()}.`
      : "DeployGuard recommends BLOCK. Resolve critical findings before deploying.",
  });

  const allPassed = checks.every(c => c.passed);
  const failedDetails = checks.filter(c => !c.passed).map(c => c.detail);

  return {
    passed: allPassed,
    reason: allPassed
      ? `Score: ${score.overall}/100 · ${score.recommendation.toUpperCase()} · ${findings.length} finding${findings.length !== 1 ? "s" : ""}`
      : failedDetails.join(" | "),
    checks,
  };
}

export function evaluateDynamicGate(session: DynamicSession, opts: GateOptions): GateResult {
  const checks: GateResult["checks"] = [];
  const blockOnSet = new Set(opts.blockOn.map(s => s.toLowerCase()));

  const vulnEntries = session.entries.filter(e => e.vulnerable);
  const blocked     = vulnEntries.filter(e => blockOnSet.has(e.severity));

  // Score equivalent: % of probes passed
  const score     = session.entries.length > 0
    ? Math.round(((session.entries.length - vulnEntries.length) / session.entries.length) * 100)
    : 100;
  const scorePassed = score >= opts.minScore;
  checks.push({
    name:   "Minimum score",
    passed: scorePassed,
    detail: scorePassed
      ? `Score ${score}/100 meets threshold of ${opts.minScore}.`
      : `Score ${score}/100 is below the required minimum of ${opts.minScore}.`,
  });

  const severityPassed = blocked.length === 0;
  const counts = [...blockOnSet]
    .map(sev => {
      const n = vulnEntries.filter(e => e.severity === sev).length;
      return n > 0 ? `${n} ${sev}` : null;
    })
    .filter(Boolean);
  checks.push({
    name:   `Severity gate (block-on: ${opts.blockOn.join(", ")})`,
    passed: severityPassed,
    detail: severityPassed
      ? "No vulnerable probes at blocked severity levels."
      : `Found: ${counts.join(", ")}.`,
  });

  const allPassed = checks.every(c => c.passed);
  const failedDetails = checks.filter(c => !c.passed).map(c => c.detail);

  return {
    passed: allPassed,
    reason: allPassed
      ? `Score: ${score}/100 · ${vulnEntries.length} issue${vulnEntries.length !== 1 ? "s" : ""} found`
      : failedDetails.join(" | "),
    checks,
  };
}
