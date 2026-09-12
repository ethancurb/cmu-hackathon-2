You are the requested independent Fable design reviewer for a high-stakes overnight HackCMU housing app. Planning only. Do not use tools or modify files; evaluate the supplied material. Return at most 1100 words. Be candid and concrete. The user wants exceptional visual craft, a browsable list, real evidence, utilities prominent, and a visible Gates Hillman route. They do not want generic AI cards, a giant filter bar, filler copy, arbitrary match scores, or everything hidden in chat. Recommend one coherent design and specify layout, type, color, imagery, spacing, interactions, responsive behavior, and what to cut. Give the 3 most consequential design risks and a visual review checklist. Challenge the proposed reference direction if it is generic. Do not put Coverage/Consequences/Alternatives/Readiness into tabs just to repeat our philosophy; make them behaviors. Do not propose a 20-minute walking boundary unless supported by actual isochrone data; we currently have point-to-point foot routes only. Label recommendations, not completed behavior.

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


INITIAL DESIGN RESEARCH
# Housing decision UI: design references and directions

Reference evidence for a later design review, not a final visual specification. I read the linked first-party pages on September 12, 2026. “Observed” is explicit in the source; “Inference” is a proposed adaptation. No screenshot behavior is assumed.

## Primary references

| Source | Observed | Inference for our search |
| --- | --- | --- |
| [Airbnb Engineering: Improving Search Ranking for Maps](https://airbnb.tech/ai-ml/improving-search-ranking-for-maps/) and [Airbnb Summer Release](https://news.airbnb.com/product-releases/airbnb-2023-summer-release) | Airbnb describes a desktop list/grid paired with map pins, regular price pins and smaller mini-pins, persistent while panning. It says total price with fees appears in results, filters, maps, and listing pages. | Keep inventory browsable. Let map emphasis follow the selected row or an explicit rule, while every lower-priority pin remains in the list. Put decision-relevant monthly cost in the list and map context. |
| [Zillow: personalized moving hub and shared collection](https://www.zillow.com/news/zillow-launches-a-personalized-hub-that-guides-home-buyers-from-first-search-to-closing/) | Zillow reports a shared workspace to save, organize, and compare homes across iOS, Android, and web. Its affordability view includes costs beyond list price and labels whether a listing fits a connected budget. | Make a shortlist a persistent decision workspace. Comparison must show the inputs behind a fit or deviation: rent basis, mandatory fees, and utilities. An unexplained match score cannot carry the decision. |
| [Mapbox Search Products Overview](https://docs.mapbox.com/help/getting-started/search/) | Mapbox describes interactive text search with a map: selecting a result moves the map and displays a marker. Its search box supports autocomplete and distinguishes POI search from address geocoding. | Selecting a home should synchronize row, pin, destination, and route. Gates Hillman needs a distinct destination marker, and the walking route must use it. Search and map movement should remain explicit controls. |
| [GOV.UK Design System: Summary list](https://design-system.service.gov.uk/components/summary-list/), [Details](https://design-system.service.gov.uk/components/details/), [type scale](https://design-system.service.gov.uk/styles/type-scale/), and [spacing](https://design-system.service.gov.uk/styles/spacing/) | Summary lists pair a named key with a value and optional action. Details reveals secondary information in place, with guidance not to hide what most users need. The type scale is tested for readability, uses 5px line-height rhythm, and changes at a 640px breakpoint; spacing is tokenized. | Use named fact rows for rent, share, utilities, walk, availability, and evidence date. Keep high-consequence facts open; put provenance, conflicts, and calculations in disclosure. |

## Two coherent visual directions

### A. Field guide / editorial map (recommended)

Use a warm paper surface (`#F7F5EF`), ink (`#19201D`), moss accent (`#2E6B57`), amber for a compromise (`#A86219`), and cool blue for the Gates Hillman route (`#2A69A5`). Pair a system serif display face with a readable system sans for body/data; use tabular numerals. Start at 32/36 title, 22/28 section headings, 16/24 body, and 13/18 metadata. Statuses need text labels and icons as well as color.

On desktop, use a 56% scrollable option list and 44% persistent map. Each evidence-led row shows address/source, “$1,140 personal share / $2,280 whole home,” “utilities: water + trash included; electric unknown,” “18 min walk to Gates Hillman,” and one consequence sentence. Keep the Gates Hillman pin and 20-minute boundary visible. Selecting a row highlights its pin and route; selecting a pin focuses its row. A compare rail holds three homes with the same named fact rows. Keep Coverage, Consequences, Alternatives, and Readiness visible; Alternatives states the exact changed criterion and gain, while Readiness lists the next question and source.

On smaller screens, keep the list first and make the map a sticky expandable sheet. Keep cost and utility rows above the fold; put provenance and calculations in Details disclosures. The result is calm while leaving facts room to compare.

### B. Civic instrument / transit board

Use a cool off-white canvas (`#F2F5F4`), near-black text (`#111817`), navy structure (`#17324D`), teal for confirmed fit (`#007C78`), rust for tradeoff (`#B34B32`), and slate for unknown (`#5D6B70`). Use one sans family with a heavier numeric style for rent, minutes, and counts. A 50/50 split pairs dense sortable rows with a map of numbered pins and a destination ring. A docked comparison matrix uses explicit dimensions, never a composite score. A selected row opens an evidence drawer with sources, freshness, route assumptions, and the exact match, near-match, or unknown reason.

On mobile, turn the split into List / Map and keep a persistent “2 homes selected” comparison bar. This is strong for auditability and fast scanning, but can feel administrative and flatten lived consequences.

## Recommendation and token contract

Choose **Field guide / editorial map**. It gives the user a legible inventory and a sense of place without turning the product into chat or generic cards, while borrowing Civic instrument’s explicit rows and evidence drawer. Define tokens—`font.display`, `font.body`, `font.data`, semantic colors, `space.1`–`space.9`, `radius.row`, and `map.listRatio`—so visual changes never touch comparison logic. Keep these assumptions in the header: `$1,200 personal rent cap`, `2 equal shares`, `$2,400 whole-home ceiling`, `2 bed / 2 bath`, and `20 min walk to Gates Hillman`. Utilities stay first-class: included, separately charged, partly covered, or unknown.
