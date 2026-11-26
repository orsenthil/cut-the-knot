#!/usr/bin/env node
"use strict";

/*
 * Logic test for sierpinski-chaos-game/sierpinski-chaos-game-core.js.
 *
 *   node porting/check-sierpinski-chaos-game.mjs
 *
 * 1. The page's claim that a run started in the gasket stays in it: every
 *    one of the 3^10 = 59,049 sequences of ten choices, from every corner,
 *    lands only on gasket points (checked twelve levels deep), and the
 *    middle of the triangle, a hole, is never hit.
 * 2. Elton's theorem in miniature: 40,000 random steps visit every one of
 *    the 3^6 = 729 sub-triangles of size 1/64, with each corner chosen about
 *    a third of the time.
 * 3. The applet's run(): the first point is the chosen corner, then each
 *    point is halfway from the last one to the chosen corner; RandomVertex's
 *    thresholds; dragging wipes the dots; the ranges of Delay and pixel size.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("sierpinski-chaos-game/sierpinski-chaos-game-core.js", "SierpinskiChaosGameCore");
const base = C.start({ width: 600, height: 450 });
const R = { A: 0.1, B: 0.5, C: 0.9 }; // r values that pick each corner

{
  let all = true, n = 0, hole = false;
  const centre = { x: (base.A.x + base.B.x + base.C.x) / 3, y: (base.A.y + base.B.y + base.C.y) / 3 };
  for (let code = 0; code < 3 ** 10; code++) {
    let s = base, c = code;
    for (let k = 0; k < 10; k++) { s = C.step(s, [0.1, 0.5, 0.9][c % 3]); c = Math.floor(c / 3); }
    n++;
    if (!C.inGasket(s, s.P)) all = false;
    if (Math.hypot(s.P.x - centre.x, s.P.y - centre.y) < 1) hole = true;
  }
  check(`all ${n} ten-step runs stay in the gasket`, all);
  check("the centre of the triangle (a hole) is never visited", !hole);
  const mid = { x: (base.A.x + base.B.x) / 2 + 0.25 * (base.C.x - (base.A.x + base.B.x) / 2), y: (base.A.y + base.B.y) / 2 + 0.25 * (base.C.y - (base.A.y + base.B.y) / 2) };
  check("a point inside the big middle hole is not in the gasket", !C.inGasket(base, mid));
  check("the corners and edge midpoints are in it", ["A", "B", "C"].every((k) => C.inGasket(base, base[k])) && C.inGasket(base, { x: (base.A.x + base.B.x) / 2, y: (base.A.y + base.B.y) / 2 }));
}

{
  const r = rng(3);
  let s = base;
  const cells = new Set(), picks = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 40000; i++) {
    s = C.step(s, r());
    picks[s.last]++;
    if (i < 10) continue;
    // address of the level-6 sub-triangle
    let [a, b, c] = C.barycentric(s, s.P), addr = "";
    for (let k = 0; k < 6; k++) {
      if (a >= 0.5) { addr += "A"; a = 2 * a - 1; b *= 2; c *= 2; }
      else if (b >= 0.5) { addr += "B"; b = 2 * b - 1; a *= 2; c *= 2; }
      else { addr += "C"; c = 2 * c - 1; a *= 2; b *= 2; }
    }
    cells.add(addr);
  }
  equal("40,000 steps visit all 729 sub-triangles of size 1/64", cells.size, 729);
  check("each corner is chosen about a third of the time", Object.values(picks).every((v) => Math.abs(v - 40000 / 3) < 600), JSON.stringify(picks));
}

{
  let s = C.step(base, R.B);
  check("the first point is the chosen corner itself", s.P.x === base.B.x && s.P.y === base.B.y && s.Q === null);
  const t = C.step(s, R.C);
  check("then halfway from the last point to the chosen corner", t.P.x === (base.B.x + base.C.x) / 2 && t.P.y === (base.B.y + base.C.y) / 2 && t.Q.x === base.B.x);
  equal("RandomVertex: 3r < 1 is A, < 2 is B, else C", [0, 0.3333, 0.3334, 0.6666, 0.6667, 0.9999].map((r) => C.vertexFor(base, r)).join(""), "AABBCC");
  equal("the count goes up by one per step", t.count, 2);
  const u = C.moveCorner(t, "A", 10, 10);
  check("dragging a corner wipes the dots", u.P === null && u.count === 0 && u.A.x === 10);
  const v = C.moveTriangle(t, 5, -5);
  check("dragging the triangle moves all three corners and wipes the dots", v.P === null && v.B.x === base.B.x + 5 && v.C.y === base.C.y - 5);
  check("a bad corner is refused", C.moveCorner(t, "D", 1, 1) === null);
  equal("Delay 0..5000, 200 to start", [C.DELAY.min, C.DELAY.max, C.DELAY.def].join(","), "0,5000,200");
  equal("pixel size 1..11, 2 to start", [C.PIXEL.min, C.PIXEL.max, C.PIXEL.def].join(","), "1,11,2");
  const before = JSON.stringify(t);
  C.step(t, 0.2);
  equal("a step leaves the old position alone", JSON.stringify(t), before);
}

done("sierpinski-chaos-game");
