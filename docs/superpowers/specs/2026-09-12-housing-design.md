# Housing decision workspace — design specification

Status: reviewable design for the user's final build go. Planning and capability probes are complete enough to specify implementation; application code has not started. Working title: **Address** (editable presentation copy, not a claim of a unique brand).

Controlling brief: [PROJECT.md](../../../PROJECT.md). Conversation: [commission](../../context/COMMISSION.md), [decisions C01–C22](../../context/DECISIONS.md). Execution: [implementation plan](../plans/2026-09-12-housing.md). Shared interfaces: [CONTRACTS.md](../../CONTRACTS.md).

## 1. Product promise and three required outcomes

Help someone research a fragmented housing market, compare how homes affect daily life, and reconsider preferences without restarting the research. The visible question is: **Which places fit my life, what am I sacrificing, and what small change would unlock better options?**

The three integrated outcomes are:

1. **A sourced, refreshable inventory.** Broad discovery over a declared market and source set; distinct options reconciled across sources; meaningful lists, source coverage, observation dates, and gaps. CMU is the initial saved search. The application performs discovery; uploading one's own URLs is a fallback, not the primary interaction.
2. **An evidence-based comparison of living there.** Rent share, fees, utilities, Gates Hillman walking route, useful bus service, essentials nearby, amenities and sourced qualitative context are visible together. Selecting a home connects its evidence to a real point on the map.
3. **A working reconsideration and shortlist loop.** Change one requirement; see which researched homes become eligible and the exact cost of that change; compare homes; save the ones worth investigating with consequential unanswered questions.

The defensible differentiator is the combined demonstrated workflow: source reconciliation, correctly scoped evidence, rent/utility accounting, destination routing, and recomputation. Natural-language rental search, aggregation, and recommendations already exist. No claim to search every home or be the first AI rental finder is supported. Optimization is the recommended hackathon track.

## 2. Fixed demonstration configuration

| Item | Initial value and interpretation |
| --- | --- |
| Market | Pittsburgh, Pennsylvania; discovery begins with Oakland, Shadyside, Squirrel Hill and adjacent CMU housing areas |
| Destination | Gates Hillman — mapped entrance; latitude 40.4440338, longitude -79.9445593; OSM entrance node 1704796692, building way 27623372 |
| Destination evidence | CMU identifies Gates/Hillman at 4902 Forbes Avenue; the exact coordinate is an OSM mapped main entrance. Visual/physical confirmation of which named entrance it is remains incomplete. Do not call the OSM node the verified Forbes entrance |
| Walking requirement | Computed pedestrian route duration <=1,200 seconds to that coordinate; no radius, campus commute label, driving route or bus substitution |
| Layout | Exactly 2 bedrooms; at least 2 advertised bathrooms, with the chip labeled `2 beds · 2+ baths`. A 1.5-bath listing does not pass. Preserve source full/half counts when given; do not invent a decomposition |
| Property type | House or apartment; duplex units can be apartments. Rooms alone and dorm beds remain leads unless whole-home scope is established |
| Rent budget | Personal base-rent share <=120,000 USD cents/month. Two equal rent shares is an explicit editable assumption, producing a whole-home ceiling of 240,000 cents/month |
| Split changes | Edit household occupants and personal percentage. Equal split sets percentage to 1 / occupants; custom split uses a positive fraction <=1. A changed split changes the computed ceiling and ranking; it does not create a roommate or a vacancy |
| Timing | Flexible move-in and lease length; show reported availability and terms. A listing's claim of availability is not independently confirmed vacancy |
| First viewing | September 12, 2026, around 10–11 a.m. EDT; internal ready target 10 a.m. EDT / 14:00 UTC |

The app opens directly into this saved search. The title, destination control, selected route, and route-time labels all name Gates Hillman. Generalization uses the same market, destination, preference, source, and routing contracts; changing location is real input, not changing only the page title.

## 3. What a match means

Evaluate each hard requirement as `pass`, `fail`, or `unknown`. A home **matches selected requirements** only when every active hard requirement passes. A known failure makes it a near-match/excluded option; unresolved hard requirements are also retained and listed. With no failures but a missing hard fact, it is `needs verification`. In every category show all failures and unknowns.

**Decision readiness is separate from constraint fit.** Unknown utilities, fees, property condition, or vacancy can leave a matched home requiring investigation. They do not silently fail the rent-only budget. Conversely, missing bathroom count, ambiguous rent basis, or a missing walking route cannot pass a corresponding hard filter. Do not call a matched record a “verified home.” Timing stays flexible and display/readiness-only for the morning build; advanced date/lease filters require normalized source fields before being enabled.

A broad price range or building-level starting price is not a quote for every unit. Such records remain useful leads, with a range and scope label, until a layout-specific/unit-specific quote establishes eligibility. A genuinely unit-specific per-room quote is not a whole-unit quote; it is shown as a separate rental offer. The initial whole-home search does not multiply a room quote into assumed availability of a complete home.

Sort by a user-selected observable quantity: personal rent share, walking time, unresolved cost items, or last observation. Default order: matched requirements, then needs-verification, then near-matches grouped by the requirement they miss. Within each group use personal rent share ascending, walking seconds ascending, then stable ID. Unknown numeric values sort last. Show the ordering rule; do not invent a weighted “fit score.”

If there are zero matches, say `0 match these requirements in the researched inventory`, keep the inventory and map useful, and expose honest near-matches. Never pad counts or quietly alter the seed.

## 4. Acquisition, evidence and coverage

### Proven path and its limits

Research visited the major source set: Zillow, Trulia, HotPads, Apartments.com, Realtor.com, Redfin, Rent.com, Apartment Guide, Zumper, PadMapper, Apartment List, Homes.com, Craigslist and Facebook Marketplace, plus CMU's marketplace and local managers. Findings and URLs are in [housing-sources.md](../../research/housing-sources.md). Surveying a portal is not successfully importing its inventory. Related portals often share feeds.

CMU and Lobos returned readable HTML from the local runtime. A separate Claude CLI probe performed public search and fetch successfully. However, the probe attached the availability date of a one-bedroom unit to a two-bedroom unit. The independent source check exposed the error. This is a concrete reason to preserve table/record boundaries and audit extraction, not evidence that model output can be trusted as data. See [runtime validation](../../research/runtime-validation.md).

The overnight build uses a **local research worker** plus small direct-page adapters. It is a local demonstrator using the user's authenticated subscriptions; it is not a publicly deployable multi-user AI service. No application API credentials have been established.

### Required discovery loop

1. A fixed source registry stores site/family, checked URL, access mode, observation status, and limitation. Portals with known restrictive automation terms stay `link_only`/discovery references; login and denied sources are visible gaps. Do not evade those controls or present an index snippet as a live unit record.
2. `Find more homes` creates one bounded job from the market, destination and current criteria. Initial query templates include the requested layout plus nearby-area queries without the bath constraint, so near-matches are researched too. Source-targeted queries cover the registry. The worker discovers links through Claude's built-in WebSearch; supported direct manager/CMU pages are fetched by bounded adapters. User URL/text import feeds the same pipeline if a source is otherwise unavailable.
3. Direct-page adapters preserve individual offer/floor-plan/table-row boundaries. HTML scripts/styles are removed, but relevant structured JSON and row labels are retained. Do not flatten an entire multi-unit building into one description. Raw captures remain local; only necessary facts, short evidence excerpts and original links enter the demo snapshot.
4. Structured extraction uses deterministic parsing for labeled prices/counts and the bounded LLM for messy descriptions/utilities. Each proposed fact must point to captured evidence and its record scope. Reject missing evidence references, unsupported numbers, unrelated-unit spans, invalid units, invented quotes, and ambiguous values. Unresolved proposals enter quarantine or become unknowns, rather than blocking all other results.
5. Normalize and conservatively deduplicate. Same address is a building relationship, not proof of the same unit. Preserve separate offers if unit/plan identity is uncertain. Show conflicting current claims; do not manufacture certainty by averaging them. A direct-manager record is useful evidence, not an automatic truth override.
6. Geocode, route and enrich supported records. Validate and atomically publish a new immutable snapshot; retain the last good snapshot. Every serving response contains the snapshot ID. A refresh shows added/changed/newly missing observations, checked sources, and failures. A missing search result does not establish that a home was rented.

Do this twice during implementation. The second run must re-fetch at least one actual supported source; a replayed fixture or timestamp-only rewrite does not prove refresh. Zero changed listings is a legitimate diff. A source failure retains older facts with their original dates and a stale/failed-refresh indicator.

### Bounds and unattended behavior

One discovery job at a time. First batch: at most 4 searches per CLI invocation, 12 discovered detail URLs, 150 seconds per CLI call, 15 seconds and 12 MB per HTML fetch, two concurrent source fetches, one retry only for a transient error. No retry for login, 401/403, explicit denial or invalid extraction. A refresh job has a 6-minute wall-clock limit and publishes useful validated partial results when appropriate. If discovery fails, keep the last snapshot, name the failed source, and make source links/import available; do not show a fabricated success.

Spawn model commands with an argv array and `shell:false`; no user text becomes a command or filesystem path. Research tools are restricted to public search/fetch; extraction/review has tools disabled. Source pages are untrusted data and cannot authorize actions. Bind the demo API to loopback; reject cross-origin mutation requests. No accounts, messages, tours, rental applications, or payments are created.

### Seed acceptance

Target 18–30 distinct useful housing options; minimum useful morning dataset: 12 addressed options across at least 3 independent source organizations, including both known details and honestly unresolved leads. Aim for at least 8 computed walking routes and 3 records with substantive utility evidence; retain real shortfalls explicitly. Records must be actual current research observations, not fabricated fixtures. A meaningful seed is a release criterion; if collection is short, use the time reserved for optional polish to widen supported-source research. Never force a count of exact matches.

Attach observation time and original source to all records, and source scope to all material claims. Keep historical/off-market records separate from current research. Seed curation and the five-record provenance audit are performed by agents during construction; the sleeping user is not a required reviewer.

Coverage distinguishes surveyed, queried, successfully fetched, imported, blocked/failed, and not searched. Display distinct options and duplicate observations; show per-source counts and query limits. Structured `ResearchScope` records market/areas, query filters, destination version, walk scenario, date and bounds so `needsDiscovery` has an explicit rule. Do not sum portal market counters or claim a percentage of all city inventory. Wider criteria reuse known homes immediately and state when new discovery is needed.

## 5. Costs, utilities and everyday consequences

Price presentation has three distinct quantities: whole-home base rent, the calculated personal rent share with its split, and known recurring housing charges. Required fees, refundable deposits, application/admin charges and concession conditions remain separate. A source's advertised/effective total does not automatically become base rent.

Utilities appear in the same order everywhere: electricity, gas, water/sewer, trash, internet, other. States: included, separate, partly included, not stated. Preserve allowances, caps, allocation formulas and usage dependence. A separately billed utility without a numeric charge is unresolved, not zero. An included capped utility may still have an unresolved excess charge. `Other` means other *listed* charges; absence does not imply an invented sixth bill.

Show `Known monthly: $… + unresolved charges` when incomplete, and identify which components are known. Never call it an all-in total when fees or usage costs remain unknown. An optional user-entered estimate is labeled and excluded from sourced totals; morning scope does not need modeled utility price estimates.

Daily-life detail and comparison include:

- Route length/time to the selected destination, profile, date and mapped endpoint.
- Nearby PRT stops plus relevant routes/headsigns and scheduled service context. Confirm an origin-side stop and a campus-side stop occur in the correct order on the same valid service/trip before saying the bus serves this commute. Display the weekday/time window used. Otherwise say only `nearby stop`, without claiming destination service.
- Grocery, pharmacy and useful errands from OSM, category/name/source/date and clearly labeled straight-line metres or separately routed walking minutes. Missing OSM records do not mean no stores exist. Limit to the nearest few useful items, with more available in details.
- Property type, laundry, parking, pets, access features and any stated perks. Sourced house/management reviews may be linked with platform/date/sample count and scope; do not invent a composite quality score, turn a building review into a unit fact, or infer demographic neighborhood quality.
- Availability, lease conditions and questions that matter before a tour. Rank questions by decision impact: unknown base rent/baths/route first, unresolved recurring bills next, timing and feature verification next. Keep each question attached to the missing/conflicting evidence.

## 6. Routing and geographic behavior

Use Leaflet with attributed OSM tiles and a persistent destination marker. FOSSGIS `routed-foot` is the demonstrated walking provider, even though the OSRM URL path contains `driving`. Validate the configured foot endpoint, response geometry, finite seconds/metres, and walking step modes. Compare raw duration seconds to the threshold before display rounding.

Throttle routing to at most one request/second; cache by origin, destination coordinate/version, provider and profile. Save requested and snapped coordinates; a snap more than 75 m from either input is `needs review`, not a qualifying route. Precompute seed routes. Label them `computed walking route · captured [time]`; they are not physical inspections or guaranteed accessible paths. Persist failures without inventing substitute walking times.

The point-to-point probe succeeded; an isochrone was not demonstrated. **Do not draw a 20-minute walking boundary.** Selecting a home draws its computed route. Without map tiles, the list, cached route facts and comparisons work; show `basemap unavailable` rather than a fake map. No bulk tile downloading.

Changing destination geocodes on explicit submit with Nominatim's limit/cache, or accepts an editable map pin. The Gates seed uses saved coordinates because a name query returned no result. Routes for a new destination are distinct jobs; invalidate old qualification immediately, show `recomputing route`, and preserve the original scenario for comparison. Newly selected cities show an honest research-empty state until new discovery returns results.

PRT static GTFS is the morning transit source; the observed feed is valid June 28–October 14, 2026. Handle service exceptions, agency timezone, stop sequence and times past 24:00. Exact live arrivals, crowding, full multimodal planning and unsupported transit coverage for other cities are outside morning scope. OSM and PRT attribution/license notices accompany their derived data. See [geo-feasibility.md](../../research/geo-feasibility.md).

## 7. Interface specification

The final direction adopts the useful structure from research and Fable's correction of its styling. [Fable review](../../reviews/fable-design.md) is advisory; this specification controls.

**Desktop:** approximately 58% scrollable option list, 42% map, with a slim working header and an editable assumption sentence. No marketing hero or generic dashboard tiles. Example: `Your share $1,200 · 2 equal shares assumed · $2,400 home · 2 beds / 2+ baths · 20 min walk to Gates Hillman`. Each relevant term opens a small accessible editor; secondary requirements live in a clearly named `More preferences` disclosure. The household ceiling is derived; editing it updates the personal cap visibly rather than silently creating two budgets.

**Evidence strip:** show current inventory count, match/unknown counts, sources checked and time; expand to the source ledger. Use real snapshot counts from the first render; no decorative metric values or invented “hours saved.”

**Rows:** numbered options with aligned columns for address/type/layout, whole-home and personal rent, and walk minutes. Fixed-order textual utility statuses occupy a compact second line. Example readable label: `Electric · not stated`, not six unexplained glyphs. Optional small real property photos only where available with their source; an absent image collapses the image space or says no source photo, never a generated home. Status and one factual consequence are visible. At 58% width, avoid cramming five independent blocks side by side; split each row into clear primary and evidence lines.

**Selection and map:** numbered map pins match list numbers, hover/focus connects them, click selects and scrolls the corresponding row into view. Gates Hillman is a labeled square. Use a route-blue selected path, explicit hollow near-match pins, and text labels that survive grayscale. Selected details open in the list pane while retaining a compact selected-row summary and the full map; back/close restores list scroll. This resolves the original review's too-narrow one-third-width drawer.

**Cost detail:** named fact rows expose rent calculations, mandatory fees, individual utilities, caveats, source excerpts and observation dates. Unknown cost count and unresolved-charge wording remain visible in list and compare, not just this detail view.

**Alternative controls:** show computed one-change options such as `25 min walk: +3 eligible homes` only when derived from this snapshot. Preview shows the original requirement, changed requirement, newly eligible IDs and exact deviations. Apply updates the actual criteria; revert restores them. Candidate suggestions use smallest observed rent/walk thresholds, plus explicit bathroom alternatives (2 → 1.5 or 1). Prefer one requirement at a time. If two changes are necessary, label both and make that clear; do not pretend one unlocked the home. No large speculative combinations engine is required.

**Comparison and readiness:** pin up to three homes to a bottom shortlist rail. A comparison sheet aligns layout, rent/share, recurring-cost completeness, six utilities, walk, bus, errands, amenities, timing and unresolved questions. Source links remain available. Favorites survive preference changes and refreshes; an old favorite shows why it no longer matches or is stale. The export/copy summary is local text, not a message to a landlord.

**Visual system:** self-hosted IBM Plex Sans with tabular numbers, IBM Plex Mono for dates/provenance. Canvas #FAFAF8, ink #141614, route blue #2456A8, amber #B8720F for deviations/unknowns; verify text contrast and darken amber text where required. Display prices and minutes at about 22/26, body 15/22, metadata 13/18, title 28/32. 4 px spacing scale; 16 px row vertical padding; deliberate rules and whitespace. Use modest corners only on controls; avoid a repeated rounded-card aesthetic. No gradient hero, decorative serif, big fake score, or AI chat greeting. A restrained wordmark and precise hierarchy carry personality.

**Adaptability:** typography, color, spacing, pane ratio and row density live in CSS variables in `src/styles/tokens.css`. Layout components consume shared view models; changing visual style cannot change money arithmetic, qualification or source truth. A presentation config holds title and default map/list ratio.

**Responsive/accessibility:** at <900 px show list with a clear Map switch/sheet; do not leave a bottom map covering the list and compare rail simultaneously. At 390 px retain utility text and rent basis through wrapping. Keyboard selection, visible focus, accessible labels for chip editors and pins, escape/close behavior, reduced-motion support and live result-count announcements are required. Motion is limited to orientation-preserving selection/reordering (~160–240 ms); reduced motion disables it.

## 8. Technical shape and failure recovery

One repository, React/TypeScript/Vite frontend, Express local API, Zod contracts, Cheerio source parsing, Leaflet map, Vitest for domain/boundary tests. Versioned JSON snapshots and cached GeoJSON; no database, auth, payment or microservice layer. Browser state persists favorites and scenario in localStorage; all listing facts stay immutable. The shared TypeScript engine is the only implementation of matching, costs and alternatives.

Boot without model access using the saved snapshot. Initial list/filter/compare must work without any external request. Maps may require basemap network; cached route facts remain accessible. Live discovery and edited routes expose queued/running/partial/failed states and retain the current usable view. Late responses must match request ID, snapshot ID and destination version before applying.

The local API invokes narrow CLIs via bounded child processes; it does not expose a shell or the user's credentials. Public deployment of the static review snapshot can be added later, with live research disabled and described accurately, after its concrete artifact is ready for review. The morning deliverable is a local runnable app and saved evidence. Do not make a public deployment a hidden dependency.

Primary documentation checked while choosing this stack: [Vite](https://vite.dev/guide/), [Express](https://expressjs.com/en/starter/installing/), [Leaflet](https://leafletjs.com/examples/quick-start/), [Zod](https://zod.dev/basics), [Cheerio](https://cheerio.js.org/docs/basics/loading/), [Claude noninteractive operation](https://code.claude.com/docs/en/headless). Installed Node is 26.8.1. Pin actual installed dependency versions in one lockfile during setup; do not guess API versions from memory.

## 9. Review decisions, bounds and success evidence

Accepted Fable recommendations: dense legible lists/map, aligned costs, visible utility uncertainty, typography discipline, original-vs-explored criteria, distinct Gates pin, no unsupported walking polygon, source and empty-result states. Adapted: textual utility states replace cryptic codes; detail pane stays readable; broader context is retained despite the suggestion to cut neighborhood prose. Only unsupported vibe writing is removed.

Accepted OpenCode recommendations: snapshot-first contracts, provenance, correct price bases, precomputed routes, atomic refresh and failure injection. Corrected: unknown utilities do not fail rent-only matching; “human review” is an agent-led evidence audit overnight; no approval is needed to handle zero matches honestly; full/half counts cannot be fabricated from insufficient source data.

Use Astra for contracts, integration and decisions; Luna for bounded source adapters, fixtures, copy/accessibility checks; Terra/Sol for decision engine and geographic integration as needed. Fable 5.1 is the independent frontend reviewer at design, first rendered core and final candidate, with one repair owner per finding. OpenCode Go's validated glm-5.3 provides backend review. Do not require unanimous panel agreement or repeatedly rerun a passing check without a changed reason. Two attempts on an approach, then change approach or use the declared fallback.

Morning evidence: real seeded search; route selection to Gates; three-way cost comparison with utilities; a changed requirement recomputes real results; source refresh proof; five-record provenance audit including a multi-unit page; browser interaction/visual inspection at desktop and narrow width; successful typecheck/test/build; cold start; unavailable model/router/source checks; concise startup/reset and three-minute demo script.

Explicit later scope: multi-user accounts, roommate marketplace, contact automation, guaranteed exhaustive portal aggregation, arbitrary-city transit feeds, live transit predictions, production AI API provisioning, optimization weight learning, image generation for properties, utility-cost prediction, a full chat interface, shared collections and commercial deployment infrastructure. These do not replace any of the four accepted product functions.

## 10. Global constraints copied into the implementation plan

- Implementation is authorized; continue autonomously through the complete application and review cycle.
- Review target: approximately 2026-09-12 11:00 America/New_York (15:00 UTC), with quality prioritized; submission: 16:00 EDT (20:00 UTC).
- Default: personal rent 120000 cents/month, 2 equal shares explicitly assumed, 2 bedrooms, minimum 2 advertised bathrooms, houses/apartments, walking duration <=1200 seconds, flexible timing.
- Destination: Gates Hillman — mapped entrance, latitude 40.4440338, longitude -79.9445593; retain entrance uncertainty and source evidence.
- Unknown is not zero; unknown hard criteria do not pass; unknown utilities do not fail the rent-only budget.
- Use real sourced seed records; no invented qualifying inventory, no silent relaxation, no unsupported exhaustive-coverage claim.
- Preserve coverage, consequences, alternatives, readiness, browsable lists and sourced broader life context.
- One canonical TypeScript contract/engine; money in USD integer cents, time in seconds, coordinates named lat/lon except GeoJSON [lon, lat], timestamps ISO UTC.
- One root lockfile; Node >=22.12, validated local runtime 26.8.1; API binds 127.0.0.1 by default.
- All model/source/routing jobs are bounded; keep the last good snapshot on failure; never bypass source access controls.
