"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, ChevronRight,
  ChevronDown, Download, Globe, Clock, Shield,
} from "lucide-react";
import { MOCK_DYNAMIC_FINDINGS, MOCK_SCAN_RESULT } from "@/lib/mock-data";
import type { DynamicTestEntry } from "@/types";
import { cn } from "@/lib/utils";
import { AgentPanel } from "@/components/agent/AgentPanel";

const SEV_CLS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/25",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/25",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/25",
  low:      "text-blue-400 bg-blue-400/10 border-blue-400/25",
  info:     "text-zinc-400 bg-zinc-400/10 border-zinc-400/25",
};

const STATS = [
  { label: "Endpoints tested",    value: "23" },
  { label: "Tests run",           value: "184" },
  { label: "Vulnerabilities",     value: "3" },
  { label: "Duration",            value: "4m 12s" },
];

function FindingRow({ finding }: { finding: DynamicTestEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("border-b border-border last:border-0", open && "bg-accent/30")}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-accent/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

        {/* Verdict icon */}
        {finding.vulnerable
          ? <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
          : <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}

        {/* Endpoint */}
        <span className="font-mono text-sm text-foreground flex-1 truncate">{finding.endpoint}</span>

        {/* Test type */}
        <span className="hidden md:block text-xs text-muted-foreground shrink-0">{finding.testType}</span>

        {/* Response time */}
        <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />{finding.responseTime}
        </span>

        {/* Severity / status */}
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
                <p className="text-xs font-semibold text-muted-foreground">Probe payload</p>
                <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {finding.payload}
                </pre>
              </div>

              {finding.vulnerable && (
                <div className="border border-amber-400/20 bg-amber-400/5 rounded-lg p-3.5">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Recommended fix</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {finding.testType === "Brute Force"
                      ? "Implement rate limiting (e.g., @upstash/ratelimit). Allow ≤10 attempts/min per IP."
                      : finding.testType === "Reflected XSS"
                      ? "Sanitize error messages before returning them. Ensure no user input appears unescaped in responses."
                      : "Verify authorization on every resource access. Check ownership, not just authentication."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DynamicResultsPage() {
  const vulnerable = MOCK_DYNAMIC_FINDINGS.filter(f => f.vulnerable);
  const passed     = MOCK_DYNAMIC_FINDINGS.filter(f => !f.vulnerable);
  const score      = Math.round((passed.length / MOCK_DYNAMIC_FINDINGS.length) * 100);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-5 flex flex-col md:flex-row md:items-center gap-5 glow-amber"
      >
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-6xl font-bold text-amber-400 tabular-nums">{score}</p>
            <p className="text-xs text-amber-400/60 mt-0.5 font-mono">/ 100</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400 mb-1">
              <AlertTriangle className="h-5 w-5" /> REVIEW
            </div>
            <p className="text-xs text-amber-400/70">{vulnerable.length} vulnerabilities · {passed.length} passed</p>
          </div>
        </div>

        <div className="w-px h-16 bg-amber-400/20 hidden md:block" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          {STATS.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-medium text-amber-400/60 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-sm font-mono font-medium text-amber-300">{value}</p>
            </div>
          ))}
        </div>

        <button className="shrink-0 flex items-center gap-1.5 border border-amber-400/30 bg-amber-400/10 text-amber-400 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-amber-400/20 transition-colors">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Vulnerable",  count: vulnerable.length,               icon: XCircle,      cls: "text-red-400" },
          { label: "Passed",      count: passed.length,                   icon: CheckCircle2, cls: "text-emerald-400" },
          { label: "Total tests", count: MOCK_DYNAMIC_FINDINGS.length,    icon: Shield,       cls: "text-primary" },
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4" />
        <span className="font-mono">https://staging.example.com</span>
        <span className="text-border">·</span>
        <span>5 test types</span>
        <span className="text-border">·</span>
        <span>Bearer auth</span>
      </div>

      {/* Findings table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Test results</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" />{vulnerable.length} vulnerable
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />{passed.length} passed
            </div>
          </div>
        </div>
        {MOCK_DYNAMIC_FINDINGS.map(f => <FindingRow key={f.id} finding={f} />)}
      </div>

      {/* Agent Panel */}
      <AgentPanel
        scan={MOCK_SCAN_RESULT}
        targetName="staging.example.com"
      />
    </div>
  );
}
