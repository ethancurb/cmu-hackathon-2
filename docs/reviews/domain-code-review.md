# OpenCode Go domain code review

Model: opencode-go/glm-5.3.

# Top 6 Correctness Findings

**1. `src/domain/costs.ts` — `personalRentWithinCap` / `computeCosts` (rentIsCompatible): rent fact state never checked**
- Trigger: `home.rent.amount = { value: 230000, state: 'assumed', method: 'floor-plan median', evidenceIds: [] }` is schema-legal (assumed only requires a method) and passes `validateSnapshot`, whose hard/search-index/scope checks apply only to `sourced` facts. Both guards test only `value !== null`, so an assumed (or conflicting-with-value) rent yields `wholeHomeBaseRent = 230000`, personal share $1150 ≤ $1200 → `personal_rent: 'pass'`, home can be `matches`. Violates "assumed/conflicting hard facts cannot pass."
- Fix: in both functions require `home.rent.amount.state === 'sourced' || === 'derived'`; otherwise return `null` / push the `base_rent` unknown item.

**2. `src/domain/matching.ts` — `factResult`: `assumed` state evaluated as pass/fail**
- Trigger: `home.bedrooms = { value: 2, state: 'assumed', method: 'guessed from title', ... }` — only `value === null || state === 'conflicting'` maps to `unknown`, so assumed bedrooms/bathrooms/propertyType can `pass` and reach `matches`. Same gap in the `utility:` and `amenity:` inline branches, which test only `conflicting`.
- Fix: treat `state === 'assumed'` (any non-sourced/derived state with a value) as `unknown` in `factResult` and the utility/amenity branches.

**3. `src/domain/matching.ts` — `evaluateHome` route lookup: `find` has no status filter**
- Trigger: `home.routeIds = ['r1','r2']`; `snapshot.routes = [r1: status 'unavailable', durationSeconds null, r2: status 'ok', durationSeconds 900]`, both matching destination id/version. `routes.find(...)` returns r1 by array order, `routeUsable` is false → `walk: 'unknown'` → `needs_verification`, despite a valid 900 s route. (`alternatives.ts` filters on `status === 'ok'` inside its predicate; this lookup doesn't.)
- Fix: filter candidates on `status === 'ok' && durationSeconds !== null` plus destination match, then select (e.g., latest `computedAt` or min duration); report `unknown` only when no usable candidate exists.

**4. `src/domain/alternatives.ts` — `suggestAlternatives` final ranking: cross-unit numeric sort**
- Trigger: candidates `minBathrooms: 1.5`, `maxWalkSeconds: 1400`, `personalRentCap: 125000` sort as 1.5 < 1400 < 125000 — ordering and `slice(0, 3)` are driven by unit magnitude: bath always outranks walk, walk always outranks rent. Three trivial bath/walk candidates permanently suppress a rent-cap alternative matching the most homes. Violates "grouped by sacrifice, not cross-units numerical sort."
- Fix: sort numerically only within each sacrifice key (fixed key order or grouped output), or rank by `newlyMatchedIds.length` descending; never compare `after` across keys.

**5. `src/domain/reconcile.ts` — `diffSnapshots`: timestamp-only refresh counted as changed**
- Trigger: a re-fetch reproducing every fact identically but bumping `home.lastObservedAt` (and/or a fact's `observedAt`) makes `JSON.stringify(previous) !== JSON.stringify(home)` → home lands in `changedIds`. Violates "refresh diff should not count timestamp-only as changed." Also sensitive to property insertion order if homes are rebuilt.
- Fix: compare stable projections, e.g. `JSON.stringify(home, (k, v) => (k === 'lastObservedAt' || k === 'observedAt') ? undefined : v)`; use a key-sorting stringify if reconstruction order varies.

**6. `src/domain/reconcile.ts` — `reconcileHomes`: winner-take-all merge discards duplicates and conflicts**
- Trigger: existing `{ buildingKey: 'b', offerKey: 'o', rent 250000, lastObservedAt: T1 }`; incoming `{ buildingKey: 'b', offerKey: 'o', rent 230000, different sourceListingIds, lastObservedAt: T2 > T1 }` → newer replaces older wholesale; the price conflict and second listing identity vanish. Violates "source identity preserves conflicts and duplicates."
- Fix: overwrite only when a timestamp-stripped projection is equal; otherwise keep both (include `sourceListingIds` in the identity key) or merge differing facts into `state: 'conflicting'` carrying both evidence sets.

Not flagged (verified correct): equal-split cap math (`whole ≤ occupants × cap`); unknown utilities only affect readiness (`unknownItems`/questions), not rent fit; whole-building price excluded from unit rent via offer-scope evidence checks in `validateSnapshot`.