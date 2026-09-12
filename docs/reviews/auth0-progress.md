# Auth0 — live and verified

The user resumed authentication work after the public OneStop/Grok deployment and completed a fresh CLI device authorization. The user subsequently confirmed signing into their own OneStop account on the live site.

- The OneStop Regular Web Application uses authorization-code flow, Basic client authentication, and explicitly configured RS256 ID-token signing. The email/password database connection is enabled for OneStop through Auth0's current dedicated connection-client endpoint.
- The exact callback is `https://onestop-hackcmu.vercel.app/auth/callback`. Login, signup, logout, authenticated `/api/session`, and protected `/api/account` use the merged Express Auth0 SDK integration. No application database was added.
- All six Auth0 server environment variables are configured in Vercel Production. Client and session secrets are Sensitive/Secret variables. Credentials were captured in process memory and transferred through stdin; no values were printed, written to repository files, or sent to the browser. The existing server-only xAI key was preserved.
- A genuine browser check against the public deployment passed: real Auth0 signup form, password login, code callback, authenticated account endpoint, reload retaining identity and a saved home, provider logout, anonymous session and HTTP 401 account endpoint after logout, then a second password login restoring the same saved workspace. This check did not mock Auth0 or `/api/session`.
- The live check used a temporary test identity with a random password retained only in memory. Verification-email delivery was disabled and the identity was deleted after each run. The user's own account was not modified.
- Cookies were observed with Secure, HttpOnly, and SameSite=Lax attributes. Searches/shortlists remain scoped to the account on this browser; there is no cross-device synchronization.
- The first provider roundtrip exposed an omitted signing-algorithm setting in the API-created Auth0 client. Explicit RS256 resolved it. The subsequent browser check exposed the account dropdown behind the criteria/coverage overlays. Commit `9f80368` raises that menu above those overlays, and the existing browser test now verifies actual pointer access to Log out on desktop and mobile.

Verification: production build/typecheck passed; the account-menu regression reproduced the original intercepted click and passed after correction. Full real-provider signup-form/login/reload/logout/relogin verification passed on deployment `dpl_HTycEg1s6mFisDoM1fHsbo64Cmh2`. Subsequent frontend polish preserves this production Auth0 configuration.

Provider setup and the current connection API are documented in `docs/deployment.md`. Auth0 dashboard administration and the renter's OneStop account are separate sign-ins.
