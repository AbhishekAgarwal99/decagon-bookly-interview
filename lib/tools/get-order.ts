import { z } from "zod";
import { getOrder, toPublicOrder, type OrderStatus } from "@/lib/data/orders";
import { asRecord } from "@/lib/agent/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  processing: "Processing",
  in_transit: "In transit",
  delivered: "Delivered",
};

export const getOrderInput = z.object({
  orderId: z.string().describe("Bookly order number, such as BKL-1042"),
});

export const getOrderTool = {
  name: "get_order",
  description:
    "Look up one Bookly order by order number. Use for status, delivery, tracking, and the items on the order. Item ids in the result are required before checking or creating a return.",
  kind: "read" as const,
  requiresConfirmation: false,
  parameters: getOrderInput,
  execute(input: unknown) {
    const { orderId } = getOrderInput.parse(input);
    const order = getOrder(orderId);
    if (!order) return { found: false as const };
    return { found: true as const, order: toPublicOrder(order) };
  },
  summarize(result: unknown): string {
    const record = asRecord(result);
    if (!record) return "Order lookup finished.";
    if (record.found === false) return "Order not found";
    const order = asRecord(record.order);
    const status = order?.status;
    if (typeof status === "string" && status in STATUS_LABELS) {
      return `Order found — ${STATUS_LABELS[status as OrderStatus]}`;
    }
    return "Order found";
  },
};
