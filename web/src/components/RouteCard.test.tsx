import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteCard, type RouteOutput } from "./RouteCard";

describe("RouteCard", () => {
  it("renders a candidate route with vertical transit itinerary and elevator evidence", () => {
    const html = renderToStaticMarkup(
      <RouteCard
        route={{
          ok: true,
          from: "1 Av",
          to: "Times Sq-42 St",
          fromId: "123",
          toId: "456",
          basis: "Verified against live MTA elevator status",
          sourceUpdatedAt: "2026-09-26T20:00:00Z",
          travelTime: "2026-09-26T20:30:00Z",
          legs: [
            {
              line: "L",
              from: "1 Av",
              to: "14 St/6 Av",
              accessibleHops: 3,
            },
            {
              line: "1",
              from: "14 St/6 Av",
              to: "Times Sq-42 St",
              accessibleHops: 4,
            },
          ],
          evidence: [
            { line: "L", complexId: "123", stationName: "1 Av", elevators: ["EL292", "EL293"] },
            { line: "L", complexId: "234", stationName: "14 St/6 Av", elevators: ["EL609"] },
            { line: "1", complexId: "234", stationName: "14 St/6 Av", elevators: ["EL615"] },
            { line: "1", complexId: "456", stationName: "Times Sq-42 St", elevators: ["EL232"] },
          ],
          equipmentOnRoute: [
            {
              complexId: "123",
              stationName: "1 Av",
              role: "origin",
              hasOutage: false,
              elevators: [
                {
                  equipmentNo: "EL292",
                  serving: "Street to mezzanine",
                  isOut: false,
                  availability12mo: 0.98,
                },
              ],
            },
          ],
        }}
      />
    );

    expect(html).toContain("Candidate step-free route");
    expect(html).toContain("1 Av");
    expect(html).toContain("Times Sq-42 St");
    expect(html).toContain("Transit Itinerary");
    expect(html).toContain("EL292");
    expect(html).toContain("EL293");
    expect(html).toContain("Board");
    expect(html).toContain("Exit");
    expect(html).toContain("accessible stop");
    expect(html).toContain("Elevators at these stations");
    expect(html).toContain("98% 12-mo uptime");
  });

  it("renders non-viable route warning cleanly", () => {
    const html = renderToStaticMarkup(
      <RouteCard
        route={{
          ok: false,
          from: "1 Av",
          to: "72 St",
          reason: "Key elevator EL292 is out of service.",
        }}
      />
    );

    expect(html).toContain("Cannot confirm step-free");
    expect(html).toContain("Step-free route not viable");
    expect(html).toContain("Key elevator EL292 is out of service.");
  });

  it("renders same-station notice when from and to are identical", () => {
    const html = renderToStaticMarkup(
      <RouteCard
        route={{
          ok: true,
          from: "Times Sq-42 St",
          to: "Times Sq-42 St",
          legs: [],
        }}
      />
    );

    expect(html).toContain("Origin and destination are the same station (Times Sq-42 St)");
    expect(html).toContain("No subway ride needed.");
  });
});

const sameStation: RouteOutput = {
  ok: true,
  from: "Grand Central-42 St",
  to: "Grand Central-42 St",
  fromId: "631",
  toId: "631",
};

describe("RouteCard footer", () => {
  it('labels route.travelTime as the checked-for time, not "Travel time"', () => {
    // travelTime is the departAt query time (route.ts sets it to `at.toISOString()`),
    // not a trip duration, so the footer must not call it "Travel time".
    const html = renderToStaticMarkup(
      <RouteCard route={{ ...sameStation, sourceUpdatedAt: "2026-09-26T20:00:00Z", travelTime: "2026-09-26T20:30:00Z" }} />,
    );
    expect(html).toContain("Checked for:");
    expect(html).not.toContain("Travel time:");
  });

  it("never renders the raw checkmark dingbat in user-facing copy", () => {
    const html = renderToStaticMarkup(<RouteCard route={sameStation} />);
    expect(html).not.toContain("✓"); // "✓"
  });
});

describe("RouteCard accent tokens", () => {
  it("uses the solid accent token for equipment 'on your route' pills, not the light-mode-only accent tint", () => {
    const route: RouteOutput = {
      ok: true,
      from: "72 St",
      to: "96 St",
      fromId: "1",
      toId: "2",
      legs: [{ line: "1", from: "72 St", to: "96 St", accessibleHops: 1 }],
      evidence: [{ complexId: "1", stationName: "72 St", line: "1", elevators: ["EL1"] }],
      equipmentOnRoute: [
        {
          complexId: "1",
          stationName: "72 St",
          role: "origin",
          hasOutage: false,
          elevators: [{ equipmentNo: "EL1", isOut: false }],
        },
      ],
    };
    const html = renderToStaticMarkup(<RouteCard route={route} />);
    expect(html).toContain("on your route");
    // bg-accent/15 on text-accent failed WCAG AA contrast (4.4:1, measured with axe-core);
    // bg-accent/10 is the fix, so guard against the old class coming back.
    expect(html).not.toContain("bg-accent/15");
  });
});
