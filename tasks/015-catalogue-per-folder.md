---
id: "015"
title: One meta.json per game, catalogue generated
status: done
owner: claude
claimedAt: 2026-11-14
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

## Outcome

Every game has a `meta.json`, and `porting/build-catalogue.mjs` generates `assets/games.js` from them (`--check` is in the gate). The generated catalogue has the same games in the same order with the same tags as the hand-written one. Tag labels moved into `assets/concepts.js`, so a tag is defined in one place.

Left for when the numbers call for it: splitting `assets/concepts.js` by area (22 concepts today; worth doing past about 50), and a slim per-page catalogue, since every game page still loads the whole of `games.js` (18 kB today, roughly 400 kB at 1,250 entries).
