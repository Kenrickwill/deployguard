"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe, Lock, Key, Cookie, Zap, Shield, ArrowRight,
  ArrowLeft, Loader2, CheckCircle2, FlaskConical,
  AlertTriangle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDynamicTest, pruneOldDynamicTests } from "@/lib/dynamic-session";
import type { DynamicTestSession } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthType = "none" | "bearer" | "basic" | "cookie";

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTH_OPTIONS: { id: AuthType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "none",   label: "None",           icon: <Globe   className="h-4 w-4" />, desc: "Unauthenticated — public endpoints only" },
  { id: "bearer", label: "Bearer Token",   icon: <Key     className="h-4 w-4" />, desc: "Authorization: Bearer <token>" },
  { id: "basic",  label: "Basic Auth",     icon: <Lock    className="h-4 w-4" />, desc: "Username + password credentials" },
  { id: "cookie", label: "Session Cookie", icon: <Cookie  className="h-4 w-4" />, desc: "Paste a valid session cookie string" },
];

const PROBES = [
  { id: "DYN-001", label: "HSTS",                  desc: "Strict-Transport-Security header check" },
  { id: "DYN-002", label: "Content-Security-Policy", desc: "CSP presence and unsafe directive check" },
  { id: "DYN-003", label: "Clickjacking",           desc: "X-Frame-Options header check" },
  { id: "DYN-004", label: "MIME Sniffing",          desc: "X-Content-Type-Options: nosniff check" },
  { id: "DYN-005", label: "Referrer Leakage",       desc: "Referrer-Policy header check" },
  { id: "DYN-006", label: "CORS",                   desc: "Access-Control-Allow-Origin check" },
  { id: "DYN-007", label: "Server Disclosure",      desc: "Server / X-Powered-By version leak" },
  { id: "DYN-008", label: "Auth Enforcement",       desc: "Checks if endpoint requires authentication" },
  { id: "DYN-009", label: "Rate Limiting",          desc: "Rate-limit header detection" },
  { id: "DYN-010", label: "Cookie Security",        desc: "HttpOnly / Secure / SameSite attributes" },
  { id: "DYN-011", label: "HTTPS Enforcement",      desc: "Verifies target uses HTTPS" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DynamicTestSetupPage() {
  const router = useRouter();

  // Target
  const [targetUrl,    setTargetUrl]    = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [timeout_,     setTimeout_]     = useState(15);

  // Auth
  const [authType, setAuthType] = useState<AuthType>("none");
  const [token,    setToken]    = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie,   setCookie]   = useState("");

  // Acknowledgments (all three required by DynamicAuthorizationSchema)
  const [ackAuthority,  setAckAuthority]  = useState(false);
  const [ackNotProd,    setAckNotProd]    = useState(false);
  const [ackReadOnly,   setAckReadOnly]   = useState(false);

  // Run state
  const [running,  setRunning]  = useState(false);
  const [error,    setError]    = useState("");
  const [logLines, setLogLines] = useState<{ text: string; type: "info" | "ok" | "warn" | "err" }[]>([]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const allAcksChecked = ackAuthority && ackNotProd && ackReadOnly;
  const canLaunch = targetUrl.trim().length > 0 && authorizedBy.trim().length > 0 && allAcksChecked && !running;

  function useSandbox() {
    setTargetUrl(`${window.location.origin}/api/dynamic/sandbox`);
    setAckAuthority(true);
    setAckNotProd(true);
    setAckReadOnly(true);
  }

  function addLog(text: string, type: "info" | "ok" | "warn" | "err" = "info") {
    setLogLines(prev => [...prev, { text, type }]);
  }

  // ── Launch ────────────────────────────────────────────────────────────────

  async function launch() {
    if (!canLaunch) return;
    setRunning(true);
    setError("");
    setLogLines([]);

    addLog(`$ deployguard dast --url ${targetUrl}`);
    addLog("Validating authorization…");

    // Build credentials object
    const credentials =
      authType === "bearer"  ? { token }                          :
      authType === "basic"   ? { username, password }             :
      authType === "cookie"  ? { cookie }                         :
      undefined;

    try {
      addLog("Establishing connection to target…");

      const res = await fetch("/api/dynamic/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          authorizedBy,
          acknowledgments: {
            hasAuthority:        true,
            isNotProduction:     true,
            understandsReadOnly: true,
          },
          authType,
          credentials,
          timeoutMs: timeout_ * 1000,
        }),
      });

      addLog(`✓ Target responded — running ${PROBES.length} probes…`, "ok");

      const json = (await res.json()) as { data?: DynamicTestSession; error?: string };

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const session = json.data;
      const vulnCount = session.entries.filter(e => e.vulnerable).length;

      addLog(`✓ HSTS probe complete`, "ok");
      addLog(`✓ CSP probe complete`, "ok");
      addLog(`✓ CORS probe complete`, "ok");
      addLog(`✓ Cookie security probe complete`, "ok");
      addLog(`✓ Authentication probe complete`, "ok");

      if (vulnCount > 0) {
        addLog(`⚠ ${vulnCount} issue${vulnCount > 1 ? "s" : ""} detected`, "warn");
      } else {
        addLog(`✓ All probes passed — no issues found`, "ok");
      }

      addLog(`✓ Dynamic test complete in ${(session.responseTimeMs / 1000).toFixed(1)}s`, "ok");

      pruneOldDynamicTests();
      saveDynamicTest(session);

      // Brief pause so the user sees the final log line
      await new Promise(r => globalThis.setTimeout(r, 800));
      router.push(`/dynamic/${session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dynamic test failed.";
      addLog(`✗ ${msg}`, "err");
      setError(msg);
      setRunning(false);
    }
  }

  // ── Running screen ────────────────────────────────────────────────────────

  if (running) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/50">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-muted-foreground font-mono">deployguard — dast running</span>
            <Loader2 className="ml-auto h-3.5 w-3.5 text-primary animate-spin" />
          </div>
          <div className="p-5 font-mono text-xs space-y-1.5 min-h-[280px]">
            {logLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={
                  line.type === "ok"   ? "text-emerald-400" :
                  line.type === "warn" ? "text-amber-400" :
                  line.type === "err"  ? "text-red-400" :
                  "text-muted-foreground"
                }
              >
                {"  "}{line.text}
              </motion.div>
            ))}
            {!error && (
              <span className="inline-block w-2 h-3.5 bg-primary align-middle ml-2 animate-pulse" />
            )}
          </div>
        </motion.div>
        {error && (
          <div className="border border-red-400/30 bg-red-400/5 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Setup form ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Target */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Target</h2>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Target URL</label>
            <button
              onClick={useSandbox}
              className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 border border-primary/30 bg-primary/5 rounded px-2 py-0.5 transition-colors"
            >
              <FlaskConical className="h-3 w-3" /> Use built-in sandbox
            </button>
          </div>
          <input
            type="url"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            placeholder="https://staging.your-app.com"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <p className="text-[11px] text-muted-foreground">
            Point at a staging or sandbox URL. Never test against production.
            No payload is sent — probes are read-only header inspection.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Authorized by</label>
          <input
            type="text"
            value={authorizedBy}
            onChange={e => setAuthorizedBy(e.target.value)}
            placeholder="Your name or team identifier"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Request timeout</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={5} max={60} value={timeout_}
              onChange={e => setTimeout_(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-sm font-mono w-10 text-right">{timeout_}s</span>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Authentication</h2>
          <span className="text-[11px] text-muted-foreground ml-auto">Credentials are sent only to your target URL</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AUTH_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setAuthType(opt.id)}
              className={cn(
                "flex items-start gap-3 border rounded-lg p-3.5 text-left transition-all",
                authType === opt.id ? "border-primary/40 bg-primary/8" : "border-border hover:border-border/70",
              )}
            >
              <div className={cn("mt-0.5 shrink-0", authType === opt.id ? "text-primary" : "text-muted-foreground")}>
                {opt.icon}
              </div>
              <div>
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {authType === "bearer" && (
          <input
            type="password" value={token} onChange={e => setToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        )}
        {authType === "basic" && (
          <div className="grid grid-cols-2 gap-3">
            <input type="text"     value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
          </div>
        )}
        {authType === "cookie" && (
          <textarea
            rows={2}
            value={cookie} onChange={e => setCookie(e.target.value)}
            placeholder="sessionId=abc123; csrfToken=xyz789"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
          />
        )}
      </div>

      {/* Probes */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Active probes</h2>
          <span className="text-[11px] text-muted-foreground ml-auto">{PROBES.length} read-only header probes</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PROBES.map(p => (
            <div key={p.id} className="flex items-start gap-2.5 border border-border rounded-lg p-2.5 bg-primary/3">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{p.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 border border-blue-400/20 bg-blue-400/5 rounded-lg px-3 py-2.5">
          <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-400/80 leading-snug">
            Probes send a single HEAD (or GET) request and inspect response headers only.
            No attack payloads are sent. Application-layer tests (XSS, SQLi, IDOR) are coming in Phase 2.
          </p>
        </div>
      </div>

      {/* Authorization acknowledgments */}
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-amber-300">Authorization required</h2>
        </div>
        <p className="text-[11px] text-amber-400/70 leading-relaxed">
          Dynamic testing makes real HTTP requests to the target URL.
          Confirm all three statements before proceeding.
        </p>
        {[
          { checked: ackAuthority,  setChecked: setAckAuthority,  label: "I own this target or have explicit written permission from the owner to run security tests against it." },
          { checked: ackNotProd,    setChecked: setAckNotProd,    label: "This target is not a live production system. It is a staging, sandbox, or development environment." },
          { checked: ackReadOnly,   setChecked: setAckReadOnly,   label: "I understand DeployGuard performs read-only header inspection and does not send destructive payloads." },
        ].map(({ checked, setChecked, label }, i) => (
          <button
            key={i}
            onClick={() => setChecked(v => !v)}
            className="w-full flex items-start gap-3 text-left"
          >
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 transition-all",
              checked ? "bg-amber-400 border-amber-400" : "border-amber-400/40",
            )}>
              {checked && <CheckCircle2 className="h-3 w-3 text-background" />}
            </div>
            <p className="text-xs text-amber-300/80 leading-relaxed">{label}</p>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && !running && (
        <div className="border border-red-400/30 bg-red-400/5 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/dynamic")}
          className="flex items-center gap-2 border border-border rounded-md px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={launch}
          disabled={!canLaunch}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all",
            canLaunch
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          <Zap className="h-4 w-4" />
          Launch Dynamic Test
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
