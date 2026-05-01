/**
 * deployguard dynamic <url>
 *
 * Runs the DAST probe suite against a target URL, evaluates the gate,
 * and exits 1 if the gate fails.
 */

import { Command } from "commander";
import ora from "ora";
import { resolveApiCredentials } from "../lib/config";
import { apiDynamic }            from "../lib/api";
import { evaluateDynamicGate }   from "../lib/gate";
import {
  printHeader, printScoreBanner, printDynamicEntries,
  printGate, printJson, printError,
} from "../lib/output";

export function makeDynamicCommand(): Command {
  return new Command("dynamic")
    .description("Run dynamic (DAST) security probes against a URL")
    .argument("<url>", "Target URL to test (must be a staging or test environment)")
    .option("--api-url <url>",       "DeployGuard API base URL")
    .option("--api-token <token>",   "API token (or set DEPLOYGUARD_API_TOKEN)")
    .option("--authorized-by <name>","Name of person authorising the test", "CLI")
    .option("--timeout <ms>",        "Probe timeout in milliseconds (5000-60000)", "15000")
    .option("--auth-type <type>",    "Auth for probes: none | bearer | basic | cookie", "none")
    .option("--token <value>",       "Bearer token to include in probes")
    .option("--username <value>",    "Username for basic auth probes")
    .option("--password <value>",    "Password for basic auth probes")
    .option("--cookie <value>",      "Cookie header value for probe requests")
    .option("--min-score <n>",       "Minimum score threshold (0-100)", "60")
    .option("--block-on <sevs>",     "Comma-separated severity levels that block deploy", "critical")
    .option("--json",                "Output raw JSON instead of formatted text")
    .addHelpText("after", `
Examples:
  # Test the built-in sandbox (no credentials needed)
  deployguard dynamic https://deployguard.vercel.app/api/dynamic/sandbox

  # Test a real staging environment
  deployguard dynamic https://staging.myapp.com --authorized-by "Jane Smith"

  # Test with Bearer auth
  deployguard dynamic https://api.staging.myapp.com \\
    --auth-type bearer --token eyJhbGci...

  # Block on high AND critical, fail gate below 80
  deployguard dynamic https://staging.myapp.com \\
    --block-on critical,high --min-score 80
`)
    .action(async (targetUrl: string, opts) => {
      const { apiUrl, apiToken } = resolveApiCredentials(opts);
      const minScore    = parseInt(opts.minScore  ?? "60",    10);
      const timeoutMs   = parseInt(opts.timeout   ?? "15000", 10);
      const blockOn     = (opts.blockOn as string).split(",").map(s => s.trim());
      const asJson      = Boolean(opts.json);
      const authorizedBy = opts.authorizedBy as string;

      // Build optional credentials object
      const credentials =
        opts.authType && opts.authType !== "none"
          ? {
              token:    opts.token    as string | undefined,
              username: opts.username as string | undefined,
              password: opts.password as string | undefined,
              cookie:   opts.cookie   as string | undefined,
            }
          : undefined;

      const spinner = asJson ? null : ora(`Running ${11} probes against ${targetUrl}…`).start();

      let session;
      try {
        session = await apiDynamic(apiUrl, apiToken, {
          targetUrl,
          authorizedBy,
          acknowledgments: {
            hasAuthority:        true,
            isNotProduction:     true,
            understandsReadOnly: true,
          },
          authType:    opts.authType,
          credentials,
          timeoutMs,
        });
        const vuln = session.entries.filter(e => e.vulnerable).length;
        spinner?.succeed(`Done — ${session.entries.length} probes, ${vuln} issue${vuln !== 1 ? "s" : ""} found.`);
      } catch (err) {
        spinner?.fail("Dynamic test failed.");
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const vulnEntries = session.entries.filter(e => e.vulnerable);
      const score = session.entries.length > 0
        ? Math.round(((session.entries.length - vulnEntries.length) / session.entries.length) * 100)
        : 100;
      const recommendation = vulnEntries.some(e => e.severity === "critical")
        ? "block"
        : vulnEntries.length > 0 ? "review" : "deploy";

      const gate = evaluateDynamicGate(session, { minScore, blockOn });

      if (asJson) {
        printJson({ session, gate });
      } else {
        printHeader(`Dynamic Test Results — ${targetUrl}`);
        printScoreBanner(score, recommendation);
        printDynamicEntries(session.entries);
        printGate(gate);
      }

      process.exit(gate.passed ? 0 : 1);
    });
}
