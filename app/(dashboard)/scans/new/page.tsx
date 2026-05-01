"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, Upload, ArrowRight, ScanLine, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Lock,
  Package, Zap, Eye, ChevronDown, X, FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveScan, pruneOldScans } from "@/lib/scan-session";
import type { ScanResult } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab        = "paste" | "upload";
type Env        = "production" | "staging" | "development";
type ScanPhase  = "idle" | "scanning" | "done" | "error";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".html", ".htm",
  ".py", ".go", ".rb", ".java", ".cs", ".php",
  "package.json", "next.config.ts", "next.config.js",
  ".env", "Dockerfile", "other",
];

const ENV_CFG: Record<Env, { label: string; desc: string; ring: string }> = {
  production:  { label: "Production",  desc: "Strictest rules · block on critical", ring: "border-red-400/40 bg-red-400/5 text-red-400" },
  staging:     { label: "Staging",     desc: "Standard rules · review on high",     ring: "border-amber-400/40 bg-amber-400/5 text-amber-400" },
  development: { label: "Development", desc: "Relaxed · advisory only",             ring: "border-blue-400/40 bg-blue-400/5 text-blue-400" },
};

const RULE_OPTIONS = [
  { key: "secrets",      icon: Lock,    label: "Secrets scanning",     desc: "Hardcoded keys, tokens, credentials" },
  { key: "security",     icon: ScanLine,label: "Security analysis",    desc: "Injection, auth gaps, eval(), CORS" },
  { key: "dependencies", icon: Package, label: "Dependency audit",     desc: "CVEs in third-party packages" },
  { key: "performance",  icon: Zap,     label: "Performance",          desc: "N+1 queries, blocking ops" },
  { key: "compliance",   icon: Eye,     label: "Compliance checks",    desc: "OWASP Top 10 mapping" },
] as const;

const REC_CFG = {
  deploy: { label: "DEPLOY",  Icon: CheckCircle2, cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/8" },
  review: { label: "REVIEW",  Icon: AlertTriangle, cls: "text-amber-400 border-amber-400/30 bg-amber-400/8" },
  block:  { label: "BLOCK",   Icon: XCircle,      cls: "text-red-400 border-red-400/30 bg-red-400/8" },
};

/** Detect the likely file extension from pasted content so HTML rules fire correctly. */
function detectExt(code: string, fallback = ".ts"): string {
  const t = code.trimStart();
  if (/^<!DOCTYPE\s+html|^<html\b/i.test(t)) return ".html";
  if (/^\{\s*[\s\S]*"(?:name|version|dependencies)"\s*:/m.test(t)) return ".json";
  if (/^FROM\s+\w|^RUN\s+|^EXPOSE\s+\d/m.test(t)) return "Dockerfile";
  if (/^def\s+\w+\s*\(|^import\s+\w+$|^#\s*!.*python/m.test(t)) return ".py";
  return fallback;
}

const SEV_CLS: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-blue-400",
  info:     "text-zinc-400",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewScanPage() {
  const router = useRouter();

  // Input state
  const [tab,       setTab]       = useState<Tab>("paste");
  const [code,      setCode]      = useState("");
  const [ext,       setExt]       = useState(".ts");
  const [extOpen,   setExtOpen]   = useState(false);
  const [env,       setEnv]       = useState<Env>("staging");
  const [files,     setFiles]     = useState<{ name: string; content: string }[]>([]);
  const [rules,     setRules]     = useState({
    secrets: true, security: true, dependencies: true, performance: true, compliance: false,
  });

  // Scan state
  const [phase,     setPhase]     = useState<ScanPhase>("idle");
  const [progress,  setProgress]  = useState("");
  const [result,    setResult]    = useState<ScanResult | null>(null);
  const [error,     setError]     = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    Promise.all(
      picked.map(f => f.text().then(content => ({ name: f.name, content }))),
    ).then(setFiles);
  }

  function removeFile(name: string) {
    setFiles(fs => fs.filter(f => f.name !== name));
  }

  async function runScan() {
    const resolvedExt = tab === "paste" ? detectExt(code, ext) : ext;
    const filePath = tab === "paste" ? `snippet${resolvedExt}` : undefined;
    const hasCode  = tab === "paste" ? code.trim().length > 0 : files.length > 0;
    if (!hasCode) return;

    setPhase("scanning");
    setError("");
    setProgress("Initialising scanner…");

    // Build disabled rule IDs from unchecked options
    const disabledCategories = (Object.keys(rules) as (keyof typeof rules)[])
      .filter(k => !rules[k]);

    // Map option keys to rule ID prefixes (rough mapping for MVP)
    const categoryRuleMap: Record<string, string[]> = {
      secrets:      ["SEC-001", "SEC-004"],
      security:     ["SEC-002", "SEC-003", "SEC-005", "SEC-006", "SEC-007", "SEC-008", "SEC-009", "SEC-010", "SEC-011"],
      dependencies: ["CFG-002"],
      performance:  ["REL-001"],
      compliance:   ["INF-001"],
    };
    const disabledRuleIds = disabledCategories.flatMap(c => categoryRuleMap[c] ?? []);

    try {
      setProgress("Running security rules…");

      const body =
        tab === "paste"
          ? { snippet: code, filePath, disabledRuleIds }
          : { files: files.map(f => ({ path: f.name, content: f.content })), disabledRuleIds };

      const res = await fetch("/api/scan/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      setProgress("Scoring results…");

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const json = (await res.json()) as { data?: { scan?: ScanResult } };
      const scan = json.data?.scan;
      if (!scan) throw new Error("No scan data in response.");

      setProgress("Done.");
      setResult(scan);
      setPhase("done");

      pruneOldScans();
      saveScan(scan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
      setPhase("error");
    }
  }

  function goToResults() {
    if (result) router.push(`/scans/${result.id}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New scan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Paste code or upload files — results in seconds.
        </p>
      </div>

      {/* ── Input card ── */}
      <AnimatePresence mode="wait">
        {phase === "idle" || phase === "error" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Tab switcher */}
            <div className="flex border border-border rounded-lg p-1 bg-card w-fit gap-1">
              {(["paste", "upload"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    tab === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "paste" ? <Code2 className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                  {t === "paste" ? "Paste code" : "Upload files"}
                </button>
              ))}
            </div>

            {/* Paste tab */}
            {tab === "paste" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Editor chrome */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  </div>

                  {/* Extension picker */}
                  <div className="relative">
                    <button
                      onClick={() => setExtOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                    >
                      {code.length > 0 ? detectExt(code, ext) : ext} <ChevronDown className="h-3 w-3" />
                    </button>
                    {extOpen && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                        {EXTENSIONS.map(e => (
                          <button
                            key={e}
                            onClick={() => { setExt(e); setExtOpen(false); }}
                            className={cn(
                              "w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors",
                              ext === e ? "text-primary bg-primary/5" : "text-muted-foreground",
                            )}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder={`Paste your ${ext} code here…\n\n// Example:\nconst secret = "sk_live_abc123";\nconst query = \`SELECT * FROM users WHERE id = \${req.params.id}\`;`}
                  spellCheck={false}
                  className="w-full min-h-[320px] bg-[#090d14] text-foreground font-mono text-xs p-5 resize-y focus:outline-none placeholder:text-zinc-600 leading-relaxed"
                />

                <div className="px-4 py-2 border-t border-border bg-background/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{code.split("\n").length} lines · {code.length} chars</span>
                  {code.length > 0 && (
                    <button onClick={() => setCode("")} className="hover:text-foreground transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upload tab */}
            {tab === "upload" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.html,.htm,.py,.go,.rb,.java,.cs,.php,.json,.env,.dockerfile"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {files.length === 0 ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-all"
                  >
                    <Upload className="h-8 w-8 opacity-40" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop files here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">.ts · .tsx · .js · .html · .py · .go · .json · and more</p>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 space-y-2">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5 bg-background/40">
                        <FileCode className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-mono text-xs flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{(f.content.length / 1024).toFixed(1)} KB</span>
                        <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border border-dashed border-border rounded-lg py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                    >
                      + Add more files
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Environment */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target environment</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(ENV_CFG) as [Env, typeof ENV_CFG[Env]][]).map(([e, cfg]) => (
                  <button
                    key={e}
                    onClick={() => setEnv(e)}
                    className={cn(
                      "border rounded-lg p-3 text-left transition-all",
                      env === e ? cfg.ring : "border-border hover:border-border/60",
                    )}
                  >
                    <p className={cn("text-xs font-semibold", env === e ? cfg.ring.split(" ").find(c => c.startsWith("text-")) : "text-foreground")}>
                      {cfg.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{cfg.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Scan options</p>
              {RULE_OPTIONS.map(({ key, icon: Icon, label, desc }) => {
                const on = rules[key];
                return (
                  <button
                    key={key}
                    onClick={() => setRules(r => ({ ...r, [key]: !r[key] }))}
                    className={cn(
                      "w-full flex items-center gap-3 border rounded-lg px-3.5 py-2.5 text-left transition-all",
                      on ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/60",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <div className={cn(
                      "w-8 h-4 rounded-full border transition-all relative shrink-0",
                      on ? "bg-primary border-primary" : "bg-muted border-border",
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                        on ? "left-[18px]" : "left-0.5",
                      )} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {phase === "error" && (
              <div className="border border-red-400/30 bg-red-400/5 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Launch */}
            <button
              onClick={runScan}
              disabled={tab === "paste" ? code.trim().length === 0 : files.length === 0}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold transition-all",
                (tab === "paste" ? code.trim().length > 0 : files.length > 0)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              <ScanLine className="h-4 w-4" />
              Run Security Scan
            </button>
          </motion.div>
        ) : null}

        {/* ── Scanning ── */}
        {phase === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/60">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">deployguard — scanning</span>
              <Loader2 className="ml-auto h-3.5 w-3.5 text-primary animate-spin" />
            </div>
            <div className="p-6 font-mono text-xs space-y-2 min-h-[220px]">
              <p className="text-muted-foreground">$ deployguard scan --env {env}</p>
              <p className="text-blue-400">  Initialising DeployGuard scanner…</p>
              <p className="text-emerald-400">  ✓ Rules loaded</p>
              <motion.p
                className="text-muted-foreground"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                  {progress}
              </motion.p>
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="inline-block w-2 h-3.5 bg-primary align-middle ml-1"
              />
            </div>
          </motion.div>
        )}

        {/* ── Done ── */}
        {phase === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Score card */}
            {(() => {
              const rec = REC_CFG[result.score.recommendation];
              const RecIcon = rec.Icon;
              return (
                <div className={cn("rounded-xl border p-6 flex items-center gap-6", rec.cls)}>
                  <div className="text-center shrink-0">
                    <p className="text-6xl font-bold tabular-nums">{result.score.overall}</p>
                    <p className="text-xs opacity-60 font-mono mt-0.5">/ 100</p>
                  </div>
                  <div className="w-px h-14 bg-current opacity-20 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-sm mb-1">
                      <RecIcon className="h-5 w-5" /> {rec.label}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs opacity-80 mt-2">
                      {[
                        { l: "Critical", v: result.summary.critical },
                        { l: "High",     v: result.summary.high },
                        { l: "Total",    v: result.summary.total },
                      ].map(({ l, v }) => (
                        <div key={l}>
                          <p className="opacity-60 text-[10px] uppercase tracking-wide">{l}</p>
                          <p className="font-mono font-bold text-base">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Top findings preview */}
            {result.findings.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-xs font-semibold">
                  Top findings
                </div>
                {result.findings.slice(0, 4).map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                    <span className={cn("text-[10px] font-mono font-bold w-14 shrink-0", SEV_CLS[f.severity])}>
                      {f.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-foreground flex-1 truncate">{f.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{f.ruleId}</span>
                  </div>
                ))}
                {result.findings.length > 4 && (
                  <p className="px-4 py-2 text-[11px] text-muted-foreground">
                    +{result.findings.length - 4} more findings in full report
                  </p>
                )}
              </div>
            )}

            {result.findings.length === 0 && (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-400">No issues found</p>
                <p className="text-xs text-muted-foreground mt-1">Your code passed all active rules.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setPhase("idle"); setResult(null); setCode(""); setFiles([]); }}
                className="flex-1 border border-border rounded-md py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                Scan again
              </button>
              <button
                onClick={goToResults}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                View full report <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
