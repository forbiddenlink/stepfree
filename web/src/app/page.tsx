"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { RouteCard, type RouteOutput } from "@/components/RouteCard";
import { ElevatorStatusCard, type StationStatusOutput } from "@/components/ElevatorStatusCard";
import { MarkdownText } from "@/components/MarkdownText";
import { LineBullet } from "@/components/LineBullet";
import { ElevatorIcon } from "@/components/Icons";
import { RouteStrip } from "@/components/RouteStrip";
import { SiteBar } from "@/components/SiteBar";

const RATE_LIMITED = "RATE_LIMITED";

// The firewall answers 403 before the route runs, so detect the limit here and say so plainly.
const limitedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status === 403 || res.status === 429) throw new Error(RATE_LIMITED);
  return res;
};

const EXAMPLES: Array<{ label: string; prompt: string; lines?: string[] }> = [
  { label: "Plan a trip", prompt: "Step-free from 1 Av to Times Sq right now?", lines: ["L", "1"] },
  { label: "Check a station", prompt: "Is the elevator at 161 St–Yankee Stadium working?", lines: ["4", "B", "D"] },
  { label: "Same-name stations", prompt: "Step-free from 72 St to Atlantic Av", lines: ["Q", "2", "3"] },
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
    // Only follow the conversation once there is one; on first load the page must open at the top.
    if (messages.length > 0) bottom.current?.scrollIntoView({ block: "end" });
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

  const empty = messages.length === 0;
  return (
    <div className="flex h-dvh flex-col">
      <SiteBar label="NYC Transit Agent">
        <div className="flex items-center gap-2 rounded-sm border-2 border-white px-3 py-1 text-sm font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3ddc97] motion-safe:animate-pulse" aria-hidden="true" />
          <span>MTA Outage Feed Live</span>
        </div>
      </SiteBar>
      {/* The page scrolls inside this region so the ask bar below it never overlays content. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-4xl flex-col px-4 pb-4">
        <div className={empty ? "pb-8 pt-10 md:pt-14" : "py-5"}>
          <h1
            className={
              empty
                ? "max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl"
                : "text-2xl font-extrabold tracking-tight"
            }
          >
            The NYC subway without stairs.
          </h1>
          {empty && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground md:text-xl">
              Live elevator outages, two years of elevator reliability, and MTA accessibility policy, in one verified
              answer.
            </p>
          )}
        </div>

        <div role="log" aria-label="Conversation" aria-live="polite" aria-busy={busy} className="flex-1 space-y-4">
          {empty && (
            <div className="space-y-10">
              <RouteStrip />

              <section aria-labelledby="try-q">
                <h2 id="try-q" className="mb-3 text-sm font-extrabold uppercase tracking-wider">
                  Try a question
                </h2>
                <ul className="border-b-2 border-foreground">
                  {EXAMPLES.map((ex) => (
                    <li key={ex.prompt} className="border-t-2 border-foreground">
                      <button
                        type="button"
                        onClick={() => send(ex.prompt)}
                        className="group flex min-h-16 w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-1 py-3 text-left hover:bg-foreground hover:text-background focus-visible:outline-offset-[-3px]"
                      >
                        <span className="flex flex-col">
                          <span className="text-sm font-bold uppercase tracking-wide text-accent group-hover:text-background">
                            {ex.label}
                          </span>
                          <span className="text-lg font-semibold leading-snug">{ex.prompt}</span>
                        </span>
                        {ex.lines && (
                          <span className="flex shrink-0 items-center gap-1">
                            {ex.lines.map((l) => (
                              <LineBullet key={l} line={l} />
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="how-q" className="border-l-8 border-accent bg-surface py-1 pl-5">
                <h2 id="how-q" className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
                  <ElevatorIcon className="h-5 w-5 text-accent" />
                  <span>How StepFree answers</span>
                </h2>
                <p className="mt-2 max-w-3xl text-base leading-relaxed">
                  A route depends on specific elevators at the stations where you board, change trains, and get off.
                  StepFree keeps stations, lines, elevators, live outages, and two years of monthly reliability as
                  linked records in Sanity, searches only paths where each of those elevators is working, and shows you
                  which ones it relied on. Policy answers come from MTA pages and the 2022 ADA settlement, with links.
                </p>
              </section>
            </div>
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
                  ? "max-w-[85%] rounded-2xl bg-accent-solid px-4 py-2.5 text-white"
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

      </main>
      <footer className="border-t-2 border-foreground">
        <p className="mx-auto max-w-4xl px-4 py-4 text-sm text-muted">
          Not affiliated with the MTA. Data from MTA public feeds via Sanity. Always confirm at mta.info before you travel.
        </p>
      </footer>
      </div>
      <div className="shrink-0 border-t-2 border-foreground bg-background">
      <form
        aria-label="Ask StepFree"
        className="mx-auto flex w-full max-w-4xl shrink-0 gap-2 bg-background px-4 py-2"
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
          className="min-h-12 flex-1 rounded-sm border-2 border-foreground bg-surface px-4 text-base focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="min-h-12 rounded-sm bg-accent-solid px-6 text-lg font-bold text-white transition-opacity disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
        >
          Ask
        </button>
      </form>
      </div>
    </div>
  );
}
