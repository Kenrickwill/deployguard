import type { AgentProvider } from "./types";

// ─── Mock Provider ────────────────────────────────────────────────────────────

/**
 * Deterministic mock that returns pre-baked responses based on the prompt
 * content. Used during development and testing — no API key required.
 *
 * When you wire up a real LLM, implement the AgentProvider interface and
 * pass the new provider to `createAgent()`. The action logic is unchanged.
 */
export class MockProvider implements AgentProvider {
  readonly name = "mock-v1";

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    // Simulate realistic latency
    await new Promise(r => setTimeout(r, 180 + Math.random() * 120));

    // Route to the appropriate mock based on action markers in the prompt
    if (userPrompt.includes("ACTION:explain_finding"))    return this.explainFinding(userPrompt);
    if (userPrompt.includes("ACTION:prioritize_risks"))   return this.prioritizeRisks(userPrompt);
    if (userPrompt.includes("ACTION:suggest_fix"))        return this.suggestFix(userPrompt);
    if (userPrompt.includes("ACTION:generate_docs"))      return this.generateDocs(userPrompt);
    if (userPrompt.includes("ACTION:executive_summary"))  return this.executiveSummary(userPrompt);
    if (userPrompt.includes("ACTION:next_actions"))       return this.nextActions(userPrompt);

    return "_No mock available for this action._";
  }

  private extract(prompt: string, key: string): string {
    const m = new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s").exec(prompt);
    return m?.[1]?.trim() ?? "";
  }

  private explainFinding(prompt: string): string {
    const title    = this.extract(prompt, "FINDING_TITLE");
    const severity = this.extract(prompt, "SEVERITY");
    const ruleId   = this.extract(prompt, "RULE_ID");
    const audience = this.extract(prompt, "AUDIENCE");

    const isExec = audience === "executive";
    const isSec  = audience === "security";

    if (isExec) {
      return `## ${title}

**Risk Level:** ${severity.charAt(0).toUpperCase() + severity.slice(1)}

This finding indicates a security weakness that could expose the application or its users to risk. In practical terms, an attacker exploiting this issue could gain unauthorized access, extract sensitive data, or disrupt services.

**Business Impact:** Without remediation, this issue increases the likelihood of a security incident. Depending on the nature of the data involved, it may also create compliance obligations under GDPR, SOC 2, or HIPAA.

**What we recommend:** The engineering team should address this before the next production release. Estimated remediation effort is low to medium.`;
    }

    if (isSec) {
      return `## Technical Analysis: ${title}

**Rule:** \`${ruleId}\` | **Severity:** ${severity.toUpperCase()}

### Attack Vector
This finding represents a ${severity}-severity weakness in the application's security posture. Depending on context, an attacker with access to this code path could exploit this weakness through:
- Direct exploitation if the vulnerable code is reachable from untrusted input
- Chained exploitation as a stepping stone to higher-privilege access

### CWE Mapping
This finding maps to a Common Weakness Enumeration entry related to improper input handling or insecure configuration (see rule references for specifics).

### Exploitability
Likelihood of exploitation depends on whether the affected code is exposed publicly and what data it handles. Treat as exploitable until a code review confirms otherwise.

### Verification Steps
1. Confirm the finding is not a false positive by reviewing the flagged line in context
2. Assess whether the vulnerable code path is reachable from user-controlled input
3. Check for existing compensating controls (WAF rules, network restrictions)
4. Apply the suggested remediation and re-scan to confirm resolution`;
    }

    return `## ${title}

**What this means:** This finding was flagged because the scanner detected a pattern that commonly leads to security vulnerabilities — specifically around \`${ruleId}\`.

**In plain terms:** Think of this like leaving a key under the doormat. The code works fine day-to-day, but if someone knows where to look, they can use it against you.

**Severity: ${severity}** — ${
  severity === "critical" ? "This needs to be fixed before any production deployment." :
  severity === "high"     ? "This should be fixed in the current sprint." :
  severity === "medium"   ? "Schedule this for remediation in the next sprint." :
                            "Address this as part of routine code quality improvements."
}

**What to do:**
1. Review the flagged code at the location shown
2. Check the remediation guidance in the finding details
3. Apply the fix, then re-run the scanner to confirm it's resolved
4. If you're unsure whether it's a false positive, flag it for security review`;
  }

  private prioritizeRisks(prompt: string): string {
    const score    = this.extract(prompt, "OVERALL_SCORE");
    const critical = this.extract(prompt, "CRITICAL_COUNT");
    const high     = this.extract(prompt, "HIGH_COUNT");
    const medium   = this.extract(prompt, "MEDIUM_COUNT");
    const rec      = this.extract(prompt, "RECOMMENDATION");

    return `## Risk Prioritization

**Deploy Recommendation:** ${rec.toUpperCase()} | **Score:** ${score}/100

### Priority 1 — Immediate Action Required
${parseInt(critical) > 0
  ? `There are **${critical} critical finding${parseInt(critical) > 1 ? "s" : ""}** that must be resolved before any deployment. Critical findings represent direct exploitation vectors — treat them as production incidents regardless of release schedule.`
  : `No critical findings detected. Your highest-priority concerns are at the High severity level.`}

### Priority 2 — Fix Before Next Release
${parseInt(high) > 0
  ? `**${high} high-severity finding${parseInt(high) > 1 ? "s" : ""}** should be resolved in the current sprint. These represent significant risk but may not be immediately exploitable without specific conditions.`
  : `No high-severity findings. ✓`}

### Priority 3 — Schedule Within 30 Days
${parseInt(medium) > 0
  ? `**${medium} medium-severity finding${parseInt(medium) > 1 ? "s" : ""}** should be addressed in your next sprint cycle. They represent meaningful risk accumulation over time.`
  : `No medium-severity findings. ✓`}

### Prioritization Rationale
When multiple findings compete for engineering time, fix in this order:
1. **Hardcoded secrets** — immediate credential rotation + removal
2. **Authentication gaps** — unauthorized access is the highest-impact class of vulnerability
3. **Injection vectors** (eval, dynamic SQL) — direct code execution risk
4. **Configuration issues** — quick wins with high impact (security headers, CORS)
5. **Informational leakage** — lower urgency but important for defense in depth

### Risk Acceptance Guidance
Any finding not addressed before release should be formally risk-accepted by the security owner and tracked in your vulnerability management system with a target remediation date.`;
  }

  private suggestFix(prompt: string): string {
    const title   = this.extract(prompt, "FINDING_TITLE");
    const ruleId  = this.extract(prompt, "RULE_ID");
    const snippet = this.extract(prompt, "SNIPPET");
    const lang    = this.extract(prompt, "LANGUAGE") || "typescript";

    const fixes: Record<string, string> = {
      "SEC-001": `### Fix: Remove Hardcoded Secret

**Step 1 — Rotate the credential immediately.** Even if the repo is private, treat the secret as compromised.

**Step 2 — Move to environment variables:**

\`\`\`${lang}
// Before (vulnerable)
${snippet || `const apiKey = "sk_live_abc123...";`}

// After (secure)
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API_KEY environment variable is required");
\`\`\`

**Step 3 — Add to \`.env.example\` (not \`.env\`):**
\`\`\`bash
# .env.example — commit this
API_KEY=your_key_here

# .env — add to .gitignore, never commit
API_KEY=sk_live_actual_secret
\`\`\`

**Step 4 — Add a pre-commit guard:**
\`\`\`bash
npm install --save-dev @secretlint/secretlint-rule-preset-recommend secretlint
\`\`\``,

      "SEC-002": `### Fix: Replace eval() with Safe Alternatives

\`\`\`${lang}
// Before (remote code execution risk)
${snippet || `const result = eval(userInput);`}

// After — use a lookup table for known operations
const operations: Record<string, (a: number, b: number) => number> = {
  add:      (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
};

const result = operations[operationName]?.(a, b);
if (result === undefined) throw new Error(\`Unknown operation: \${operationName}\`);
\`\`\`

If you need to evaluate math expressions from user input, use a sandboxed parser like \`mathjs\` or \`expr-eval\` instead of \`eval()\`.`,

      "SEC-003": `### Fix: Restrict CORS to Known Origins

\`\`\`${lang}
// Before (open to all origins)
${snippet || `res.setHeader("Access-Control-Allow-Origin", "*");`}

// After — allowlist approach
const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_URL ?? "http://localhost:3000",
  "https://app.yourcompany.com",
]);

function setCORSHeaders(req: Request, res: Response) {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }
}
\`\`\``,

      "SEC-004": `### Fix: Use a Strong, Random JWT Secret

\`\`\`bash
# Generate a cryptographically secure secret (run once, store in secrets manager)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
\`\`\`

\`\`\`${lang}
// Before
${snippet || `jwt.sign(payload, "secret");`}

// After
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
const token = jwt.sign(payload, JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "1h",
});
\`\`\``,
    };

    const fix = fixes[ruleId] ?? `### Fix: ${title}

Review the flagged code and apply the remediation guidance from the finding details.

\`\`\`${lang}
// Flagged code:
${snippet || "// See finding location for the specific line"}
\`\`\`

**General approach:**
1. Understand what value or behavior this code produces
2. Identify whether it handles untrusted input
3. Replace with a safer equivalent from your framework or standard library
4. Add a test that confirms the vulnerable pattern can no longer be triggered
5. Re-run the scanner to verify the finding is resolved`;

    return fix;
  }

  private generateDocs(prompt: string): string {
    const target   = this.extract(prompt, "TARGET_NAME");
    const score    = this.extract(prompt, "OVERALL_SCORE");
    const total    = this.extract(prompt, "TOTAL_FINDINGS");
    const critical = this.extract(prompt, "CRITICAL_COUNT");
    const high     = this.extract(prompt, "HIGH_COUNT");

    return `# Security Findings Documentation
## ${target || "Project"} — Scan Report

**Generated by DeployGuard Agent** | Score: ${score}/100

---

## Overview

This document provides developer-facing documentation for all findings identified in the latest security scan. Each finding includes a plain-language explanation, the affected location, and actionable remediation steps.

**Total findings:** ${total} | **Critical:** ${critical} | **High:** ${high}

---

## How to Use This Document

1. **Start with Critical and High findings** — these represent the most immediate risk
2. **Each finding has a Rule ID** — use it to search the DeployGuard knowledge base for additional context
3. **After fixing**, re-run the scanner and confirm the finding no longer appears
4. **False positives** — if you believe a finding is incorrect, mark it as a false positive with a written justification

---

## Findings by Severity

> _Detailed finding entries are generated from live scan data. Each entry includes:_
> - Description of the vulnerability class
> - Affected file and line number
> - Code snippet (where available)
> - Step-by-step remediation
> - References (CWE, OWASP)

---

## Remediation Tracking

| Rule ID | Severity | Status | Owner | Target Date |
|---------|----------|--------|-------|-------------|
| _(populated from scan)_ | | Open | | |

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)

_This documentation was generated by the DeployGuard Security Agent. It is advisory in nature and does not replace a professional penetration test or security audit._`;
  }

  private executiveSummary(prompt: string): string {
    const target    = this.extract(prompt, "TARGET_NAME");
    const score     = this.extract(prompt, "OVERALL_SCORE");
    const scoreNum  = parseInt(score || "0");
    const rec       = this.extract(prompt, "RECOMMENDATION");
    const critical  = this.extract(prompt, "CRITICAL_COUNT");
    const high      = this.extract(prompt, "HIGH_COUNT");
    const company   = this.extract(prompt, "COMPANY_NAME") || "your organization";
    const date     = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const recLabel = rec === "deploy"  ? "✅ Approved for Deployment"
                   : rec === "review"  ? "⚠️ Review Required Before Deployment"
                   :                    "🚫 Deployment Blocked";

    return `# Security Assessment — Executive Summary

**Application:** ${target || "Application Under Review"}
**Date:** ${date}
**Prepared for:** ${company}
**Overall Score:** ${score}/100
**Status:** ${recLabel}

---

## Summary

DeployGuard completed an automated security scan of **${target || "the target application"}**. The scan evaluated the codebase against ${scoreNum > 75 ? "industry-standard" : "critical"} security controls covering secrets management, authentication, configuration hygiene, and dependency safety.

${parseInt(critical) > 0
  ? `**Immediate attention is required.** The scan identified **${critical} critical issue${parseInt(critical) > 1 ? "s" : ""}** that must be resolved before this application can be safely deployed. Critical findings represent direct exploitation risks that could result in unauthorized data access, account compromise, or service disruption.`
  : parseInt(high) > 0
  ? `The application is in reasonable security shape but has **${high} high-severity issue${parseInt(high) > 1 ? "s" : ""}** that should be resolved before the next production release.`
  : `The application demonstrates a strong security posture with no critical or high-severity findings detected.`}

---

## Risk Summary

| Category | Status |
|---|---|
| Secrets & Credentials | ${parseInt(critical) > 0 ? "⚠️ Issues Detected" : "✅ No Issues"} |
| Authentication & Authorization | ${parseInt(high) > 0 ? "⚠️ Review Required" : "✅ Passing"} |
| Configuration Security | ${scoreNum < 75 ? "⚠️ Improvements Needed" : "✅ Passing"} |
| Dependency Safety | ✅ Reviewed |

---

## Recommendation

${rec === "block"
  ? `**Do not proceed with deployment** until critical and high-severity findings are resolved. Estimated remediation time: 2–5 engineering days depending on finding complexity.`
  : rec === "review"
  ? `**A security review is recommended** before deployment. High-severity findings should be triaged and either fixed or formally accepted by the security owner.`
  : `**The application may proceed to deployment.** Remaining findings are low-severity and can be addressed in the next sprint cycle.`}

---

_This summary was generated by DeployGuard's automated security scanning platform. It is not a substitute for a full penetration test or security audit. Contact your security team for questions._`;
  }

  private nextActions(prompt: string): string {
    const horizon  = this.extract(prompt, "HORIZON") || "sprint";
    const critical = parseInt(this.extract(prompt, "CRITICAL_COUNT") || "0");
    const high     = parseInt(this.extract(prompt, "HIGH_COUNT") || "0");
    const medium   = parseInt(this.extract(prompt, "MEDIUM_COUNT") || "0");
    const rec      = this.extract(prompt, "RECOMMENDATION");

    const horizonLabel = horizon === "immediate" ? "Next 24–48 Hours"
                       : horizon === "quarter"   ? "This Quarter"
                       :                          "This Sprint";

    return `## Recommended Next Actions — ${horizonLabel}

${rec === "block" ? `> ⛔ **Deployment is blocked.** Do not merge or release until critical findings are resolved.\n` : ""}

### Immediate (Today)

${critical > 0
  ? `- [ ] **Rotate all exposed credentials** identified in critical findings — assume they are compromised
- [ ] **Block the release pipeline** if not already blocked — do not deploy until cleared
- [ ] **Assign critical findings** to a named engineer with a same-day SLA`
  : `- [ ] Review findings dashboard and triage any newly detected issues
- [ ] Confirm no production secrets are in the flagged files`}
- [ ] Share this report with the security owner for awareness

### This Sprint

${high > 0
  ? `- [ ] **Resolve ${high} high-severity finding${high > 1 ? "s" : ""}** — these are sprint-blocking
- [ ] Add security-focused unit tests to cover the fixed code paths
- [ ] Re-run the scanner after fixes to confirm resolution`
  : `- [ ] No high-severity blockers — proceed with normal sprint work`}
${medium > 0
  ? `- [ ] Schedule ${medium} medium-severity finding${medium > 1 ? "s" : ""} for remediation (they can follow high-severity fixes)`
  : ""}
- [ ] Add DeployGuard to your CI/CD pipeline to catch issues earlier

### Next Sprint

- [ ] Review and address remaining medium and low findings
- [ ] Conduct a developer education session on the top vulnerability classes found
- [ ] Establish a vulnerability SLA policy (e.g. Critical: 24h, High: 7d, Medium: 30d)
- [ ] Evaluate whether a manual penetration test is warranted for critical paths

### Process Improvements

- [ ] Add secret-scanning pre-commit hooks (\`secretlint\` or \`git-secrets\`)
- [ ] Integrate SAST into the PR review process so findings are caught before merge
- [ ] Set up security header validation in your staging environment smoke tests
- [ ] Document a vulnerability disclosure and escalation process

---
_Actions generated by DeployGuard Agent based on current scan results. Adjust priorities based on your team's risk appetite and release timeline._`;
  }
}

// ─── Anthropic Provider Stub ─────────────────────────────────────────────────
//
// Uncomment and configure when you're ready to connect a real LLM:
//
// import Anthropic from "@anthropic-ai/sdk";
//
// export class AnthropicProvider implements AgentProvider {
//   readonly name: string;
//   private client: Anthropic;
//
//   constructor(model = "claude-opus-4-7") {
//     this.name   = model;
//     this.client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
//   }
//
//   async complete(systemPrompt: string, userPrompt: string): Promise<string> {
//     const msg = await this.client.messages.create({
//       model:      this.name,
//       max_tokens: 2048,
//       system:     systemPrompt,
//       messages:   [{ role: "user", content: userPrompt }],
//     });
//     const block = msg.content[0];
//     if (block.type !== "text") throw new Error("Unexpected response type");
//     return block.text;
//   }
// }
