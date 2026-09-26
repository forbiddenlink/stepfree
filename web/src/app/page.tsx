"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { RouteCard, type RouteOutput } from "@/components/RouteCard";
import { ElevatorStatusCard, type StationStatusOutput } from "@/components/ElevatorStatusCard";
import { MarkdownText } from "@/components/MarkdownText";

const RATE_LIMITED = "RATE_LIMITED";

// The firewall answers 403 before the route runs, so detect the limit here and say so plainly.
const limitedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 403 || res.status === 429) throw new Error(RATE_LIMITED);
  return res;
};

const EXAMPLES = [
  { label: "Plan a trip", prompt: "Step-free from 1 Av to Times Sq right now?" },
  { label: "Check a station", prompt: "Is the elevator at 161 St–Yankee Stadium working?" },
  { label: "Same-name stations", prompt: "Step-free from 72 St to Atlantic Av" },
  { label: "Least reliable elevators", prompt: "Which accessible elevators have been out the most over the last year?" },
  { label: "Your rights", prompt: "What does the 2022 ADA settlement promise, and by when?" },
];

type Part = { type: string; text?: string; state?: string; output?: unknown; error?: unknown };

export default function Home(): React.JSX.Element {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", fetch: limitedFetch }),
  });
  const busy = status === "submitted" || status === "streaming";
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = (text: string): void => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
    setInput("");
    // Example and station-choice buttons disappear after a send; keep keyboard focus in the page.
    const from = document.activeElement;
    setTimeout(() => {
      if (!from || !from.isConnected || from === document.body) inputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">
      <header className="py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">StepFree</h1>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            NYC Transit Agent
          </span>
        </div>
        <p className="mt-2 text-muted">
          The NYC subway without stairs. Live elevator outages, two years of elevator reliability, and MTA
          accessibility policy, in one verified answer.
        </p>
      </header>

      <div role="log" aria-label="Conversation" aria-live="polite" aria-busy={busy} className="flex-1 space-y-4">
        {messages.length === 0 && (
          <section aria-label="Example questions" className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Try a question
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((ex) => (
                  <li key={ex.prompt}>
                    <button
                      type="button"
                      onClick={() => send(ex.prompt)}
                      className="group flex min-h-12 w-full flex-col justify-between rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-surface/80 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span className="text-xs font-bold text-accent group-hover:underline">
                        {ex.label}
                      </span>
                      <span className="mt-1 text-sm font-medium text-foreground/90">
                        {ex.prompt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface/50 p-4 text-xs text-muted leading-relaxed">
              <p className="font-semibold text-foreground">How StepFree answers</p>
              <p className="mt-1">
                A route depends on specific elevators at the stations where you board, change trains, and get off.
                StepFree keeps stations, lines, elevators, live outages, and two years of monthly reliability as linked
                records in Sanity, searches only paths where each of those elevators is working, and shows you
                which ones it relied on. Policy answers come from MTA pages and the 2022 ADA settlement, with links.
              </p>
            </div>
          </section>
        )}

        {messages.map((m) => (
          <article
            key={m.id}
            aria-label={m.role === "user" ? "You" : "StepFree"}
            className={m.role === "user" ? "flex justify-end" : ""}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-white"
                  : "w-full space-y-3"
              }
            >
              {(m.parts as Part[]).map((p, i) => {
                if (p.type === "text") {
                  if (m.role === "user") {
                    return (
                      <p key={i} className="whitespace-pre-wrap leading-relaxed">
                        {p.text}
                      </p>
                    );
                  }
                  return <MarkdownText key={i} content={p.text ?? ""} />;
                }
                if (p.type === "tool-stepFreeRoute" && p.state === "output-available") {
                  return (
                    <RouteCard
                      key={i}
                      route={p.output as RouteOutput}
                      onSelectStation={send}
                    />
                  );
                }
                if (p.type === "tool-checkStationElevators" && p.state === "output-available") {
                  return (
                    <ElevatorStatusCard
                      key={i}
                      status={p.output as StationStatusOutput}
                      onSelectStation={send}
                    />
                  );
                }
                if (p.type.startsWith("tool-") && p.state === "output-error") {
                  return (
                    <p key={i} className="text-sm font-medium text-bad" role="status">
                      Couldn&rsquo;t reach live MTA data. Try again in a moment, and check mta.info/elevators before you travel.
                    </p>
                  );
                }
                if (p.type.startsWith("tool-") && p.state !== "output-available") {
                  const label = p.type.includes("guide_")
                    ? "Reading MTA accessibility policy…"
                    : p.type.includes("stepFreeRoute")
                      ? "Planning a step-free route…"
                      : p.type.includes("checkStationElevators")
                        ? "Checking this station’s elevators…"
                        : "Looking up MTA elevator data…";
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted motion-safe:animate-pulse">
                      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                      <span>{label}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </article>
        ))}

        {error && (
          <p role="alert" className="rounded-xl bg-warn-bg p-3 text-warn">
            {error.message === RATE_LIMITED
              ? "You've asked a lot of questions in a short time. Please try again in a few minutes."
              : "Something went wrong. Please try again in a moment."}
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
          ref={inputRef}
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="From 72 St to Atlantic Av, no stairs…"
          autoComplete="off"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-base focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white transition-opacity disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
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
