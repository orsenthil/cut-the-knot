---
id: "012"
title: OAuth sign-in for /mcp/me
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["004", "010", "014"]
offline: partly
files:
  - mcp/src/auth/**
  - mcp/src/http.ts
  - mcp/src/node.ts
  - mcp/package.json
  - mcp/test/oauth.test.mjs
  - signin/**
  - mcp/src/app.ts
  - mcp/src/stores/firestore.ts
  - mcp/fly.toml
  - assets/auth.js
  - assets/firebase-config.js
  - assets/site.js
  - porting/check-tutor-signin.mjs
  - porting/lint-page.mjs
  - firebase/package.json
verify: cd mcp && npm test
---

Make `/mcp/me` usable from claude.ai: OAuth 2.1 with PKCE and dynamic client registration, using the MCP SDK's auth router rather than hand-written endpoints. The authorize step sends the player to a coolmaths page (`signin/`) that signs in with Firebase and returns an ID token; the server verifies it with `firebase-admin` and issues a short-lived token bound to the uid, stored under `oauth/**`. Implement as an `Authenticator`. Offline part: the provider against the memory store with a fake ID-token verifier. This is the riskiest code in the project: have it security-reviewed before it is switched on.

## Outcome

`mcp/src/auth/oauth-provider.ts` behind the SDK's auth router (`src/app.ts`), and the site's `signin/` page. `npm test` walks the whole flow and the ways it must fail (50 checks); `cd firebase && npm run test:tutor` runs it with a browser, the real page and the emulators (19 checks).

Not yet done: a run against the real project and a real client (needs the service account secret), and a security review by someone other than its author. Registered clients are never expired, so the `oauth/clients` collection only grows; registration is rate-limited by the SDK to 20 an hour per address.
