"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Finding, SeverityLevel } from "@/types";
import { cn } from "@/lib/utils";

interface FindingsListProps {
  findings: Finding[];
}

const severityIcon: Record<SeverityLevel, React.ReactNode> = {
  critical: <ShieldAlert className="h-4 w-4 text-red-600" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  low: <Info className="h-4 w-4 text-blue-400" />,
  info: <Info className="h-4 w-4 text-gray-400" />,
};

const severityBadgeClass: Record<SeverityLevel, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-gray-100 text-gray-700 border-gray-200",
};

function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        {severityIcon[finding.severity]}
        <span className="flex-1 text-sm font-medium truncate">{finding.title}</span>
        <Badge variant="outline" className={cn("text-xs shrink-0", severityBadgeClass[finding.severity])}>
          {finding.severity}
        </Badge>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-10 pb-4 space-y-2">
              <p className="text-sm text-muted-foreground">{finding.description}</p>
              {finding.filePath && (
                <p className="text-xs font-mono text-muted-foreground">
                  {finding.filePath}:{finding.lineNumber}
                </p>
              )}
              {finding.snippet && (
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{finding.snippet}</pre>
              )}
              {finding.remediation && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">Fix: </span>
                  {finding.remediation}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FindingsList({ findings }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <ShieldAlert className="h-8 w-8 opacity-30" />
        <p className="text-sm">No findings detected</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {findings.map((f) => (
          <FindingRow key={f.id} finding={f} />
        ))}
      </div>
    </ScrollArea>
  );
}
