#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-1/bol-1-core.js.
 *
 *   node porting/check-bol-1.mjs
 *
 * Checked: the applet's own starting placement; C's projection onto the small
 * circle; Extend, GetParallelTo, the GeoSDoub line/circle intersections and
 * the dot-product rule that names E and F, all transcribed a second time from
 * the bytecode and compared with the core over hundreds of configurations.
 * Then the page's claim itself: for internally tangent circles A, D, F are
 * collinear (and so are A, C, E), with the proof's length equalities; for
 * externally tangent circles the applet's names pair A with C,F and D,E
 * instead; and when the centres are not on a line with A the claim does not
 * apply. Degenerate zero-radius circles are checked too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-1/bol-1-core.js", "Bol1Core");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const polar = (c, r, a) => P(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const TOL = 1e-6;

/* ---------------- the applet's computation, transcribed literally from javap */

/* BOL1Canvas.AdjustC: radius/distance factor, with the random branch fixed. */
function appletAdjustC(center, radius, p) {
  const dd = dist(center, p);
  if (dd < 0.1) return P(center.x + radius, center.y);
  const factor = radius / dd;
  return P(center.x + factor * (p.x - center.x), center.y + factor * (p.y - center.y));
}

/* BOL1Canvas.init on its 600x450 applet (WIDTH/HEIGHT params default to 400/300). */
function appletStart() {
  const w = 600, h = 450, gap = 20;
  const A = P(w / 2, gap);
  const O1 = P(w / 2, h / 2);
  const O2 = P(w / 2, h / 2 - 3 * gap);
  const r2 = dist(A, O2);
  return { A, O1, O2, C: appletAdjustC(O2, r2, P(0, h)) };
}

/* GeoSDoub.GetParallelTo(p, a, b) = p + 100*(a-b). */
function appletParallel(p, a, b) {
  return P(p.x + 100 * (a.x - b.x), p.y + 100 * (a.y - b.y));
}

/* GeoSDoub.IntersectX(DoubLine, DoubCircle), offsets 0..218 of javap. */
function appletIntersectX(p1, p2, centre, radius) {
  const m = (p1.x - p2.x) / (p1.y - p2.y);
  const b = p2.x - m * p2.y;
  const q = m * m + 1;
  const cc = m * (b - centre.x) - centre.y;
  const disc = cc * cc - q * (centre.y * centre.y + (b - centre.x) ** 2 - radius * radius);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-cc + root) / q, y2 = (-cc - root) / q;
  return [P(m * y1 + b, y1), P(m * y2 + b, y2)];
}

/* GeoSDoub.IntersectY(DoubLine, DoubCircle), the y = m*x + b quadratic. */
function appletIntersectY(p1, p2, centre, radius) {
  const m = (p1.y - p2.y) / (p1.x - p2.x);
  const b = p2.y - m * p2.x;
  const q = m * m + 1;
  const cc = m * (b - centre.y) - centre.x;
  const disc = cc * cc - q * (centre.x * centre.x + (b - centre.y) ** 2 - radius * radius);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-cc + root) / q, x2 = (-cc - root) / q;
  return [P(x1, m * x1 + b), P(x2, m * x2 + b)];
}

function appletIntersect(p1, p2, centre, radius) {
  // GetParallelTo puts the second line point ~100 diameters away. Rescale it
  // to a short direction vector first: that is the same line, and it stops the
  // applet's own quadratic from losing significant digits. Then run the
  // literal IntersectX / IntersectY from the bytecode, choosing the branch
  // with the larger coordinate difference (the better-conditioned one).
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const n = Math.hypot(dx, dy) || 1;
  const q = P(p1.x + (dx / n) * 10, p1.y + (dy / n) * 10);
  if (Math.abs(dx) >= Math.abs(dy)) return appletIntersectY(p1, q, centre, radius);
  return appletIntersectX(p1, q, centre, radius);
}

/* BOL1Canvas.Draw/GetSecondDiameter: D, then the parallel line, then E/F. */
function appletDiameters(s) {
  const r1 = dist(s.A, s.O1);
  const D = P(2 * s.O2.x - s.C.x, 2 * s.O2.y - s.C.y); // Extend(C, O2)
  const Q = appletParallel(s.O1, s.C, D); // GetParallelTo(O1, C, D)
  const hits = appletIntersect(s.O1, Q, s.O1, r1);
  if (!hits) return null;
  const side =
    (hits[0].x - s.O1.x) * (s.C.x - s.O2.x) +
    (hits[0].y - s.O1.y) * (s.C.y - s.O2.y);
  const [E, F] = side > 0 ? [hits[0], hits[1]] : [hits[1], hits[0]];
  return { C: s.C, D, E, F };
}

/* BOL1Canvas.ShowHint: through D parallel to A-O2, cut by line EF. */
function appletHint(s, dm) {
  const Q = appletParallel(dm.D, s.A, s.O2);
  return C.lineIntersection(dm.D, Q, dm.E, dm.F);
}

/* --------------------------------------------------- 1. start and the rules */

{
  const s = C.start();
  const a = appletStart();
  check("A is at (w/2, 20) as in BOL1Canvas.init", closePt(s.A, a.A, TOL));
  check("O1 is at (w/2, h/2) as in BOL1Canvas.init", closePt(s.O1, a.O1, TOL));
  check("O2 is at (w/2, h/2 - 60) as in BOL1Canvas.init", closePt(s.O2, a.O2, TOL));
  check("C is on the small circle, from AdjustC", closePt(s.C, a.C, TOL));
  check("the starting radii are 205 and 145", C.radii(s).r1 === 205 && C.radii(s).r2 === 145);
  check("an illustration has no result", C.result(s) === null);
  equal("start accepts an explicit position", C.start({ points: a }).C, a.C);

  const moved = C.withPoint(s, "A", P(10, 30));
  check("withPoint leaves the old position alone", s.A.x === 300 && s.O1.y === 225 && s.C.x === a.C.x);
  check("withPoint moves only the named handle", moved.A.x === 10 && moved.O1.x === s.O1.x);
  const r2 = C.radii(moved).r2;
  check("moving A reprojects C onto the new small circle",
    close(dist(moved.C, moved.O2), r2, TOL) &&
    closePt(moved.C, appletAdjustC(s.O2, r2, s.C), TOL));
  const turned = C.withPoint(s, "C", P(500, 100));
  check("moving C keeps it on the small circle",
    close(dist(turned.C, turned.O2), C.radii(s).r2, TOL));
  check("an unknown handle changes nothing", closePt(C.withPoint(s, "Z", P(1, 2)).C, s.C, TOL));
}

/* ------------------------------------ 2. internal tangency: the page's claim */

const rnd = rng(20261126);
let internal = 0;
for (let i = 0; i < 240; i++) {
  const A = P(50 + rnd() * 500, 30 + rnd() * 390);
  const r1 = 70 + rnd() * 200;
  const r2 = 10 + rnd() * (r1 - 15);
  const w = rnd() * 2 * Math.PI;
  const v = rnd() * 2 * Math.PI;
  const s = {
    width: 600, height: 450,
    A, O1: polar(A, r1, w), O2: polar(A, r2, w), C: polar(polar(A, r2, w), r2, v),
  };
  const cl = C.claims(s);
  const dm = C.diameters(s);
  const hit = appletDiameters(s);
  internal++;
  check(`internal ${i}: the circles are tangent`, cl.tangent && C.touchKind(s) === "in");
  check(`internal ${i}: CD and EF are parallel diameters`, cl.diameters && cl.parallel);
  check(`internal ${i}: ADF is a straight line`, cl.adf &&
    C.collinear(A, dm.D, dm.F, 1e-7));
  check(`internal ${i}: ACE is a straight line`, cl.ace &&
    C.collinear(A, dm.C, dm.E, 1e-7));
  check(`internal ${i}: the proof's four lengths match`, cl.hintLengths);
  check(`internal ${i}: the core's E/F match the applet's E/F`,
    closePt(dm.E, hit.E, TOL) && closePt(dm.F, hit.F, TOL) && closePt(dm.D, hit.D, TOL));
  check(`internal ${i}: E is the end in C's direction from O2`,
    (dm.E.x - s.O1.x) * (s.C.x - s.O2.x) + (dm.E.y - s.O1.y) * (s.C.y - s.O2.y) > 0);
  if (i < 60) { // the hint's own intersection, checked against the bytecode
    const h = C.hint(s, dm), ha = appletHint(s, hit);
    check(`internal ${i}: H matches ShowHint`, closePt(h, ha, TOL));
  }
}
check("240 internal configurations were exercised", internal === 240);

/* --------------------------------- 3. external tangency: the other pairing */

const rnd2 = rng(703);
for (let i = 0; i < 200; i++) {
  const A = P(60 + rnd2() * 480, 40 + rnd2() * 370);
  const r1 = 70 + rnd2() * 190;
  const r2 = 20 + rnd2() * 190;
  const w = rnd2() * 2 * Math.PI;
  const v = w + 0.35 + rnd2() * (2 * Math.PI - 0.7); // never parallel to w
  const O2 = polar(A, -r2, w); // opposite side of A from O1
  const s = {
    width: 600, height: 450, A, O1: polar(A, r1, w), O2, C: polar(O2, r2, v),
  };
  const cl = C.claims(s);
  const dm = C.diameters(s);
  const hit = appletDiameters(s);
  check(`external ${i}: the circles touch outside`, cl.tangent && C.touchKind(s) === "out");
  check(`external ${i}: CD and EF are parallel diameters`, cl.diameters && cl.parallel);
  check(`external ${i}: A, C, F and A, D, E are straight`, cl.externalPairs &&
    C.collinear(A, dm.C, dm.F, 1e-7) && C.collinear(A, dm.D, dm.E, 1e-7));
  check(`external ${i}: the applet's ADF is not the collinear triple`,
    !C.collinear(A, dm.D, dm.F, 1e-7));
  check(`external ${i}: the core's E/F match the applet's E/F`,
    closePt(dm.E, hit.E, TOL) && closePt(dm.F, hit.F, TOL));
  check(`external ${i}: the internal-only claim is not reported`, !cl.adf && !cl.ace);
}

/* ------------------------------- 4. non-tangent circles: the claim does not apply */

const rnd3 = rng(9911);
for (let i = 0; i < 180; i++) {
  const A = P(40 + rnd3() * 520, 30 + rnd3() * 390);
  const r1 = 60 + rnd3() * 180;
  const r2 = 20 + rnd3() * 140;
  const w = rnd3() * 2 * Math.PI;
  const w2 = w + 0.4 + rnd3() * (Math.PI - 0.8); // centres not on one line
  const O2 = polar(A, r2, w2);
  const s = {
    width: 600, height: 450, A, O1: polar(A, r1, w), O2, C: polar(O2, r2, rnd3() * 2 * Math.PI),
  };
  const cl = C.claims(s);
  const hit = appletDiameters(s);
  const dm = C.diameters(s);
  if (!hit) console.error("DEBUG null", i, JSON.stringify(s));
  check(`general ${i}: not tangent`, !cl.tangent && C.touchKind(s) === "none");
  check(`general ${i}: no straight-line claim is made`, !cl.adf && !cl.ace && !cl.externalPairs);
  check(`general ${i}: parallel diameters still hold`, cl.diameters && cl.parallel);
  check(`general ${i}: E/F match the applet's own intersection`,
    closePt(dm.E, hit.E, TOL) && closePt(dm.F, hit.F, TOL) && closePt(dm.D, hit.D, TOL));
}

/* ------------------------------------------------------------ 5. degenerate */

{
  const A = P(200, 100);
  const s = { width: 600, height: 450, A, O1: P(300, 100), O2: A, C: A };
  check("a zero-radius circle has no diameters", C.diameters(s) === null);
  check("no claim is made for a zero-radius circle", !C.claims(s).adf && !C.claims(s).tangent);
  check("the two circles of equal radius still touch externally", (() => {
    const t = { width: 600, height: 450, A, O1: P(320, 100), O2: P(180, 100), C: P(180, 80) };
    return C.touchKind(t) === "out" && C.claims(t).externalPairs;
  })());
}

done("bol-1");
