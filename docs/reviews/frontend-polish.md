# Frontend polish — September 12, 2026

The user reported confusing Grok results, a cluttered/buggy map, and an account menu appearing underneath the rest of the interface. The pass preserves the seeded data, exact housing constraints, utility evidence, and Grok's existing deterministic comparison bounds.

## Findings and fixes

- The account menu's stacking level was below the criteria and coverage layers. Raising the menu resolved the reproduced blocked Log out click on desktop and mobile; this was already deployed in `9f80368`.
- The Grok input could extend beyond the right edge, and its changing label displaced neighboring filters. A stable **Ask Grok** control, viewport-bounded input, examples, and **Find suggestions** action make the request flow clearer. On narrow screens the filter popovers stay within the viewport.
- Asking Grok incorrectly triggered the notice for changed housing requirements. That comparison now excludes the separate Grok request. Genuine budget/layout/walking changes still show the original search and retain the existing reversal behavior.
- Grok suggestions were called matches even when a home exceeded a core limit. The group and row labels now distinguish suggestions, partial preference matches, and exact core deviations. The first three suggestions are expanded, with an explicit button exposing the complete suggestion list. All researched homes retain their normal place in the main inventory. The methodology disclosure reads the existing tolerance constants; the ranking logic was not changed.
- Failed Grok requests now have an explicit manual retry. Screen-reader descriptions include rent, walking time, the core compromise, and the assessment's evidence basis.
- The default map rendered 30 overlapping route paths. It now draws only the selected home's actual saved foot route. Nearby-place connectors are labeled straight-line distances and never presented as walking routes.
- Six pairs of floor plans share exact coordinates. A grouped pin now opens a choice of the actual plans, without offsetting or fabricating coordinates. Hover no longer destroys/recreates the pin layers; count badges do not intercept other pins' clicks.
- Mobile pin selection previously switched away from the map. It now retains the map, shows the selected home and rent share, and exposes an explicit **View details** action.
- **Show all**, **Focus destination**, and **Focus selected route** provide camera recovery. Reset demo also resets the camera. Focus bounds include cited nearby places and reserve space for the caption, and the map recalculates its size when its container changes.

## Verification

- Production build and TypeScript checks passed.
- Fourteen distinct browser checks passed across the integrated run and the focused map rerun: five auth/storage/recovery cases, five original housing decision cases, two Grok cases including retry, and two new map cases. The initial mobile failure reproduced a marker badge intercepting a click; the corrected map suite and all five housing cases passed on rerun.
- A genuine public Grok API response was rendered through the local candidate: `Near a grocery store` produced 11 possible fits, initially showing three. Selecting one displayed one saved walking route and one cited nearby-place pin. Desktop and mobile screenshots were inspected; no browser page errors occurred. These counts describe that response, not guaranteed future model outputs.
- Real public Auth0 login, account persistence, logout and repeat login had already passed; see `auth0-progress.md`. The user also confirmed their own successful sign-in. Production secret settings are preserved.

Code commit: `4de858c`. Public deployment verification is recorded in `integration-handoff.md`.
