export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type TraceKind = "read" | "write" | "status";

export type TraceState = "success" | "error" | "blocked" | "info";

/** Application-level activity. This never includes hidden model reasoning. */
export type TraceEvent = {
  id: string;
  title: string;
  kind: TraceKind;
  state: TraceState;
  summary: string;
  arguments?: unknown;
};

export type AgentResult = {
  message: string;
  trace: TraceEvent[];
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}
