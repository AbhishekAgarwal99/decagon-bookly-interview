"use client";

import { useEffect, useRef, useState } from "react";
import { AgentTrace } from "@/components/AgentTrace";
import { MessageBubble } from "@/components/MessageBubble";
import type { TraceEvent } from "@/lib/agent/types";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Pane = "chat" | "activity";

const WELCOME =
  "Hi — I can check an order, walk through a return, or explain Bookly policy. What can I help with?";

const STARTERS = [
  "Where is my order?",
  "What's the status of BKL-1043?",
  "What is your return policy?",
  "I need to reset my password",
];

function welcomeMessage(): UiMessage {
  return { id: "welcome", role: "assistant", content: WELCOME };
}

export function ChatInterface() {
  const [messages, setMessages] = useState<UiMessage[]>([welcomeMessage()]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>("chat");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, pending]);

  const conversationStarted = messages.some((message) => message.role === "user");

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || pending) return;

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setPending(true);
    setPane("chat");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; trace?: TraceEvent[]; error?: string }
        | null;

      if (!mountedRef.current) return;

      if (!response.ok || !data?.message) {
        setMessages((current) => current.filter((message) => message.id !== userMessage.id));
        setDraft(trimmed);
        setError(data?.error ?? "Bookly support is unavailable right now.");
        return;
      }

      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: data.message ?? "" },
      ]);
      setTrace((current) => [...current, ...(data.trace ?? [])]);
    } catch {
      if (!mountedRef.current) return;
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setDraft(trimmed);
      setError("Could not reach Bookly support. Check your connection and try again.");
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  function reset() {
    if (pending) return;
    setMessages([welcomeMessage()]);
    setTrace([]);
    setDraft("");
    setError(null);
    setPane("chat");
  }

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BookMark />
          <div>
            <h1 className="font-serif text-xl leading-none tracking-tight text-ink">Bookly</h1>
            <p className="mt-1 text-sm text-ink-soft">AI-powered customer care</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-full border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          New chat
        </button>
      </header>

      <div className="flex border-b border-line lg:hidden">
        <PaneTab label="Chat" selected={pane === "chat"} onClick={() => setPane("chat")} />
        <PaneTab
          label={trace.length > 0 ? `Activity ${trace.length}` : "Activity"}
          selected={pane === "activity"}
          onClick={() => setPane("activity")}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <section
          className={`${pane === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-col lg:flex`}
        >
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation"
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} role={message.role} content={message.content} />
            ))}
            {pending ? (
              <div className="mr-auto max-w-[85%]">
                <p className="mb-1 text-xs text-ink-soft">Bookly</p>
                <div className="rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm text-ink-soft">
                  Checking with Bookly…
                </div>
              </div>
            ) : null}
            {!conversationStarted ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => send(starter)}
                    className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-sm text-ink hover:border-forest hover:text-forest"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}
            {messages.filter((message) => message.role === "user").length === 1 &&
            messages.at(-1)?.role === "assistant" &&
            !pending ? (
              <p className="text-sm text-ink-soft">
                Next, try “I want to return one of the books.” The assistant should reuse the order
                already in this chat.
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-line bg-card px-4 py-3 sm:px-6"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            {error ? (
              <p role="alert" className="mb-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                rows={2}
                value={draft}
                disabled={pending}
                placeholder="Ask about an order, a return, or a policy"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                className="min-h-14 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2 text-[15px] text-ink outline-none placeholder:text-ink-soft focus:border-forest disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-paper hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Prototype. Orders and returns are simulated for this conversation.
            </p>
          </form>
        </section>

        <div className={`${pane === "activity" ? "flex" : "hidden"} min-h-0 lg:flex`}>
          <AgentTrace
            events={trace}
            pending={pending}
            askingDisabled={pending}
            onAsk={(prompt) => {
              setPane("chat");
              void send(prompt);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PaneTab({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm ${selected ? "border-b-2 border-forest font-semibold text-forest" : "text-ink-soft"}`}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function BookMark() {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest text-paper"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
      </svg>
    </span>
  );
}
