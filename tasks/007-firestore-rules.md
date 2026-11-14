---
id: "007"
title: Firestore security rules and emulator tests
status: todo
owner: 
claimedAt: 
deps: ["000"]
offline: yes
files:
  - firebase/**
verify: cd firebase && npm test
---

Write `firebase/firestore.rules` for the schema in contracts section 7 and test them in the Firestore emulator (`firebase-tools`, needs Java): another uid cannot read or write `users/{uid}`; counters cannot decrease; an oversize `live.state` is rejected; `oauth/**` and writes to `matches/**` are closed to clients; `publicProfiles` is public to read. Include `firebase.json` and a `package.json` whose `test` runs `firebase emulators:exec`.
