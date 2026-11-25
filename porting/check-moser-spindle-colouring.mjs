#!/usr/bin/env node
"use strict";

/*
 * Logic test for moser-spindle-colouring/moser-spindle-colouring-core.js.
 *
 *   node porting/check-moser-spindle-colouring.mjs
 *
 * The geometry: the seven points have exactly the eleven listed unit pairs and
 * no others, and all are distinct. The colouring: by exhaustive search there
 * is no proper 3-colouring, there are proper 4-colourings, and the chromatic
 * number is 4, and the counts for 2, 3, 4 colours agree with a second,
 * brute-force count over every assignment.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("moser-spindle-colouring/moser-spindle-colouring-core.js", "MoserCore");
const P = C.points();
const d = (i, j) => Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y);

equal("seven points", P.length, 7);
const unit = [];
for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) if (Math.abs(d(i, j) - 1) < 1e-9) unit.push([i, j]);
equal("exactly the eleven listed unit pairs", unit, C.EDGES.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]));
equal("eleven edges", C.EDGES.length, 11);
check("all points distinct", new Set(P.map((p) => p.x.toFixed(6) + "," + p.y.toFixed(6))).size === 7);
check("the tips D and D' are exactly 1 apart", Math.abs(d(3, 6) - 1) < 1e-12);
check("D and D' are sqrt(3) from A", Math.abs(d(0, 3) - Math.sqrt(3)) < 1e-12 && Math.abs(d(0, 6) - Math.sqrt(3)) < 1e-12);

// A second, independent count over every assignment of k colours.
const brute = (k) => {
  let t = 0;
  for (let m = 0; m < Math.pow(k, 7); m++) {
    const c = []; let x = m; for (let i = 0; i < 7; i++) { c.push(x % k); x = Math.floor(x / k); }
    if (C.EDGES.every(([i, j]) => c[i] !== c[j])) t++;
  }
  return t;
};
for (const k of [1, 2, 3, 4]) equal(`${k} colours: search and brute force agree`, C.countColourings(k), brute(k));
equal("no proper 2-colouring", C.countColourings(2), 0);
equal("no proper 3-colouring", C.countColourings(3), 0);
check("proper 4-colourings exist", C.countColourings(4) > 0);
equal("chromatic number is 4", C.chromaticNumber(), 4);
equal("solve(3) is null", C.solve(3), null);
check("solve(4) is proper", C.isProper(C.solve(4), 4));
equal("an unpainted point is not proper", C.isProper([0, 1, 2, -1, 0, 1, 2], 4), false);
equal("conflicts counts same-colour neighbours", C.conflicts([0, 0, 1, 2, 3, 3, -1]), [[0, 1], [4, 5]]);
// The triangle A B C needs three colours by itself, so 4 is forced by the tips.
equal("clampK", [C.clampK(1), C.clampK(9), C.clampK("3")], [2, 4, 3]);

done("moser-spindle-colouring");
