import type { Leg, LineEvidence, StationEquipment } from "@/lib/graph";
import { LineBullet } from "./LineBullet";
import { StationChoice, type StationCandidate } from "./StationChoice";
import { WatchForm } from "./WatchForm";

export type RouteCandidate = StationCandidate;

export type RouteOutput = {
  ok: boolean;
  ambiguous?: boolean;
  field?: "from" | "to";
  query?: string;
  candidates?: RouteCandidate[];
  reason?: string;
  from?: string;
  to?: string;
  fromId?: string;
  toId?: string;
  fromLines?: string[];
  toLines?: string[];
  legs?: Leg[];
  transfers?: string[];
  warnings?: string[];
  equipmentOnRoute?: StationEquipment[];
  evidence?: LineEvidence[];
  basis?: string;
  fetchedAt?: string;
  sourceUpdatedAt?: string;
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

const relativeTime = (iso?: string): string => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins === 0) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins}m ago`;
};

export function RouteCard({
  route,
  onSelectStation,
}: {
  route: RouteOutput;
  onSelectStation?: (message: string) => void;
}): React.JSX.Element {
  const warnings = route.warnings ?? [];
  const equipment = route.equipmentOnRoute ?? [];
  const evidence = route.evidence ?? [];
  const usedElevators = new Set(evidence.flatMap((e) => e.elevators));
  // evidence runs board, (leave, board) per transfer, alight: leg i boards at 2i and leaves at 2i+1
  const legEvidence = (i: number): { board?: LineEvidence; exit?: LineEvidence } => ({
    board: evidence[2 * i],
    exit: evidence[2 * i + 1],
  });

  // Case 1: more than one station matches; the rider chooses, never the agent
  if (route.ambiguous && route.candidates && route.candidates.length > 0) {
    return (
      <StationChoice query={route.query} field={route.field} candidates={route.candidates} onSelect={onSelectStation} />
    );
  }

  // Case 2: Confirmed or unconfirmed route
  return (
    <section
      aria-label={`Step-free route from ${route.from ?? "origin"} to ${route.to ?? "destination"}`}
      className="rounded-2xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              route.ok
                ? "bg-ok/15 text-ok"
                : "bg-bad/15 text-bad"
            }`}
          >
            {route.ok ? "Candidate step-free route" : "Cannot confirm step-free"}
          </span>
          {route.sourceUpdatedAt && (
            <span className="text-xs text-muted">
              MTA feed updated {relativeTime(route.sourceUpdatedAt)}
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-2 text-xl font-bold tracking-tight">
        {route.from ?? "Origin"} <span aria-hidden="true">→</span>
        <span className="sr-only">to</span> {route.to ?? "Destination"}
      </h3>
      {route.ok && route.basis && <p className="mt-1 text-xs text-muted">{route.basis}</p>}

      {route.ok && route.legs && route.legs.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {route.legs.map((leg, i) => (
            <li
              key={`${leg.line}-${i}`}
              className="flex items-start gap-3 rounded-xl bg-background/60 p-3"
            >
              <LineBullet line={leg.line} />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {leg.from} <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span> {leg.to}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {leg.accessibleHops} {leg.accessibleHops === 1 ? "accessible stop" : "accessible stops"} on the {leg.line} train
                </p>
                {(() => {
                  const { board, exit } = legEvidence(i);
                  if (!board && !exit) return null;
                  return (
                    <p className="mt-1 text-xs text-muted">
                      {board && (
                        <>
                          {i === 0 ? "Board" : "Change to this train"} using{" "}
                          <span className="font-mono font-semibold text-foreground">{board.elevators.join(", ")}</span>
                        </>
                      )}
                      {board && exit && " · "}
                      {exit && (
                        <>
                          {i === route.legs!.length - 1 ? "Exit" : "Leave the train"} using{" "}
                          <span className="font-mono font-semibold text-foreground">{exit.elevators.join(", ")}</span>
                        </>
                      )}
                    </p>
                  );
                })()}
              </div>
            </li>
          ))}
        </ol>
      ) : route.ok ? (
        <div className="mt-3 rounded-xl bg-ok/10 p-3.5 text-sm text-ok">
          <p className="font-semibold flex items-center gap-1.5">
            <span>✓</span> Origin and destination are the same station ({route.from})
          </p>
          <p className="mt-1 text-muted text-xs">
            No subway ride needed. Accessible elevators for this station are shown below.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-bad/10 p-3 text-sm text-bad" role="alert">
          <p className="font-semibold">Step-free route not viable</p>
          <p className="mt-0.5">{route.reason ?? "No accessible route found with operating elevators."}</p>
        </div>
      )}

      {/* Inspectable Equipment Chain */}
      {equipment.length > 0 && (
        <div className="mt-4 rounded-xl border border-line/60 bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Elevators at these stations
          </p>
          <div className="mt-2 space-y-3">
            {equipment.map((st) => (
              <div key={st.complexId} className="border-t border-line/40 pt-2 first:border-0 first:pt-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {st.stationName} ({st.role === "origin" ? "Boarding" : st.role === "destination" ? "Alighting" : "Transfer"})
                  </span>
                  <span className={st.hasOutage ? "font-medium text-bad" : "text-ok"}>
                    {st.hasOutage ? "Elevator out here" : "All elevators running"}
                  </span>
                </div>
                {st.elevators.length > 0 ? (
                  <ul className="mt-1.5 space-y-1.5 text-xs">
                    {st.elevators.map((el) => (
                      <li
                        key={el.equipmentNo}
                        className={`flex items-start justify-between gap-2 rounded-lg p-2 ${
                          el.isOut ? "bg-bad/10 border border-bad/20" : "bg-surface"
                        }`}
                      >
                        <div>
                          <p className="font-mono font-bold text-foreground">
                            {el.equipmentNo}
                            {el.isRedundant && <span className="ml-1 text-[10px] text-muted font-normal">(redundant)</span>}
                            {usedElevators.has(el.equipmentNo) && (
                              <span className="ml-1 rounded-sm bg-accent/15 px-1 text-[10px] font-semibold text-accent">on your route</span>
                            )}
                          </p>
                          <p className="text-muted">{el.serving ?? el.shortDescription ?? "Station elevator"}</p>
                          {el.isOut && el.outageReason && (
                            <p className="mt-0.5 font-medium text-bad">
                              Outage: {el.outageReason}
                              {el.estimatedReturnAt ? ` · Return est: ${nyTime(el.estimatedReturnAt)}` : ""}
                            </p>
                          )}
                          {el.isOut && el.alternativeRoute && (
                            <p className="mt-1 italic text-muted">
                              MTA Detour: &ldquo;{el.alternativeRoute}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <span
                            className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                              el.isOut ? "bg-bad text-white" : "bg-ok/15 text-ok"
                            }`}
                          >
                            {el.isOut ? "Out" : "Working"}
                          </span>
                          {!el.isOut && el.availability12mo != null && (
                            <p className="mt-0.5 text-[10px] text-muted">
                              {Math.round(el.availability12mo * 100)}% 12-mo uptime
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs italic text-muted">No individual elevator units indexed for this platform.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl bg-warn-bg p-3 text-warn" role="status">
          <p className="font-semibold text-xs uppercase tracking-wide">MTA Service Advisories</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs sm:text-sm">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {route.ok && route.fromId && route.toId && route.fromId !== route.toId && (
        <WatchForm fromId={route.fromId} toId={route.toId} />
      )}

      <footer className="mt-4 border-t border-line/50 pt-3 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
        <p>
          MTA feed: {nyTime(route.sourceUpdatedAt)} · Travel time: {nyTime(route.travelTime)}
        </p>
        <a
          className="font-medium text-accent underline hover:opacity-80"
          href="https://new.mta.info/elevator-escalator-status"
          target="_blank"
          rel="noreferrer"
        >
          Verify live on mta.info ↗
        </a>
      </footer>
    </section>
  );
}
