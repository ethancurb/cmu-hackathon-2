# Verified morning demo — September 12, 2026

The full application is integrated into `main` and running from the repository root at **http://127.0.0.1:4173**. The implementation commit is `c434d5a`; subsequent handoff changes contain documentation and rendered acceptance artifacts. The background server was started at 07:56 a.m. EDT. Its local process record and log are in `data/worker/server.json` and `data/worker/server.log`.

## Final checks

| Check | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` in the main workspace | Locked dependencies installed successfully |
| `npm run build` in the main workspace | TypeScript, frontend bundle and compiled server passed |
| `npm test` in the main workspace | **92 tests passed in 21 files** |
| `npm run test:browser` against the main production server | **5 flows passed**, with no JavaScript page errors |
| Cold production start from the main workspace | Restored the portable seed automatically; bootstrap and evaluated search returned successfully |
| Actual live discovery job | Completed in about 71 seconds; published a 65-record snapshot with source gaps and six search-index leads explicitly retained as unverified |
| Actual destination and import APIs | Invalidated Gates routes, computed three Hunt Library routes, and fetched a Bentley unit URL without duplicating that unit |
| Actual browser city change | Public geocoder found the Empire State Building; New York showed no Pittsburgh result rows; Reset restored the CMU search |
| Criteria and source uncertainty | Rent sort changed ordering; requiring included electricity prevented unknown inclusion from qualifying |
| External network failure | Saved facts and route geometry remained usable with all external map/photo requests blocked; basemap failure was disclosed |

The five automated browser flows cover the zero-match search and reversible $7.50 alternative, comparison independent of shortlist with persistence, detail evidence and Gates route/bus context, coverage gaps, and mobile usability. The route assertion checks the rendered SVG endpoint against the destination marker; the recorded separation was 2.66 pixels, within the 6-pixel acceptance limit. Provider geometry and the mapped entrance coordinates were preserved.

## What the user will open

Portable snapshot: `research-20260912114226-842aacf0`. Housing pages were observed at approximately **07:00 a.m. EDT on September 12**, separately from the later snapshot assembly timestamp.

| Seeded evidence | Count or behavior |
| --- | --- |
| Researched offers and leads | 49 |
| Direct housing organizations | 3: CMU Off-Campus Housing, Lobos Management, Reinhold Residential |
| Registered major/local housing sources | 20; unsupported or unsearched sources remain disclosed |
| Placed records | 30 |
| Usable foot routes to Gates | 24 |
| Homes with destination-scoped PRT context | 30 |
| Homes with sourced nearby essentials | 21 |
| Default fit | 0 matches, 42 near matches, 7 needing verification |

The visible starting criteria are $1,200 personal monthly base rent, two equal occupants as an editable assumption, exactly two bedrooms, at least two advertised bathrooms, houses/apartments, and at most 1,200 raw walking seconds to Gates Hillman's mapped entrance. Move-in and lease timing remain flexible.

Webster Hall B2 is advertised at $2,415 whole-home rent, giving $1,207.50 per person under the two-share assumption. A $7.50 cap increase makes its recorded hard requirements pass. Schenley House offers the one-bathroom compromise; 6350 Forward preserves the 2BR/2BA layout and lower advertised rent at a substantially longer walk. These are sourced tradeoffs, not a promise of current vacancy.

## Reviews and iterations

The panel used Codex Astra coordination with bounded Luna, Terra and Sol work. Actual Fable 5.1 and OpenCode Go responses were validated during planning and implementation. OpenCode Go reviewed the decision engine; independent native reviews covered API integration and the housing evidence audit. Fable reviewed the proposed design and two actual rendered frontend candidates. Those reviews drove criteria-first hierarchy, compact evidence rows, map treatment, explicit sorting, comparison access, and mobile repairs.

An independent native Sol reviewer inspected the final desktop/detail/mobile screenshots and found no visual release blocker. The final small mobile heading repair is included in the production captures below.

Automatic approval review rejected two later external exports: a backend source packet and the final Fable screenshot follow-up. The stated reason was that the earlier approval did not cover those new payloads. The rejected exports were not retried through another channel. Independent native reviews completed the relevant checks, so no approval or work remains pending.

## Evidence and practical boundaries

- [Production snapshot and counts](artifacts/production-acceptance.json)
- [Live discovery job](artifacts/live-discovery-acceptance.json)
- [Real destination, routing and URL import](artifacts/destination-import-acceptance.json)
- [City, sorting and utility checks](artifacts/final-city-preferences-acceptance.json)
- [External-network failure check](artifacts/network-fallback-acceptance.json)
- [Desktop](artifacts/production-desktop.png), [detail](artifacts/production-detail.png), [mobile list](artifacts/production-mobile.png), [mobile map](artifacts/production-mobile-map.png)
- [Review resolutions](reviews/RESOLUTIONS.md) and [final independent visual review](reviews/final-local-visual-review.md)
- [Source coverage audit](reports/coverage-audit.md), [runbook](runbook.md), and [90-second demo](demo.md)

The seed is a bounded source sample, not an exhaustive city inventory. Broad portals are surveyed/linked or used as explicitly unverified discovery leads; they are not represented as working direct scrapers. New-city discovery can surface leads but does not inherit Pittsburgh's adapters, confirmed homes or PRT coverage. Floor plans, building leads and specific units keep their different evidence scopes. Utility inclusion and additional costs can remain unknown. Transit is schedule context for a stated date/window, not live arrival prediction. Physical entrance access and current vacancy are unconfirmed.

The viewing experience works from the saved snapshot without fresh housing requests. The local server must remain running; fresh research, remote photos and basemap tiles require network access. `npm run demo:reset` restores the portable data pointer while retaining research history; the browser's Reset demo button restores criteria and selections. Original prompts, refinements and useful assistant decisions remain in `docs/context/`.
