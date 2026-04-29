"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Globe, Clock, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TESTS = [
  { id: "dyn_01HZQK", target: "https://staging.example.com", score: 75, vulnerable: 3, passed: 1, duration: "4m 12s", auth: "Bearer", status: "review" as const, ago: "10 min ago" },
  { id: "dyn_01HZPK", target: "https://staging.web.app",      score: 95, vulnerable: 0, passed: 8, duration: "3m 44s", auth: "Cookie", status: "deploy" as const, ago: "2 hours ago" },
  { id: "dyn_01HZNJ", target: "https://sandbox.api.dev",      score: 40, vulnerable: 5, passed: 3, duration: "5m 20s", auth: "None",   status: "block" as const,  ago: "Yesterday" },
];

const REC = {
  deploy: { Icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  review: { Icon: AlertTriangle, cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  block:  { Icon: AlertTriangle, cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};

export default function DynamicPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Link
          href="/dynamic/new"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Dynamic Test
        </Link>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Dynamic tests probe a <strong className="text-foreground">live URL</strong> for runtime vulnerabilities — XSS, IDOR, rate limiting, auth bypass, and more.
          Always target staging or sandbox environments.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">All dynamic tests</h2>
          <span className="text-xs text-muted-foreground">{TESTS.length} results</span>
        </div>
        <div className="divide-y divide-border">
          {TESTS.map((test, i) => {
            const rec = REC[test.status];
            const RecIcon = rec.Icon;
            return (
              <motion.div key={test.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                <Link
                  href={`/dynamic/${test.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 font-mono font-bold text-sm",
                    test.score >= 80 ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400" :
                    test.score >= 50 ? "border-amber-400/20 bg-amber-400/8 text-amber-400" :
                                       "border-red-400/20 bg-red-400/8 text-red-400",
                  )}>
                    {test.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-foreground truncate flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />{test.target}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="text-red-400 font-medium">{test.vulnerable} vuln</span>
                      <span className="text-emerald-400">{test.passed} passed</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{test.duration}</span>
                      <span>{test.ago}</span>
                    </div>
                  </div>
                  <span className="hidden md:block text-xs text-muted-foreground">{test.auth} auth</span>
                  <div className={cn("shrink-0 flex items-center gap-1.5 border rounded-md px-2.5 py-1 text-xs font-mono font-medium", rec.cls)}>
                    <RecIcon className="h-3.5 w-3.5" />{test.status.toUpperCase()}
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
