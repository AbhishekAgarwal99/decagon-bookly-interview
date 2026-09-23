import { z } from "zod";
import {
  addIsoDays,
  findOrderItem,
  getOrder,
  lineAmount,
  todayIsoDate,
} from "@/lib/data/orders";
import { findReturn } from "@/lib/data/returns";
import { asRecord } from "@/lib/agent/types";
import { formatUsd } from "@/lib/format";

export const RETURN_WINDOW_DAYS = 30;

export const checkReturnEligibilityInput = z.object({
  orderId: z.string().describe("Bookly order number, such as BKL-1042"),
  itemId: z.string().describe("Item id taken from a get_order result"),
});

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  refundAmount?: number;
  returnDeadline?: string;
};

/**
 * Return eligibility is decided here, in Bookly's rules, not by the model.
 * A book can be returned within 30 days of delivery.
 * An item that already has a refund or an open return cannot be returned.
 * An order that has not been delivered cannot be returned.
 */
export function assessReturnEligibility(orderId: string, itemId: string): EligibilityResult {
  const order = getOrder(orderId);
  if (!order) {
    return { eligible: false, reason: "No order was found for that order number." };
  }

  const item = findOrderItem(order, itemId);
  if (!item) {
    return { eligible: false, reason: "That item is not on this order." };
  }

  const existingReturn = findReturn(order.id, item.id);
  if (existingReturn) {
    return {
      eligible: false,
      reason: `A return (${existingReturn.id}) has already been created for this item.`,
    };
  }

  if (order.refundedItemIds.some((id) => id.toLowerCase() === item.id.toLowerCase())) {
    return { eligible: false, reason: "This item has already been refunded." };
  }

  if (order.status !== "delivered" || !order.deliveredAt) {
    return {
      eligible: false,
      reason: "Books can be returned only after the order has been delivered.",
    };
  }

  const returnDeadline = addIsoDays(order.deliveredAt, RETURN_WINDOW_DAYS);
  if (todayIsoDate() > returnDeadline) {
    return {
      eligible: false,
      reason: `The 30-day return window closed on ${returnDeadline}.`,
      returnDeadline,
    };
  }

  return {
    eligible: true,
    reason: "This book is within the 30-day return window.",
    refundAmount: lineAmount(item.price, item.quantity),
    returnDeadline,
  };
}

export const checkReturnEligibilityTool = {
  name: "check_return_eligibility",
  description:
    "Check whether one item on an order can be returned right now. Returns eligibility, the reason, and — when eligible — the refund amount and deadline. Does not create a return. Requires an order id and an item id from get_order.",
  kind: "read" as const,
  requiresConfirmation: false,
  parameters: checkReturnEligibilityInput,
  execute(input: unknown): EligibilityResult {
    const { orderId, itemId } = checkReturnEligibilityInput.parse(input);
    return assessReturnEligibility(orderId, itemId);
  },
  summarize(result: unknown): string {
    const record = asRecord(result);
    if (!record) return "Eligibility check finished.";
    if (record.eligible === true && typeof record.refundAmount === "number") {
      return `Eligible — ${formatUsd(record.refundAmount)}`;
    }
    if (typeof record.reason === "string") return `Not eligible — ${record.reason}`;
    return "Not eligible";
  },
};
