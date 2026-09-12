# Backend/API integration review — 2026-09-12

Scope: current `server/`, source-collection, route, schema, and API tests in the build worktree. Findings are limited to P1 correctness/security boundaries. The immutable snapshot write order and bounded subprocess wrapper are sound in the reviewed paths.

## P1 — Find More never verifies the newly discovered listing pages

- **Trigger:** Start discovery for Pittsburgh with the research worker enabled. It returns a direct-manager or CMU/Lobos lead URL that was not one of the three registry landing pages.
- **Location / root cause:** `server/workflows.ts:32-64` runs `collectSources`, which only fetches `SOURCE_REGISTRY` public-page URLs (`jobs/sources/collect.ts:78-105`). It then sends every worker result straight to `appendLeads` (`server/workflows.ts:44-46`; `server/research.ts:69-85`). `appendLeads` deliberately creates unknown hard facts and `search_index` evidence; it does not call `fetchPublicPage` or an adapter. The only path that fetches a discovered detail URL is a separate manual `/api/import` request.
- **Impact:** Live discovery re-fetches the same selected landing pages, while its “new” URLs remain unverified leads. It cannot fulfill the source-collection → evidence-preservation promise for newly selected public pages and may make Find More look broader than its verified inventory.
- **Bounded fix:** After lead discovery, deduplicate URLs, admit only registered-host URLs with a compatible parser, then bounded-fetch and parse a small fixed batch through the existing capture/evidence pipeline. Keep unsupported hosts/pages as explicitly unverified leads and record per-URL source-run outcomes. Add an integration test proving a discovered registered detail page becomes a parsed `Home`, while an unregistered lead remains a lead.

## P1 — Different discovery requests are queued instead of rejected as busy

- **Trigger:** Submit discovery with criteria A, then quickly submit different criteria B before A settles.
- **Location / root cause:** `createJobManager.start` only coalesces equal `(type,key)` jobs and accepts up to three queued/running jobs (`server/jobs.ts:18-23`). `/api/discovery` therefore returns a new 202 job for B (`server/api.ts:55-60`) even though a discovery is already active.
- **Impact:** Multiple expensive source/model refreshes can be scheduled from repeated edits. The later job publishes after the earlier one and moves `current.json`, so stale user intent can replace the just-reviewed snapshot. This conflicts with the one-active-discovery API contract and its specified busy response for a different in-flight request.
- **Bounded fix:** Have the manager expose the active discovery entry. For a duplicate key return it; for a different key return `RESEARCH_BUSY` (including the active job ID in a typed response) before enqueueing. Keep route serialization separately if desired. Test A→B returns busy and invokes only A’s worker.

## P1 — Queued route jobs are not isolated to the snapshot validated by the API

- **Trigger:** Start a discovery job; while it is running, POST `/api/routes` against the still-current snapshot. The API validates that snapshot and queues the route job behind discovery.
- **Location / root cause:** `/api/routes` checks `body.snapshotId` only at submission (`server/api.ts:62-70`), but the workflow receives no snapshot ID. When it eventually runs, `routes` reloads whatever is current at that moment (`server/workflows.ts:66-71`).
- **Impact:** If discovery publishes first, the route operation silently applies old `homeIds` to the new snapshot (possibly no homes at all) and publishes a route-result snapshot based on different inventory/market than the caller selected. The client cannot safely reconcile that result using the submitted snapshot/version semantics.
- **Bounded fix:** Pass the requested snapshot ID into the workflow and load that immutable snapshot, or re-check that `current.id` still equals it immediately before routing and fail the job with `STALE_SNAPSHOT`. Test the interleaving: a queued route after publication must fail stale (or demonstrably route the requested immutable snapshot), never publish a mixed result.

## P1 — Import enrichment silently routes to Gates after the user changes destination

- **Trigger:** Change destination, receive/publish routes for that destination, then import a supported listing page.
- **Location / root cause:** `importListing` builds its criteria from `SEED_CRITERIA` plus only the current market (`server/workflows.ts:80-83`) and calls `placeHomes`/`enrichRoutes` with `criteria.destination` (`server/workflows.ts:102-104`). The import request has neither a snapshot ID nor active destination, so it cannot preserve the user’s selected destination/version.
- **Impact:** Imported homes are geocoded and routed to Gates Hillman even in an alternate-destination workflow. The published snapshot mixes route versions and can expose a Gates route as newly current for a search whose qualification is based on another destination.
- **Bounded fix:** Carry `{snapshotId, destination}` (or validated active criteria) on import, reject stale snapshots, and use that destination for placement/enrichment. If the contract must keep import payload unchanged, do not compute import routes; preserve existing routes and mark the imported home’s route unknown until an explicit `/api/routes` call. Add a changed-destination import test.

## P1 — Registered-host fetches do not enforce the private-address boundary after DNS resolution

- **Trigger:** A registered source hostname resolves to a loopback, link-local, RFC1918, or other private address (for example through DNS rebinding or a compromised resolver).
- **Location / root cause:** `jobs/sources/public-page.ts:19-30` rejects literal IP hostnames but does not resolve and validate the address used by `fetch`. Redirects only rerun the same hostname allowlist (`:59-69`).
- **Impact:** The import/discovery fetcher can be induced to connect to a private service under a registered hostname. This bypasses the contract requirement to reject private/loopback/link-local destinations and recheck redirects; the local-only API does not remove the data-exfiltration risk from server-side fetches.
- **Bounded fix:** Before every initial and redirect request, resolve the allowlisted hostname and reject non-public addresses. Use a fetch dispatcher/lookup that connects only to the validated public result so a second DNS lookup cannot rebind the request; retain the existing one-redirect limit. Add resolver-injected tests for loopback, RFC1918, link-local, and redirect resolution.
