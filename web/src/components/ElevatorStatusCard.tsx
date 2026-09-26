import type { EquipmentState } from "@/lib/graph";
import { LineBullet } from "./LineBullet";

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

export function ElevatorStatusCard({ status }: { status: StationStatusOutput }): React.JSX.Element {
  if (!status.ok) {
    return (
      <section className="rounded-2xl border border-bad/30 bg-bad/5 p-4 text-bad">
        <p className="font-semibold">Station not found</p>
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
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status.hasOutages ? "bg-bad/15 text-bad" : "bg-ok/15 text-ok"
            }`}
          >
            {status.hasOutages ? "Outage Reported" : "All Elevators Operational"}
          </span>
          {status.adaStatus && (
            <span className="text-xs text-muted">
              {status.adaStatus === "full" ? "ADA Accessible Station" : "Partial Accessibility"}
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
            className={`rounded-xl border p-3 ${
              el.isOut ? "border-bad/40 bg-bad/5" : "border-line/60 bg-background/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-sm font-bold text-foreground">{el.equipmentNo}</span>
                {el.isRedundant && (
                  <span className="ml-1.5 rounded bg-muted/15 px-1.5 py-0.5 text-[10px] text-muted">Redundant</span>
                )}
                <p className="mt-0.5 text-xs text-foreground/90">{el.serving ?? el.shortDescription ?? "Elevator"}</p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    el.isOut ? "bg-bad text-white" : "bg-ok/15 text-ok"
                  }`}
                >
                  {el.isOut ? "OUT OF SERVICE" : "WORKING"}
                </span>
                {!el.isOut && el.availability12mo != null && (
                  <p className="mt-1 text-[10px] text-muted">{Math.round(el.availability12mo * 100)}% 12-mo reliability</p>
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
                  <p className="mt-1 italic text-muted">
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
