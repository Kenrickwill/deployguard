"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronRight,
  ChevronDown, Download, Globe, Clock, Shield,
  FlaskConical,
} from "lucide-react";
import { loadDynamicTest } from "@/lib/dynamic-session";
import { MOCK_DYNAMIC_FINDINGS, MOCK_SCAN_RESULT } from "@/lib/mock-data";
import type { DynamicTestEntry, DynamicTestSession } from "@/types";
import { cn } from "@/lib/utils";
import { AgentPanel } from "@/components/agent/AgentPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

const SEV_CLS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/25",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/25",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/25",
  low:      "text-blue-400 bg-blue-400/10 border-blue-400/25",
  info:     "text-zinc-400 bg-zinc-400/10 border-zinc-400/25",
};

// ── FindingRow ────────────────────────────────────────────────────────────────

function FindingRow({ finding }: { finding: DynamicTestEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border-b border-border last:border-0", open && "bg-accent/30")}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/40 transition-colors"
      >
        {open
          ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

        {finding.vulnerable
          ? <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
          : <CheckCircle2  className="h-4 w-4 text-emerald-400 shrink-0" />}

        <span className="font-mono text-xs text-muted-foreground shrink-0 w-16">{finding.testType.split(" ")[0]}</span>
        <span className="text-sm text-foreground flex-1 truncate">{finding.testType}</span>

        <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />{finding.responseTime}
        </span>

        {finding.vulnerable ? (
          <div className={cn("border rounded px-2 py-0.5 text-[10px] font-mono font-bold shrink-0", SEV_CLS[finding.severity])}>
            {finding.severity.toUpperCase()}
          </div>
        ) : (
          <div className="border border-emerald-400/25 bg-emerald-400/8 text-emerald-400 rounded px-2 py-0.5 text-[10px] font-mono font-bold shrink-0">
            PASS
          </div>
        )}
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
              <p className="text-sm text-muted-foreground leading-relaxed">{finding.details}</p>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Evidence / payload</p>
                <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {finding.payload}
                </pre>
              </div>

              {finding.vulnerable && finding.remediation && (
                <div className="border border-amber-400/20 bg-amber-400/5 rounded-lg p-3.5">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Remediation</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{finding.remediation}</p>
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

export default function DynamicResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [session,  setSession]  = useState<DynamicTestSession | null>(null);
  const [isDemo,   setIsDemo]   = useState(false);

  useEffect(() => {
    const stored = loadDynamicTest(id);
    if (stored) {
      setSession(stored);
    } else {
      // Fall back to a synthetic demo session built from mock data
      const demoSession: DynamicTestSession = {
        id,
        targetUrl:      "https://staging.example.com",
        authorizedBy:   "Demo",
        runAt:          new Date().toISOString(),
        responseTimeMs: 1234,
        entries:        MOCK_DYNAMIC_FINDINGS,
        findings:       [],
      };
      setSession(demoSession);
      setIsDemo(true);
    }
  }, [id]);

  if (!session) return null;

  const entries   = session.entries;
  const vulnerable = entries.filter(e => e.vulnerable);
  const passed     = entries.filter(e => !e.vulnerable);
  const score      = entries.length > 0 ? Math.round((passed.length / entries.length) * 100) : 100;

  const recCls =
    vulnerable.some(e => e.severity === "critical") ? "border-red-400/25 bg-red-400/5 glow-red text-red-400"     :
    vulnerable.length > 0                           ? "border-amber-400/25 bg-amber-400/5 glow-amber text-amber-400" :
    "border-emerald-400/25 bg-emerald-400/5 glow-green text-emerald-400";

  const recLabel =
    vulnerable.some(e => e.severity === "critical") ? "BLOCK"  :
    vulnerable.length > 0                           ? "REVIEW" :
    "DEPLOY";

  const RecIcon =
    vulnerable.some(e => e.severity === "critical") ? XCircle       :
    vulnerable.length > 0                           ? AlertTriangle :
    CheckCircle2;

  const isSandbox = session.targetUrl.includes("/api/dynamic/sandbox");

  function exportResults() {
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `dynamic-test-${session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">

      {/* Demo / sandbox banners */}
      {isDemo && (
        <div className="flex items-center gap-2 border border-blue-400/25 bg-blue-400/5 rounded-lg px-4 py-2.5 text-xs text-blue-400">
          <Shield className="h-4 w-4 shrink-0" />
          Showing demo data — run a real dynamic test to see live results.
        </div>
      )}
      {!isDemo && isSandbox && (
        <div className="flex items-center gap-2 border border-purple-400/25 bg-purple-400/5 rounded-lg px-4 py-2.5 text-xs text-purple-400">
          <FlaskConical className="h-4 w-4 shrink-0" />
          Sandbox mode — findings reflect the built-in test target&apos;s intentional misconfigurations.
        </div>
      )}

      {/* Score header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border p-5 flex flex-col md:flex-row md:items-center gap-5", recCls)}
      >
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-6xl font-bold tabular-nums">{score}</p>
            <p className="text-xs opacity-60 mt-0.5 font-mono">/ 100</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold mb-1">
              <RecIcon className="h-5 w-5" /> {recLabel}
            </div>
            <p className="text-xs opacity-70">
              {vulnerable.length} issue{vulnerable.length !== 1 ? "s" : ""} · {passed.length} passed
            </p>
          </div>
        </div>

        <div className="w-px h-16 bg-current opacity-20 hidden md:block" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 text-current">
          {[
            { label: "Probes run",    value: entries.length.toString() },
            { label: "Vulnerable",    value: vulnerable.length.toString() },
            { label: "Passed",        value: passed.length.toString() },
            { label: "Response time", value: `${(session.responseTimeMs / 1000).toFixed(1)}s` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-medium opacity-60 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-mono font-medium">{value}</p>
            </div>
          ))}
        </div>

        <button
          onClick={exportResults}
          className="shrink-0 flex items-center gap-1.5 border border-current/30 bg-current/10 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-current/20 transition-colors opacity-80 hover:opacity-100"
        >
          <Download className="h-3.5 w-3.5" /> Export JSON
        </button>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Vulnerable",   count: vulnerable.length,  icon: XCircle,      cls: "text-red-400" },
          { label: "Passed",       count: passed.length,      icon: CheckCircle2, cls: "text-emerald-400" },
          { label: "Total probes", count: entries.length,     icon: Shield,       cls: "text-primary" },
        ].map(({ label, count, icon: Icon, cls }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={cn("h-4 w-4", cls)} />
            </div>
            <p className="text-3xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {/* Target info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Globe className="h-4 w-4 shrink-0" />
        <span className="font-mono truncate max-w-xs">{session.targetUrl}</span>
        <span className="text-border">·</span>
        <span>{entries.length} probes</span>
        <span className="text-border">·</span>
        <span>Authorized by {session.authorizedBy}</span>
        <span className="text-border">·</span>
        <span>{new Date(session.runAt).toLocaleString()}</span>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Probe results</h2>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-red-400">
              <XCircle className="h-3.5 w-3.5" />{vulnerable.length} failed
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />{passed.length} passed
            </div>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No probe results to display.</div>
        ) : (
          entries.map(e => <FindingRow key={e.id} finding={e} />)
        )}
      </div>

      {/* Agent panel */}
      <AgentPanel scan={MOCK_SCAN_RESULT} targetName={session.targetUrl} />
    </div>
  );
}
