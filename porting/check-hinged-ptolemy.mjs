#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-ptolemy/hinged-ptolemy-core.js.
 *
 *   node porting/check-hinged-ptolemy.mjs
 *
 * The core follows HingedPtolemyCanvas.Compute and GeoSDoub's signed angle,
 * rotation and line intersection. Here those three methods are transcribed a
 * second time (dot/cross and parametric intersection instead of the applet's
 * r*x + s*y = t form) and compared for every scrollbar position on hundreds
 * of configurations. The page's claims are then checked over thousands of
 * cyclic quadrilaterals: Ptolemy's identity at every rotation, the two
 * similar-triangle length formulas at a full turn, C'P' ∥ BP, and the exact
 * condition under which P' lies on the extension of BP.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hinged-ptolemy/hinged-ptolemy-core.js", "HingedPtolemyCore");
const rnd = rng(20261127);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const xprod = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const rel = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("slider starts at the applet's 0", s.rotation, 0);
  equal("names are hidden on opening", s.showNames, false);
  equal("no win or loss in an illustration", C.result(s), null);
  check("the centre is the applet's (width/2, height/2)", s.center.x === 200 && s.center.y === 160);
  check("the four points are on the circle", ["A", "B", "C", "P"].every((k) => Math.abs(dist(s.center, s[k]) - s.radius) < 1e-10));
  check("A starts at the applet's 157.5 degrees", Math.abs(Math.atan2(s.A.y - 160, s.A.x - 200) - 2.748893571891069) < 1e-12);
  check("B starts at 45 degrees", Math.abs(Math.atan2(s.B.y - 160, s.B.x - 200) - Math.PI / 4) < 1e-12);
  check("C starts at -60 degrees", Math.abs(Math.atan2(s.C.y - 160, s.C.x - 200) + Math.PI / 3) < 1e-12);
  check("P starts at -30 degrees", Math.abs(Math.atan2(s.P.y - 160, s.P.x - 200) + Math.PI / 6) < 1e-12);
  equal("a slider below its minimum stops at 0", C.setRotation(s, -7).rotation, 0);
  equal("a slider above its maximum stops at 105", C.setRotation(s, 106).rotation, 105);
  equal("the applet divides the slider by 100", C.compute(C.setRotation(s, 100)).turned, C.compute(s).angle);
  equal("the checkbox can be switched on", C.setShowNames(s, true).showNames, true);
  check("moving a point does not mutate the position", C.withPoint(s, "A", { x: 300, y: 100 }) !== s && s.A.x !== C.withPoint(s, "A", { x: 300, y: 100 }).A.x);
  check("a dragged point is snapped back onto the circle", Math.abs(dist(s.center, C.withPoint(s, "A", { x: 300, y: 100 }).A) - s.radius) < 1e-10);
  equal("dropping a point on the centre leaves it alone", C.withPoint(s, "P", s.center).P, s.P);
  check("the opening angle agrees with the signed angle A-C-B", rel(C.compute(s).angle, 52.5 * Math.PI / 180) < 1e-12);
}

/* --------------------------------- 2. second transcription of the applet */

/* GeoSDoub.FindOrientation, written as the cross product (p-o) x (q-o). */
function appletOrientation(o, p, q) {
  return xprod(sub(p, o), sub(q, o)) > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle, via the dot product of the two rays. */
function appletSignedAngle(o, p, q) {
  const u = sub(p, o), v = sub(q, o);
  const c = dot(u, v) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  const a = Math.acos(c);
  return appletOrientation(o, p, q) === 1 ? a : -a;
}

/* GeoSDoub.Rotate(centre, point, angle, 1). */
function appletRotate(o, p, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const u = sub(p, o);
  return { x: o.x + c * u.x - s * u.y, y: o.y + s * u.x + c * u.y };
}

/* GeoSDoub.Intersect(a, b, c, d): Cramer's rule with the applet's |det|<1
   guard, which sends almost-parallel lines to NaN. */
function appletIntersect(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c);
  const det = xprod(u, v);
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  const t = xprod(sub(c, a), v) / det;
  return { x: a.x + u.x * t, y: a.y + u.y * t };
}

/* HingedPtolemyCanvas.Compute, line for line in the same order. */
function appletCompute(state) {
  const fraction = state.rotation / 100;
  const angle = appletSignedAngle(state.A, state.C, state.B);
  const Cp = appletRotate(state.A, state.C, angle * fraction);
  const Pp = appletRotate(state.A, state.P, angle * fraction);
  const Pq = appletIntersect(state.A, Pp, state.B, state.P);
  return { angle, Cp, Pp, Pq };
}

function closePoint(a, b, eps) {
  if (finite(a) !== finite(b)) return false;
  if (!finite(a)) return Number.isNaN(a.x) === Number.isNaN(b.x);
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

/* Four points in the circle order A, B, P, C (the order on the page). */
function cyclic(radius, a, b, p, c, center) {
  return C.start({
    center: center || { x: 200, y: 160 },
    radius: radius,
    angles: { A: a, B: b, P: p, C: c },
  });
}

{
  let compared = 0, worstAngle = 0, worstPoint = 0, naNs = 0, mismatchedNaNs = 0;
  for (let i = 0; i < 240; i++) {
    /* Sort four angles clockwise and name them A, B, P, C in that order. */
    const sorted = [0, 1, 2, 3].map(() => rnd() * 2 * Math.PI).sort((x, y) => y - x);
    const radius = 25 + rnd() * 180;
    const center = { x: 120 + rnd() * 160, y: 100 + rnd() * 120 };
    for (let rotation = 0; rotation <= 105; rotation++) {
      const s = C.setRotation(cyclic(radius, sorted[0], sorted[1], sorted[2], sorted[3], center), rotation);
      const mine = C.compute(s);
      const theirs = appletCompute(s);
      compared++;
      worstAngle = Math.max(worstAngle, Math.abs(mine.angle - theirs.angle));
      ["Cp", "Pp", "Pq"].forEach((k) => {
        worstPoint = Math.max(worstPoint, Math.abs(mine[k].x - theirs[k].x) || 0, Math.abs(mine[k].y - theirs[k].y) || 0);
        if (!closePoint(mine[k], theirs[k], 1e-6 * Math.max(1, radius))) mismatchedNaNs++;
      });
      if (Number.isNaN(theirs.Pq.x)) naNs++;
    }
  }
  check("core Compute matches a second transcription at every slider value", compared === 240 * 106 && mismatchedNaNs === 0,
    `${compared} positions, ${mismatchedNaNs} mismatches`);
  check("signed angle matches to floating-point precision", worstAngle < 1e-12, `worst ${worstAngle}`);
  check("rotated points and P'' match to floating-point precision", worstPoint < 1e-6, `worst ${worstPoint}`);
  check("every compared position produced matching coordinates", naNs >= 0 && mismatchedNaNs === 0, `${naNs} degenerate cases`);

  /* The applet's 1-unit determinant threshold is part of its behaviour. */
  const nearly = appletIntersect({ x: 0, y: 0 }, { x: 1e5, y: 0 }, { x: 0, y: 0.1 }, { x: 1e5, y: 0.1000001 });
  const parallel = C.intersect({ x: 0, y: 0 }, { x: 1e5, y: 0 }, { x: 0, y: 0.1 }, { x: 1e5, y: 0.1000001 });
  check("both transcriptions reject a determinant below 1", Number.isNaN(nearly.x) && Number.isNaN(parallel.x));

  /* A degenerate picture through the public API reaches the same guard. */
  const flat = C.start({ radius: 100, angles: { A: 0, B: 0.00001, P: Math.PI, C: 0.5 } });
  check("a nearly parallel hinge gives NaN for P''", Number.isNaN(C.compute(flat).Pq.x));
}

/* --------------------------------------------- 3. the page's main claim */

{
  let wrong = 0, worst = 0, tried = 0;
  for (let i = 0; i < 3000; i++) {
    const sorted = [0, 1, 2, 3].map(() => rnd() * 2 * Math.PI).sort((x, y) => y - x);
    /* Keep the four dots apart, as the page assumes a convex quadrilateral.
       sorted is descending in screen angle, so gaps are previous minus next. */
    if (sorted.some((v, j) => j && sorted[j - 1] - v < 1e-3)) continue;
    if (sorted[3] + 2 * Math.PI - sorted[0] < 1e-3) continue;
    const s = cyclic(30 + rnd() * 170, sorted[0], sorted[1], sorted[2], sorted[3],
      { x: 100 + rnd() * 200, y: 80 + rnd() * 160 });
    const m = C.measure(s);
    tried++;
    worst = Math.max(worst, rel(m.left, m.right));
    if (rel(m.left, m.right) > 1e-10) wrong++;
  }
  check("Ptolemy's identity holds for all tested convex cyclic quadrilaterals", tried > 2900 && wrong === 0,
    `${tried} configurations, ${wrong} failures, worst relative error ${worst}`);

  /* Reversing the roles of B and P pairs the sides differently: the exact
     theorem used on the page belongs to the order A, B, P, C. */
  const s = cyclic(100, 2.7, 0.8, -0.5, -1.0);
  const swapped = cyclic(100, 2.7, -0.5, 0.8, -1.0);
  check("the identity is about the order A, B, P, C", rel(C.measure(s).left, C.measure(s).right) < 1e-12 && rel(C.measure(swapped).left, C.measure(swapped).right) > 1e-3);
}

/* ------------------------- 4. the hinge proof at every slider position */

{
  let lengthErrors = 0, parallelErrors = 0, collinearErrors = 0;
  let bpErrors = 0, ppErrors = 0, sumErrors = 0, tested = 0;
  for (let i = 0; i < 400; i++) {
    const sorted = [0, 1, 2, 3].map(() => rnd() * 2 * Math.PI).sort((x, y) => y - x);
    const radius = 40 + rnd() * 160;
    const original = cyclic(radius, sorted[0], sorted[1], sorted[2], sorted[3]);

    /* Rotation preserves AC and CP at every value on the scrollbar. */
    for (let rotation = 0; rotation <= 105; rotation += 5) {
      const s = C.setRotation(original, rotation);
      const g = C.compute(s);
      if (rel(dist(s.A, g.Cp), C.measure(s).AC) > 1e-10) lengthErrors++;
      if (rel(dist(g.Cp, g.Pp), C.measure(s).CP) > 1e-10) lengthErrors++;
    }

    const s = C.setRotation(original, 100);
    const g = C.compute(s);
    const m = C.measure(s, g);
    if (!finite(g.Pq)) continue; // the applet's near-parallel guard
    tested++;
    if (Math.abs(m.parallelCross) > 1e-5 * radius * radius) parallelErrors++;
    if (Math.abs(m.cpqCross) > 1e-5 * radius * radius) collinearErrors++;
    if (rel(m.BPq, (m.AB * m.CP) / m.AC) > 1e-9) bpErrors++;
    if (rel(m.PPq, (m.BC * m.AP) / m.AC) > 1e-9) ppErrors++;
    if (rel(m.BP + m.BPq, m.PPq) > 1e-9) sumErrors++;
  }
  check("rotation always preserves AC and CP", lengthErrors === 0, `${lengthErrors} failures`);
  check("at a full turn C' lies on the ray AB", collinearErrors === 0, `${collinearErrors} failures`);
  check("at a full turn C'P' is parallel to BP", parallelErrors === 0, `${parallelErrors} failures`);
  check("BP'' = AB·CP/AC as the page says", bpErrors === 0, `${bpErrors} failures in ${tested} cases`);
  check("PP'' = BC·AP/AC as the page says", ppErrors === 0, `${ppErrors} failures in ${tested} cases`);
  check("BP + BP'' = PP'' as the page says", sumErrors === 0, `${sumErrors} failures in ${tested} cases`);

  /* Partial and overshot rotations are deliberately different pictures. */
  const base = cyclic(100, 2.748893571891069, Math.PI / 4, -Math.PI / 6, -Math.PI / 3);
  const zero = C.compute(base);
  check("at 0% C' is C and P' is P", closePoint(zero.Cp, base.C, 1e-12) && closePoint(zero.Pp, base.P, 1e-12));
  const partial = C.compute(C.setRotation(base, 50));
  check("at 50% C'P' is not yet parallel to BP", Math.abs(C.measure(C.setRotation(base, 50), partial).parallelCross) > 100);
  const over = C.setRotation(base, 105);
  const gOver = C.compute(over);
  const rayA = sub(gOver.Cp, over.A), rayB = sub(over.B, over.A);
  const sameWay = dot(rayA, rayB) / (dist(over.A, gOver.Cp) * dist(over.A, over.B));
  check("at 105% C' is past B and still roughly on its ray", dist(over.A, gOver.Cp) > dist(over.A, over.B) && sameWay > 0.99,
    `same way ${sameWay}`);
  check("at 105% C'P' is no longer parallel to BP", Math.abs(C.measure(over, gOver).parallelCross) > 100);
}

/* --------------------- 5. the isosceles/equilateral sentence on the page */

{
  const sineToBP = (s, g) => {
    const a = sub(s.P, s.B), b = sub(g.Pp, s.B);
    return xprod(a, b) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  };

  let equalSides = 0, failures = 0, equilateral = 0;
  for (let i = 0; i < 80; i++) {
    /* AB = AC: B and C mirror each other in the diameter through A. */
    const a = rnd() * 2 * Math.PI, b = rnd() * 2 * Math.PI;
    const c = 2 * a - b;
    const p = a + Math.PI + (rnd() - 0.5) * 1.5;
    const s = C.setRotation(cyclic(100, a, b, p, c), 100);
    equilateral++;
    if (Math.abs(sineToBP(s, C.compute(s))) > 1e-8) failures++;
  }
  check("when AB = AC the turned P' lies on the line BP", equilateral === 80 && failures === 0, `${failures} failures`);

  let apexB = 0, apexC = 0;
  for (let i = 0; i < 80; i++) {
    const b = rnd() * 2 * Math.PI, c = rnd() * 2 * Math.PI;
    const a = 2 * b - c;
    const p = b + Math.PI + 0.3 + rnd();
    const s = C.setRotation(cyclic(100, a, b, p, c), 100);
    /* Skip the equilateral case and pictures where P almost coincides with
       A or B: then "P' on line BP" is nearly true for the wrong reason. */
    const measureB = C.measure(s);
    const angleB = Math.abs(C.compute(s).angle);
    if (rel(measureB.AB, measureB.AC) < 1e-6 || measureB.AP < 70 || measureB.BP < 70) continue;
    if (angleB < 0.2 || angleB > Math.PI - 0.2) continue; // nearly flat triangle
    apexB++;
    if (Math.abs(sineToBP(s, C.compute(s))) < 0.05) equalSides++;
  }
  /* The page's isosceles sentence is not true for equal sides at B: P' is
     off the line BP in nearly every configuration (isolated coincidences
     where the rotation happens to land on it are not the general rule). */
  check("AB = BC (equal sides at B) does not put P' on BP", apexB > 20 && equalSides < apexB / 10,
    `${equalSides} collinear coincidences in ${apexB}`);

  let otherFailures = 0;
  for (let i = 0; i < 80; i++) {
    const c = rnd() * 2 * Math.PI, a = rnd() * 2 * Math.PI;
    const b = 2 * c - a;
    const p = c + Math.PI + 0.3 + rnd();
    const s = C.setRotation(cyclic(100, a, b, p, c), 100);
    const measureC = C.measure(s);
    const angleC = Math.abs(C.compute(s).angle);
    if (rel(measureC.AC, measureC.AB) < 1e-6 || measureC.AP < 70 || measureC.BP < 70) continue;
    if (angleC < 0.2 || angleC > Math.PI - 0.2) continue;
    apexC++;
    if (Math.abs(sineToBP(s, C.compute(s))) < 0.05) otherFailures++;
  }
  check("AC = BC (equal sides at C) does not put P' on BP either", apexC > 20 && otherFailures < apexC / 10,
    `${otherFailures} collinear coincidences in ${apexC}`);
}

done("hinged-ptolemy");
