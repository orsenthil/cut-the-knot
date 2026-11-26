#!/usr/bin/env node
"use strict";

/*
 * Logic test for stick-in-three/stick-in-three-core.js.
 *
 *   node porting/check-stick-in-three.mjs
 *
 * 1. The geometry: in an equilateral triangle the perpendiculars from any
 *    point add up to the height (Viviani), and they make a triangle exactly
 *    when the point is inside the middle triangle, checked over a fine grid
 *    of points with the distances measured, not assumed.
 * 2. The page's four answers, by integrating each way of breaking over a
 *    fine grid: 1/4, 2 ln 2 - 1 (about 0.386, not the 1/3 Gardner first
 *    printed), ln 2 - 1/2 and 1/4; and the seeded simulation agrees.
 * 3. The pieces always add up to the stick; the triangle built from them
 *    has those sides; the position is untouched by a move.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("stick-in-three/stick-in-three-core.js", "StickInThreeCore");
const near = (a, b, e) => Math.abs(a - b) < e;

{
  const s3 = Math.sqrt(3), V = [[0, -1], [-s3 / 2, 0.5], [s3 / 2, 0.5]];  // circumradius 1, height 1.5
  const side = (i) => [V[(i + 1) % 3], V[(i + 2) % 3]];
  const dist = (P, [A, B]) => Math.abs((B[0] - A[0]) * (A[1] - P[1]) - (A[0] - P[0]) * (B[1] - A[1])) / Math.hypot(B[0] - A[0], B[1] - A[1]);
  const mid = (A, B) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const M = [mid(V[1], V[2]), mid(V[2], V[0]), mid(V[0], V[1])];
  const inTri = (P, T) => {
    const s = T.map((A, i) => { const B = T[(i + 1) % 3]; return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]); });
    return s.every((x) => x > 1e-12) || s.every((x) => x < -1e-12);
  };
  let viviani = true, medial = true, pts = 0;
  for (let i = 0; i <= 120; i++) for (let j = 0; i + j <= 120; j++) {
    const w = [i / 120, j / 120, (120 - i - j) / 120];
    const P = [0, 1].map((k) => w[0] * V[0][k] + w[1] * V[1][k] + w[2] * V[2][k]);
    const d = [0, 1, 2].map((k) => dist(P, side(k)) / 1.5);
    if (!near(d[0] + d[1] + d[2], 1, 1e-9)) viviani = false;
    const onEdge = d.some((x) => near(x, 0.5, 1e-9));
    if (!onEdge) { pts++; if (C.forms(d) !== inTri(P, M)) medial = false; }
  }
  check("Viviani: the three perpendiculars add up to the height, at 7,381 points", viviani);
  check(`they make a triangle exactly when P is inside the middle triangle (${pts} points)`, medial);
  equal("the applet's starting point cuts the stick 2 : 4 : 3", C.start().pieces.map((x) => Math.round(x * 9)).join(":"), "2:4:3");
}

{
  const N = 1500;
  const exact = {};
  for (const m of C.METHODS) {
    let hits = 0, total = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N;
      if (m === "uniform") { total++; if (C.forms(C.breakWith(m, u, v, 0))) hits++; continue; }
      // w only picks the piece: average over its two outcomes with their chances
      const pLeft = m === "longer" ? (u < 0.5 ? 0 : 1) : m === "coin" ? 0.5 : u;
      total++;
      hits += pLeft * C.forms(C.breakWith(m, u, v, 0)) + (1 - pLeft) * C.forms(C.breakWith(m, u, v, 0.9999999));
    }
    exact[m] = hits / total;
  }
  check(`two uniform break points: 1/4 (integral ${exact.uniform.toFixed(5)})`, near(exact.uniform, 0.25, 1e-3));
  check(`break the longer piece: 2 ln 2 - 1 = 0.3863 (integral ${exact.longer.toFixed(5)})`, near(exact.longer, C.EXACT.longer, 1e-3));
  check("which is not 1/3, the answer Gardner first printed", Math.abs(exact.longer - 1 / 3) > 0.05);
  check(`break either piece at a coin toss: ln 2 - 1/2 = 0.1931 (integral ${exact.coin.toFixed(5)})`, near(exact.coin, C.EXACT.coin, 1e-3));
  check(`break a piece chosen by its length: 1/4 again (integral ${exact.proportional.toFixed(5)})`, near(exact.proportional, 0.25, 1e-3));
  let sim = true;
  for (const m of C.METHODS) {
    const s = C.breakSticks(C.start({ method: m, seed: 7 }), 100000);
    if (!near(s.hits / s.tries, C.EXACT[m], 0.006)) sim = false;
  }
  check("100,000 random sticks each way land within 0.006 of the answers", sim);
}

{
  let sums = true, sides = true;
  const r = C.rng(3);
  for (const m of C.METHODS) for (let i = 0; i < 2000; i++) {
    const p = C.breakWith(m, r.next(), r.next(), r.next());
    if (!near(p[0] + p[1] + p[2], 1, 1e-12) || p.some((x) => x < 0)) sums = false;
    const t = C.triangle(p);
    if (t) {
      const d = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1]);
      if (!near(d(t[1], t[2]), p[0], 1e-9) || !near(d(t[0], t[2]), p[1], 1e-9) || !near(d(t[0], t[1]), p[2], 1e-9)) sides = false;
    }
  }
  check("the pieces always add up to the stick", sums);
  check("the triangle drawn from the pieces has exactly those sides", sides);
  check("a piece of half the stick or more: no triangle", C.triangle([0.5, 0.25, 0.25]) === null && C.excess([0.6, 0.3, 0.1]).longest === 0);
  const s = C.start();
  const before = JSON.stringify(s);
  C.breakSticks(s, 10); C.moveTo(s, [1, 1, 1]);
  equal("moves leave the old position alone", JSON.stringify(s), before);
  const a = C.breakSticks(C.start({ seed: 5 }), 50), b = C.breakSticks(C.breakSticks(C.start({ seed: 5 }), 20), 30);
  check("the same seed gives the same sticks, in one go or in parts", a.hits === b.hits && a.pieces.join() === b.pieces.join());
}

done("stick-in-three");
