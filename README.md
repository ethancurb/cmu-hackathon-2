# address. housing decision workspace

`address.` helps a renter search across fragmented housing sources, compare the
daily consequences of each home, and see which small compromise unlocks another
option. The seeded demonstration is a Pittsburgh search around Carnegie Mellon.

## Run the demo

Requirements: Node.js 22.12 or newer.

```sh
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The production server
serves the built frontend and API on port 4173. Stop it with `Ctrl-C`.

The portable seed is already in `data/seed/cmu.json`. To restore it as the
current snapshot after a research run:

```sh
npm run demo:reset
```

That command keeps newer immutable snapshots in `data/snapshots/`. The
browser's **Reset demo** control restores the seeded criteria and clears the
browser's criteria, comparison, and shortlist state.

For development, use `npm run dev`; Vite and the API use separate local
processes, with the API on `http://127.0.0.1:4318`.

## Seeded search

The starting search asks for 2 bedrooms, at least 2 advertised bathrooms, a
maximum personal rent of `$1,200`, two equal shares as an editable assumption,
and a computed walk of at most 20 minutes to the mapped Gates Hillman entrance.
The seed contains 49 sourced options from three imported organizations, 24
usable foot routes, 30 placed records, 30 homes with transit context, and 21
with nearby essentials. It records 20 major or local registered source
surfaces; only the three imported organizations are represented as direct
housing captures.

The central result is allowed to be empty: the current seed has zero exact
matches. The Alternatives panel shows the observed tradeoffs, including
raising the personal cap by `$7.50` for Webster Hall B2 at `$2,415` whole-home
rent, allowing one bathroom for Schenley House at `$1,995`, or allowing the
longer walk to 6350 Forward at `$1,995`. Rent basis, utility inclusion, fees,
availability, and source timestamps remain separate facts. Unknown does not
mean zero, and a saved observation does not confirm current vacancy.

## More documentation

- [Runbook](docs/runbook.md) — startup, reset, live research, and recovery.
- [90-second demo](docs/demo.md) — a repeatable presentation path.
- [Product brief](PROJECT.md) — purpose, criteria, and evidence rules.
- [Contracts](docs/CONTRACTS.md) — snapshot and API data contracts.
- [Source coverage audit](docs/reports/coverage-audit.md) — surveyed source
  surfaces and access limits.

For a quick visual redesign, start with [`src/config/presentation.ts`](src/config/presentation.ts)
for the wordmark, title, and list/map proportions, then use
[`src/styles/tokens.css`](src/styles/tokens.css),
[`src/styles/base.css`](src/styles/base.css), and
[`src/styles/workspace.css`](src/styles/workspace.css) for fonts, colors,
spacing, and component layout.
