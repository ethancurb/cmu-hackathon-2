# Housing decision UI: design references and directions

Reference evidence for a later design review, not a final visual specification. I read the linked first-party pages on September 12, 2026. “Observed” is explicit in the source; “Inference” is a proposed adaptation. No screenshot behavior is assumed.

## Primary references

| Source | Observed | Inference for our search |
| --- | --- | --- |
| [Airbnb Engineering: Improving Search Ranking for Maps](https://airbnb.tech/ai-ml/improving-search-ranking-for-maps/) and [Airbnb Summer Release](https://news.airbnb.com/product-releases/airbnb-2023-summer-release) | Airbnb describes a desktop list/grid paired with map pins, regular price pins and smaller mini-pins, persistent while panning. It says total price with fees appears in results, filters, maps, and listing pages. | Keep inventory browsable. Let map emphasis follow the selected row or an explicit rule, while every lower-priority pin remains in the list. Put decision-relevant monthly cost in the list and map context. |
| [Zillow: personalized moving hub and shared collection](https://www.zillow.com/news/zillow-launches-a-personalized-hub-that-guides-home-buyers-from-first-search-to-closing/) | Zillow reports a shared workspace to save, organize, and compare homes across iOS, Android, and web. Its affordability view includes costs beyond list price and labels whether a listing fits a connected budget. | Make a shortlist a persistent decision workspace. Comparison must show the inputs behind a fit or deviation: rent basis, mandatory fees, and utilities. An unexplained match score cannot carry the decision. |
| [Mapbox Search Products Overview](https://docs.mapbox.com/help/getting-started/search/) | Mapbox describes interactive text search with a map: selecting a result moves the map and displays a marker. Its search box supports autocomplete and distinguishes POI search from address geocoding. | Selecting a home should synchronize row, pin, destination, and route. Gates Hillman needs a distinct destination marker, and the walking route must use it. Search and map movement should remain explicit controls. |
| [GOV.UK Design System: Summary list](https://design-system.service.gov.uk/components/summary-list/), [Details](https://design-system.service.gov.uk/components/details/), [type scale](https://design-system.service.gov.uk/styles/type-scale/), and [spacing](https://design-system.service.gov.uk/styles/spacing/) | Summary lists pair a named key with a value and optional action. Details reveals secondary information in place, with guidance not to hide what most users need. The type scale is tested for readability, uses 5px line-height rhythm, and changes at a 640px breakpoint; spacing is tokenized. | Use named fact rows for rent, share, utilities, walk, availability, and evidence date. Keep high-consequence facts open; put provenance, conflicts, and calculations in disclosure. |

## Two coherent visual directions

### A. Field guide / editorial map (recommended)

Use a warm paper surface (`#F7F5EF`), ink (`#19201D`), moss accent (`#2E6B57`), amber for a compromise (`#A86219`), and cool blue for the Gates Hillman route (`#2A69A5`). Pair a system serif display face with a readable system sans for body/data; use tabular numerals. Start at 32/36 title, 22/28 section headings, 16/24 body, and 13/18 metadata. Statuses need text labels and icons as well as color.

On desktop, use a 56% scrollable option list and 44% persistent map. Each evidence-led row shows address/source, “$1,140 personal share / $2,280 whole home,” “utilities: water + trash included; electric unknown,” “18 min walk to Gates Hillman,” and one consequence sentence. Keep the Gates Hillman pin and 20-minute boundary visible. Selecting a row highlights its pin and route; selecting a pin focuses its row. A compare rail holds three homes with the same named fact rows. Keep Coverage, Consequences, Alternatives, and Readiness visible; Alternatives states the exact changed criterion and gain, while Readiness lists the next question and source.

On smaller screens, keep the list first and make the map a sticky expandable sheet. Keep cost and utility rows above the fold; put provenance and calculations in Details disclosures. The result is calm while leaving facts room to compare.

### B. Civic instrument / transit board

Use a cool off-white canvas (`#F2F5F4`), near-black text (`#111817`), navy structure (`#17324D`), teal for confirmed fit (`#007C78`), rust for tradeoff (`#B34B32`), and slate for unknown (`#5D6B70`). Use one sans family with a heavier numeric style for rent, minutes, and counts. A 50/50 split pairs dense sortable rows with a map of numbered pins and a destination ring. A docked comparison matrix uses explicit dimensions, never a composite score. A selected row opens an evidence drawer with sources, freshness, route assumptions, and the exact match, near-match, or unknown reason.

On mobile, turn the split into List / Map and keep a persistent “2 homes selected” comparison bar. This is strong for auditability and fast scanning, but can feel administrative and flatten lived consequences.

## Recommendation and token contract

Choose **Field guide / editorial map**. It gives the user a legible inventory and a sense of place without turning the product into chat or generic cards, while borrowing Civic instrument’s explicit rows and evidence drawer. Define tokens—`font.display`, `font.body`, `font.data`, semantic colors, `space.1`–`space.9`, `radius.row`, and `map.listRatio`—so visual changes never touch comparison logic. Keep these assumptions in the header: `$1,200 personal rent cap`, `2 equal shares`, `$2,400 whole-home ceiling`, `2 bed / 2 bath`, and `20 min walk to Gates Hillman`. Utilities stay first-class: included, separately charged, partly covered, or unknown.
