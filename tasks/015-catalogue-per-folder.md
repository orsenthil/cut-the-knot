---
id: "015"
title: One meta.json per game, catalogue generated
status: todo
owner: 
claimedAt: 
deps: ["001"]
offline: yes
files:
  - */meta.json
  - assets/games.js
  - assets/concepts.js
  - concepts/**
  - porting/build-catalogue.mjs
  - porting/verify.sh
  - porting/lint-page.mjs
  - CLAUDE.md
verify: node porting/build-catalogue.mjs --check && porting/verify.sh --all
---

Before the catalogue grows past a few hundred entries: move each entry of `assets/games.js` into `<slug>/meta.json` (title, blurb, kind, tags, level) and generate `assets/games.js` from them with `porting/build-catalogue.mjs` (same pattern as `build-manifest.mjs`, with `--check` in the gate), so parallel ports stop colliding on one file. Do the same for concepts when they pass about 50: `concepts/<area>.json` in, `assets/concepts.js` out. Then consider a slim per-page catalogue, since every game page loads the whole of `games.js`.
