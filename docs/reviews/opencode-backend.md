# OpenCode Go independent backend review

Model: opencode-go/glm-5.3.

# Independent backend/reliability review

## Top 3 risks

**1. Ingestion is the unproven critical path.** No listings exist yet. Portal automation is the least-established component (ToS, bot detection, no proven acceptable path), while the whole demo depends on populated, sourced data. At 4 p.m., an ingestion failure converts directly into pressure to fabricate or silently relax criteria. Treat manual, CLI-assisted, human-supervised extraction as the *primary* path; automated adapters are optional best-effort. Build the snapshot loader and schema first so every extraction method feeds one pipeline.

**2. LLM enrichment contaminating the fact base (the unauditable-agent trap).** If the CLI model writes bed/bath counts, utility statuses, or rent basis into the durable store indistinguishably from sourced facts, every "defensible" downstream claim is compromised. Every field needs a provenance class (`sourced|derived|assumed|unknown`) plus method and observation time; enrichment output must pass a schema gate and human spot-check before a snapshot becomes serving; the preference endpoint may only *propose* criteria changes, applied through the deterministic engine.

**3. Walk qualification depends on a no-SLA community router at 1 req/s.** The ≤20-min walk is the deciding filter. Failure at build or judging time either stalls the pipeline or voids qualification. Precompute and persist all seeded routes before 10 a.m.; route-on-select only for edited destinations, with an explicit `route unavailable → excluded from exact match` state. Never substitute straight-line distance, driving, or transit.

## Static-mock / unauditable-agent traps, and the real refresh loop

Static-mock symptoms: JSON never regenerated; hardcoded walk times; Gates pin decorative (not used by the filter); destination hardcoded; coverage implied without a manifest. Unauditable-agent symptoms: enrichment writes without provenance; the model mutating filters directly; LLM prose standing in for evidence.

**Minimal loop:** an `ingest` command reads (a) a manual import directory of CLI-assisted, human-reviewed extractions and (b) any proven portal adapter; normalizes; dedupes by building/unit/listing identity; writes a new timestamped snapshot plus a manifest (per source: name, method, URL, `retrieved_at`, status `searched|attempted|failed`, listings found, duplicates reconciled). Promotion to `current` requires spot-checking N listings against their source URLs. Limits: bounded pages/listings per source, hard timeout, no retry storms; a failed source is a visible gap, never a silent skip. Prove it by running twice during the build and diffing (added/removed/changed). One manual re-run during the demo with the new timestamp visible in the coverage panel.

## Lean architecture

- `data/snapshots/<ISO>/listings.json` + `manifest.json`; `data/current` pointer. Destinations and search config are versioned *data*, not code — the engine accepts any destination label/coordinate, which is the generalization mechanism.
- One Node process, no DB: serves snapshot, favorites, routes cache keyed `origin|dest|profile`.
- `engine/` — a pure TypeScript package (filtering, rent-basis normalization, utilities, near-miss classification, comparison) shared by API, frontend, and batch jobs: one matching implementation, unit-testable offline.
- `jobs/routing.ts` — batch precompute, 1 rps throttle, persists geometry/duration/provider/retrieved_at.
- Optional `/interpret` — calls the CLI model, returns a schema-validated criteria proposal applied via the engine only; on failure it hides gracefully and the core list is unaffected.

## Invariants

1. Every listing field carries provenance class + source URL + `retrieved_at` + method (`human|cli_assisted|adapter`). No exceptions.
2. Rent `basis ∈ {whole_unit, per_room, per_person_share}`; never compare across bases. The whole-home ceiling is computed only via the labeled allocation (`roommate_count=2, split=equal` → $2,400), editable, with computed shares labeled separately from landlord per-room quotes.
3. Rent components stay separate: base, recurring fees, one-time charges, concession `{amount, conditions}`. No effective-rent collapsing.
4. Utilities: per utility `status ∈ {included, separately_charged, partly_covered, not_stated}`; any charge or estimate carries its basis. **Missing ≠ zero. A total may be called complete only when all required components are known; otherwise show "known recurring" and "unresolved (N unknown)" as separate figures, visible in list and compare views — not buried in listing prose.**
5. Layout: `bedrooms:int`; `bathrooms:{full,half}`. Proposed interpretation: exact match = 2 full baths; ≥1 full + ≥1 half is a near-miss with an explicit deviation. Unknowns never pass.
6. Walk: qualifies iff `status=ok && duration_s ≤ 1200` on a foot-profile route to the versioned Gates entrance (40.4440338, −79.9445593, CMU source URLs, human-verified against the campus map). Persist provider, profile, snapped coords, geometry, `retrieved_at`.
7. Match class: `exact | near_miss(deviations[]: field, required, actual) | unverified`. No unknown passes; no silent relaxation; zero exact matches is a valid, displayed result with near-misses shown.
8. The manifest drives the coverage panel: attempted vs. searched, counts, dates, gaps; no market-percentage claims.
9. Favorites are local, keyed by listing id, and never mutate listing facts.
10. API responses embed `snapshot_id`, so every screen traces to a dataset version.

## Decisive acceptance checks

1. **Cold start:** clean checkout → install → build → serve a populated demo needing zero network for core list/filter/compare (routes precomputed) before 10:00 EDT Sept 12.
2. **Provenance drill:** any displayed number traces to URL + timestamp; spot-check 5 listings against live sources; zero fabrications.
3. **Integrity tests:** unit tests prove unknown utilities/baths/route-unavailable never qualify; the seeded $1,200-share + 2BR/2BA + ≤20-min search renders zero-match-or-matches truthfully with near-miss deviations.
4. **Failure injection:** kill the LLM endpoint (core unaffected); block the router (new origins excluded and labeled); fail one source (manifest shows the gap).
5. **Re-run ingest** yields a new versioned snapshot plus diff — the anti-static-mock proof.
6. **Entrance verification:** a human confirms the pin against CMU's campus map before serving.
7. **3-minute path:** seeded search → list → candidate → route to the Gates pin (provider + timestamp visible) → compare two → change budget → recompute with original criteria visible.

## Confirm before build

- Bath interpretation (2 full = exact; 1.5+ = near-miss) — approve or amend.
- Spot-check count N (suggest 5) and whether a live ingest re-run happens during the viewing window.
- If zero exact matches exist in the snapshot by 09:30, proceed with truthful near-misses rather than widening the filter.
