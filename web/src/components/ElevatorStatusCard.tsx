import type { EquipmentState } from "@/lib/graph";
import { LineBullet } from "./LineBullet";
import { StationChoice, type StationCandidate } from "./StationChoice";
import { ElevatorIcon, WheelchairIcon, CheckCircleIcon, AlertCircleIcon } from "./Icons";

export type StationStatusOutput = {
  ok: boolean;
  station?: string;
  complexId?: string;
  adaStatus?: "full" | "partial" | "none";
  borough?: string;
  lines?: string[];
  elevators?: EquipmentState[];
  hasOutages?: boolean;
  reason?: string;
  ambiguous?: boolean;
  query?: string;
  candidates?: StationCandidate[];
  fetchedAt?: string;
  sourceUpdatedAt?: string;
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

export function ElevatorStatusCard({
  status,
  onSelectStation,
}: {
  status: StationStatusOutput;
  onSelectStation?: (message: string) => void;
}): React.JSX.Element {
  if (status.ambiguous && status.candidates && status.candidates.length > 0) {
    return <StationChoice query={status.query} field="station" candidates={status.candidates} onSelect={onSelectStation} />;
  }
  if (!status.ok) {
    return (
      <section className="rounded-2xl border border-bad/30 bg-bad/5 p-4 text-bad">
        <p className="font-semibold flex items-center gap-1.5">
          <AlertCircleIcon className="h-4 w-4 shrink-0" />
          <span>Station not found</span>
        </p>
        <p className="mt-1 text-sm text-foreground/80">{status.reason ?? "Could not find equipment data for this station."}</p>
      </section>
    );
  }

  const elevators = status.elevators ?? [];

  return (
    <section
      aria-label={`Live elevator status at ${status.station ?? "station"}`}
      className="rounded-2xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status.hasOutages ? "bg-bad/15 text-bad" : "bg-ok/15 text-ok"
            }`}
          >
            {status.hasOutages ? <AlertCircleIcon className="h-3 w-3" /> : <CheckCircleIcon className="h-3 w-3" />}
            {status.hasOutages ? "Outage Reported" : "All Elevators Operational"}
          </span>
          {status.adaStatus && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              {status.adaStatus === "full" ? (
                <>
                  <WheelchairIcon className="h-3.5 w-3.5 text-ok" />
                  <span>ADA Accessible Station</span>
                </>
              ) : (
                "Partial Accessibility"
              )}
            </span>
          )}
        </div>
        {status.lines && status.lines.length > 0 && (
          <div className="flex items-center gap-1">
            {status.lines.map((l) => (
              <LineBullet key={l} line={l} />
            ))}
          </div>
        )}
      </div>

      <h3 className="mt-2 text-xl font-bold tracking-tight">{status.station}</h3>
      <p className="text-xs text-muted">
        {status.borough ? `${status.borough} · ` : ""}
        {elevators.length} {elevators.length === 1 ? "accessible elevator" : "accessible elevators"} tracked
      </p>

      {/* Elevators List */}
      <div className="mt-4 space-y-2.5">
        {elevators.map((el) => (
          <div
            key={el.equipmentNo}
            className={`rounded-xl border p-3 transition-colors ${
              el.isOut ? "border-bad/40 bg-bad/5" : "border-line/60 bg-background/50 shadow-2xs"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded border border-line/80 bg-surface px-1.5 py-0.5 font-mono text-sm font-bold text-foreground">
                    <ElevatorIcon className="h-3.5 w-3.5 text-muted" />
                    {el.equipmentNo}
                  </span>
                  {el.isRedundant && (
                    <span className="rounded bg-muted/15 px-1.5 py-0.5 text-[10px] text-muted font-normal">Redundant</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-foreground/90">{el.serving ?? el.shortDescription ?? "Elevator"}</p>
              </div>
              <div className="text-right whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    el.isOut ? "bg-bad-solid text-white" : "bg-ok/15 text-ok"
                  }`}
                >
                  {el.isOut ? <AlertCircleIcon className="h-2.5 w-2.5" /> : <CheckCircleIcon className="h-2.5 w-2.5" />}
                  {el.isOut ? "OUT OF SERVICE" : "WORKING"}
                </span>
                {!el.isOut && el.availability12mo != null && (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted">{Math.round(el.availability12mo * 100)}% 12-mo reliability</p>
                    <div className="mt-0.5 h-1 w-16 ml-auto overflow-hidden rounded-full bg-line/60">
                      <div
                        className="h-full rounded-full bg-ok"
                        style={{ width: `${Math.round(el.availability12mo * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {el.isOut && (
              <div className="mt-2 border-t border-bad/20 pt-2 text-xs">
                <p className="font-medium text-bad">
                  Reason: {el.outageReason ?? "Repair"}
                  {el.estimatedReturnAt ? ` · Estimated return: ${nyTime(el.estimatedReturnAt)}` : ""}
                </p>
                {el.alternativeRoute && (
                  <p className="mt-1 border-l-2 border-accent/40 pl-2 italic text-muted">
                    Official MTA Detour: &ldquo;{el.alternativeRoute}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <footer className="mt-4 border-t border-line/50 pt-3 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
        <span>MTA Live Status: {nyTime(status.sourceUpdatedAt)}</span>
        <a
          className="font-medium text-accent underline hover:opacity-80"
          href="https://new.mta.info/elevator-escalator-status"
          target="_blank"
          rel="noreferrer"
        >
          Verify on mta.info ↗
        </a>
      </footer>
    </section>
  );
}
