# How the Bookly agent works

The model owns the conversation. Bookly’s systems own facts and actions. A customer can ask in plain language. The assistant cannot invent an order, a refund, or a completed return.

A turn starts in the browser. The page keeps the visible transcript and sends it to `POST /api/chat`. There is no database. The next turn knows only what is in that transcript, which is why “I want to return one of the books” can reuse an order number from earlier in the same chat.

The route calls `runAgent` in `lib/agent/orchestrator.ts`. That function is the whole agent. It does not classify intents up front, and it does not hand work to other agents. Each pass calls one model — Gemini when `GEMINI_API_KEY` is set, otherwise OpenAI — with the system prompt, the transcript, and five tool definitions from a single registry.

The prompt in `lib/agent/system-prompt.ts` is behavioral. It tells the model to ask when an order number or a book choice is missing, to reuse facts already in the chat, and never to claim success unless a tool returned it. The 30-day return rule and the order catalog are not in the prompt.

If the model replies with text and no tool call, that text is the customer answer. A missing order number or an order with two books should produce a question, not a guess. If the model requests tools, the loop checks the arguments with Zod and runs the matching function. Read tools — `get_order`, `search_policy`, and `check_return_eligibility` — run immediately. Write tools — `create_return` and `escalate_to_human` — go through `lib/agent/confirmation.ts` first. That check looks only at messages the customer has already sent. “Yes” counts after the assistant has asked to create the return. A write requested in the same turn as a lookup is refused, and the model is told the action did not happen.

The tools talk to small mock Bookly systems. Orders live in `lib/data/orders.ts`. Eligibility is calculated in code: the order must be delivered, the item must be inside 30 days of delivery, and it must not already be refunded or already returned. `create_return` runs that check again before it writes. New returns stay in process memory for the demo. The first return id in a process is `RET-8817`. Policy lookup is a keyword search over four short articles, so a later retriever can replace it without changing the loop.

The loop stops when the model writes a customer reply, or after six model calls. The response also includes an Agent Activity trace: tool name, arguments, and result. That panel is for the demo. It does not show hidden chain-of-thought. Provider clients stay in `lib/llm`. The orchestrator never imports a vendor SDK directly.
