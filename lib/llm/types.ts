export type LlmProvider = "gemini" | "openai";

export type ConversationMessage = {
  type: "message";
  role: "user" | "assistant";
  content: string;
};

/** One model turn that requested tools, plus the results the loop produced. */
export type ToolRound = {
  type: "tool_round";
  calls: Array<{
    callId: string;
    name: string;
    arguments: string;
    output: string;
  }>;
  /**
   * The provider's own model turn, replayed unchanged so ids and
   * thought signatures stay intact. The orchestrator does not read this.
   */
  replay?: unknown;
};

export type ConversationItem = ConversationMessage | ToolRound;

export type ModelToolCall = {
  callId: string;
  name: string;
  arguments: string;
};

export type ModelStep = {
  text: string;
  toolCalls: ModelToolCall[];
  replay?: unknown;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export class MissingApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

export class ModelRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRequestError";
  }
}
