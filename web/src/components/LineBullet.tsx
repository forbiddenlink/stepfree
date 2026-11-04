// Subway service bullets. Hues follow the public trunk-line colors riders already read on signs; red, green and
// grey are darkened and orange/light green use black text so every bullet letter reaches 4.5:1.
export const LINE_COLORS: Record<string, { bg: string; fg: string }> = {
  "1": { bg: "#DE2F28", fg: "#fff" },
  "2": { bg: "#DE2F28", fg: "#fff" },
  "3": { bg: "#DE2F28", fg: "#fff" },
  "4": { bg: "#008336", fg: "#fff" },
  "5": { bg: "#008336", fg: "#fff" },
  "6": { bg: "#008336", fg: "#fff" },
  "7": { bg: "#B933AD", fg: "#fff" },
  A: { bg: "#0039A6", fg: "#fff" },
  C: { bg: "#0039A6", fg: "#fff" },
  E: { bg: "#0039A6", fg: "#fff" },
  B: { bg: "#FF6319", fg: "#000" },
  D: { bg: "#FF6319", fg: "#000" },
  F: { bg: "#FF6319", fg: "#000" },
  M: { bg: "#FF6319", fg: "#000" },
  G: { bg: "#6CBE45", fg: "#000" },
  J: { bg: "#996633", fg: "#fff" },
  Z: { bg: "#996633", fg: "#fff" },
  L: { bg: "#A7A9AC", fg: "#000" },
  N: { bg: "#FCCC0A", fg: "#000" },
  Q: { bg: "#FCCC0A", fg: "#000" },
  R: { bg: "#FCCC0A", fg: "#000" },
  W: { bg: "#FCCC0A", fg: "#000" },
  S: { bg: "#6E6F71", fg: "#fff" },
};

export function getLineColor(line: string): { bg: string; fg: string } {
  return LINE_COLORS[line] ?? { bg: "#55595f", fg: "#fff" };
}

export function LineBullet({ line }: { line: string }): React.JSX.Element {
  const c = getLineColor(line);
  return (
    <span
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold"
      style={{ background: c.bg, color: c.fg }}
      aria-label={`${line} train`}
    >
      {line}
    </span>
  );
}
