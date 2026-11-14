---
id: "010"
title: Sign-in and the Firebase backend
status: todo
owner: 
claimedAt: 
deps: ["007", "008", "900"]
offline: no
files:
  - assets/auth.js
  - assets/backends/firebase.js
  - assets/firebase-config.js
  - assets/site.js
  - assets/site.css
  - profile/index.html
  - porting/check-auth-ui.mjs
verify: NODE_PATH=$(npm root -g) node porting/check-auth-ui.mjs
---

Load the Firebase SDK as ES modules from gstatic (pinned version; no build step). `assets/auth.js`: anonymous sign-in on first visit, a sign-in / avatar menu in the header, `linkWithPopup` for Google and GitHub, the `credential-already-in-use` case, an `authchange` event. `assets/backends/firebase.js`: the backend interface of contracts section 5 on Firestore (`increment()` for counters), switched in with `Track.useBackend`; replay the local record into the account once, then clear it. Profile page: sign out, delete my account, the `mcpAccess` switch. Test against the Auth and Firestore emulators.
