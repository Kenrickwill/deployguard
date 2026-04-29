"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, ShieldAlert, CheckCircle2,
  AlertTriangle, XCircle, ArrowRight, Clock, GitBranch,
  ScanLine, Plus,
} from "lucide-react";
import { MOCK_RECENT_SCANS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STATS = [
  { label: "Total Scans", value: "147", delta: "+12 this week", trend: "up", icon: ScanLine },
  { label: "Deploy Rate", value: "68%", delta: "-4% vs last week", trend: "down", icon: CheckCircle2 },
  { label: "Avg Score",   value: "74",  delta: "+3 vs last week", trend: "up", icon: TrendingUp },
  { label: "Issues Blocked", value: "34", delta: "critical findings caught", trend: "neutral", icon: ShieldAlert },
];

const REC_CONFIG = {
  deploy: { label: "DEPLOY", icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  review: { label: "REVIEW", icon: AlertTriangle, cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  block:  { label: "BLOCK",  icon: XCircle,      cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-500",
  low:      "bg-blue-500",
  info:     "bg-zinc-500",
};

const FADE_UP = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ label, value, delta, trend, icon: Icon }, i) => (
          <motion.div
            key={label}
            {...FADE_UP}
            transition={{ delay: i * 0.07 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className={cn(
              "text-xs mt-1 flex items-center gap-1",
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground",
            )}>
              {trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trend === "down" && <TrendingDown className="h-3 w-3" />}
              {delta}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Quick score overview */}
      <motion.div {...FADE_UP} transition={{ delay: 0.3 }} className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Scans</h2>
            <Link href="/scans" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-border">
            {MOCK_RECENT_SCANS.map((scan, i) => {
              const rec = REC_CONFIG[scan.recommendation];
              const RecIcon = rec.icon;
              return (
                <motion.div
                  key={scan.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                >
                  <Link
                    href={`/scans/${scan.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/50 transition-colors group"
                  >
                    {/* Score */}
                    <div className={cn(
                      "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 font-mono font-bold text-sm",
                      scan.score >= 80 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400" :
                      scan.score >= 50 ? "border-amber-400/20 bg-amber-400/8 text-amber-400" :
                                         "border-red-400/20 bg-red-400/8 text-red-400",
                    )}>
                      {scan.score}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{scan.project}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />{scan.branch}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{scan.commitSha}</span>
                        <span className="text-xs text-muted-foreground capitalize">{scan.environment}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{scan.duration}
                        </span>
                      </div>
                    </div>

                    {/* Severity dots */}
                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      {Object.entries(scan.findings)
                        .filter(([, v]) => v > 0)
                        .map(([sev, count]) => (
                          <span key={sev} className="flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", SEV_DOT[sev])} />
                            {count}
                          </span>
                        ))}
                    </div>

                    {/* Recommendation */}
                    <div className={cn(
                      "shrink-0 flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-mono font-medium",
                      rec.cls,
                    )}>
                      <RecIcon className="h-3.5 w-3.5" />
                      {rec.label}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* CTA */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold mb-1">Run a scan now</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Paste a repo URL or upload a zip. Get results in under 30 seconds.
            </p>
            <Link
              href="/scans/new"
              className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground text-sm font-medium rounded-md py-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> New Scan
            </Link>
          </div>

          {/* Score distribution */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-4">Score distribution (30d)</p>
            <div className="space-y-2">
              {[
                { label: "80–100 (Deploy)", pct: 42, color: "bg-emerald-500" },
                { label: "50–79 (Review)",  pct: 38, color: "bg-amber-500" },
                { label: "0–49 (Block)",    pct: 20, color: "bg-red-500" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{label}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                      className={cn("h-full rounded-full", color)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent alerts */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-3">Active alerts</p>
            <div className="space-y-3">
              {[
                { sev: "critical", msg: "Hardcoded secret in api-service main", time: "2m ago" },
                { sev: "high",     msg: "SQL injection in api-service:47",       time: "2m ago" },
                { sev: "high",     msg: "IDOR in report endpoint — blocked",     time: "3h ago" },
              ].map(({ sev, msg, time }) => (
                <div key={msg} className="flex items-start gap-2.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", SEV_DOT[sev])} />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-snug">{msg}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
