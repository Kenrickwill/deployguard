// ── API response shapes (mirrors the Next.js app types) ───────────────────────

export interface Finding {
  ruleId:      string;
  title:       string;
  description: string;
  severity:    "critical" | "high" | "medium" | "low" | "info";
  category:    string;
  filePath?:   string;
  lineNumber?: number;
  snippet?:    string;
  remediation?: string;
}

export interface Score {
  overall:        number;
  recommendation: "deploy" | "review" | "block";
  categories?:    Record<string, number>;
}

export interface ScanResult {
  id:        string;
  score:     Score;
  findings:  Finding[];
  summary?:  Record<string, unknown>;
  scannedAt?: string;
}

export interface DynamicEntry {
  id:           string;
  testType:     string;
  vulnerable:   boolean;
  severity:     string;
  details:      string;
  payload:      string;
  responseTime: string;
  remediation?: string;
}

export interface DynamicSession {
  id:             string;
  targetUrl:      string;
  authorizedBy:   string;
  runAt:          string;
  responseTimeMs: number;
  entries:        DynamicEntry[];
}

export interface GateCheckResult {
  name:   string;
  passed: boolean;
  detail: string;
}

export interface GateResult {
  passed:  boolean;
  reason:  string;
  checks:  GateCheckResult[];
}

// ── CLI config (stored in ~/.deployguard/config.json) ─────────────────────────

export interface CliConfig {
  apiUrl?:   string;
  apiToken?: string;
}

// ── Gate options ──────────────────────────────────────────────────────────────

export interface GateOptions {
  minScore: number;
  blockOn:  string[];
}
