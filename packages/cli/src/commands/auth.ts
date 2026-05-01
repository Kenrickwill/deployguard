/**
 * deployguard auth <subcommand>
 *
 * Subcommands:
 *   login    — Save an existing API token to ~/.deployguard/config.json
 *   logout   — Clear stored credentials
 *   status   — Show current credentials
 *   token    — Create a new API token via the API
 */

import { Command } from "commander";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import ora from "ora";
import { resolveApiCredentials, readConfig, writeConfig, clearConfig } from "../lib/config";
import { apiCreateToken } from "../lib/api";
import { printError } from "../lib/output";

// ── Helper: prompt for input without echoing ──────────────────────────────────

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  if (hidden) {
    // Turn off echo for password-style input
    const term = stdout as NodeJS.WriteStream & { isTTY?: boolean };
    if (term.isTTY) process.stdout.write("\x1b[?8l");
    const answer = await rl.question(question);
    if (term.isTTY) process.stdout.write("\x1b[?8h\n");
    rl.close();
    return answer.trim();
  }

  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

// ── auth login ────────────────────────────────────────────────────────────────

function makeLoginCommand(): Command {
  return new Command("login")
    .description("Save an API token to ~/.deployguard/config.json")
    .option("--api-url <url>",    "DeployGuard API base URL to save")
    .option("--api-token <token>","Token to save (skips interactive prompt)")
    .action(async (opts) => {
      const apiUrl = opts.apiUrl as string | undefined;

      let token = opts.apiToken as string | undefined;
      if (!token) {
        token = await prompt(chalk.bold("Paste your DeployGuard API token: "), true);
      }

      if (!token || !/^dg_(live|test)_[0-9a-f]{32}$/.test(token)) {
        printError("That doesn't look like a valid DeployGuard token (expected dg_live_... or dg_test_...).");
        process.exit(1);
      }

      writeConfig({ apiToken: token, ...(apiUrl ? { apiUrl } : {}) });
      console.log(chalk.green("  ✓ Token saved to ~/.deployguard/config.json"));
      console.log(chalk.dim(`    Prefix: ${token.slice(0, 10)}…`));
    });
}

// ── auth logout ───────────────────────────────────────────────────────────────

function makeLogoutCommand(): Command {
  return new Command("logout")
    .description("Remove stored credentials")
    .action(() => {
      clearConfig();
      console.log(chalk.green("  ✓ Credentials cleared."));
    });
}

// ── auth status ───────────────────────────────────────────────────────────────

function makeStatusCommand(): Command {
  return new Command("status")
    .description("Show currently configured credentials")
    .action(() => {
      const cfg = readConfig();
      console.log();
      console.log(chalk.bold("  DeployGuard CLI — Auth Status"));
      console.log();

      const apiUrl = cfg.apiUrl ?? process.env.DEPLOYGUARD_API_URL ?? chalk.dim("(default)");
      console.log(`  API URL:   ${chalk.cyan(apiUrl)}`);

      if (cfg.apiToken) {
        console.log(`  Token:     ${chalk.green(cfg.apiToken.slice(0, 12))}${chalk.dim("…")} (from config file)`);
      } else if (process.env.DEPLOYGUARD_API_TOKEN) {
        console.log(`  Token:     ${chalk.green(process.env.DEPLOYGUARD_API_TOKEN.slice(0, 12))}${chalk.dim("…")} (from env)`);
      } else {
        console.log(`  Token:     ${chalk.red("not set")} — run ${chalk.bold("deployguard auth login")}`);
      }
      console.log();
    });
}

// ── auth token create ─────────────────────────────────────────────────────────

function makeTokenCommand(): Command {
  const tokenCmd = new Command("token").description("Manage API tokens");

  tokenCmd
    .command("create")
    .description("Create a new API token")
    .option("--api-url <url>",   "DeployGuard API base URL")
    .option("--name <name>",     "Token name (e.g. 'GitHub Actions')", "CLI token")
    .option("--env <env>",       "Token environment: live | test", "live")
    .option("--save",            "Save the new token to ~/.deployguard/config.json")
    .action(async (opts) => {
      const { apiUrl } = resolveApiCredentials(opts);
      const name  = opts.name as string;
      const env   = (opts.env as "live" | "test") ?? "live";

      const spinner = ora(`Creating ${env} token "${name}"…`).start();
      let result;
      try {
        result = await apiCreateToken(apiUrl, name, env);
        spinner.succeed("Token created.");
      } catch (err) {
        spinner.fail("Failed to create token.");
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      console.log();
      console.log(chalk.bold("  New API Token"));
      console.log();
      console.log(`  ${chalk.dim("Token:")} ${chalk.green.bold(result.rawKey)}`);
      console.log(`  ${chalk.dim("ID:   ")} ${result.id}`);
      console.log();
      console.log(chalk.yellow("  ⚠  Copy this token now — it will not be shown again."));
      console.log();

      if (opts.save) {
        writeConfig({ apiToken: result.rawKey });
        console.log(chalk.green("  ✓ Token saved to ~/.deployguard/config.json"));
        console.log();
      } else {
        console.log(chalk.dim(`  To save it: deployguard auth login --api-token ${result.rawKey}`));
        console.log();
      }
    });

  return tokenCmd;
}

// ── Top-level auth command ────────────────────────────────────────────────────

export function makeAuthCommand(): Command {
  const auth = new Command("auth").description("Manage authentication credentials");
  auth.addCommand(makeLoginCommand());
  auth.addCommand(makeLogoutCommand());
  auth.addCommand(makeStatusCommand());
  auth.addCommand(makeTokenCommand());
  return auth;
}
