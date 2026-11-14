---
id: "008"
title: Progress tracker with a local backend
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["000"]
offline: yes
files:
  - assets/progress.js
  - assets/site.js
  - porting/check-progress.mjs
verify: node porting/check-progress.mjs
---

`Track`, the one API game pages call (contracts sections 2, 3, 5), keeping the record in localStorage.

## Outcome

Pages need no changes: visits, time and `#status.win/.lose` are recorded automatically. 49 of 56 games use those classes.
