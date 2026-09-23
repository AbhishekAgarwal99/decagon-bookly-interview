import { createGeminiStep } from "@/lib/llm/gemini";
import { createOpenAiStep } from "@/lib/llm/openai";
import type { ConversationItem, LlmProvider, ModelStep, ToolDefinition } from "@/lib/llm/types";
import { MissingApiKeyError, ModelRequestError } from "@/lib/llm/types";

export { MissingApiKeyError, ModelRequestError } from "@/lib/llm/types";
export type { ConversationItem, ModelStep, ModelToolCall } from "@/lib/llm/types";

/**
 * Gemini when GEMINI_API_KEY is set, otherwise OpenAI.
 * LLM_PROVIDER=gemini or LLM_PROVIDER=openai overrides that.
 */
export function resolveProvider(): LlmProvider | null {
  const requested = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (requested === "gemini" || requested === "openai") return requested;
  if (requested) {
    throw new ModelRequestError("LLM_PROVIDER must be gemini or openai.");
  }
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export async function createModelStep(params: {
  instructions: string;
  input: ConversationItem[];
  tools: ToolDefinition[];
}): Promise<ModelStep> {
  const provider = resolveProvider();
  if (!provider) {
    throw new MissingApiKeyError(
      "No model key is set. Add GEMINI_API_KEY or OPENAI_API_KEY to .env.local and restart the dev server.",
    );
  }
  if (provider === "gemini") return createGeminiStep(params);
  return createOpenAiStep(params);
}
