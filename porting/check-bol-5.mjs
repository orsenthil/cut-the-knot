#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-5/bol-5-core.js.
 *
 *   node porting/check-bol-5.mjs
 *
 * Checked: the start position and the drag limits from BOL5Canvas.init; the
 * page's claim (the two twin circles are equal, AC*CB = AB*HE and
 * 1/r = 1/r1 + 1/r2) together with the three tangencies and the proof points
 * at 341 positions of C along AB and at rotated/scaled/random AB segments;
 * the mirror symmetry of the twins and the maximum radius at the midpoint.
 *
 * The last group is a second, literal transcription of the applet's own
 * computation: ApolloniusCircle.SetCircles/Compute/DrawOneCircle from its
 * bytecode (with the 1e6 "circle" standing for the vertical line CD), plus
 * BOL5Canvas.Extend and GeoSDoub.Intersect for E, H, D and G. It is compared
 * with the core's closed form at every one of the 341 positions. The applet's
 * huge dummy circle loses about five digits to cancellation, so its radii
 * agree with the exact formula to 1e-3 and its centres to 0.3 board units;
 * the core keeps the closed form and those residuals are stated here rather
 * than hidden.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-5/bol-5-core.js", "Bol5Core");
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) =>
  Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const at = (x, y) => ({ x, y });

/* -------------------------------------------------------- 1. the start/rules */

{
  const s = C.start();
  equal("start A is the applet's left end (30, 185)", s.A, { x: 30, y: 185 });
  equal("start B is the applet's right end (220, 185)", s.B, { x: 220, y: 185 });
  equal("start C is 0.3*A + 0.7*B, fixed on AB", s.C, { x: 163, y: 185 });
  check("a fresh picture is not a finished play", C.result(s) === null);
  check("C cannot be dragged off AB", C.clampC(at(100, 95), s).y === 185);
  check("C cannot pass A", C.clampC(at(1, 185), s).x === 40);
  check("C cannot pass B", C.clampC(at(280, 185), s).x === 210);
  check("a rejected point leaves C where it was", C.withPoint(s, "Z", at(1, 1)).C.x === 163);
  check("withPoint does not mutate the old position", (() => {
    const next = C.withPoint(s, "C", at(90, 185));
    return s.C.x === 163 && next.C.x === 90 && next.A.x === s.A.x;
  })());
  check("withOption keeps the points and flips only the named option", (() => {
    const next = C.withOption(s, "showHint", true);
    return next.showHint && next.showNames === s.showNames && next.C.x === 163;
  })());
}

/* ------------------------------- 2. every claim, over many configurations */

const configs = [];
for (let x = 40; x <= 210; x += 0.5) {
  configs.push({ A: at(30, 185), B: at(220, 185), C: at(x, 185), showNames: true, showHint: false });
}
/* A tilted and rescaled AB, and some random ones: the claim is not about the
   particular axes the Java canvas happened to use. */
const tilted = [
  [at(10, 100), at(310, 200)],
  [at(50, 220), at(250, 40)],
  [at(0, 0), at(280, 0)],
  [at(70, 60), at(130, 60)],
];
for (const [A, B] of tilted) {
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    configs.push({
      A, B,
      C: { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t },
      showNames: true, showHint: false,
    });
  }
}
const rnd = rng(2712);
for (let i = 0; i < 20; i++) {
  const A = at(rnd() * 200, rnd() * 200);
  const B = at(A.x + 80 + rnd() * 200, A.y + (rnd() - 0.5) * 200);
  const t = 0.05 + rnd() * 0.9;
  configs.push({ A, B, C: { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t } });
}

for (const [i, s] of configs.entries()) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const tag = `config ${i}`;
  check(`${tag}: measurements exist`, Boolean(m));
  check(`${tag}: the twin circles are equal`, cl.twinsEqual);
  check(`${tag}: AC*CB = AB*HE`, cl.productFormula);
  check(`${tag}: 1/r = 1/r1 + 1/r2`, cl.reciprocal);
  check(`${tag}: the left circle touches CD, AC and AB`, cl.leftTangent);
  check(`${tag}: the right circle touches CD, CB and AB`, cl.rightTangent);
  check(`${tag}: CD is perpendicular and ends on the big circle`, cl.perpendicular);
  check(`${tag}: F, G, H and I satisfy the proof's straight lines`, cl.proofPoints);
}

/* Two exact configurations and the shape of the formula. */
{
  const mid = C.start({ points: { A: at(30, 185), B: at(220, 185), C: at(125, 185) } });
  const m = C.measurements(mid);
  check("at the midpoint r is R/4", close(m.r, m.R / 4, 1e-12));
  check("at the midpoint both circles have radius 23.75", close(m.left.r, 23.75, 1e-12) && close(m.right.r, 23.75, 1e-12));
  const s = C.start();
  const m2 = C.measurements(s);
  check("the start's diameter HE is AC*CB/AB", close(m2.HE, (m2.AC * m2.CB) / m2.AB, 1e-10));
  check("the two diameters are equal", close(m2.HE, 2 * m2.right.r, 1e-12));
  check("r grows toward the midpoint", (() => {
    const nearEnd = C.measurements(C.start({ points: { A: at(30, 185), B: at(220, 185), C: at(60, 185) } }));
    return nearEnd.r < m.r;
  })());
  check("a mirror of C swaps the twin centres but not the radius", (() => {
    const left = C.measurements(s);
    const right = C.measurements(C.start({ points: { A: at(30, 185), B: at(220, 185), C: at(220 - 163 + 30, 185) } }));
    return close(left.r, right.r, 1e-12) &&
      close(left.left.c.x, 2 * 125 - right.right.c.x, 1e-9) &&
      close(left.left.c.y, right.right.c.y, 1e-9);
  })());
}

/* ----------------- 3. the applet's own computation, transcribed from bytecode */

/*
 * ApolloniusCircle.CInfo = c.x^2 + c.y^2 - c.r^2.
 * The tangent condition is |P - Ci| = |r - s_i*r_i|, so subtracting the
 * equations for i=0,1,2 gives two linear equations for the centre in terms
 * of r; the quadratic in r is K2*r^2 + S13*r + S15 = 0.
 */
function apolloniusCompute(c0, c1, c2, s0, s1, s2) {
  const A1 = 2 * (c1.x - c0.x), A2 = 2 * (c2.x - c0.x);
  const B1 = 2 * (c1.y - c0.y), B2 = 2 * (c2.y - c0.y);
  const info = (c) => c.x * c.x + c.y * c.y - c.r * c.r;
  const o = info(c0), D1 = o - info(c1), D2 = o - info(c2);
  const K = A1 * B2 - A2 * B1;
  if (Math.abs(K) < 0.01) return null; // TreatZeroDeterminant returns null
  const G = (B1 * D2 - B2 * D1) / K;
  const I = -(A1 * D2 - A2 * D1) / K;
  const t3 = 2 * (s0 * c0.r - s1 * c1.r);
  const t5 = 2 * (s0 * c0.r - s2 * c2.r);
  const S7 = (B1 * t5 - B2 * t3) / K;
  const S9 = -(A1 * t5 - A2 * t3) / K;
  const K2 = S7 * S7 + S9 * S9 - 1;
  if (Math.abs(K2) < 0.001) return null;
  const S13 = 2 * (S7 * G + S9 * I - S7 * c0.x - S9 * c0.y + s0 * c0.r);
  const S15 = G * G + I * I - 2 * G * c0.x - 2 * I * c0.y + o;
  let disc = S13 * S13 - 4 * K2 * S15;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const root = (t) => {
    let radius = (-S13 + t) / (2 * K2);
    if (radius < 0) radius = -radius; // the applet stores |r|
    return { c: { x: S7 * radius + G, y: S9 * radius + I }, r: radius };
  };
  return [root(disc), root(-disc)];
}

/* DrawOneCircle: circles[0] unless a circle within 1 unit was used already. */
function drawOneCircle(used, circles) {
  if (!circles) return null;
  const wasUsed = (c) => used.some((u) => dist(u.c, c.c) < 1);
  const chosen = wasUsed(circles[0]) ? circles[1] : circles[0];
  if (!wasUsed(chosen)) used.push(chosen);
  return chosen;
}

/* BOL5Canvas.DrawSmallCircles, with the applet's own 1e6 dummy circles. */
function appletTwins(s) {
  const m = C.measurements(s);
  const big = { x: m.M.x, y: m.M.y, r: m.R };
  const smallL = { x: m.O1.x, y: m.O1.y, r: m.r1 };
  const smallR = { x: m.O2.x, y: m.O2.y, r: m.r2 };
  const dummyL = { x: m.C.x - 1e6, y: m.C.y - 1, r: 1e6 };
  const dummyR = { x: m.C.x + 1e6, y: m.C.y - 1, r: 1e6 };
  const usedL = [], usedR = [];
  return {
    left: drawOneCircle(usedL, apolloniusCompute(dummyL, smallL, big, 1, -1, 1)),
    right: drawOneCircle(usedR, apolloniusCompute(dummyR, smallR, big, 1, -1, 1)),
  };
}

/* BOL5Canvas.Extend(p, circle) = 2*circle - p: the far end of the diameter. */
const appletExtend = (p, circle) => ({ x: 2 * circle.c.x - p.x, y: 2 * circle.c.y - p.y });

/* GeoSDoub.Intersect(P1,P2,P3,P4), transcribed from its bytecode. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

for (const [i, s] of configs.slice(0, 341).entries()) {
  const m = C.measurements(s);
  const tw = appletTwins(s);
  const tag = `applet config ${i}`;
  check(`${tag}: the Apollonius solver found both circles`, Boolean(tw.left && tw.right));
  if (!tw.left || !tw.right) continue;
  check(`${tag}: the left radius matches the core`, close(tw.left.r, m.left.r, 1e-3));
  check(`${tag}: the right radius matches the core`, close(tw.right.r, m.right.r, 1e-3));
  check(`${tag}: the left centre matches the core`, closePt(tw.left.c, m.left.c, 0.3));
  check(`${tag}: the right centre matches the core`, closePt(tw.right.c, m.right.c, 0.3));
  check(`${tag}: the applet's two circles are equal`, close(tw.left.r, tw.right.r, 1e-3));

  /* E, H and HE from the applet's own Extend call. */
  const E = { x: m.C.x, y: tw.left.c.y };
  const H = appletExtend(E, tw.left);
  check(`${tag}: E matches the core`, closePt(E, m.E, 0.3));
  check(`${tag}: H matches the core`, closePt(H, m.H, 0.3));
  check(`${tag}: HE matches AC*CB/AB`, close(dist(E, H), (m.AC * m.CB) / m.AB, 5e-3));

  /* Dp and G from GeoSDoub.Intersect, as in BOL5Canvas.Draw. Dp is the
     proof's D (AF meets CD), not the top of the perpendicular the applet
     draws, so it is compared with the core's Dp. */
  const Dp = appletIntersect(m.A, H, m.C, E);
  const G = appletIntersect(m.A, E, m.C, H);
  check(`${tag}: Dp matches the core`, closePt(Dp, m.Dp, 0.3));
  check(`${tag}: G matches the core`, closePt(G, m.G, 0.3));
}

/* A few exact checks of the transcription itself. */
{
  const s = C.start();
  const tw = appletTwins(s);
  check("the start's left circle is near (143.05, 112.15) with r about 19.95",
    closePt(tw.left.c, at(143.05, 112.153), 0.01) && close(tw.left.r, 19.95, 1e-3));
  check("the start's right circle is near (182.95, 137.31) with r about 19.95",
    closePt(tw.right.c, at(182.95, 137.310), 0.01) && close(tw.right.r, 19.95, 1e-3));
  check("DrawOneCircle moves on when its first circle was used", (() => {
    const used = [];
    const pair = apolloniusCompute(
      { x: s.C.x - 1e6, y: s.C.y - 1, r: 1e6 },
      { x: 96.5, y: 185, r: 66.5 },
      { x: 125, y: 185, r: 95 }, 1, -1, 1);
    const first = drawOneCircle(used, pair);
    const second = drawOneCircle(used, pair);
    return first === pair[0] && second === pair[1] && used.length === 2;
  })());
}

done("bol-5");
