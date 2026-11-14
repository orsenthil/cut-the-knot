---
id: "009"
title: Profile page and home-page suggestion
status: done
owner: claude
claimedAt: 2026-11-14
deps: ["001", "008"]
offline: yes
files:
  - profile/**
  - index.html
  - porting/check-profile-ui.mjs
  - porting/lint-page.mjs
verify: NODE_PATH=$(npm root -g) node porting/check-profile-ui.mjs
---

Show the record: games played, concepts met, what to play next.

## Outcome

Works on the local backend; it reads only through `Track`, so task 010 changes nothing here except the line about where the record is kept.
