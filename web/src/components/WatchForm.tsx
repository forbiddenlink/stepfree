"use client";

import { useId, useState } from "react";

type State = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

export function WatchForm({ fromId, toId }: { fromId: string; toId: string }): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const id = useId();

  if (state.kind === "sent") {
    return (
      <p role="status" className="mt-4 rounded-xl border border-line p-3 text-sm">
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
    <form onSubmit={submit} className="mt-4 border-t border-line pt-4">
      <label htmlFor={id} className="block font-medium">
        Email me if an elevator on this route breaks
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted">
        One email per outage. You confirm first, and every email has a stop link.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          aria-describedby={`${id}-hint`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 flex-1 rounded-xl border border-line bg-background px-4 text-base"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="min-h-12 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-50"
        >
          {state.kind === "sending" ? "Sending…" : "Watch"}
        </button>
      </div>
      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
