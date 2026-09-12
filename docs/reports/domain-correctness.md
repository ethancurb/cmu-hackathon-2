# Domain correctness repair

This repair closes the domain-review findings while retaining the existing contract shapes.

- Only `sourced` facts can satisfy hard listing constraints. Computed personal rent remains arithmetic over a sourced whole-home base-rent fact.
- Cost summaries exclude optional charges, do not bill explicitly inapplicable utilities, and do not invent an unlisted `other` utility. A known rent with unresolved bills is `known_components_only`; a missing compatible rent is `unknown`.
- Walking qualification chooses the latest usable `foot` route for the exact destination ID, version, and requested coordinate. Its origin must agree with the sourced home coordinate and both route snaps must be within 75 metres.
- Alternatives select one evidence-backed option per sacrifice group, ordered within that group rather than by incomparable rent, time, and bath magnitudes.
- Refresh diffs ignore observation/retrieval timestamps and object-property ordering while retaining fact states, evidence IDs, and material values.
- Reconciliation includes source listing identity, so distinct-source observations of the same building/offer remain available for conflict presentation instead of being overwritten.
- A snapshot is only evaluated for its recorded market. A new market produces an empty research result and requests discovery.

Synthetic fixtures now issue scoped evidence IDs and `syntheticSnapshot([home2400()])` validates through the production snapshot validator.

Verification on this revision:

```text
npm test -- tests/domain
# 7 files, 28 tests passed
npm run typecheck
# passed
git diff --check
# passed
```
