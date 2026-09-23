export type ReturnRecord = {
  id: string;
  orderId: string;
  itemId: string;
  reason?: string;
  refundAmount: number;
  status: "created";
  createdAt: string;
};

type ReturnStore = {
  records: ReturnRecord[];
  nextNumber: number;
};

const globalForReturns = globalThis as typeof globalThis & {
  __booklyReturns?: ReturnStore;
};

/**
 * Process memory for the running demo.
 * globalThis survives Next.js dev reloads so a return created in one
 * request is still visible to the next. A serverless deploy starts empty.
 */
function store(): ReturnStore {
  if (!globalForReturns.__booklyReturns) {
    globalForReturns.__booklyReturns = { records: [], nextNumber: 8817 };
  }
  return globalForReturns.__booklyReturns;
}

export function findReturn(orderId: string, itemId: string): ReturnRecord | undefined {
  const orderKey = orderId.trim().toUpperCase();
  const itemKey = itemId.trim().toLowerCase();
  return store().records.find(
    (record) => record.orderId === orderKey && record.itemId.toLowerCase() === itemKey,
  );
}

export function saveReturn(input: {
  orderId: string;
  itemId: string;
  reason?: string;
  refundAmount: number;
}): { record: ReturnRecord; created: boolean } {
  const existing = findReturn(input.orderId, input.itemId);
  if (existing) return { record: existing, created: false };

  const current = store();
  const record: ReturnRecord = {
    id: `RET-${current.nextNumber}`,
    orderId: input.orderId.trim().toUpperCase(),
    itemId: input.itemId,
    ...(input.reason ? { reason: input.reason } : {}),
    refundAmount: input.refundAmount,
    status: "created",
    createdAt: new Date().toISOString(),
  };
  current.nextNumber += 1;
  current.records.push(record);
  return { record, created: true };
}

export function resetReturnStore(): void {
  globalForReturns.__booklyReturns = { records: [], nextNumber: 8817 };
}
