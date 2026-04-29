"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus, GitBranch, Clock, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { MOCK_RECENT_SCANS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const REC_CONFIG = {
  deploy: { label: "DEPLOY", Icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  review: { label: "REVIEW", Icon: AlertTriangle, cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  block:  { label: "BLOCK",  Icon: XCircle,      cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", info: "bg-zinc-500",
};

export default function ScansPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Link
          href="/scans/new"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Scan
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">All scans</h2>
          <span className="text-xs text-muted-foreground">{MOCK_RECENT_SCANS.length} results</span>
        </div>
        <div className="divide-y divide-border">
          {MOCK_RECENT_SCANS.map((scan, i) => {
            const rec = REC_CONFIG[scan.recommendation];
            const RecIcon = rec.Icon;
            return (
              <motion.div key={scan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <Link
                  href={`/scans/${scan.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 font-mono font-bold text-sm",
                    scan.score >= 80 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400" :
                    scan.score >= 50 ? "border-amber-400/20 bg-amber-400/8 text-amber-400" :
                                       "border-red-400/20 bg-red-400/8 text-red-400",
                  )}>
                    {scan.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{scan.project}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />{scan.branch}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">{scan.commitSha}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{scan.environment}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{scan.duration}</span>
                      <span>{scan.createdAt}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    {Object.entries(scan.findings).filter(([,v]) => v > 0).map(([sev, count]) => (
                      <span key={sev} className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", SEV_DOT[sev])} />{count}
                      </span>
                    ))}
                  </div>
                  <div className={cn("shrink-0 flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-mono font-medium", rec.cls)}>
                    <RecIcon className="h-3.5 w-3.5" />{rec.label}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
