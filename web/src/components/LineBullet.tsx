// Subway service bullets. Colors are the public trunk-line colors riders already read on signs.
const COLORS: Record<string, { bg: string; fg: string }> = {
  "1": { bg: "#EE352E", fg: "#fff" },
  "2": { bg: "#EE352E", fg: "#fff" },
  "3": { bg: "#EE352E", fg: "#fff" },
  "4": { bg: "#00933C", fg: "#fff" },
  "5": { bg: "#00933C", fg: "#fff" },
  "6": { bg: "#00933C", fg: "#fff" },
  "7": { bg: "#B933AD", fg: "#fff" },
  A: { bg: "#0039A6", fg: "#fff" },
  C: { bg: "#0039A6", fg: "#fff" },
  E: { bg: "#0039A6", fg: "#fff" },
  B: { bg: "#FF6319", fg: "#fff" },
  D: { bg: "#FF6319", fg: "#fff" },
  F: { bg: "#FF6319", fg: "#fff" },
  M: { bg: "#FF6319", fg: "#fff" },
  G: { bg: "#6CBE45", fg: "#fff" },
  J: { bg: "#996633", fg: "#fff" },
  Z: { bg: "#996633", fg: "#fff" },
  L: { bg: "#A7A9AC", fg: "#000" },
  N: { bg: "#FCCC0A", fg: "#000" },
  Q: { bg: "#FCCC0A", fg: "#000" },
  R: { bg: "#FCCC0A", fg: "#000" },
  W: { bg: "#FCCC0A", fg: "#000" },
  S: { bg: "#808183", fg: "#fff" },
};

export function LineBullet({ line }: { line: string }): React.JSX.Element {
  const c = COLORS[line] ?? { bg: "#55595f", fg: "#fff" };
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
