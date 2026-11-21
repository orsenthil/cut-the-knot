#!/usr/bin/env node
"use strict";

/*
 * Logic test for robinson-induction/robinson-induction-core.js.
 *
 *   1. Splitting H-tiles into unit widths and V-tiles into unit heights.
 *   2. Finding the full H-column in Winkler's tiling, removing it and closing
 *      the gap: fewer H-tiles, same height, still a valid tiling.
 *   3. Running the induction to the base case, and the sidewise reduction that
 *      underlies proof #15.5. Broken tilings are detected.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("robinson-induction/robinson-induction-core.js", "RobinsonInductionCore");

{
  const s = C.start();
  check("the start is a valid tiling", C.validate(s).valid);
  equal("two H-tiles at the start", C.analyze(s).hCount, 2);
  equal("two V-tiles at the start", C.analyze(s).vCount, 2);
  check("the ambient rectangle is special", C.analyze(s).ambientSpecial);
  check("integers are recognised", C.isInt(3));
  check("2.5 is not an integer", !C.isInt(2.5));

  const wide = { ...s, tiles: [{ x: 0, y: 0, w: 3, h: 0.5, kind: "H" }, { x: 0, y: 0.5, w: 3, h: 1, kind: "V" }] };
  const split = C.split(wide);
  equal("a width-3 H-tile splits in three", split.tiles.filter((t) => t.kind === "H").length, 3);
  check("each H-strip has width 1", split.tiles.filter((t) => t.kind === "H").every((t) => t.w === 1));
  const tall = { ...s, tiles: [{ x: 0, y: 0, w: 1.5, h: 3, kind: "V" }, { x: 1.5, y: 0, w: 1, h: 3, kind: "H" }] };
  const splitTall = C.split(tall);
  equal("a height-3 V-tile splits in three", splitTall.tiles.filter((t) => t.kind === "V").length, 3);
  check("each V-strip has height 1", splitTall.tiles.filter((t) => t.kind === "V").every((t) => t.h === 1));
}

{
  let state = C.split(C.start());
  const column = C.findColumn(state, 0);
  equal("the H-column has two tiles", column.length, 2);
  state = C.extend(state, 0);
  equal("extend found the column", state.path.length, 2);
  equal("the gap is vertical", state.gap.orientation, "vertical");
  const before = { ...state.ambient };
  state = C.removePath(state);
  equal("both H-tiles were removed", C.hTiles(state).length, 0);
  state = C.closeGap(state);
  equal("the width shrank by one", state.ambient.w, before.w - 1);
  equal("the height did not change", state.ambient.h, before.h);
  check("the reduced tiling is valid", C.validate(state).valid);
  check("the base case holds", C.baseCase(state).holds);
  check("the reduced rectangle is still special", C.analyze(state).ambientSpecial);
}

{
  const result = C.induct(C.start());
  check("the induction reaches no H-tiles", result.complete);
  check("every step reduces the H count", result.steps.every((s, i) => i === 0 || s.hCount < result.steps[i - 1].hCount));
  equal("only one step was needed", result.steps.length, 1);
  check("the final tiling is valid", C.validate(result.state).valid);
  check("the final base case holds", C.baseCase(result.state).holds);

  const sideways = C.findRow(result.state, 0);
  equal("a V-row spans the reduced rectangle", sideways.length, 1);
  const afterRow = C.closeGap(C.removePath(C.extend(result.state, 0)));
  equal("removing a row shrinks the height", afterRow.ambient.h, result.state.ambient.h - 1);
  check("the row-reduced tiling is valid", C.validate(afterRow).valid);
  equal("a later row has one tile", C.findRow(afterRow, 0).length, 1);
}

{
  const broken = C.start();
  broken.tiles = broken.tiles.map((t, i) => (i === 0 ? { ...t, x: 0.2 } : t));
  check("a gap or overlap is detected", !C.validate(broken).valid);
  const noColumn = C.start();
  noColumn.tiles[1] = { ...noColumn.tiles[1], x: 0.2 };
  equal("a broken chain yields no column", C.findColumn(noColumn, 0).length, 0);
  check("remove without a path is harmless", C.removePath(C.start()).tiles.length === 4);
  check("close without a gap is harmless", C.closeGap(C.start()).ambient.w === 2.5);
}

done("robinson-induction");
