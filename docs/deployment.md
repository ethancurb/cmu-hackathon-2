# OneStop public deployment

Project: `onestop-hackcmu`, Vercel scope `ethanscurb-gmailcoms-projects`.
Public URL: https://onestop-hackcmu.vercel.app

The Vite frontend and a Node serverless function deploy from this repository.
`api/index.ts` exposes the Express API without a persistent listener. Rewrites
explicitly preserve nested API and Auth0 paths for the single Node function.
`server/hosted.ts` loads the audited 49-record CMU seed and uses temporary cache
directories. It does not access laptop CLI subscriptions or publish ephemeral
research snapshots. Live discovery, source import, and new route jobs remain
available in the local application; the public demo exposes the saved evidence,
filters, map, comparisons, shortlists, destination selection, and Grok requests.

`vercel.json` enables `NODE_OPTIONS=--experimental-require-module` for the
Auth0 SDK's CommonJS-to-ESM dependencies. Vercel disables this Node capability
by default; see its [runtime configuration documentation](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

## Grok secret

In the project's Settings → Environment Variables, create `XAI_API_KEY` as a
**Secret**, scoped to **Production**. Its value is the xAI API key, not the
variable name or a dashboard password. Redeploy after adding or rotating it.
The browser posts the query, snapshot ID, and destination version to `/api/niche`.
Only server code sends the credential to `https://api.x.ai/v1/chat/completions`.
There is no browser key, `VITE_` key, or credential embedded in repository files.

Local development can use the same variable in ignored `.env.local`; existing
shell environment takes precedence, followed by `.env.local`, then `.env`.
`.gitignore` excludes secret files and `.vercel/`; `.vercelignore` also excludes
local credentials, research captures, worktrees, and worker state from uploads.
`.env.example` contains names and empty placeholders only.

Grok uses low reasoning effort for interactive preference matching, with a
45-second timeout, 4,096 output-token limit, versioned digest
cache, and cancellation. Hosted requests are limited per warm function instance
to 12 per client and 60 total per 10 minutes, with 3 concurrent calls. These
in-memory guards are demo bounds, not a distributed or billing-level quota.
Provider/project spending controls remain the reliable budget limit.

## Deploy and verify

```sh
vercel link --yes --project onestop-hackcmu --scope ethanscurb-gmailcoms-projects
npm ci
npm run build
npm test
vercel deploy --prod --skip-domain --yes --scope ethanscurb-gmailcoms-projects
```

Inspect the returned candidate URL before promotion. Protected candidate URLs
can be checked with `vercel curl /api/health --deployment <candidate-url>`.
Check `/api/bootstrap` contains the 49 real records, `/api/session` returns a
valid state, and a `/api/niche` request succeeds with the Production secret.
Keep key values and authorization headers out of logs and screenshots.

```sh
vercel promote <verified-candidate-url> --scope ethanscurb-gmailcoms-projects
```

Finally open the public URL in a clean browser and check the seeded criteria,
the $7.50 Webster Hall alternative, map and utilities, and **Ask for anything**.
If necessary, use `vercel rollback <previous-deployment-url>` to restore a known
working deployment. No Git history rewrite is needed.

## Accounts

The user resumed Auth0 activation after the public Grok demo was working.
The OneStop Regular Web Application and email/password connection are configured.
Production now has `AUTH0_ENABLED=true`, `AUTH0_ISSUER_BASE_URL`,
`AUTH0_CLIENT_ID`, `AUTH0_BASE_URL`, and the sensitive `AUTH0_CLIENT_SECRET`
and `AUTH0_SECRET` variables. Credentials were transferred through process stdin
into Vercel; no values were written into repository files or command output.

Use authorization-code flow with `client_secret_basic` and explicitly configure
the Auth0 application's `jwt_configuration.alg` as `RS256`, matching the SDK.
The production base is `https://onestop-hackcmu.vercel.app`; the exact callback is
`https://onestop-hackcmu.vercel.app/auth/callback`. Allowed logout URLs are that
base origin with and without a trailing slash. No wildcard callback is required.

Enable the database connection for this client through
`PATCH /api/v2/connections/{id}/clients` with
`[{"client_id":"<OneStop client ID>","status":true}]`. Auth0 retired updates
through the old connection object's `enabled_clients` field; use the
[dedicated connection endpoint](https://auth0.com/docs/api/management/v2/connections/patch-clients).
For clients created through the Management API, explicitly set the token signing
algorithm: [Auth0 documents the omitted-algorithm behavior](https://support.auth0.com/center/s/article/id-token-returns-incorrect-jwt-signature-algorithm).

Open `/auth/signup` to create a renter account or `/auth/login` to sign in.
Account-specific shortlists are saved on that browser; there is no application
database or cross-device sync. See `docs/reviews/auth0-progress.md` for the
actual live verification result; configuration alone does not prove a login.
