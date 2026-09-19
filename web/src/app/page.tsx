"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { RouteCard, type RouteOutput } from "@/components/RouteCard";

const EXAMPLES = [
  "Step-free from 1 Av to Times Sq right now?",
  "Which accessible elevators broke down most this year?",
  "Is the elevator at 161 St–Yankee Stadium working?",
  "What does the 2022 ADA settlement promise, and by when?",
];

type Part = { type: string; text?: string; state?: string; output?: unknown };

export default function Home(): React.JSX.Element {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string): void => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
    setInput("");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">
      <header className="py-6">
        <h1 className="text-3xl font-bold tracking-tight">StepFree</h1>
        <p className="mt-2 text-muted">
          The NYC subway without stairs. Live elevator outages, ten years of elevator reliability, and MTA
          accessibility policy, in one answer.
        </p>
      </header>

      <div aria-live="polite" aria-busy={busy} className="flex-1 space-y-4">
        {messages.length === 0 && (
          <section aria-label="Example questions">
            <p className="mb-2 text-sm font-medium text-muted">Try asking</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => send(q)}
                    className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-accent"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {messages.map((m) => (
          <article key={m.id} aria-label={m.role === "user" ? "You" : "StepFree"} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-accent px-4 py-2 text-white" : "w-full space-y-3"}>
              {(m.parts as Part[]).map((p, i) => {
                if (p.type === "text") {
                  return (
                    <p key={i} className="whitespace-pre-wrap leading-relaxed">
                      {p.text}
                    </p>
                  );
                }
                if (p.type === "tool-stepFreeRoute" && p.state === "output-available") {
                  return <RouteCard key={i} route={p.output as RouteOutput} />;
                }
                if (p.type.startsWith("tool-") && p.state !== "output-available") {
                  const label = p.type.includes("guide_")
                    ? "Reading MTA accessibility policy…"
                    : p.type.includes("stepFreeRoute")
                      ? "Planning a step-free route…"
                      : "Checking live elevator data…";
                  return (
                    <p key={i} className="text-sm text-muted">
                      {label}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </article>
        ))}

        {error && (
          <p role="alert" className="rounded-xl bg-warn-bg p-3 text-warn">
            Something went wrong. Please try again in a moment.
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-0 mt-4 flex gap-2 bg-background pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="q" className="sr-only">
          Ask about a step-free trip or an elevator
        </label>
        <input
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="From 72 St to Atlantic Av, no stairs…"
          autoComplete="off"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-base"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">
        Not affiliated with the MTA. Data from MTA public feeds via Sanity. Always confirm at mta.info before you travel.
      </p>
    </main>
  );
}
