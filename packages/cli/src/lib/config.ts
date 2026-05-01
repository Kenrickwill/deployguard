/**
 * Reads and writes the per-user CLI config stored in ~/.deployguard/config.json
 *
 * Priority (highest first):
 *   1. CLI flags (--api-url, --api-token)
 *   2. Environment variables (DEPLOYGUARD_API_URL, DEPLOYGUARD_API_TOKEN)
 *   3. ~/.deployguard/config.json
 *   4. Built-in defaults
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CliConfig } from "../types";

const CONFIG_DIR  = join(homedir(), ".deployguard");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_API_URL = "https://deployguard-kenrickwills-projects.vercel.app";

export function readConfig(): CliConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as CliConfig;
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

export function writeConfig(patch: Partial<CliConfig>): void {
  const current = readConfig();
  const updated  = { ...current, ...patch };
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2) + "\n", "utf8");
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) writeFileSync(CONFIG_FILE, "{}\n", "utf8");
}

/** Resolve the effective API URL and token, merging all sources. */
export function resolveApiCredentials(opts: { apiUrl?: string; apiToken?: string }): {
  apiUrl:   string;
  apiToken: string | undefined;
} {
  const file = readConfig();
  return {
    apiUrl:   opts.apiUrl ?? process.env.DEPLOYGUARD_API_URL ?? file.apiUrl ?? DEFAULT_API_URL,
    apiToken: opts.apiToken ?? process.env.DEPLOYGUARD_API_TOKEN ?? file.apiToken,
  };
}
