import type { Leg, LineEvidence, StationEquipment } from "@/lib/graph";
import { LineBullet, getLineColor } from "./LineBullet";
import { StationChoice, type StationCandidate } from "./StationChoice";
import { WatchForm } from "./WatchForm";
import { ElevatorIcon, CheckCircleIcon, AlertCircleIcon, TransferIcon } from "./Icons";

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
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              route.ok
                ? "bg-ok/15 text-ok"
                : "bg-bad/15 text-bad"
            }`}
          >
            {route.ok ? <CheckCircleIcon className="h-3 w-3" /> : <AlertCircleIcon className="h-3 w-3" />}
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
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Transit Itinerary
          </p>
          <ol className="space-y-4">
            {route.legs.map((leg, i) => {
              const { board, exit } = legEvidence(i);
              const lineColor = getLineColor(leg.line);
              const isFirstLeg = i === 0;
              const isLastLeg = i === route.legs!.length - 1;

              return (
                <li
                  key={`${leg.line}-${i}`}
                  className="rounded-2xl border border-line/70 bg-background/50 p-4 transition-colors"
                >
                  {/* Origin / Boarding Station */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex flex-col items-center">
                      <span
                        className="h-4 w-4 rounded-full border-[3px] bg-surface"
                        style={{ borderColor: lineColor.bg }}
                        aria-hidden="true"
                      />
                      <span
                        className="my-1 w-1 flex-1 rounded-full min-h-6"
                        style={{ backgroundColor: lineColor.bg }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-bold text-foreground text-base">
                          {leg.from}
                        </p>
                        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                          {isFirstLeg ? "Origin" : "Transfer Station"}
                        </span>
                      </div>
                      {board && board.elevators.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>{i === 0 ? "Board" : "Change to this train"} using</span>
                          <span className="sr-only">{board.elevators.join(", ")}</span>
                          <div className="flex flex-wrap gap-1" aria-hidden="true">
                            {board.elevators.map((el) => (
                              <span
                                key={el}
                                className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground shadow-2xs"
                              >
                                <ElevatorIcon className="h-3 w-3 text-accent" />
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Track Details (Hop & Train) */}
                  <div
                    className="my-1 ml-5 flex items-center gap-3 border-l-2 py-2 pl-4"
                    style={{ borderColor: lineColor.bg }}
                  >
                    <LineBullet line={leg.line} />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">
                        {leg.from} <span aria-hidden="true">→</span>
                        <span className="sr-only">to</span> {leg.to}
                      </p>
                      <p className="text-muted">
                        {leg.accessibleHops} {leg.accessibleHops === 1 ? "accessible stop" : "accessible stops"} on the {leg.line} train
                      </p>
                    </div>
                  </div>

                  {/* Destination / Alighting Station */}
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex flex-col items-center">
                      <span
                        className="h-4 w-4 rounded-full border-[3px]"
                        style={{ borderColor: lineColor.bg, backgroundColor: lineColor.bg }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-bold text-foreground text-base">
                          {leg.to}
                        </p>
                        <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                          {isLastLeg ? "Destination" : "Transfer Station"}
                        </span>
                      </div>
                      {exit && exit.elevators.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>{i === route.legs!.length - 1 ? "Exit" : "Leave the train"} using</span>
                          <span className="sr-only">{exit.elevators.join(", ")}</span>
                          <div className="flex flex-wrap gap-1" aria-hidden="true">
                            {exit.elevators.map((el) => (
                              <span
                                key={el}
                                className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground shadow-2xs"
                              >
                                <ElevatorIcon className="h-3 w-3 text-accent" />
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transfer indicator connecting to the next leg */}
                  {!isLastLeg && route.legs && route.legs[i + 1] && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                      <TransferIcon className="h-4 w-4 shrink-0" />
                      <span>
                        Transfer at {leg.to} to the {route.legs[i + 1].line} train
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : route.ok ? (
        <div className="mt-3 rounded-xl bg-ok/10 p-3.5 text-sm text-ok">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Origin and destination are the same station ({route.from})</span>
          </p>
          <p className="mt-1 text-muted text-xs">
            No subway ride needed. Accessible elevators for this station are shown below.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-bad/10 p-3 text-sm text-bad" role="alert">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircleIcon className="h-4 w-4" />
            <span>Step-free route not viable</span>
          </p>
          <p className="mt-0.5">{route.reason ?? "No accessible route found with operating elevators."}</p>
        </div>
      )}

      {/* Inspectable Equipment Chain */}
      {equipment.length > 0 && (
        <div className="mt-5 rounded-2xl border border-line/70 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ElevatorIcon className="h-3.5 w-3.5 text-accent" />
              <span>Elevators at these stations</span>
            </p>
            <span className="text-[11px] text-muted font-medium">
              {equipment.reduce((acc, st) => acc + st.elevators.length, 0)} units verified
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {equipment.map((st) => (
              <div key={st.complexId} className="border-t border-line/40 pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">
                    {st.stationName} ({st.role === "origin" ? "Boarding" : st.role === "destination" ? "Alighting" : "Transfer"})
                  </span>
                  <span className={`inline-flex items-center gap-1 font-semibold ${st.hasOutage ? "text-bad" : "text-ok"}`}>
                    {st.hasOutage ? <AlertCircleIcon className="h-3 w-3" /> : <CheckCircleIcon className="h-3 w-3" />}
                    {st.hasOutage ? "Elevator out here" : "All elevators running"}
                  </span>
                </div>
                {st.elevators.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-xs">
                    {st.elevators.map((el) => (
                      <li
                        key={el.equipmentNo}
                        className={`flex items-start justify-between gap-3 rounded-xl p-3 border transition-colors ${
                          el.isOut ? "bg-bad/10 border-bad/30" : "bg-surface border-line/60 shadow-2xs"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded border border-line/80 bg-background px-1.5 py-0.5 font-mono text-xs font-bold text-foreground">
                              <ElevatorIcon className="h-3 w-3 text-muted" />
                              {el.equipmentNo}
                            </span>
                            {el.isRedundant && (
                              <span className="rounded bg-muted/15 px-1.5 py-0.5 text-[10px] text-muted font-normal">
                                (redundant)
                              </span>
                            )}
                            {usedElevators.has(el.equipmentNo) && (
                              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                on your route
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted leading-relaxed">
                            {el.serving ?? el.shortDescription ?? "Station elevator"}
                          </p>
                          {el.isOut && el.outageReason && (
                            <p className="mt-1.5 rounded-lg bg-bad/10 px-2.5 py-1 text-xs font-semibold text-bad">
                              Outage: {el.outageReason}
                              {el.estimatedReturnAt ? ` · Return est: ${nyTime(el.estimatedReturnAt)}` : ""}
                            </p>
                          )}
                          {el.isOut && el.alternativeRoute && (
                            <p className="mt-1.5 border-l-2 border-accent/50 pl-2 text-xs italic text-muted">
                              MTA Detour: &ldquo;{el.alternativeRoute}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              el.isOut ? "bg-bad-solid text-white" : "bg-ok/15 text-ok"
                            }`}
                          >
                            {el.isOut ? <AlertCircleIcon className="h-2.5 w-2.5" /> : <CheckCircleIcon className="h-2.5 w-2.5" />}
                            {el.isOut ? "Out" : "Working"}
                          </span>
                          {!el.isOut && el.availability12mo != null && (
                            <div className="mt-1.5">
                              <p className="text-[10px] font-medium text-muted">
                                {Math.round(el.availability12mo * 100)}% 12-mo uptime
                              </p>
                              <div className="mt-1 h-1 w-16 ml-auto overflow-hidden rounded-full bg-line/60">
                                <div
                                  className="h-full rounded-full bg-ok"
                                  style={{ width: `${Math.round(el.availability12mo * 100)}%` }}
                                />
                              </div>
                            </div>
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
          <p className="font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            <span>MTA Service Advisories</span>
          </p>
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
          MTA feed: {nyTime(route.sourceUpdatedAt)} · Checked for: {nyTime(route.travelTime)}
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
