"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  Clock, GitBranch, Download, Copy, ExternalLink, Shield,
  AlertCircle, Zap, Package, Settings2, Lock, RefreshCw,
} from "lucide-react";
import { MOCK_SCAN_RESULT, MOCK_FINDINGS } from "@/lib/mock-data";
import { loadScan } from "@/lib/scan-session";
import type { Finding, FindingCategory, SeverityLevel, ScanResult } from "@/types";
import { cn } from "@/lib/utils";
import { AgentPanel } from "@/components/agent/AgentPanel";

// ── Config ────────────────────────────────────────────────────────────────────

const REC = {
  deploy: { label: "DEPLOY",  Icon: CheckCircle2, bg: "bg-emerald-400/10 border-emerald-400/25 text-emerald-400", glow: "glow-green" },
  review: { label: "REVIEW",  Icon: AlertTriangle, bg: "bg-amber-400/10 border-amber-400/25 text-amber-400",   glow: "glow-amber" },
  block:  { label: "BLOCK",   Icon: XCircle,      bg: "bg-red-400/10 border-red-400/25 text-red-400",         glow: "glow-red" },
};

const SEV_LABEL: Record<SeverityLevel, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/25",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/25",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/25",
  low:      "text-blue-400 bg-blue-400/10 border-blue-400/25",
  info:     "text-zinc-400 bg-zinc-400/10 border-zinc-400/25",
};

const CAT_ICONS: Record<FindingCategory, React.ReactNode> = {
  security:      <Shield className="h-3.5 w-3.5" />,
  secrets:       <Lock className="h-3.5 w-3.5" />,
  dependency:    <Package className="h-3.5 w-3.5" />,
  configuration: <Settings2 className="h-3.5 w-3.5" />,
  reliability:   <AlertCircle className="h-3.5 w-3.5" />,
  performance:   <Zap className="h-3.5 w-3.5" />,
  compliance:    <Shield className="h-3.5 w-3.5" />,
};

const ALL_SEVERITIES: SeverityLevel[] = ["critical", "high", "medium", "low", "info"];

// ── Finding row ───────────────────────────────────────────────────────────────

function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copySnippet() {
    if (!finding.snippet) return;
    navigator.clipboard.writeText(finding.snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={cn("border-b border-border last:border-0", open && "bg-accent/30")}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors group"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

        <div className={cn("flex items-center gap-1.5 border rounded px-2 py-0.5 text-[10px] font-mono font-bold shrink-0", SEV_LABEL[finding.severity])}>
          {finding.severity.toUpperCase()}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          {CAT_ICONS[finding.category]}
        </div>

        <span className="flex-1 text-sm font-medium text-foreground truncate">{finding.title}</span>

        {finding.filePath && (
          <span className="hidden md:block font-mono text-[11px] text-muted-foreground shrink-0 truncate max-w-[220px]">
            {finding.filePath}:{finding.lineNumber}
          </span>
        )}

        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{finding.ruleId}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-10 pb-5 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>

              {finding.snippet && (
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-muted-foreground">
                      {finding.filePath ?? "snippet"}:{finding.lineNumber}
                    </span>
                    <button
                      onClick={copySnippet}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    <span className="text-muted-foreground select-none">{finding.lineNumber}  </span>
                    <span className="text-red-300">{finding.snippet}</span>
                  </pre>
                </div>
              )}

              {finding.remediation && (
                <div className="border border-emerald-400/20 bg-emerald-400/5 rounded-lg p-3.5">
                  <p className="text-xs font-semibold text-emerald-400 mb-1">Remediation</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{finding.remediation}</p>
                </div>
              )}

              {finding.references && finding.references.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {finding.references.map(ref => (
                    <a
                      key={ref}
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> {new URL(ref).hostname}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScanResultsPage() {
  const { id } = useParams<{ id: string }>();

  // Try sessionStorage first, fall back to mock for demo
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isDemo,  setIsDemo]  = useState(false);

  useEffect(() => {
    const stored = loadScan(id);
    if (stored) {
      setResult(stored);
    } else {
      // Fall back to mock so the demo dashboard still looks good
      setResult(MOCK_SCAN_RESULT);
      setIsDemo(true);
    }
  }, [id]);

  const [sevFilter, setSevFilter] = useState<SeverityLevel | "all">("all");
  const [catFilter, setCatFilter] = useState<FindingCategory | "all">("all");
  const [tab,       setTab]       = useState<"findings" | "summary">("findings");

  if (!result) return null;

  const findings = result.findings;
  const rec      = REC[result.score.recommendation];
  const RecIcon  = rec.Icon;

  const filtered = findings.filter(f => {
    if (sevFilter !== "all" && f.severity !== sevFilter) return false;
    if (catFilter !== "all" && f.category !== catFilter) return false;
    return true;
  });

  const sevCounts = ALL_SEVERITIES.reduce((acc, s) => {
    acc[s] = findings.filter(f => f.severity === s).length;
    return acc;
  }, {} as Record<SeverityLevel, number>);

  const scanDuration = result.startedAt && result.completedAt
    ? `${Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 100) / 10}s`
    : "—";

  return (
    <div className="space-y-5">

      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-3 border border-primary/20 bg-primary/5 rounded-lg px-4 py-2.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Showing <strong className="text-foreground">demo data</strong> — run a real scan from{" "}
            <a href="/scans/new" className="text-primary underline underline-offset-2">New Scan</a> to see your own results here.
          </span>
        </div>
      )}

      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border p-5 flex flex-col md:flex-row md:items-center gap-5", rec.bg, rec.glow)}
      >
        {/* Score */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-6xl font-bold tabular-nums">{result.score.overall}</p>
            <p className="text-xs text-current opacity-60 mt-0.5 font-mono">/ 100</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold mb-1">
              <RecIcon className="h-5 w-5" />
              {rec.label}
            </div>
            <p className="text-xs opacity-70">Risk score · {result.score.recommendation}</p>
          </div>
        </div>

        <div className="w-px h-16 bg-current opacity-20 hidden md:block" />

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          {[
            { label: "Findings",    value: String(findings.length) },
            { label: "Critical",    value: String(result.summary.critical), icon: null },
            { label: "Duration",    value: scanDuration, icon: <Clock className="h-3 w-3 inline mr-1" /> },
            { label: "Environment", value: isDemo ? "demo" : "staging" },
          ].map(({ label, value, icon }) => (
            <div key={label}>
              <p className="text-[10px] font-medium opacity-60 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-mono font-medium">{icon}{value}</p>
            </div>
          ))}
        </div>

        {/* Export */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href     = url;
              a.download = `deployguard-scan-${result.id.slice(-8)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 border border-current/30 bg-current/10 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-current/20 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </motion.div>

      {/* Severity pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSevFilter("all")}
          className={cn(
            "border rounded-md px-3 py-1 text-xs font-medium transition-colors",
            sevFilter === "all"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-border/70",
          )}
        >
          All ({findings.length})
        </button>
        {ALL_SEVERITIES.filter(s => sevCounts[s] > 0).map(s => (
          <button
            key={s}
            onClick={() => setSevFilter(s === sevFilter ? "all" : s)}
            className={cn(
              "border rounded-md px-3 py-1 text-xs font-mono font-medium transition-colors capitalize",
              sevFilter === s ? SEV_LABEL[s] : "border-border text-muted-foreground hover:border-border/70",
            )}
          >
            {s} ({sevCounts[s]})
          </button>
        ))}
      </div>

      {/* Dimension scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["security","performance","reliability","compliance"] as const).map(dim => {
          const score = result.score[dim];
          return (
            <div key={dim} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-xs text-muted-foreground capitalize">{dim}</p>
                <p className="text-sm font-bold font-mono">{score}</p>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.7 }}
                  className={cn("h-full rounded-full",
                    score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500",
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0">
        {(["findings","summary"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "findings" ? `Findings (${filtered.length})` : "Summary"}
          </button>
        ))}
      </div>

      {/* Findings list */}
      {tab === "findings" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {findings.length === 0
                  ? "No issues found — your code passed all active rules."
                  : "No findings match the current filters."}
              </p>
            </div>
          ) : (
            filtered.map(f => <FindingRow key={f.id} finding={f} />)
          )}
        </div>
      )}

      {/* Agent Panel */}
      <AgentPanel
        scan={result}
        targetName={isDemo ? "api-service" : "your code"}
        finding={sevFilter !== "all" && filtered.length > 0 ? filtered[0] : undefined}
      />

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">By severity</h3>
            {ALL_SEVERITIES.map(s => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn("border rounded px-2 py-0.5 text-[10px] font-mono font-bold w-20 text-center shrink-0", SEV_LABEL[s])}>
                  {s.toUpperCase()}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: findings.length > 0 ? `${(sevCounts[s] / findings.length) * 100}%` : "0%" }}
                    transition={{ duration: 0.6 }}
                    className={cn("h-full rounded-full",
                      s === "critical" ? "bg-red-500" : s === "high" ? "bg-orange-500" :
                      s === "medium" ? "bg-amber-500" : s === "low" ? "bg-blue-500" : "bg-zinc-500",
                    )}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-4 text-right">{sevCounts[s]}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Top recommendations</h3>
            {findings
              .filter(f => f.severity === "critical" || f.severity === "high")
              .slice(0, 4)
              .map(f => (
                <div key={f.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold", SEV_LABEL[f.severity])}>
                      {f.severity.toUpperCase()}
                    </div>
                    <span className="text-xs font-medium">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{f.remediation}</p>
                </div>
              ))
            }
            {findings.filter(f => f.severity === "critical" || f.severity === "high").length === 0 && (
              <p className="text-sm text-muted-foreground">No critical or high findings. ✓</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
