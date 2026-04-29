import type { Finding, ScanResult } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeExample {
  label:    string;
  language: string;
  code:     string;
}

export interface RemediationGuide {
  ruleId:     string;
  title:      string;
  summary:    string;
  why:        string;
  steps:      string[];
  before?:    CodeExample;
  after?:     CodeExample;
  references: string[];
}

export interface ScanDocumentation {
  generatedAt: string;
  targetName:  string;
  overview:    string;
  guides:      RemediationGuide[];
}

// ─── Per-rule Guides ──────────────────────────────────────────────────────────

const GUIDES: Record<string, Omit<RemediationGuide, "ruleId">> = {
  "SEC-001": {
    title: "Remove Hardcoded Secrets",
    summary: "Secrets embedded in source code are permanently exposed once the code is committed, even if later removed.",
    why: "Version control history preserves all changes. A secret committed even once can be extracted by anyone with repo access — or the public if the repo is open source.",
    steps: [
      "Identify all hardcoded secrets using the scan findings.",
      "Immediately rotate any exposed credentials (API keys, passwords, tokens).",
      "Move secrets to environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler).",
      "Add a pre-commit hook with tools like `git-secrets` or `trufflehog` to block future leaks.",
      "Never store secrets in .env files committed to the repository.",
    ],
    before: {
      label: "Hardcoded secret",
      language: "typescript",
      code: `const client = new Stripe("sk_live_abcdef1234567890");`,
    },
    after: {
      label: "Environment variable",
      language: "typescript",
      code: `const client = new Stripe(process.env.STRIPE_SECRET_KEY!);`,
    },
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
      "https://cwe.mitre.org/data/definitions/798.html",
    ],
  },

  "SEC-002": {
    title: "Avoid eval() and Dynamic Code Execution",
    summary: "`eval()`, `Function()`, and `setTimeout(string)` execute arbitrary strings as code, creating remote code execution vectors.",
    why: "If any user-controlled data reaches these functions, an attacker can execute arbitrary code in your Node.js process with full server privileges.",
    steps: [
      "Remove all uses of `eval()`, `new Function()`, and `setTimeout`/`setInterval` with string arguments.",
      "If you need dynamic behavior, use data structures (objects, Maps) instead of dynamic code.",
      "For templating, use a safe template engine. For math expressions, use a sandboxed parser.",
    ],
    before: {
      label: "Dangerous eval",
      language: "typescript",
      code: `const result = eval(userInput); // RCE vulnerability`,
    },
    after: {
      label: "Safe alternative",
      language: "typescript",
      code: `// Use a lookup table instead of eval\nconst ops = { add: (a: number, b: number) => a + b };\nconst result = ops[operation]?.(a, b);`,
    },
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html",
      "https://cwe.mitre.org/data/definitions/95.html",
    ],
  },

  "SEC-003": {
    title: "Fix Insecure CORS Configuration",
    summary: "CORS wildcards allow any origin to make credentialed cross-origin requests to your API.",
    why: "With `Access-Control-Allow-Origin: *` and credentials enabled, a malicious website can make requests to your API on behalf of a logged-in user, reading sensitive data.",
    steps: [
      "Replace wildcard origins with an explicit allowlist of trusted domains.",
      "Never combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`.",
      "Validate the `Origin` request header against your allowlist before reflecting it.",
    ],
    before: {
      label: "Insecure CORS",
      language: "typescript",
      code: `res.setHeader("Access-Control-Allow-Origin", "*");\nres.setHeader("Access-Control-Allow-Credentials", "true");`,
    },
    after: {
      label: "Restricted CORS",
      language: "typescript",
      code: `const ALLOWED = new Set(["https://app.example.com"]);\nconst origin = req.headers.origin;\nif (origin && ALLOWED.has(origin)) {\n  res.setHeader("Access-Control-Allow-Origin", origin);\n  res.setHeader("Access-Control-Allow-Credentials", "true");\n}`,
    },
    references: [
      "https://portswigger.net/web-security/cors",
      "https://cwe.mitre.org/data/definitions/942.html",
    ],
  },

  "SEC-004": {
    title: "Use Strong JWT Secrets",
    summary: "Short or predictable JWT secrets can be brute-forced, allowing attackers to forge valid tokens.",
    why: "JWT secrets are used to sign tokens. If the secret is short (< 32 chars) or a common word, attackers can sign arbitrary payloads and impersonate any user.",
    steps: [
      "Generate a cryptographically random secret of at least 256 bits (32 bytes).",
      "Store the secret in an environment variable, never in source code.",
      "Rotate the secret periodically and on any suspected compromise.",
    ],
    before: {
      label: "Weak secret",
      language: "typescript",
      code: `jwt.sign(payload, "secret");`,
    },
    after: {
      label: "Strong secret",
      language: "typescript",
      code: `// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\njwt.sign(payload, process.env.JWT_SECRET!);`,
    },
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
      "https://cwe.mitre.org/data/definitions/326.html",
    ],
  },

  "SEC-005": {
    title: "Replace Plaintext HTTP URLs",
    summary: "HTTP URLs transmit data unencrypted, enabling man-in-the-middle interception.",
    why: "Any data exchanged over HTTP — including credentials, tokens, and user data — can be intercepted and modified by anyone on the same network path.",
    steps: [
      "Replace all `http://` URLs with `https://` equivalents.",
      "Configure your HTTP client to reject non-TLS connections.",
      "Use HSTS on your own domains to prevent downgrade attacks.",
    ],
    before: { label: "Plaintext", language: "typescript", code: `fetch("http://api.example.com/data")` },
    after:  { label: "Encrypted", language: "typescript", code: `fetch("https://api.example.com/data")` },
    references: ["https://cwe.mitre.org/data/definitions/319.html"],
  },

  "SEC-006": {
    title: "Disable Debug Mode in Production",
    summary: "Debug flags expose stack traces, internal state, and verbose error messages to end users.",
    why: "Detailed error messages reveal implementation details that attackers use to craft targeted exploits. Debug endpoints may expose admin functionality.",
    steps: [
      "Gate all debug flags behind `process.env.NODE_ENV !== 'production'`.",
      "Remove debug middleware (e.g., `morgan`, verbose error handlers) from production builds.",
      "Implement structured logging with log levels — debug logs should not reach production.",
    ],
    references: ["https://cwe.mitre.org/data/definitions/489.html"],
  },

  "SEC-007": {
    title: "Add Authentication to Sensitive Routes",
    summary: "Routes that handle user data or sensitive operations must require authentication.",
    why: "Without authentication checks, any user (including unauthenticated attackers) can access sensitive functionality, data, or administrative features.",
    steps: [
      "Identify all routes that access user data or perform privileged actions.",
      "Add authentication middleware to every sensitive route.",
      "Implement authorization checks (not just authentication) for role-restricted operations.",
      "Return 401 for unauthenticated requests, 403 for unauthorized ones.",
    ],
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
      "https://cwe.mitre.org/data/definitions/306.html",
    ],
  },

  "SEC-008": {
    title: "Remove Sensitive Console Logs",
    summary: "Logging sensitive data (passwords, tokens, PII) to the console risks exposure via log aggregators or shared terminals.",
    why: "Console output in Node.js is often captured by log aggregation services, stored indefinitely, and may be accessible to operations staff who should not see raw credentials.",
    steps: [
      "Search for `console.log` calls that output user objects, tokens, or credentials.",
      "Remove all sensitive logging, or replace with structured logging that redacts sensitive fields.",
      "Implement a logging utility that sanitizes data before writing to any output stream.",
    ],
    references: ["https://cwe.mitre.org/data/definitions/532.html"],
  },

  "REL-001": {
    title: "Add Error Handling to Async Functions",
    summary: "Unhandled promise rejections crash Node.js processes and leave requests hanging.",
    why: "An unhandled rejection in a request handler causes the server to return a 500 or hang indefinitely. In production, repeated crashes trigger restart loops and downtime.",
    steps: [
      "Wrap all `await` expressions in try/catch blocks.",
      "Add a global `unhandledRejection` handler for safety-net logging.",
      "Use an error-handling middleware in Express/Next.js for centralized error responses.",
    ],
    before: {
      label: "No error handling",
      language: "typescript",
      code: `async function getData() {\n  const result = await db.query("SELECT * FROM users");\n  return result;\n}`,
    },
    after: {
      label: "With error handling",
      language: "typescript",
      code: `async function getData() {\n  try {\n    const result = await db.query("SELECT * FROM users");\n    return result;\n  } catch (err) {\n    logger.error("DB query failed", { err });\n    throw new AppError("Failed to fetch data", 500);\n  }\n}`,
    },
    references: ["https://cwe.mitre.org/data/definitions/390.html"],
  },

  "CFG-001": {
    title: "Fix Next.js Security Configuration",
    summary: "Missing security headers and CSP configuration leave your Next.js app without browser-level protections.",
    why: "Next.js does not set security headers by default. Without explicit configuration, browsers lack the directives needed to prevent XSS, clickjacking, and MIME-sniffing attacks.",
    steps: [
      "Add a `headers()` function to `next.config.ts` that returns security headers for all routes.",
      "Include: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.",
      "Test your CSP with a report-only mode before enforcing.",
    ],
    after: {
      label: "Security headers in next.config.ts",
      language: "typescript",
      code: `const securityHeaders = [\n  { key: "X-Frame-Options", value: "DENY" },\n  { key: "X-Content-Type-Options", value: "nosniff" },\n  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },\n];\n\nexport default { async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; } };`,
    },
    references: ["https://nextjs.org/docs/app/api-reference/config/next-config-js/headers"],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateRemediationGuide(finding: Finding): RemediationGuide {
  const guide = GUIDES[finding.ruleId];
  if (guide) {
    return { ruleId: finding.ruleId, ...guide };
  }
  return {
    ruleId:     finding.ruleId,
    title:      `How to fix: ${finding.title}`,
    summary:    finding.remediation ?? "Review and address the flagged issue.",
    why:        "This pattern has been identified as a potential security or reliability concern.",
    steps:      ["Review the flagged code and address the identified issue per the remediation guidance."],
    references: finding.references ?? [],
  };
}

export function generateScanDocumentation(result: ScanResult, targetName: string): ScanDocumentation {
  const active = result.findings.filter(f => !f.falsePositive);
  const seen = new Set<string>();
  const guides: RemediationGuide[] = [];

  for (const finding of active) {
    if (!seen.has(finding.ruleId)) {
      seen.add(finding.ruleId);
      guides.push(generateRemediationGuide(finding));
    }
  }

  const { score } = result;
  const overview = [
    `${targetName} scored ${score.overall}/100 overall.`,
    active.length === 0
      ? "No active findings were detected."
      : `${active.length} finding${active.length === 1 ? "" : "s"} require${active.length === 1 ? "s" : ""} attention across ${guides.length} rule${guides.length === 1 ? "" : "s"}.`,
    score.recommendation === "block"
      ? "Deployment is blocked until critical and high severity issues are resolved."
      : score.recommendation === "review"
      ? "Review recommended before deployment."
      : "No blocking issues detected.",
  ].join(" ");

  return {
    generatedAt: new Date().toISOString(),
    targetName,
    overview,
    guides,
  };
}
