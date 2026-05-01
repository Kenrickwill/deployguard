/**
 * Thin HTTP client for the DeployGuard API.
 * Uses Node 18+ native fetch — no extra dependencies.
 */

import type { ScanResult, DynamicSession } from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  url: string,
  options: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) msg = body.error;
    } catch { /* use status only */ }
    throw new ApiError(msg, res.status);
  }

  const body = await res.json() as { data?: T; error?: string };
  if (body.error) throw new ApiError(body.error, res.status);
  return body.data as T;
}

// ── Scan ──────────────────────────────────────────────────────────────────────

export interface ScanPayload {
  snippet?:    string;
  filePath?:   string;
  files?:      Array<{ path: string; content: string }>;
  projectId?:  string;
  triggerSource?: string;
  commitSha?:  string;
  branch?:     string;
  reportFormat?: "json" | "markdown" | "html" | "csv";
}

export interface ScanApiResponse {
  scan:      ScanResult;
  report?:   string;
  dbScanId?: string;
}

export async function apiScan(
  apiUrl:  string,
  token:   string | undefined,
  payload: ScanPayload,
): Promise<ScanApiResponse> {
  return request<ScanApiResponse>(`${apiUrl}/api/scan/analyze`, {
    method: "POST",
    body:   JSON.stringify(payload),
    token,
  });
}

// ── Dynamic test ──────────────────────────────────────────────────────────────

export interface DynamicPayload {
  targetUrl:    string;
  authorizedBy: string;
  acknowledgments: {
    hasAuthority:        true;
    isNotProduction:     true;
    understandsReadOnly: true;
  };
  authType?:    string;
  credentials?: { token?: string; username?: string; password?: string; cookie?: string };
  timeoutMs?:   number;
}

export async function apiDynamic(
  apiUrl:  string,
  token:   string | undefined,
  payload: DynamicPayload,
): Promise<DynamicSession> {
  return request<DynamicSession>(`${apiUrl}/api/dynamic/run`, {
    method: "POST",
    body:   JSON.stringify(payload),
    token,
  });
}

// ── Token management ──────────────────────────────────────────────────────────

export async function apiCreateToken(
  apiUrl: string,
  name:   string,
  env:    "live" | "test",
): Promise<{ id: string; rawKey: string; prefix: string }> {
  return request(`${apiUrl}/api/tokens`, {
    method: "POST",
    body:   JSON.stringify({ name, env, scopes: ["scan:write", "report:read"] }),
  });
}
