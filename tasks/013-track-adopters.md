---
id: "013"
title: Games report their plays and positions
status: todo
owner: 
claimedAt: 
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
verify: porting/verify.sh hourglass four-knights four-by-four torque mind-reader eye-opener && (cd mcp && npm test)
---

For each game that already has MCP actions, follow coins (the reference): add `snapshot()`/`restore()` to the core with a round-trip test in its `check-<slug>.mjs`, call `Track.start/state/end` from the UI script, and export `position(state)` from `mcp/src/games/<slug>.ts` (contracts section 4). One commit per game; claim one game at a time by naming it in `owner`. Also worth doing here: the pages whose result does not show as `#status.win` or `.lose` (chocolate, maths-quiz, mind-reader, mixed-strategies, vanishing-digit, euler2d) need an explicit `Track.end`.
