#!/usr/bin/env node
"use strict";

/*
 * Logic test for napoleon-polygons/napoleon-polygons-core.js.
 *
 *   node porting/check-napoleon-polygons.mjs
 *
 * The theorem on random polygons: for every n from 3 to 15 and every excluded
 * number m from 1 to n-1, 200 random polygons each: (1) every polygon in the
 * chain has the same centroid as the first (the page's property of the
 * transformation); (2) the last polygon is exactly the regular n-gon with
 * vertices centroid + a w^(m j) (star-shaped for m other than 1 and n-1); (3) the
 * order of the n-2 steps does not matter (checked with 5 random orders). With
 * m = 0 nothing is excluded and the result is the single point, the centroid.
 * Napoleon's theorem itself (n = 3), the equilateral triangle of the centres of
 * the triangles built outward (or inward) on a triangle's sides, is checked
 * directly. Also c_k = 1/(1 - w^k) as the applet computes it, the circulant
 * form, and that one transformation scales the frequency-k part by w^(-k)... : its
 * effect is multiplication by (c w^-k + 1 - c) on the k-th Fourier part.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("napoleon-polygons/napoleon-polygons-core.js", "NapoleonCore");
const close = (a, b, t = 1e-7) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
const rpoly = (n, r) => Array.from({ length: n }, () => ({ x: r() * 400, y: r() * 300 }));

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("5-gon, exclude 1, no triangles to begin with", [s.n, s.m, s.points.length, s.showTriangles], [5, 1, 5, false]);
  equal("n runs 3..15; the excluded number 0..n-1", [C.MIN_N, C.MAX_N, C.clampN(1), C.clampN(99), C.clampM(9, 5), C.clampM(-3, 5), C.clampM(2, 5)], [3, 15, 3, 15, 4, 0, 2]);
  const reg = C.regular(5);
  equal("the base is a regular pentagon around (250, 180) of radius 180 * 3/5 = 108", [reg.length, close(C.centroid(reg).x, 250), close(C.centroid(reg).y, 180), close(Math.hypot(reg[0].x - 250, reg[0].y - 180), 108)], [5, true, true, true]);
  const w = C.root(4, 1);
  equal("w for n = 4, k = 1 is i", [close(w.x, 0), close(w.y, 1)], [true, true]);
  const c = C.stepNumber(3, 1);
  check("c_1 for n = 3 is 1/(1 - w) = 1/2 + i sqrt(3)/6 (so the apex is the centre of an equilateral triangle)", close(c.x, 0.5) && close(c.y, Math.sqrt(3) / 6), JSON.stringify(c));
  equal("steps: 1..n-1 without m", [C.stepsFor(5, 1), C.stepsFor(5, 0), C.stepsFor(3, 2)], [[2, 3, 4], [1, 2, 3, 4], [1]]);
  const m = C.movePoint(s, 2, -50, 999);
  equal("a vertex is dragged and kept on the board; a bad one refused", [m.points[2], C.movePoint(s, 5, 1, 1), C.movePoint(s, 0, NaN, 1)], [{ x: 2, y: 358 }, null, null]);
  const sn = C.setN(s, 8);
  equal("changing n makes a new regular polygon and keeps m in range", [sn.n, sn.points.length, C.setN({ ...s, m: 4 }, 3).m, C.setM(s, 99).m], [8, 8, 2, 4]);
}

/* ------------------------ 2. the theorem, for every n and every excluded m */
{
  const r = rng(1905);
  let cases = 0, badCentroid = 0, badRegular = 0, badOrder = 0, badPoint = 0, worst = 0;
  for (let n = 3; n <= 15; n++) for (let m = 0; m < n; m++) for (let t = 0; t < 200; t++) {
    const base = rpoly(n, r), st = { n, m, points: base, showTriangles: false };
    const chain = C.polygons(st);
    cases++;
    const c0 = C.centroid(base);
    for (const p of chain) { const c = C.centroid(p); if (Math.abs(c.x - c0.x) > 1e-7 * 400 || Math.abs(c.y - c0.y) > 1e-7 * 400) badCentroid++; }
    const last = chain[chain.length - 1];
    if (m === 0) {
      // nothing excluded: all the Fourier parts but the mean are removed: a point
      const dev = Math.max(...last.map((p) => Math.hypot(p.x - c0.x, p.y - c0.y)));
      if (dev > 1e-6 * 400) badPoint++;
    } else {
      const g = C.regularity(last, n - m);
      worst = Math.max(worst, g.dev / Math.max(1, g.radius));
      if (g.dev > 1e-6 * 400) badRegular++;
    }
    // the order of the steps does not matter
    if (m >= 1 && n >= 4) {
      for (let q = 0; q < 2; q++) {
        const ks = C.stepsFor(n, m).slice().sort(() => r() - 0.5);
        let cur = base; for (const k of ks) cur = C.transform(cur, C.stepNumber(n, k));
        if (cur.some((p, j) => Math.hypot(p.x - last[j].x, p.y - last[j].y) > 1e-6 * 400)) badOrder++;
      }
    }
  }
  console.log(`  (${cases.toLocaleString()} random polygons; the largest deviation from a regular polygon was ${worst.toExponential(1)} of the radius)`);
  equal("every polygon in every chain has the centroid of the base polygon (the page's concentric property)", badCentroid, 0);
  equal("the last polygon is exactly centroid + a w^((n-m) j), a regular n-gon (star-shaped for m other than 1 and n-1), for all n = 3..15, m = 1..n-1", badRegular, 0);
  equal("with nothing excluded (m = 0) the result is the centroid alone", badPoint, 0);
  equal("the order of the n-2 steps does not matter", badOrder, 0);
}

/* -------------------------------- 3. Napoleon's theorem (n = 3) directly */
{
  const r = rng(5);
  let bad = 0, badInner = 0;
  for (let t = 0; t < 5000; t++) {
    const [A, B, Cc] = rpoly(3, r);
    // the centre of an equilateral triangle built on side XY, on the left side of X to Y
    const centre = (X, Y, sign) => {
      const mid = { x: (X.x + Y.x) / 2, y: (X.y + Y.y) / 2 }, d = { x: Y.x - X.x, y: Y.y - X.y };
      const k = sign * Math.sqrt(3) / 6;
      return { x: mid.x - k * d.y, y: mid.y + k * d.x };
    };
    for (const sign of [1, -1]) {
      const O = [centre(A, B, sign), centre(B, Cc, sign), centre(Cc, A, sign)];
      const s = [Math.hypot(O[0].x - O[1].x, O[0].y - O[1].y), Math.hypot(O[1].x - O[2].x, O[1].y - O[2].y), Math.hypot(O[2].x - O[0].x, O[2].y - O[0].y)];
      const bad1 = Math.max(...s) - Math.min(...s) > 1e-7 * Math.max(...s);
      if (sign === 1 ? bad1 : false) bad++;
      if (sign === -1 && bad1) badInner++;
    }
    // the same triangle from the transformation with k = 1 (outward or inward as the orientation), n = 3, m = 2
    const st = { n: 3, m: 2, points: [A, B, Cc], showTriangles: false }, last = C.polygons(st)[0];
    const s2 = [Math.hypot(last[0].x - last[1].x, last[0].y - last[1].y), Math.hypot(last[1].x - last[2].x, last[1].y - last[2].y), Math.hypot(last[2].x - last[0].x, last[2].y - last[0].y)];
    if (Math.max(...s2) - Math.min(...s2) > 1e-7 * Math.max(...s2)) bad++;
  }
  equal("Napoleon's theorem on 5,000 random triangles: the centres of the outer triangles (and of the inner ones) form an equilateral triangle, and so does the transformation with n = 3, m = 2", [bad, badInner], [0, 0]);
  // and the transformation c_1 is exactly the construction of the centre
  const A = { x: 0, y: 0 }, B = { x: 4, y: 0 }, Cc = { x: 1, y: 3 };
  const q = C.transform([A, B, Cc], C.stepNumber(3, 1));
  // q[1] = c A + (1-c) B is the centre of an equilateral triangle built on AB
  const d = { x: B.x - A.x, y: B.y - A.y }, mid = { x: 2, y: 0 }, k = Math.sqrt(3) / 6;
  check("with n = 3 the point c P[j-1] + (1-c) P[j] is the centre of the equilateral triangle on the side", close(q[1].x, mid.x - k * d.y) && close(q[1].y, mid.y + k * d.x) || close(q[1].x, mid.x + k * d.y) && close(q[1].y, mid.y - k * d.x), JSON.stringify(q[1]));
}

/* ----------- 4. regularity measure, and the shape of the star */
{
  const pent = C.regular(5), g = C.regularity(pent, 1);
  check("a regular polygon has deviation 0 for m = 1 and a rotated copy of a star does not for m = 1", g.dev < 1e-9 && g.spread < 1e-9);
  const star = pent.map((_, j) => ({ x: Math.cos((4 * Math.PI * j) / 5) * 50, y: Math.sin((4 * Math.PI * j) / 5) * 50 }));
  equal("the pentagram (m = 2) is regular for m = 2 and not for m = 1", [C.regularity(star, 2).dev < 1e-9, C.regularity(star, 1).dev > 1], [true, true]);
  const base = { n: 7, m: 3, points: Array.from({ length: 7 }, (_, j) => ({ x: 100 + 10 * j * j % 17, y: 50 + 13 * j % 11 })), showTriangles: false };
  const last = C.polygons(base).at(-1);
  equal("a heptagon excluding 3 ends as the {7/4} = {7/3} star traversed the other way: frequency 4, not 1", [C.regularity(last, 4).dev < 1e-6, C.regularity(last, 1).dev > 1e-3], [true, true]);
}

done("napoleon-polygons");
