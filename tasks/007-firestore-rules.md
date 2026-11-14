---
id: "007"
title: Firestore security rules and emulator tests
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["000"]
offline: yes
files:
  - firebase/**
verify: cd firebase && npm test
---

Write `firebase/firestore.rules` for the schema in contracts section 7 and test them in the Firestore emulator (`firebase-tools`, needs Java): another uid cannot read or write `users/{uid}`; counters cannot decrease; an oversize `live.state` is rejected; `oauth/**` and writes to `matches/**` are closed to clients; `publicProfiles` is public to read. Include `firebase.json` and a `package.json` whose `test` runs `firebase emulators:exec`.

## Outcome

`firebase/firestore.rules`, with 62 allow/refuse checks. Run with `mise exec java@temurin-21 -- npm test` where Java is not on the PATH. Not yet deployed to the real project: `cd firebase && npx firebase login && npm run deploy`.
