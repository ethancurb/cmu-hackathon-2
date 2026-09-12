# Frontend build verification — September 12, 2026

The React workspace presents the seeded CMU search as an editable sentence above a dense list and routed map. The visible search stays at $1,200 personal base rent, two equal shares, two bedrooms, two bathrooms, and a 20-minute walk until the renter changes it. The zero-match state retains all researched offers, explains evidence gaps, and offers the smallest one-change alternative. The alternative preview names Webster Hall · B2 and states the $7.50 monthly share-cap increase before applying it. Revert restores the original criteria.

The detail view separates floor plan from confirmed unit, advertised whole-home rent from computed personal share, sourced or derived utility and lease claims, current vacancy uncertainty, six utility states, routed walking, dated transit context, nearby errands, and source citations. The comparison sheet aligns up to three options; the shortlist persists across reload and retains a label/source link when an option is missing from the current snapshot. Coverage aggregates all recorded runs per housing source and lists unsearched registry entries separately from supporting geographic data. City and state are editable in the destination dialog; changing market clears the old city’s inventory until new research is run.

Actual-data screenshots under `docs/artifacts/`:

- `frontend-real-zero-1440.png`: original zero-match list/map, 49 researched options in the audited snapshot used for this capture.
- `frontend-real-alternative-preview.png` and `frontend-real-alternative-applied.png`: +$7.50 monthly share-cap preview and one newly qualifying floor plan.
- `frontend-real-detail-settled.png`: Webster Hall · B2 with the selected foot route rendered to Gates Hillman after map motion settles.
- `frontend-real-compare.png`, `frontend-real-shortlist.png`: side-by-side comparison and saved option rail.
- `frontend-real-mobile-list.png`, `frontend-real-mobile-map.png`: narrow list and map modes after tiles and property photos load.
- `frontend-real-city-dialog.png`: editable city, state, and destination fields.

Validation in the isolated frontend worktree: `npm run build` passed including client/server TypeScript checks; `npm test` passed 14/14 tests. A Chromium flow against the real API passed original zero-match, alternative preview/apply/revert, detail, compare without any shortlist, shortlist persistence, and mobile list/map, with no page errors. A separate city-change browser test used a mocked geocoder candidate to verify the client sends Boston/MA, hides Pittsburgh options, and restores the seed with Reset demo. That mocked candidate was test-only and is not included in product data. The parent integration separately exercised live destination lookup, routing, import, and city isolation.

The production build emits Vite’s 500 kB chunk-size advisory because the single client bundle includes Leaflet and React; it does not block the build. Photos are original-source property images and may load later than text on a slow connection. A source observation or floor-plan offer does not establish current unit vacancy.
