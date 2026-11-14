---
id: "006"
title: UserStore interface, memory store, fixtures
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["000"]
offline: yes
files:
  - mcp/src/core/store.ts
  - mcp/src/stores/memory.ts
  - mcp/fixtures/users.json
verify: cd mcp && npm test
---

The only way the server reads a player's record (contracts section 8), with an in-memory implementation.

## Outcome

Three fixture players: `ada` (mid-game in coins), `new-player`, `private` (access off).
