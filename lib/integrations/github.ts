import type { ScanResult } from "@/types";
import { generateReport } from "@/lib/reporting";

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}

export async function createGitHubComment(config: GitHubConfig, result: ScanResult): Promise<void> {
  const body = generateReport(result, { format: "markdown", includeRemediation: true });

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${config.prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ body }),
    },
  );

  if (!res.ok) throw new Error(`GitHub comment failed: ${res.statusText}`);
}

export async function updateCommitStatus(
  config: GitHubConfig & { commitSha: string },
  result: ScanResult,
): Promise<void> {
  const stateMap = { deploy: "success", review: "pending", block: "failure" } as const;

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/statuses/${config.commitSha}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        state: stateMap[result.score.recommendation],
        description: `DeployGuard score: ${result.score.overall}/100`,
        context: "deployguard/scan",
      }),
    },
  );

  if (!res.ok) throw new Error(`GitHub status update failed: ${res.statusText}`);
}
