#!/usr/bin/env node
"use strict";

/*
 * Logic test for integer-rectangle-graph/integer-rectangle-graph-core.js.
 *
 *   1. Special numbers/points, tile corners and the even special-corner count.
 *   2. For all three presets: a valid tiling, ambient corners of degree 1,
 *      interior degrees 2 or 4, a trail from the lower-left corner ending at
 *      another special ambient corner, and the counting identity with even S1.
 *   3. Detecting broken tilings and toggling H/V assignments.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("integer-rectangle-graph/integer-rectangle-graph-core.js", "IntegerRectangleGraphCore");

{
  check("3 is special", C.special(3));
  check("2.5 is not special in integers", !C.special(2.5));
  check("2.5 is special with step 1/2", C.special(2.5, 0.5));
  check("a special point", C.specialPoint({ x: 1, y: 0 }));
  check("a point with one special coordinate is not", !C.specialPoint({ x: 1, y: 0.7 }));
  const t = { x: 0, y: 0, w: 1, h: 0.7, kind: "H" };
  equal("four corners", C.corners(t).length, 4);
  equal("two special corners", C.specialCornerCount(t), 2);
  equal("H kind is detected", C.kind(t), "H");
  equal("V kind is detected", C.kind({ x: 1, y: 0, w: 1.5, h: 1 }), "V");
  const toggled = C.toggleKind(C.start(), 0);
  equal("a tile can be toggled", toggled.tiles[0].kind, "V");
  equal("an out-of-range toggle is ignored", C.toggleKind(C.start(), 9).tiles[0].kind, "H");
}

for (const name of ["winkler", "squares", "halfStep"]) {
  const state = C.PRESETS[name]();
  const r = C.analyze(state);
  const label = `preset ${name}`;

  check(`${label}: the tiles tile the ambient rectangle`, r.tiling.valid);
  equal(`${label}: all four ambient corners have degree 1`, r.cornerDegrees.join(","), "1,1,1,1");
  check(`${label}: interior degrees are 2 or 4`, r.interiorEven);
  check(`${label}: the trail ends at an ambient corner`, r.endIsCorner);
  check(`${label}: the trail's end is special`, r.endSpecial);
  check(`${label}: the trail uses every edge it needed`, r.trail.edgesUsed === r.trail.path.length - 1);
  check(`${label}: every tile has an even number of special corners`, r.counting.allTilesEven);
  check(`${label}: S is even`, r.counting.even);
  check(`${label}: S = S1 + 2S2 + 4S4`, r.counting.identity);
  check(`${label}: S1 is even and nonzero`, r.counting.S1 >= 2 && r.counting.S1 % 2 === 0);
  check(`${label}: the ambient rectangle is special`, r.ambientSpecial);
}

{
  const broken = C.start();
  broken.tiles = broken.tiles.map((t, i) => (i === 0 ? { ...t, x: 0.5, w: 0.5 } : t));
  const r = C.analyze(broken);
  check("a gap is detected", !r.tiling.valid && !r.tiling.exact);

  const overlapping = C.start();
  overlapping.tiles = overlapping.tiles.map((t, i) => (i === 0 ? { ...t, x: 0.5 } : t));
  check("an overlap is detected", !C.analyze(overlapping).tiling.valid);

  const resized = C.resize(C.start(), 0, "h", 1);
  check("resizing changes the validation", resized.tiles[0].h === 1);
  equal("a bad index is ignored", C.resize(C.start(), 9, "h", 3).tiles[0].h, 0.7);
}

done("integer-rectangle-graph");
