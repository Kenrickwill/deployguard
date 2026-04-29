/**
 * scan-session.ts
 *
 * Lightweight sessionStorage bridge for scan results.
 * Keeps real scan data available across the redirect from /scans/new → /scans/[id]
 * without requiring a database. Replace with DB calls when Prisma is wired up.
 */

import type { ScanResult } from "@/types";

const PREFIX = "dg_scan_";

// ── Write ─────────────────────────────────────────────────────────────────────

/** Persist a ScanResult so the results page can read it by ID. */
export function saveScan(result: ScanResult): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${PREFIX}${result.id}`, JSON.stringify(result));
    sessionStorage.setItem(`${PREFIX}latest`, result.id);
  } catch {
    // sessionStorage full or unavailable — fail silently
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Load a ScanResult by ID. Returns null if not found. */
export function loadScan(id: string): ScanResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as ScanResult) : null;
  } catch {
    return null;
  }
}

/** ID of the most recently saved scan (used for redirects). */
export function latestScanId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}latest`);
}

// ── Clean-up ──────────────────────────────────────────────────────────────────

/** Remove scans older than the last N to keep sessionStorage tidy. */
export function pruneOldScans(keepLast = 5): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(PREFIX) && k !== `${PREFIX}latest`) keys.push(k);
  }
  keys.slice(0, Math.max(0, keys.length - keepLast)).forEach(k =>
    sessionStorage.removeItem(k),
  );
}
