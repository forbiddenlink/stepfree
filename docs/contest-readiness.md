# StepFree: contest readiness and completion plan

Assessment: September 23, 2026 (New York). Changes in this assessment are local and uncommitted; the public deployment still runs the previous code.

## Recommendation

Target Path One. StepFree already combines structured transit data, a deterministic route search, Sanity Context, and a policy Knowledge Base. That is a credible starting point, but the current chat presentation and evidence gaps are not yet a strong finished entry. Winning cannot be guaranteed.

The proposed demonstration: a rider inspects a candidate trip, sees the elevators it depends on and their sources, and sees exactly why an outage changes the recommendation. A policy follow-up uses the Knowledge Base and opens the original source. The value is the relationship between station, platform, equipment, outage, time, and source—not the volume of generated text.

Alternatives:

- **Path One, recommended:** concentrate on reliable decisions and visible evidence.
- **Both paths:** only after the agent is complete; requires a separate build-process submission and a convincing content workflow.
- **Path Two first:** better if a custom Sanity editing/review app becomes the central product. The current implementation does not justify this pivot.

The [challenge](https://dev.to/challenges/sanity-2026-09-16) judges Path One on meaningful structured-content/Context use, implementation, Knowledge Bases, and usability. The [official rules](https://dev.to/page/sanity-challenge-v26-09-16-contest-rules) close entries October 4 at 11:59 PM PDT. A DEV submission and Sanity project ID or public dataset link are required. Separate posts are required for entering both paths. Do not sacrifice a complete primary entry to pursue optional features.

## Verified strengths

- The public app at https://stepfree-alpha.vercel.app responds and completes a route question and a policy question.
- The four inspected outage workflow runs succeeded. Actual intervals varied; a 15-minute schedule is not a 15-minute freshness guarantee.
- Public Sanity network reads and a live routing test passed.
- Schema references connect station complexes, lines, equipment, outages, and reliability history. See `studio/schemaTypes/` and `ingest/static.ts`.
- Two separate Context endpoints serve structured data and Knowledge Base material (`web/src/app/api/chat/route.ts:21`).
- Commute subscriptions use a separate private dataset in code. Private subscriber data and credentials were not inspected; privacy settings and delivery were not independently verified.

## Completed technical groundwork

- Active outages remain blocking after an estimated repair time; only actual resolution clears them.
- Boarding/alighting outages now produce an unconfirmed route result, retaining the MTA detour.
- Unknown/partial access is rejected for endpoints and transfers. Passing through a station remains allowed.
- Invalid dates and empty station queries are rejected; exact-name matches exclude looser matches.
- Routing bypasses Sanity's CDN and refuses outage snapshots older than an hour or with an unknown timestamp. The source refresh time is returned separately from the request time.
- The agent instructions require evidence for reliability claims and distinguish feed age from query time. These are instructions, not a guarantee of model behavior.
- Malformed chat messages and client-supplied system roles receive 400 responses. Missing Context configuration receives 503.
- Feed ingestion validates every row and rejects snapshots with no recognized equipment before resolving outages.
- Added a Node version pin, project check/test commands, and a proposed GitHub checks workflow. The workflow has not run remotely yet.

Verification: 30 offline tests, all three TypeScript checks, web lint, and diff checks passed. Studio built successfully. The web production build passed with `pnpm --dir web exec next build --webpack`. Default Turbopack encountered a local process/port permission error; the earlier sandboxed run also could not fetch Google Fonts. Do not claim the default build passed. Studio warned that its auto-updated runtime is 6.16.0 while local packages are 6.15.0. A saved public outage snapshot with 76 rows passed the new validator. No emails were sent and no production content was changed.

## Required before calling the product ready

### 1. Prove the route's accessible connections

Station-level `adaStatus` does not establish every possible transfer inside a complex. The current search allows line changes at a fully accessible complex (`web/src/lib/graph.ts:143`), while ingestion aggregates station ADA flags (`ingest/static.ts:125`). It does not model individual entrance/platform paths or service disruptions.

Model source-backed accessible connections with required equipment references, direction/platform applicability, source URL, and verification time. Only recommend a transfer when its connection is represented. Preserve unknown as unknown. Do not infer that a redundant elevator flag proves another usable elevator remains available.

Acceptance: independently verify several representative trips against official station access information; include partial access, an entrance outage, a transfer outage, a through-station outage, and missing evidence. The result names the exact affected equipment and never converts uncertainty into a confirmed path. Label outputs as candidate routes until this is established.

### 2. Resolve ambiguous names before routing

The tool still selects the first candidate (`web/src/app/api/chat/route.ts:83`). Exact matching is improved, but duplicate or loose names still need clarification with line/borough or a stable station identifier. Do not silently choose a different station because it is accessible.

Acceptance: a query such as “72 St” returns distinguishable candidates; a selected candidate persists through follow-up questions.

### 3. Make evidence visible

In the live demo, the agent assigned high confidence without retrieving reliability. Its policy response named a document but supplied no clickable source. Text currently renders literally (`web/src/app/page.tsx:80`), so Markdown formatting is visible as punctuation and tool sources are not presented.

Claude UI/copy handoff: show a concise decision, required elevators, source update time, relevant warnings, and accessible source links. Show why a proposed alternative differs. Handle tool failure as a failure rather than an indefinitely displayed checking state (`web/src/app/page.tsx:89`). Treat a same-station trip separately from “no route.” Test keyboard access, screen-reader announcements, mobile reflow, and long station names.

Acceptance: a judge can open the evidence supporting every consequential claim without interpreting tool logs. A route answer reports actual source age. Policy deadlines are distinguished from station-specific construction commitments. Do not use a numeric confidence score without an established calculation.

### 4. Complete operational checks

- Test Context outages and stream cancellation. Tool-discovery failures currently fall back silently, and a connected client may not close when discovery fails (`web/src/app/api/chat/route.ts:43`).
- Replace hard-coded reliability leaderboard expectations in `ingest/context-check.ts:40` with a comparison to a current independent public query. Its comment promises a comparison the code does not perform.
- Add an explicit ingestion-run record, especially to represent a valid zero-outage snapshot. The current freshness check derives the latest `lastSeenAt`, and empty feeds deliberately fail closed.
- Verify rate limits separately for chat and subscription creation. Do not infer coverage from UI error handling.
- Make confirmation tokens expire and become unusable after confirmation/unsubscribe; current confirmation can reactivate a stopped watch (`web/src/app/watch/actions.ts:17`). Verify using synthetic records in an isolated test environment. Do not inspect subscriber data in Codex.
- Verify the private dataset's access controls and email flow in the appropriate authorized environment. A successful scheduled job does not prove an email was delivered.
- Resolve the Studio local/runtime version mismatch deliberately before final testing.

## The judge demonstration

1. Choose one independently verified trip with a meaningful accessible transfer.
2. Show the connection and its equipment references in Sanity, then the rider-facing evidence.
3. Show a clearly labeled recorded scenario where a required elevator fails. The alternative changes because of that dependency.
4. Show that an outage at a station merely passed through does not incorrectly invalidate the trip.
5. Ask a relevant policy question and open the Knowledge Base's original source.
6. Show an ambiguous or stale-data case where StepFree asks or declines instead of guessing.

Use a separate, clearly labeled fixture for reproducible outage demonstrations. Never alter the live MTA dataset to create a dramatic result. Keep the live mode available and display its actual freshness.

Acceptance: the demonstration works repeatedly, its assertions have deterministic tests, sources are navigable, and someone unfamiliar with the implementation can explain why structured content was necessary.

## Submission and schedule

- **September 24–27:** close route-model and input-resolution gaps; build the evidence interaction with Claude under the standing UI/copy routing instruction.
- **September 28–30:** run the evaluation cases, keyboard/mobile checks, failure handling, and operational verification.
- **October 1–2:** record the short demo and prepare the DEV post using the official template. Explain real design decisions, limitations, and what AI got wrong. Include repository/demo links and Sanity project `19mt1buh` after verifying the submitted deployment uses it.
- **October 3:** publish and verify every judge-facing link in a signed-out session. Curate any optional agent transcript; do not upload raw sessions containing secrets or private data.
- **October 4:** reserve for final corrections rather than new features.

Avoid adding App SDK, a dashboard, another model, or more cities merely to increase feature count. The first release needs one trustworthy, inspectable decision flow. Product styling, copy, and API design remain routed to Claude under the user's standing instructions; this file supplies the technical findings and acceptance criteria for that work.
