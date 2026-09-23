import OpenAI from "openai";
import type { ConversationItem, ModelStep, ToolDefinition } from "@/lib/llm/types";
import { MissingApiKeyError, ModelRequestError } from "@/lib/llm/types";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export async function createOpenAiStep(params: {
  instructions: string;
  input: ConversationItem[];
  tools: ToolDefinition[];
}): Promise<ModelStep> {
  try {
    const response = await getClient().responses.create({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      instructions: params.instructions,
      input: toInput(params.input),
      tools: params.tools.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true,
      })),
      tool_choice: "auto",
      store: false,
    });

    const toolCalls = response.output.flatMap((item) => {
      if (item.type !== "function_call") return [];
      return [{ callId: item.call_id, name: item.name, arguments: item.arguments }];
    });

    return {
      text: response.output_text ?? "",
      toolCalls,
      replay: response.output,
    };
  } catch (error) {
    if (error instanceof MissingApiKeyError) throw error;
    console.error("[bookly] openai request failed", error);
    const message =
      error instanceof OpenAI.APIError
        ? "The OpenAI request failed. Check OPENAI_API_KEY and OPENAI_MODEL."
        : "The OpenAI request failed. Check OPENAI_API_KEY and OPENAI_MODEL.";
    throw new ModelRequestError(message);
  }
}

function toInput(items: ConversationItem[]): OpenAI.Responses.ResponseInput {
  const input: OpenAI.Responses.ResponseInputItem[] = [];

  for (const item of items) {
    if (item.type === "message") {
      input.push({ role: item.role, content: item.content });
      continue;
    }

    if (Array.isArray(item.replay)) {
      input.push(...(item.replay as OpenAI.Responses.ResponseInputItem[]));
    } else {
      for (const call of item.calls) {
        input.push({
          type: "function_call",
          call_id: call.callId,
          name: call.name,
          arguments: call.arguments,
        });
      }
    }

    for (const call of item.calls) {
      input.push({
        type: "function_call_output",
        call_id: call.callId,
        output: call.output,
      });
    }
  }

  return input;
}
