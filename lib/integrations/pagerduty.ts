import type { ScanResult } from "@/types";

export interface PagerDutyConfig {
  routingKey: string;
}

export async function triggerPagerDuty(config: PagerDutyConfig, result: ScanResult): Promise<void> {
  if (result.score.recommendation !== "block") return;

  const payload = {
    routing_key: config.routingKey,
    event_action: "trigger",
    payload: {
      summary: `DeployGuard BLOCK: ${result.summary.critical} critical findings`,
      severity: "critical",
      source: "deployguard",
      custom_details: {
        score: result.score.overall,
        critical: result.summary.critical,
        high: result.summary.high,
        scanId: result.id,
      },
    },
  };

  const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`PagerDuty trigger failed: ${res.statusText}`);
}
