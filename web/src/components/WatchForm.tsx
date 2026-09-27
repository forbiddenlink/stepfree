"use client";

import { useId, useState } from "react";

type State = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

export function WatchForm({ fromId, toId }: { fromId: string; toId: string }): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();

  if (state.kind === "sent") {
    return (
      <p role="status" className="mt-4 rounded-xl border border-line bg-surface p-3.5 text-sm text-ok font-medium">
        {state.message}
      </p>
    );
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, fromId, toId }),
      });
      if (res.status === 403 || res.status === 429) {
        setState({ kind: "error", message: "Too many requests. Please try again in a few minutes." });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setState(
        body.ok
          ? { kind: "sent", message: body.message }
          : { kind: "error", message: body.message ?? "Could not set up the alert. Please try again." },
      );
    } catch {
      setState({ kind: "error", message: "Could not reach StepFree. Check your connection and try again." });
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 border-t border-line/60 pt-4">
      <label htmlFor={id} className="block text-sm font-bold text-foreground">
        Email me if an elevator on this route breaks
      </label>
      <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">
        One email per outage. You confirm first, and every email has a stop link.
      </p>
      <div className="mt-2.5 flex gap-2">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          aria-describedby={`${id}-hint`}
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 flex-1 rounded-xl border border-line bg-background/80 px-3.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-white transition-opacity disabled:opacity-50 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        >
          {state.kind === "sending" ? "Sending…" : "Watch"}
        </button>
      </div>
      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-xs font-semibold text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
