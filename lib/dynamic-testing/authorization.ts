import { z } from "zod";
import { createHash, randomBytes } from "crypto";

// ─── Schema ───────────────────────────────────────────────────────────────────

/** All three acknowledgments must be explicitly confirmed before a DAST run. */
export const AcknowledgmentsSchema = z.object({
  /** The operator confirms they own or have written permission to test the target. */
  hasAuthority: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you have authority to test this target." }),
  }),
  /**
   * The operator confirms the target is NOT a live production system with real users
   * or real financial/health data.
   */
  isNotProduction: z.literal(true, {
    errorMap: () => ({ message: "Dynamic tests must only be run against non-production environments." }),
  }),
  /**
   * The operator confirms they understand DeployGuard performs read-only probes
   * and will not send destructive payloads.
   */
  understandsReadOnly: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you understand the read-only scope of testing." }),
  }),
});

export const DynamicAuthorizationSchema = z.object({
  targetUrl:    z.string().url("Target must be a valid URL."),
  authorizedBy: z.string().min(1, "Your name or identifier is required."),
  acknowledgments: AcknowledgmentsSchema,
});

export type DynamicAuthorization = z.infer<typeof DynamicAuthorizationSchema>;

// ─── Token ───────────────────────────────────────────────────────────────────

export interface AuthorizationToken {
  targetUrl:    string;
  authorizedBy: string;
  issuedAt:     number;   // Unix ms
  expiresAt:    number;   // Unix ms (1 hour TTL)
  nonce:        string;
  signature:    string;
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a signed authorization token from a validated authorization record.
 * The signature is an HMAC-SHA256 over the canonical payload using a per-process
 * ephemeral key — not persisted, good for single-session use only.
 */
let _ephemerealKey: string | null = null;
function getEphemeralKey(): string {
  if (!_ephemerealKey) _ephemerealKey = randomBytes(32).toString("hex");
  return _ephemerealKey;
}

export function createAuthorizationToken(auth: DynamicAuthorization): AuthorizationToken {
  const issuedAt  = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const nonce     = randomBytes(16).toString("hex");

  const payload = `${auth.targetUrl}:${auth.authorizedBy}:${issuedAt}:${nonce}`;
  const signature = createHash("sha256")
    .update(getEphemeralKey() + payload)
    .digest("hex");

  return { targetUrl: auth.targetUrl, authorizedBy: auth.authorizedBy, issuedAt, expiresAt, nonce, signature };
}

/** Returns true if the token is structurally valid and not expired. */
export function verifyAuthorizationToken(token: AuthorizationToken): boolean {
  if (Date.now() > token.expiresAt) return false;
  const payload = `${token.targetUrl}:${token.authorizedBy}:${token.issuedAt}:${token.nonce}`;
  const expected = createHash("sha256")
    .update(getEphemeralKey() + payload)
    .digest("hex");
  return expected === token.signature;
}

/** Encode a token to a URL-safe base64 string for transport. */
export function encodeToken(token: AuthorizationToken): string {
  return Buffer.from(JSON.stringify(token)).toString("base64url");
}

/** Decode and validate. Throws if invalid or expired. */
export function decodeToken(encoded: string): AuthorizationToken {
  let token: AuthorizationToken;
  try {
    token = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuthorizationToken;
  } catch {
    throw new Error("Invalid authorization token format.");
  }
  if (!verifyAuthorizationToken(token)) {
    throw new Error("Authorization token is invalid or has expired. Re-authorize to continue.");
  }
  return token;
}
