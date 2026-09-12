# Conversation decisions and useful reasoning

This is a distilled record of both the user's instructions and the assistant's evaluations through planning authorization on September 12, 2026. Repetition is consolidated. It is not a verbatim transcript or a claim that every assistant suggestion was accepted. `COMMISSION.md` preserves the original commission; `PROJECT.md` is the current product brief; the approved design and implementation plan will define execution.

## Requirements traced to the conversation

| ID | Origin and status | Requirement or lesson | Consequence for planning and verification |
| --- | --- | --- | --- |
| C01 | User: high-stakes HackCMU project; confirmed | Competition quality and a working morning result matter more than generated code volume | Plan one complete judged experience and preserve rehearsal/submission time |
| C02 | User: original housing-search experience; confirmed | Too many major sites and too many housing options create research work the product must perform | Survey the major US portals, establish real discovery paths, reconcile duplicates, expose source coverage |
| C03 | User: whole-city clarification; confirmed | Generalize beyond CMU to other destinations and relocations | Keep destination, market, preferences, and routing parameters editable; CMU is a saved demonstration search |
| C04 | Assistant framing, explicitly endorsed | Which homes fit, what is sacrificed, what small changes unlock alternatives | Implement understandable filtering, comparisons and recomputed alternatives |
| C05 | Assistant's four questions, explicitly endorsed | Coverage, consequences, alternatives, readiness | Each part needs observable evidence; retain all four in the experience |
| C06 | User correction: less fluff; confirmed | Quantifiable, defensible facts lead; broader context remains | Prefer units, prices, travel times, source excerpts and timestamps; label qualitative observations and unknowns |
| C07 | User: lists clarification; confirmed | Browsable lists are useful | Provide a rich list with map and comparison connections; avoid forcing all inventory through chat or hiding it behind only a tiny shortlist |
| C08 | User: visual quality and reviewer; confirmed | Exceptional frontend design, detailed craft, dedicated review while user sleeps | Obtain independent design review, inspect rendered UI, and make theme/layout easy to change |
| C09 | User: CMU morning seed; confirmed | Open to a populated usable example with actual housing evidence | Collect and validate seeded records before handoff; retain exact matches, unknowns and labeled near-matches truthfully |
| C10 | User: layout and walking limit; confirmed | Houses/apartments, 2 beds, 2 baths, <=20-minute walk | Define matching semantics explicitly; calculate a pedestrian route rather than using straight-line radius or a driving route |
| C11 | User: personal rent budget; confirmed | <=$1,200/month for the user's share, rent only | Label price basis and rent split; two equal shares / $2,400 total is an editable initial assumption |
| C12 | User: utilities emphasized; confirmed | Utility inclusion is a first-class comparison variable | Record individual utilities, inclusion, exclusions, caps, known charges and unknowns prominently |
| C13 | User: Gates Hillman answer; confirmed | The destination should visibly anchor the demo | Name/pin Gates Hillman, use a verified pedestrian endpoint, show the selected property's route and time |
| C14 | User: transit and map; confirmed | Nearby stops and useful bus routes matter | Preserve route/stop identity, direction and relevant timetable evidence; bus travel cannot silently satisfy the walk constraint |
| C15 | User: contextual variables; confirmed | Shopping, errands, neighborhood preferences, amenities, perks, property type, and sourced ratings matter | Provide sourced context with explicit provenance; do not invent a single authoritative neighborhood/house quality rating |
| C16 | User: timing answer; confirmed | Move-in and lease duration are flexible | Show the available information without inventing a date requirement or current vacancy |
| C17 | User: morning review; confirmed | Ready for first viewing around 10–11 a.m. EDT September 12 | Internal readiness target 10 a.m.; event submission remains 4 p.m. EDT |
| C18 | User: cost-aware agents; confirmed | Astra coordinates; use Luna, Terra and Sol for bounded work; use available Go/Claude/Codex models | Explicit model choice, bounded assignments, limited reviewer rounds, concise handoffs, no invented token budget |
| C19 | User: requested panel; confirmed subject to actual availability | Fable 5.1 independent review, dedicated frontend review, backend reliability review | Validate exact model IDs and authenticated terminal responses; report substitutions or unavailable models honestly |
| C20 | User: uninterrupted overnight work; confirmed | Continue within agreed scope and actual permissions; avoid repeated approval or verification loops | Set finite checkpoints, time-bound failed approaches, establish fallbacks and one repair owner, preserve a known-good candidate |
| C21 | User: planning first; confirmed | Record the conversation's value and make implementation straightforward | Produce a spec, contracts, file ownership, task dependencies and concrete acceptance checks before final go |
| C22 | Prior intel / user preference carried forward | Lean coordination, people choose tasks, no permanent human component roles | Use one canonical brief/contract and existing tracker; no process-only services or CI |

## Assistant findings retained as evidence or recommendations

1. **Competitive overlap is real.** Zillow advertises natural-language rental search and AI tradeoff discussions; Apartments.com offers conversational rental search; Apartment List offers matching around must-haves/nice-to-haves. Cross-platform aggregation also has precedent. The proposed experience requires a demonstrated advantage; it is not established as globally novel. Sources: [Zillow](https://www.zillow.com/news/zillow-ai-mode-will-change-how-renters-decide-not-just-how-they-search/), [Apartments.com](https://www.apartments.com/grow/learning-center/apartments-ai-launch), [Apartment List](https://www.apartmentlist.com/), [Rentvoy developer case study](https://www.agency7.ca/case-studies/rentvoy).
2. **Optimization is the recommended main track.** Explicit constraints, comparisons and changed-input results provide a natural demonstration. Final track selection remains a product decision; no official scoring weights or win probability are known.
3. **Data acquisition is a hard dependency.** Readable research pages are not proof of a supported application connector. Source access, freshness, units, price bases and utility semantics need actual checks. [Zillow terms](https://www.zillow.com/corporate/terms-of-use/) and [Apartments.com terms](https://www.apartments.com/grow/about/terms-of-service) restrict automated collection; access strategy cannot be assumed from visibility.
4. **Synthetic data has a limited role.** It can test computation and error paths when labeled. It cannot fulfill the user's request for an actually sourced CMU housing seed or validate a live-coverage claim. The inventory must not be invented to guarantee an attractive count of matches.
5. **The LLM should work on evidence.** It can interpret preferences and messy listing descriptions and explain results. It should not invent prices, utilities, availability, addresses, reviews or calibrated confidence; arithmetic and hard-constraint checks should be reproducible.
6. **Meaningful alternatives beat opaque scoring.** Show distinct compromises and numerical changes where supported. Unknown costs or route data remain unresolved, rather than being treated as favorable zeros.
7. **Preserve research during preference changes.** Re-evaluate prior records when applicable, retain favorites/comparison state, and discover further records when a changed destination or wider search requires it. This is an accepted direction to make precise in the spec.
8. **A useful endpoint is an actionable shortlist.** The user endorsed readiness alongside broad discovery, but explicitly still wants lists of options. The shortlist complements the inventory; it must not erase it.
9. **Plan depth needs a stopping condition.** Enough detail to resolve consequential interfaces, risks and acceptance is valuable. Repeated reviewer agreement, speculative architecture, and long verification loops are not substitutes for progress.
10. **The prior bus project is a lesson, not active scope.** Its main concerns were incumbent overlap and uncertain occupancy data. Old contracts, stacks, queues and branches do not transfer. One failed source does not disprove all possible access; one successful response does not prove a working product.

## Superseded interpretations

- “Reject a generic list” must not become “the user does not want lists.” They explicitly do.
- “CMU seed” must not become “the product is only for CMU.” The broader city/destination goal remains.
- “$1,200 budget” must not become a $1,200 whole-home cap. It is the user's share of rent.
- Flexible timing must not become a fabricated move-in date or required one-year lease.
- “Grounded and quantifiable” must not remove neighborhood context, shopping, amenities, perks or qualitative evidence.
- “Simple backend” expresses the reliability goal; it does not establish that source reconciliation and routing are trivial.
- “Quality over time” does not reset the event clock or permit sacrificing the entire working demo for indefinite planning.
- Owning subscriptions does not prove CLI login, exact model availability, application API access, or an unattended process.

## Planning outputs and evidence

The plan must map C01–C22 to implementation tasks or explicit scope decisions, with source/runtime evidence linked. Unknowns must become an explicit experiment, fallback or limitation rather than a hidden assumption. The lead owns reconciliation of reviewer findings and shared interfaces. Reviewer reports remain supporting evidence, not competing product specifications.

## Completed planning and validation

- The original commission and later user refinements are preserved in [COMMISSION.md](COMMISSION.md) and [USER-REFINEMENTS.md](USER-REFINEMENTS.md). This file captures the useful reasoning, decisions and their status; it is not a reconstructed verbatim assistant transcript.
- Codex/Astra, OpenCode Go/Luna and Claude/Fable 5.1 each returned a successful terminal response. Fable's design review and OpenCode Go/glm-5.3's backend review completed. See [runtime evidence](../research/runtime-validation.md).
- The user explicitly approved both external review packets. The earlier automatic export rejection was resolved; no approval for those packets is pending.
- A real CLI discovery/fetch probe succeeded, but independent checking found a cross-unit availability-date error. Discovery invocation is established; correct ingestion still requires implementation and the scope/evidence gate. This finding is retained as a required regression test.
- Initial household composition is still an assumption: two equal shares, visibly editable. The demo interprets 2 bathrooms as a minimum advertised count and labels the control `2 beds · 2+ baths`; it does not invent full/half decompositions.
- Unknown utilities affect readiness and total-cost completeness, not the default rent-only hard filter. Flexible timing is retained as display/readiness data; advanced date/lease filters are outside the morning version.
- The exact Gates point is an OSM mapped entrance. The app must not claim physical or named-Forbes-entrance verification that was not obtained.
- The [design](../superpowers/specs/2026-09-12-housing-design.md), [contracts](../CONTRACTS.md) and [implementation plan](../superpowers/plans/2026-09-12-housing.md) define the reviewable build. [Review resolutions](../reviews/RESOLUTIONS.md) record accepted/corrected recommendations. Final build go remains the user's next phase.
- After reviewing plan status, the user explicitly reaffirmed the next phase's scope: build the full working application, pull fresh real data from several selected housing sites for the demo, and iteratively develop/review a sleek modern frontend. Frontend quality is roughly half the hackathon battle and is a required outcome alongside live acquisition. This strengthens C08/C09 and the existing rendered-review checkpoints; it does not imply that every portal is a working connector or change the phase gate.

## Build authorization and revised target

The user commissioned the autonomous full build, public-source research, iteration, and Fable/OpenCode Go reviews at the coordinator's discretion. The viewing target is approximately 11 a.m. EDT September 12, give or take; do not sacrifice important work or quality to an exact deadline. This supersedes the earlier 10 a.m. target and the pending-go status. See `../BUILD-STATUS.md`.
