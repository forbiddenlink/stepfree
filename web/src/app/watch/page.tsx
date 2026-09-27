import type { Metadata } from "next";
import Link from "next/link";
import { WatchAction } from "./WatchAction";
import { ElevatorIcon, AlertCircleIcon } from "@/components/Icons";

export const metadata: Metadata = { title: "StepFree alerts", robots: { index: false } };

// A button, not an auto-action on load: mail scanners open links, and a GET must never confirm or stop anything.
export default async function WatchPage({ searchParams }: PageProps<"/watch">): Promise<React.JSX.Element> {
  const { a, t } = await searchParams;
  const action = a === "confirm" || a === "stop" ? a : undefined;
  const token = typeof t === "string" ? t : undefined;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-extrabold tracking-tight hover:opacity-80">
          StepFree
        </Link>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
          Elevator Alerts
        </span>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <ElevatorIcon className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold tracking-tight">
            {action === "confirm" ? "Confirm Route Alerts" : action === "stop" ? "Manage Route Alerts" : "Elevator Alerts"}
          </h1>
        </div>

        <div className="mt-4">
          {action && token ? (
            <>
              <p className="mb-5 text-sm text-muted leading-relaxed">
                {action === "confirm"
                  ? "Get one email when an accessible elevator breaks at a station where you board, transfer, or get off on this route."
                  : "Stop elevator alerts for this route. You will not receive any more emails for this trip."}
              </p>
              <WatchAction action={action} token={token} />
            </>
          ) : (
            <div className="rounded-xl bg-bad/10 p-4 text-sm text-bad" role="alert">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircleIcon className="h-4 w-4 shrink-0" />
                <span>This link is not valid or has expired.</span>
              </p>
              <p className="mt-1 text-xs text-foreground/80">
                Confirmation links expire after 48 hours or after single use.
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-sm">
        <Link href="/" className="font-semibold text-accent underline hover:opacity-80">
          ← Return to StepFree trip planner
        </Link>
      </p>
    </main>
  );
}
