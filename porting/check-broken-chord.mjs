#!/usr/bin/env node
"use strict";

/*
 * Logic test for broken-chord/broken-chord-core.js.
 *
 *   node porting/check-broken-chord.mjs
 *
 * Checked: the start position and drag limits from BrokenChordCanvas.init;
 * immutability and the two toggles; the page's claim AM = MC + BC (or its
 * mirror BM = MC + AC) together with seven supporting facts (arc midpoint,
 * foot on the segment, perpendicular, extension CF = short side, P the
 * circumcentre of ABF, M the midpoint of KF, and angle APB = 2 angle AFB) at
 * 204 configurations: triangles on a circle, free triangles, mirrored,
 * rotated, scaled and near the AC = BC boundary. The near-degenerate cases
 * where the Java applet itself cannot draw are checked separately.
 *
 * The last group is a second, literal transcription of the applet's own
 * computation from its bytecode: GeoSDoub.FindCircumcenter/Intersect/
 * FindOrientation/IntersectX/IntersectY/NearestPoint and
 * BrokenChordCanvas.Compute/FindP/FindF/GetCircle, with the applet's slope
 * formulas, root order and |det| < 1 guards. It is compared with the core at
 * every one of the 204 configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("broken-chord/broken-chord-core.js", "BrokenChordCore");
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const at = (x, y) => ({ x, y });

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  const centre = at(180, 125), r = 82;
  check("start A is the applet's angle PI on its circle",
    closePt(s.A, at(centre.x + r * Math.cos(Math.PI), centre.y + r * Math.sin(Math.PI)), 1e-12));
  check("start B is the applet's angle -0.2",
    closePt(s.B, at(centre.x + r * Math.cos(-0.2), centre.y + r * Math.sin(-0.2)), 1e-12));
  check("start C is the applet's angle -PI/3.5",
    closePt(s.C, at(centre.x + r * Math.cos(-Math.PI / 3.5), centre.y + r * Math.sin(-Math.PI / 3.5)), 1e-12));
  check("the three start points lie on the same circle", (() => {
    const m = C.measurements(s);
    return close(dist(m.circle.c, m.A), m.circle.r, 1e-9) &&
      close(dist(m.circle.c, m.B), m.circle.r, 1e-9) &&
      close(dist(m.circle.c, m.C), m.circle.r, 1e-9);
  })());
  equal("a fresh picture has both toggles at the applet's defaults",
    [s.showNames, s.showHint], [true, false]);
  check("nothing can be won or lost", C.result(s) === null && C.result(s) !== "done");
  check("dragging is clamped to the board", (() => {
    const p = C.withPoint(s, "C", at(-50, 999));
    return p.C.x === 12 && p.C.y === 238;
  })());
  check("withPoint does not mutate the old position", (() => {
    const next = C.withPoint(s, "A", at(20, 20));
    return s.A.x === 98 && next.A.x === 20 && next.B.x === s.B.x;
  })());
  check("withPoint refuses an unknown handle", C.withPoint(s, "Z", at(1, 1)).C.x === s.C.x);
  check("withOption flips only the named toggle", (() => {
    const next = C.withOption(s, "showHint", true);
    return next.showHint && next.showNames === s.showNames && next.C.x === s.C.x;
  })());
  check("a collapsed AB draws nothing, as the applet's NoDraw says",
    C.measurements(C.start({ points: { A: at(100, 100), B: at(100.5, 100), C: at(150, 150) } })) === null);
  check("collinear points draw nothing",
    C.measurements(C.start({ points: { A: at(50, 100), B: at(100, 100), C: at(200, 100) } })) === null);
  check("a claimless picture reports every claim false", (() => {
    const cl = C.claims(C.start({ points: { A: at(100, 100), B: at(100.5, 100), C: at(150, 150) } }));
    return Object.keys(cl).every((k) => cl[k] === false);
  })());
}

/* ------------------------------------------- 2. every claim, many positions */

const configs = [C.start()];
const rnd = rng(2832);
for (let i = 0; i < 120; i++) {
  const c = at(180, 125), r = 60 + rnd() * 30;
  const th = () => rnd() * Math.PI * 2;
  configs.push(C.start({ points: {
    A: at(c.x + r * Math.cos(th()), c.y + r * Math.sin(th())),
    B: at(c.x + r * Math.cos(th()), c.y + r * Math.sin(th())),
    C: at(c.x + r * Math.cos(th()), c.y + r * Math.sin(th())),
  } }));
}
for (let i = 0; i < 60; i++) {
  const A = at(40 + rnd() * 80, 40 + rnd() * 120);
  const B = at(240 + rnd() * 70, 40 + rnd() * 140);
  const pC = at(120 + rnd() * 120, 30 + rnd() * 180);
  configs.push(C.start({ points: { A, B, C: pC } }));
}
/* Rotate, translate and scale a few triangles: the claim is not about axes. */
const basis = [
  [at(98, 125), at(260, 109), at(231, 61)],
  [at(60, 190), at(300, 170), at(210, 40)],
  [at(120, 60), at(280, 200), at(90, 210)],
];
for (const [a, b, c] of basis) {
  for (const k of [0.5, 1, 1.4]) {
    for (const sign of [1, -1]) {
      const f = (p) => at(sign * k * p.x + 180, k * p.y + 25);
      configs.push(C.start({ points: { A: f(a), B: f(b), C: f(c) } }));
    }
  }
}
/* Near AC = BC, where the applet switches which of AC, BC it uses. */
for (const d of [-0.02, -0.005, 0, 0.005, 0.02]) {
  const A = at(70, 130), B = at(290, 130), mid = at(180, 130);
  configs.push(C.start({ points: {
    A, B, C: at(mid.x + d * 220, mid.y - 100),
  } }));
}

check("there are 204 configurations", configs.length === 204, `got ${configs.length}`);
for (const [i, s] of configs.entries()) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const tag = `config ${i}`;
  check(`${tag}: the picture exists`, Boolean(m));
  if (!m) continue;
  check(`${tag}: P is the midpoint of arc ACB`, cl.arcMidpoint);
  check(`${tag}: M is on the long side`, cl.mOnSegment);
  check(`${tag}: PM is perpendicular to the long side`, cl.perpendicular);
  check(`${tag}: CF is the short side past C`, cl.extension);
  check(`${tag}: P is the centre of circle ABF`, cl.pCentre);
  check(`${tag}: M bisects KF`, cl.mBisects);
  check(`${tag}: AM = MC + BC (or the mirror)`, cl.brokenChord);
  check(`${tag}: angle APB = 2 angle AFB`, cl.angleDouble);
}

/* Two exact configurations, and the shape of the theorem. */
{
  const start = C.measurements(C.start());
  check("at the start AC really is the longer side", start.AC > start.BC);
  check("the start's long part equals the broken remainder",
    close(start.AM, start.MC + start.BC, 1e-9));
  const mirror = C.measurements(C.start({
    points: { A: C.start().B, B: C.start().A, C: C.start().C },
  }));
  check("swapping A and B keeps the broken-chord equality",
    close(mirror.AM, mirror.MC + mirror.shortSide, 1e-9));
  check("swapping A and B makes BC the long side", mirror.BC >= mirror.AC);
  const sides = C.measurements(C.start({ points: {
    A: at(60, 130), B: at(300, 130), C: at(180, 30),
  } }));
  check("an isosceles triangle still satisfies the claim",
    close(sides.AM, sides.MC + sides.shortSide, 1e-9));
}

/* ----------------- 3. the applet's own computation, transcribed from bytecode */

/* GeoSDoub.FindOrientation, literal bytecode expression. */
function jOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

/* GeoSDoub.Intersect(P1,P2,P3,P4); |det| < 1 gives no point in the applet. */
function jIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter: intersect the bisectors of AB and BC. */
function jCircumcentre(A, B, C) {
  const m1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const m2 = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
  const q1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
  const q2 = { x: m2.x + (C.y - B.y), y: m2.y - (C.x - B.x) };
  return jIntersect(m1, q1, m2, q2);
}

/* BrokenChordCanvas.GetCircle: mean of the three centre-to-vertex distances. */
function jCircle(A, B, C) {
  const c = jCircumcentre(A, B, C);
  if (!c) return null;
  return { c, r: (dist(c, A) + dist(c, B) + dist(c, C)) / 3 };
}

/* GeoSDoub.IntersectX / IntersectY, including the order of the two roots. */
function jIntersectX(l1, l2, cc) {
  const m = (l1.x - l2.x) / (l1.y - l2.y);
  const b = l2.x - m * l2.y;
  const a = 1 + m * m;
  const q = m * (b - cc.c.x) - cc.c.y;
  const d = cc.c.y * cc.c.y + (b - cc.c.x) * (b - cc.c.x) - cc.r * cc.r;
  const disc = q * q - a * d;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-q + s) / a, t2 = (-q - s) / a;
  return [{ x: m * t1 + b, y: t1 }, { x: m * t2 + b, y: t2 }];
}

function jIntersectY(l1, l2, cc) {
  const m = (l1.y - l2.y) / (l1.x - l2.x);
  const b = l2.y - m * l2.x;
  const a = 1 + m * m;
  const q = m * (b - cc.c.y) - cc.c.x;
  const d = cc.c.x * cc.c.x + (b - cc.c.y) * (b - cc.c.y) - cc.r * cc.r;
  const disc = q * q - a * d;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-q + s) / a, t2 = (-q - s) / a;
  return [{ x: t1, y: m * t1 + b }, { x: t2, y: m * t2 + b }];
}

/* GeoSDoub.Intersect(DoubLine, DoubCircle): X if |dy| > 1, else Y. */
function jLineCircle(l1, l2, cc) {
  if (Math.abs(l1.y - l2.y) > 1) return jIntersectX(l1, l2, cc);
  if (Math.abs(l1.x - l2.x) > 1) return jIntersectY(l1, l2, cc);
  return null;
}

/* BrokenChordCanvas.FindP: the intersection on the same side of AB as C. */
function jFindP(A, B, C, cc) {
  const u = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const v = { x: u.x + (B.y - A.y), y: u.y - (B.x - A.x) };
  const pts = jLineCircle(u, v, cc);
  if (!pts) return null;
  return jOrientation(pts[0], A, B) === jOrientation(C, A, B) ? pts[0] : pts[1];
}

/* GeoSDoub.NearestPoint(P,U,V): the SqDist < 0.1 early return is kept. */
function jNearest(P, U, V) {
  if ((U.x - P.x) ** 2 + (U.y - P.y) ** 2 < 0.1) return { x: P.x, y: P.y };
  const dx = V.x - U.x, dy = V.y - U.y;
  const t = ((P.x - U.x) * dx + (P.y - U.y) * dy) / (dx * dx + dy * dy);
  return { x: U.x + dx * t, y: U.y + dy * t };
}

/* BrokenChordCanvas.Compute, FindF and the two GetCircle calls. */
function jCompute(A, B, C) {
  if (dist(A, B) < 1) return null;
  const circle = jCircle(A, B, C);
  if (!circle) return null;
  const P = jFindP(A, B, C, circle);
  if (!P) return null;
  const AC = dist(A, C), BC = dist(B, C);
  let M, K, L;
  if (AC > BC) { M = jNearest(P, A, C); K = A; L = B; }
  else { M = jNearest(P, B, C); K = B; L = A; }
  const kc = dist(C, K);
  if (kc <= 1e-12) return null;
  const t = (dist(C, L) + kc) / kc;
  const F = { x: K.x + t * (C.x - K.x), y: K.y + t * (C.y - K.y) };
  const circleF = jCircle(A, B, F);
  if (!circleF) return null;
  return { circle, circleF, P, M, K, L, F, AC, BC };
}

for (const [i, s] of configs.entries()) {
  const m = C.measurements(s);
  const j = jCompute(s.A, s.B, s.C);
  const tag = `applet config ${i}`;
  check(`${tag}: the applet's computation succeeds`, Boolean(j));
  if (!m || !j) continue;
  check(`${tag}: circumcentre matches`, closePt(j.circle.c, m.circle.c, 1e-6));
  check(`${tag}: circumradius matches`, close(j.circle.r, m.circle.r, 1e-6));
  check(`${tag}: P matches`, closePt(j.P, m.P, 1e-5));
  check(`${tag}: M matches`, closePt(j.M, m.M, 1e-5));
  check(`${tag}: K and L match`, closePt(j.K, m.K, 1e-9) && closePt(j.L, m.L, 1e-9));
  check(`${tag}: F matches`, closePt(j.F, m.F, 1e-5));
  check(`${tag}: circle ABF matches`,
    closePt(j.circleF.c, m.circleF.c, 1e-5) && close(j.circleF.r, m.circleF.r, 1e-6));
  check(`${tag}: the applet's own broken-chord equality holds`,
    close(dist(j.K, j.M), dist(j.M, s.C) + dist(s.C, j.L), 1e-6));
}

/* A few fixed numbers from the start position, so a broken transcription
   cannot hide behind two implementations of the same formula. */
{
  const s = C.start();
  const j = jCompute(s.A, s.B, s.C);
  check("the start's P is on the upper arc, near (172, 43)", closePt(j.P, at(171.8, 43.4), 0.1));
  check("the start's F is beyond C, near (282, 37)", closePt(j.F, at(281.6, 36.6), 0.1));
  check("the start's short side is about 56", close(j.BC, 56.05, 0.01));
  check("the start's long part is about 102", close(dist(j.K, j.M), 101.9, 0.01));
  const u = { x: (s.A.x + s.B.x) / 2, y: (s.A.y + s.B.y) / 2 };
  const v = { x: u.x + (s.B.y - s.A.y), y: u.y - (s.B.x - s.A.x) };
  check("the applet's IntersectX root order is preserved on the start line",
    closePt(jIntersectX(u, v, j.circle)[1], j.P, 1e-6));
}

done("broken-chord");
