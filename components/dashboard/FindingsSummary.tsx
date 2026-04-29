"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanSummary } from "@/types";

interface FindingsSummaryProps {
  summary: ScanSummary;
}

const severityConfig = [
  { key: "critical", label: "Critical", color: "bg-red-600" },
  { key: "high", label: "High", color: "bg-orange-500" },
  { key: "medium", label: "Medium", color: "bg-yellow-500" },
  { key: "low", label: "Low", color: "bg-blue-400" },
  { key: "info", label: "Info", color: "bg-gray-400" },
] as const;

export function FindingsSummary({ summary }: FindingsSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Findings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{summary.total}</p>
        <p className="text-xs text-muted-foreground mb-4">total findings</p>
        <div className="space-y-2">
          {severityConfig.map(({ key, label, color }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="flex-1 text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{summary[key]}</span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
