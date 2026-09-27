import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteCard, type RouteOutput } from "./RouteCard";

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
