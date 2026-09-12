# OneStop integration handoff — September 12, 2026

Public app: https://onestop-hackcmu.vercel.app
Public source: https://github.com/ethancurb/cmu-hackathon-2

`main` includes the OneStop name, `feature/onestop-auth0`, and Alex's
`origin/feat/grok-custom-filters`, preserving both branches' commits. The
deployed code commit is `4de858c`. Vercel deployment
`dpl_ELZUZys1DCciRsZEPdYuAD5rpjR2` was checked before promotion and is now
served at the public app URL. This release includes the account menu stacking
fix, clearer Grok suggestions and recovery, grouped map pins, selected-only
walking routes, and mobile map interaction fixes. See [the frontend polish
report](frontend-polish.md) for findings and verification.

Verified:

- Production build and typecheck pass. The integrated 138-test unit/API suite
  passed during integration; subsequent Grok boundary and nested-route tests
  also passed. This frontend pass did not change the backend or ranking rules.
- Fourteen distinct browser checks passed across the frontend integration run
  and focused rerun: five original housing decisions, five account/storage
  cases, two Grok cases, and two map cases. The final public deployment also
  passed both desktop and mobile map checks with
  `ADDRESS_TEST_URL=https://onestop-hackcmu.vercel.app npx playwright test tests/browser/map-polish.spec.ts --reporter=line`.
- The polished frontend rendered a real public Grok response for `Near a
  grocery store`: 11 possible fits, initially showing three. Selecting a home
  displayed its single saved walking route and a cited nearby store. Desktop
  and mobile screenshots were inspected with no browser page errors. The
  model's suggestions remain separate from the unchanged core requirements;
  response counts are observations, not guarantees.
- Public page and API checks after promotion returned HTTP 200, healthy
  status, the new frontend bundle `index-DocDEBPQ.js`, the correct anonymous
  session response in a clean client, and all 49 audited seed records.
- Real Auth0 signup-page rendering, login callback, authenticated reload,
  browser workspace persistence, logout, and repeat login passed on the public
  site. The user independently confirmed their own sign-in. The temporary
  verification identity was deleted. See [Auth0 verification](auth0-progress.md).
- Earlier integration checks verified nested snapshot routing, a live Grok
  POST, and HTTP 403 for a POST from an unrelated website origin. The same
  server implementation and production settings are preserved.
- GitHub visibility changed to Public at the user's explicit request. Before
  publication, a scan of 393 historical blobs found no recognized key formats
  and no committed secret-file paths. Only `.env.example` is tracked.

`XAI_API_KEY`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` are Production Secrets
in Vercel. Actual values are absent from source and browser bundles. The Grok
key was not received in chat; Auth0 secrets were provisioned through process
memory and standard input without printing their values. See
[deployment instructions](../deployment.md) for runtime configuration and
the per-instance demo request limits.

Local runtime is also updated at http://127.0.0.1:4173. Local auth and Grok need
their own ignored environment configuration; use the public URL for the
configured live demo. Account shortlists and searches remain stored on that
browser, with separate storage per account; there is no cross-device database
sync. Public live discovery/import/new-route jobs remain unavailable; those
run locally. The public housing inventory is the sourced research snapshot,
not proof of current vacancy or exhaustive market coverage.
