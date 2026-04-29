"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe, Lock, Key, Cookie, Zap, Shield, ArrowRight,
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AuthType = "none" | "bearer" | "basic" | "cookie";
type DynScanType = "xss" | "csrf" | "sqli" | "open-redirect" | "ssrf" | "auth-bypass" | "rate-limit" | "idor";

const AUTH_OPTIONS: { id: AuthType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "none",   label: "None",           icon: <Globe className="h-4 w-4" />,   desc: "Unauthenticated scan — public endpoints only" },
  { id: "bearer", label: "Bearer Token",   icon: <Key className="h-4 w-4" />,     desc: "Set Authorization: Bearer <token> header" },
  { id: "basic",  label: "Basic Auth",     icon: <Lock className="h-4 w-4" />,    desc: "Username / password credentials" },
  { id: "cookie", label: "Session Cookie", icon: <Cookie className="h-4 w-4" />,  desc: "Paste a valid session cookie string" },
];

const SCAN_TYPES: { id: DynScanType; label: string; severity: string; desc: string }[] = [
  { id: "xss",          label: "Reflected XSS",   severity: "high",   desc: "Inject payloads into GET/POST parameters" },
  { id: "sqli",         label: "SQL Injection",    severity: "critical", desc: "Error-based and blind injection probes" },
  { id: "idor",         label: "IDOR",             severity: "high",   desc: "Access other users' resource IDs" },
  { id: "auth-bypass",  label: "Auth Bypass",      severity: "high",   desc: "Skip authentication on protected endpoints" },
  { id: "rate-limit",   label: "Rate Limiting",    severity: "medium", desc: "Flood endpoints to detect missing limits" },
  { id: "csrf",         label: "CSRF",             severity: "medium", desc: "Forge cross-site requests on state-changing ops" },
  { id: "open-redirect",label: "Open Redirect",    severity: "medium", desc: "Redirect to external attacker-controlled URLs" },
  { id: "ssrf",         label: "SSRF",             severity: "high",   desc: "Force server-side requests to internal hosts" },
];

const SEV_CLS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/25",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/25",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/25",
};

const LOG_LINES = [
  "Initializing DAST engine...",
  "✓ Connectivity check passed",
  "Crawling application structure...",
  "✓ 23 endpoints discovered",
  "Running brute-force checks on /api/auth/login...",
  "⚠ Rate limiting not detected — VULNERABLE",
  "Running XSS probes on /api/users?search=...",
  "⚠ Reflected payload in error response",
  "Running IDOR checks on /api/reports/:id...",
  "⚠ Cross-org resource access confirmed",
  "Running file upload checks on /api/upload...",
  "✓ File type restrictions enforced",
  "Completing analysis...",
  "✓ Dynamic test complete — 3 vulnerabilities found",
];

export default function DynamicTestSetupPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState("https://staging.example.com");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [token, setToken] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<DynScanType>>(
    new Set(["xss", "sqli", "idor", "auth-bypass", "rate-limit"]),
  );
  const [depth, setDepth] = useState(3);
  const [timeout, setTimeout_] = useState(30);
  const [running, setRunning] = useState(false);
  const [logIndex, setLogIndex] = useState(0);

  function toggleType(id: DynScanType) {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startTest() {
    setRunning(true);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLogIndex(i);
      if (i >= LOG_LINES.length) {
        clearInterval(t);
        setTimeout(() => router.push("/dynamic/dyn_01HZQK"), 700);
      }
    }, 700);
  }

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
          <div className="p-5 font-mono text-xs space-y-1.5 min-h-[300px]">
            <div className="text-muted-foreground mb-2">$ deployguard dast --url {targetUrl}</div>
            {LOG_LINES.slice(0, logIndex).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={
                  line.startsWith("✓") ? "text-emerald-400" :
                  line.startsWith("⚠") ? "text-amber-400" :
                  "text-muted-foreground"
                }
              >
                {"  "}{line}
              </motion.div>
            ))}
            {logIndex < LOG_LINES.length && (
              <span className="inline-block w-2 h-3.5 bg-primary align-middle ml-2 animate-pulse" />
            )}
          </div>
        </motion.div>
        <p className="text-center text-sm text-muted-foreground">
          Testing {targetUrl} · {selectedTypes.size} test types active…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Target */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Target</h2>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Base URL</label>
          <input
            type="url"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            placeholder="https://staging.example.com"
            className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
          <p className="text-[11px] text-muted-foreground">Use a staging or sandbox environment. Never run DAST against production.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Crawl depth</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={6} value={depth}
                onChange={e => setDepth(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-mono w-4 text-right">{depth}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Timeout (s)</label>
            <input
              type="number" min={10} max={300} value={timeout}
              onChange={e => setTimeout_(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Authentication</h2>
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
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bearer token</label>
            <input
              type="password" value={token} onChange={e => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
        )}
        {authType === "basic" && (
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Username" className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
            <input type="password" placeholder="Password" className="bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors" />
          </div>
        )}
        {authType === "cookie" && (
          <textarea
            rows={2}
            placeholder="sessionId=abc123; csrfToken=xyz789"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors resize-none"
          />
        )}
      </div>

      {/* Test types */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Test types</h2>
          </div>
          <span className="text-xs text-muted-foreground">{selectedTypes.size} selected</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SCAN_TYPES.map(({ id, label, severity, desc }) => {
            const active = selectedTypes.has(id);
            return (
              <button
                key={id}
                onClick={() => toggleType(id)}
                className={cn(
                  "flex items-start gap-3 border rounded-lg p-3 text-left transition-all",
                  active ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/70",
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 transition-all",
                  active ? "bg-primary border-primary" : "border-border",
                )}>
                  {active && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">{label}</span>
                    <span className={cn("border rounded px-1.5 text-[9px] font-mono font-bold", SEV_CLS[severity])}>
                      {severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex items-center gap-2 border border-border rounded-md px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={startTest}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Zap className="h-4 w-4" /> Launch Dynamic Test
        </button>
      </div>
    </div>
  );
}
