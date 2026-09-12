# Fable visual review 2

Model: claude-fable-5-1. Six actual rendered CMU screenshots reviewed; successful invocation with no permission denials. The exact reviewed images are archived in `../artifacts/fable2/`; later frontend screenshots at the original paths show subsequent repairs.

**Visual finish: 7.5 / 10.** This is a real step up from the first pass. The criteria bar reads as the product's thesis, the personal-versus-whole rent split is unambiguous on every screen, plan-versus-unit status is labeled in the detail header, and unknown utilities are surfaced rather than hidden. It is ready for a competitive hackathon demo once the first two findings below are fixed. Both are under an hour of work.

**Findings, ordered by impact**

1. **Blocker: sort label contradicts the section header.** On the zero-match screen the section says "smallest changes first" and the rows are in fact ordered by smallest deviation, but the dropdown reads "Sort: your rent". A judge will see $1,207.50 above $765 and assume the sort is broken. Repair: make the dropdown's selected value "Smallest change" and put "Your rent" as a second option. If the sort really is by rent, fix the ordering instead.

2. **Blocker: route does not end at the destination marker.** On the detail screen the blue foot route runs past the Gates Hillman square and terminates a block southeast of it. Since "computed walk to a mapped entrance" is a core claim, this reads as a wrong route. Repair: snap the route polyline's final vertex to the entrance coordinate, or move the destination marker to the routed endpoint and keep the label. Also change "12 Min (676.1 Seconds)" to "12 min · 0.8 km".

3. **Optional: the "Original requirements restored" banner persists.** It is still visible on the detail, compare, and shortlist screens, pushing every layout down and reading as a stuck state. Repair: render it as a toast that auto-dismisses after a few seconds and never survives navigation.

4. **Optional: map zoom hides the cluster that matters.** The 1440 map fits all 30 markers including far outliers, so the cluster near Pitt and Gates Hillman overlaps into unreadable numbers. Repair: fit bounds to markers within the walk limit plus a small margin, and let the outliers sit off-screen with the existing "Show all 30 mapped options" link. Also add a per-row "not mapped" hint, since the list has 42 near matches but only 30 are on the map.

5. **Optional: small copy leaks.** The compare table prints the raw routing URL in the Walk row. Replace with "computed foot route". The list repeats "6 not stated" and "6 cost items unresolved" side by side, so drop one. Row 05 shows a raw all-caps source address. Title-case it. The shortlist drawer says "1 saved home" beside a "Compare 2" button, which is correct but confusing. Label it "Compare 2 selected".

**Factual ambiguity check.** Personal versus whole rent is clear everywhere. Plan versus vacant unit is handled well in detail and compare, with "confirm vacancy" visible. Utility unknowns are honest. List-to-map correspondence is the weakest point, covered in finding 4.

**Mobile.** Solid hierarchy. Two things to check rather than redesign: the property photos render as grey placeholders in the mobile capture while desktop shows images, and the section header wraps awkwardly beside "42 options". The mobile alternative pill drops the verb, showing only "$1,207.50 share"; "Raise cap to $1,207.50" fits and is clearer.

**Another visual pass.** Only the detail screen warrants one, and only after the route endpoint fix, since that is the one change that could introduce a new visual defect. The rest can ship on trust.
