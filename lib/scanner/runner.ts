import type { Finding, ScanResult, ScanTarget } from "@/types";
import { loadRules, buildContext } from "./rules";
import { analyzeFindings } from "./analyzer";
import { calculateScore } from "@/lib/scoring";

export interface FileInput {
  path: string;
  content: string;
}

export interface ScanOptions {
  enabledRuleIds?: string[];     // undefined = all rules
  disabledRuleIds?: string[];    // rules to skip even if enabled
  skipTestFiles?: boolean;       // default: true
  maxFindingsPerFile?: number;   // cap findings per file to reduce noise
}

/** Run all applicable scanner rules against a set of files. */
export async function runScan(
  target: ScanTarget,
  files: FileInput[],
  options: ScanOptions = {},
): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const allRules = loadRules().filter(r => {
    if (options.enabledRuleIds && !options.enabledRuleIds.includes(r.id)) return false;
    if (options.disabledRuleIds?.includes(r.id)) return false;
    return true;
  });

  const findings: Finding[] = [];

  for (const file of files) {
    const ctx = buildContext(file.path, file.content);

    // Honour skipTestFiles (default on)
    if ((options.skipTestFiles ?? true) && ctx.isTestFile) continue;

    let fileCount = 0;
    const maxPerFile = options.maxFindingsPerFile ?? 20;

    for (const rule of allRules) {
      if (fileCount >= maxPerFile) break;
      let matches;
      try {
        matches = rule.check(ctx);
      } catch {
        // A buggy rule must not crash the whole scan
        continue;
      }
      for (const match of matches) {
        if (fileCount >= maxPerFile) break;
        findings.push({
          id: crypto.randomUUID(),
          ruleId: rule.id,
          title: rule.title,
          description: match.message ? `${rule.description}\n\n${match.message}` : rule.description,
          severity: rule.severity,
          category: rule.category,
          filePath: file.path,
          lineNumber: match.lineNumber,
          snippet: match.snippet,
          remediation: rule.remediation,
          references: rule.references,
          falsePositive: false,
        });
        fileCount++;
      }
    }
  }

  // Deduplicate: same ruleId + filePath + lineNumber → keep first
  const seen = new Set<string>();
  const deduplicated = findings.filter(f => {
    const key = `${f.ruleId}:${f.filePath}:${f.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = analyzeFindings(deduplicated);
  const score   = calculateScore(summary, deduplicated);
  const completedAt = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    targetId: target.id,
    status: "completed",
    startedAt,
    completedAt,
    score,
    findings: deduplicated,
    summary,
  };
}

/**
 * Convenience: scan a single code snippet (e.g. pasted by a user).
 * Creates a synthetic single-file target.
 */
export async function scanSnippet(
  code: string,
  filePath = "snippet.ts",
): Promise<ScanResult> {
  const target: ScanTarget = {
    id: crypto.randomUUID(),
    name: "snippet",
    environment: "staging",
  };
  return runScan(target, [{ path: filePath, content: code }]);
}
