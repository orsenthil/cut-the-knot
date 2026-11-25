#!/usr/bin/env node
"use strict";

/*
 * Logic test for two-circles-two-points/two-circles-two-points-core.js.
 *
 *   node porting/check-two-circles-two-points.mjs
 *
 * Over 200,000 random pairs of points: at most 2 common unit neighbours, and
 * each one really is at distance 1 from both. The counting bound is checked
 * against exhaustive unit-distance graphs: every labelled graph on up to 5
 * vertices that has at most 2 common neighbours for each pair has no more
 * edges than the bound; the known maxima 3, 5, 7, 9, 12, 14, 18 for n = 3..9
 * sit under it.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("two-circles-two-points/two-circles-two-points-core.js", "TwoCirclesCore");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// The geometry.
{
  const r = rng(7);
  let worst = 0, two = 0, one = 0, zero = 0, bad = 0;
  for (let t = 0; t < 200000; t++) {
    const a = { x: r() * 4 - 2, y: r() * 4 - 2 }, b = { x: r() * 4 - 2, y: r() * 4 - 2 };
    const m = C.commonNeighbours(a, b);
    worst = Math.max(worst, m.length);
    if (m.length === 2) two++; else if (m.length === 1) one++; else zero++;
    for (const p of m) if (Math.abs(dist(p, a) - 1) > 1e-7 || Math.abs(dist(p, b) - 1) > 1e-7) bad++;
  }
  equal("never more than two common neighbours", worst, 2);
  equal("every common neighbour is at distance 1 from both", bad, 0);
  check("both 0 and 2 occur", two > 0 && zero > 0);
  equal("two points at distance 2 meet in one place", C.commonNeighbours({ x: 0, y: 0 }, { x: 2, y: 0 }), [{ x: 1, y: 0 }]);
  equal("points 3 apart share none", C.commonNeighbours({ x: 0, y: 0 }, { x: 3, y: 0 }), []);
  equal("the same point twice: none (the circles would coincide)", C.commonNeighbours({ x: 1, y: 1 }, { x: 1, y: 1 }), []);
  const m = C.commonNeighbours({ x: 0, y: 0 }, { x: 1, y: 0 });
  check("unit apart: the two apexes of the triangles", Math.abs(m[0].x - 0.5) < 1e-12 && Math.abs(Math.abs(m[0].y) - Math.sqrt(3) / 2) < 1e-12);
  const s = C.separate({ x: 0, y: 0 }, { x: 0, y: 0 });
  check("separate pushes a coincident centre aside", Math.abs(s.x - C.MIN_GAP) < 1e-12);
}

// The bound against every graph on up to 5 vertices with no pair of vertices sharing 3 neighbours.
{
  for (let n = 3; n <= 5; n++) {
    const slots = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) slots.push([i, j]);
    let best = 0;
    for (let mask = 0; mask < 1 << slots.length; mask++) {
      const adj = Array.from({ length: n }, () => Array(n).fill(false)); let e = 0;
      slots.forEach(([i, j], k) => { if (mask >> k & 1) { adj[i][j] = adj[j][i] = true; e++; } });
      let ok = true;
      for (let i = 0; ok && i < n; i++) for (let j = i + 1; ok && j < n; j++) {
        let c = 0; for (let k = 0; k < n; k++) if (adj[i][k] && adj[j][k]) c++;
        if (c > 2) ok = false;
      }
      if (ok) best = Math.max(best, e);
    }
    check(`n=${n}: the best such graph (${best} edges) is within the bound ${C.edgeBound(n).toFixed(2)}`, best <= C.edgeLimit(n));
  }
}

// The known maxima are all within the bound, and the bound is ~ n^1.5 / sqrt 2.
{
  const known = { 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 14, 9: 18 };
  for (const [n, u] of Object.entries(known)) check(`u(${n}) = ${u} is within the bound ${C.edgeBound(+n).toFixed(2)}`, u <= C.edgeLimit(+n));
  const r = C.edgeBound(1e6) / (Math.pow(1e6, 1.5) / Math.SQRT2);
  check("bound / (n^1.5 / sqrt 2) tends to 1", Math.abs(r - 1) < 0.01, String(r));
  equal("edgeLimit(9) = 20", C.edgeLimit(9), 20);
  equal("clampN", [C.clampN(0), C.clampN(999), C.clampN("7")], [2, 200, 7]);
}

done("two-circles-two-points");
