# Geographic enrichment build report

## Delivered adapter surface

`jobs/geo/enrich.ts` exports the contract function
`enrichRoutes(snapshot, destination, signal)`. It routes only homes with a
valid, supplied coordinate, adds each route ID to that home, and leaves an
unplaced lead unchanged. `enrichSnapshot(snapshot, criteria, signal,
onProgress?)` composes walking routes, PRT context, and nearby OSM essentials.
Its network failures are progress messages and partial snapshot results, never
invented transit, essential, coordinate, or route facts.

`jobs/geo/geocode.ts` exports `findDestinations(query, market, signal)` and
`manualDestination(label, coordinate)`. The former uses Nominatim only after an
explicit submit, limits requests to one per second, and caches the response.
The latter is the map-pin fallback and is marked as such. `geocodeEvidence()`
returns the accompanying Nominatim `SourceEntry` and `Evidence` for a caller
that saves the new destination in a snapshot. Cache records preserve the
original full returned address and observation timestamp; evidence never
invents a later refresh time.

The seed destination remains the canonical mapped Gates Hillman entrance at
`40.4440338, -79.9445593`; route inputs use the supplied versioned destination.

## Evidence, routing, and cache behavior

FOSSGIS requests the documented `routed-foot` endpoint with the `driving` URL
segment required by OSRM, `overview=full`, `geometries=geojson`, and
`steps=true`. The adapter preserves provider GeoJSON as `[lon, lat]`, metres,
and unrounded seconds in its raw route cache. It checks that every reported
step is walking and that both snaps are within 75 m. A bad snap becomes
`needs_review`; a request or validation failure becomes an `unavailable` route
and cannot qualify a home.

Routes are serialized at no more than one request per second, have one
transient retry, and cache full provider responses under `data/cache/geo` by
origin, destination coordinate, destination version, and foot profile. Cached
records are checked against those inputs before reuse, and an empty/non-walking
step result is review-required. The source entry identifies the community
service and its no-SLA limitation.

The PRT adapter reads the official static GTFS ZIP, honors calendar and
calendar-date additions/removals, accepts GTFS times through `47:59:59`, and
only sets `servesDestination` after an origin stop occurs before a campus-side
stop in the same valid scheduled trip. It selects the next representative
weekday and includes that exact service date in the scheduled 07:00–10:00
window; it is not a live arrival. It considers up to eight boarding stops
within 500 m and campus-side stops within 400 m, ranks direct service first,
and returns at most five unique contexts. PRT is not applied outside its
Pittsburgh service area.
The composer keeps a compact stop/trip subset for the destination and placed
homes in `data/cache/geo/prt/subsets`.

OSM essentials are queried once around the active destination/research area and
are limited to a 1,500 m grocery/convenience, pharmacy, cafe, and restaurant
search. The bounded 400-result response is timestamped and cached for repeated
or offline refreshes. Each home receives a small diverse nearest list (grocery,
pharmacy, and cafe/restaurant where available) with straight-line distance, no
invented walk time, OSM object URL, and dataset evidence. The OpenStreetMap and
PRT source entries/evidence are appended together so every transit/nearby
evidence ID resolves under the strict snapshot contract.

Attribution and limitations are stored with the source entries:

- FOSSGIS: [routing policy/profile documentation](https://routing.openstreetmap.de/about.html)
- PRT: [official developer resources](https://www.rideprt.org/business-center/developer-resources/)
- OpenStreetMap: [attribution and usage policy](https://operations.osmfoundation.org/policies/tiles/)

## Verification

Ran from the `build/geo` worktree:

```text
npm test -- tests/geo       # 5 files, 19 tests passed
npm run typecheck           # passed
```

The adapter also parsed the cached official PRT artifact at
`/private/tmp/cmu-geo-probe-prt-gtfs.zip`: feed `Merged_Clever_2606_2`, 6,388
stops, 102 routes, 18,817 trips, and 1,005,348 stop-times. The saved foot probe
contains an `Ok` route with 607.8 raw seconds, 760.4 m, a 47-point LineString,
walking steps, and a final coordinate at the Gates map point.

`npm run build` reached typecheck successfully but then failed in Vite because
this isolated worktree does not yet contain `/src/main.tsx`. That failure is in
the root-owned application shell, before the geo server compilation stage.

## Integration remaining

When the addressed seed is available, invoke `enrichSnapshot` once with the
fresh snapshot and criteria, then have the root snapshot publisher write the
returned immutable snapshot. This produces fresh per-home routes; the planning
probe is only a parser/routing-shape check and is not treated as a home route.
