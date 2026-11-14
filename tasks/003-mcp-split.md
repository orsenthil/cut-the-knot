---
id: "003"
title: Split the MCP server into modules
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["002"]
offline: yes
files:
  - mcp/src/**
  - mcp/scripts/build-index.mjs
verify: cd mcp && npm test
---

One file per concern and one file per game, so adding a game or a tool edits no shared file.

## Outcome

All 33 pre-existing answers are byte-identical. The registry of game modules is generated.
