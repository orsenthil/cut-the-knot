---
id: "900"
title: Create the Firebase project
status: todo
owner: human
claimedAt: 
deps: []
offline: no
files:
  - assets/firebase-config.js
verify: test -f assets/firebase-config.js
---

Owner setup: create the project; enable Firestore and the Anonymous, Google and GitHub sign-in providers (GitHub needs an OAuth app whose callback is the Firebase handler); add `orsenthil.github.io` and `coolmaths.ai` as authorized domains; commit the public web config as `assets/firebase-config.js`; create a service account for the MCP server and store it with `fly secrets set FIREBASE_SERVICE_ACCOUNT=...`.
