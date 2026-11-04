import Link from "next/link";
import { ElevatorIcon } from "./Icons";

// The black sign band every page starts with: green pictogram tile, wordmark, then the page's own label.
export function SiteBar({ label, children }: { label: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <header className="bg-[#111111] text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline-white"
            aria-label="StepFree home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#0a7d4b] text-white">
              <ElevatorIcon className="h-7 w-7" />
            </span>
            <span className="text-2xl font-extrabold tracking-tight">StepFree</span>
          </Link>
          <span className="border-l-2 border-white/60 pl-3 text-sm font-bold uppercase tracking-wider">{label}</span>
        </div>
        {children}
      </div>
    </header>
  );
}
