import type { Finding } from "@/types";

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export async function createJiraTicket(config: JiraConfig, finding: Finding): Promise<string> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  const body = {
    fields: {
      project: { key: config.projectKey },
      summary: `[DeployGuard] ${finding.title}`,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: finding.description }],
          },
        ],
      },
      issuetype: { name: "Bug" },
      priority: {
        name:
          finding.severity === "critical"
            ? "Highest"
            : finding.severity === "high"
              ? "High"
              : finding.severity === "medium"
                ? "Medium"
                : "Low",
      },
    },
  };

  const res = await fetch(`https://${config.host}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Jira ticket creation failed: ${res.statusText}`);
  const data = await res.json();
  return data.key as string;
}
