---
id: "012"
title: OAuth sign-in for /mcp/me
status: todo
owner: 
claimedAt: 
deps: ["004", "010", "014"]
offline: partly
files:
  - mcp/src/auth/**
  - mcp/src/http.ts
  - mcp/src/node.ts
  - mcp/package.json
  - mcp/test/oauth.test.mjs
  - signin/**
verify: cd mcp && npm test
---

Make `/mcp/me` usable from claude.ai: OAuth 2.1 with PKCE and dynamic client registration, using the MCP SDK's auth router rather than hand-written endpoints. The authorize step sends the player to a coolmaths page (`signin/`) that signs in with Firebase and returns an ID token; the server verifies it with `firebase-admin` and issues a short-lived token bound to the uid, stored under `oauth/**`. Implement as an `Authenticator`. Offline part: the provider against the memory store with a fake ID-token verifier. This is the riskiest code in the project: have it security-reviewed before it is switched on.
