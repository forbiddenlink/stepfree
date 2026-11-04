import type { Leg, LineEvidence } from "./graph";

// One real trip shape from the MTA elevator equipment list shipped in data/raw/ene_equipment.json.
// 1 Av, Bedford Av and Lorimer St are consecutive accessible stations on the L ("nextada" edges in the
// same file), so the rider rides through Bedford Av and never needs its elevators. Equipment numbers
// and "serving" text are copied from that file. This is a fixture, not live outage status.
export const SAMPLE_LEG: Leg = { line: "L", from: "1 Av", to: "Lorimer St", accessibleHops: 2 };

export const SAMPLE_RIDE_THROUGH = "Bedford Av";

export const SAMPLE_EVIDENCE: { board: LineEvidence; exit: LineEvidence } = {
  board: { complexId: "119", stationName: "1 Av", line: "L", elevators: ["EL293"] },
  exit: { complexId: "123", stationName: "Lorimer St", line: "L", elevators: ["EL778", "EL776"] },
};

export const SAMPLE_SERVING: Record<string, string> = {
  EL293: "E 14 St and Avenue A (SW corner) to Canarsie-bound platform",
  EL778: "Mezzanine to Canarsie-bound platform",
  EL776: "NW corner of Lorimer St and Metropolitan Ave providing access to the mezzanine control area",
};
