# Build status

Start: 2026-09-12 09:01:52 UTC / 5:01:52 a.m. EDT.
User target: approximately 11 a.m. EDT / 15:00 UTC, give or take. The user explicitly prioritizes quality and important implementation/review work over an exact cutoff.

Authorization: build the full application, perform overnight public-source research, iterate and self-improve, invoke Fable and OpenCode Go at the coordinator's discretion, and proceed autonomously within the project's scope. No intermediate approval is required for routine implementation, testing, source research or these reviews.

Current (06:54 a.m. EDT): real source, geographic, API and frontend modules integrated. A second live refresh published 59 options, including previously observed records marked stale; a fresh portable seed is being rebuilt from the audited adapters. Fable's first actual-screen critique has produced a substantial visual revision. All 80 integrated regressions passed before the latest small source/API improvements. Application acceptance has not been reached.

## Task ledger

| Task | State | Evidence / next action |
| --- | --- | --- |
| 1 Contract and foundation | Implemented | Shared Zod contracts, canonical criteria, local toolchain |
| 2 Decision engine | Implemented; reviewed | OpenCode Go GLM-5.3 found six issues; corrections integrated; 30 domain regressions pass. Evidence-aware coordinate fix retained. |
| 3 Real sources and seed | Expanded and audited | Five-record source audit completed; corrected property photos, lease/concession scope, utility applicability and old availability readiness. Fresh captures from three organizations; all 20 surveyed major/local sources represented in registry. |
| 4 Geographic enrichment | Implemented; real routes and context | 36 placed records in the second refresh; provider foot routes, ordered-trip PRT schedule evidence and OSM essentials. New seed enriching with cached verified provider responses. |
| 5 API and jobs | Implemented; integration in progress | Immutable atomic snapshots, bounded processes/jobs, actual public collection, web-lead discovery, imports, routing and destination APIs. API listening 4318. |
| 6 Frontend core | Rendered and reviewed; iterating | Fable 5.1 reviewed real screenshots; reducing density/header waste, strengthening map and compact utility presentation |
| 7 Complete decision loop | Implemented; browser validation pending | Comparison, shortlist, criteria, alternatives, source coverage, discovery and route polling; validate against real data next |
| 8 Reviews and handoff | In progress | Fable visual1, OpenCode domain review, independent source audit and native Terra backend review completed. Second rendered review and full browser/production acceptance remain. |

## Execution decisions

- The user-authorized parallel plan and continuous progress govern execution. Use isolated file/worktree lanes and root integration; do not follow generic skill ceremony that would serialize all independent workers or force repeated approval/review loops.
- Prior 10 a.m. targets are superseded by the user's approximately 11 a.m. target. Aim for an earlier usable candidate; retain important quality work even if the final pass needs modest flexibility.
- Keep this ledger and focused worker reports as the recovery record. Do not repeat completed work after context compaction.


## Recovery pointers

- Primary build: `.worktrees/build`, branch `build/address`. Other isolated lanes: `frontend`, `sources`, `geo`, `domain`.
- Real API: `node --import tsx server/index.ts`, http://127.0.0.1:4318. Frontend worker preview: http://127.0.0.1:5183. Final startup/runbook not yet complete.
- First real seed: `research-20260912100326-5f08229f`; immutable `data/snapshots/`, atomic `data/current.json`, portable `data/seed/cmu.json`.
- OpenCode's domain review and Fable visual1 completed. Automatic review rejected the later backend-source export packet; independent native Terra review completed instead, with no approval pending and no work waiting on the user.
- The live Fable discovery worker completed in 70 seconds with ten public-source leads. Its restricted environment now preserves USER/LOGNAME so Claude can find the existing authenticated login; unrelated secret environment values are not forwarded. No new login was needed.
- A real refresh caught Node 26's lookup-all callback mismatch in the DNS-pinned fetcher. The fix passed a dedicated regression and actual CMU fetch, followed by a successful three-source refresh. Failed collection no longer overwrites the portable source file; served snapshots were preserved throughout.
- Do not count search-index leads, arbitrary assumed facts, or broad building price ranges as confirmed units. Address geocodes are explicitly derived; valid provider foot routes remain computed estimates.
