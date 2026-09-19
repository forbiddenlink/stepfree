import type { Leg } from "@/lib/graph";
import { LineBullet } from "./LineBullet";

export type RouteOutput = {
  ok: boolean;
  reason?: string;
  from?: string;
  to?: string;
  legs?: Leg[];
  transfers?: string[];
  warnings?: string[];
  fetchedAt?: string;
  travelTime?: string;
};

const nyTime = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    : "unknown";

export function RouteCard({ route }: { route: RouteOutput }): React.JSX.Element {
  const warnings = route.warnings ?? [];
  return (
    <section
      aria-label={`Step-free route from ${route.from ?? "origin"} to ${route.to ?? "destination"}`}
      className="rounded-2xl border border-line bg-surface p-4"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-muted">Step-free route</p>
      <h3 className="mt-1 text-lg font-semibold leading-snug">
        {route.from} <span aria-hidden="true">→</span>
        <span className="sr-only">to</span> {route.to}
      </h3>

      {route.ok && route.legs && route.legs.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {route.legs.map((leg, i) => (
            <li key={`${leg.line}-${i}`} className="flex items-start gap-3">
              <LineBullet line={leg.line} />
              <div>
                <p className="font-medium">
                  {leg.from} <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span> {leg.to}
                </p>
                {i < route.legs!.length - 1 && (
                  <p className="text-sm text-muted">Change here using the elevator.</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 font-medium text-bad" role="alert">
          {route.reason ?? "No step-free route found."}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl bg-warn-bg p-3 text-warn" role="status">
          <p className="font-semibold">Heads up</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        For travel at {nyTime(route.travelTime)} · data fetched {nyTime(route.fetchedAt)} ·{" "}
        <a className="underline" href="https://www.mta.info/elevator-escalator-status" target="_blank" rel="noreferrer">
          confirm on mta.info
        </a>
      </p>
    </section>
  );
}
