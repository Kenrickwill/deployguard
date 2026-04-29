import { MockProvider } from "./provider";
import { dispatchAction } from "./actions";
import type { AgentProvider, AgentRequest, AgentResponse } from "./types";

export type { AgentRequest, AgentResponse, AgentMessage, AgentAction, AgentProvider } from "./types";
export { MockProvider } from "./provider";

// ─── Agent Factory ────────────────────────────────────────────────────────────

/**
 * Returns the active provider. During development this is the MockProvider.
 * Swap for AnthropicProvider (or any AgentProvider) without changing callers.
 */
function getProvider(): AgentProvider {
  // To use a real LLM: import { AnthropicProvider } from "./provider" and return new AnthropicProvider()
  return new MockProvider();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single agent action and return a typed response.
 * This is the only entry point — all guardrails are applied automatically.
 */
export async function runAgentAction(req: AgentRequest): Promise<AgentResponse> {
  const provider = getProvider();

  try {
    const result = await dispatchAction(req, provider);
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error: {
        code:    "provider_error",
        message: err instanceof Error ? err.message : "Unknown agent error",
      },
    };
  }
}
