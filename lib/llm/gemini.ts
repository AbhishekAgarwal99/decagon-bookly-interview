import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import type { ConversationItem, ModelStep, ToolDefinition } from "@/lib/llm/types";
import { MissingApiKeyError, ModelRequestError } from "@/lib/llm/types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.",
    );
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export async function createGeminiStep(params: {
  instructions: string;
  input: ConversationItem[];
  tools: ToolDefinition[];
}): Promise<ModelStep> {
  try {
    const response = await getClient().models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
      contents: toContents(params.input),
      config: {
        systemInstruction: params.instructions,
        // The orchestrator executes tools so the write gate cannot be skipped.
        automaticFunctionCalling: { disable: true },
        tools: [
          {
            functionDeclarations: params.tools.map(toDeclaration),
          },
        ],
      },
    });

    const functionCalls = response.functionCalls ?? [];
    const toolCalls = functionCalls.flatMap((call, index) => {
      if (!call.name) return [];
      return [
        {
          callId: call.id ?? `call-${index + 1}`,
          name: call.name,
          arguments: JSON.stringify(call.args ?? {}),
        },
      ];
    });

    let text = "";
    if (toolCalls.length === 0) {
      try {
        text = response.text ?? "";
      } catch {
        text = "";
      }
    }

    return {
      text,
      toolCalls,
      replay: response.candidates?.[0]?.content,
    };
  } catch (error) {
    if (error instanceof MissingApiKeyError) throw error;
    console.error("[bookly] gemini request failed", error);
    throw new ModelRequestError(explainGeminiError(error));
  }
}

function toContents(items: ConversationItem[]): Content[] {
  const contents: Content[] = [];
  let seenUser = false;

  for (const item of items) {
    if (item.type === "message") {
      if (!seenUser && item.role === "assistant") continue;
      seenUser = true;
      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      });
      continue;
    }

    seenUser = true;
    if (isContent(item.replay)) {
      contents.push(item.replay);
    } else {
      contents.push({
        role: "model",
        parts: item.calls.map((call) => ({
          functionCall: {
            name: call.name,
            id: call.callId,
            args: parseObject(call.arguments),
          },
        })),
      });
    }

    contents.push({
      role: "user",
      parts: item.calls.map((call) => ({
        functionResponse: {
          name: call.name,
          id: call.callId,
          response: responseObject(call.output),
        },
      })),
    });
  }

  return contents;
}

function toDeclaration(tool: ToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: geminiParameters(tool.parameters),
  };
}

function geminiParameters(schema: Record<string, unknown>): Record<string, unknown> {
  return normalizeSchema(schema) as Record<string, unknown>;
}

function normalizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSchema);
  if (!value || typeof value !== "object") return value;

  const record = { ...(value as Record<string, unknown>) };
  delete record.$schema;
  delete record.additionalProperties;

  if (Array.isArray(record.type)) {
    const types = record.type.filter((entry) => entry !== "null");
    if (types.length === 1 && record.type.includes("null")) {
      record.type = types[0];
      record.nullable = true;
    }
  }

  if (record.properties && typeof record.properties === "object") {
    record.properties = Object.fromEntries(
      Object.entries(record.properties as Record<string, unknown>).map(([key, child]) => [
        key,
        normalizeSchema(child),
      ]),
    );
  }

  return record;
}

function responseObject(output: string): Record<string, unknown> {
  const parsed = parseUnknown(output);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return { result: parsed ?? output };
}

function parseObject(raw: string): Record<string, unknown> {
  const parsed = parseUnknown(raw);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function parseUnknown(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isContent(value: unknown): value is Content {
  if (!value || typeof value !== "object") return false;
  return "parts" in value;
}

function explainGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/api key|API_KEY|permission denied|unauth/i.test(message)) {
    return "The Gemini request was rejected. Check GEMINI_API_KEY.";
  }
  if (/not found|invalid model|404/i.test(message)) {
    return "The Gemini model request failed. Check GEMINI_MODEL.";
  }
  return "The Gemini request failed. Check GEMINI_API_KEY and GEMINI_MODEL.";
}
