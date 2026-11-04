import { ElevatorIcon } from "./Icons";
import { LineBullet, getLineColor } from "./LineBullet";
import { SAMPLE_EVIDENCE, SAMPLE_LEG, SAMPLE_RIDE_THROUGH, SAMPLE_SERVING } from "@/lib/sample-trip";
import type { LineEvidence } from "@/lib/graph";

function Elevators({ ev }: { ev: LineEvidence }): React.JSX.Element {
  return (
    <ul className="mt-2 space-y-1.5">
      {ev.elevators.map((no) => (
        <li key={no} className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-accent-solid text-white">
            <ElevatorIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <span className="font-mono text-sm font-bold">{no}</span>
            <span className="block text-muted">{SAMPLE_SERVING[no]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// The step-free route strip: the same board / ride-through / exit evidence RouteCard prints, drawn as one line sign.
export function RouteStrip(): React.JSX.Element {
  const rail = getLineColor(SAMPLE_LEG.line).bg;
  return (
    <section aria-labelledby="sample-trip" className="border-2 border-foreground">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-foreground px-4 py-2 text-background">
        <h2 id="sample-trip" className="text-sm font-extrabold uppercase tracking-wider">
          Sample trip: {SAMPLE_LEG.from} to {SAMPLE_LEG.to}
        </h2>
        <p className="text-sm font-semibold">Equipment list snapshot, not live status</p>
      </div>

      <ol className="grid gap-0 p-4 md:grid-cols-3 md:gap-0 md:p-6">
        {[
          { key: "board", name: SAMPLE_LEG.from, role: "Board", ev: SAMPLE_EVIDENCE.board },
          { key: "through", name: SAMPLE_RIDE_THROUGH, role: "Ride through: no elevator needed", ev: undefined },
          { key: "exit", name: SAMPLE_LEG.to, role: "Exit", ev: SAMPLE_EVIDENCE.exit },
        ].map((stop, i, all) => (
          <li key={stop.key} className="relative pb-6 pl-10 last:pb-0 md:pb-0 md:pl-0 md:pt-10 md:pr-4">
            {/* rail segment to the next stop */}
            {i < all.length - 1 && (
              <span
                aria-hidden="true"
                style={{ backgroundColor: rail }}
                className="absolute left-[7px] top-[30px] -bottom-1 w-3 border-2 border-foreground md:bottom-auto md:left-9 md:right-0 md:top-3 md:h-3 md:w-auto"
              />
            )}
            {/* stop marker */}
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1 h-[26px] w-[26px] rounded-full border-[5px] border-foreground md:top-0 md:h-9 md:w-9 ${
                stop.ev ? "bg-accent-solid" : "bg-background"
              }`}
            />
            <p className="text-xl font-extrabold leading-tight md:text-2xl">{stop.name}</p>
            <p className="mt-0.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
              {stop.role}
              {i === 0 && <LineBullet line={SAMPLE_LEG.line} />}
            </p>
            {stop.ev && <Elevators ev={stop.ev} />}
          </li>
        ))}
      </ol>
      <p className="border-t-2 border-foreground px-4 py-3 text-sm text-muted md:px-6">
        Equipment numbers and descriptions come from the MTA elevator list in this repo. Ask below for the live answer
        with current outages. A route is a candidate: the data does not describe passages between platforms.
      </p>
    </section>
  );
}
