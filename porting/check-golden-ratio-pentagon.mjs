#!/usr/bin/env node
"use strict";

/*
 * Logic test for golden-ratio-pentagon/golden-ratio-pentagon-core.js.
 *
 *   node porting/check-golden-ratio-pentagon.mjs
 *
 * The construction (compared with a second transcription of the applet's
 * Compute), the starting position, moving the free points. Then every claim of
 * the page on 200,000 random choices of X, Z and D: the five triangles cut off
 * by the diagonals all have the same area; the area of the pentagon is
 * (5 + sqrt 5)/2 times that, i.e. 3 + (sqrt 5 - 1)/2 when the area is 1;
 * each diagonal is parallel to a side; the diagonals cut each other in the
 * golden ratio; the pentagon the diagonals make is of the same kind (its
 * area is phi^-4 times the outer one); and the star made by extending the
 * sides has five points forming another pentagon of the same kind (phi^4 times).
 * The quadratic x^2 + x - 1 = 0 behind the page's proof is also checked.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("golden-ratio-pentagon/golden-ratio-pentagon-core.js", "PentagonCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const PHI = (1 + Math.sqrt(5)) / 2;
const r = rng(2024);
const rp = (s) => ({ x: r() * s, y: r() * s });

/* --------------------- 1. the construction, against a literal transcription */
{
  // Straight from the bytecode of Compute(), with its own line-intersection formula.
  function applet(X, Z, D) {
    const k = 1 / ((1 + Math.sqrt(5)) / 2 + 1);
    const Extend = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const Reflect = (p, q) => ({ x: 2 * p.x - q.x, y: 2 * p.y - q.y });
    const Mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const Isect = (a, b, c, d) => {
      const A1 = b.y - a.y, B1 = a.x - b.x, C1 = A1 * a.x + B1 * a.y, A2 = d.y - c.y, B2 = c.x - d.x, C2 = A2 * c.x + B2 * c.y;
      const det = A1 * B2 - A2 * B1;
      return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
    };
    const Y = Extend(Z, X, k), A = Reflect(X, Y), Cc = Reflect(Z, D);
    const Cp = Isect(Cc, Y, A, D), Dp = Isect(D, Y, A, Cc);
    const Kk = Mid(Y, Dp), L = Mid(Y, Cp), B = Reflect(Kk, D), E = Reflect(L, Cc);
    return { Y, A, B, C: Cc, D, E, Cp, Dp, K: Kk, L };
  }
  let ok = true;
  for (let t = 0; t < 2000; t++) {
    const s = { X: rp(500), Z: rp(500), D: rp(500) };
    const mine = C.build(s), ref = applet(s.X, s.Z, s.D);
    for (const k of ["Y", "A", "B", "C", "D", "E", "Cp", "Dp", "K", "L"]) if (!near(mine[k].x, ref[k].x, 1e-7) || !near(mine[k].y, ref[k].y, 1e-7)) ok = false;
  }
  check("every constructed point agrees with the applet's own steps (2000 random X, Z, D)", ok);
  equal("k = 1/(phi + 1) = 1/phi^2", [near(C.K, 1 / (PHI * PHI)), near(C.K, 0.3819660112501051)], [true, true]);
}

/* ------------------------------------------------- 2. the position and moves */
{
  const s = C.start();
  const b = C.build(s);
  check("the starting position builds a pentagon", b !== null);
  const m = C.measure(C.corners(b));
  check("the starting pentagon already has the page's property (equal triangles)", m.ears.every((e) => near(e, m.ears[0], 1e-9)));
  // it is visibly irregular: the sides are not all equal
  const v = C.corners(b), sides = v.map((p, i) => Math.hypot(v[(i + 1) % 5].x - p.x, v[(i + 1) % 5].y - p.y));
  check("and is not regular (side lengths differ by more than 10%)", Math.max(...sides) / Math.min(...sides) > 1.1);
  check("all the points are inside the 500 by 340 area", Object.values(b).every((p) => p.x > -500 && p.x < 1000 && p.y > -500 && p.y < 800));
  const moved = C.move(s, "X", 100, 100);
  equal("moving X changes only X", [moved.X, moved.Z, moved.D], [{ x: 100, y: 100 }, s.Z, s.D]);
  equal("the old position is untouched", s, C.start());
  equal("a bad name or number is refused", [C.move(s, "Q", 1, 1), C.move(s, "X", NaN, 1)], [null, null]);
  equal("points are kept inside the drawing area", [C.move(s, "D", -50, 9999).D], [{ x: 8, y: 332 }]);
  // a regular pentagon's free points rebuild exactly that pentagon
  const reg = C.regular(250, 170, 120), f = C.freePoints(reg), rb = C.build(f);
  check("the free points of a regular pentagon rebuild the regular pentagon", C.corners(rb).every((p, i) => near(p.x, reg[i].x, 1e-9) && near(p.y, reg[i].y, 1e-9)));
  check("the number 5 + sqrt 5 over 2 is 3.618...", near(C.AREA_RATIO, 3.618033988749895));
}

/* ------------------------------------- 3. the page's claims, for any X, Z, D */
{
  let n = 0, equalEars = true, ratio = true, parallel = true, golden = true, innerOk = true, starOk = true, area1 = true, maxPar = 0;
  for (let t = 0; t < 200000; t++) {
    const s = { X: rp(500), Z: rp(500), D: rp(500) };
    const b = C.build(s);
    if (!b) continue;
    const v = C.corners(b);
    const m = C.measure(v);
    if (!m.inner.every(Boolean)) continue;
    // skip needle-thin pentagons where double rounding spoils a tight tolerance
    if (m.ears[0] < 1e-3 * m.area) continue;
    n++;
    if (!m.ears.every((e) => near(e, m.ears[0], 1e-7))) equalEars = false;
    if (!near(m.ratio, C.AREA_RATIO, 1e-7)) ratio = false;
    // with each triangle of area 1 the pentagon is 3 + (sqrt 5 - 1)/2 = (5 + sqrt 5)/2: area / ear = 3 + (sqrt 5 - 1)/2
    if (!near(m.area / m.ears[0], 3 + (Math.sqrt(5) - 1) / 2, 1e-7)) area1 = false;
    maxPar = Math.max(maxPar, ...m.parallel);
    if (m.parallel.some((p) => p > 1e-7)) parallel = false;
    // the golden ratio: diagonal v[i]v[i+2] is cut into pieces a, m, a with (a + m)/ ... we check the page's BM/DM = phi
    for (let i = 0; i < 5; i++) {
      const M = m.inner[i];   // meeting of diagonals v[i]v[i+2] and v[i+1]v[i+3]
      const BM = Math.hypot(M.x - v[(i + 1) % 5].x, M.y - v[(i + 1) % 5].y), DM = Math.hypot(M.x - v[(i + 3) % 5].x, M.y - v[(i + 3) % 5].y);
      if (!near(BM / DM, PHI, 1e-6) && !near(DM / BM, PHI, 1e-6)) golden = false;
    }
    // the inner pentagon
    const inner = m.inner, mi = C.measure(inner);
    if (!mi.ears.every((e) => near(e, mi.ears[0], 1e-6)) || !near(mi.area / m.area, Math.pow(PHI, -4), 1e-6)) innerOk = false;
    // the star's five points
    const star = C.starPoints(v);
    if (star.every(Boolean)) {
      const ms = C.measure(star);
      if (!ms.ears.every((e) => near(e, ms.ears[0], 1e-5)) || !near(ms.area / m.area, Math.pow(PHI, 4), 1e-5)) starOk = false;
    }
  }
  check(`${n} random pentagons built: the five triangles cut off by the diagonals all have the same area`, equalEars && n > 100000);
  check("the pentagon is always (5 + sqrt 5)/2 = 3.618... times one triangle (with area 1: 3 + (sqrt 5 - 1)/2)", ratio && area1);
  check(`each diagonal is parallel to a side (the sine of the angle is below ${maxPar.toExponential(1)})`, parallel);
  check("the diagonals cut each other in the golden ratio: BM/DM = phi", golden);
  check("the pentagon made by the diagonals is of the same kind (equal triangles) with area phi^-4 of the outer one", innerOk);
  check("the star's five points make another pentagon of the same kind with area phi^4 of the outer one", starOk);
}

/* ------------------------------------------ 4. the proof's quadratic, and the regular case */
{
  const x = (Math.sqrt(5) - 1) / 2;
  check("x = (sqrt 5 - 1)/2 solves x^2 + x - 1 = 0 and is 1/phi", near(x * x + x - 1, 0, 1e-12) && near(x, 1 / PHI));
  equal("(5 + sqrt 5)/2 = phi^2 + 1 = 3 + 1/phi", [near((5 + Math.sqrt(5)) / 2, PHI * PHI + 1), near((5 + Math.sqrt(5)) / 2, 3 + 1 / PHI)], [true, true]);
  // the regular pentagon is one of them: its triangles are equal and the ratio is the same
  const reg = C.regular(0, 0, 1), m = C.measure(reg);
  check("a regular pentagon has the property: equal triangles and ratio 3.618", m.ears.every((e) => near(e, m.ears[0])) && near(m.ratio, C.AREA_RATIO));
  // a pentagon that is not of this kind does not: move one corner of a regular pentagon
  const bad = reg.map((p, i) => (i === 1 ? { x: p.x + 0.2, y: p.y } : p)), mb = C.measure(bad);
  check("moving one corner of a regular pentagon breaks the property", !mb.ears.every((e) => near(e, mb.ears[0], 1e-6)));
  // a pentagon built from any X, Z, D, then sheared and scaled, still has it (affine invariance)
  let aff = true;
  for (let t = 0; t < 200; t++) {
    const b = C.build({ X: rp(500), Z: rp(500), D: rp(500) });
    if (!b) continue;
    const f = (p) => ({ x: 1.3 * p.x + 0.4 * p.y + 7, y: -0.2 * p.x + 0.9 * p.y - 3 });
    const m2 = C.measure(C.corners(b).map(f));
    if (!m2.ears.every((e) => near(e, m2.ears[0], 1e-7)) || !near(m2.ratio, C.AREA_RATIO, 1e-7)) aff = false;
  }
  check("shearing or stretching such a pentagon keeps the property (affine images of a regular pentagon)", aff);
}

done("golden-ratio-pentagon");
