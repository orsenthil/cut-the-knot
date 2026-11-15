---
id: "014"
title: Firestore UserStore for the MCP server
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["006", "007", "900"]
offline: partly
files:
  - mcp/src/stores/firestore.ts
  - mcp/src/node.ts
  - mcp/package.json
  - mcp/test/firestore-store.test.mjs
verify: cd mcp && npm test
---

Implement `UserStore` with `firebase-admin`, reading the documents of contracts section 7, credentials from the `FIREBASE_SERVICE_ACCOUNT` environment variable (a Fly secret). Test against the Firestore emulator with the same fixtures as the memory store: both stores must give identical answers.

## Outcome

`mcp/src/stores/firestore.ts`: `FirestoreUserStore` and `FirestoreOAuthStore`. In the emulator the personal tools give the same answers as on the memory store (`npm run test:firestore`, 26 checks). Needs the `FIREBASE_SERVICE_ACCOUNT` secret on Fly to run for real.
