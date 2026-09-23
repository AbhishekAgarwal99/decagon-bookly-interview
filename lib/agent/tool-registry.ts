import { z } from "zod";
import type { ToolDefinition } from "@/lib/llm/types";
import { checkReturnEligibilityTool } from "@/lib/tools/check-return-eligibility";
import { createReturnTool } from "@/lib/tools/create-return";
import { escalateToHumanTool } from "@/lib/tools/escalate-to-human";
import { getOrderTool } from "@/lib/tools/get-order";
import { searchPolicyTool } from "@/lib/tools/search-policy";

const tools = [
  getOrderTool,
  searchPolicyTool,
  checkReturnEligibilityTool,
  createReturnTool,
  escalateToHumanTool,
];

export type AgentTool = (typeof tools)[number];

export function listTools(): AgentTool[] {
  return tools;
}

export function findTool(name: string): AgentTool | undefined {
  return tools.find((tool) => tool.name === name);
}

/** Same registry the orchestrator executes. Each provider turns this into its tool schema. */
export function toolDefinitions(): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toFunctionParameters(tool.parameters),
  }));
}

export function parseToolArguments(
  tool: AgentTool,
  rawArguments: string,
): { ok: true; value: unknown } | { ok: false; error: string; raw?: unknown } {
  let json: unknown;
  try {
    json = JSON.parse(rawArguments);
  } catch {
    return { ok: false, error: "Tool arguments were not valid JSON.", raw: rawArguments };
  }

  const parsed = tool.parameters.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join(" ");
    return { ok: false, error: `Invalid arguments. ${detail}`, raw: json };
  }

  return { ok: true, value: parsed.data };
}

function toFunctionParameters(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
