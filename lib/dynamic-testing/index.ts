export {
  AcknowledgmentsSchema,
  DynamicAuthorizationSchema,
  createAuthorizationToken,
  verifyAuthorizationToken,
  encodeToken,
  decodeToken,
} from "./authorization";
export type { DynamicAuthorization, AuthorizationToken } from "./authorization";

export { runProbes } from "./probes";
export type { ProbeResult, ProbeContext, ProbeRunOptions, ProbeRunResult } from "./probes";

import { DynamicAuthorizationSchema } from "./authorization";
import { createAuthorizationToken, encodeToken, decodeToken } from "./authorization";
import { runProbes } from "./probes";
import type { ProbeRunOptions, ProbeRunResult } from "./probes";

export interface DynamicTestInput {
  targetUrl:    string;
  authorizedBy: string;
  acknowledgments: {
    hasAuthority:        true;
    isNotProduction:     true;
    understandsReadOnly: true;
  };
}

export interface DynamicTestResult extends ProbeRunResult {
  token:        string;
  authorizedBy: string;
}

/**
 * Full dynamic test flow: validate authorization, issue a token, run probes.
 * This is the primary entry point — callers should use this rather than calling
 * authorization and probes separately.
 */
export async function runDynamicTest(
  input: DynamicTestInput,
  options: ProbeRunOptions = {},
): Promise<DynamicTestResult> {
  const parsed = DynamicAuthorizationSchema.parse(input);
  const token = createAuthorizationToken(parsed);
  const encoded = encodeToken(token);

  // Verify immediately to catch clock issues before making network requests
  decodeToken(encoded);

  const probeResult = await runProbes(parsed.targetUrl, options);

  return {
    ...probeResult,
    token: encoded,
    authorizedBy: parsed.authorizedBy,
  };
}
