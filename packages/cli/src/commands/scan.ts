/**
 * deployguard scan <path>
 *
 * Scans one file or an entire directory tree, posts the result to the
 * DeployGuard API, runs the gate, and exits 1 if the gate fails.
 */

import { Command } from "commander";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";
import ora from "ora";
import { resolveApiCredentials } from "../lib/config";
import { apiScan }               from "../lib/api";
import { evaluateScanGate }      from "../lib/gate";
import {
  printHeader, printScoreBanner, printFindings,
  printGate, printJson, printError,
} from "../lib/output";

// ── Supported file extensions ─────────────────────────────────────────────────

const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rb", ".java", ".php",
  ".json", ".html", ".htm",
  "Dockerfile",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".cache"]);

function collectFiles(target: string): Array<{ path: string; content: string }> {
  const abs  = resolve(target);
  const stat = statSync(abs);

  if (stat.isFile()) {
    return [{ path: abs, content: readFileSync(abs, "utf8") }];
  }

  const results: Array<{ path: string; content: string }> = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = entry.name === "Dockerfile" ? "Dockerfile" : extname(entry.name);
        if (SCAN_EXTS.has(ext)) {
          try {
            results.push({ path: full, content: readFileSync(full, "utf8") });
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  walk(abs);
  return results;
}

// ── Command ───────────────────────────────────────────────────────────────────

export function makeScanCommand(): Command {
  return new Command("scan")
    .description("Scan a file or directory for security issues")
    .argument("<path>", "File or directory to scan")
    .option("--api-url <url>",    "DeployGuard API base URL")
    .option("--api-token <token>","API token (or set DEPLOYGUARD_API_TOKEN)")
    .option("--project-id <id>",  "Project ID to persist results against")
    .option("--branch <name>",    "Branch name (for CI metadata)")
    .option("--commit <sha>",     "Commit SHA (for CI metadata)")
    .option("--min-score <n>",    "Minimum score threshold (0-100)", "60")
    .option("--block-on <sevs>",  "Comma-separated severity levels that block deploy", "critical")
    .option("--json",             "Output raw JSON instead of formatted text")
    .action(async (targetPath: string, opts) => {
      const { apiUrl, apiToken } = resolveApiCredentials(opts);
      const minScore = parseInt(opts.minScore ?? "60", 10);
      const blockOn  = (opts.blockOn as string).split(",").map(s => s.trim());
      const asJson   = Boolean(opts.json);

      // ── Collect files ───────────────────────────────────────────────────────
      let files: Array<{ path: string; content: string }>;
      try {
        files = collectFiles(targetPath);
      } catch (err) {
        printError(`Cannot read path: ${targetPath}`);
        process.exit(1);
      }

      if (files.length === 0) {
        printError("No scannable files found at the given path.");
        process.exit(1);
      }

      // Relativise paths so the API display is clean
      const cwd = process.cwd();
      const payload = files.map(f => ({
        path:    relative(cwd, f.path),
        content: f.content,
      }));

      // ── Call API ────────────────────────────────────────────────────────────
      const spinner = asJson ? null : ora(`Scanning ${payload.length} file${payload.length !== 1 ? "s" : ""}…`).start();

      let result;
      try {
        result = await apiScan(apiUrl, apiToken, {
          files:         payload,
          projectId:     opts.projectId,
          triggerSource: process.env.CI ? "CLI" : "MANUAL",
          branch:        opts.branch  ?? process.env.GITHUB_REF_NAME,
          commitSha:     opts.commit  ?? process.env.GITHUB_SHA,
        });
        spinner?.succeed(`Scan complete — ${result.scan.findings.length} finding${result.scan.findings.length !== 1 ? "s" : ""}.`);
      } catch (err) {
        spinner?.fail("Scan failed.");
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const { scan } = result;
      const gate = evaluateScanGate(scan, { minScore, blockOn });

      // ── Output ──────────────────────────────────────────────────────────────
      if (asJson) {
        printJson({ scan, gate, dbScanId: result.dbScanId });
      } else {
        printHeader("Scan Results");
        printScoreBanner(scan.score.overall, scan.score.recommendation);
        printFindings(scan.findings);
        printGate(gate);

        if (result.dbScanId) {
          console.log(`  Scan persisted → ID: ${result.dbScanId}`);
          console.log(`  View at: ${apiUrl}/scans/${result.dbScanId}`);
          console.log();
        }
      }

      process.exit(gate.passed ? 0 : 1);
    });
}
