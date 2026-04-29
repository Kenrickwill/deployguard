/**
 * Types shared across the VS Code extension.
 * Mirrors the DeployGuard core types but is intentionally self-contained
 * so the extension has no runtime dependency on the main monorepo.
 */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory =
  | "security" | "secrets" | "reliability" | "performance"
  | "dependency" | "configuration" | "compliance";

export interface FindingLocation {
  filePath:    string;
  lineStart:   number;
  lineEnd:     number;
  columnStart: number;
  columnEnd:   number;
  snippet?:    string;
}

export interface FindingFix {
  description: string;
  edits: Array<{
    filePath: string;
    line:     number;
    oldText:  string;
    newText:  string;
  }>;
  sideEffects?: string[];
}

export interface Finding {
  id:           string;
  ruleId:       string;
  title:        string;
  description:  string;
  severity:     SeverityLevel;
  category:     FindingCategory;
  location:     FindingLocation;
  remediation:  string;
  fix?:         FindingFix;
  references:   string[];
  falsePositive: boolean;
  fingerprint:  string;
}

export interface ScanResult {
  scanId:      string;
  targetPath:  string;
  startedAt:   string;
  completedAt: string;
  score: {
    overall:        number;
    security:       number;
    reliability:    number;
    performance:    number;
    compliance:     number;
    recommendation: "deploy" | "review" | "block";
  };
  summary: {
    total: number; critical: number; high: number;
    medium: number; low: number; info: number;
  };
  findings: Finding[];
}

export interface ExtensionConfig {
  apiUrl:                  string;
  apiToken:                string;
  scanOnSave:              boolean;
  scanOnOpen:              boolean;
  minSeverityToShow:       SeverityLevel;
  enableInlineDecorations: boolean;
  enableQuickFixes:        boolean;
  ignoredRules:            string[];
}
