---
id: "016"
title: Keep MCP answers small as the catalogue grows
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["003"]
offline: yes
files:
  - mcp/src/server/tools-public.ts
  - mcp/src/server/prompts.ts
  - mcp/test/**
verify: cd mcp && npm test
---

Tool descriptions list every slug and every action, and `list_games` returns everything. Add `kind` and paging to `list_games`, move the action catalogue out of the `run_game_logic` description into a `list_actions(slug?)` tool, and drop the slug lists from parameter descriptions. Update the goldens deliberately.

## Outcome

`list_games` pages (25 by default, `total` and `nextOffset` in the answer) and filters by `kind`. `list_actions` replaces the action catalogue that was inside `run_game_logic`'s description. No tool or prompt description lists slugs any more, and an unknown slug gets up to five near misses instead of the whole catalogue. The tool list went from about 11,000 characters to under 8,000 and no longer grows with the number of games.

`list_games` now answers with an object, not a bare list; a client that relied on the old shape must read `games`.

Still growing with the catalogue: `resources/list` (one entry per game) and the `coolmaths://catalogue` resource. The tag list is still spelled out in three descriptions, which is fine at 22 tags.
