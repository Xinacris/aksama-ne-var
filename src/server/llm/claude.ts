import type Anthropic from "@anthropic-ai/sdk";
import { RECIPE_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "./prompt";
import { ProviderError, type LlmProvider } from "./types";

export const CLAUDE_MODEL = "claude-haiku-5-5";
export const CLAUDE_MAX_TOKENS = 1500;
export const CLAUDE_TOOL = "tarif_taslagi";

/** The only part of the SDK we use; tests pass a fake. */
export type MessagesClient = Pick<Anthropic, "messages">;

const TOOL = {
  name: CLAUDE_TOOL,
  description: "Metinden çıkarılan tarif taslağını kaydeder.",
  input_schema: RECIPE_JSON_SCHEMA,
} as Anthropic.Tool;

function failure(e: unknown, signal: AbortSignal): ProviderError {
  if (signal.aborted) return new ProviderError("timeout");
  const err = e as { status?: number; name?: string };
  if (err?.status === 429 || err?.status === 529) return new ProviderError("quota");
  if (err?.name === "APIConnectionTimeoutError" || err?.name === "AbortError" || err?.name === "TimeoutError") return new ProviderError("timeout");
  return new ProviderError("error");
}

/** Claude Haiku with forced tool use; returns the tool input (validated by the caller). */
export function claudeProvider(client: MessagesClient): LlmProvider {
  return {
    name: "claude",
    async call(input, { signal, retry }) {
      let msg: Anthropic.Message;
      try {
        msg = await client.messages.create(
          {
            model: CLAUDE_MODEL,
            max_tokens: CLAUDE_MAX_TOKENS,
            system: SYSTEM_PROMPT,
            tools: [TOOL],
            tool_choice: { type: "tool", name: CLAUDE_TOOL, disable_parallel_tool_use: true },
            messages: [{ role: "user", content: userPrompt(input, retry) }],
          },
          { signal, maxRetries: 0 },
        );
      } catch (e) {
        throw failure(e, signal);
      }
      const block = msg.content.find((b) => b.type === "tool_use" && b.name === CLAUDE_TOOL);
      if (!block || block.type !== "tool_use") throw new ProviderError("invalid");
      return block.input;
    },
  };
}
