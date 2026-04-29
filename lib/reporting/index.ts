import type { Finding, ScanResult } from "@/types";
import { scoreLabel } from "@/lib/scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportFormat = "json" | "markdown" | "html" | "csv";

export interface ReportOptions {
  format:              ReportFormat;
  includeSnippets?:    boolean;
  includeRemediation?: boolean;
  includePassed?:      boolean;
  title?:              string;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function generateReport(result: ScanResult, options: ReportOptions): string {
  switch (options.format) {
    case "json":     return generateJson(result, options);
    case "markdown": return generateMarkdown(result, options);
    case "html":     return generateHtml(result, options);
    case "csv":      return generateCsv(result, options);
  }
}

export function reportFilename(result: ScanResult, format: ReportFormat): string {
  const date = (result.completedAt ?? result.startedAt).slice(0, 10);
  return `deployguard-${result.id.slice(0, 8)}-${date}.${format === "markdown" ? "md" : format}`;
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

function generateJson(result: ScanResult, options: ReportOptions): string {
  const output = options.includePassed
    ? result
    : { ...result, findings: result.findings.filter(f => !f.falsePositive) };
  return JSON.stringify(output, null, 2);
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

function severityBadge(s: string): string {
  return `\`${s.toUpperCase()}\``;
}

function generateMarkdown(result: ScanResult, options: ReportOptions): string {
  const title = options.title ?? "DeployGuard Scan Report";
  const active = result.findings.filter(f => !f.falsePositive);
  const findings = options.includePassed ? result.findings : active;

  const lines: string[] = [
    `# ${title}`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Scan ID** | \`${result.id}\` |`,
    `| **Status** | ${result.status} |`,
    `| **Score** | ${result.score.overall}/100 — ${scoreLabel(result.score.overall)} |`,
    `| **Recommendation** | ${result.score.recommendation.toUpperCase()} |`,
    `| **Date** | ${result.completedAt ?? result.startedAt} |`,
    ``,
    `## Summary`,
    ``,
    `| Severity | Count |`,
    `|---|---|`,
    `| 🔴 Critical | ${result.summary.critical} |`,
    `| 🟠 High | ${result.summary.high} |`,
    `| 🟡 Medium | ${result.summary.medium} |`,
    `| 🔵 Low | ${result.summary.low} |`,
    `| ⚪ Info | ${result.summary.info} |`,
    `| ✅ Passed | ${result.summary.passed} |`,
    `| **Total** | **${result.summary.total}** |`,
    ``,
    `## Category Scores`,
    ``,
    `| Category | Score |`,
    `|---|---|`,
    `| Security | ${result.score.security}/100 |`,
    `| Reliability | ${result.score.reliability}/100 |`,
    `| Performance | ${result.score.performance}/100 |`,
    `| Compliance | ${result.score.compliance}/100 |`,
    ``,
    `## Findings (${findings.length})`,
    ``,
  ];

  for (const f of findings) {
    lines.push(`---`);
    lines.push(`### ${severityBadge(f.severity)} ${f.title}`);
    lines.push(`**Rule:** \`${f.ruleId}\` | **Category:** ${f.category}`);
    lines.push(``);
    lines.push(f.description);

    if (f.filePath) {
      lines.push(``);
      lines.push(`**Location:** \`${f.filePath}:${f.lineNumber ?? 0}\``);
    }

    if (options.includeSnippets && f.snippet) {
      lines.push(``);
      lines.push("```");
      lines.push(f.snippet);
      lines.push("```");
    }

    if (options.includeRemediation && f.remediation) {
      lines.push(``);
      lines.push(`**Remediation:** ${f.remediation}`);
    }

    if (f.references && f.references.length > 0) {
      lines.push(``);
      lines.push(`**References:** ${f.references.map(r => `[${r}](${r})`).join(", ")}`);
    }

    lines.push(``);
  }

  return lines.join("\n");
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#3b82f6",
  info:     "#6b7280",
};

const REC_COLOR: Record<string, string> = {
  block:  "#ef4444",
  review: "#eab308",
  deploy: "#22c55e",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function findingCard(f: Finding, options: ReportOptions): string {
  const color = SEVERITY_COLOR[f.severity] ?? "#6b7280";
  return `
  <div style="border:1px solid #333;border-radius:8px;padding:16px 20px;margin-bottom:12px;background:#111">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="background:${color}22;color:${color};border:1px solid ${color}55;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;text-transform:uppercase">${esc(f.severity)}</span>
      <span style="font-weight:600;color:#e5e7eb">${esc(f.title)}</span>
      <span style="margin-left:auto;font-size:11px;color:#6b7280">${esc(f.ruleId)}</span>
    </div>
    <p style="color:#9ca3af;margin:0 0 8px;font-size:13px">${esc(f.description)}</p>
    ${f.filePath ? `<code style="font-size:11px;color:#60a5fa">${esc(f.filePath)}:${f.lineNumber ?? 0}</code>` : ""}
    ${options.includeSnippets && f.snippet ? `<pre style="background:#0a0a0a;border:1px solid #333;border-radius:4px;padding:10px;margin-top:10px;font-size:12px;overflow:auto;color:#d1fae5">${esc(f.snippet)}</pre>` : ""}
    ${options.includeRemediation && f.remediation ? `<p style="color:#86efac;font-size:12px;margin-top:10px;border-left:3px solid #22c55e;padding-left:10px">${esc(f.remediation)}</p>` : ""}
  </div>`;
}

function generateHtml(result: ScanResult, options: ReportOptions): string {
  const title = esc(options.title ?? "DeployGuard Scan Report");
  const active = result.findings.filter(f => !f.falsePositive);
  const findings = options.includePassed ? result.findings : active;
  const recColor = REC_COLOR[result.score.recommendation] ?? "#6b7280";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0a0a0f; color: #e5e7eb; line-height: 1.6; padding: 32px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 24px; }
    h2 { font-size: 16px; font-weight: 600; color: #d1d5db; margin: 24px 0 12px; border-bottom: 1px solid #1f2937; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #1f2937; }
    th { color: #6b7280; font-weight: 500; }
    code { font-family: "SF Mono", Monaco, monospace; background: #1f2937; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>

  <table>
    <tr><th>Scan ID</th><td><code>${esc(result.id)}</code></td></tr>
    <tr><th>Date</th><td>${esc(result.completedAt ?? result.startedAt)}</td></tr>
    <tr><th>Score</th><td><strong style="font-size:20px">${result.score.overall}</strong>/100 — ${esc(scoreLabel(result.score.overall))}</td></tr>
    <tr><th>Recommendation</th><td><span style="color:${recColor};font-weight:700;text-transform:uppercase">${esc(result.score.recommendation)}</span></td></tr>
  </table>

  <h2>Summary</h2>
  <table>
    <tr><th>Severity</th><th>Count</th></tr>
    <tr><td style="color:${SEVERITY_COLOR.critical}">Critical</td><td>${result.summary.critical}</td></tr>
    <tr><td style="color:${SEVERITY_COLOR.high}">High</td><td>${result.summary.high}</td></tr>
    <tr><td style="color:${SEVERITY_COLOR.medium}">Medium</td><td>${result.summary.medium}</td></tr>
    <tr><td style="color:${SEVERITY_COLOR.low}">Low</td><td>${result.summary.low}</td></tr>
    <tr><td style="color:${SEVERITY_COLOR.info}">Info</td><td>${result.summary.info}</td></tr>
    <tr><td style="color:#22c55e">Passed</td><td>${result.summary.passed}</td></tr>
  </table>

  <h2>Findings (${findings.length})</h2>
  ${findings.map(f => findingCard(f, options)).join("")}
</body>
</html>`;
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvEscape(val: string | number | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function generateCsv(result: ScanResult, options: ReportOptions): string {
  const findings = options.includePassed ? result.findings : result.findings.filter(f => !f.falsePositive);
  const cols = ["id", "ruleId", "severity", "category", "title", "filePath", "lineNumber", "falsePositive", "remediation"];
  const header = cols.join(",");
  const rows = findings.map(f =>
    cols.map(col => csvEscape((f as unknown as Record<string, unknown>)[col] as string | number)).join(",")
  );
  return [header, ...rows].join("\n");
}
