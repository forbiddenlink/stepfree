---
title: StepFree: a subway agent that shows you which elevators your trip depends on
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

<!-- Snapshot of facts as of 2026-09-26. Re-check every number marked (live) on publish day. -->

## What I Built

StepFree answers one question for New Yorkers who can't use stairs: can I get from A to B right now, and which elevators is that answer counting on?

A station being "accessible" isn't enough. A trip only works if the elevators work where you board, where you change trains, and where you get off. The elevators at stations you ride through don't matter at all. So StepFree doesn't treat accessibility as a flag on a station. It treats it as a chain of specific elevators, checks each link against the live MTA outage feed, and shows you the chain.

Ask "Step-free from 1 Av to Times Sq right now?" and you get a route card:

- L from 1 Av to 14 St/6 Av. Board using EL292 or EL293.
- Change to the 1. Leave the L using EL609-EL612, board the 1 using EL615-EL617.
- 1 to Times Sq-42 St. Exit using EL231X, EL232, EL233 or EL619.

Every one of those codes is a real MTA elevator, pulled live, with what it serves ("Mezzanine to uptown 1/2/3 platform"), whether it's working, and its availability over the last 12 months. If one of them is out, the route changes or StepFree says it can't confirm the trip and quotes the MTA's own detour text. It never says a route is guaranteed. It labels every result a candidate route, because the MTA data doesn't describe the passage between platforms inside a station, and I'd rather say that than hide it.

It also:

- Asks instead of guessing when a name is ambiguous. There are three "72 St" stations, and one of them has no elevator.
- Answers policy questions (Access-A-Ride, reduced fare, reporting a broken elevator, the 2022 ADA settlement) from a Sanity Knowledge Base, with links to the source.
- Emails you once when an elevator on a route you saved breaks.

## Demo

- Live app, no login: https://stepfree-alpha.vercel.app
- Try: "Step-free from 1 Av to Times Sq right now?", "Is the elevator at 72 St working?", "What does the 2022 ADA settlement promise, and by when?"

<!-- TODO(Liz): embed the demo GIF/video here once recorded. -->

## Code

https://github.com/forbiddenlink/stepfree

- `web/` Next.js app and agent (`web/src/app/api/chat/route.ts`, routing in `web/src/lib/graph.ts`)
- `studio/` Sanity Studio and schema
- `ingest/` feed loaders, run by GitHub Actions every 15 minutes
- `eval/` the evaluation cases and runner used for the numbers below

![Architecture: MTA feeds into Sanity, two Context MCP endpoints, agent on Vercel](https://raw.githubusercontent.com/forbiddenlink/stepfree/main/docs/architecture.png)

## How I Used Sanity

### The content model is the routing model

Everything lives in one public dataset as linked documents:

- 445 `stationComplex` documents, each with its lines, borough, ADA status, the names of the stations inside it, and 340 `adaNeighbors` edges to the next accessible station per line and direction.
- 707 `equipment` documents (429 elevators, 397 of them ADA), each referencing its complex and the lines it serves, with the MTA's detour text and a precomputed 12-month reliability summary over two years of monthly history.
- `outage` documents that reference the equipment that's out. The ingest never deletes one. When an outage leaves the feed it's marked resolved, so StepFree has kept its own per-outage history since September 19: 857 outages tracked, 808 resolved (live).
- One `ingestRun` document written in the same transaction as each outage update, so "how fresh is this" is a fact, not a guess from the newest outage.

The route search walks (station, line) pairs over the `adaNeighbors` graph. A transfer, a boarding or an exit is allowed only when a working ADA elevator at that station is listed for that line. That rule is one reference hop (`outage -> equipment -> lines[]`), and it's the difference between "this station is accessible" and "this trip is". A keyword search can't answer it, and neither can embeddings over a PDF of station lists.

That rule also makes the answer better. My first version blocked a whole station if any elevator in it was out. Times Sq has a dozen elevators, so it was almost never routable. Scoping each outage to the lines its elevator serves took 394 random station pairs from 323 routable to 333, without allowing a single trip that lacks a working elevator for a line it uses.

### Two Context endpoints, on purpose

- `stepfree-data` (GROQ mode) over the production dataset. The agent uses it for systemwide questions like "which accessible elevators have been out the most this year" with `groq_query` and `schema_explorer`.
- `stepfree-guide` (Knowledge Base mode) over the MTA accessibility pages and the 2022 settlement agreement. The agent reads it with `initial_context` and `knowledge_base_read` for policy answers.

They're separate because an endpoint with a dataset source ignores Knowledge Base sources. The Free plan also caps a Knowledge Base at 150 indexed documents. My first build tried to index the 395 ADA detour texts too and failed at 453 of 150. Detours are structured data anyway, so they stayed in GROQ mode and the Knowledge Base kept the prose.

### What the agent does with it

The model doesn't plan routes. Two typed tools do that from live GROQ reads (no CDN), and the model explains the result. It can call the Context tools directly for anything the route tools don't cover. The route card, the station card, and the station chooser render straight from tool output, so what you see isn't paraphrased by the model.

## How I checked it

I wrote 24 questions across routes, ambiguous names, station status, policy, systemwide data and safety (prompt injection, a station that doesn't exist, an off-topic question). A script sends each one to the live app and grades it with fixed checks: which tool ran, what the tool returned, text the answer must contain (the "check mta.info/elevators" line, an elevator code, a source link) and text it must never contain ("guaranteed to work", a wrong settlement milestone). No model grades another model.

Run on 2026-09-26 against the live app ([eval/results/2026-09-26.json](https://github.com/forbiddenlink/stepfree/blob/main/eval/results/2026-09-26.json)):

- 23 of 24 questions passed, 87 of 88 individual checks.
- Routes 6/6, ambiguous names 4/4, station status 3/4, policy 5/5, systemwide data 2/2, safety 3/3.
- Latency: p50 10.4 s, p95 20.8 s, worst 22.3 s. That's end to end, streaming included.

The one failure is fair. Asked "Are the elevators at Grand Central working right now?", the agent answered correctly, but the elevator codes were only on the status card, not in the sentence. My check reads the sentence. I left the check as written rather than loosen it after seeing the result.

Plus 68 unit tests on the routing, matching, feed validation, alert links and rendering, run in CI on every push.

## What went wrong, and what I changed

- **The agent answered for the wrong 72 St.** 121 of 445 complex names in the source data end in "- Station", so "72 St" matched only the one stop without that suffix. That stop has no elevator, and the agent confidently said so. Worse, "Fulton St" matched only the G stop in Brooklyn, because the Manhattan hub is named "Fulton St (A,C,J,Z,2,3,4,5)". Names are cleaned at ingest now, each complex carries its stations' names ("Atlantic Av-Barclays Ctr" is the station, "Atlantic Av/Pacific St" is the complex), and the agent asks whenever more than one station fits. It never picks one for you.
- **The Knowledge Base misread a table.** The settlement's RFP schedule has a column saying 25% of the designated stations were already "Completed" when it was signed, then 60% by the end of 2023. The Knowledge Base summarized that as "25% by end of 2023". It also lists the settlement as a source without a URL, so the agent borrowed another source's link. I checked section 7 of the PDF, serve the PDF with the app, and give the agent the corrected milestone and the right link.
- **"Confirmed step-free" was a claim I couldn't back up.** Station-level ADA status doesn't prove every platform connects. Routes are now candidates with named evidence, and the card says what isn't verified.
- **A hardening pass broke production twice.** A test in the web app imported a module that needed a root-only dependency, so every Vercel build failed typecheck, and pinning pnpm in two places stopped the 15-minute outage ingest. The app refuses outage data older than an hour, so within an hour it would have refused every trip. CI now builds on every push, and the freshness check comes from an explicit ingest record.

## Limitations

- In-station passages aren't modeled. A route through 14 St/6 Av uses a passage between two stations, and the data says the elevators exist but not that the passage is step-free.
- The MTA outage feed can lag a real breakdown, and StepFree polls it every 15 minutes, so the card shows when the feed was last updated. Always check mta.info/elevators before you leave.
- Direction isn't modeled. If the uptown platform elevator is out, StepFree also refuses the downtown trip at that station. That errs on the safe side, but it's stricter than it needs to be, and it's the next thing I'd fix.

## Sanity Project Details

- Project ID: `19mt1buh`
- Public dataset: `production` ([sample query](https://19mt1buh.api.sanity.io/v2026-09-01/data/query/production?query=*%5B_type%3D%3D%22stationComplex%22%20%26%26%20name%3D%3D%2272%20St%22%5D%7Bname%2CadaStatus%2CstopNames%2C%22lines%22%3Alines%5B%5D-%3Ecode%7D))
- Studio: https://stepfree.sanity.studio

## Agent Session

<!-- TODO(Liz): upload a curated Claude Code transcript at https://dev.to/agent_sessions/new, check it for keys and email addresses, click Make Public, and embed it here. -->
