# Plan: Grok-powered niche filters

Branch: `feat/grok-custom-filters` (off `main` at `f802528`).
Vocabulary: [CONTEXT.md](../../../CONTEXT.md). Contracts: [docs/CONTRACTS.md](../../CONTRACTS.md).

## Context

`address.` filters homes through a closed set of **core dials** — rent, allocation, beds,
baths, property type, walk seconds, required utilities, 7 canonical amenities. Everything
else the snapshot knows is unreachable. The seed carries **80+ `context_*` amenity keys**
(`context_dishwasher`, `context_on_bus_line`, `context_hardwood_floors`), **136 transit
records**, and **63 nearby places** — all captured, all displayed, none filterable.

The gap is sharpest in the nearby data. Webster Hall B2 — already the app's headline near
miss at **$7.50 over** the cap — sits **229 m from Wushiland**. Cathedral Mansions is
**129 m from Seoul Mart**. Their `category` fields read `cafe` and `convenience`. Nothing
in any structured field says "Asian" or "Chinese"; only the **name** does. No deterministic
predicate over the existing schema can reach those homes.

This adds a **niche query**: one plain-language requirement, interpreted by Grok against
what the snapshot already knows, surfacing matches in a highlighted **niche group** ranked
by **core closeness**. It is purely additive — no existing verdict, group, sort, or
interaction changes.

## Settled decisions

1. **Grok interprets the snapshot.** Demo over the seeded snapshot, not a live product.
   No Overpass re-query, no web search in v1 — model knowledge only, for simplicity.
2. **Two roles, one call.** Per home Grok returns a niche verdict and, optionally, a
   mitigation naming the core constraint it speaks to.
3. **A mitigation never flips a verdict.** `fit` is untouched; a failed dial stays failed
   with its overage visible. (`DECISIONS.md` C14 — bus travel cannot silently satisfy the
   walk constraint.)
4. **Nothing is removed.** The niche group is additive; the full list renders unchanged
   beneath it. Homes in the group also keep their normal row.
5. **Ranking is deterministic.** Failed-dial count ascending, then summed relative
   overage. Never model-ranked — the demo needs one axis provably free of model opinion.
6. **Verdicts are cached per (query, snapshot).** Core-dial edits re-rank only; they never
   trigger a model call. A new niche query is the only trigger.
7. **Verdicts stay out of `EvaluatedHome`.** `evaluateHome` is not modified. The 92 tests
   and `validateSnapshot` are untouched.
8. **Provenance is always labelled** — listing data vs model assessment.

## Architecture

```
niche query ──▶ POST /api/niche ──▶ job (type: 'niche')
                                      │
                      buildDigest(snapshot)  49 homes, ~15k tokens
                                      │
                      grok-4.6 + Structured Outputs ──▶ NicheAssessment[]
                                      │
                      cache: data/cache/niche/<queryHash>-<snapshotId>.json
                                      │
client ◀── GET /api/jobs/:id ◀────────┘
   │
   └─▶ rankByCoreCloseness(assessments, evaluatedHomes)   pure, client-side
           │
           └─▶ NicheGroup (top) + row badges + map markers
```

The engine path (`evaluateSearch` → `evaluateHome` → `suggestAlternatives`) is not on this
diagram because it does not change.

## Files

**New**

| Path | Purpose |
| --- | --- |
| `server/niche.ts` | Grok client. `fetch` against the OpenAI-compatible endpoint, Structured Outputs schema, bounded by `AbortSignal`. |
| `src/domain/niche.ts` | Pure: `buildDigest`, `rankByCoreCloseness`, `NICHE_TOLERANCE`. No I/O. |
| `src/components/NicheGroup.tsx` | The highlighted group above the list. |
| `tests/domain/niche.test.ts` | Digest shape, ranking order, tolerance edges. |
| `tests/api/niche.test.ts` | Job lifecycle, cache hit, cancel, malformed model output. |
| `.env.example` | `XAI_API_KEY` name only — no value. Already whitelisted in `.gitignore`. |

**Modified**

| Path | Change |
| --- | --- |
| `src/domain/schema.ts` | `nicheQuery: string \| null` on `CriteriaSchema` + `CriteriaPatchSchema`. New `NicheAssessment` type. `SEED_CRITERIA.nicheQuery = null`. |
| `server/jobs.ts` | `Job['type']` gains `'niche'`. Expose the existing `controller.abort()` as a cancel path. |
| `server/api.ts` | `POST /api/niche`, `POST /api/jobs/:id/cancel`. |
| `src/App.tsx` | Niche state, cache-aware fetch, render `NicheGroup` above the existing groups. |
| `src/components/CriteriaBar.tsx` | Niche input + cancel control. |
| `src/components/HomeRow.tsx` | Niche badge with provenance tier. |
| `src/components/MapPanel.tsx` | Niche-coloured marker matching the group highlight. |
| `src/styles/tokens.css` | One niche accent token, light + dark. |

## Contracts

```ts
type NicheProvenance = 'listing_data' | 'model_assessment';

type NicheAssessment = {
  homeId: Id;
  matches: boolean;
  confidence: 'strong' | 'partial';        // partial = Grok stretched, e.g. Korean for Chinese
  reason: string;                           // one sentence, shown verbatim
  provenance: NicheProvenance;
  citedPlaceIds: Id[];                      // NearbyPlace ids when provenance is listing_data
  mitigates: { constraintKey: string; reason: string } | null;
};

type NicheResult = {
  query: string;
  snapshotId: Id;
  assessments: NicheAssessment[];
  model: string;
  generatedAt: ISODateTime;
  degraded: string | null;                  // set when the call timed out or was cancelled
};
```

`NicheAssessment` never appears inside `EvaluatedHome`. `citedPlaceIds` must resolve to
places already on the home — a verdict claiming a place the snapshot doesn't have is
dropped and the home is excluded from the group.

## Ranking

```
rank = (failedCoreDialCount, Σ |delta| / required)   ascending
```

Reuses the `delta` already computed on every `ConstraintResult` (`matching.ts`). Homes
with zero failed dials sort first. `NICHE_TOLERANCE` bounds which core misses are eligible
for the group at all — rent ≤ +10%, walk ≤ +50%, baths ≥ requested − 1 — declared in one
exported object so it can be defended in a sentence.

## Grok integration

- Model `grok-4.6`, Structured Outputs, `response_format` pinned to the `NicheAssessment[]`
  schema so nothing is parsed out of prose.
- One call per query. Digest is ~15k tokens for all 49 homes — well inside the 500k window
  and roughly $0.05 per call at $2–4/M input.
- Bounded by `AbortSignal` and a hard timeout, mirroring `server/cli.ts` (105 s) and the
  job runner's existing 6-minute ceiling.
- `XAI_API_KEY` stays server-side. Never in a browser response, per `docs/CONTRACTS.md`.
- On timeout, cancel, or malformed output: `degraded` is set, the niche group renders empty
  with a visible explanation, and the ordinary results are untouched. Never a bare spinner,
  never silently fewer results.

## Caching and cancellation

- `data/cache/niche/<queryHash>-<snapshotId>.json`, mirroring how `jobs/geo/nearby.ts`
  caches Overpass responses. `data/cache/` is already gitignored.
- The rehearsed demo query is pre-warmed so the on-stage path is instant and deterministic;
  an unrehearsed query still proves the live path works.
- Cancellation reuses the `AbortController` per job already in `server/jobs.ts`, plus the
  `'cancelled'` status already present in `Job` and `src/lib/api.ts`. Only the endpoint and
  the button are new.

## Verification

- `npm run typecheck && npm test` — the existing 92 must stay green; niche tests added.
- `npm run test:browser` — the 5 existing flows must be unaffected (proves "additive").
- New browser flow: enter the niche query → group appears above the list → Webster Hall B2
  ranks first with "$7.50 over share cap" still visible → raise the cap by $7.50 → the home
  moves into the matched group *without* a second model call (assert the call count).
- Cancel flow: start a query, cancel mid-flight, confirm `status: 'cancelled'` and that the
  previous results are intact.
- Offline check: with `XAI_API_KEY` unset, the app must boot and the ordinary flow must work.

## Demo beat (~35 s inside the existing 90)

1. Existing search, 0 matches / 42 near matches. Unchanged.
2. Type **"close to a Chinese supermarket"**.
3. Niche group appears on top — 12 homes, ranked by core closeness.
4. **Webster Hall B2** leads: `$7.50 over share cap` · `Wushiland · 229 m` ·
   *"Taiwanese bubble tea — closest Chinese-adjacent food retail"*, labelled as a model
   assessment. Its `category` is `cafe` — say out loud that no filter over the schema could
   have found it.
5. Apply the $7.50 alternative; the home becomes a full match. No second model call.

## Non-goals

Web search; Overpass re-query; listing-text extraction into derived `Fact`s; multi-change
alternatives from niche results; persisting verdicts into the snapshot; any change to
`evaluateHome`, `validateSnapshot`, or the alternatives engine.

## Risks

- **Recall is capped by the seed.** Only 21 of 49 homes carry nearby data and each keeps
  exactly 3 places (`nearby.ts:26`, `limit = 3`). A Chinese supermarket 400 m away may
  already have been dropped. The group says how many homes had no data to judge.
- **"Partial" matches are the honest half of the demo.** Wushiland is bubble tea; Seoul
  Mart is Korean. The `confidence` field and the verbatim reason string exist so this is
  disclosed on screen rather than discovered by a judge.
