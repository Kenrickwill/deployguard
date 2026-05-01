/**
 * API key validation helper.
 *
 * Called from route handlers AFTER middleware has confirmed the key format.
 * Performs the database lookup and scope check.
 *
 * Usage:
 *   const auth = await validateApiKey(request, "scan:write");
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
 *   // auth.token  — the ApiToken record
 *   // auth.userId — owner user id (if personal token)
 */

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/db/client";
import type { ApiToken } from "@prisma/client";

export type ValidateResult =
  | { ok: true;  token: ApiToken | null; userId: string | null }
  | { ok: false; error: string };

/**
 * Hash a raw API key the same way we store it.
 * Using SHA-256 — fast, deterministic, one-way.
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Generate a new API key.
 * Returns { prefix, rawKey, keyHash } — store keyHash, show rawKey once.
 */
export function generateApiKey(env: "live" | "test" = "live"): {
  prefix: string;
  rawKey: string;
  keyHash: string;
} {
  const rand = Array.from(
    { length: 16 },
    () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"),
  ).join("");

  const prefix = `dg_${env}_`;
  const rawKey = `${prefix}${rand}`;
  const keyHash = hashApiKey(rawKey);

  return { prefix, rawKey, keyHash };
}

/**
 * Validate an API key from a route request.
 * The key must have been injected by middleware via the `x-dg-api-key` header.
 *
 * @param request - The incoming NextRequest
 * @param requiredScope - Optional scope to check (e.g. "scan:write")
 */
export async function validateApiKey(
  request: NextRequest,
  requiredScope?: string,
): Promise<ValidateResult> {
  const rawKey = request.headers.get("x-dg-api-key");

  // In development with no key present, allow through so the UI still works.
  if (!rawKey) {
    if (process.env.NODE_ENV === "development") {
      return { ok: true, token: null, userId: null };
    }
    return { ok: false, error: "Missing API key." };
  }

  const keyHash = hashApiKey(rawKey);

  let token: ApiToken | null;
  try {
    token = await prisma.apiToken.findUnique({ where: { keyHash } });
  } catch {
    // DB not connected yet — allow through in development
    if (process.env.NODE_ENV === "development") {
      return { ok: true, token: null, userId: null };
    }
    return { ok: false, error: "Authentication service unavailable." };
  }

  if (!token)          return { ok: false, error: "Invalid API key." };
  if (token.revokedAt) return { ok: false, error: "API key has been revoked." };
  if (token.expiresAt && token.expiresAt < new Date()) {
    return { ok: false, error: "API key has expired." };
  }

  if (requiredScope && !token.scopes.includes(requiredScope) && !token.scopes.includes("*")) {
    return { ok: false, error: `Token missing required scope: ${requiredScope}` };
  }

  // Fire-and-forget: update lastUsedAt without blocking the response
  void prisma.apiToken.update({
    where: { id: token.id },
    data:  { lastUsedAt: new Date() },
  }).catch(() => { /* non-critical */ });

  return { ok: true, token, userId: token.userId };
}
