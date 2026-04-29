import { z } from "zod";

export const CreateScanSchema = z.object({
  projectId: z.string().min(1),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  environment: z.enum(["production", "staging", "development"]).default("staging"),
  options: z
    .object({
      enableDynamicTesting: z.boolean().default(false),
      includeDependencyAudit: z.boolean().default(true),
      secretsScanning: z.boolean().default(true),
      customRules: z.array(z.string()).optional(),
    })
    .optional(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  repoUrl: z.string().url().optional(),
  defaultBranch: z.string().default("main"),
});

export const UpdateFindingSchema = z.object({
  falsePositive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const IntegrationConfigSchema = z.object({
  type: z.enum(["github", "gitlab", "bitbucket", "jira", "slack", "pagerduty"]),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()),
});

export type CreateScanInput = z.infer<typeof CreateScanSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateFindingInput = z.infer<typeof UpdateFindingSchema>;
export type IntegrationConfigInput = z.infer<typeof IntegrationConfigSchema>;

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
