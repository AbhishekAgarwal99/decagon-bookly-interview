import { z } from "zod";
import { findOrderItem, getOrder } from "@/lib/data/orders";
import { saveReturn } from "@/lib/data/returns";
import { asRecord } from "@/lib/agent/types";
import { formatUsd } from "@/lib/format";
import { assessReturnEligibility } from "@/lib/tools/check-return-eligibility";

export const createReturnInput = z.object({
  orderId: z.string().describe("Bookly order number, such as BKL-1042"),
  itemId: z.string().describe("Item id taken from a get_order result"),
  reason: z
    .string()
    .nullable()
    .describe("Why the customer wants the return, or null if they did not say"),
});

export const createReturnTool = {
  name: "create_return",
  description:
    "Create a return for one item on an order. Changes the order. Call only after check_return_eligibility says the item is eligible and the customer has explicitly agreed to create the return.",
  kind: "write" as const,
  requiresConfirmation: true,
  parameters: createReturnInput,
  execute(input: unknown) {
    const { orderId, itemId, reason } = createReturnInput.parse(input);
    const eligibility = assessReturnEligibility(orderId, itemId);

    if (!eligibility.eligible || eligibility.refundAmount == null) {
      return { success: false as const, error: eligibility.reason };
    }

    const order = getOrder(orderId);
    const item = order ? findOrderItem(order, itemId) : undefined;
    if (!order || !item) {
      return { success: false as const, error: eligibility.reason };
    }

    const saved = saveReturn({
      orderId: order.id,
      itemId: item.id,
      reason: reason ?? undefined,
      refundAmount: eligibility.refundAmount,
    });

    if (!saved.created) {
      return {
        success: false as const,
        error: `A return (${saved.record.id}) has already been created for this item.`,
      };
    }

    return {
      success: true as const,
      returnId: saved.record.id,
      refundAmount: saved.record.refundAmount,
      status: saved.record.status,
    };
  },
  summarize(result: unknown): string {
    const record = asRecord(result);
    if (!record) return "Return was not created.";
    if (record.success === true && typeof record.returnId === "string") {
      const amount =
        typeof record.refundAmount === "number" ? ` — ${formatUsd(record.refundAmount)}` : "";
      return `${record.returnId} created${amount}`;
    }
    if (typeof record.error === "string") return record.error;
    return "Return was not created.";
  },
};
