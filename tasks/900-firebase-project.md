---
id: "900"
title: Create the Firebase project
status: done
owner: human
claimedAt: 2026-11-14
deps: []
offline: no
files:
  - assets/firebase-config.js
verify: test -f assets/firebase-config.js
---

Owner setup: create the project; enable Firestore and the Anonymous, Google and GitHub sign-in providers (GitHub needs an OAuth app whose callback is the Firebase handler); add `orsenthil.github.io` and `coolmaths.ai` as authorized domains; commit the public web config as `assets/firebase-config.js`; create a service account for the MCP server and store it with `fly secrets set FIREBASE_SERVICE_ACCOUNT=...`.

## Outcome

Project `coolmaths-ramanujan1729` exists and its public web config is in `assets/firebase-config.js`. Still to confirm in the console: Firestore created, Google and GitHub providers enabled, `orsenthil.github.io` authorized, rules deployed. The Anonymous provider is not needed (see task 010). The service account for the MCP server belongs to task 014.

## Finished

Google and GitHub sign-in work on the live site, the rules are deployed, and the service account is a Fly secret.
