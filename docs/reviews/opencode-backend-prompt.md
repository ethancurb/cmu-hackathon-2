You are an independent backend/reliability reviewer for a high-stakes HackCMU housing application. Planning only. Do not use tools or modify files. Return at most 1000 words: top 3 risks, recommended lean architecture, exact data/contract invariants, and decisive acceptance checks. We have about five hours to implement after planning. Proposed approach: React/TypeScript Vite web frontend, a small local Node HTTP API, a versioned sourced JSON housing snapshot as initial durable store, deterministic filtering/comparison and route-backed walk qualification, local favorites, and a bounded ingestion/enrichment job. Avoid auth, payment, custom agent orchestration platforms, databases or microservices unless required. Existing CLI subscriptions are available for controlled offline extraction/review; an optional local API endpoint may ask a CLI model to interpret preferences into a validated proposal, but core listing comparisons must remain useful if model/service fails. No production app API keys are configured. Source discovery spans major portals, actual automatic collection only where a proven acceptable path exists, and sourced CMU/local-manager snapshots must populate the demo. Need clear source coverage/freshness and no fabricated matches. Generalize destination/search parameters. Identify which parts of this approach risk becoming a static mock or unauditable agent; propose a real minimal refresh/import loop and limits. The final plan must make utility inclusion and total cost incompleteness explicit.

PRODUCT BRIEF
# Housing project: guiding brief

This is the canonical product direction, established with the user on September 12, 2026. It precedes the detailed design, implementation plan, and build. Read it alongside `hackcmu-intel/AGENT_BRIEF.md`. The intelligence pack supplies competition context; this file supplies the replacement project's purpose.

## Confirmed core

> Across these sources, which places actually fit my life, what am I sacrificing, and what small change would unlock better options?

The user explicitly endorsed that question and added an equally important requirement: carry the burden of searching a fragmented housing market. A person faces many sites, many homes, many interacting life preferences, and changing priorities. Each change can force them to repeat the research. The product must make that whole decision manageable.

The intended scope is city-wide housing discovery across major sources, adaptable to someone relocating for a job, school, or another life change. The user has selected a fully seeded CMU search for the initial demonstration, with the criteria below. The general product remains adaptable to other destinations and whole-city searches. Source access remains to be established during planning. Gathering relevant options is part of the product's job.

The system should do the gathering, reconciliation, comparison, and reconsideration needed to present useful options. The renter retains control of priorities and the final decision.

## Accepted decision questions

The user endorsed these four parts of the experience and explicitly wants all four retained. They must be grounded in observable facts and computations:

| Part | What the user should learn | Evidence the product must expose |
| --- | --- | --- |
| Coverage | Where we looked, what we found, and where the search remains incomplete | Sources attempted and successfully searched, retrieval dates, distinct homes found, duplicates reconciled, and known gaps; no unsupported percentage of the entire market |
| Consequences | How each home affects commute, expenses, errands, and stated priorities | Sourced listing details, routed journeys, itemized known costs, nearby destinations, and explicitly labeled estimates or unknowns |
| Alternatives | What a changed requirement unlocks and what the user gains or sacrifices | Recomputed candidates with exact changes to rent, travel time, layout, or other relevant criteria; original requirements remain visible |
| Readiness | Which homes warrant further attention and what could change that decision | Explicit fit reasons, original listing links, availability evidence, and consequential questions to verify before investigating or touring |

The user wants solid, quantifiable, defensible results. Qualitative context and amenities still belong in the product, with their evidence and limitations visible. An unspecified quality score or persuasive summary cannot substitute for those facts.

The product promise is:

> Search across the housing market, understand what each realistic option means for my daily life, and help me reach a shortlist I can act on. Show why those options fit, what I would trade away, what remains uncertain, and what changes would unlock alternatives.

## Requested CMU demonstration

The user wants to wake up to a populated version they can personally review, rather than having to collect listings or configure the initial search. This is an agreed demonstration target; no listings have been collected or validated yet.

| Criterion | Current requirement |
| --- | --- |
| Location | Carnegie Mellon University area in Pittsburgh |
| Walking limit | User-confirmed destination: Gates Hillman at CMU. Within a 20-minute walking route to a verified pedestrian entrance there; identify the entrance during planning rather than routing to a generic campus center |
| Layout | 2 bedrooms and 2 bathrooms; record bedroom and full/half-bath counts accurately and make the matching interpretation explicit during planning |
| Property types | Houses or apartments |
| Rent budget | User-confirmed maximum of $1,200 per month for their personal share, rent only. Editable demo assumption: two people splitting rent equally, giving a $2,400 whole-home rent ceiling. The roommate count and split are assumptions, not user-confirmed household facts |
| Utilities | Explicitly emphasize which utilities are included in advertised rent, separately charged, partly covered, or unknown |
| Map | Map candidates and a clearly labeled Gates Hillman destination pin. Selecting a candidate should show its walking route to Gates Hillman when available, with the source and routing assumptions inspectable |
| Transit | Consider relevant bus routes and stops, including whether they serve the intended destination and direction; a bus alternative does not silently override the walking limit |
| Timing | User confirmed flexible move-in date and lease duration. Still show stated availability and lease terms, and flag missing or stale information |
| Review experience | A populated, browsable list of options, connected map, comparisons, editable criteria, and visible sources and uncertainties |
| Morning review | User expects the first viewing around 10–11 a.m. EDT on September 12, 2026. Use 10 a.m. EDT (14:00 UTC) as the internal readiness target for a runnable, fully seeded candidate, leaving the viewing window for review and corrections |

Seed the eventual demo with sourced housing records and provenance, and accurately label when they were checked. A saved snapshot is not proof of current vacancy. If the data contains no exact matches, report that result and show separately identified near-matches with their specific deviations. Do not fabricate qualifying homes, assume unknown fields pass, or silently relax the request to fill the screen. The acceptance target concerns a usable populated search and truthful results, not a guaranteed number of exact matches.

The user explicitly wants Gates Hillman visible in the demo to make the location-specific value tangible. Name it in the saved search and listing walking-time labels, keep its destination pin distinct on the map, and connect a selected home's route to that pin. The destination must be used by the actual walking calculation, not added only as decorative copy. Preserve an editable destination for searches beyond this seed.

## Rent, fees, and utilities

- Preserve whether a quoted rent is for an entire unit, a room, or one person's share. Do not compare different price bases as equivalent. A per-person allocation needs an explicit roommate count and split assumption.
- Keep base rent, mandatory recurring fees, one-time charges, and any advertised concession separate. Identify the lease conditions behind a concession or effective-rent figure.
- The requested $1,200 filter applies to the user's monthly share of rent only. Under the explicitly labeled initial assumption of two equal shares, the whole-home rent limit is $2,400. Keep roommate count and allocation editable, and label computed shares separately from a landlord's per-room quote. Additional expenses must remain prominent even when they do not change the rent filter.
- Track electricity, gas, water/sewer, trash, internet, and other listed utility charges individually where the source provides details. Preserve caps, allowances, shared billing, and partial coverage when stated.
- For each utility, keep the listing's evidence and its status: included, separately charged, partly covered, or not stated. Record a charge or estimate only with its basis. Missing cost is not zero.
- Present known recurring costs and unresolved additional costs clearly. Only describe a total as complete when the required components are known. Estimates must be visibly separate from quoted charges.
- Highlight utility inclusion and uncertainty in the list and comparison experience; it must not be buried in listing prose or available only through chat.

## Obligations derived from that purpose

These guide the next design; they are not a finalized feature list or implementation contract.

1. **Carry the search burden.** Gather and reconcile options from supported sources. Make coverage and freshness inspectable. Distinguish the sources surveyed from those successfully searched, and listings collected from distinct available homes. Broad coverage is a substantive promise to prove.
2. **Make daily life legible.** Connect housing to the user's destinations, travel modes, budget, timing, and preferred nearby activities or amenities. A useful comparison concerns the consequences of living there. Neighborhood fit should use the renter's stated preferences and sourced observations; uncertain information stays uncertain.
3. **Preserve the meaning of preferences.** Distinguish firm requirements from flexible preferences and exploratory changes. Explain what a proposed compromise changes. Never silently relax a requirement or treat an unknown as a confirmed match.
4. **Expose defensible alternatives.** Show why a home is worth considering, what it gives up, and what other option represents a different compromise. Any ranking or comparison must follow inspectable inputs and rules. An unexplained score cannot carry the decision.
5. **Support reconsideration without restarting.** Preference changes should reuse the research already performed where it remains applicable, revisit relevant excluded options, and identify when the change requires more discovery. Preserve the user's shortlist and comparison context.
6. **Make trust inspectable.** Keep source evidence, observation dates, conflicting claims, and missing information attached to the facts used in recommendations. Preserve distinctions between buildings, units, listings, advertised prices, fees, concessions, and lease conditions. The LLM may interpret and explain evidence; its fluency does not establish facts or validate a recommendation.
7. **Lead toward action.** A useful endpoint is a small set of homes worth investigating or touring, with the consequential unanswered questions visible. The product should help the user recognize progress toward that endpoint.

## Frontend direction

The intended feeling is calm, clarity, and control after an overwhelming search. Visual craft is a core product requirement. Typography, color, spacing, imagery, motion, and information hierarchy should support understanding housing choices and their consequences.

The user explicitly likes seeing lists of options. Provide an effective browsable list with meaningful details, sorting, comparison, and map connections. Avoid hiding the inventory behind a chat or an artificially tiny shortlist. The earlier objection concerned generic visual execution and undifferentiated results, not lists themselves.

Lead with useful facts and understandable tradeoffs. Keep preferences easy to adjust and comparisons stable enough to follow. Reveal deeper evidence when it helps the current decision. Every displayed number, badge, explanation, and animation should have a clear job. Strong typography, color, spacing, and layout should make evidence easier to compare.

Retain the broader context the user values: shopping and errands, useful transit, preferred nearby amenities, property type and features, perks, and sourced review information where available. Describe neighborhood fit through relevant observations and the user's preferences. Give quantitative information its units and qualitative information its source; do not remove either category merely to simplify the story.

The precise visual direction is still open. It should receive dedicated review and remain easy to revise without changing the decision logic.

## Backend direction

The backend carries the same product obligations: reliable collection, reconciliation, evidence preservation, correct preference handling, reproducible comparisons, and useful recovery when a source fails. These are essential engineering work. Changing the interface cannot compensate for unreliable facts or opaque decisions.

Data access is the first major feasibility question. A list of desired websites is not proof of working coverage. The eventual plan must establish actual access paths and make any limitations explicit while preserving useful progress.

## Competition and decision discipline

Optimization is the current recommendation for main-track fit, not yet a final selection. The demonstration should make the research burden, a useful comparison, and the consequence of changing a preference visible within the event's three-minute limit.

LLM search, rental matching, aggregation, and tradeoff explanations have existing competitors. This direction is a hypothesis for a better experience, not evidence of global novelty. Its advantage must be demonstrated against a relevant existing workflow.

For every proposed feature or technical choice, ask: How does this help the renter discover a relevant option, understand a life consequence, explore a meaningful compromise, trust the evidence, or take the next step? State the benefit and its proof before expanding scope.

## Current phase

Planning is authorized. The user explicitly requested that the original commission and useful reasoning from the conversation be preserved; see `docs/context/COMMISSION.md` and `docs/context/DECISIONS.md`. Current work includes source and routing feasibility probes, design research, terminal/model validation, independent reviews, and a concrete specification and implementation plan. The product requirements above remain controlling. Two equal rent shares are the explicitly labeled, editable demo assumption. The internal readiness target is 10 a.m. EDT September 12, 2026 for the user's 10–11 a.m. first viewing; event submission remains 4 p.m. EDT. The final go follows the reviewable plan. Application implementation and the unattended build have not started.


GEO PROOF
# Map, walking, transit, and amenities feasibility

**Planning observation time:** 2026-09-12 08:14–08:19 UTC. This is a recommendation for the seeded CMU demonstration, not application code or a claim that the observations will remain live.

## Recommendation

Use an OpenStreetMap-backed map with a visibly attributed **Gates Hillman—Forbes Avenue pedestrian entrance** destination, public FOSSGIS foot routing for the small seeded demo, PRT's static GTFS plus public GTFS-realtime for transit context, and a bounded OpenStreetMap amenities query. This is practical without a paid account and supports an editable arbitrary city destination: store a destination coordinate/label and ask the same walking-router adapter for each listing.

The route must be the deciding value for the `<=20-minute walk` filter. A nearby straight-line distance, a generic campus pin, a driving route, or a bus trip cannot stand in for it. Show the destination pin, walking line, duration, distance, provider, retrieval time, and route assumptions whenever a candidate is selected. If the request or response fails, show `walking route unavailable` and exclude the home from an exact-walk match; never substitute an estimate silently.

## Gates Hillman destination evidence

CMU calls the complex the Gates and Hillman Centers, lists its address as **4902 Forbes Avenue**, and says exterior doors/walkways improve pedestrian access. Its own news material identifies a **Forbes Avenue entrance** to the Gates and Hillman centers; a CMU-hosted directions page separately calls Hillman's Forbes-facing entrance the easy approach from Oakland. These establish the intended pedestrian entry, rather than a campus centroid. [CMU building page](https://www.cmu.edu/cdfd/buildings/gates-hillman/index.html), [CMU news](https://www.cmu.edu/news/stories/archives/2011/july/july26_publictransitapp.html), [CMU-hosted directions](https://www.cs.cmu.edu/~brookes/MFPS2011/LocalInformation/).

For the seed, use the auditable coordinate **40.4440338, -79.9445593** (latitude, longitude), label it `Gates Hillman — Forbes Avenue entrance`, and render it as the distinct destination pin. An OpenStreetMap Overpass query at 08:16 UTC found OSM way `27623372`, named `Gates and Hillman Centers`, and a directly-member `entrance=main` node `1704796692` at that coordinate. A 100 m network-context query also returned named Forbes Avenue ways. OSM is corroboration for the exact map point; the CMU sources establish the entrance's purpose. Before publishing seed data, a human should visually compare the point with CMU's current campus map/site conditions, because OSM does not itself name that node “Forbes.” Keep the coordinate versioned with source URLs and observation date so a changed/closed entrance can be corrected.

## Observed walking-route proof

At **08:18:59 UTC**, this GET returned HTTP 200 from the public FOSSGIS foot router:

```text
https://routing.openstreetmap.de/routed-foot/route/v1/driving/
  -79.94965,40.44185;-79.9445593,40.4440338
  ?overview=full&geometries=geojson&steps=true
```

The input origin is an intentionally arbitrary Oakland sample point, not a housing claim. The response snapped the destination exactly to `[-79.944559,40.444034]`, returned `code: "Ok"`, a route of **760.4 m** and **607.8 s (10.13 min)**, eight steps, and `routes[0].geometry` as a 47-coordinate GeoJSON `LineString`. Every observed step reported `mode: "walking"`. The path segment says `driving` because OSRM keeps that URL segment; the host is specifically `routed-foot`, and the provider documents distinct car/bike/foot profiles. This is therefore a real foot-profile response, not a driving-profile result. The complete response/header probes are temporary files under `/private/tmp/cmu-geo-probe-*`, not product data.

For implementation, request `overview=full`, `geometries=geojson`, and `steps=true`; persist the returned geometry, metres, seconds, provider URL/profile, requested/snap coordinates, and `retrieved_at`. Compare seconds to 1,200 exactly (or round only for display). The FOSSGIS service documents a valid identifying user agent/referrer, **at most one request per second**, and no scraping/heavy use, so throttle and cache one result per origin/destination/profile during the demo. It has no SLA: the usable fallback is a saved, visibly dated response for the seeded candidates, described as “verified route captured [time]”; failed new/edited origins remain unavailable. A later product should use a contracted or self-hosted pedestrian router, keeping the same fields, rather than treating a community endpoint as production capacity. [Router policy/profile documentation](https://routing.openstreetmap.de/about.html).

## Transit: factual campus context, not a walking substitute

PRT supplies the appropriate official path. Its developer page says static GTFS is generally updated within two weeks before quarterly changes, links public bus GTFS-realtime, and publishes GIS route/stop data; its license requires accurate reproduction, the specified reproduced-with-permission notice for derivatives, reasonable efforts to stay current, and acknowledges that data may be unavailable or inaccurate. [PRT developer resources](https://www.rideprt.org/business-center/developer-resources/), [PRT license](https://www.rideprt.org/business-center/developer-resources/developer-license-agreement/).

Observed requests:

* `GET https://www.rideprt.org/developerresources/GTFS.zip` returned HTTP 200 at **08:17:02 UTC**, 22,512,403 bytes. `feed_info.txt` says `Merged_Clever_2606_2`, valid 2026-06-28 through 2026-10-14. (An earlier guessed `/media/.../gtfs.zip` URL returned HTTP 404; use the directory link, not that guess.)
* `GET https://truetime.portauthority.org/gtfsrt-bus/` returned HTTP 200 at **08:15:01 UTC** and listed public `vehicles`, `trips`, and `alerts` feeds. `GET .../trips?debug=` returned HTTP 200 at about **08:15 UTC**, 488,603 bytes, with a GTFS-RT full-dataset timestamp `1789200920`; `vehicles?debug=` returned HTTP 200, 12,018 bytes, timestamp `1789201004`. These support current arrival/vehicle context but do not prove service completion, crowding, or accessibility.

The current static feed places two campus-adjacent stops on Forbes/Morewood: **4407, “FORBES AVE + MOREWOOD AVE FS (CARNEGIE MELLON)”** at 40.444698, -79.943756, and **7117, “FORBES AVE + MOREWOOD (CARNEGIE MELLON)”** at 40.444458, -79.942291. Feed trip/headsign records show 4407 carries 28X outbound Airport; 58 inbound Downtown / outbound Carnegie Mellon; 61A/61B/61C inbound Downtown; 61D inbound Oakland; and 67/69 inbound Downtown. Stop 7117 carries 61A/61B outbound Braddock variants, 61C outbound McKeesport, 61D outbound Waterfront, and 67/69 outbound Forbes Hospital/CCAC Boyce. These direction/headsign labels, not just route numbers, should be displayed. Re-evaluate exact service, alerts, and the candidate's boarding direction at viewing time; the static feed is schedule context, not a guaranteed departure.

For the demo, show relevant nearby stops/routes as a separate `Transit nearby` fact with stop, headsign, scheduled/realtime timestamp, and a short walk from the stop to the same Gates entrance if calculated. Do not label a route as “to Gates Hillman” merely because it serves CMU, and do not let it change the 20-minute walking qualification. Full multimodal itinerary planning is optional later work; PRT's stop/route facts are sufficient now.

## Amenities and map data

At **08:19 UTC**, a bounded Overpass query over the CMU/Oakland area for `shop=supermarket|grocery|convenience` returned HTTP 200 with nine records, including **Scotty's Market** (`shop=supermarket`, 40.4441892, -79.9389348), **Entropy+**, Forbes Street Market, Seoul Mart, and several convenience stores. A companion query for supermarket/pharmacy/cafe/restaurant returned 59 records. This supports a useful `Nearby essentials` list: classify exactly as sourced (`supermarket`, `convenience`, etc.), show name and a clearly labeled straight-line distance or a separately routed walking time, link to the OSM object, and show `not found in queried OSM data` rather than implying no amenity exists. Hours are often absent or stale and must be labeled as OSM observations, not promises.

Use a MapLibre/Leaflet-compatible basemap and visible `© OpenStreetMap contributors` attribution. OSM's public tile policy requires attribution, identifying user agent/referrer, and HTTP-cache compliance (at least seven days where headers cannot be read), prohibits bulk prefetching, and offers no SLA. Nominatim similarly requires an identifying client, attribution, caching, and no more than one request/second; one observed query for “Gates Hillman Center” returned HTTP 200 with `[]`, so do not depend on it to resolve this seed. Save known destination/candidate coordinates and query amenities only for a visible/current result set. [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

This path is low setup risk for a small, seeded demonstration, with two explicit operational risks: community map/router availability and OSM completeness. The honest fallback is cached, timestamped evidence for the seeded listings plus a clear unavailable state for changes. Google Routes/Places or a commercial routing/maps provider could later supply supported geocoding and multimodal routing, but requires account, billing, and its display/caching terms; it is not needed to meet the current demonstration proof.
