/** Types shared across the CI action. Self-contained — no monorepo dependency. */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id:            string;
  ruleId:        string;
  title:         string;
  description:   string;
  severity:      SeverityLevel;
  category:      string;
  filePath?:     string;
  lineNumber?:   number;
  snippet?:      string;
  remediation?:  string;
  references?:   string[];
  falsePositive: boolean;
}

export interface ScanScore {
  overall:        number;
  security:       number;
  performance:    number;
  reliability:    number;
  compliance:     number;
  recommendation: "deploy" | "review" | "block";
}

export interface ScanSummary {
  total: number; critical: number; high: number;
  medium: number; low: number; info: number;
  passed: number; failed: number;
}

export interface ScanResult {
  id:          string;
  targetId:    string;
  status:      string;
  startedAt:   string;
  completedAt?: string;
  score:       ScanScore;
  summary:     ScanSummary;
  findings:    Finding[];
}

/** Shape written to disk and uploaded as a CI artifact. */
export interface CIReport {
  schemaVersion: "1.0";
  generatedAt:   string;
  repository:    string;
  commit:        string;
  ref:           string;
  scanPath:      string;
  environment:   string;
  score:         ScanScore;
  summary:       ScanSummary;
  findings:      Finding[];
  gate: {
    minScore: number;
    blockOn:  string[];
  };
}

export interface GateResult {
  passed: boolean;
  reason: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}
