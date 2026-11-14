---
id: "001"
title: Concept graph and recommender
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["000"]
offline: yes
files:
  - assets/concepts.js
  - assets/recommend.js
  - assets/games.js
  - porting/check-concepts.mjs
verify: node porting/check-concepts.mjs
---

Prerequisites between concepts, and a pure module that turns a player's progress into what to play next (contracts section 6).

## Outcome

22 concepts, `level` on every game, `kind: "demo"` on five. Mastery is computed, not stored. A prerequisite the game itself teaches does not count against it; without that rule almost nothing was ready for a new player.
