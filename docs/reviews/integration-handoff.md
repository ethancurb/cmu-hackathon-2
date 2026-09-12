# OneStop integration handoff — September 12, 2026

Public app: https://onestop-hackcmu.vercel.app
Public source: https://github.com/ethancurb/cmu-hackathon-2

`main` includes the OneStop name, `feature/onestop-auth0`, and Alex's
`origin/feat/grok-custom-filters`, preserving both branches' commits. The
deployed code commit is `fa9b544`. Vercel deployment
`dpl_Gjnz3ZuCbNKNhk5AaeLDZntaJqDt` was checked before promotion.

Verified:

- Production build and typecheck pass. The integrated 138-test unit/API suite
  passed; subsequent Grok boundary and nested-route tests also passed.
- All 12 browser checks passed: original housing decisions, account isolation
  and recovery, and Grok highlighting/error handling.
- A clean public browser completed a real Grok request for `near a grocery
  store`: 17 model assessments, 10 suggestions within the declared tolerance,
  approximately 27 seconds. The original $1,200 / 20-minute criteria and zero
  core matches remained visible. No browser API request carried Authorization.
- The final deployment's bootstrap, session, nested snapshot, disabled Auth0
  route, and live Grok POST all passed before promotion. The audited 49-record
  seed was preserved. An unrelated website's API POST returned 403.
- GitHub visibility changed to Public at the user's explicit request. Before
  publication, a scan of 393 historical blobs found no recognized key formats
  and no committed secret-file paths. Only `.env.example` is tracked.

`XAI_API_KEY` is a Production Secret in Vercel; no actual key was received in
chat, embedded in source, or sent to the browser. See `docs/deployment.md` for
deployment, runtime configuration, and the per-instance demo request limits.
Local runtime is also updated at http://127.0.0.1:4173. Its Grok feature needs
an ignored local key; use the public URL for the configured live Grok demo.

Auth0 tenant authorization remains paused by the user. Its merged code and
mocked/controlled-provider tests do not establish a live Auth0 login. Public
live discovery/import/new-route jobs remain unavailable; those run locally.
