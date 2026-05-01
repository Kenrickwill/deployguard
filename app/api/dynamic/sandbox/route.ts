import { NextResponse } from "next/server";

/**
 * DeployGuard built-in DAST sandbox.
 *
 * This endpoint intentionally omits or misconfigures several security headers
 * so users can run the probe engine and see real findings without needing their
 * own staging environment.
 *
 * Misconfigurations present:
 *  - No Strict-Transport-Security (HSTS)
 *  - No Content-Security-Policy
 *  - No X-Frame-Options
 *  - No X-Content-Type-Options
 *  - Permissive Referrer-Policy (unsafe-url)
 *  - CORS wildcard (Access-Control-Allow-Origin: *)
 *  - Server/X-Powered-By version disclosure
 *  - No rate-limit headers
 *  - No Set-Cookie security attributes (SameSite / Secure / HttpOnly)
 */
function buildSandboxResponse(): NextResponse {
  const body = {
    sandbox: true,
    message:
      "DeployGuard DAST test sandbox — intentionally misconfigured security headers for probe demonstration.",
    probes:
      "Run the dynamic test against this URL to see real findings from the DeployGuard probe engine.",
    endpoints: ["/api/dynamic/sandbox", "/api/scan/analyze", "/api/agent"],
  };

  const res = NextResponse.json(body, { status: 200 });

  // ── Intentionally BAD headers ───────────────────────────────────────────────

  // Server version disclosure (DYN-007)
  res.headers.set("Server", "nginx/1.24.0");
  res.headers.set("X-Powered-By", "Express/4.18.2");

  // CORS wildcard (DYN-006)
  res.headers.set("Access-Control-Allow-Origin", "*");

  // Permissive referrer (DYN-005)
  res.headers.set("Referrer-Policy", "unsafe-url");

  // Insecure cookie (DYN-010) — missing HttpOnly, Secure, SameSite
  res.headers.set("Set-Cookie", "sandbox_session=abc123; Path=/");

  // ── Intentionally MISSING ────────────────────────────────────────────────────
  // Strict-Transport-Security  → DYN-001 fires
  // Content-Security-Policy    → DYN-002 fires
  // X-Frame-Options            → DYN-003 fires
  // X-Content-Type-Options     → DYN-004 fires
  // RateLimit-Limit / X-RateLimit-Limit → DYN-009 fires

  return res;
}

export async function GET(): Promise<NextResponse> {
  return buildSandboxResponse();
}

// Probes try HEAD first; return same headers so HEAD works too.
export async function HEAD(): Promise<NextResponse> {
  return buildSandboxResponse();
}
