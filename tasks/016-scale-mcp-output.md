---
id: "016"
title: Keep MCP answers small as the catalogue grows
status: todo
owner: 
claimedAt: 
deps: ["003"]
offline: yes
files:
  - mcp/src/server/tools-public.ts
  - mcp/src/server/prompts.ts
  - mcp/test/**
verify: cd mcp && npm test
---

Tool descriptions list every slug and every action, and `list_games` returns everything. Add `kind` and paging to `list_games`, move the action catalogue out of the `run_game_logic` description into a `list_actions(slug?)` tool, and drop the slug lists from parameter descriptions. Update the goldens deliberately.
