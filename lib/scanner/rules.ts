import type { SeverityLevel, FindingCategory } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RuleContext {
  filePath: string;
  content: string;
  lines: string[];
  extension: string;
  isTestFile: boolean;
  isConfigFile: boolean;
  isTypeDeclaration: boolean;
}

export interface RuleMatch {
  lineNumber: number;
  snippet: string;
  message?: string;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: FindingCategory;
  remediation: string;
  references: string[];
  cwe?: string;
  owasp?: string;
  /** Return [] if no match, RuleMatch[] if found. */
  check: (ctx: RuleContext) => RuleMatch[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Scan every line against a regex. Returns one match per matching line. */
function matchLines(
  lines: string[],
  pattern: RegExp,
  options: {
    skipComments?: boolean;
    skipStrings?: boolean;
    contextSnippet?: boolean;
  } = {},
): RuleMatch[] {
  const results: RuleMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines (JS/TS/Python)
    if (options.skipComments) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) continue;
    }
    if (pattern.test(line)) {
      results.push({ lineNumber: i + 1, snippet: line.trim().slice(0, 300) });
    }
  }
  return results;
}

/** True if the file path indicates it is a test file. */
function isTestPath(filePath: string): boolean {
  return /\.(spec|test)\.[tj]sx?$|__tests__|\btest(s)?\b|\.stories\.[tj]sx?$/.test(filePath);
}

/** True if the file is a type declaration. */
function isDts(filePath: string): boolean {
  return filePath.endsWith(".d.ts");
}

// ─── Rule Definitions ────────────────────────────────────────────────────────

export const RULES: Rule[] = [

  // ── SEC-001 · Hardcoded credentials ──────────────────────────────────────

  {
    id: "SEC-001",
    title: "Hardcoded credential or secret",
    description:
      "A credential, API key, or secret appears to be hardcoded in source code. " +
      "If this repository is exposed (public, leaked, or cloned), the credential " +
      "is immediately compromised and grants whoever has it the same access level.",
    severity: "critical",
    category: "secrets",
    remediation:
      "Remove the credential from source immediately and rotate it. " +
      "Store secrets in environment variables, a vault (e.g. AWS Secrets Manager, " +
      "HashiCorp Vault, Doppler), or a CI/CD secret store. " +
      "Add a pre-commit hook (e.g. gitleaks) to prevent future leaks.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_credentials",
      "https://cwe.mitre.org/data/definitions/798.html",
    ],
    cwe: "CWE-798",
    owasp: "A07:2021",
    check(ctx) {
      if (ctx.isTestFile || ctx.isTypeDeclaration) return [];

      const patterns = [
        // AWS Access Key ID
        /AKIA[0-9A-Z]{16}/,
        // Generic secret/password/key assignment
        /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"'$\s{][^"']{5,}["']/i,
        // Stripe secret keys
        /sk_(test|live)_[A-Za-z0-9]{24,}/,
        // GitHub PAT
        /ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}/,
        // Private key PEM header
        /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/,
        // Slack tokens
        /xox[baprs]-[0-9A-Za-z]{10,48}/,
        // Connection strings with embedded credentials
        /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@]+@/,
      ];

      const results: RuleMatch[] = [];
      for (const pattern of patterns) {
        for (const m of matchLines(ctx.lines, pattern, { skipComments: true })) {
          // Avoid duplicate line numbers across patterns
          if (!results.some(r => r.lineNumber === m.lineNumber)) {
            results.push(m);
          }
        }
      }
      return results;
    },
  },

  // ── SEC-002 · eval() usage ────────────────────────────────────────────────

  {
    id: "SEC-002",
    title: "Dynamic code execution (eval / new Function)",
    description:
      "eval(), new Function(), or string-based setTimeout()/setInterval() execute " +
      "arbitrary JavaScript strings at runtime. If any user-controlled input reaches " +
      "these calls, an attacker can execute arbitrary code in the process context.",
    severity: "high",
    category: "security",
    remediation:
      "Replace eval() with JSON.parse() for data parsing, or refactor the logic to " +
      "avoid dynamic code execution entirely. If a Function constructor is unavoidable " +
      "(e.g. a sandboxed expression evaluator), use a dedicated sandboxed library " +
      "(e.g. isolated-vm) and never pass user input directly.",
    references: [
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!",
      "https://owasp.org/www-community/attacks/Code_Injection",
    ],
    cwe: "CWE-95",
    owasp: "A03:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(ctx.lines, /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/, {
        skipComments: true,
      });
    },
  },

  // ── SEC-003 · Insecure CORS ───────────────────────────────────────────────

  {
    id: "SEC-003",
    title: "Insecure CORS — wildcard origin",
    description:
      "Access-Control-Allow-Origin is set to '*', which permits any website on the " +
      "internet to make credentialed cross-origin requests to this API. Combined with " +
      "Access-Control-Allow-Credentials: true this creates a full credential exfiltration vector.",
    severity: "high",
    category: "security",
    remediation:
      "Replace the wildcard with an explicit allowlist of trusted origins. " +
      "For APIs that must be publicly accessible, set Allow-Credentials to false. " +
      "Example: `origin: [\"https://app.example.com\", \"https://admin.example.com\"]`",
    references: [
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
      "https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny",
    ],
    cwe: "CWE-942",
    owasp: "A05:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(
        ctx.lines,
        /Access-Control-Allow-Origin['":\s,]+['"]\*['"]|(?:cors|origin)\s*[:(]\s*["']\*["']|allowOrigins?\s*:\s*\[?\s*["']\*["']/,
        { skipComments: true },
      );
    },
  },

  // ── SEC-004 · Weak JWT secret ─────────────────────────────────────────────

  {
    id: "SEC-004",
    title: "Weak or obvious JWT signing secret",
    description:
      "The JWT signing secret is a trivially guessable value such as 'secret', " +
      "'password', 'test', or a short string. An attacker who knows or guesses the " +
      "secret can forge arbitrary tokens and impersonate any user.",
    severity: "critical",
    category: "secrets",
    remediation:
      "Generate a cryptographically random secret of at least 256 bits: " +
      "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`. " +
      "Store it in an environment variable, never in source code.",
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
      "https://cwe.mitre.org/data/definitions/321.html",
    ],
    cwe: "CWE-321",
    owasp: "A02:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      // Matches jwt.*secret.*= "weak_value" or sign(..., "weak_value")
      const weakSecretPattern =
        /(?:jwt[_\s.-]*secret|sign\s*\([^,)]+,\s*)\s*[:=]?\s*["'`](?:secret|password|passwd|test|dev|development|abc|xyz|foo|bar|key|jwt|token|12345|qwerty|changeme|insecure|unsafe)[^a-zA-Z0-9]/i;
      // Matches short literals after known jwt-related keys
      const shortSecretPattern =
        /(?:jwt[_\s.-]*secret|sign\s*\([^,)]+,\s*)["'`][^"'`$]{1,15}["'`]/i;

      const results: RuleMatch[] = [];
      for (const m of matchLines(ctx.lines, weakSecretPattern, { skipComments: true })) {
        if (!results.some(r => r.lineNumber === m.lineNumber)) results.push(m);
      }
      for (const m of matchLines(ctx.lines, shortSecretPattern, { skipComments: true })) {
        if (!results.some(r => r.lineNumber === m.lineNumber)) results.push(m);
      }
      return results;
    },
  },

  // ── SEC-005 · Plaintext HTTP URLs ─────────────────────────────────────────

  {
    id: "SEC-005",
    title: "Plaintext HTTP URL in production code",
    description:
      "A non-localhost URL using http:// was found in production code. " +
      "HTTP transmits data in cleartext, making it vulnerable to man-in-the-middle " +
      "attacks, traffic inspection, and credential interception.",
    severity: "medium",
    category: "security",
    remediation:
      "Replace all http:// URLs with https:// equivalents. " +
      "Ensure your server enforces HTTPS and redirects HTTP traffic. " +
      "In Next.js, use relative paths or NEXT_PUBLIC_API_URL with https://.",
    references: [
      "https://owasp.org/www-community/controls/Transport_Layer_Protection_Cheat_Sheet",
      "https://cwe.mitre.org/data/definitions/319.html",
    ],
    cwe: "CWE-319",
    owasp: "A02:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      // http:// that is NOT localhost / 127.0.0.1 / 0.0.0.0 / ::1 / example.com (docs)
      const results = matchLines(
        ctx.lines,
        /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1|example\.com)[a-zA-Z0-9]/,
        { skipComments: true },
      );
      return results;
    },
  },

  // ── SEC-006 · Debug mode enabled ──────────────────────────────────────────

  {
    id: "SEC-006",
    title: "Debug mode or verbose logging enabled",
    description:
      "Debug mode, verbose logging, or development-only configuration appears to be " +
      "active. This can expose internal stack traces, query parameters, environment " +
      "variables, and other sensitive details to external users or log aggregators.",
    severity: "medium",
    category: "configuration",
    remediation:
      "Set NODE_ENV=production in all production deployments. " +
      "Remove or gate debug: true behind environment checks. " +
      "Replace console.debug() with a structured logger that respects log levels. " +
      "Audit morgan/express-logger config to use 'combined' not 'dev'.",
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html",
    ],
    cwe: "CWE-11",
    owasp: "A05:2021",
    check(ctx) {
      const patterns = [
        /\bdebug\s*:\s*true\b/,
        /\bDEBUG\s*=\s*true\b/i,
        /NODE_ENV\s*=\s*["']?development["']?/,
        /morgan\s*\(\s*["']dev["']\)/,
        /console\.debug\s*\(/,
        /app\.(set|use)\s*\(\s*["']?env["']?\s*,\s*["']development["']\)/,
      ];
      const results: RuleMatch[] = [];
      for (const p of patterns) {
        for (const m of matchLines(ctx.lines, p, { skipComments: true })) {
          if (!results.some(r => r.lineNumber === m.lineNumber)) results.push(m);
        }
      }
      return results;
    },
  },

  // ── SEC-007 · Missing authentication indicator ────────────────────────────

  {
    id: "SEC-007",
    title: "Commented-out or skipped authentication check",
    description:
      "An authentication or authorization check appears to have been disabled, " +
      "commented out, or marked with a TODO. Endpoints that bypass authentication " +
      "allow unauthenticated callers to perform privileged operations.",
    severity: "high",
    category: "security",
    remediation:
      "Restore the authentication middleware. Use a route-level guard " +
      "(e.g. Next.js middleware, Express middleware, or a decorator) that verifies " +
      "session/JWT before any handler logic runs. Never leave auth disabled in " +
      "code that can reach production.",
    references: [
      "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      "https://cwe.mitre.org/data/definitions/306.html",
    ],
    cwe: "CWE-306",
    owasp: "A01:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      const patterns = [
        // Commented-out auth calls
        /\/\/\s*(?:requireAuth|checkAuth|authenticate|verifyToken|withAuth|isAuthenticated|authMiddleware)/,
        // TODO/FIXME notes about missing auth
        /\/\/\s*(?:TODO|FIXME|HACK|XXX)\s*[:\-]?.*(auth|authentication|authorization|login|protect)/i,
        // Explicit "no auth" markers
        /\/\/\s*(?:no auth|skip auth|bypass auth|auth disabled|unauthenticated)/i,
        // process.env bypass
        /process\.env\.SKIP_AUTH|DISABLE_AUTH\s*=\s*true/i,
      ];
      const results: RuleMatch[] = [];
      for (const p of patterns) {
        for (const m of matchLines(ctx.lines, p)) {
          if (!results.some(r => r.lineNumber === m.lineNumber)) results.push(m);
        }
      }
      return results;
    },
  },

  // ── SEC-008 · Sensitive data in console logs ──────────────────────────────

  {
    id: "SEC-008",
    title: "Sensitive data written to console logs",
    description:
      "Passwords, tokens, secrets, or personally identifiable information (PII) " +
      "are being logged to the console. These logs may surface in monitoring tools, " +
      "log aggregators, or crash reporters, exposing sensitive data to unintended " +
      "viewers or external services.",
    severity: "medium",
    category: "security",
    remediation:
      "Remove all console statements that include sensitive values. " +
      "Switch to a structured logger (e.g. pino, winston) with appropriate log levels. " +
      "Never log request bodies, auth headers, passwords, tokens, or user PII. " +
      "In production, set the minimum log level to 'info' or 'warn'.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Insertion_of_Sensitive_Information_into_Log_File",
      "https://cwe.mitre.org/data/definitions/532.html",
    ],
    cwe: "CWE-532",
    owasp: "A09:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      // Matches console.X calls that appear on a line also containing sensitive terms
      return matchLines(
        ctx.lines,
        /console\.\s*(?:log|info|warn|error|dir|trace)\s*\([^)]*(?:password|passwd|token|secret|api[_-]?key|private[_-]?key|credential|ssn|credit[_-]?card|cvv|auth)[^)]*\)/i,
        { skipComments: true },
      );
    },
  },

  // ── SEC-009 · SQL injection pattern ──────────────────────────────────────

  {
    id: "SEC-009",
    title: "Potential SQL injection via string concatenation",
    description:
      "A SQL query appears to be constructed by concatenating or interpolating " +
      "variables directly. If any variable originates from user input, this " +
      "creates a SQL injection vulnerability that can lead to data exfiltration " +
      "or full database compromise.",
    severity: "high",
    category: "security",
    remediation:
      "Use parameterized queries or a query builder that separates code from data. " +
      "With Prisma: `prisma.user.findMany({ where: { email } })`. " +
      "With raw SQL: `db.query('SELECT * FROM users WHERE email = $1', [email])`.",
    references: [
      "https://owasp.org/www-community/attacks/SQL_Injection",
      "https://cwe.mitre.org/data/definitions/89.html",
    ],
    cwe: "CWE-89",
    owasp: "A03:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(
        ctx.lines,
        /(?:query|sql|statement)\s*[+\-]?=\s*.*(?:req\.|params\.|body\.|query\.)|`\s*SELECT|`\s*INSERT|`\s*UPDATE|`\s*DELETE.*\${/i,
        { skipComments: true },
      );
    },
  },

  // ── SEC-010 · Disabled TLS certificate verification ───────────────────────

  {
    id: "SEC-010",
    title: "TLS certificate verification disabled",
    description:
      "SSL/TLS certificate verification has been disabled via " +
      "NODE_TLS_REJECT_UNAUTHORIZED=0 or rejectUnauthorized: false. " +
      "This makes HTTPS connections trivially vulnerable to man-in-the-middle attacks.",
    severity: "high",
    category: "security",
    remediation:
      "Never disable TLS verification in production code. " +
      "If you need a self-signed cert in development, add it to the trusted store instead. " +
      "Remove all occurrences of NODE_TLS_REJECT_UNAUTHORIZED=0 from committed files.",
    references: [
      "https://cwe.mitre.org/data/definitions/295.html",
    ],
    cwe: "CWE-295",
    owasp: "A02:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(
        ctx.lines,
        /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0["']?|rejectUnauthorized\s*:\s*false/,
        { skipComments: true },
      );
    },
  },

  // ── SEC-011 · Path traversal ──────────────────────────────────────────────

  {
    id: "SEC-011",
    title: "Potential path traversal via unsanitized input",
    description:
      "A file-system operation (readFile, writeFile, createReadStream, etc.) " +
      "appears to use a variable that may originate from user input. " +
      "Without sanitization an attacker can read arbitrary files by supplying " +
      "relative path components such as ../../etc/passwd.",
    severity: "high",
    category: "security",
    remediation:
      "Always resolve file paths with path.resolve() or path.join() against a " +
      "known safe base directory. Verify the resolved path still starts with that " +
      "base directory before performing any file operation.",
    references: [
      "https://owasp.org/www-community/attacks/Path_Traversal",
      "https://cwe.mitre.org/data/definitions/22.html",
    ],
    cwe: "CWE-22",
    owasp: "A01:2021",
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(
        ctx.lines,
        /(?:readFile|writeFile|createReadStream|createWriteStream|appendFile|unlink)\s*\(\s*(?:req\.|params\.|body\.|query\.)/,
        { skipComments: true },
      );
    },
  },

  // ── REL-001 · Unhandled async error ──────────────────────────────────────

  {
    id: "REL-001",
    title: "Unhandled async/await without try-catch",
    description:
      "An async function or await expression appears to lack error handling. " +
      "In Node.js ≥15, unhandled promise rejections terminate the process. " +
      "In earlier versions they silently swallow errors, hiding failures.",
    severity: "medium",
    category: "reliability",
    remediation:
      "Wrap await expressions in try/catch blocks, or add a .catch() handler. " +
      "For Express route handlers, use an asyncHandler wrapper that forwards " +
      "errors to next(). Install a global unhandledRejection listener as a backstop.",
    references: [
      "https://nodejs.org/en/docs/guides/error-handling",
    ],
    check(ctx) {
      if (ctx.isTestFile) return [];
      // Look for async functions whose body contains await but no try/catch
      // Heuristic: exported async function with await but no try {
      const results: RuleMatch[] = [];
      let inAsyncFn = false;
      let hasTry = false;
      let depth = 0;
      let fnStart = 0;

      for (let i = 0; i < ctx.lines.length; i++) {
        const line = ctx.lines[i];
        if (/\basync\s+function|\basync\s*\(|=\s*async\s*(?:\([^)]*\)|[a-zA-Z_$])/.test(line)) {
          inAsyncFn = true;
          hasTry = false;
          depth = 0;
          fnStart = i + 1;
        }
        if (inAsyncFn) {
          depth += (line.match(/\{/g) || []).length;
          depth -= (line.match(/\}/g) || []).length;
          if (/\btry\s*\{/.test(line)) hasTry = true;
          if (depth <= 0 && inAsyncFn) {
            inAsyncFn = false;
            // Only flag if the function had an await but no try
            const fnBody = ctx.lines.slice(fnStart - 1, i + 1).join("\n");
            if (!hasTry && /\bawait\b/.test(fnBody)) {
              results.push({ lineNumber: fnStart, snippet: ctx.lines[fnStart - 1].trim().slice(0, 200) });
            }
          }
        }
      }
      return results;
    },
  },

  // ── REL-002 · console.log left in production code ────────────────────────

  {
    id: "REL-002",
    title: "console.log in production code",
    description:
      "console.log() statements were found outside of test files. " +
      "These add noise to production logs, can leak internal state, and may " +
      "indicate incomplete debugging work that should be removed before shipping.",
    severity: "low",
    category: "reliability",
    remediation:
      "Remove console.log statements or replace them with a structured logger " +
      "(pino, winston) that supports log levels. Set the minimum log level to " +
      "'info' or 'warn' in production.",
    references: [],
    check(ctx) {
      if (ctx.isTestFile) return [];
      return matchLines(ctx.lines, /\bconsole\.log\s*\(/, { skipComments: true });
    },
  },

  // ── CFG-001 · Missing security headers hint ───────────────────────────────

  {
    id: "CFG-001",
    title: "Security headers not configured in Next.js config",
    description:
      "No HTTP security headers (Content-Security-Policy, X-Frame-Options, etc.) " +
      "are configured in next.config. Without these headers the application is " +
      "more vulnerable to clickjacking, XSS, and MIME-sniffing attacks.",
    severity: "medium",
    category: "configuration",
    remediation:
      'Add a headers() function to next.config.ts that sets at minimum: ' +
      'Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, ' +
      'Referrer-Policy: strict-origin-when-cross-origin, and ' +
      'Strict-Transport-Security: max-age=63072000.',
    references: [
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/headers",
      "https://owasp.org/www-project-secure-headers/",
    ],
    owasp: "A05:2021",
    check(ctx) {
      // Only relevant in next.config files
      if (!ctx.filePath.match(/next\.config\.[tj]s$/)) return [];
      // Flag if there's no "headers" export
      if (!/headers\s*(?:\(\)|:)/.test(ctx.content)) {
        return [{ lineNumber: 1, snippet: ctx.lines[0]?.trim() ?? "", message: "No headers() config found." }];
      }
      return [];
    },
  },

  // ── CFG-002 · Dependency with known vulnerability hint ────────────────────

  {
    id: "CFG-002",
    title: "Known-vulnerable package version in package.json",
    description:
      "A package version with a documented CVE was detected in package.json. " +
      "Vulnerable dependencies are a leading cause of supply-chain attacks and " +
      "data breaches.",
    severity: "high",
    category: "dependency",
    remediation:
      "Run `npm audit` and `npm audit fix` to automatically upgrade to patched versions. " +
      "For breaking upgrades, review the changelog and migrate incrementally. " +
      "Enable Dependabot or Renovate for automated PR-based updates.",
    references: [
      "https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities",
      "https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/",
    ],
    owasp: "A06:2021",
    check(ctx) {
      if (!ctx.filePath.endsWith("package.json")) return [];
      // Known vulnerable version ranges (illustrative — a real scanner would use an advisory DB)
      const KNOWN_VULN: { pkg: string; pattern: RegExp; cve: string }[] = [
        { pkg: "jsonwebtoken", pattern: /"jsonwebtoken":\s*"[^"]*[0-8]\.\d+\.\d+/, cve: "CVE-2022-23539" },
        { pkg: "lodash",       pattern: /"lodash":\s*"[^"]*4\.17\.(?:1[0-9]|20)"/, cve: "CVE-2021-23337" },
        { pkg: "axios",        pattern: /"axios":\s*"[^"]*0\.\d+\.\d+"/,           cve: "CVE-2023-45857" },
        { pkg: "express",      pattern: /"express":\s*"[^"]*[3-4]\.\d+\.\d+"/,     cve: "multiple" },
      ];
      const results: RuleMatch[] = [];
      for (const { pattern, cve } of KNOWN_VULN) {
        for (const m of matchLines(ctx.lines, pattern)) {
          results.push({ ...m, message: `Possible ${cve}` });
        }
      }
      return results;
    },
  },

  // ── INF-001 · TODO/FIXME security notes ──────────────────────────────────

  {
    id: "INF-001",
    title: "TODO / FIXME comment referencing a security concern",
    description:
      "A comment explicitly marks a security-related issue as deferred. " +
      "Deferred security work has a high probability of never being completed " +
      "and ships as technical debt into production.",
    severity: "info",
    category: "security",
    remediation:
      "Create a tracked issue or ticket for the security concern immediately. " +
      "Do not merge to the default branch until the concern is resolved or " +
      "explicitly accepted as a known risk with a mitigation plan documented.",
    references: [],
    check(ctx) {
      return matchLines(
        ctx.lines,
        /\/\/\s*(?:TODO|FIXME|HACK|XXX)\s*[:\-]?.{0,80}(?:auth|sanitize|validate|escape|xss|inject|csrf|security|secret|password|token)/i,
      );
    },
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadRules(): Rule[] {
  return RULES;
}

export function getRuleById(id: string): Rule | undefined {
  return RULES.find(r => r.id === id);
}

export function buildContext(filePath: string, content: string): RuleContext {
  return {
    filePath,
    content,
    lines: content.split("\n"),
    extension: filePath.split(".").pop() ?? "",
    isTestFile: isTestPath(filePath),
    isConfigFile: /config\.[tj]s$|\.config\.[tj]s$|\.env/.test(filePath),
    isTypeDeclaration: isDts(filePath),
  };
}
