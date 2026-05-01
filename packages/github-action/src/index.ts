/**
 * DeployGuard GitHub Action — Entry Point
 *
 * Execution flow:
 *  1. Read inputs from the GitHub Actions environment
 *  2. Collect file paths under scan-path
 *  3. POST to /api/scan/analyze and receive ScanResult
 *  4. Evaluate gate (min-score, block-on severities)
 *  5. Post / update a PR comment
 *  6. Upload SARIF to GitHub Code Scanning
 *  7. Write step outputs and set exit code
 */

import * as core     from "@actions/core";
import * as github   from "@actions/github";
import * as glob     from "@actions/glob";
import * as fs       from "node:fs";
import * as path     from "node:path";
import { evaluateGate, formatGateLog } from "./gate";
import { postPRComment }               from "./comment";
import { buildSarif }                  from "./sarif";
import type { ScanResult, CIReport }   from "./types";

// ── API client ────────────────────────────────────────────────────────────────

async function callApi<T>(
  url:   string,
  token: string,
  body:  unknown,
): Promise<T> {
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error; } catch { /* keep status */ }
    throw new Error(`DeployGuard API error: ${msg}`);
  }

  const json = await res.json() as { data?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  try {
    // ── 1. Inputs ─────────────────────────────────────────────────────────────

    const apiUrl        = core.getInput("api-url",         { required: true });
    const apiToken      = core.getInput("api-token",       { required: true });
    const scanPath      = core.getInput("scan-path")      || ".";
    const minScore      = parseInt(core.getInput("min-score") || "60", 10);
    const blockOn       = (core.getInput("block-on") || "critical").split(",").map(s => s.trim());
    const postComment   = core.getInput("post-pr-comment") !== "false";
    const uploadSarif   = core.getInput("upload-sarif")    !== "false";
    const environment   = core.getInput("environment")    || "staging";
    const configFile    = core.getInput("config-file");
    const projectId     = core.getInput("project-id");

    core.info(`DeployGuard: scanning "${scanPath}" (env=${environment}, min-score=${minScore}, block-on=${blockOn.join(",")})`);

    // ── 2. Collect files ──────────────────────────────────────────────────────

    const patterns = [
      `${scanPath}/**/*.ts`,  `${scanPath}/**/*.tsx`,
      `${scanPath}/**/*.js`,  `${scanPath}/**/*.jsx`,
      `${scanPath}/**/*.mjs`, `${scanPath}/**/*.cjs`,
      `${scanPath}/**/*.py`,  `${scanPath}/**/*.go`,
      `${scanPath}/**/*.rb`,  `${scanPath}/**/*.java`,
      `${scanPath}/**/*.html`,`${scanPath}/**/*.htm`,
      `${scanPath}/**/package.json`,
      `${scanPath}/**/Dockerfile`,
    ].join("\n");

    const ignore = "!**/node_modules/**\n!**/.next/**\n!**/dist/**\n!**/build/**\n!**/.git/**";
    const globber   = await glob.create(`${patterns}\n${ignore}`);
    const filePaths = await globber.glob();

    core.info(`Found ${filePaths.length} files to scan.`);

    if (filePaths.length === 0) {
      core.warning("No scannable files found. Check your scan-path input.");
      core.setOutput("gate-result", "pass");
      core.setOutput("score", "100");
      return;
    }

    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const files = filePaths
      .map(p => {
        try {
          return {
            path:    path.relative(workspace, p),
            content: fs.readFileSync(p, "utf8"),
          };
        } catch { return null; }
      })
      .filter((f): f is { path: string; content: string } => f !== null);

    // ── 3. Call DeployGuard API ───────────────────────────────────────────────

    core.info(`Sending ${files.length} files to DeployGuard API…`);

    const response = await callApi<{ scan: ScanResult; dbScanId?: string }>(
      `${apiUrl}/api/scan/analyze`,
      apiToken,
      {
        files,
        projectId:     projectId || undefined,
        triggerSource: "GITHUB_ACTIONS",
        commitSha:     process.env.GITHUB_SHA,
        branch:        process.env.GITHUB_REF_NAME,
        environment:   environment.toUpperCase(),
      },
    );

    const { scan, dbScanId } = response;
    core.info(`Scan complete — score: ${scan.score.overall}/100, findings: ${scan.findings.length}`);

    // ── 4. Evaluate gate ──────────────────────────────────────────────────────

    const gate = evaluateGate(scan, { minScore, blockOn });
    core.info(formatGateLog(gate));

    // ── 5. Set outputs ────────────────────────────────────────────────────────

    core.setOutput("scan-id",        dbScanId ?? scan.id);
    core.setOutput("score",          String(scan.score.overall));
    core.setOutput("recommendation", scan.score.recommendation);
    core.setOutput("gate-result",    gate.passed ? "pass" : "fail");
    core.setOutput("finding-count",  String(scan.findings.length));

    // ── 6. Write CI report artifact ───────────────────────────────────────────

    const report: CIReport = {
      schemaVersion: "1.0",
      generatedAt:   new Date().toISOString(),
      repository:    process.env.GITHUB_REPOSITORY ?? "",
      commit:        process.env.GITHUB_SHA ?? "",
      ref:           process.env.GITHUB_REF ?? "",
      scanPath,
      environment,
      score:    scan.score,
      summary:  scan.summary,
      findings: scan.findings,
      gate:     { minScore, blockOn },
    };

    const reportPath = path.join(process.env.RUNNER_TEMP ?? "/tmp", "deployguard-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    core.setOutput("report-path", reportPath);
    core.info(`Report written to ${reportPath}`);

    // ── 7. Post PR comment ────────────────────────────────────────────────────

    const ctx     = github.context;
    const isPr    = !!ctx.payload.pull_request;
    const ghToken = process.env.GITHUB_TOKEN ?? core.getInput("github-token");

    if (postComment && isPr && ghToken) {
      core.info("Posting PR comment…");
      const octokit = github.getOctokit(ghToken);
      await postPRComment(octokit as Parameters<typeof postPRComment>[0], ctx, scan, gate);
      core.info("PR comment posted.");
    } else if (postComment && !isPr) {
      core.info("Skipping PR comment — not a pull request.");
    }

    // ── 8. Upload SARIF ───────────────────────────────────────────────────────

    if (uploadSarif && ghToken) {
      core.info("Uploading SARIF to GitHub Code Scanning…");
      const sarifData    = buildSarif(scan);
      const sarifJson    = JSON.stringify(sarifData);
      const sarifB64     = Buffer.from(sarifJson).toString("base64");
      const sarifPath    = path.join(process.env.RUNNER_TEMP ?? "/tmp", "deployguard.sarif");
      fs.writeFileSync(sarifPath, sarifJson);

      const octokit = github.getOctokit(ghToken);
      const { owner, repo } = ctx.repo;
      const commitSha = process.env.GITHUB_SHA ?? ctx.sha;
      const ref       = process.env.GITHUB_REF ?? ctx.ref;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (octokit as any).rest.codeScanning.uploadSarif({
          owner,
          repo,
          commit_sha: commitSha,
          ref,
          sarif:      sarifB64,
          tool_name:  "DeployGuard",
        });
        core.setOutput("sarif-id", sarifPath);
        core.info("SARIF uploaded.");
      } catch (err) {
        // SARIF upload failure is non-fatal — warn but don't block the gate
        core.warning(`SARIF upload failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── 9. Apply gate ─────────────────────────────────────────────────────────

    if (!gate.passed) {
      core.setFailed(`DeployGuard gate failed: ${gate.reason}`);
    } else {
      core.info(`✓ DeployGuard gate passed: ${gate.reason}`);
    }

  } catch (err) {
    core.setFailed(`DeployGuard action failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

run();
