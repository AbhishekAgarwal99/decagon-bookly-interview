import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent/orchestrator";
import { MissingApiKeyError, ModelRequestError } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "The latest message must be from the customer.",
    }),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a conversation that ends with a customer message." },
      { status: 400 },
    );
  }

  try {
    const result = await runAgent(parsed.data.messages);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MissingApiKeyError || error instanceof ModelRequestError) {
      const status = error instanceof MissingApiKeyError ? 500 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("[bookly] chat request failed", error);

    return NextResponse.json(
      { error: "Bookly support is unavailable right now." },
      { status: 500 },
    );
  }
}
