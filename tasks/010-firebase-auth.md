---
id: "010"
title: Sign-in and the Firebase backend
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["007", "008", "900"]
offline: no
files:
  - assets/auth.js
  - assets/backends/firebase.js
  - assets/firebase-config.js
  - assets/site.js
  - index.html
  - firebase/package.json
  - profile/index.html
  - porting/check-auth-ui.mjs
verify: cd firebase && npm run test:ui
---

Load the Firebase SDK as ES modules from gstatic (pinned version; no build step). `assets/auth.js`: anonymous sign-in on first visit, a sign-in / avatar menu in the header, `linkWithPopup` for Google and GitHub, the `credential-already-in-use` case, an `authchange` event. `assets/backends/firebase.js`: the backend interface of contracts section 5 on Firestore (`increment()` for counters), switched in with `Track.useBackend`; replay the local record into the account once, then clear it. Profile page: sign out, delete my account, the `mcpAccess` switch. Test against the Auth and Firestore emulators.

## Outcome

Built and tested against the emulators (23 browser checks); not yet tried against the real project, which needs task 900 finished and the rules deployed.

Changed from the plan: there is no anonymous sign-in. A guest has no account and never loads the Firebase SDK; their localStorage record is added to the account when they sign in. That keeps the SDK off every guest page view and leaves no anonymous accounts to purge. `photoURL` is not stored. Sign-in lives on the profile page, not in the header.

Known gap: someone who signs in with Google and later with GitHub on the same email is told to use the first one; the two are not linked automatically.
