export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export type ScanStatus = "pending" | "running" | "completed" | "failed";

export type IntegrationType = "github" | "gitlab" | "bitbucket" | "jira" | "slack" | "pagerduty";

export interface ScanTarget {
  id: string;
  name: string;
  repoUrl?: string;
  branch?: string;
  commitSha?: string;
  environment: "production" | "staging" | "development";
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: FindingCategory;
  filePath?: string;
  lineNumber?: number;
  snippet?: string;
  remediation?: string;
  references?: string[];
  falsePositive?: boolean;
}

export type FindingCategory =
  | "security"
  | "performance"
  | "reliability"
  | "dependency"
  | "configuration"
  | "secrets"
  | "compliance";

export interface ScanResult {
  id: string;
  targetId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  score: DeployScore;
  findings: Finding[];
  summary: ScanSummary;
}

export interface DeployScore {
  overall: number;
  security: number;
  performance: number;
  reliability: number;
  compliance: number;
  recommendation: "deploy" | "review" | "block";
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  passed: number;
  failed: number;
}

export interface Report {
  id: string;
  scanId: string;
  format: "html" | "pdf" | "json" | "markdown";
  createdAt: string;
  url?: string;
}

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "developer" | "viewer";
  createdAt: string;
}

/** Machine-readable finding produced by the DAST probe engine (lib/dynamic-testing). */
export interface DynamicFinding {
  id:          string;
  probeId:     string;
  name:        string;
  severity:    SeverityLevel;
  description: string;
  remediation: string;
  evidence?:   string;
}

/**
 * Display-level record used by the dynamic test results UI.
 * Carries HTTP-level context (endpoint, payload, response time) that is
 * meaningful on the results page but not part of the probe engine's output.
 */
export interface DynamicTestEntry {
  id:           string;
  endpoint:     string;
  testType:     string;
  vulnerable:   boolean;
  severity:     SeverityLevel;
  details:      string;
  payload:      string;
  responseTime: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  repoUrl?: string;
  defaultBranch: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
