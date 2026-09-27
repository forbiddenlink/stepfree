import { LINE_COLORS } from "./LineBullet";

// A quiet visual signature drawn from the product's own subject: the same
// curved "track" language used on the share card (public/og-image.svg),
// now behind every page. Four real MTA trunk-line colors, kept faint enough
// to sit under any card (including bg-surface/50) without touching contrast.
export function TrackBackdrop(): React.JSX.Element {
  const lines = [
    { color: LINE_COLORS["4"].bg, d: "M-100,140 C300,180 900,60 1600,120" },
    { color: LINE_COLORS.A.bg, d: "M-100,260 C400,220 1000,340 1600,280" },
    { color: LINE_COLORS["1"].bg, d: "M-100,620 C500,660 1000,560 1600,610" },
    { color: LINE_COLORS.N.bg, d: "M-100,780 C400,740 1100,840 1600,790" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-[0.055]">
      <svg viewBox="0 0 1500 900" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {lines.map((l) => (
          <path key={l.color + l.d} d={l.d} stroke={l.color} strokeWidth="3.5" fill="none" />
        ))}
      </svg>
    </div>
  );
}
