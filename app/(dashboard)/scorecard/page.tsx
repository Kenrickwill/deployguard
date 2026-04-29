"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown,
  Shield, Zap, Activity, FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROJECTS = [
  { name: "api-service",    score: 61, trend: -4, scans: 23, rec: "review" as const },
  { name: "web-app",        score: 84, trend: +9, scans: 31, rec: "deploy" as const },
  { name: "worker-service", score: 95, trend: +2, scans: 12, rec: "deploy" as const },
  { name: "admin-panel",    score: 38, trend: -12,scans: 8,  rec: "block" as const },
];

const DIMENSIONS = [
  { key: "Security",    score: 58, prev: 62, icon: Shield,    desc: "Secrets, injection, auth" },
  { key: "Performance", score: 74, prev: 71, icon: Zap,       desc: "N+1, blocking ops, memory" },
  { key: "Reliability", score: 82, prev: 80, icon: Activity,  desc: "Error handling, retries" },
  { key: "Compliance",  score: 67, prev: 67, icon: FileCheck, desc: "OWASP Top 10, SOC 2" },
];

const HISTORY = [72, 68, 75, 71, 63, 66, 70, 74, 68, 61, 65, 70, 74, 78, 73];

const REC_CFG = {
  deploy: { Icon: CheckCircle2, cls: "text-emerald-400 border-emerald-400/25 bg-emerald-400/8" },
  review: { Icon: AlertTriangle, cls: "text-amber-400 border-amber-400/25 bg-amber-400/8" },
  block:  { Icon: XCircle,      cls: "text-red-400 border-red-400/25 bg-red-400/8" },
};

function ScoreDial({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size / 2) * 0.78;
  const circumference = 2 * Math.PI * r;
  const startAngle = -225;
  const arcSpan = 270;
  const progress = (score / 100) * arcSpan;
  const dashOffset = circumference - (progress / 360) * circumference;

  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[225deg]">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={8}
          stroke="oklch(0.21 0.02 258)"
          strokeDasharray={`${(270 / 360) * circumference} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={8}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={`${(270 / 360) * circumference} ${circumference}`}
          initial={{ strokeDashoffset: (270 / 360) * circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-4xl font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.p>
        <p className="text-xs text-muted-foreground font-mono">/ 100</p>
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const overallScore = Math.round(PROJECTS.reduce((a, p) => a + p.score, 0) / PROJECTS.length);
  const maxHist = Math.max(...HISTORY);

  return (
    <div className="space-y-6">
      {/* Top: overall score + trend */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid md:grid-cols-3 gap-4"
      >
        {/* Score dial card */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-4">
          <p className="text-xs text-muted-foreground font-medium">Overall Score</p>
          <ScoreDial score={overallScore} size={160} />
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Review Required
          </div>
        </div>

        {/* Trend chart */}
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold">Score trend (15 days)</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-400">−11 pts</span> vs 15d ago
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {HISTORY.map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(h / maxHist) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.04 }}
                className={cn(
                  "flex-1 rounded-sm",
                  i === HISTORY.length - 1 ? "opacity-100" : "opacity-60",
                  h >= 80 ? "bg-emerald-500" : h >= 50 ? "bg-amber-500" : "bg-red-500",
                )}
                title={`Day ${i + 1}: ${h}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
            <span>15 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </motion.div>

      {/* Dimension breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {DIMENSIONS.map(({ key, score, prev, icon: Icon, desc }, i) => {
          const delta = score - prev;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold">{key}</p>
                </div>
                <span className={cn(
                  "flex items-center gap-0.5 text-[11px] font-mono",
                  delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground",
                )}>
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {delta !== 0 ? `${delta > 0 ? "+" : ""}${delta}` : "—"}
                </span>
              </div>

              <p className="text-3xl font-bold tabular-nums mb-1">{score}</p>
              <p className="text-[11px] text-muted-foreground mb-3">{desc}</p>

              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.07 }}
                  className={cn(
                    "h-full rounded-full",
                    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500",
                  )}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Per-project breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">By project</h2>
        </div>
        <div className="divide-y divide-border">
          {PROJECTS.map(({ name, score, trend, scans, rec }, i) => {
            const cfg = REC_CFG[rec];
            const CfgIcon = cfg.Icon;
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.06 }}
                className="flex items-center gap-4 px-5 py-4"
              >
                {/* Project name */}
                <p className="font-mono text-sm font-medium flex-1">{name}</p>

                {/* Score bar */}
                <div className="hidden md:flex items-center gap-3 w-48">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.7, delay: 0.3 + i * 0.06 }}
                      className={cn("h-full rounded-full", score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500")}
                    />
                  </div>
                  <span className="text-sm font-mono font-bold w-6 text-right">{score}</span>
                </div>

                {/* Trend */}
                <span className={cn(
                  "hidden md:flex items-center gap-1 text-xs font-mono w-12 justify-end",
                  trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-muted-foreground",
                )}>
                  {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend)}
                </span>

                {/* Scans */}
                <span className="text-xs text-muted-foreground w-16 text-right">{scans} scans</span>

                {/* Recommendation */}
                <div className={cn("flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-mono font-medium", cfg.cls)}>
                  <CfgIcon className="h-3.5 w-3.5" />
                  {rec.toUpperCase()}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Top recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-semibold mb-4">Priority improvements</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { priority: "01", title: "Fix hardcoded secrets", impact: "+18 pts", project: "api-service", cls: "text-red-400" },
            { priority: "02", title: "Resolve SQL injection",  impact: "+11 pts", project: "api-service", cls: "text-orange-400" },
            { priority: "03", title: "Add rate limiting",      impact: "+7 pts",  project: "admin-panel", cls: "text-amber-400" },
          ].map(({ priority, title, impact, project, cls }) => (
            <div key={priority} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-3xl font-bold text-border">{priority}</span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">{impact}</span>
              </div>
              <p className={cn("text-sm font-semibold mb-1", cls)}>{title}</p>
              <p className="text-xs text-muted-foreground font-mono">{project}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
