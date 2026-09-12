# Runbook

## Start the local application

From the repository root:

```sh
npm ci
npm run build
npm start
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173). The built server
binds only to loopback and serves both the frontend and API. A quick API check
is:

```sh
curl http://127.0.0.1:4173/api/bootstrap
```

During development, `npm run dev` starts Vite and the API separately. The
development API is at `http://127.0.0.1:4318`; the final walkthrough should
use the built server on port 4173.

## Restore the demo

The saved presentation data is a portable snapshot assembled from
`data/seed/cmu.json`. Restore the current pointer with:

```sh
npm run demo:reset
```

The command validates and publishes the audited seed while retaining newer
immutable snapshots under `data/snapshots/`. The browser's **Reset demo**
control restores the original CMU criteria and clears browser selections such
as the shortlist and comparison. Use it before a repeat presentation if a
previous session changed the search.

The seed is usable with a local server without a fresh housing fetch. Map tiles,
remote listing photos, and fresh route, transit, or nearby-place context need
network access. A changed city or destination may show existing records as
unverified until discovery or routing is run for that context.

## Use live research

Click **Find more homes** or **Find homes here** in the workspace. The job is
bounded and publishes a new immutable snapshot only after validation; the
previous snapshot remains available if a source or worker fails. **Coverage**
shows attempted sources, retrieval dates, observations, duplicates, and known
gaps. **Check a listing** imports one selected public URL from a registered
source. The import is a source check, not proof of the whole market.

Only CMU Off-Campus Housing, Lobos Management, and Reinhold Residential have
direct public page adapters in the seed. Other registered surfaces are links,
search leads, or documented unavailable/blocked paths. No provider API key is
needed to view the seeded demo. Extra web-lead research uses the configured
Claude login when that worker is enabled.

For a quick visual redesign, edit [`src/config/presentation.ts`](../src/config/presentation.ts)
for the wordmark, title, and list/map proportions. Typography, colors, spacing,
and workspace layout live in [`src/styles/tokens.css`](../src/styles/tokens.css),
[`src/styles/base.css`](../src/styles/base.css), and
[`src/styles/workspace.css`](../src/styles/workspace.css).

## Recover from a failed run

If the page cannot load, stop the server, run `npm run demo:reset`, then start
again with `npm start`. If the build is missing or stale, run `npm run build`
first. The server also restores the saved seed automatically when no current
snapshot exists.

If live discovery or routing fails, keep using the current saved snapshot and
read the job message in the workspace. A failed job does not replace the
previous published snapshot. Retry after restoring network access; for a
reliable presentation, reset to the portable seed and continue with the saved
evidence.

## Data and evidence conventions

`data/current.json` points to the current immutable snapshot. Seed observations
and compact provenance are in `data/seed/`; raw source responses are local
captures under `data/raw/` and are ignored by Git. `data/snapshots/` preserves
published history.

Use whole-home, per-room, and per-person rents only with their recorded basis.
Floorplan facts and current vacancy are different claims. Walking calculations
retain raw provider seconds and display rounded-up minutes. Unknown utilities,
fees, or availability remain unresolved rather than being treated as zero or
as a match.
