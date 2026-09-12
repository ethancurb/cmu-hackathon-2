# Map, walking, transit, and amenities feasibility

**Planning observation time:** 2026-09-12 08:14–08:19 UTC. This is a recommendation for the seeded CMU demonstration, not application code or a claim that the observations will remain live.

## Recommendation

Use an OpenStreetMap-backed map with a visibly attributed **Gates Hillman—mapped entrance** destination, public FOSSGIS foot routing for the small seeded demo, PRT's static GTFS plus public GTFS-realtime for transit context, and a bounded OpenStreetMap amenities query. This is practical without a paid account and supports an editable arbitrary city destination: store a destination coordinate/label and ask the same walking-router adapter for each listing.

The route must be the deciding value for the `<=20-minute walk` filter. A nearby straight-line distance, a generic campus pin, a driving route, or a bus trip cannot stand in for it. Show the destination pin, walking line, duration, distance, provider, retrieval time, and route assumptions whenever a candidate is selected. If the request or response fails, show `walking route unavailable` and exclude the home from an exact-walk match; never substitute an estimate silently.

## Gates Hillman destination evidence

CMU calls the complex the Gates and Hillman Centers, lists its address as **4902 Forbes Avenue**, and says exterior doors/walkways improve pedestrian access. Its own news material identifies a **Forbes Avenue entrance** to the Gates and Hillman centers; a CMU-hosted directions page separately calls Hillman's Forbes-facing entrance the easy approach from Oakland. These establish the intended pedestrian entry, rather than a campus centroid. [CMU building page](https://www.cmu.edu/cdfd/buildings/gates-hillman/index.html), [CMU news](https://www.cmu.edu/news/stories/archives/2011/july/july26_publictransitapp.html), [CMU-hosted directions](https://www.cs.cmu.edu/~brookes/MFPS2011/LocalInformation/).

For the seed, use the auditable coordinate **40.4440338, -79.9445593** (latitude, longitude), label it `Gates Hillman — mapped entrance`, and render it as the distinct destination pin. An OpenStreetMap Overpass query at 08:16 UTC found OSM way `27623372`, named `Gates and Hillman Centers`, and a directly-member `entrance=main` node `1704796692` at that coordinate. A 100 m network-context query also returned named Forbes Avenue ways. OSM is corroboration for the exact map point; the CMU sources establish that a Forbes Avenue pedestrian entrance exists, but neither source names this particular node “Forbes.” A read-only browser visual check was unavailable in this environment, so the neutral label is intentional and the demo must not claim that the exact node is named Forbes. Keep the CMU address, OSM node ID, coordinate, source URLs, and observation date together so a changed/closed entrance can be corrected.

## Observed walking-route proof

At **08:18:59 UTC**, this GET returned HTTP 200 from the public FOSSGIS foot router:

```text
https://routing.openstreetmap.de/routed-foot/route/v1/driving/
  -79.94965,40.44185;-79.9445593,40.4440338
  ?overview=full&geometries=geojson&steps=true
```

The input origin is an intentionally arbitrary Oakland sample point, not a housing claim. The response snapped the destination exactly to `[-79.944559,40.444034]`, returned `code: "Ok"`, a route of **760.4 m** and **607.8 s (10.13 min)**, eight steps, and `routes[0].geometry` as a 47-coordinate GeoJSON `LineString`. Every observed step reported `mode: "walking"`. The path segment says `driving` because OSRM keeps that URL segment; the host is specifically `routed-foot`, and the provider documents distinct car/bike/foot profiles. This is therefore a real foot-profile response, not a driving-profile result. The complete response/header probes are temporary files under `/private/tmp/cmu-geo-probe-*`, not product data.

For implementation, request `overview=full`, `geometries=geojson`, and `steps=true`; persist the returned geometry, metres, seconds, provider URL/profile, requested/snap coordinates, and `retrieved_at`. Compare seconds to 1,200 exactly (or round only for display). The FOSSGIS service documents a valid identifying user agent/referrer, **at most one request per second**, and no scraping/heavy use, so throttle and cache one result per origin/destination/profile during the demo. It has no SLA: the usable fallback is a saved, visibly dated response for the seeded candidates, described as “computed walking route captured [time]”; failed new/edited origins remain unavailable. A later product should use a contracted or self-hosted pedestrian router, keeping the same fields, rather than treating a community endpoint as production capacity. [Router policy/profile documentation](https://routing.openstreetmap.de/about.html).

## Transit: factual campus context, not a walking substitute

PRT supplies the appropriate official path. Its developer page says static GTFS is generally updated within two weeks before quarterly changes, links public bus GTFS-realtime, and publishes GIS route/stop data; its license requires accurate reproduction, the specified reproduced-with-permission notice for derivatives, reasonable efforts to stay current, and acknowledges that data may be unavailable or inaccurate. [PRT developer resources](https://www.rideprt.org/business-center/developer-resources/), [PRT license](https://www.rideprt.org/business-center/developer-resources/developer-license-agreement/).

Observed requests:

* `GET https://www.rideprt.org/developerresources/GTFS.zip` returned HTTP 200 at **08:17:02 UTC**, 22,512,403 bytes. `feed_info.txt` says `Merged_Clever_2606_2`, valid 2026-06-28 through 2026-10-14. (An earlier guessed `/media/.../gtfs.zip` URL returned HTTP 404; use the directory link, not that guess.)
* `GET https://truetime.portauthority.org/gtfsrt-bus/` returned HTTP 200 at **08:15:01 UTC** and listed public `vehicles`, `trips`, and `alerts` feeds. `GET .../trips?debug=` returned HTTP 200 at about **08:15 UTC**, 488,603 bytes, with a GTFS-RT full-dataset timestamp `1789200920`; `vehicles?debug=` returned HTTP 200, 12,018 bytes, timestamp `1789201004`. These support current arrival/vehicle context but do not prove service completion, crowding, or accessibility.

The current static feed places two campus-adjacent stops on Forbes/Morewood: **4407, “FORBES AVE + MOREWOOD AVE FS (CARNEGIE MELLON)”** at 40.444698, -79.943756, and **7117, “FORBES AVE + MOREWOOD (CARNEGIE MELLON)”** at 40.444458, -79.942291. Feed trip/headsign records show 4407 carries 28X outbound Airport; 58 inbound Downtown / outbound Carnegie Mellon; 61A/61B/61C inbound Downtown; 61D inbound Oakland; and 67/69 inbound Downtown. Stop 7117 carries 61A/61B outbound Braddock variants, 61C outbound McKeesport, 61D outbound Waterfront, and 67/69 outbound Forbes Hospital/CCAC Boyce. These direction/headsign labels, not just route numbers, should be displayed. Re-evaluate exact service, alerts, and the candidate's boarding direction at viewing time; the static feed is schedule context, not a guaranteed departure.

For the demo, show relevant nearby stops/routes as a separate `Transit nearby` fact with stop, headsign, scheduled/realtime timestamp, and a short walk from the stop to the same Gates entrance if calculated. Do not label a route as “to Gates Hillman” merely because it serves CMU, and do not let it change the 20-minute walking qualification. Full multimodal itinerary planning is optional later work; PRT's stop/route facts are sufficient now.

## Amenities and map data

At **08:19 UTC**, a bounded Overpass query over the CMU/Oakland area for `shop=supermarket|grocery|convenience` returned HTTP 200 with nine records, including **Scotty's Market** (`shop=supermarket`, 40.4441892, -79.9389348), **Entropy+**, Forbes Street Market, Seoul Mart, and several convenience stores. A companion query for supermarket/pharmacy/cafe/restaurant returned 59 records. This supports a useful `Nearby essentials` list: classify exactly as sourced (`supermarket`, `convenience`, etc.), show name and a clearly labeled straight-line distance or a separately routed walking time, link to the OSM object, and show `not found in queried OSM data` rather than implying no amenity exists. Hours are often absent or stale and must be labeled as OSM observations, not promises.

Use a MapLibre/Leaflet-compatible basemap and visible `© OpenStreetMap contributors` attribution. OSM's public tile policy requires attribution, identifying user agent/referrer, and HTTP-cache compliance (at least seven days where headers cannot be read), prohibits bulk prefetching, and offers no SLA. Nominatim similarly requires an identifying client, attribution, caching, and no more than one request/second; one observed query for “Gates Hillman Center” returned HTTP 200 with `[]`, so do not depend on it to resolve this seed. Save known destination/candidate coordinates and query amenities only for a visible/current result set. [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

This path is low setup risk for a small, seeded demonstration, with two explicit operational risks: community map/router availability and OSM completeness. The honest fallback is cached, timestamped evidence for the seeded listings plus a clear unavailable state for changes. Google Routes/Places or a commercial routing/maps provider could later supply supported geocoding and multimodal routing, but requires account, billing, and its display/caching terms; it is not needed to meet the current demonstration proof.
