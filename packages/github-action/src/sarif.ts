/**
 * SARIF 2.1.0 export
 *
 * Converts a DeployGuard ScanResult into a SARIF report suitable for upload
 * to GitHub Code Scanning (Security > Code scanning alerts).
 *
 * Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 * GitHub requirements: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
 */

import type { ScanResult, Finding, SeverityLevel } from "./types";

// ── SARIF type stubs ──────────────────────────────────────────────────────────
// A subset of the SARIF 2.1.0 schema sufficient for GitHub Code Scanning.

interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs:    SarifRun[];
}

interface SarifRun {
  tool:      SarifTool;
  results:   SarifResult[];
  artifacts: SarifArtifact[];
}

interface SarifTool {
  driver: SarifDriver;
}

interface SarifDriver {
  name:           string;
  version:        string;
  informationUri: string;
  rules:          SarifRule[];
}

interface SarifRule {
  id:               string;
  name:             string;
  shortDescription: { text: string };
  fullDescription:  { text: string };
  helpUri:          string;
  defaultConfiguration: { level: SarifLevel };
  properties: {
    tags:       string[];
    precision:  "high" | "medium" | "low";
    problem?: { severity: string };
    "security-severity"?: string;
  };
}

type SarifLevel = "error" | "warning" | "note" | "none";

interface SarifResult {
  ruleId:   string;
  message:  { text: string };
  level:    SarifLevel;
  locations: SarifLocation[];
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId: string };
    region: {
      startLine:   number;
      startColumn: number;
      endLine:     number;
      endColumn:   number;
    };
  };
  message?: { text: string };
}

interface SarifArtifact {
  location: { uri: string; uriBaseId: string };
}

// ── Severity mapping ──────────────────────────────────────────────────────────

const LEVEL_MAP: Record<SeverityLevel, SarifLevel> = {
  critical: "error",
  high:     "error",
  medium:   "warning",
  low:      "note",
  info:     "none",
};

// GitHub uses a numeric "security-severity" score (CVSS-like: 0.0–10.0)
const SECURITY_SEVERITY: Record<SeverityLevel, string> = {
  critical: "9.5",
  high:     "7.5",
  medium:   "5.0",
  low:      "3.0",
  info:     "1.0",
};

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildSarif(scan: ScanResult): SarifLog {
  const activeFindings = scan.findings.filter(f => !f.falsePositive);

  // Deduplicate rules from findings
  const ruleMap = new Map<string, Finding>();
  for (const f of activeFindings) {
    if (!ruleMap.has(f.ruleId)) ruleMap.set(f.ruleId, f);
  }

  const rules: SarifRule[] = [...ruleMap.values()].map(f => ({
    id:               f.ruleId,
    name:             toPascalCase(f.title),
    shortDescription: { text: f.title },
    fullDescription:  { text: f.description },
    helpUri:          `https://deployguard.dev/rules/${f.ruleId}`,
    defaultConfiguration: { level: LEVEL_MAP[f.severity] },
    properties: {
      tags:      [f.category, "security", "deployguard"],
      precision: "high",
      "security-severity": SECURITY_SEVERITY[f.severity],
    },
  }));

  // Unique artifact paths
  const artifactPaths = new Set(activeFindings.map(f => f.filePath).filter(Boolean) as string[]);
  const artifacts: SarifArtifact[] = [...artifactPaths].map(p => ({
    location: { uri: normalizePath(p), uriBaseId: "%SRCROOT%" },
  }));

  const results: SarifResult[] = activeFindings.map(f => ({
    ruleId:  f.ruleId,
    message: {
      text: `${f.title}. ${f.remediation ?? f.description}`,
    },
    level:     LEVEL_MAP[f.severity],
    locations: f.filePath
      ? [{
          physicalLocation: {
            artifactLocation: {
              uri:       normalizePath(f.filePath),
              uriBaseId: "%SRCROOT%",
            },
            region: {
              startLine:   f.lineNumber ?? 1,
              startColumn: 1,
              endLine:     f.lineNumber ?? 1,
              endColumn:   (f.snippet?.length ?? 0) + 1 || 80,
            },
          },
          message: { text: f.snippet ?? "" },
        }]
      : [],
    partialFingerprints: {
      "deployguardFingerprint/v1": `${f.ruleId}:${f.filePath ?? ""}:${f.lineNumber ?? 0}`,
    },
    properties: {
      category: f.category,
      severity: f.severity,
    },
  }));

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name:           "DeployGuard",
            version:        "1.0.0",
            informationUri: "https://deployguard.dev",
            rules,
          },
        },
        results,
        artifacts,
      },
    ],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePath(filePath: string): string {
  // SARIF requires forward slashes and no leading ./
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function toPascalCase(str: string): string {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
}
