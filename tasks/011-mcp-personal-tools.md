---
id: "011"
title: Personal MCP tools
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["003", "006"]
offline: yes
files:
  - mcp/src/server/tools-personal.ts
  - mcp/src/server/build.ts
  - mcp/src/auth/**
  - mcp/test/http.test.mjs
verify: cd mcp && npm test
---

`whoami`, `my_progress`, `recommend_next`, `my_position` and the `coach_me` prompt on `/mcp/me`.

## Outcome

Read-only, per-player, and they refuse when `mcpAccess` is off. `/mcp/me` answers 503 unless an Authenticator and a store are configured; only the development token exists so far.
