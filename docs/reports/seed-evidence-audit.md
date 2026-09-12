# Seed evidence audit — five material CMU records

Audited September 12, 2026 from the committed seed and the captured public
pages, not from schema shape alone. CMU evidence came from
`../../../sources/data/raw/cmu-offcampus-2026-09-12T10-06-54-077Z.html:1` (embedded
`listingData`); Lobos evidence came from
`../../../sources/data/raw/lobos-management-detail-2026-09-12T10-06-55-215Z.html:1`.
The raw HTML is deliberately one long line, so source references below use its
stable JSON/CSS field locator as well as the captured-file line.

## Result by record

| Record | Price and layout evidence | Scope / availability finding | Utilities, photo, and review finding |
| --- | --- | --- | --- |
| `cmu-floorplan-30562681` — Webster Hall B2 | **Supported:** `rent_style: "unit"`; the same `floorplans[id=30562681]` row says `bed:"2"`, `bath:"2"`, `rent:"2415.00-2415.00"`, `min_rent:"2415.00"`, `max_rent:"2415.00"`, `status:"Active"`, `available_date:"2026-08-19"`. This is an exact advertised monthly whole-home floor-plan price, not an effective/from/per-person price. It is not a specific unit. | Plan association is sound for price/layout/date. The date is a stated floor-plan availability date, not proof of a vacant unit. The 12-month lease is **not** plan-scoped (P0-3). | CMU only lists generic property `Utilities` terms; none says included. Keep all utility inclusion unknown (P0-2 affects `Trash`). The image URL is genuine but property-gallery scope, not B2 scope (P0-1). No review fact was seeded. |
| `cmu-floorplan-30562682` — Webster Hall B3 | **Supported:** the same row structure has B3, 2 beds, 2 baths, `$2435.00-$2435.00`, `rent_style:"unit"`, active, and `available_date:"2026-08-19"`. Exact whole-home floor-plan price; no unit identity. | Same conclusion as B2. The lease term is generic property metadata, not B3 evidence (P0-3). | Same generic utility and property-gallery limits as B2 (P0-1/P0-2). No review fact was seeded. |
| `cmu-floorplan-28130489` — 6350 Forward, 2x2 Units | **Supported:** `rent_style:"unit"` and the same `floorplans[id=28130489]` row says `bed:"2"`, `bath:"2"`, `rent:"1995"`, `min_rent:"1995"`, `max_rent:null`, active, `available_date:"2026-08-01"`. Exact advertised whole-home floor-plan rent; no individual unit. | Layout/rent/date share one row. Its 12-month term instead comes from property `features['Lease Length']`, so it must not be represented as plan/offer scoped (P0-3). | No utilities are stated. The supplied image is a real source URL, but it is a property gallery image and was incorrectly scoped to this floor plan (P0-1). Generic amenities are property context only (P0-2). No review fact was seeded. |
| `cmu-floorplan-1295515` — Shadyside Commons 2-bedroom plan | **Supported with readiness warning:** `rent_style:"unit"` and the plan row says 2 beds, 2 baths, `rent:"2795"`, `min_rent:"2795"`, `max_rent:null`, `status:"Active"`. This supports a whole-home plan price, not a unit. | Its only listed availability date is `2022-12-29`, observed in a 2026 capture. It cannot support current vacancy and the current readiness logic does not flag it (P0-4). The “one month free on select apts” text is property-level and expressly selective, so it cannot be attached to this plan (P0-5). | No utilities are stated. The image URL is genuine but property-gallery scope (P0-1). No review fact was seeded. |
| `lobos-detail-bentley-apartments-021-a-03` — Bentley A-3 | **Supported:** the unit-detail page itself says `2 Beds • 1 Baths`, `$1699 /month`, address `6201 FIFTH AVENUE`, unit `A-3`, and `Availability: 8/5/2026`. This is an exact monthly whole-unit offer, and layout/price/date are one unit-detail record. It is a known 1-bath near-match, not a 2-bath result. | The source is a unit detail page; availability is an advertised unit date, not independently confirmed vacancy. | The Open Graph/detail image URL is genuine and is appropriate to this offer. The amenity list, including `Heat`, is on the A-3 page. It supports a unit feature, **not heat included in rent** and not every Bentley unit (P0-2). No review fact was seeded. |

The seed currently represents all five as `listingStatus:"observed"`: that means
the source was observed, not that the offer was independently verified vacant.
For the four CMU records, the `units: []` source rows reinforce that these are
floor plans, not identified units.

## P0 corrections before treating the seed as decision-ready

### P0-1 — CMU property-gallery photos are falsely scoped as floor-plan photos

The raw CMU properties expose a single `images` array beside the property,
separate from `floorplans`; there is no image-to-plan relation. For example,
`listingData[103523].images[0]` is
`2026-02/6986032cd38f95.89769311523X1pG61770426072.jpg`, while B2 and B3 are
separate `floorplans` rows. The same pattern holds for 72974 and 103658.

The seed calls the display string “property photo,” but its evidence is still
declared `scopeKey: cmu-floorplan-*`, `scopeKind: floor_plan` — e.g.
[`observations.json:31010`](../../data/seed/observations.json#L31010) through
[`observations.json:31020`](../../data/seed/observations.json#L31020) and used
by B2 at [`observations.json:3825`](../../data/seed/observations.json#L3825).
It repeats for B3 at line 4556, Shadyside Commons at 5656, and Forward at
12074. This is a provenance error even though the image URLs resolve to the
source's gallery.

**Fix:** in [`cmu.ts:115`](../../jobs/sources/cmu.ts#L115), create photo
evidence with `buildingKey`, `scopeKind: 'building'`, and
`appliesToAllUnits: false`; use a locator such as
`listingData[${propertyId}].images`. Preserve the current “property photo” alt
text. Do not imply a B2/B3/2x2-specific photo until the page provides that
association.

### P0-2 — generic CMU and A-3 feature blocks are being promoted to the wrong scope

CMU's `features` object labels its own sections `Unit Features`, `Property
Features`, and `Utilities`; it supplies no per-floor-plan link or statement
that every plan receives them. Yet [`cmu.ts:101`](../../jobs/sources/cmu.ts#L101)
through [`cmu.ts:108`](../../jobs/sources/cmu.ts#L108) set building evidence to
`appliesToAllUnits: true`. It yields claims such as 6350 Forward “Dishwasher”
with that flag at [`observations.json:34364`](../../data/seed/observations.json#L34364)
through line 34374. The data contracts explicitly require an **explicit**
property-wide statement before such a claim can be made.

For Webster, the source excerpt is the generic list `Utilities: ["Cable TV
Discount", "Pest Control", "Snow Removal", "Trash"]`. It does not say that
any item is included, paid by the landlord, charged to the B2/B3 plan, or even
applies to every unit. The present converter creates a `Trash` utility with
`applicable:true` from this list. That is not inclusion evidence and must not
be used to complete cost information.

Lobos has the inverse problem: the raw A-3 detail page’s feature text is
`Hardwood floors, Refrigerator, Dishwasher, Stove and oven, Heat, Carpet, Cat
friendly, Garage, Smoke-free`. It occurs on an A-3 page, but
[`lobos.ts:52`](../../jobs/sources/lobos.ts#L52) through
[`lobos.ts:61`](../../jobs/sources/lobos.ts#L61) deliberately create
building-wide/all-units evidence; [`collect.ts:58`](../../jobs/sources/collect.ts#L58)
then hard-codes every amenity’s displayed scope to `building`. The resulting
`Heat` evidence is building-wide at
[`observations.json:34858`](../../data/seed/observations.json#L34858) through
line 34868. “Heat” is an installed/available feature in this unit's text; it
does not say heat cost is included.

**Fix:** retain CMU feature/utility information only as clearly labeled
property context with `appliesToAllUnits:false`, or omit it from a plan record
when the UI cannot display that distinction. In particular, leave utility
`inclusion` and `applicable` unknown; do not make a charge or an inclusion
claim from the list. For Lobos, add amenity scope to `ObservedListing`, emit
its A-3 features with `offerKey`, `scopeKind:'offer'`,
`appliesToAllUnits:false`, and map that scope in `toHome` instead of forcing
`building`. Keep `Heat` out of the included-utility field unless a source says
included.

### P0-3 — property-level lease metadata is asserted as individual plan/offer terms

The source stores `features['Lease Length']:["12-month"]` on Webster Hall and
6350 Forward property objects, outside every floor-plan row. The parser
creates the evidence using each `offerKey` at
[`cmu.ts:110`](../../jobs/sources/cmu.ts#L110) through
[`cmu.ts:111`](../../jobs/sources/cmu.ts#L111). That makes the B2/B3/2x2
records appear to have offer-scoped terms. The generated B2 evidence itself
admits its locator is property-level, while claiming offer scope at
[`observations.json:31000`](../../data/seed/observations.json#L31000) through
line 31007.

**Fix:** without a plan-linked lease row, set `leaseTerms` to unknown on each
floor plan. Optionally retain the source text as property context, clearly
labeled “property listing says 12-month; plan applicability not stated.” Do
not manufacture an offer-key evidence record to satisfy the schema.

### P0-4 — Shadyside Commons' 2022 availability is treated as a known current-readiness fact

Raw `listingData[72974].floorplans[id=1295515]` says
`status:"Active"` but `available_date:"2022-12-29"`; captured on
2026-09-12. The seed faithfully copies the old date at
[`observations.json:5465`](../../data/seed/observations.json#L5465), but it
labels the home observed and the matching readiness question only asks about
availability when its value is null
([`matching.ts:62`](../../src/domain/matching.ts#L62)). A past date therefore
looks resolved even though it cannot establish current availability.

**Fix:** preserve the quoted date and its floor-plan evidence, but add a
readiness rule for a date earlier than the observation date: “source lists an
old availability date; confirm current vacancy.” Do not turn a re-fetch miss
into off-market status. A more conservative seed may make current availability
unknown while preserving the raw date in evidence/context.

### P0-5 — Shadyside Commons' selective concession is attached to a specific plan

The raw property field is exactly `<p>ONE MONTH FREE ON SELECT APTS!</p>`.
It contains neither floor-plan 1295515 nor a unit. The parser assigns it to
that plan’s `offerKey` at [`cmu.ts:112`](../../jobs/sources/cmu.ts#L112) through
[`cmu.ts:113`](../../jobs/sources/cmu.ts#L113), and the generated evidence does
the same at [`observations.json:31608`](../../data/seed/observations.json#L31608)
through line 31618.

**Fix:** set this plan’s `concessions` fact to unknown. If displayed, retain it
only as a property-level lead with the original qualifying words “select
apartments”; it must not alter plan rent, personal-share matching, or a
decision-ready cost.

## Source map coordinates: usable now, not a Nominatim substitute

CMU's embedded public data already supplies coordinate pairs at the **property**
level, so the seed should prefer them for every associated floor plan:

| Property / attached plan(s) | Raw extraction path | Captured values | Current path |
| --- | --- | --- | --- |
| Webster Hall / B2, B3 | `listingData[103523].lat`, `.lng` | `40.44706`, `-79.95092` | Correctly read at [`cmu.ts:84`](../../jobs/sources/cmu.ts#L84) and mapped at [`cmu.ts:114`](../../jobs/sources/cmu.ts#L114); B2 seed coordinates at [`observations.json:3137`](../../data/seed/observations.json#L3137). |
| Shadyside Commons / 1295515 | `listingData[72974].lat`, `.lng` | `40.45322`, `-79.94088` | Same parser path; coordinate should remain building/property scoped. |
| 6350 Forward / 28130489 | `listingData[103658].lat`, `.lng` | `40.428486`, `-79.919556` | Same parser path; coordinate should remain building/property scoped. |

This is source-provided map data attached to the CMU property records, not a
Nominatim result. It should be used before address geocoding for CMU floor
plans, while retaining building-level evidence and the exact `lat`/`lng`
locator. No comparable coordinate was verified in the audited Lobos A-3
capture, so its coordinate should remain unknown until a source-owned map
coordinate or a separately evidenced geocode is available.

## What passed this audit

The five price/layout combinations were not fabricated or cross-joined: the
four CMU combinations each occur in a single `floorplans[id=…]` record, and
the Bentley combination occurs in its A-3 detail summary. The two Webster
prices are exact whole-home plan rents, not “from” values; 6350 Forward and
Shadyside Commons use `max_rent:null` with a single quoted `min_rent`, which
the source presents as a single plan rent. The caveat is semantic: the source
calls these values `rent`, rather than expressly breaking out a base-rent and
fee schedule. They remain advertised monthly rent with unresolved mandatory
fees and utilities, not complete monthly housing costs.

No sourced review claim was found or seeded for these five records. The four
CMU photos are real source-gallery URLs but must be relabeled/re-evidenced as
property images; the Lobos URL is a real unit-detail/OG image and remains
offer-scoped.
