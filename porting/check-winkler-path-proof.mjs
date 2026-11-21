#!/usr/bin/env node
"use strict";

/*
 * Logic test for winkler-path-proof/winkler-path-proof-core.js.
 *
 *   1. Side/stack adjacency and the decoration strips on a known tile.
 *   2. On all three presets: a valid tiling, exactly one path, the right kind
 *      of path, and the path's integer widths/heights summing to the ambient
 *      side (so the conclusion of the proof follows).
 *   3. Toggling a tile's colour and detecting broken tilings.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("winkler-path-proof/winkler-path-proof-core.js", "WinklerPathProofCore");

{
  const s = C.start();
  check("left column tiles are stacked", C.stacked(s.tiles[0], s.tiles[1]));
  check("right column tiles are stacked", C.stacked(s.tiles[2], s.tiles[3]));
  check("a green and a red tile are side by side", C.sideBySide(s.tiles[0], s.tiles[2]));
  check("the green tiles are not side by side", !C.sideBySide(s.tiles[0], s.tiles[1]));
  const strips = C.strips(s.tiles);
  equal("two strips per tile", strips.length, 8);
  check("a green tile gets red horizontal strips", strips[0].color === "V" && strips[0].h < strips[0].w);
  check("a red tile gets green vertical strips", strips[4].color === "H" && strips[4].w < strips[4].h);
  check("the starting tiling is valid", C.validate(s).valid);
}

{
  const expected = {
    winkler: "red",
    greenStrip: "green",
    fourSquares: "green",
  };
  for (const [name, kind] of Object.entries(expected)) {
    const state = C.PRESETS[name]();
    const r = C.analyze(state);
    const label = `preset ${name}`;
    check(`${label}: a valid tiling`, r.tiling.valid);
    equal(`${label}: the path kind`, r.verdict.kind, kind);
    if (kind === "green") {
      check(`${label}: green path crosses whole widths`, r.greenSum === state.ambient.w);
      check(`${label}: no red path`, r.verdict.red === null);
      check(`${label}: the ambient width is an integer`, r.ambientWidthInteger);
    } else {
      check(`${label}: red path crosses whole heights`, r.redSum === state.ambient.h);
      check(`${label}: no green path`, r.verdict.green === null);
      check(`${label}: the ambient height is an integer`, r.ambientHeightInteger);
    }
    const path = kind === "green" ? r.verdict.green : r.verdict.red;
    check(`${label}: the path is a chain of tiles`, path.length >= 1);
  }

  const s = C.start();
  const toggled = C.toggleKind(s, 2);
  equal("toggling swaps the colour", toggled.tiles[2].kind, "H");
  equal("an out-of-range toggle is ignored", C.toggleKind(s, 9).tiles[0].kind, "H");
  check("the toggle can change which path exists", C.decide(toggled).kind !== C.decide(s).kind);

  const broken = C.start();
  broken.tiles[0] = { ...broken.tiles[0], x: 0.2 };
  check("a broken tiling is detected", !C.validate(broken).valid);
}

done("winkler-path-proof");
