/**
 * DeployGuard — Edge Middleware
 *
 * Responsibilities:
 *  1. API key authentication for /api/* routes that require it.
 *  2. Passes public routes through untouched.
 *
 * Key format:  dg_live_<32 random hex chars>
 *              dg_test_<32 random hex chars>   (sandbox / test tokens)
 *
 * The raw key is never stored — only the SHA-256 hash (stored in ApiToken.keyHash).
 * We validate in middleware by hashing the inbound key and comparing to the DB,
 * but because middleware runs on the Edge runtime we keep it lightweight:
 *   • Format + prefix check here (fast rejection of garbage)
 *   • Full DB lookup delegated to a thin /api/auth/validate route called from
 *     API handlers via the `requireApiKey` helper (lib/auth/api-key.ts)
 *
 * This middleware only enforces the presence + format of the key.
 * It does NOT hit the database — that would add latency to every request.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Routes that require an API key ────────────────────────────────────────────

const PROTECTED_API_PREFIXES = [
  "/api/scan/analyze",
  "/api/dynamic/run",
  "/api/reports",
  "/api/projects",
  "/api/tokens",
  "/api/webhooks",
];

// Routes that are always public (no key needed)
const PUBLIC_API_PREFIXES = [
  "/api/dynamic/sandbox",  // demo endpoint
  "/api/agent",            // used by UI only (no external callers)
  "/api/health",
];

// ── Key format ────────────────────────────────────────────────────────────────

const KEY_REGEX = /^dg_(live|test)_[0-9a-f]{32}$/;

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Only intercept /api/* paths
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Pass through public API routes
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check if this route is protected
  const isProtected = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // ── Auth check ──────────────────────────────────────────────────────────────

  // 1. Try Authorization: Bearer <key>
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerKey  = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  // 2. Fall back to X-DeployGuard-Key header (for environments that strip Authorization)
  const headerKey  = request.headers.get("x-deployguard-key")?.trim() ?? null;

  const rawKey = bearerKey ?? headerKey;

  if (!rawKey) {
    return NextResponse.json(
      { error: "API key required. Pass it as 'Authorization: Bearer <key>' or 'X-DeployGuard-Key: <key>'." },
      { status: 401 },
    );
  }

  if (!KEY_REGEX.test(rawKey)) {
    return NextResponse.json(
      { error: "Invalid API key format." },
      { status: 401 },
    );
  }

  // Format is valid — forward to the route handler which will do the DB lookup.
  // Attach a header so route handlers can trust the key has passed format validation.
  const response = NextResponse.next();
  response.headers.set("x-dg-api-key", rawKey);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
