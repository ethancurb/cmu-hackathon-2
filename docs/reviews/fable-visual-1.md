# Fable visual review 1

Model: claude-fable-5-1. Actual rendered preview images reviewed.

Verdict first: the bones are right and honest, but the surface is not yet distinguished. It reads as a competent gray research table beside a loud default map. The criteria sentence, the grouped list, the numbered markers, and the detail ledger are genuinely good product ideas. The rendering undersells them. The answer to "which homes fit" is not visible in the first 30 seconds on either viewport.

## The five highest-impact problems

**1. The answer is below the fold.** On desktop the first home row starts about 54 percent down the viewport. On mobile it starts about 64 percent down. Above it sits a marketing headline in a warm-white band, a breadcrumb, the criteria bar, the snapshot strip, a lonely alternatives card with empty space to its right, and a second "Browse the evidence" heading. Delete the title band entirely. Fold the breadcrumb into the header line. Make the editable criteria sentence the H1 of the page, since it is the actual statement of the user's life. Merge "Homes in this snapshot" and the sort control into the first group header. Move "What would open up?" to a slim ribbon placed at the boundary after the last exact match. That is where the narrative needs it: here is what fits, here is the one change that unlocks more, here is what is near. When the real seed yields zero exact matches, that ribbon becomes the first thing under the snapshot strip, which is correct.

**2. The six utility boxes on every row are the main density killer.** Five of six say "not stated" in every row, and the dashed borders read as skeleton loaders. Row height is roughly 175 pixels, so only two and a half rows fit at 1000 pixels tall. Collapse utilities to one line per row with a six-segment glyph. Filled segment means included, hollow means not stated, striped means uncertain or extra fee. Follow it with text like "Water included · 5 not stated." Keep the full six-cell breakdown in the detail view only. Drop the row line "Meets stated requirements" because the group header already says it. Keep only the unresolved count. Target row height of 100 to 110 pixels so five or six homes are visible at once.

**3. The map is the loudest element and shows the wrong thing.** Default OSM raster tiles bring orange arterials, hospital crosses, and every street label into competition with your five markers. The 20-minute foot boundary, the single hard spatial constraint, is not drawn at all. Desaturate the basemap. The zero-cost option is a CSS filter on the Leaflet tile pane:

```css
.leaflet-tile-pane { filter: grayscale(1) saturate(0.15) brightness(1.06) contrast(0.9); }
```

CartoDB Positron is the cleaner option if you can add a tile source. Since the router already computes foot routes, draw every home's route as a thin gray polyline and the selected home's route in blue. Do not draw a radius circle and call it a walk boundary. Make Gates Hillman a distinct black square marker, and make home markers at least 26 pixels with the row number inside. Keep the existing distinction of filled, ring, and dashed for meets, verify, and near. Add hover sync between row and marker. In detail view, fit bounds to the route instead of leaving it as a small line in the corner.

**4. Typography hierarchy is flat and the black group bars are the heaviest thing on screen.** Nearly all text is 13 to 15 pixel regular gray. Price and walk time are the only accents, which is right, but the address, meta, and status lines all blur. Prescribed scale in pixels:

| Role | Size / weight |
|---|---|
| Detail address | 28 / 600 |
| Row address | 17 / 600 |
| Price and walk time | 22 / 600, tabular nums |
| Meta and status | 13 / 400, gray 600 |
| Mono eyebrows | 11 / 500, tracking 0.08em |

Use the mono eyebrow only for section labels and source or timestamp lines. Replace the full black group header bar with a hairline rule, a mono label, and a count. Use blue for interactive elements and walk time only. Fix the copy leaks while you are in there: "19 Min (1110 Seconds)", "1 sources searched", "1 options", and "checked Sep 12–Sep 12."

**5. Mobile layout wastes the viewport.** The breadcrumb wraps, the List and Map toggle collides with the headline, the criteria chips wrap across five lines with a dangling "to", and the snapshot strip takes two lines. Below 640 pixels, collapse the criteria to one line such as "$1,200 share · 2bd · 2+ba · ≤20 min to Gates Hillman" with a chevron that opens an edit sheet. Put the List and Map toggle in the header or as a bottom-fixed segmented control. Reduce the snapshot strip to one line with counts only. Right-align the walk time as a single line rather than wrapping "walk to Gates Hillman" across three lines.

## What to retain

- **The criteria sentence with the ASSUMED chip.** This is the best idea on the page and exactly the honesty the brief asks for. Make it the H1.
- **Numbered rows tied to numbered map markers.** Keep and strengthen with hover sync.
- **Two big numbers per row.** Personal share and walk time, both labeled as computed. Do not add a third.
- **The three groups.** Meets, needs verification, near match. Keep as hairline sections.
- **The detail view structure.** The two-stat header, the "What fits, and what needs checking" ledger with per-field status, the cost ledger ending in "known monthly cost plus unresolved charges", per-line "View evidence", and the route legend stating router and distance. This page is closest to done.
- **"Calculated from homes already found"** under alternatives. Keep that disclaimer.
- **The wordmark and Plex pairing.** Fine. The problem is scale and weight, not typeface.

On photography, do not add hero imagery. This is an evidence tool. Add a 56 pixel listing thumbnail at the left of a row only when the source supplies one, and do not reserve space or fake a placeholder when it does not. That single change is the strongest "human-designed, not dashboard" signal available cheaply.

## Next iteration acceptance checklist

- Desktop at 1440 by 1000: title band gone, criteria sentence is the H1, first home row top at or above 330 pixels, at least five rows visible.
- Mobile at 390 by 844: criteria at most two lines, first home row top at or above 300 pixels, toggle no longer overlaps text.
- Row utilities rendered as one glyph line, full six cells only in detail.
- Group headers are hairline plus label, not black bars.
- Basemap desaturated, all computed foot routes drawn, selected route in blue, Gates Hillman marker distinct, detail map fits bounds to route.
- Alternatives ribbon sits after the last exact match, or first when there are zero matches.
- All four copy leaks fixed.
- One screenshot of the zero-match state using the real seed.
- One screenshot each of the compare sheet and shortlist, which I have not seen.

Further screenshot review is warranted. One more pass after these changes, specifically on the real seed with the zero-match state and the compare sheet, since those two surfaces carry the "what am I sacrificing" story and were not in this set.