#!/usr/bin/env node
"use strict";

/*
 * Logic test for incircles-in-quadri/incircles-in-quadri-core.js.
 *
 *   node porting/check-incircles-in-quadri.mjs
 *
 * What the cut-the-knot page claims, and what is tested here:
 *
 *   1. The two incircles in the AC pair touch iff the two in the BD pair do.
 *   2. Both touch iff AB + CD = BC + AD (an inscriptible quadrilateral).
 *   3. Adjacent incircles can touch only where their feet on the shared side
 *      coincide, and the two feet are |AB + CD - BC - AD| / 2 apart.
 *   4. If the incircle of ABC touches BC at X, the incircles of ABX and ACX
 *      are tangent on AX.
 *
 * The applet's own arithmetic is transcribed a second time straight from the
 * bytecode of GeoSDoub.FindIncenter / NearestPoint / ComputeAngle /
 * FindOrientation / Rotate / Intersect and of IncirclesInQuadriCanvas.DrawCircle
 * / CheckTouch / Reset.  The core is compared with that transcription on the
 * start position, fixed shapes, hundreds of tangential shapes and thousands
 * of random quadrilaterals and triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("incircles-in-quadri/incircles-in-quadri-core.js", "IncirclesInQuadriCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));
const cross2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function convex(a, b, c, d) {
  const q = [a, b, c, d];
  const s = q.map((p, i) => cross2(p, q[(i + 1) % 4], q[(i + 2) % 4]));
  return (s.every((v) => v > 0) || s.every((v) => v < 0))
    && Math.min(...s.map(Math.abs)) > 100;
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

const apSq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/* GeoSDoub.ComputeAngle: acos(((PQ² + PR² - QR²)/2)/PQ/PR), no clamping. */
function apAngle(p, q, r) {
  const cos = ((apSq(p, q) + apSq(p, r) - apSq(q, r)) / 2) / Math.sqrt(apSq(p, q)) / Math.sqrt(apSq(p, r));
  return Math.acos(cos);
}

/* GeoSDoub.FindOrientation: > 0 gives +1, otherwise -1. */
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate q about p by angle, with the applet's sign. */
function apRotate(p, q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(p.x + cs * (q.x - p.x) - orientation * sn * (q.y - p.y),
    p.y + orientation * sn * (q.x - p.x) + cs * (q.y - p.y));
}

/* GeoSDoub.Intersect: two ax+by+c lines; |det| < 1 returns NaN,NaN. */
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindIncenter: intersect the bisectors at the first two vertices. */
function apIncenter(p, q, r) {
  const orient = apOrientation(p, q, r);
  const b1 = apRotate(p, q, apAngle(p, q, r) / 2, orient);
  const b2 = apRotate(q, r, apAngle(q, r, p) / 2, orient);
  return apIntersect(p, b1, q, b2);
}

/* GeoSDoub.NearestPoint(p,a,b), including its SqDist(a,p) < 0.1 short cut. */
function apFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (apSq(a, p) < 0.1) return P(p.x, p.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/* IncirclesInQuadriCanvas.DrawCircle(p,q,r): three feet, mean radius, and the
 * returned foot on side r-p, which Draw() tests with CheckTouch. */
function apDrawCircle(p, q, r) {
  const center = apIncenter(p, q, r);
  const f1 = apFoot(center, q, r);   // L6
  const f2 = apFoot(center, r, p);   // L7, the returned touch point
  const f3 = apFoot(center, p, q);   // L8
  const radius = (dist(center, f1) + dist(center, f2) + dist(center, f3)) / 3;
  return { center, radius, touch: f2 };
}

/* CheckTouch: GeoSDoub.Dist < 3.0, strictly (dcmpg / ifge). */
function apCheckTouch(p, q) {
  return dist(p, q) < 3.0;
}

/* IncirclesInQuadriCanvas.Reset() on a W by H canvas: locals 4=40, 5=60. */
function apReset(w, h) {
  const c4 = 40, c5 = 60;
  const a = P(w / 2 - 4 * c4, h / 2 + c5);
  const b = P(w / 2 + 2 * c4, h / 2 + 2 * c4 + c5);
  const c = P(w / 2, h / 2 - 2 * c4 + c5);
  const d = P((a.x + c.x) / 2 - 40, (a.y + c.y) / 2 - 20);
  return [a, b, c, d];
}

/* An independent check of the page's formula, with equal tangent lengths —
 * in triangle ABC the incircle touches AC at (AB + AC - BC)/2 from A. */
function tangentFeet(a, b, c, d) {
  const ac1 = (dist(a, b) + dist(a, c) - dist(b, c)) / 2;
  const ac2 = (dist(a, d) + dist(a, c) - dist(c, d)) / 2;
  const bd1 = (dist(b, c) + dist(b, d) - dist(c, d)) / 2;
  const bd2 = (dist(b, a) + dist(b, d) - dist(a, d)) / 2;
  return { ac: Math.abs(ac1 - ac2), bd: Math.abs(bd1 - bd2) };
}

/* A tangential quadrilateral from four tangents to a circle, independently
 * of the core's makeTangential. */
function tangential(angles, cx, cy, r) {
  const corners = [];
  for (let i = 0; i < 4; i++) {
    const t1 = angles[i], t2 = angles[(i + 1) % 4];
    const a1 = Math.cos(t1), b1 = Math.sin(t1);
    const a2 = Math.cos(t2), b2 = Math.sin(t2);
    const det = a1 * b2 - a2 * b1;
    corners.push(P(cx + r * (b2 - b1) / det, cy + r * (a1 - a2) / det));
  }
  return corners;
}

/* ------------------------------------------------ 1. start position and rules */

{
  const s = C.start({});
  const reset = apReset(460, 400);
  equal("Reset puts A at the applet's (70,260)", s.A, reset[0]);
  equal("Reset puts B at the applet's (310,340)", s.B, reset[1]);
  equal("Reset puts C at the applet's (230,180)", s.C, reset[2]);
  equal("Reset puts D at the applet's (110,200)", s.D, reset[3]);
  check("the AC radio button starts selected", s.options.diagonal === "ac");
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start quadrilateral has a construction", !!C.geometry(s));
  check("the start quadrilateral is convex", convex(s.A, s.B, s.C, s.D));
  check("the start quadrilateral is not tangential",
    !C.geometry(s).claims.pitot && !C.geometry(s).ac.touch && !C.geometry(s).bd.touch);
}

{
  const s = C.start();
  const moved = C.move(s, "D", P(9999, -9999));
  check("moving a corner leaves the old position alone", s.D.x === 110 && moved.D.x === C.VIEW.width - C.PAD);
  check("moving a corner marks it explored", moved.explored && !s.explored);
  check("a corner is clamped in y too", moved.D.y === C.PAD);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const switched = C.setDiagonal(s, "bd");
  check("BD can be selected and marks it explored", switched.options.diagonal === "bd" && switched.explored && !s.explored);
  check("an unknown diagonal is ignored", C.setDiagonal(s, "xy") === s);
  const r = C.reset(switched);
  check("Reset restores the four corners", r.A.x === 70 && r.C.y === 180 && r.D.y === 200);
  check("Reset keeps the selected diagonal", r.options.diagonal === "bd" && r.explored);
  check("the status describes the selected pair and both side sums",
    /circles on AC/.test(C.describe(s))
    && /pair on BD/.test(C.describe(s))
    && /AB \+ CD/.test(C.describe(s))
    && /BD/.test(C.describe(C.setDiagonal(s, "bd"))));
  check("the saved position uses board units and both touch flags",
    C.position(s).A.x === 70 && C.position(s).diagonal === "ac"
    && C.position(s).touched.ac === false && C.position(s).touched.bd === false);
}

/* ------------------------------------- 2. the applet's threshold and Reset */

{
  check("the applet's touch threshold is 3 units", C.TOUCH === 3);
  check("a gap just below 3 counts as touching", apCheckTouch(P(0, 0), P(2.999, 0)));
  check("a gap of exactly 3 does not count", !apCheckTouch(P(0, 0), P(3, 0)));
  check("a gap above 3 does not count", !apCheckTouch(P(0, 0), P(3.1, 0)));
  const start = C.start();
  const apAC1 = apDrawCircle(start.A, start.B, start.C);
  const apAC2 = apDrawCircle(start.A, start.D, start.C);
  const apBD1 = apDrawCircle(start.B, start.C, start.D);
  const apBD2 = apDrawCircle(start.B, start.A, start.D);
  check("the applet's start AC pair does not touch",
    !apCheckTouch(apAC1.touch, apAC2.touch));
  check("the applet's start BD pair does not touch",
    !apCheckTouch(apBD1.touch, apBD2.touch));
  check("both applet tests agree on the start shape (page's iff)",
    apCheckTouch(apAC1.touch, apAC2.touch) === apCheckTouch(apBD1.touch, apBD2.touch));
}

/* ------------------------------- 3. fixed, tangential and random quadrilaterals */

const square = [P(80, 60), P(380, 60), P(380, 360), P(80, 360)];
const rectangle = [P(60, 90), P(400, 90), P(400, 300), P(60, 300)];
const tilted = [P(70, 260), P(300, 350), P(400, 120), P(150, 60)];
const startQ = apReset(460, 400);
const tangentAngles = [0.22, 1.66, 3.06, 4.72];
const tangentQ = tangential(tangentAngles, 230, 200, 92);
const tangentialExamples = [
  ["four tangents", tangentQ],
  ["four tangents, rotated", tangential([0.6, 2.1, 3.6, 5.1], 230, 200, 88)],
  ["four tangents, uneven gaps", tangential([0.15, 1.3, 2.6, 5.0], 230, 200, 80)],
];
const fixed = [
  ["the applet's start", startQ, false],
  ["a square", square, true],
  ["a tilted quadrilateral", tilted, false],
  ...tangentialExamples.map(([name, q]) => [name, q, true]),
  ["a non-square rectangle", rectangle, false],
];

function checkQuad(name, q, wantTouch) {
  const [a, b, c, d] = q;
  const g = C.compute(a, b, c, d);
  const tol = 1e-6 * scaleOf(a, b, c, d);
  check(`${name}: the core builds both pairs of incircles`, !!g);
  if (!g) return;
  const tf = tangentFeet(a, b, c, d);
  check(`${name}: AC feet are |AB+CD-BC-AD|/2 apart`, close(g.ac.distance, tf.ac, tol),
    `core ${g.ac.distance}, formula ${tf.ac}`);
  check(`${name}: BD feet are |AB+CD-BC-AD|/2 apart`, close(g.bd.distance, tf.bd, tol),
    `core ${g.bd.distance}, formula ${tf.bd}`);
  check(`${name}: the two pairs agree on touching`, g.claims.equivalent);
  check(`${name}: exact coincidence in both pairs is Pitot's equality`,
    g.claims.coincideEquivalent && g.claims.pitot === (Math.abs(g.pitotGap) <= g.tol));
  check(`${name}: the applet's 3-unit test agrees with the formula`,
    g.claims.touchMatchesGap && g.ac.touch === (tf.ac < 3) && g.bd.touch === (tf.bd < 3));
  check(`${name}: ${wantTouch ? "touches" : "does not touch"} as expected`,
    g.ac.touch === wantTouch && g.bd.touch === wantTouch,
    `ac ${g.ac.distance}, bd ${g.bd.distance}, pitotGap ${g.pitotGap}`);
}

for (const [name, q, wantTouch] of fixed) checkQuad(name, q, wantTouch);

{
  const rand = rng(9241);
  let tested = 0, failures = 0;
  for (let trial = 0; trial < 5000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(30 + rand() * 400, 30 + rand() * 340));
    if (!convex(...q)) continue;
    const g = C.compute(...q);
    if (!g) { failures++; continue; }
    const tf = tangentFeet(...q);
    const tol = 1e-6 * scaleOf(...q);
    if (!(close(g.ac.distance, tf.ac, tol) && close(g.bd.distance, tf.bd, tol)
      && g.claims.equivalent && g.claims.coincideEquivalent
      && g.claims.touchMatchesGap && g.claims.feetHalfGap
      && g.ac.touch === (tf.ac < 3) && g.bd.touch === (tf.bd < 3))) {
      failures++;
      check(`random convex ${trial}: the page's claims hold`, false,
        `ac ${g.ac.distance}/${tf.ac}, bd ${g.bd.distance}/${tf.bd}, gap ${g.pitotGap}`);
      continue;
    }
    tested++;
  }
  check(`all page claims hold on ${tested} random convex quadrilaterals`,
    tested > 800 && failures === 0, `tested ${tested}, failures ${failures}`);
}

/* ------------------------- 4. tangential shapes and their common incircle */

{
  const [a, b, c, d] = tangentQ;
  const center = P(230, 200), r = 92;
  const g = C.compute(a, b, c, d);
  const tol = 1e-7 * scaleOf(a, b, c, d);
  const sides = [[a, b], [b, c], [c, d], [d, a]];
  const errors = sides.map(([p, q]) => Math.abs(distToLine(center, p, q) - r));
  check("the four sides of the example are tangent to one circle",
    Math.max(...errors) < tol, `errors ${errors.join(", ")}`);
  check("Pitot's equality holds on the tangential example",
    Math.abs(g.pitotGap) < tol, `gap ${g.pitotGap}`);
  check("both pairs of incircles touch on the tangential example",
    g.ac.touch && g.bd.touch);
  const made = C.makeTangential(C.start());
  check("the page's convenience button makes the same shape",
    closePoint(made.A, a, 1e-9) && closePoint(made.B, b, 1e-9)
    && closePoint(made.C, c, 1e-9) && closePoint(made.D, d, 1e-9));
  check("the convenience button marks the diagram explored", made.explored);
  check("the convenience button reports both pairs touching",
    C.position(made).touched.both);
  const rand = rng(777);
  let madeTested = 0, madeFailures = 0;
  for (let i = 0; i < 300; i++) {
    const t = [rand() * 0.4, 0.9 + rand() * 0.9, 2.4 + rand() * 0.9, 4.2 + rand() * 1.3];
    t.sort((x, y) => x - y);
    const q = tangential(t, 230 + rand() * 40 - 20, 200 + rand() * 40 - 20, 70 + rand() * 30);
    if (!q.every((p) => p.x >= C.PAD && p.x <= C.VIEW.width - C.PAD
      && p.y >= C.PAD && p.y <= C.VIEW.height - C.PAD)) continue;
    const gg = C.compute(...q);
    if (!gg || !gg.ac.touch || !gg.bd.touch || Math.abs(gg.pitotGap) > 1e-6) {
      madeFailures++;
      continue;
    }
    madeTested++;
  }
  check(`both pairs touch on ${madeTested} tangential quadrilaterals`,
    madeTested > 200 && madeFailures === 0, `tested ${madeTested}, failures ${madeFailures}`);
}

function distToLine(p, a, b) {
  return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / dist(a, b);
}

/* ------------------------------ 5. the degenerate triangle theorem on the page */

{
  const rand = rng(3131);
  let tested = 0, failures = 0;
  for (let trial = 0; trial < 2000; trial++) {
    const a = P(20 + rand() * 420, 20 + rand() * 360);
    const b = P(20 + rand() * 420, 20 + rand() * 360);
    const c = P(20 + rand() * 420, 20 + rand() * 360);
    if (Math.abs(cross2(a, b, c)) < 2000) continue;
    const inA = C.incenter(a, b, c);
    if (!inA) { failures++; continue; }
    const x = C.foot(inA, b, c); // incircle of ABC touches BC at X
    const expectedBX = (dist(a, b) + dist(b, c) - dist(a, c)) / 2;
    const circle1 = C.incircle(a, b, x, a, x);
    const circle2 = C.incircle(a, c, x, a, x);
    if (!circle1 || !circle2) { failures++; continue; }
    const gap = dist(circle1.touch, circle2.touch);
    const tol = 1e-6 * Math.max(1, dist(a, b), dist(a, c), dist(b, c));
    if (!(Math.abs(dist(b, x) - expectedBX) < tol && gap < tol)) {
      failures++;
      check(`triangle ${trial}: ABX and ACX touch on AX`, false,
        `BX ${dist(b, x)} vs ${expectedBX}, foot gap ${gap}`);
      continue;
    }
    tested++;
  }
  check(`the triangle theorem holds on ${tested} triangles`,
    tested > 1500 && failures === 0, `tested ${tested}, failures ${failures}`);
}

/* ------------------ 6. second transcription: core against the applet's code */

{
  const rand = rng(58013);
  let compared = 0, mismatches = 0;
  const compare = (label, q) => {
    const [a, b, c, d] = q;
    const gg = C.compute(a, b, c, d);
    if (!gg) return;
    const tol = 1e-5 * scaleOf(a, b, c, d);
    const cases = [
      ["ABC", gg.ac.first, apDrawCircle(a, b, c)],
      ["ADC", gg.ac.second, apDrawCircle(a, d, c)],
      ["BCD", gg.bd.first, apDrawCircle(b, c, d)],
      ["BAD", gg.bd.second, apDrawCircle(b, a, d)],
    ];
    for (const [name, mine, ap] of cases) {
      if (!(closePoint(mine.center, ap.center, tol)
        && close(mine.radius, ap.radius, tol)
        && closePoint(mine.touch, ap.touch, tol))) {
        mismatches++;
        check(`${label}: ${name} matches applet DrawCircle`, false,
          `centre ${JSON.stringify(mine.center)}/${JSON.stringify(ap.center)}, `
          + `r ${mine.radius}/${ap.radius}, foot ${JSON.stringify(mine.touch)}/${JSON.stringify(ap.touch)}`);
      }
    }
    if (gg.ac.touch !== apCheckTouch(apDrawCircle(a, b, c).touch, apDrawCircle(a, d, c).touch)
      || gg.bd.touch !== apCheckTouch(apDrawCircle(b, c, d).touch, apDrawCircle(b, a, d).touch)) {
      mismatches++;
      check(`${label}: the core's touch flags match CheckTouch`, false);
    }
    compared++;
  };
  for (const [name, q] of fixed) compare(name, q);
  for (let trial = 0; trial < 2500; trial++) {
    const q = [0, 1, 2, 3].map(() => P(25 + rand() * 410, 25 + rand() * 350));
    compare(`random ${trial}`, q);
  }
  check(`core matches the applet's own DrawCircle on ${compared} quadrilaterals`,
    compared > 2000 && mismatches === 0, `compared ${compared}, mismatches ${mismatches}`);

  // The incenter found by two angle bisectors is the barycentric incenter.
  const rand2 = rng(4407);
  let tris = 0;
  for (let trial = 0; trial < 1500; trial++) {
    const p = [0, 1, 2].map(() => P(20 + rand2() * 420, 20 + rand2() * 360));
    if (Math.abs(cross2(p[0], p[1], p[2])) < 1000) continue;
    const mine = C.incenter(...p);
    const ap = apIncenter(...p);
    if (mine && closePoint(mine, ap, 1e-5 * Math.max(1, dist(...p.slice(0, 2)), dist(p[0], p[2]), dist(p[1], p[2])))) tris++;
  }
  check(`angle-bisector incenter agrees on ${tris} triangles`, tris > 1200);
}

/* --------------------------------------------------- 7. degenerate inputs */

{
  check("repeated corners give no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  check("collinear corners give no construction",
    C.compute(P(10, 10), P(50, 10), P(90, 10), P(130, 10)) === null);
  check("a non-finite corner gives no construction",
    C.compute(P(NaN, 10), P(50, 10), P(90, 20), P(40, 80)) === null);
  check("a degenerate position has a helpful status",
    /Move a corner/.test(C.describe(C.move(C.start(), "A", C.start().B))));
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("incircles-in-quadri");
