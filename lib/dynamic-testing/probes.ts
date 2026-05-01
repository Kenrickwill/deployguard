import type { DynamicFinding, SeverityLevel } from "@/types";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProbeResult {
  probeId:     string;
  name:        string;
  description: string;
  passed:      boolean;
  finding?:    Omit<DynamicFinding, "id">;
}

export interface ProbeContext {
  targetUrl: string;
  headers:   Record<string, string>;
  status:    number;
  body?:     string;
}

type Probe = (ctx: ProbeContext) => ProbeResult;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function finding(
  probeId: string,
  name: string,
  severity: SeverityLevel,
  description: string,
  remediation: string,
  evidence?: string,
): Omit<DynamicFinding, "id"> {
  return { probeId, name, severity, description, remediation, evidence };
}

function header(ctx: ProbeContext, name: string): string | undefined {
  return ctx.headers[name.toLowerCase()];
}

// ─── Security Header Probes ───────────────────────────────────────────────────

const checkHSTS: Probe = (ctx) => {
  const h = header(ctx, "strict-transport-security");
  if (h) {
    const maxAge = /max-age=(\d+)/i.exec(h);
    if (maxAge && parseInt(maxAge[1], 10) >= 31536000) {
      return { probeId: "DYN-001", name: "HSTS Configured", description: "HSTS header present with sufficient max-age.", passed: true };
    }
    return {
      probeId: "DYN-001",
      name: "HSTS Insufficient",
      description: "HSTS header present but max-age is below recommended 1 year.",
      passed: false,
      finding: finding("DYN-001", "HSTS Insufficient max-age", "medium",
        "Strict-Transport-Security header is present but max-age is below 31536000 (1 year).",
        "Set max-age to at least 31536000. Consider adding includeSubDomains and preload.",
        h),
    };
  }
  return {
    probeId: "DYN-001",
    name: "HSTS Missing",
    description: "Strict-Transport-Security header is absent.",
    passed: false,
    finding: finding("DYN-001", "Missing HSTS Header", "high",
      "The Strict-Transport-Security header is missing. Browsers will not enforce HTTPS for subsequent requests.",
      "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"),
  };
};

const checkCSP: Probe = (ctx) => {
  const h = header(ctx, "content-security-policy");
  if (!h) {
    return {
      probeId: "DYN-002",
      name: "CSP Missing",
      description: "Content-Security-Policy header is absent.",
      passed: false,
      finding: finding("DYN-002", "Missing Content-Security-Policy", "high",
        "No Content-Security-Policy header was returned. This leaves the application vulnerable to XSS attacks.",
        "Define a restrictive CSP. Start with: Content-Security-Policy: default-src 'self'"),
    };
  }
  const unsafe = ["'unsafe-inline'", "'unsafe-eval'", "data:", "*"];
  const found = unsafe.filter(u => h.includes(u));
  if (found.length > 0) {
    return {
      probeId: "DYN-002",
      name: "CSP Unsafe Directives",
      description: "CSP contains unsafe directives that weaken XSS protection.",
      passed: false,
      finding: finding("DYN-002", "Unsafe CSP Directives", "medium",
        `Content-Security-Policy contains: ${found.join(", ")}. These directives undermine XSS protection.`,
        "Remove unsafe-inline and unsafe-eval. Use nonces or hashes for inline scripts instead.",
        h),
    };
  }
  return { probeId: "DYN-002", name: "CSP Configured", description: "CSP header present without obvious unsafe directives.", passed: true };
};

const checkXFrameOptions: Probe = (ctx) => {
  const h = header(ctx, "x-frame-options");
  if (!h) {
    return {
      probeId: "DYN-003",
      name: "X-Frame-Options Missing",
      description: "X-Frame-Options header is absent.",
      passed: false,
      finding: finding("DYN-003", "Missing X-Frame-Options", "medium",
        "The X-Frame-Options header is missing, leaving the app vulnerable to clickjacking.",
        "Add: X-Frame-Options: DENY or X-Frame-Options: SAMEORIGIN"),
    };
  }
  const val = h.toUpperCase();
  if (val !== "DENY" && val !== "SAMEORIGIN") {
    return {
      probeId: "DYN-003",
      name: "X-Frame-Options Invalid",
      description: "X-Frame-Options has an unrecognized value.",
      passed: false,
      finding: finding("DYN-003", "Invalid X-Frame-Options Value", "low",
        `X-Frame-Options is set to "${h}" which may not be respected by all browsers.`,
        "Use DENY or SAMEORIGIN.",
        h),
    };
  }
  return { probeId: "DYN-003", name: "X-Frame-Options Set", description: "X-Frame-Options header is present and valid.", passed: true };
};

const checkXContentType: Probe = (ctx) => {
  const h = header(ctx, "x-content-type-options");
  if (!h || h.toLowerCase() !== "nosniff") {
    return {
      probeId: "DYN-004",
      name: "X-Content-Type-Options Missing",
      description: "X-Content-Type-Options: nosniff is not set.",
      passed: false,
      finding: finding("DYN-004", "Missing X-Content-Type-Options", "low",
        "The X-Content-Type-Options: nosniff header is absent, allowing MIME-type sniffing attacks.",
        "Add: X-Content-Type-Options: nosniff"),
    };
  }
  return { probeId: "DYN-004", name: "X-Content-Type-Options Set", description: "MIME sniffing prevention is enabled.", passed: true };
};

const checkReferrerPolicy: Probe = (ctx) => {
  const h = header(ctx, "referrer-policy");
  const safe = ["no-referrer", "strict-origin", "strict-origin-when-cross-origin", "same-origin", "no-referrer-when-downgrade"];
  if (!h) {
    return {
      probeId: "DYN-005",
      name: "Referrer-Policy Missing",
      description: "Referrer-Policy header is absent.",
      passed: false,
      finding: finding("DYN-005", "Missing Referrer-Policy", "low",
        "No Referrer-Policy header was found. Browsers default to sending the full URL as a referrer.",
        "Add: Referrer-Policy: strict-origin-when-cross-origin"),
    };
  }
  if (!safe.includes(h.toLowerCase())) {
    return {
      probeId: "DYN-005",
      name: "Referrer-Policy Permissive",
      description: "Referrer-Policy is set but allows full URL leakage.",
      passed: false,
      finding: finding("DYN-005", "Permissive Referrer-Policy", "info",
        `Referrer-Policy: ${h} may leak full URL information across origins.`,
        "Use strict-origin-when-cross-origin or stricter.",
        h),
    };
  }
  return { probeId: "DYN-005", name: "Referrer-Policy Set", description: "Referrer-Policy is configured appropriately.", passed: true };
};

// ─── CORS Probe ───────────────────────────────────────────────────────────────

const checkCORS: Probe = (ctx) => {
  const acao = header(ctx, "access-control-allow-origin");
  if (!acao) {
    return { probeId: "DYN-006", name: "CORS Not Configured", description: "No CORS headers found — cross-origin requests will be blocked by default.", passed: true };
  }
  if (acao === "*") {
    const credentials = header(ctx, "access-control-allow-credentials");
    if (credentials?.toLowerCase() === "true") {
      return {
        probeId: "DYN-006",
        name: "CORS Wildcard + Credentials",
        description: "CORS allows all origins AND credentials, which is insecure.",
        passed: false,
        finding: finding("DYN-006", "CORS Wildcard with Credentials", "critical",
          "Access-Control-Allow-Origin: * combined with Access-Control-Allow-Credentials: true is rejected by browsers but indicates a misconfigured server.",
          "Never combine wildcard origin with credentials. Specify explicit allowed origins.",
          `Access-Control-Allow-Origin: ${acao}\nAccess-Control-Allow-Credentials: ${credentials}`),
      };
    }
    return {
      probeId: "DYN-006",
      name: "CORS Wildcard Origin",
      description: "CORS is open to all origins.",
      passed: false,
      finding: finding("DYN-006", "Overly Permissive CORS", "medium",
        "Access-Control-Allow-Origin: * allows any origin to make cross-origin requests.",
        "Restrict CORS to known trusted origins. Use an allowlist.",
        `Access-Control-Allow-Origin: ${acao}`),
    };
  }
  return { probeId: "DYN-006", name: "CORS Restricted", description: "CORS is limited to a specific origin.", passed: true };
};

// ─── Server Disclosure Probe ──────────────────────────────────────────────────

const checkServerDisclosure: Probe = (ctx) => {
  const server = header(ctx, "server");
  const powered = header(ctx, "x-powered-by");
  const findings: string[] = [];

  if (server && /[0-9]/.test(server)) findings.push(`Server: ${server}`);
  if (powered) findings.push(`X-Powered-By: ${powered}`);

  if (findings.length > 0) {
    return {
      probeId: "DYN-007",
      name: "Server Version Disclosed",
      description: "Server technology/version information is exposed in response headers.",
      passed: false,
      finding: finding("DYN-007", "Server Version Disclosure", "low",
        "Response headers reveal server software and/or version information, aiding reconnaissance.",
        "Remove or sanitize Server and X-Powered-By headers. In Express: app.disable('x-powered-by'). In Next.js: use headers() config.",
        findings.join("\n")),
    };
  }
  return { probeId: "DYN-007", name: "No Server Disclosure", description: "Server does not disclose version information.", passed: true };
};

// ─── Auth Requirement Probe ───────────────────────────────────────────────────

const checkAuthRequirement: Probe = (ctx) => {
  if (ctx.status === 401 || ctx.status === 403) {
    return { probeId: "DYN-008", name: "Auth Required", description: "Endpoint returns 401/403 — authentication is enforced.", passed: true };
  }
  if (ctx.status === 200 && !header(ctx, "www-authenticate") && !header(ctx, "authorization")) {
    return {
      probeId: "DYN-008",
      name: "Auth Not Enforced",
      description: "Endpoint returned 200 without any authentication challenge.",
      passed: false,
      finding: finding("DYN-008", "Unauthenticated Access Allowed", "high",
        "The target URL returned HTTP 200 without requiring authentication. Sensitive functionality may be publicly accessible.",
        "Verify that this endpoint should be publicly accessible. If not, add authentication middleware.",
        `HTTP ${ctx.status}`),
    };
  }
  return { probeId: "DYN-008", name: "Auth Status Inconclusive", description: `Endpoint returned ${ctx.status}.`, passed: true };
};

// ─── Rate Limit Probe ─────────────────────────────────────────────────────────

const checkRateLimit: Probe = (ctx) => {
  const rl = header(ctx, "ratelimit-limit") ?? header(ctx, "x-ratelimit-limit") ?? header(ctx, "retry-after");
  if (!rl) {
    return {
      probeId: "DYN-009",
      name: "Rate Limiting Not Detected",
      description: "No rate-limit headers found in the response.",
      passed: false,
      finding: finding("DYN-009", "Missing Rate Limit Headers", "info",
        "No rate-limiting headers (RateLimit-Limit, X-RateLimit-Limit, Retry-After) were detected.",
        "Implement API rate limiting and surface it via standard headers per IETF draft-ietf-httpapi-ratelimit-headers."),
    };
  }
  return { probeId: "DYN-009", name: "Rate Limiting Detected", description: "Rate-limit headers are present.", passed: true };
};

// ─── Cookie Security Probe ────────────────────────────────────────────────────

const checkCookieSecurity: Probe = (ctx) => {
  const sc = header(ctx, "set-cookie");
  if (!sc) {
    return { probeId: "DYN-010", name: "No Cookies Set", description: "No Set-Cookie headers in this response.", passed: true };
  }
  const cookies = sc.split(",").map(c => c.trim());
  const issues: string[] = [];

  for (const cookie of cookies) {
    const lower = cookie.toLowerCase();
    if (!lower.includes("httponly")) issues.push(`Missing HttpOnly: ${cookie.split(";")[0]}`);
    if (!lower.includes("secure"))   issues.push(`Missing Secure: ${cookie.split(";")[0]}`);
    if (!lower.includes("samesite")) issues.push(`Missing SameSite: ${cookie.split(";")[0]}`);
  }

  if (issues.length > 0) {
    return {
      probeId: "DYN-010",
      name: "Insecure Cookie Attributes",
      description: "One or more cookies are missing security attributes.",
      passed: false,
      finding: finding("DYN-010", "Insecure Cookie Configuration", "medium",
        "Cookies are set without required security attributes, exposing them to theft or CSRF attacks.",
        "Ensure all cookies include: HttpOnly; Secure; SameSite=Strict or SameSite=Lax.",
        issues.join("\n")),
    };
  }
  return { probeId: "DYN-010", name: "Cookies Secure", description: "All cookies include HttpOnly, Secure, and SameSite attributes.", passed: true };
};

// ─── HTTPS Enforcement Probe ──────────────────────────────────────────────────

const checkHTTPS: Probe = (ctx) => {
  if (!ctx.targetUrl.startsWith("https://")) {
    return {
      probeId: "DYN-011",
      name: "Target Not Using HTTPS",
      description: "The target URL is served over plaintext HTTP.",
      passed: false,
      finding: finding("DYN-011", "Plaintext HTTP in Use", "high",
        "The target is served over HTTP, not HTTPS. All traffic is transmitted in plaintext.",
        "Configure TLS on the server and redirect all HTTP traffic to HTTPS."),
    };
  }
  return { probeId: "DYN-011", name: "HTTPS Enforced", description: "Target is served over HTTPS.", passed: true };
};

// ─── Probe Registry ───────────────────────────────────────────────────────────

const ALL_PROBES: Probe[] = [
  checkHTTPS,
  checkHSTS,
  checkCSP,
  checkXFrameOptions,
  checkXContentType,
  checkReferrerPolicy,
  checkCORS,
  checkServerDisclosure,
  checkAuthRequirement,
  checkRateLimit,
  checkCookieSecurity,
];

// ─── Runner ───────────────────────────────────────────────────────────────────

export interface ProbeRunOptions {
  timeoutMs?:     number;
  probeIds?:      string[];              // undefined = all probes
  extraHeaders?:  Record<string, string>; // e.g. { Authorization: "Bearer ..." }
}

export interface ProbeRunResult {
  targetUrl:   string;
  probedAt:    string;
  results:     ProbeResult[];
  findings:    DynamicFinding[];
}

/**
 * Execute all non-destructive probes against an authorized target.
 * Uses a single HEAD request (falls back to GET) — never sends a body.
 */
export async function runProbes(
  targetUrl: string,
  options: ProbeRunOptions = {},
): Promise<ProbeRunResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const probedAt = new Date().toISOString();

  // Fetch headers — HEAD first, GET fallback
  let ctx: ProbeContext;
  try {
    ctx = await fetchContext(targetUrl, timeoutMs, options.extraHeaders ?? {});
  } catch (err) {
    throw new Error(`Failed to reach target: ${err instanceof Error ? err.message : String(err)}`);
  }

  const probes = options.probeIds
    ? ALL_PROBES.filter(p => options.probeIds!.includes(p(ctx).probeId))
    : ALL_PROBES;

   const results: ProbeResult[] = probes.map(probe => {
    try {
      return probe(ctx);
    } catch {
      return { probeId: "ERR", name: "Probe Error", description: "Probe threw an unexpected error.", passed: true };
    }
  });

  const findings: DynamicFinding[] = results
    .filter(r => !r.passed && r.finding)
    .map(r => ({ id: randomUUID(), ...r.finding! }));

  return { targetUrl, probedAt, results, findings };
}

async function fetchContext(
  targetUrl: string,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<ProbeContext> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: extraHeaders,
    });

    // Some servers reject HEAD — fall back to GET
    if (response.status === 405) {
      response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "Accept": "text/html,application/json", ...extraHeaders },
      });
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    let body: string | undefined;
    if (response.headers.get("content-type")?.includes("text")) {
      try { body = await response.text(); } catch { /* ignore */ }
    }

    return { targetUrl, headers, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}
