# Source build report

Checked 2026-09-12, with six bounded live HTTP retrievals during implementation. The final compact capture was collected at `2026-09-12T09:45:57.660Z` UTC (`05:45:57 EDT`) and is in [`data/seed/observations.json`](../../data/seed/observations.json). Raw HTML is retained locally under `data/raw/` (ignored by Git), including the timestamped final captures and earlier refreshes.

The collector returned 24 addressed observations from three independent public organizations:

| Source | URL | Observations | Key fields |
| --- | --- | ---: | --- |
| CMU Off-Campus Housing | https://offcampus.housing.cmu.edu/listing | 10 | building title/address, advertised bed label when exact, range/price, availability, utilities explicitly listed as included |
| Lobos Management | https://lobosmanagement.com/units | 12 | unit URL/slug, building title/address, advertised beds/baths, `From` rent lower bound, availability |
| Reinhold Residential | https://reinholdresidential.com/properties/shadyside-commons/ | 2 | unit IDs 482-0345 and 482-0303, layout, exact monthly rent, row-scoped availability |

The source run ledger records all three successful pages as `imported`, with 10/12/2 observations and UTC completion timestamps. The broader registry retains Kerpec (bounded page returned no parseable current inventory), Walnut, Zillow Group, Apartments.com, Realtor.com, Zumper and other surveyed sources as link-only or unavailable gaps. No login, CAPTCHA bypass, provider contact or model guessed value was used.

Parsing deliberately preserves uncertainty. CMU's repeated layout table rows do not carry a compatible card scope, so bathrooms remain unknown and a card range is not turned into a unit quote. Lobos `From` prices are represented as lower bounds with unknown upper amount and unknown rent basis; no whole-home qualification is inferred. Reinhold utilities are unknown because the availability page does not state them. CMU cards have source evidence for utility labels under an explicit `Utilities Included` section; each canonical home keeps the six utility names, with absent utilities shown as unknown.

The five-record audit covered: Reinhold's two-row unit table (including the 2BR/2BA record), a CMU utility-inclusion record, a Lobos `From` offer, and same-address/different-unit records. Same-building units such as Lobos Amadell and Sycamore remain separate by offer URL/slug. A synthetic regression fixture under `tests/fixtures/shadyside-commons.html` verifies that `482-0303` retains `2026-09-10` while `482-0345` retains `2026-09-13`, and rejects a cross-row date proposal. The fixture is not used in the seed.

Validation evidence:

```text
npm test -- tests/ingest
1 file passed, 2 tests passed

npx tsc --noEmit --pretty false
passed

validateSnapshot(compact seed wrapped as Snapshot)
VALID 24 homes, 107 evidence rows, 3 source runs
```

The live snapshot has no route records yet; Gates Hillman walking qualification therefore remains unknown until the geographic worker computes routes. The observed public listing dates and prices are point-in-time evidence, not a guarantee of current vacancy.

The second live refresh was a real HTTP retrieval (not fixture replay). SHA-256 comparisons showed CMU changed (`bbd64339…` to `fa67b7c1…`) and Lobos changed (`b7cc983e…` to `b43fd1c8…`), while Reinhold was unchanged (`aa92a891…` on both captures). The final parser count remained 10/12/2; unchanged Reinhold facts retain their new observation timestamp in the seed rather than being treated as newly changed inventory.

The documented CLI was also exercised with `node --import tsx jobs/ingest.ts --market pittsburgh --limit 6 --refresh`. It returned `ingest-7f8029a46438`, fetched 3 pages, imported 6 requested IDs, quarantined 31 unknown fields, and reported no failures. The canonical seed was refreshed by that live invocation and then passed strict snapshot validation with 24 homes, 107 evidence rows, and 3 scoped source runs.
