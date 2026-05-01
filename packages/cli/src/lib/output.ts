/**
 * Terminal output helpers — colour-coded, human-readable.
 * All output goes to stdout; errors go to stderr.
 */

import chalk from "chalk";
import type { ScanResult, DynamicSession, GateResult, Finding, DynamicEntry } from "../types";

// ── Severity colours ──────────────────────────────────────────────────────────

function sevColour(sev: string): chalk.Chalk {
  switch (sev.toLowerCase()) {
    case "critical": return chalk.red.bold;
    case "high":     return chalk.redBright;
    case "medium":   return chalk.yellow;
    case "low":      return chalk.cyan;
    default:         return chalk.gray;
  }
}

function sevBadge(sev: string): string {
  return sevColour(sev)(` ${sev.toUpperCase()} `);
}

// ── Score / recommendation banner ─────────────────────────────────────────────

export function printScoreBanner(score: number, recommendation: string): void {
  const rec = recommendation.toUpperCase();
  const colour =
    rec === "BLOCK"  ? chalk.red.bold    :
    rec === "REVIEW" ? chalk.yellow.bold :
    chalk.green.bold;

  console.log();
  console.log(chalk.bold("  Score  ") + chalk.bold.white(String(score).padStart(3)) + chalk.dim(" / 100"));
  console.log(chalk.bold("  Status ") + colour(rec));
  console.log();
}

// ── Scan findings table ───────────────────────────────────────────────────────

export function printFindings(findings: Finding[]): void {
  if (findings.length === 0) {
    console.log(chalk.green("  ✓ No findings."));
    console.log();
    return;
  }

  const sorted = [...findings].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
  });

  console.log(chalk.bold(`  Findings (${findings.length})`));
  console.log(chalk.dim("  " + "─".repeat(72)));

  for (const f of sorted) {
    const loc = f.filePath
      ? chalk.dim(` ${f.filePath}${f.lineNumber ? `:${f.lineNumber}` : ""}`)
      : "";
    console.log(`  ${sevBadge(f.severity)} ${chalk.white(f.title)}${loc}`);
    console.log(`  ${chalk.dim(f.ruleId.padEnd(12))} ${chalk.gray(f.description)}`);
    if (f.remediation) {
      console.log(`  ${chalk.dim("→")} ${chalk.cyan(f.remediation)}`);
    }
    console.log();
  }
}

// ── Dynamic test probe table ──────────────────────────────────────────────────

export function printDynamicEntries(entries: DynamicEntry[]): void {
  const passed = entries.filter(e => !e.vulnerable);
  const failed = entries.filter(e => e.vulnerable);

  console.log(chalk.bold(`  Probes (${entries.length} total — ${chalk.green(String(passed.length) + " passed")}, ${chalk.red(String(failed.length) + " failed")})`));
  console.log(chalk.dim("  " + "─".repeat(72)));

  for (const e of entries) {
    const icon = e.vulnerable ? chalk.red("✗") : chalk.green("✓");
    const sev  = e.vulnerable ? ` ${sevBadge(e.severity)}` : chalk.dim(" PASS       ");
    console.log(`  ${icon}${sev} ${chalk.white(e.testType)}`);
    if (e.vulnerable) {
      console.log(`    ${chalk.gray(e.details)}`);
      if (e.remediation) console.log(`    ${chalk.dim("→")} ${chalk.cyan(e.remediation)}`);
      console.log();
    }
  }
  console.log();
}

// ── Gate result summary ───────────────────────────────────────────────────────

export function printGate(gate: GateResult): void {
  const icon   = gate.passed ? chalk.green("✓") : chalk.red("✗");
  const label  = gate.passed ? chalk.green.bold("GATE PASSED") : chalk.red.bold("GATE FAILED");

  console.log(chalk.bold("  Gate checks"));
  console.log(chalk.dim("  " + "─".repeat(72)));

  for (const c of gate.checks) {
    const ci = c.passed ? chalk.green("✓") : chalk.red("✗");
    console.log(`  ${ci} ${chalk.white(c.name)}`);
    console.log(`    ${chalk.gray(c.detail)}`);
  }

  console.log();
  console.log(`  ${icon} ${label}: ${chalk.dim(gate.reason)}`);
  console.log();
}

// ── Section header ────────────────────────────────────────────────────────────

export function printHeader(text: string): void {
  console.log();
  console.log(chalk.bold.blue("  ▶ " + text));
  console.log();
}

// ── JSON output (for CI piping) ───────────────────────────────────────────────

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ── Error ─────────────────────────────────────────────────────────────────────

export function printError(msg: string): void {
  console.error(chalk.red.bold("  Error: ") + chalk.white(msg));
}
