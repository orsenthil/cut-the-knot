---
id: "013"
title: Games report their plays and positions
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["008", "003"]
offline: yes
files:
  - hourglass/**
  - four-knights/**
  - four-by-four/**
  - torque/**
  - mind-reader/**
  - eye-opener/**
  - mcp/src/games/**
  - porting/check-*.mjs
  - porting/live-fixtures/**
  - assets/progress.js
  - docs/contracts.md
verify: porting/verify.sh hourglass four-knights four-by-four torque mind-reader eye-opener && (cd mcp && npm test)
---

For each game that already has MCP actions, follow coins (the reference): add `snapshot()`/`restore()` to the core with a round-trip test in its `check-<slug>.mjs`, call `Track.start/state/end` from the UI script, and export `position(state)` from `mcp/src/games/<slug>.ts` (contracts section 4). One commit per game; claim one game at a time by naming it in `owner`. Also worth doing here: the pages whose result does not show as `#status.win` or `.lose` (chocolate, maths-quiz, mind-reader, mixed-strategies, vanishing-digit, euler2d) need an explicit `Track.end`.

## Outcome

Hourglass, four knights, four by four, torque, the mind reader and the eye opener now save their position, and the tutor has a reader for each (`position()` in `mcp/src/games/<slug>.ts`).

It turned out lighter than planned. These cores already keep plain data, so no snapshot/restore was needed, and the pages call only `Track.state`: `Track` now lets a page report positions while its plays are still taken from `#status`. `porting/live-fixtures/` holds a position saved by each real page, which both the browser check and the readers' test use.

Not done: chocolate, maths-quiz, mixed-strategies, vanishing-digit and euler2d still record visits and time only, because their result does not show as `#status.win` or `.lose`. Each needs a `Track.end` call where its round finishes.
