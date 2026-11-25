#!/usr/bin/env node
"use strict";

/*
 * Logic test for grid-spacing-dial/grid-spacing-dial-core.js.
 *
 *   node porting/check-grid-spacing-dial.mjs
 *
 * The formula against a pair-by-pair count for every grid size 3..10 and every
 * c2; the article's numbers for a 16 by 16 grid (c2 = 25 gives 976, c2 = 65
 * gives 912, and spacing 1 gives 2 * 16 * 15 = 480); the best c2 for 16 by 16;
 * and the unit pairs are really unit apart when the points are placed.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("grid-spacing-dial/grid-spacing-dial-core.js", "GridDialCore");

let bad = 0, checked = 0;
for (let k = 3; k <= 10; k++) for (let c2 = 1; c2 <= C.maxC2(k) + 3; c2++) { checked++; if (C.count(k, c2) !== C.countBrute(k, c2)) bad++; }
equal(`formula = pair count for k = 3..10 (${checked} cases)`, bad, 0);

equal("16 x 16, spacing 1: 480 pairs", C.count(16, 1), 480);
equal("16 x 16, c2 = 25 (spacing 1/5): 976 pairs", C.count(16, 25), 976);
equal("16 x 16, c2 = 65 (spacing 1/sqrt 65): 912 pairs", C.count(16, 65), 912);
equal("brute force agrees on the 976 and the 912", [C.countBrute(16, 25), C.countBrute(16, 65)], [976, 912]);
equal("a grid with c2 = 2 has the diagonals too", C.count(4, 2), 18);
equal("c2 that is not a sum of two squares gives 0", C.count(10, 3), 0);
equal("too far apart gives 0", C.count(5, C.maxC2(5) + 1), 0);

{
  const b = C.best(16);
  console.log(`  (best for 16 x 16: c2 = ${b.c2}, ${b.count} pairs)`);
  check("best(16) is at least the article's 976", b.count >= 976);
  let top = 0; for (let c2 = 1; c2 <= C.maxC2(16); c2++) top = Math.max(top, C.count(16, c2));
  equal("best(16) is the largest over every c2", b.count, top);
}

// Place the points and measure.
{
  const k = 6, c2 = 25, s = 1 / Math.sqrt(c2);
  const pts = []; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) pts.push({ x: x * s, y: y * s });
  let n = 0; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.abs(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) - 1) < 1e-9) n++;
  equal("a real 6 x 6 grid at spacing 1/5 has count(6, 25) unit pairs", n, C.count(6, 25));
  equal("the neighbours of the corner (0,0) in a 16 grid with c2 = 25: (5,0) (0,5) (3,4) (4,3)", C.neighbours(16, 25, 0, 0).length, 4);
  equal("the neighbours of an inner point: all 12", C.neighbours(16, 25, 8, 8).length, 12);
}
equal("clamps", [C.clampK(1), C.clampK(99), C.clampC2(5, 0), C.clampC2(5, 999)], [3, 24, 1, 32]);

done("grid-spacing-dial");
