import type Anthropic from "@anthropic-ai/sdk";
import { recipeTask } from "./prompt";
import { ProviderError, type LlmProvider, type LlmTask } from "./types";

export const CLAUDE_MODEL = "claude-haiku-5-5";
export const CLAUDE_MAX_TOKENS = 1500;
export const CLAUDE_TOOL = "tarif_taslagi";

/** The only part of the SDK we use; tests pass a fake. */
export type MessagesClient = Pick<Anthropic, "messages">;


function failure(e: unknown, signal: AbortSignal): ProviderError {
  if (signal.aborted) return new ProviderError("timeout");
  const err = e as { status?: number; name?: string; error?: { error?: { type?: string } } };
  const reason = err?.error?.error?.type ?? err?.name;
  if (err?.status === 429 || err?.status === 529) return new ProviderError("quota", err.status, reason);
  if (err?.name === "APIConnectionTimeoutError" || err?.name === "AbortError" || err?.name === "TimeoutError") return new ProviderError("timeout", err.status, reason);
  return new ProviderError("error", err?.status, reason);
}

/** Claude Haiku with forced tool use; returns the tool input (validated by the caller). */
export function claudeProvider(client: MessagesClient): LlmProvider {
  async function run(task: LlmTask, signal: AbortSignal): Promise<unknown> {
    let msg: Anthropic.Message;
    try {
      msg = await client.messages.create(
        {
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: task.system,
          tools: [{ name: task.tool.name, description: task.tool.description, input_schema: task.schema } as Anthropic.Tool],
          tool_choice: { type: "tool", name: task.tool.name, disable_parallel_tool_use: true },
          messages: [{ role: "user", content: task.user }],
        },
        { signal, maxRetries: 0 },
      );
    } catch (e) {
      throw failure(e, signal);
    }
    const block = msg.content.find((b) => b.type === "tool_use" && b.name === task.tool.name);
    if (!block || block.type !== "tool_use") throw new ProviderError("invalid", 200, msg.stop_reason ?? "NO_TOOL_USE");
    return block.input;
  }
  return {
    name: "claude",
    call: (input, { signal, retry }) => run(recipeTask(input, retry), signal),
    run: (task, { signal }) => run(task, signal),
  };
}
