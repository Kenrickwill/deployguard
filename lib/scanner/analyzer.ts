import type { Finding, ScanSummary, SeverityLevel, FindingCategory } from "@/types";

export function analyzeFindings(findings: Finding[]): ScanSummary {
  const active = findings.filter(f => !f.falsePositive);

  const counts = active.reduce(
    (acc, f) => { acc[f.severity]++; return acc; },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<SeverityLevel, number>,
  );

  return {
    total:    findings.length,
    critical: counts.critical,
    high:     counts.high,
    medium:   counts.medium,
    low:      counts.low,
    info:     counts.info,
    passed:   findings.filter(f => f.falsePositive).length,
    failed:   active.length,
  };
}

/** Group findings by their category. */
export function groupByCategory(findings: Finding[]): Record<FindingCategory, Finding[]> {
  return findings.reduce((acc, f) => {
    const k = f.category;
    if (!acc[k]) acc[k] = [];
    acc[k].push(f);
    return acc;
  }, {} as Record<FindingCategory, Finding[]>);
}

/** Group findings by severity, ordered most → least severe. */
export function groupBySeverity(findings: Finding[]): Record<SeverityLevel, Finding[]> {
  const order: SeverityLevel[] = ["critical", "high", "medium", "low", "info"];
  const result = {} as Record<SeverityLevel, Finding[]>;
  for (const s of order) result[s] = findings.filter(f => f.severity === s);
  return result;
}

/** Return the most critical findings to surface as top priorities. */
export function topPriorities(findings: Finding[], limit = 5): Finding[] {
  const order: Record<SeverityLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return [...findings]
    .filter(f => !f.falsePositive)
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, limit);
}
