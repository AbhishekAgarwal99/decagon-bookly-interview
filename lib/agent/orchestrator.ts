import { evaluateWriteConfirmation, messageRequestsReturnConfirmation } from "@/lib/agent/confirmation";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { findTool, parseToolArguments, toolDefinitions } from "@/lib/agent/tool-registry";
import type { AgentResult, ChatMessage, TraceEvent } from "@/lib/agent/types";
import { asRecord } from "@/lib/agent/types";
import { createModelStep, type ConversationItem, type ModelToolCall } from "@/lib/llm";

const MAX_MODEL_TURNS = 6;

/**
 * Single conversational agent.
 *
 * The model owns the next step: reply, or request a tool.
 * This loop validates the request, blocks unconfirmed writes, runs the
 * tool, and returns the tool result. It does not plan on the model's behalf
 * and it does not delegate to other agents.
 *
 * Confirmation uses the customer messages from before this turn. A write
 * requested in the same turn as a lookup is refused.
 */
export async function runAgent(messages: ChatMessage[]): Promise<AgentResult> {
  const trace: TraceEvent[] = [];
  const input: ConversationItem[] = messages.map((message) => ({
    type: "message",
    role: message.role,
    content: message.content,
  }));

  for (let turn = 0; turn < MAX_MODEL_TURNS; turn += 1) {
    const step = await createModelStep({
      instructions: SYSTEM_PROMPT,
      input,
      tools: toolDefinitions(),
    });

    if (step.toolCalls.length === 0) {
      const message = step.text.trim() || fallbackMessage();
      noteConversationOutcome(trace, message);
      return { message, trace };
    }

    const calls: Array<{
      callId: string;
      name: string;
      arguments: string;
      output: string;
    }> = [];
    for (const call of step.toolCalls) {
      const outcome = await executeRequestedTool(call, messages);
      trace.push(...outcome.events);
      calls.push({
        callId: call.callId,
        name: call.name,
        arguments: call.arguments,
        output: JSON.stringify(outcome.output),
      });
    }

    input.push({ type: "tool_round", calls, replay: step.replay });
  }

  trace.push(
    traceEvent({
      title: "Status",
      kind: "status",
      state: "error",
      summary: "Stopped after the maximum number of model turns.",
    }),
  );

  return { message: fallbackMessage(), trace };
}

async function executeRequestedTool(
  call: ModelToolCall,
  messages: ChatMessage[],
): Promise<{ output: unknown; events: TraceEvent[] }> {
  const tool = findTool(call.name);

  if (!tool) {
    const output = { error: `Unknown tool "${call.name}".` };
    return {
      output,
      events: [
        traceEvent({
          title: call.name,
          kind: "status",
          state: "error",
          summary: output.error,
        }),
      ],
    };
  }

  const parsed = parseToolArguments(tool, call.arguments);
  if (!parsed.ok) {
    return {
      output: { error: parsed.error },
      events: [
        traceEvent({
          title: tool.name,
          kind: tool.kind,
          state: "error",
          summary: parsed.error,
          arguments: parsed.raw,
        }),
      ],
    };
  }

  if (tool.requiresConfirmation) {
    const decision = evaluateWriteConfirmation(tool.name, messages);
    if (!decision.allowed) {
      return {
        output: {
          success: false,
          blocked: true,
          error: decision.modelMessage,
        },
        events: [
          traceEvent({
            title: tool.name,
            kind: "write",
            state: "blocked",
            summary: decision.traceSummary,
            arguments: parsed.value,
          }),
        ],
      };
    }
  }

  try {
    const output = await tool.execute(parsed.value);
    return {
      output,
      events: [
        traceEvent({
          title: tool.name,
          kind: tool.kind,
          state: resultState(output),
          summary: tool.summarize(output),
          arguments: parsed.value,
        }),
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed.";
    return {
      output: { error: message },
      events: [
        traceEvent({
          title: tool.name,
          kind: tool.kind,
          state: "error",
          summary: message,
          arguments: parsed.value,
        }),
      ],
    };
  }
}

function noteConversationOutcome(trace: TraceEvent[], message: string): void {
  const waitingOnReturn = messageRequestsReturnConfirmation(message);
  const alreadyBlocked = trace.some((event) => event.state === "blocked");

  if (waitingOnReturn && !alreadyBlocked) {
    trace.push(
      traceEvent({
        title: "Status",
        kind: "status",
        state: "info",
        summary: "Awaiting customer confirmation",
      }),
    );
    return;
  }

  if (trace.length === 0) {
    trace.push(
      traceEvent({
        title: "Status",
        kind: "status",
        state: "info",
        summary: "Replied without calling a tool.",
      }),
    );
  }
}

function resultState(output: unknown): TraceEvent["state"] {
  const record = asRecord(output);
  if (!record) return "success";
  if (record.found === false || record.eligible === false || record.success === false) {
    return "info";
  }
  return "success";
}

function traceEvent(event: Omit<TraceEvent, "id">): TraceEvent {
  return { id: crypto.randomUUID(), ...event };
}

function fallbackMessage(): string {
  return "I wasn't able to finish that. I can connect you with a Bookly specialist if you'd like.";
}
