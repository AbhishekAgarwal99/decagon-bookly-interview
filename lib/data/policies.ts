export type PolicyArticle = {
  topic: string;
  title: string;
  summary: string;
  rules: string[];
  aliases: string[];
};

/**
 * Small, explicit policy corpus.
 * `retrievePolicies` is the only function the tool calls, so a later
 * retrieval implementation can replace the body without changing the agent.
 */
const policies: PolicyArticle[] = [
  {
    topic: "returns",
    title: "Returns",
    summary:
      "Most books can be returned within 30 days of delivery. Eligibility is checked per item before a return is created.",
    rules: [
      "The return window is 30 days from the delivery date, including the deadline day.",
      "An order must be delivered before a return can start.",
      "An item that has already been refunded cannot be returned again.",
      "If an order has more than one item, the return is for one specific item.",
    ],
    aliases: ["return", "send back", "book back"],
  },
  {
    topic: "refunds",
    title: "Refunds",
    summary:
      "A refund covers the price paid for the returned item. Bookly does not refund the same item twice.",
    rules: [
      "The refund amount is the item price confirmed when the return is created.",
      "Refunds are issued to the original payment method.",
      "A refund is recorded only after a return is successfully created.",
    ],
    aliases: ["refund", "money back"],
  },
  {
    topic: "shipping",
    title: "Shipping",
    summary:
      "Tracking and a carrier are available once an order has shipped. The order record is the source of truth for a specific delivery.",
    rules: [
      "Processing orders have not shipped yet and do not have tracking.",
      "In-transit orders include a carrier, tracking number, and expected delivery date.",
      "A delivered order includes the delivery date.",
    ],
    aliases: ["shipping", "delivery", "tracking", "shipment"],
  },
  {
    topic: "password reset",
    title: "Password reset",
    summary:
      "Bookly support cannot reset a password from this chat. Customers reset it from the sign-in page.",
    rules: [
      "Use Forgot password on the Bookly sign-in page.",
      "This assistant cannot see or change account passwords.",
      "If the customer is still locked out, offer to escalate to a specialist.",
    ],
    aliases: ["password", "log in", "login", "sign in", "locked out"],
  },
];

export function retrievePolicies(query: string): PolicyArticle[] {
  const haystack = query.trim().toLowerCase();
  if (!haystack) return [];

  const scored = policies
    .map((policy) => ({ policy, score: scorePolicy(policy, haystack) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map((entry) => entry.policy);
}

function scorePolicy(policy: PolicyArticle, query: string): number {
  if (query === policy.topic) return 10;

  let score = 0;
  if (query.includes(policy.topic)) score += 4;
  for (const alias of policy.aliases) {
    if (query.includes(alias)) score += 3;
  }
  return score;
}
