import type { ChatMessage } from "@/lib/agent/types";

export type ConfirmationDecision =
  | { allowed: true }
  | { allowed: false; traceSummary: string; modelMessage: string };

/**
 * Write gate. Judged only from messages the customer has already sent.
 * A tool call made in the current turn cannot confirm itself.
 *
 * create_return is allowed when the latest customer message is a short
 * agreement and the previous assistant message asked to create the return.
 * escalate_to_human is allowed when the customer asked for a person, or
 * agreed after the assistant offered a specialist.
 */
export function evaluateWriteConfirmation(
  toolName: string,
  messages: ChatMessage[],
): ConfirmationDecision {
  const lastUserIndex = findLastIndex(messages, (message) => message.role === "user");
  const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;
  const previousAssistant = lastUser
    ? [...messages.slice(0, lastUserIndex)].reverse().find((message) => message.role === "assistant")
    : undefined;

  if (toolName === "escalate_to_human") {
    if (lastUser && userAskedForHuman(lastUser.content)) return { allowed: true };
    if (
      lastUser &&
      previousAssistant &&
      isAffirmative(lastUser.content) &&
      messageOffersEscalation(previousAssistant.content)
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      traceSummary: "Awaiting customer confirmation",
      modelMessage:
        "Escalation was not submitted. Ask the customer if they want a specialist, unless they already asked for a person.",
    };
  }

  if (toolName !== "create_return") return { allowed: true };

  const confirmed =
    Boolean(lastUser) &&
    Boolean(previousAssistant) &&
    isAffirmative(lastUser?.content ?? "") &&
    messageRequestsReturnConfirmation(previousAssistant?.content ?? "");

  if (confirmed) return { allowed: true };

  return {
    allowed: false,
    traceSummary: "Awaiting customer confirmation",
    modelMessage:
      "The return was not created. Ask whether you should create the return, then wait for an explicit yes. Do not say the return succeeded.",
  };
}

export function messageRequestsReturnConfirmation(text: string): boolean {
  const normalized = text.toLowerCase();
  if (!normalized.includes("return")) return false;
  return /would you like me to|shall i|should i|do you want me to|can i create|go ahead and create|create the return\?/.test(
    normalized,
  );
}

function messageOffersEscalation(text: string): boolean {
  const normalized = text.toLowerCase();
  const mentionsHelp = /specialist|human|representative|escalate/.test(normalized);
  const asks = /would you like|shall i|should i|do you want/.test(normalized);
  return mentionsHelp && asks;
}

function userAskedForHuman(text: string): boolean {
  return /\b(human|representative|specialist)\b|\breal person\b|\btalk to (a )?(person|someone|an agent)\b/i.test(
    text,
  );
}

function isAffirmative(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!\s]+$/g, "")
    .replace(/\s+/g, " ");

  if (!normalized || normalized.includes("?")) return false;

  return /^(yes|yeah|yep|yup|sure|ok|okay|please|confirm|confirmed|go ahead)(?:[, ]+(and|please|do it|create it|create the return|go ahead|that works|sounds good|thanks|thank you|thing))*$/.test(
    normalized,
  );
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}
