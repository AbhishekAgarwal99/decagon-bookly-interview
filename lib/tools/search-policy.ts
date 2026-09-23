import { z } from "zod";
import { retrievePolicies } from "@/lib/data/policies";
import { asRecord } from "@/lib/agent/types";

export const searchPolicyInput = z.object({
  topic: z
    .string()
    .describe("Policy topic, such as returns, refunds, shipping, or password reset"),
});

export const searchPolicyTool = {
  name: "search_policy",
  description:
    "Look up general Bookly policy by topic, such as returns, refunds, shipping, or password reset. Does not look up a specific customer's order or decide whether their item is eligible.",
  kind: "read" as const,
  requiresConfirmation: false,
  parameters: searchPolicyInput,
  execute(input: unknown) {
    const { topic } = searchPolicyInput.parse(input);
    const matches = retrievePolicies(topic).map((policy) => ({
      topic: policy.topic,
      title: policy.title,
      summary: policy.summary,
      rules: policy.rules,
    }));

    if (matches.length === 0) {
      return {
        found: false as const,
        results: [],
        note: "No Bookly policy matched that topic.",
      };
    }

    return { found: true as const, results: matches };
  },
  summarize(result: unknown): string {
    const record = asRecord(result);
    if (!record || record.found === false) return "No matching policy";
    const results = Array.isArray(record.results) ? record.results : [];
    const titles = results
      .map((entry) => asRecord(entry)?.title)
      .filter((title): title is string => typeof title === "string");
    return titles.length > 0 ? `Policy — ${titles.join(", ")}` : "Policy found";
  },
};
