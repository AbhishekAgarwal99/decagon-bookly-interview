export type OrderStatus = "processing" | "in_transit" | "delivered";

export type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  customerName: string;
  status: OrderStatus;
  orderedAt: string;
  expectedDelivery?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  carrier?: string;
  items: OrderItem[];
  /** Internal bookkeeping. Not returned by get_order. */
  refundedItemIds: string[];
};

export type PublicOrder = Omit<Order, "refundedItemIds">;

export function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return isoDateFromToday(0);
}

const orders: Order[] = [
  {
    id: "BKL-1042",
    customerName: "Maya Chen",
    status: "delivered",
    orderedAt: isoDateFromToday(-9),
    deliveredAt: isoDateFromToday(-4),
    trackingNumber: "9400111899223347891234",
    carrier: "USPS",
    refundedItemIds: [],
    items: [
      { id: "itm_1042_dune", title: "Dune", quantity: 1, price: 18.99 },
      {
        id: "itm_1042_hail",
        title: "Project Hail Mary",
        quantity: 1,
        price: 16.99,
      },
    ],
  },
  {
    id: "BKL-1043",
    customerName: "Jordan Lee",
    status: "in_transit",
    orderedAt: isoDateFromToday(-2),
    expectedDelivery: isoDateFromToday(3),
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    refundedItemIds: [],
    items: [{ id: "itm_1043_piranesi", title: "Piranesi", quantity: 1, price: 16.5 }],
  },
  {
    id: "BKL-1044",
    customerName: "Sam Okonkwo",
    status: "delivered",
    orderedAt: isoDateFromToday(-50),
    deliveredAt: isoDateFromToday(-45),
    trackingNumber: "9400111899223347000444",
    carrier: "USPS",
    refundedItemIds: [],
    items: [
      {
        id: "itm_1044_left_hand",
        title: "The Left Hand of Darkness",
        quantity: 1,
        price: 15.99,
      },
    ],
  },
  {
    id: "BKL-1045",
    customerName: "Priya Shah",
    status: "delivered",
    orderedAt: isoDateFromToday(-12),
    deliveredAt: isoDateFromToday(-8),
    trackingNumber: "9400111899223347000555",
    carrier: "USPS",
    refundedItemIds: ["itm_1045_circe"],
    items: [
      { id: "itm_1045_circe", title: "Circe", quantity: 1, price: 14.99 },
      {
        id: "itm_1045_vanishing",
        title: "The Vanishing Half",
        quantity: 1,
        price: 16.99,
      },
    ],
  },
  {
    id: "BKL-1046",
    customerName: "Alex Rivera",
    status: "processing",
    orderedAt: isoDateFromToday(-1),
    expectedDelivery: isoDateFromToday(6),
    refundedItemIds: [],
    items: [
      {
        id: "itm_1046_tomorrow",
        title: "Tomorrow, and Tomorrow, and Tomorrow",
        quantity: 1,
        price: 17.99,
      },
    ],
  },
];

export function normalizeOrderId(orderId: string): string {
  return orderId.trim().toUpperCase();
}

export function getOrder(orderId: string): Order | undefined {
  const key = normalizeOrderId(orderId);
  return orders.find((order) => order.id === key);
}

export function findOrderItem(order: Order, itemId: string): OrderItem | undefined {
  const key = itemId.trim().toLowerCase();
  return order.items.find((item) => item.id.toLowerCase() === key);
}

export function toPublicOrder(order: Order): PublicOrder {
  return {
    id: order.id,
    customerName: order.customerName,
    status: order.status,
    orderedAt: order.orderedAt,
    ...(order.expectedDelivery ? { expectedDelivery: order.expectedDelivery } : {}),
    ...(order.deliveredAt ? { deliveredAt: order.deliveredAt } : {}),
    ...(order.trackingNumber ? { trackingNumber: order.trackingNumber } : {}),
    ...(order.carrier ? { carrier: order.carrier } : {}),
    items: order.items,
  };
}

export function lineAmount(price: number, quantity: number): number {
  return Math.round(price * quantity * 100) / 100;
}
