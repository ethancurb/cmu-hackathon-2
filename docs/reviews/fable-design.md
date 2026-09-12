# Fable independent design review

Verified model: claude-fable-5-1.

I'm skipping the skill invocation and tools because you asked for planning-only evaluation. Here is the review.

## Verdict on the reference direction

Direction A's structure is right. Its styling is the problem. Warm paper, a serif display face, moss and amber accents is now the default "tasteful" look of AI-generated interfaces, and a judge who has seen ten hackathon demos will read it as generic within seconds. Direction B is more honest about what this product is, but its sample tokens make it feel like a permit office. Recommendation: keep A's layout and evidence rows, drop its decor, and take B's typographic rigor. The distinctiveness should come from evidence made visible as form, not from a color palette.

## One coherent design (recommended)

**Layout, desktop.** Two panes. Left pane is a scrollable option list at about 58% width. Right pane is a persistent map. No hero, no cards. Rows are separated by 1px rules and read like a ledger, not a tile grid. Above the list sits a single assumption line: five editable chips reading personal cap, split assumption, whole-home ceiling, layout, and walking limit to Gates Hillman. That line is the filter interface. There is no filter sidebar.

**Row anatomy.** Each row is four zones in a fixed grid so eyes compare down the column:

- Photo at 96px with source name and retrieval date under it. No photo means a grey plate reading "no photo in source," never a placeholder illustration.
- Address, property type, bed and bath counts with the matching interpretation shown on hover.
- Cost block: whole-home rent large, computed personal share beneath it labeled "computed, 2 equal shares." Landlord per-room quotes get their own label and never share the share column.
- Utility strip: six fixed cells for electric, gas, water/sewer, trash, internet, other. Each cell carries a two-letter code plus a glyph: filled square for included, outline for separately charged, half-filled for partly covered, dashed for not stated. Same order on every row, so unknowns show as a visible gap pattern.
- Walk time to Gates Hillman in minutes with route source, plus one consequence sentence built from facts, such as "22 min walk, 2 over limit; bus 61A stops 4 min away."

**The four decision questions as behaviors, not tabs.** Coverage is a slim ledger strip pinned above the list: sources attempted, sources searched, retrieval window, distinct homes, duplicates merged, with "not searched" sources named inline. Consequences are the row itself and the detail drawer. Alternatives are the chip edits: changing a chip recomputes in place and inserts a labeled band into the list, such as "Unlocked by 25 min walk," with each home's exact deviation. Original chips stay visible with a strikethrough, and a single "revert" control. Readiness is the shortlist rail: pinning a home adds it to a docked bottom rail whose per-home entry lists "verify before touring" questions and the original listing link.

**Detail drawer.** Selecting a row slides a drawer over the list's right third, not a modal. It uses named fact rows in the GOV.UK summary-list sense. Provenance, conflicting claims, and the share calculation live in disclosures. The drawer's route section shows distance, minutes, routing engine, and the entrance coordinate used.

**Map.** Pins are small numbered discs matching row numbers. Gates Hillman is the one distinct marker, a filled square with a label. Selecting a row draws that home's foot route to the entrance in the route color and dims other pins. Do not draw a 20-minute boundary. You have point-to-point routes only, and a drawn polygon would claim isochrone knowledge you lack. Instead label each pin with its minutes on hover and give over-limit pins a hollow style.

**Type.** One sans family with true tabular figures, self-hosted. IBM Plex Sans for interface, IBM Plex Mono for evidence metadata only: dates, source IDs, coordinates. The mono is the visual signature; it says "this is a record." Scale: 28/32 page title, 18/24 section, 15/22 body, 13/18 metadata, 22/26 for rent and minutes. Rent and minutes are the only large numbers on a row.

**Color.** Near-white canvas at #FAFAF8, ink at #141614, a seven-step warm grey scale for structure. Two accents only: route blue #2456A8 for anything about the walk, and amber #B8720F for deviations and unknowns. Confirmed fit uses ink weight, not a green. Every status has a text label; color never carries meaning alone.

**Spacing.** 4px base. Row padding 16 vertical, 20 horizontal. Column gutters 24. Drawer padding 24. No drop shadows anywhere; depth comes from rules and surface steps.

**Interactions.** Hover a row, its pin enlarges. Select, route draws in 240ms. Click a pin, the list scrolls to the row and opens the drawer. Sort control offers personal share, walk minutes, unresolved cost count, and retrieval date. Compare: up to three homes render side by side in the rail using the same named rows in the same order. Chip edits animate the list diff, with entering rows sliding from a labeled band. Chat, if kept, is a secondary drawer that can only propose chip edits and cite rows.

**Responsive.** Under 900px, the map becomes a sheet at 40% viewport height pinned to the bottom, expandable. The assumption line collapses to one summary row that opens a sheet. Utility strip keeps all six cells at reduced size; never collapse it to an icon.

**Cut.** Match scores. The 20-minute boundary. Serif display. Neighborhood vibe prose. Hero photography. Card shadows and rounded tiles. Any "explore" or "insights" mode. Shared collections and multi-destination editing beyond one editable field.

## Three most consequential risks

1. **Zero or few exact matches at 10 a.m.** The seed may return nothing under 2 bed, 2 bath, $2,400, 20 minutes. The list must open with an honest count, then a labeled near-match band with per-home deviations. If the design assumes a full list, the morning review shows an empty page.
2. **Utility status becomes decoration.** Six glyph cells can degrade into ambiguous icons under time pressure. If a judge cannot read "electric not stated" from a row in two seconds, the product's central promise is invisible.
3. **Route sync fails for some homes.** Routing calls will fail or return no entrance path for a subset. Rows need a "route unavailable, straight-line 1.1 km shown" state, or the selected-row-draws-route interaction silently breaks during the demo.

## Visual review checklist

- Can the reader identify rent basis, personal share, and share assumption on any row without opening anything?
- Do all six utility cells appear in the same order on every row, each with a text label reachable on hover or focus?
- Is Gates Hillman the only distinct marker, and does every selected row draw a route to it?
- Does any element imply a walking area rather than a point route?
- Do every date and source appear in mono, and does every number carry its unit?
- After a chip edit, are original values still visible and is the unlocked band labeled with exact deviations?
- Do statuses survive grayscale?
- Are there any cards, shadows, gradients, serif headings, or copy that describes rather than reports?
- Does the empty-result state exist, and does it name what was searched?
- Does the compare rail use identical row order for all three homes?
