# Bookly support agent

A small customer-support agent for Bookly, a fictional online bookstore.

The model owns the conversation. Bookly's tools own orders, policy, return eligibility, and returns. The model never invents an order status, a refund, or a successful return.

This is an interview prototype: one conversational agent, typed tools, and an explicit tool loop. There is no agent framework, database, or authentication.

## Run it

Node.js 20.9 or newer is required.

```bash
cp .env.example .env.local
# Add GEMINI_API_KEY, or OPENAI_API_KEY, to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

A `GEMINI_API_KEY` selects Gemini (`gemini-3.8-flash` unless `GEMINI_MODEL` is set). An `OPENAI_API_KEY` is used when no Gemini key is set. `LLM_PROVIDER=gemini` or `LLM_PROVIDER=openai` overrides that choice. Restart the dev server after changing `.env.local`.

Business rules can be checked without an API key:

```bash
npm run verify
```

## Demo script

**Order status.** Ask “Where is my order?” The assistant should ask for an order number and should not invent a status. Reply `BKL-1042`. The activity panel should show `get_order`, then a short status for a recently delivered order.

**Return.** In the same chat, say “I want to return one of the books.” The assistant should remember `BKL-1042` and ask which book: Dune or Project Hail Mary. Choose Dune. It should call `check_return_eligibility` and ask “Would you like me to create the return?” It should not create the return yet. Reply “Yes.” Only then should `create_return` run, and the reply should include the return id from the tool (`RET-8817` on a fresh server).

**Other orders**

| Order | What it shows |
| --- | --- |
| BKL-1042 | Delivered a few days ago. Dune ($18.99) and Project Hail Mary ($16.99), both returnable. |
| BKL-1043 | In transit, with carrier, tracking, and an expected delivery date. |
| BKL-1044 | Delivered 45 days ago. The return window is closed. |
| BKL-1045 | Delivered recently. Circe is already refunded. The Vanishing Half is still returnable. |
| BKL-1046 | Still processing, so it cannot be returned yet. |

Dates are relative to the day the server starts, so the 30-day window stays meaningful whenever the demo runs.

## How a turn works

1. The browser sends the visible conversation to `POST /api/chat`.
2. `lib/agent/orchestrator.ts` calls the model with the system prompt, that history, and the tool registry.
3. If the model asks for tools, the loop validates arguments with Zod, runs the tool, and sends the result back.
4. Read tools run immediately. `create_return` and `escalate_to_human` run only when `lib/agent/confirmation.ts` can see an explicit customer confirmation in the messages from before this turn.
5. The loop stops when the model writes a customer-facing reply, or after six model calls.

A write requested in the same turn as a lookup is refused. The customer has not had a chance to confirm it. The tool result tells the model the action did not happen.

Return eligibility is calculated in code: 30 days from delivery, nothing that is not delivered, and nothing already refunded or already returned. `create_return` checks those rules again before it writes. The in-memory return store lives for the current Node process. The first return in a process is `RET-8817`.

## Layout

```
app/api/chat/route.ts          HTTP boundary
lib/agent/orchestrator.ts      tool loop
lib/agent/system-prompt.ts     conversational policy
lib/agent/tool-registry.ts     definitions, schema, validation
lib/agent/confirmation.ts      write gate
lib/llm/                       Gemini and OpenAI clients
lib/tools/                     Bookly operations
lib/data/                      mock orders, policies, returns
components/                    chat and the agent activity panel
```

`search_policy` calls `retrievePolicies` in `lib/data/policies.ts`. That function is keyword lookup over four short articles. A different retriever can replace it without changing the agent.

## Limits

Conversation memory is the message list in the browser. Nothing is stored in a database.

Returns live in process memory, including a `globalThis` slot so dev reloads do not wipe a return mid-demo. A serverless instance starts empty, and two instances do not share returns.

The confirmation check is a small, readable gate. It accepts a short agreement such as “yes” or “yes, create the return” after the assistant has asked to create that return. It is not a general policy engine.
