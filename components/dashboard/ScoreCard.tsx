"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DeployScore } from "@/types";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score: DeployScore;
}

const recommendationConfig = {
  deploy: { label: "Ready to Deploy", className: "bg-green-100 text-green-800 border-green-200" },
  review: { label: "Needs Review", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  block: { label: "Blocked", className: "bg-red-100 text-red-800 border-red-200" },
};

export function ScoreCard({ score }: ScoreCardProps) {
  const config = recommendationConfig[score.recommendation];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Deploy Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold tabular-nums"
          >
            {score.overall}
            <span className="text-2xl text-muted-foreground font-normal">/100</span>
          </motion.div>
          <Badge variant="outline" className={cn("text-xs", config.className)}>
            {config.label}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["security", "performance", "reliability", "compliance"] as const).map((key) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="capitalize">{key}</span>
                <span>{score[key]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score[key]}%` }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className={cn(
                    "h-full rounded-full",
                    score[key] >= 75
                      ? "bg-green-500"
                      : score[key] >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500",
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
