# Source build report

The latest bounded live refresh completed at `2026-09-12T10:20:04.877Z` UTC (`06:20:04 EDT`). Its compact capture is in [`data/seed/observations.json`](../../data/seed/observations.json). Raw HTML is retained locally under `data/raw/` (ignored by Git), including the timestamped CMU, Lobos index, Lobos Bentley detail, and Reinhold responses.

The collector returned 41 addressed observations from three independent public organizations:

| Source | Observations | Key fields retained |
| --- | ---: | --- |
| CMU Off-Campus Housing | 30 | 10 card observations plus 12 nearby active 2-bedroom floorplans meeting the requested bath threshold and 8 nearby 2BR near misses from embedded `listingData`; exact bed/bath, rent or range, optional availability, coordinates, utility labels, lease labels, amenities, and a source photo when present |
| Lobos Management | 13 | 12 current public index leads plus Bentley A-3 detail at 6201 Fifth Avenue: exact 2 bed/1 bath, $1,699/month, available 2026-08-05 |
| Reinhold Residential | 2 | Unit IDs 482-0345 and 482-0303, row-scoped layout, exact monthly rent, and row-scoped availability |

There are 17 sourced 2BR/2BA observations, 17 observations with source photos, and 17 with source amenities. The CMU set deliberately includes eight nearby 2BR near matches with 1 or 1.5 baths so the tradeoff is visible. Utility labels are retained as terms while inclusion remains unknown unless the page says “included”; six utility terms are sourced in the current seed. Lease terms are sourced for eight observations. Missing utilities, unit IDs, bath decomposition, and routes remain unknown. A per-person CMU quote remains explicitly `per_person`; a whole-unit quote is never inferred from it.

The research scope records Pittsburgh / CMU, the criteria destination version, and the 1,200-second scenario limit. Because these pages were fetched without source-side filters, queried bedrooms, bath minimum, whole-unit ceiling, and property types are all `null`; the scope limit reasons say so explicitly. The registry keeps CMU, Lobos, and Reinhold as separate source families. Zillow/Trulia/HotPads share a `zillow-group` family, and Apartments.com/Apartment Finder share an `apartments-com-network` family. Kerpec, Walnut, Realtor.com, Zumper, Redfin Rentals, Rent.com, Craigslist, and Facebook remain honest link-only or unavailable inventory gaps without claimed retrieval.

No login, CAPTCHA bypass, provider contact, or model-guessed value was used. Fetching is bounded to 15 seconds, 12 MiB, and one transient network retry. Every retained fact points to an evidence row from the actual response and observed timestamp. The targeted Lobos detail is persisted as a separate raw response so its unit record is reproducible.

Validation evidence from this batch:

```text
npm run typecheck
passed

npm test -- --run
7 files passed, 18 tests passed

validateSnapshot(compact seed wrapped as Snapshot)
VALID 45 homes, 448 evidence rows, 3 imported source runs
```

The parser regression fixture under `tests/fixtures/shadyside-commons.html` verifies that `482-0303` retains `2026-09-10` while `482-0345` retains `2026-09-13`, rejects a cross-row date proposal, and rejects a swapped rent. A CMU embedded-data fixture verifies exact 2BR/2BA extraction, range rent, photo preservation, and unknown utility inclusion. No route records are in this source seed; walking qualification remains unknown until the geographic worker computes routes.
