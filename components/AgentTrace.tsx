"use client";

import { useEffect, useRef } from "react";
import type { TraceEvent } from "@/lib/agent/types";

const SAMPLE_ORDERS = [
  { id: "BKL-1042", note: "Delivered recently · Dune and Project Hail Mary" },
  { id: "BKL-1043", note: "In transit · tracking and carrier" },
  { id: "BKL-1044", note: "Delivered 45 days ago · return window closed" },
  { id: "BKL-1045", note: "Delivered · Circe already refunded" },
  { id: "BKL-1046", note: "Processing · not shipped yet" },
];

const STATE_LABEL: Record<TraceEvent["state"], string> = {
  success: "Done",
  info: "Result",
  blocked: "Held",
  error: "Error",
};

type AgentTraceProps = {
  events: TraceEvent[];
  pending: boolean;
  onAsk: (prompt: string) => void;
  askingDisabled: boolean;
};

export function AgentTrace({ events, pending, onAsk, askingDisabled }: AgentTraceProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [events, pending]);

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col border-line bg-paper-deep lg:border-l">
      <div className="border-b border-line px-4 py-4">
        <h2 className="font-serif text-lg text-ink">Agent activity</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Interviewer view of tool calls, results, and confirmation holds.
        </p>
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {events.length === 0 && !pending ? (
          <p className="rounded-xl border border-dashed border-line bg-card px-3 py-4 text-sm leading-6 text-ink-soft">
            Tool calls show up here. A clarifying question appears as a reply with no tool.
          </p>
        ) : null}

        {events.map((event) => (
          <article key={event.id} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-mono text-sm text-ink">{event.title}</h3>
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-soft">
                {event.kind === "status" ? STATE_LABEL[event.state] : event.kind}
              </span>
            </div>
            {event.arguments !== undefined ? (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-paper px-2.5 py-2 font-mono text-xs leading-5 text-ink">
                {JSON.stringify(event.arguments, null, 2)}
              </pre>
            ) : null}
            <p className={`mt-2 text-sm leading-5 ${summaryClass(event.state)}`}>{event.summary}</p>
          </article>
        ))}

        {pending ? (
          <p className="rounded-xl border border-line bg-card px-3 py-3 text-sm text-ink-soft">
            Waiting on the model…
          </p>
        ) : null}
      </div>

      <div className="border-t border-line px-4 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sample orders</h3>
        <ul className="mt-2 space-y-1.5">
          {SAMPLE_ORDERS.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                disabled={askingDisabled}
                onClick={() => onAsk(`What's the status of ${order.id}?`)}
                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-mono text-sm text-forest">{order.id}</span>
                <span className="mt-0.5 block text-xs leading-4 text-ink-soft">{order.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function summaryClass(state: TraceEvent["state"]): string {
  if (state === "success") return "text-forest";
  if (state === "blocked") return "text-brass";
  if (state === "error") return "text-danger";
  return "text-ink";
}
