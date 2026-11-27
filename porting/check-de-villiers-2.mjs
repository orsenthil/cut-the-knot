#!/usr/bin/env node
"use strict";

/*
 * Logic test for de-villiers-2/de-villiers-2-core.js.
 *
 *   node porting/check-de-villiers-2.mjs
 *
 * Checks the applet's start position and all six checkboxes, then transcribes
 * its own methods a second time from the bytecode (GeoSDoub.FindCircumcenter /
 * Intersect / FindAngleBisector / NearestPoint, deVilliers2Canvas.GetTangent,
 * DoubPoly.FormBisector / GetIterate / DrawJoints) and compares every point on
 * fixed and 900 generated cyclic configurations.  It then tests the article's
 * claim itself: for thousands of tangential quadrilaterals, the quadrilateral
 * made by the perpendicular bisectors of their sides has equal opposite side
 * sums and four equal inradii.  The article's tangent-length equation (3) is
 * checked in its signed form too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("de-villiers-2/de-villiers-2-core.js", "DeVilliers2Core");

const P = (x, y) => ({ x, y });
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const mul = (p, k) => P(p.x * k, p.y * k);
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const onCircle = (p, circle, tol = 1e-6) => close(dist(p, circle.c), circle.r, tol);
const circleOf = (c, r, t) => P(c.x + r * Math.cos(t), c.y + r * Math.sin(t));

/* ---------------- the applet's arithmetic, transcribed straight from bytecode */

/* GeoSDoub.Intersect(P1,P2,P3,P4): |det| < 1 yields NaN, never null. */
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindCircumcenter; deVilliers2Canvas.GetCircle uses the mean radius. */
function apCircle(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const n1 = P(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const n2 = P(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  const o = apIntersect(m1, n1, m2, n2);
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}

/* deVilliers2Canvas.GetTangent: P and P + rotate90(P - O). */
function apTangent(p, circle) {
  return { p1: p, p2: P(p.x - (p.y - circle.c.y), p.y + (p.x - circle.c.x)) };
}

function apIntersectLines(l, m) {
  return apIntersect(l.p1, l.p2, m.p1, m.p2);
}

/* DoubPoly.FormBisector, with the applet's order of the subtractions. */
function apFormBisector(p, q) {
  const m = mid(p, q);
  return { p1: m, p2: P(m.x + (p.y - q.y), m.y + (q.x - p.x)) };
}

/* DoubPoly.GetIterate: from the last bisector through bisectors 0..3. */
function apIterate(quad) {
  const bis = [];
  let prev = quad[3];
  for (const p of quad) { bis.push(apFormBisector(prev, p)); prev = p; }
  const out = [];
  prev = bis[3];
  for (let i = 0; i < 4; i++) {
    const q = apIntersectLines(prev, bis[i]);
    if (!finite(q) || q.x === 0 && q.y === 0) return null;
    out.push(q);
    prev = bis[i];
  }
  return { points: out, bisectors: bis };
}

/* GeoSDoub.ComputeAngle + FindOrientation + Rotate + FindAngleBisector. */
function apComputeAngle(v, p, q) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const c = (sq(v, p) + sq(v, q) - sq(p, q))
    / (2 * Math.sqrt(sq(v, p)) * Math.sqrt(sq(v, q)));
  return Math.acos(c);
}
function apOrientation(v, p, q) {
  const s = q.x * (v.y - p.y) + q.y * (p.x - v.x) + v.x * p.y - p.x * v.y;
  return s > 0 ? 1 : -1;
}
function apRotate(v, p, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(v.x + cs * (p.x - v.x) - orientation * sn * (p.y - v.y),
    v.y + orientation * sn * (p.x - v.x) + cs * (p.y - v.y));
}
function apBisectorFoot(v, p, q) {
  const r = apRotate(v, p, apComputeAngle(v, p, q) / 2, apOrientation(v, p, q));
  return apIntersect(v, r, p, q);
}

/* GeoSDoub.NearestPoint, and the applet's DoubPoly.DrawJoints incircle. */
function apNearest(p, a, b) {
  const v = sub(b, a), n = dot(v, v);
  return add(a, mul(v, dot(sub(p, a), v) / n));
}
function apIncircle(quad) {
  const f1 = apBisectorFoot(quad[1], quad[0], quad[2]);
  const f2 = apBisectorFoot(quad[2], quad[1], quad[3]);
  if (!finite(f1) || !finite(f2)) return null;
  const o = apIntersect(quad[1], f1, quad[2], f2);
  if (!finite(o)) return null;
  const feet = [apNearest(o, quad[0], quad[1]), apNearest(o, quad[1], quad[2]),
    apNearest(o, quad[2], quad[3]), apNearest(o, quad[3], quad[0])];
  return { c: o, r: feet.reduce((s, f) => s + dist(o, f), 0) / 4, feet: feet };
}

/** The whole of DrawConfiguration + DrawIterations, in bytecode order. */
function apFull(a, b, c, d) {
  const circle = apCircle(a, b, c);
  const lines = [a, b, c, d].map((p) => apTangent(p, circle));
  const main = [apIntersectLines(lines[0], lines[1]), apIntersectLines(lines[1], lines[2]),
    apIntersectLines(lines[2], lines[3]), apIntersectLines(lines[3], lines[0])];
  if (!main.every(finite)) return null;
  const step = apIterate(main);
  if (!step) return null;
  return { circle: circle, main: main, step: step.points,
    mainIncircle: apIncircle(main), stepIncircle: apIncircle(step.points) };
}

let jointsCompared = 0;
let jointsSkipped = 0;

function compareApplet(label, a, b, c, d) {
  const g = C.compute(a, b, c, d);
  const ap = apFull(a, b, c, d);
  if (!g || !ap) {
    check(`${label}: both constructions exist`, !!g && !!ap);
    return false;
  }
  const scale = Math.max(1, ap.circle.r, ...ap.main.map((p) => dist(p, ap.circle.c)));
  const tol = 2e-5 * scale;
  let ok = closeP(g.circle.c, ap.circle.c, tol) && close(g.circle.r, ap.circle.r, tol);
  for (let i = 0; i < 4; i++) {
    ok = ok && closeP(g.main[i], ap.main[i], tol) && closeP(g.step[i], ap.step[i], tol);
  }
  /*
   * With nearly evenly spaced corners the derived quadrilateral shrinks and
   * the applet's own |det| < 1 fallback leaves it with no joints to draw; the
   * core's smaller threshold still finds them.  Compare the joints only where
   * the applet actually drew them.
   */
  if (ap.mainIncircle && ap.stepIncircle) {
    ok = ok && closeP(g.mainIncircle.c, ap.mainIncircle.c, tol)
      && close(g.mainIncircle.r, ap.mainIncircle.r, tol)
      && closeP(g.stepIncircle.c, ap.stepIncircle.c, tol)
      && close(g.stepIncircle.r, ap.stepIncircle.r, tol);
    jointsCompared++;
  } else {
    jointsSkipped++;
  }
  check(`${label}: core matches the applet's bytecode`, ok,
    ok ? "" : `core ${JSON.stringify(g.step)}, applet ${JSON.stringify(ap.step)}`);
  return ok;
}

/* ------------------------------------------- 1. the start position and options */

{
  const s = C.start();
  equal("the circle centre is half the 360x300 board", s.circle.c, P(180, 150));
  equal("the radius is min(width,height)/4", s.circle.r, 75);
  check("A starts at angle 0", closeP(s.A, P(255, 150), 1e-9));
  check("B starts at angle 1.2", closeP(s.B, circleOf(s.circle.c, 75, 1.2), 1e-9));
  check("C starts at angle 2.9", closeP(s.C, circleOf(s.circle.c, 75, 2.9), 1e-9));
  check("D starts at the fixed angle 4.5 (the random multiple of pi is unused)",
    closeP(s.D, circleOf(s.circle.c, 75, 4.5), 1e-9));
  check("all four start corners lie on the circle",
    [s.A, s.B, s.C, s.D].every((p) => onCircle(p, s.circle)));
  check("the applet defaults: names and the three other Show boxes off, joints on",
    !s.options.names && !s.options.angles && !s.options.diagonals && s.options.joints);
  check("neither picture is selected at the start", !s.options.primary && !s.options.secondary);
  check("the Show boxes are disabled until Primary or Secondary is chosen", !C.showEnabled(s));
  check("this illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
}

{
  const s = C.start();
  const q = C.move(s, "A", P(180, 150 + 200));
  check("dragging snaps a corner back onto the circle", onCircle(q.A, s.circle)
    && close(q.A.x, 180, 1e-9) && close(q.A.y, 225, 1e-9));
  check("dragging leaves the old position alone", s.A.x === 255);
  check("dragging marks the diagram explored", q.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite corner is ignored", C.move(s, "B", P(NaN, 4)) === s);
  check("the circle stays fixed when a corner moves", q.circle === s.circle);
  const withOptions = C.setOption(C.setOption(s, "primary", true), "names", true);
  check("options change independently and enable the Show boxes",
    withOptions.options.primary && withOptions.options.names && C.showEnabled(withOptions));
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(withOptions);
  check("Reset restores all four corners but keeps the boxes",
    closeP(r.A, P(255, 150), 1e-9) && r.options.primary && r.options.names);
  check("status describes the two quadrilaterals", /tangent quadrilateral.*bisector quadrilateral/.test(C.describe(s)),
    C.describe(s));
}

/* ------------------------------------- 2. fixed configurations against bytecode */

const centre = P(180, 150), radius = 75;
const fixed = [
  ["the applet's start", [0, 1.2, 2.9, 4.5]],
  ["an almost-square", [0.1, 1.6, 3.2, 5.1]],
  ["a rectangle-like quadrilateral", [0.2, 1.4, 3.6, 5.1]],
  ["a tilted cyclic quadrilateral", [0.35, 1.75, 3.05, 4.85]],
  ["a squashed one", [0, 0.9, 2.2, 4.1]],
];
for (const [name, angles] of fixed) {
  const q = angles.map((t) => circleOf(centre, radius, t));
  compareApplet(name, ...q);
}

/* ----------------------- 3. the whole parameter space, generated configurations */

{
  const rand = rng(4132);
  let compared = 0, failures = 0;
  for (let trial = 0; trial < 900; trial++) {
    const c = P(150 + rand() * 60, 120 + rand() * 60);
    const r = 55 + rand() * 40;
    const t0 = rand() * 0.3;
    const gaps = [1.0 + rand() * 0.7, 1.3 + rand() * 0.8, 1.1 + rand() * 0.8, 1.2 + rand() * 0.7];
    const sum = gaps.reduce((s, v) => s + v, 0);
    const angles = [t0];
    for (let i = 0; i < 3; i++) angles.push(angles[i] + gaps[i] * (2 * Math.PI) / sum);
    const q = angles.map((t) => circleOf(c, r, t));
    if (compareApplet(`generated ${trial}`, ...q)) compared++; else failures++;
  }
  check(`core and applet agree on ${compared} generated configurations`,
    compared === 900 && failures === 0);
  check(`the applet drew joints in ${jointsCompared} of them (and none in ${jointsSkipped})`,
    jointsCompared > 300 && jointsCompared + jointsSkipped >= 905);
}

/* ---------------------- 4. the page's claim on the applet's own configuration */

{
  const rand = rng(2004);
  let tested = 0, failures = 0, nonTrivial = 0;
  for (let trial = 0; trial < 1200; trial++) {
    const r = 40 + rand() * 80;
    const gaps = [0.7 + rand() * 1.1, 0.7 + rand() * 1.1, 0.7 + rand() * 1.1, 0.7 + rand() * 1.1];
    const f = 2 * Math.PI / gaps.reduce((s, v) => s + v, 0);
    const angles = [rand() * 0.5];
    for (let i = 0; i < 3; i++) angles.push(angles[i] + gaps[i] * f);
    const q = angles.map((t) => circleOf(P(180, 150), r, t));
    const g = C.compute(...q);
    if (!g) { failures++; check(`claim ${trial}: construction exists`, false); continue; }
    tested++;
    const cl = g.claims;
    if (!Object.values(cl).every(Boolean)) {
      failures++;
      check(`claim ${trial}: every measured claim holds`, false, JSON.stringify(cl));
    }
    if (Math.abs(C.pitot(g.main)) > 1e-7 * r || Math.abs(C.pitot(g.step)) > 1e-7 * r) {
      failures++;
      check(`claim ${trial}: both Pitot sums vanish`, false);
    }
    nonTrivial++;
  }
  check(`the applet picture supports the page's claim on ${tested} configurations`,
    tested === 1200 && failures === 0 && nonTrivial > 1000);
}

/* ------- 5. the claim for arbitrary tangential quadrilaterals, not just the applet's */

function tangentialQuad(angles, radius) {
  const circle = { c: P(0, 0), r: radius };
  const pts = angles.map((t) => circleOf(circle.c, radius, t));
  return C.tangentQuad(pts, circle);
}

{
  // An actual square is a degenerate case: the four bisectors meet at one
  // point, so there is no quadrilateral to test.  Use two lopsided ones.
  const wide = tangentialQuad([0.2, 1.3, 2.8, 4.9], 1);
  const kite = tangentialQuad([0, 1.0, 2.4, 4.4], 1);
  for (const [name, q] of [["a wide tangential quadrilateral", wide], ["kite", kite]]) {
    check(`${name}: the original is inscriptible (Pitot)`,
      Math.abs(C.pitot(q)) < 1e-8);
    const step = C.perpendicularQuad(q);
    check(`${name}: the bisector quadrilateral exists`, !!step);
    if (!step) continue;
    check(`${name}: the bisector quadrilateral satisfies Pitot`,
      Math.abs(C.pitot(step.points)) < 1e-8);
    const cc = C.incircle(step.points);
    check(`${name}: four equal inradii`, !!cc && C.spread(cc.radii) < 1e-8);
    const f = C.formula3(q, { c: P(0, 0), r: 1 }, 3);
    check(`${name}: the article's equation (3) holds`, !!f
      && Math.abs(f.left - f.right) < 1e-8 * Math.max(1, Math.abs(f.right)),
    f ? `${f.left} vs ${f.right}` : "no formula");
  }

  const rand = rng(1922);
  let tested = 0, failures = 0, pitotOriginal = 0;
  for (let trial = 0; trial < 3000; trial++) {
    let gaps;
    // Keep every gap below half a turn: then all tangent lengths are positive
    // and the quadrilateral really contains its incircle.
    do { gaps = [0, 0, 0, 0].map(() => 0.4 + rand()); }
    while (Math.max(...gaps) > gaps.reduce((s, v) => s + v, 0) / 2);
    const scaleAngle = 2 * Math.PI / gaps.reduce((s, v) => s + v, 0);
    const angles = [rand() * 0.3];
    for (let i = 0; i < 3; i++) angles.push(angles[i] + gaps[i] * scaleAngle);
    const q = tangentialQuad(angles, 1);
    if (!q) { failures++; check(`tangential ${trial}: quadrilateral exists`, false); continue; }
    const scale = Math.max(1, ...q.map((p) => Math.hypot(p.x, p.y)));
    if (Math.abs(C.pitot(q)) / scale > 1e-6) {
      failures++;
      check(`tangential ${trial}: Pitot holds for the original`, false);
    }
    pitotOriginal++;
    const step = C.perpendicularQuad(q);
    const cc = step && C.incircle(step.points);
    if (!step || !cc) { failures++; check(`tangential ${trial}: bisectors meet`, false); continue; }
    const tol = 1e-7 * Math.max(1, scale, Math.abs(cc.r));
    const err = Math.abs(C.pitot(step.points));
    if (err > tol || C.spread(cc.radii) > tol) {
      failures++;
      check(`tangential ${trial}: the page's claim holds`, false,
        `Pitot ${err}, inradius spread ${C.spread(cc.radii)}`);
    }
    const f = C.formula3(q, { c: P(0, 0), r: 1 }, 3);
    if (!f || Math.abs(f.left - f.right) > 1e-6 * Math.max(1, Math.abs(f.right))) {
      failures++;
      check(`tangential ${trial}: equation (3) holds`, false, JSON.stringify(f));
    }
    tested++;
  }
  check(`the page's claim holds on ${tested} general tangential quadrilaterals`,
    tested === 3000 && failures === 0 && pitotOriginal === 3000);

  // Scaling the incircle changes the tangent lengths and side lengths in the
  // same way, so equation (3) is homogeneous; test that it survives a rescaling.
  const angles = [0.2, 1.3, 2.6, 4.5];
  const base = C.formula3(tangentialQuad(angles, 1), { c: P(0, 0), r: 1 }, 3);
  const big = C.formula3(tangentialQuad(angles, 12), { c: P(0, 0), r: 12 }, 3);
  check("equation (3) scales with the incircle radius",
    !!base && !!big && close(big.left / 12, base.left, 1e-8)
      && close(big.right / 12, base.right, 1e-8));
}

/* ---------------------------------------------------- 6. degenerate input is safe */

{
  check("three collinear corners give no circle", C.compute(P(0, 0), P(10, 0), P(20, 0), P(5, 5)) === null);
  check("a repeated corner gives no construction",
    C.compute(P(0, 0), P(0, 0), P(20, 10), P(5, 5)) === null);
  const opposite = C.move(C.start(), "C", P(105, 150)); // C is opposite A on the circle
  const og = C.geometry(opposite);
  check("opposite corners still give a finite tangent quadrilateral with two incircles",
    !!og && og.claims.mainIsInscriptible && og.claims.iterateIsInscriptible);
  check("a missing corner is rejected", C.compute(P(0, 0), P(1, 1), P(2, 0), null) === null);
  check("a degenerate state has a readable status",
    typeof C.describe({ A: P(0, 0), B: P(0, 0), C: P(0, 0), D: P(0, 0) }) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("de-villiers-2");
