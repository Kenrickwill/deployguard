import type { ScanResult } from "@/types";

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

export async function notifySlack(config: SlackConfig, result: ScanResult): Promise<void> {
  const color = { deploy: "#36a64f", review: "#f4a62a", block: "#d00000" }[
    result.score.recommendation
  ];

  const payload = {
    channel: config.channel,
    attachments: [
      {
        color,
        title: `DeployGuard: ${result.score.recommendation.toUpperCase()}`,
        fields: [
          { title: "Score", value: `${result.score.overall}/100`, short: true },
          { title: "Critical", value: String(result.summary.critical), short: true },
          { title: "High", value: String(result.summary.high), short: true },
          { title: "Total Findings", value: String(result.summary.total), short: true },
        ],
        footer: "DeployGuard",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Slack notification failed: ${res.statusText}`);
}
