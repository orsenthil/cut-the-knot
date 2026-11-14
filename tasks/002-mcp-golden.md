---
id: "002"
title: Golden answers for the MCP server
status: done
owner: claude
claimedAt: 2026-11-14
deps: []
offline: yes
files:
  - mcp/test/golden.mjs
  - mcp/test/golden/**
verify: cd mcp && npm run golden
---

Save the server's answers so a refactor can be shown to change nothing.

## Outcome

`npm run golden`; `--all --dir` compares every answer including the content-dependent ones.
