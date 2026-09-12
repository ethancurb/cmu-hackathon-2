# Domain build handoff

The decision engine exports its consumer-facing barrel from `src/domain/engine.ts`: `evaluateSearch`, `evaluateHome`, `applyCriteriaPatch`, `suggestAlternatives`, `computeCosts`, and `needsDiscovery`. Contracts and inferred types are in `src/domain/schema.ts`; `SEED_CRITERIA` is also available from `src/config/seed.ts`.

The engine keeps rent qualification separate from cost completeness. It uses exact integer cross-multiplication for the rent cap, tracks unknown utilities and unresolved charges as questions, validates the configured destination/version and raw walking seconds, and produces alternatives only when the unchanged engine finds an actual newly matched home. Reconciliation retains distinct confirmed offers, and coverage uses the structured recorded scope without claiming exhaustive market coverage.

Verification on this revision:

```text
npm run typecheck
npm test -- tests/domain/schema.test.ts tests/domain/costs.test.ts tests/domain/matching.test.ts tests/domain/alternatives.test.ts tests/domain/reconcile.test.ts tests/domain/coverage.test.ts
```

Both commands passed (14 domain tests). Fixtures are synthetic and explicitly `test:`-prefixed; they are not product seed data.
