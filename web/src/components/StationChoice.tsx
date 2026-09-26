import { LineBullet } from "./LineBullet";

export type StationCandidate = {
  name: string;
  complexId: string;
  borough?: string;
  lines: string[];
  adaStatus?: string;
  label: string;
};

export type StationField = "from" | "to" | "station";

/** The message sent when a rider picks a candidate. Carries the complexId so the agent resolves it exactly. */
export function choiceMessage(field: StationField | undefined, c: StationCandidate): string {
  const verb = field === "to" ? "Go to" : field === "station" ? "Check" : "Start at";
  return `${verb} ${c.label} (station id ${c.complexId})`;
}

export function StationChoice({
  query,
  field,
  candidates,
  onSelect,
}: {
  query?: string;
  field?: StationField;
  candidates: StationCandidate[];
  onSelect?: (message: string) => void;
}): React.JSX.Element {
  const role = field === "to" ? "destination" : field === "from" ? "starting station" : "station";
  return (
    <section
      aria-label={`More than one station matches ${query ?? "your search"}`}
      className="rounded-2xl border border-accent/40 bg-surface p-5 shadow-xs"
    >
      <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
        Choose a station
      </span>
      <h3 className="mt-2 text-lg font-bold">Which &ldquo;{query}&rdquo; do you mean?</h3>
      <p className="mt-1 text-sm text-muted">
        More than one station matches. Pick your {role} so the trip uses the right elevators.
      </p>
      <ul className="mt-4 grid gap-2">
        {candidates.map((c) => (
          <li key={c.complexId}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(choiceMessage(field, c))}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-background/50 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default"
            >
              <span className="min-w-0">
                <span className="block font-semibold break-words text-foreground">{c.name}</span>
                <span className="block text-xs text-muted">
                  {c.borough ? `${c.borough} · ` : ""}
                  {c.adaStatus === "full" ? "Fully accessible" : "Accessibility unconfirmed"}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {c.lines.map((l) => (
                  <LineBullet key={l} line={l} />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
