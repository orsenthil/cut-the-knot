#!/usr/bin/env node
"use strict";

/*
 * Logic test for unit-distance-points/unit-distance-points-core.js.
 *
 *   node porting/check-unit-distance-points.mjs
 *
 * Every target 3, 5, 7, 9, 12, 14, 18 is reached by the page's own witness
 * (so no target is out of reach); fewer than the target cannot be beaten for
 * n = 3..6 by an exhaustive search over triangular-lattice placements; the
 * snap puts a dragged point at exactly 1 from its neighbours; and the start
 * has no unit pair.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("unit-distance-points/unit-distance-points-core.js", "UnitDistanceCore");

equal("targets", C.TARGETS, { 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 14, 9: 18 });
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  const w = C.witness(n);
  equal(`witness(${n}) has ${n} points`, w.length, n);
  equal(`witness(${n}) reaches the target ${C.TARGETS[n]}`, C.count(w), C.TARGETS[n]);
  equal(`start(${n}) has no unit pair`, C.count(C.start(n)), 0);
  const ws = new Set(w.map((p) => p.x.toFixed(5) + "," + p.y.toFixed(5)));
  equal(`witness(${n}) points are distinct`, ws.size, n);
}

// An independent lower-level count agrees on a few arrangements.
{
  const hex = [{ x: 0, y: 0 }];
  for (let k = 0; k < 6; k++) hex.push({ x: Math.cos(k * Math.PI / 3), y: Math.sin(k * Math.PI / 3) });
  let brute = 0;
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) if (Math.abs(Math.hypot(hex[i].x - hex[j].x, hex[i].y - hex[j].y) - 1) < 1e-9) brute++;
  equal("hexagon with centre has 12 pairs", [C.count(hex), brute], [12, 12]);
}

// No placement of n <= 6 points on the triangular lattice (radius 2) beats the target.
{
  const L = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const p = { x: a + b / 2, y: (b * Math.sqrt(3)) / 2 };
    if (Math.hypot(p.x, p.y) < 2.01) L.push(p);
  }
  for (let n = 3; n <= 6; n++) {
    let best = 0;
    const pick = (start, chosen) => {
      if (chosen.length === n) { best = Math.max(best, C.count(chosen)); return; }
      for (let i = start; i < L.length; i++) { chosen.push(L[i]); pick(i + 1, chosen); chosen.pop(); }
    };
    pick(0, []);
    equal(`n=${n}: best on the triangular lattice is ${C.TARGETS[n]}`, best, C.TARGETS[n]);
  }
}

// Snapping.
{
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 3 }];
  const s = C.snap(pts, 2, 0.52, 0.85, 0.15);
  check("snaps to the apex of the triangle", Math.abs(s.x - 0.5) < 1e-9 && Math.abs(s.y - Math.sqrt(3) / 2) < 1e-9, JSON.stringify(s));
  const t = C.snap(pts, 2, 0, 1.04, 0.15);
  check("snaps onto one unit circle", Math.abs(C.dist(t, pts[0]) - 1) < 1e-9);
  const far = C.snap(pts, 2, 3, 3, 0.15);
  equal("far from any circle: unchanged", far, { x: 3, y: 3 });
  const placed = pts.slice(); placed[2] = s;
  equal("after snapping there are 3 unit pairs", C.count(placed), 3);
}
equal("clampN", [C.clampN(1), C.clampN(99), C.clampN("5")], [3, 9, 5]);

done("unit-distance-points");
