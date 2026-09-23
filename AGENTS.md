<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bookly support agent

## Project goal

This is a prototype Bookly customer-support AI agent.

The important behaviors are:

- multi-turn conversation
- explicit tool calling
- tool-grounded customer information
- clarification rather than guessing
- explicit confirmation for state-changing actions

## Architectural rules

1. Use one conversational agent.
2. Do not create specialized sub-agents.
3. LLM handles reasoning and conversation.
4. Tools provide authoritative business data.
5. Read operations can execute automatically.
6. Write operations require explicit user confirmation.
7. Keep orchestration visible and understandable.
8. Mock business systems cleanly behind tool interfaces.
9. Do not introduce infrastructure that isn't required for the demo.
10. Prefer readable TypeScript over clever abstractions.

Do not add LangGraph, CrewAI, AutoGen, or another agent framework. The loop in `lib/agent/orchestrator.ts` is the agent.

Do not add a database, authentication, or a vector store. Policy lookup stays a replaceable function over the small corpus in `lib/data/policies.ts`.

Provider clients stay in `lib/llm`. The orchestrator calls `lib/llm/index.ts` and does not import a vendor SDK. Gemini is selected when `GEMINI_API_KEY` is set. OpenAI remains available with `OPENAI_API_KEY` or `LLM_PROVIDER=openai`.

## Tool rules

Never fabricate a tool result.

If required parameters are missing, ask the user.

Never infer an order ID.

Never infer which item a customer wants returned if multiple items could apply.

Never claim a return was created unless `create_return` returned success.

State-changing actions must be explicitly confirmed. The confirmation check lives in `lib/agent/confirmation.ts` and runs before a write tool executes. Do not rely only on the system prompt.

Business rules for returns live in `lib/tools/check-return-eligibility.ts`, not in the system prompt.
