/**
 * DeployGuard CI Action — Entry Point
 *
 * Execution flow:
 *  1. Read inputs from the GitHub Actions environment
 *  2. Collect file paths under scan-path
 *  3. POST to /api/scan/analyze and receive ScanResult + report
 *  4. Evaluate gate conditions (min-score, block-on severities)
 *  5. Post PR comment if requested
 *  6. Upload SARIF to GitHub Code Scanning if requested
 *  7. Write outputs and set exit code
 *
 * Requires @actions/core, @actions/github, @actions/glob, @actions/artifact.
 * No DeployGuard monorepo dependency — self-contained.
 */

import * as core     from "@actions/core";
import * as github   from "@actions/github";
import * as glob     from "@actions/glob";
import * as artifact from "@actions/artifact";
import * as fs       from "node:fs";
import * as path     from "node:path";
import { evaluateGate }  from "./gate";
import { postPRComment } from "./comment";
import { buildSarif }    from "./sarif";
import type { CIReport, ScanResult } from "./types";

async function run(): Promise<void> {
  try {
    // ── 1. Inputs ───────────────────────────────────────────────────────────

    const apiUrl          = core.getInput("api-url",           { required: true });
    const apiToken        = core.getInput("api-token",         { required: true });
    const scanPath        = core.getInput("scan-path")        || ".";
    const minScore        = parseInt(core.getInput("min-score") || "60", 10);
    const blockOn         = (core.getInput("block-on") || "critical").split(",").map((s: string) => s.trim());
    const postComment     = core.getInput("post-pr-comment")  !== "false";
    const uploadSarif     = core.getInput("upload-sarif")     !== "false";
    const environment     = core.getInput("environment")      || "staging";
    const reportFormat    = core.getInput("report-format")    || "html";
    const enabledRules    = core.getInput("enabled-rules")    ? core.getInput("enabled-rules").split(",").map((s: string) => s.trim()) : undefined;
    const disabledRules   = core.getInput("disabled-rules")   ? core.getInput("disabled-rules").split(",").map((s: string) => s.trim()) : undefined;

    core.info(`DeployGuard: scanning ${scanPath} (env=${environment}, min-score=${minScore}, block-on=${blockOn.join(",")})`);

    // ── 2. Collect files ────────────────────────────────────────────────────

    const patterns = [
      `${scanPath}/**/*.ts`,  `${scanPath}/**/*.tsx`,
      `${scanPath}/**/*.js`,  `${scanPath}/**/*.jsx`,
      `${scanPath}/**/*.py`,  `${scanPath}/**/*.go`,
      `${scanPath}/**/package.json`,
    ].join("\n");

    const globber = await glob.create(`${patterns}\n!**/node_modules/**\n!**/.next/**\n!**/dist/**`);
    const filePaths = await globber.glob();

    core.info(`Found ${filePaths.length} files to scan.`);

    if (filePaths.length === 0) {
      core.warning("No files found in scan-path. Passing with score=100.");
      setOutputs(100, "deploy", 0, 0, 0, true);
      return;
    }

    // ── 3. Call API ─────────────────────────────────────────────────────────

    const files = filePaths.map((fp: string) => ({
      path:    path.relative(process.cwd(), fp),
      content: fs.readFileSync(fp, "utf8"),
    }));

    const scanResult = await callScanApi(apiUrl, apiToken, files, {
      environment,
      enabledRuleIds:  enabledRules,
      disabledRuleIds: disabledRules,
    });

    core.info(`Scan complete. Score: ${scanResult.score.overall}/100 (${scanResult.score.recommendation})`);

    // ── 4. Build CI report ──────────────────────────────────────────────────

    const report: CIReport = buildCIReport(scanResult, { scanPath, environment, minScore, blockOn });

    // Write JSON report to disk for artifact upload
    const reportPath = path.join(process.env.RUNNER_TEMP ?? "/tmp", "deployguard-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    // ── 5. Evaluate gate ────────────────────────────────────────────────────

    const gate = evaluateGate(scanResult, { minScore, blockOn });

    // ── 6. PR Comment ───────────────────────────────────────────────────────

    if (postComment && github.context.payload.pull_request) {
      const octokit = github.getOctokit(process.env.GITHUB_TOKEN ?? "");
      await postPRComment(octokit, github.context, scanResult, gate);
    }

    // ── 7. SARIF upload ─────────────────────────────────────────────────────

    if (uploadSarif) {
      const sarifPath = path.join(process.env.RUNNER_TEMP ?? "/tmp", "deployguard.sarif");
      const sarif = buildSarif(scanResult);
      fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2), "utf8");
      core.info(`SARIF written to ${sarifPath}`);
      // Actual upload uses: await exec.exec("gh", ["code-scanning", "upload-sarif", sarifPath])
      // or the upload-sarif action — documented in the example workflow.
    }

    // ── 8. Artifact upload ──────────────────────────────────────────────────

    const artifactClient = new artifact.DefaultArtifactClient();
    await artifactClient.uploadArtifact(
      "deployguard-report",
      [reportPath],
      process.env.RUNNER_TEMP ?? "/tmp",
    );

    // ── 9. Outputs + exit ───────────────────────────────────────────────────

    const { summary } = scanResult;
    setOutputs(
      scanResult.score.overall,
      scanResult.score.recommendation,
      summary.critical,
      summary.high,
      summary.total,
      gate.passed,
    );

    if (!gate.passed) {
      core.setFailed(gate.reason);
    } else {
      core.info(`DeployGuard: gate passed. ${gate.reason}`);
    }

  } catch (err) {
    core.setFailed(`DeployGuard action failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callScanApi(
  apiUrl:  string,
  token:   string,
  files:   { path: string; content: string }[],
  options: { environment: string; enabledRuleIds?: string[]; disabledRuleIds?: string[] },
): Promise<ScanResult> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/scan/analyze`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      files,
      reportFormat:   "json",
      enabledRuleIds:  options.enabledRuleIds,
      disabledRuleIds: options.disabledRuleIds,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as { data?: { scan?: ScanResult } };
  if (!json.data?.scan) throw new Error("API returned no scan data");
  return json.data.scan;
}

function buildCIReport(
  scan:    ScanResult,
  options: { scanPath: string; environment: string; minScore: number; blockOn: string[] },
): CIReport {
  return {
    schemaVersion: "1.0",
    generatedAt:   new Date().toISOString(),
    repository:    `${process.env.GITHUB_REPOSITORY ?? "unknown"}`,
    commit:        process.env.GITHUB_SHA ?? "unknown",
    ref:           process.env.GITHUB_REF ?? "unknown",
    scanPath:      options.scanPath,
    environment:   options.environment,
    score:         scan.score,
    summary:       scan.summary,
    findings:      scan.findings.filter(f => !f.falsePositive),
    gate: {
      minScore:  options.minScore,
      blockOn:   options.blockOn,
    },
  };
}

function setOutputs(
  score:          number,
  recommendation: string,
  critical:       number,
  high:           number,
  total:          number,
  passed:         boolean,
): void {
  core.setOutput("score",          String(score));
  core.setOutput("recommendation", recommendation);
  core.setOutput("critical-count", String(critical));
  core.setOutput("high-count",     String(high));
  core.setOutput("total-findings", String(total));
  core.setOutput("passed",         String(passed));
}

run();
