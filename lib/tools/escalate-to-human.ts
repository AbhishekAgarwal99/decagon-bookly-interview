import { z } from "zod";
import { asRecord } from "@/lib/agent/types";

export const escalateToHumanInput = z.object({
  reason: z.string().describe("Short reason this needs a person"),
  summary: z.string().describe("What the specialist should know about the conversation"),
});

type EscalationStore = {
  nextNumber: number;
};

const globalForEscalations = globalThis as typeof globalThis & {
  __booklyEscalations?: EscalationStore;
};

function nextEscalationId(): string {
  if (!globalForEscalations.__booklyEscalations) {
    globalForEscalations.__booklyEscalations = { nextNumber: 4401 };
  }
  const current = globalForEscalations.__booklyEscalations;
  const id = `ESC-${current.nextNumber}`;
  current.nextNumber += 1;
  return id;
}

export const escalateToHumanTool = {
  name: "escalate_to_human",
  description:
    "Hand the conversation to a human Bookly specialist. Use when the customer asks for a person or the other tools cannot safely resolve the issue.",
  kind: "write" as const,
  requiresConfirmation: true,
  parameters: escalateToHumanInput,
  execute(input: unknown) {
    escalateToHumanInput.parse(input);
    return {
      success: true as const,
      escalationId: nextEscalationId(),
    };
  },
  summarize(result: unknown): string {
    const record = asRecord(result);
    if (record?.success === true && typeof record.escalationId === "string") {
      return `${record.escalationId} created`;
    }
    return "Escalation was not submitted.";
  },
};
