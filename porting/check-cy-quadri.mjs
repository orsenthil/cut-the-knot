#!/usr/bin/env node
"use strict";

/*
 * Logic test for cy-quadri/cy-quadri-core.js.
 *
 *   node porting/check-cy-quadri.mjs
 *
 * The old explanation claims that the four intersections of neighbouring
 * angle bisectors of any quadrilateral lie on one circle, and that the same
 * holds for the external bisectors; it also says opposite angles of the new
 * quadrilateral sum to 180 degrees.  This test checks both modes on the
 * applet's own Reset position, on fixed shapes and on thousands of random
 * convex and non-convex quadrilaterals.  Every answer is compared against a
 * second transcription of CyQuadriCanvas.FindAngleBisector/Perp/DrawBisectors
 * and GeoSDoub.ComputeAngle/FindOrientation/Rotate/Intersect/FindCircumcenter
 * straight from the class files, over the same configurations.
 *
 * The Wayback Machine shows the Java applet on the article's page in 2007;
 * the live page now has a GeoGebra picture instead, so the applet's bytecode
 * is the authority for the construction and the linked explanation for the
 * claim.  Unlike the sibling CyclicQuadrilateral applet, nothing here needs
 * the starting quadrilateral to be cyclic.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cy-quadri/cy-quadri-core.js", "CyQuadriCore");
const P = (x, y) => ({ x, y });
const rand = rng(20261127);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a));

const convex = (a, b, c, d) => {
  const q = [a, b, c, d];
  const s = q.map((p, i) => C.cross(
    C.sub(q[(i + 1) % 4], p), C.sub(q[(i + 2) % 4], q[(i + 1) % 4]),
  ));
  return (s.every((v) => v > 0) || s.every((v) => v < 0)) && Math.min(...s.map(Math.abs)) > 100;
};

/* ------------------- a second, literal transcription of the Java bytecode */

// GeoSDoub.ComputeAngle: raw acos of the cosine rule, no clamping.
function apAngle(p, q, r) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  const cos = (sq(p, q) + sq(p, r) - sq(q, r)) / (2 * Math.sqrt(sq(p, q)) * Math.sqrt(sq(p, r)));
  return Math.acos(cos);
}

// GeoSDoub.FindOrientation: > 0 gives +1, everything else (including 0) -1.
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

// GeoSDoub.Rotate: the sign multiplies the sine terms in both coordinates.
function apRotate(p, q, a, o) {
  const c = Math.cos(a), s = Math.sin(a);
  return P(p.x + c * (q.x - p.x) - o * s * (q.y - p.y),
    p.y + o * s * (q.x - p.x) + c * (q.y - p.y));
}

// CyQuadriCanvas.FindAngleBisector.
function apBisector(p, q, r) {
  return apRotate(p, q, apAngle(p, q, r) / 2, apOrientation(p, q, r));
}

// CyQuadriCanvas.Perp, used for the external-bisector radio choice.
function apPerp(p, q) {
  return P(p.x + q.y - p.y, p.y - q.x + p.x);
}

// GeoSDoub.Intersect: |det| < 1 produces a NaN point in Java, null here.
function apIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  const x = (b1 * c2 - b2 * c1) / det, y = (c1 * a2 - c2 * a1) / det;
  return Number.isFinite(x) && Number.isFinite(y) ? P(x, y) : null;
}

// GeoSDoub.FindCircumcenter plus the canvas's mean-of-three radius.
function apCircle(p, q, r) {
  const m12 = P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const m23 = P((q.x + r.x) / 2, (q.y + r.y) / 2);
  const o = apIntersect(
    m12, P(m12.x + q.y - p.y, m12.y - q.x + p.x),
    m23, P(m23.x + r.y - q.y, m23.y - r.x + q.x),
  );
  if (!o) return null;
  return { c: o, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
}

// CyQuadriCanvas.DrawBisectors, with its four ray points, four crossings and
// the circle through the first three crossings (the fourth is not used).
function apDraw(A, B, Cc, D, internal) {
  let sA = apBisector(A, D, B), sB = apBisector(B, A, Cc);
  let sC = apBisector(Cc, B, D), sD = apBisector(D, Cc, A);
  if (![sA, sB, sC, sD].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  if (!internal) {
    sA = apPerp(A, sA); sB = apPerp(B, sB);
    sC = apPerp(Cc, sC); sD = apPerp(D, sD);
  }
  const AB = apIntersect(A, sA, B, sB);
  const BC = apIntersect(B, sB, Cc, sC);
  const CD = apIntersect(Cc, sC, D, sD);
  const DA = apIntersect(D, sD, A, sA);
  if (![AB, BC, CD, DA].every(Boolean)) return null;
  const circle = apCircle(AB, BC, CD);
  if (!circle || !Number.isFinite(circle.r) || circle.r < 1e-9) return null;
  return { rays: { A: sA, B: sB, C: sC, D: sD }, crossings: { AB, BC, CD, DA }, circle };
}

// A convex quadrilateral around a chosen centre, with a fixed random seed.
function convexQuad(center, radius, angles) {
  return angles.map((t) => P(center.x + radius * Math.cos(t), center.y + radius * Math.sin(t)));
}

/* ------------------------------------------- 1. Reset, options and dragging */

{
  const s = C.start();
  equal("Reset puts A at (120,160) on the applet's 400x300 canvas", s.A, P(120, 160));
  equal("Reset puts B at (280,240)", s.B, P(280, 240));
  equal("Reset puts C at (320,80)", s.C, P(320, 80));
  equal("Reset puts D at (180,80): the midpoint of AC shifted by (-40,-40)", s.D, P(180, 80));
  check("Internal bisectors start checked", s.options.internal === true);
  check("External bisectors start unchecked", s.options.internal !== false);
  check("Show angles starts unchecked", s.options.angles === false);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start quadrilateral is convex", convex(s.A, s.B, s.C, s.D));
  check("the start position has a valid construction", !!C.geometry(s));
  check("the status starts by naming the mode", /^Internal bisectors/.test(C.describe(s)));
}

{
  const s = C.start();
  const next = C.move(s, "B", P(9999, -9999));
  check("dragging is clamped into the board with room for the handle",
    next.B.x === C.VIEW.width - C.PAD && next.B.y === C.PAD);
  check("dragging leaves the old position alone", s.B.x === 280 && s.B.y === 240);
  check("dragging marks the illustration explored", next.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const ext = C.setOption(s, "external", true);
  check("the External radio switches Internal off", ext.options.internal === false);
  const back = C.setOption(ext, "internal", true);
  check("the Internal radio switches it back on", back.options.internal === true);
  const angles = C.setOption(s, "angles", true);
  check("Show angles is independent of the radio pair",
    angles.options.angles && angles.options.internal);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(angles);
  equal("Reset restores all four corners", [r.A, r.B, r.C, r.D],
    [P(120, 160), P(280, 240), P(320, 80), P(180, 80)]);
  check("Reset keeps the option boxes", r.options.angles && r.options.internal);
  check("Reset keeps the explored flag", r.explored);
  check("the status describes the external mode", /External bisectors/.test(C.describe(ext)));
}

/* ---------------------- 2. core against the applet's own method, both modes */

const square = [P(80, 80), P(320, 80), P(320, 320), P(80, 320)];
const rectangle = [P(60, 100), P(340, 100), P(340, 260), P(60, 260)];
const tilted = [P(70, 180), P(250, 260), P(340, 110), P(140, 60)];
const startQ = [P(120, 160), P(280, 240), P(320, 80), P(180, 80)];
const fixed = [
  ["Reset position", startQ], ["square", square], ["rectangle", rectangle],
  ["tilted convex", tilted],
  ["cyclic", convexQuad(P(200, 150), 110, [0.1, 1.3, 2.9, 5.0])],
];

const configs = fixed.slice();
for (let i = 0; i < 400; i++) {
  const t = [rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI]
    .sort((a, b) => a - b);
  configs.push([`random convex ${i}`, convexQuad(P(200, 150), 70 + rand() * 130, t)]);
}
for (let i = 0; i < 200; i++) {
  const q = [P(20 + rand() * 360, 20 + rand() * 260), P(20 + rand() * 360, 20 + rand() * 260),
    P(20 + rand() * 360, 20 + rand() * 260), P(20 + rand() * 360, 20 + rand() * 260)];
  configs.push([`arbitrary ${i}`, q]);
}

let compared = 0, worstRay = 0, worstCross = 0, worstRadius = 0;
for (const [name, q] of configs) {
  const [a, b, c, d] = q;
  for (const internal of [true, false]) {
    const mode = internal ? "internal" : "external";
    const g = C.compute(a, b, c, d, internal);
    const ap = apDraw(a, b, c, d, internal);
    check(`${name}/${mode}: both methods agree on whether a drawing exists`, !!g === !!ap);
    if (!g || !ap) continue;
    compared++;
    for (const key of ["A", "B", "C", "D"]) {
      worstRay = Math.max(worstRay, dist(g.rays[key], ap.rays[key]));
      check(`${name}/${mode}: ray ${key} matches the applet`, closePoint(g.rays[key], ap.rays[key], 1e-9));
    }
    for (const key of ["AB", "BC", "CD", "DA"]) {
      worstCross = Math.max(worstCross, dist(g.crossings[key], ap.crossings[key]));
      check(`${name}/${mode}: crossing ${key} matches the applet`,
        closePoint(g.crossings[key], ap.crossings[key], 1e-7));
    }
    worstRadius = Math.max(worstRadius,
      dist(g.circle.c, ap.circle.c), Math.abs(g.circle.r - ap.circle.r));
    check(`${name}/${mode}: circle matches the applet`,
      closePoint(g.circle.c, ap.circle.c, 1e-7) && close(g.circle.r, ap.circle.r, 1e-7));
    for (const key of ["A", "B", "C", "D"]) {
      const v = { A: a, B: b, C: c, D: d }[key];
      const u = C.sub(g.internalRays[key], v);
      const w = C.sub(g.rays[key], v);
      const perpendicular = Math.abs(C.dot(u, w)) / Math.max(1e-9, Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y));
      // For external bisectors, the applet replaces a ray by its perpendicular
      // through the same vertex; for internal ones the two rays are identical.
      check(`${name}/${mode}: ${key} ray is ${internal ? "the bisector" : "perpendicular to it"}`,
        internal ? closePoint(g.rays[key], g.internalRays[key], 1e-9) : perpendicular < 1e-9);
    }
  }
}
check("the transcription was compared over hundreds of configurations", compared > 1000,
  `compared ${compared}`);

/* ------------------------------------- 3. the page's claims, exhaustively-ish */

let worstRadial = 0, worstSum = 0, cyclicChecked = 0, sumsChecked = 0;
for (const [name, q] of configs) {
  const [a, b, c, d] = q;
  for (const internal of [true, false]) {
    const mode = internal ? "internal" : "external";
    const g = C.compute(a, b, c, d, internal);
    const ap = apDraw(a, b, c, d, internal);
    if (!g || !ap) continue;
    cyclicChecked++;
    const tol = 1e-6 * scaleOf(a, b, c, d);
    // The applet draws a circle from the first three crossings.  The fourth
    // must fall on it: that is the droodle's whole point.
    const apErrors = Object.values(ap.crossings)
      .map((p) => Math.abs(dist(p, ap.circle.c) - ap.circle.r));
    const apWorst = Math.max(...apErrors);
    worstRadial = Math.max(worstRadial, g.radialError, apWorst);
    check(`${name}/${mode}: all four crossings lie on the drawn circle`,
      g.claims.cyclic && apWorst <= tol,
      `core ${g.radialError}, applet ${apWorst}, tol ${tol}`);

    // The "opposite angles add to 180" wording is the convex case: for a
    // crossed or re-entrant starting quadrilateral an unsigned interior angle
    // is not the angle of the cyclic quadrilateral, so only concyclicity is
    // asserted there.  Convex configurations are checked in both modes.
    if (convex(a, b, c, d) && g.claims.opposite180) {
      sumsChecked++;
      for (const s of g.oppositeSums) {
        worstSum = Math.max(worstSum, Math.abs(s - 180));
        check(`${name}/${mode}: opposite angles add to 180`, Math.abs(s - 180) <= 1e-6,
          `sum ${s}`);
      }
    } else if (convex(a, b, c, d)) {
      check(`${name}/${mode}: the new quadrilateral is convex and its angle sum exists`,
        g.claims.opposite180);
    }
  }
}
check("the circle claim was tested on both bisector modes", cyclicChecked > 1000,
  `${cyclicChecked} configurations`);
check("the angle claim was tested on convex quadrilaterals in both modes", sumsChecked > 500,
  `${sumsChecked} configurations`);
check("the worst circle error stays tiny", worstRadial < 1e-5, `${worstRadial}`);
check("the worst opposite-angle error stays tiny", worstSum < 1e-6, `${worstSum}`);

/* -------------------------- 4. the sibling applet is a different construction */

{
  // CyclicQuadrilateral starts with four points ON a circle and halves the
  // arcs to get its bisectors.  Here the starting shape need not be cyclic at
  // all; the claim is about the new crossings.  Check a plainly non-cyclic
  // quadrilateral still satisfies it.
  const q = [P(120, 160), P(280, 240), P(320, 80), P(180, 80)];
  const g = C.compute(q[0], q[1], q[2], q[3], true);
  const startCircle = C.circle(q[0], q[1], q[2]);
  check("the starting quadrilateral is not cyclic",
    Math.abs(dist(q[3], startCircle.c) - startCircle.r) > 1);
  check("the artwork's claim holds without a cyclic starting quadrilateral", !!g && g.claims.cyclic);
  check("the drawing keeps the four original corners as plain data",
    !!g && g.A === q[0] && g.B === q[1] && g.C === q[2] && g.D === q[3]);
}

done("cy-quadri");
