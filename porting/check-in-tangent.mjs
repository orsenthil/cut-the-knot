#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-tangent/in-tangent-core.js.
 *
 *   node porting/check-in-tangent.mjs
 *
 * The page claims that the second internal common tangent of the two small
 * incircles meets BC at T, the touch point of the big triangle's incircle, and
 * that both X and T lie on the circle with diameter IB IC. Its proof also
 * claims TX = T_B T_C, that the midpoints of SX and B'C' coincide, and that
 * SB' = XC'. All are checked here over a grid of triangles and X positions,
 * plus seeded random cases.
 *
 * Section 3 is a second transcription of the applet's own bytecode:
 * GeoSDoub.FindIncenter (two rotated angle bisectors), GetIncircle (mean of
 * the three distances to the sides), ReflectPointInLine and Intersect, with
 * the same determinant form and the same one-unit Finished test. Its answers
 * are compared with the core over the whole parameter space used above.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("in-tangent/in-tangent-core.js", "InTangentCore");

const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const close = (p, q, tol = 1e-5) => !!p && !!q &&
  near(p.x, q.x, tol) && near(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------------------------------- configurations to sweep */

const ts = [0.04, 0.11, 0.3, 0.42, 0.55, 0.68, 0.83, 0.96];
const configs = [];
for (const length of [80, 120, 200]) {
  for (const k of [-0.3, 0.05, 0.35, 0.65, 1.3]) {
    for (const h of [0.4, 0.9, 1.6]) {
      for (const t of ts) {
        configs.push({
          A: { x: k * length, y: h * length },
          B: { x: 0, y: 0 },
          C: { x: length, y: 0 },
          t: t,
        });
      }
    }
  }
}
const random = rng(20261127);
for (let i = 0; i < 300; i++) {
  configs.push({
    A: { x: (random() * 1.8 - 0.4) * 200, y: (0.25 + random() * 1.6) * 200 },
    B: { x: 0, y: 0 },
    C: { x: 200, y: 0 },
    t: 0.02 + random() * 0.96,
  });
}
const stateOf = (g) => ({ width: 400, height: 300, A: g.A, B: g.B, C: g.C, t: g.t, showCircle: false });
const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* ---------------------- 1. the applet's start position and its one option */

{
  const s = C.start({});
  equal("applet defaults (width, height, t)", [s.width, s.height, s.t], [400, 300, 0.3]);
  close(s.B, { x: 150, y: 200 });
  close(s.C, { x: 275, y: 225 });
  close(s.A, { x: 225, y: 100 });
  close(C.pointX(s), { x: 237.5, y: 217.5 });
  check("the circle option starts off the way the applet does", s.showCircle === false);
  const shown = C.start({ showCircle: true, t: 0.7 });
  check("the option values are accepted", shown.showCircle === true && shown.t === 0.7);
  close(C.pointX(shown), { x: shown.B.x * 0.7 + shown.C.x * 0.3, y: shown.B.y * 0.7 + shown.C.y * 0.3 });
  const again = C.reset(shown);
  check("reset restores X's initial fraction but keeps the circle option",
    again.t === 0.3 && again.showCircle === true && dist(again.A, shown.A) === 0);
  check("dragging an unknown point changes nothing", C.moveVertex(s, "Q", { x: 1, y: 2 }) === s);
}

/* -------------------- 2. dragging the points, cell by cell, over the grid */

{
  let projection = true, fixed = true, finite = true;
  for (const g of configs) {
    const s = stateOf(g);
    const X = C.pointX(s);
    const pointer = { x: X.x + 17, y: X.y - 31 };
    const moved = C.moveX(s, pointer);
    const back = C.pointX(moved);
    // X must be the orthogonal projection of the pointer onto BC.
    projection = projection && close(back, C.foot(pointer, g.B, g.C), 1e-8);
    for (const name of ["A", "B", "C"]) {
      const next = C.moveVertex(s, name, { x: s[name].x + 9, y: s[name].y - 11 });
      fixed = fixed && next.t === s.t && dist(C.pointX(next), C.pointX({
        ...s, [name]: { x: s[name].x + 9, y: s[name].y - 11 },
      })) < 1e-12;
    }
    const a = C.analyze(s);
    finite = finite && a.S && Number.isFinite(a.S.x) && Number.isFinite(a.circle.radius);
  }
  check("moving X projects onto the line BC", projection);
  check("moving B or C carries X along with the base", fixed);
  check("every tested triangle gives a finite tangent crossing and circle", finite);

  const s = C.start({});
  const atT = C.moveXToT(s);
  const g = C.analyze(atT);
  check("the Put X at T convenience lands on the touch point", close(C.pointX(atT), g.T, 1e-9));
  check("the applet's eyes light up when X is at T", g.finished === true);
  check("the eyes stay dark for the starting X", C.analyze(s).finished === false);
  const onePixel = C.moveX(s, C.onLine(s.B, s.C, C.clamp(
    dist(s.B, C.analyze(s).T) / dist(s.B, s.C) + 0.5 / dist(s.B, s.C), 0, 1)));
  check("the eyes' one-unit tolerance is reproduced", C.analyze(onePixel).finished === true);
}

/* -------------------------- 3. a second transcription of the bytecode */

const aSq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const aDist = (p, q) => Math.sqrt(aSq(p, q));
/** GeoSDoub.ComputeAngle(a,b,c): law of cosines at a. */
function aAngle(a, b, c) {
  const top = aSq(a, b) + aSq(a, c) - aSq(b, c);
  const cos = Math.max(-1, Math.min(1, (top / 2) / aDist(a, b) / aDist(a, c)));
  return Math.acos(cos);
}
/** GeoSDoub.FindOrientation, +1 for a counter-clockwise turn. */
function aOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}
/** GeoSDoub.Rotate(center, point, angle, sign). */
function aRotate(center, point, angle, sign) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = point.x - center.x, dy = point.y - center.y;
  return {
    x: center.x + cs * dx - sign * sn * dy,
    y: center.y + sign * sn * dx + cs * dy,
  };
}
/** GeoSDoub.Intersect(a,b,c,d) in its original determinant form. */
function aIntersect(a, b, c, d) {
  const l4 = a.y - b.y, l6 = b.x - a.x, l8 = a.x * b.y - a.y * b.x;
  const l10 = c.y - d.y, l12 = d.x - c.x, l14 = c.x * d.y - c.y * d.x;
  const det = l4 * l12 - l10 * l6;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return {
    x: (l6 * l14 - l12 * l8) / det,
    y: (l8 * l10 - l4 * l14) / det,
  };
}
/** GeoSDoub.NearestPoint, including its 0.1 short-segment guard. */
function aNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (aSq(a, p) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
/** GeoSDoub.FindIncenter: intersect the two interior angle bisectors. */
function aIncenter(a, b, c) {
  const o = aOrientation(a, b, c);
  const rayA = aRotate(a, b, aAngle(a, b, c) / 2, o);
  const rayB = aRotate(b, c, aAngle(b, c, a) / 2, o);
  return aIntersect(a, rayA, b, rayB);
}
/** InTangentCanvas.GetIncircle: centre, then mean side distance. */
function aIncircle(a, b, c) {
  const I = aIncenter(a, b, c);
  const radius = (
    aDist(I, aNearest(I, a, b)) +
    aDist(I, aNearest(I, b, c)) +
    aDist(I, aNearest(I, c, a))
  ) / 3;
  return { center: I, radius: radius };
}
/** GeoSDoub.ReflectPointInLine(p,a,b): the bytecode rotates p about b. */
function aReflect(p, a, b) {
  return aRotate(b, p, 2 * aAngle(b, p, a), aOrientation(b, p, a));
}
/** InTangentCanvas.CheckPoint's touch distance, s - |CA| from B. */
function aTouch(a, b, c) {
  const sideBC = aDist(b, c);
  const s = (sideBC + aDist(c, a) + aDist(a, b)) / 2;
  return C.onLine(b, c, (s - aDist(c, a)) / sideBC);
}
/** The full drawing method, transcribed: two incircles, two reflections, S. */
function appletGeometry(A, B, Cx, X) {
  const circleB = aIncircle(A, B, X);
  const circleC = aIncircle(A, Cx, X);
  const IB = circleB.center, IC = circleC.center;
  const A2 = aReflect(A, IB, IC);
  const X2 = aReflect(X, IB, IC);
  return {
    IB: IB, IC: IC, circleB: circleB, circleC: circleC,
    A2: A2, X2: X2, S: aIntersect(B, Cx, A2, X2),
    T: aTouch(A, B, Cx),
  };
}

{
  let centers = true, radii = true, tangents = true, crossings = true, touches = true;
  for (const g of configs) {
    const s = stateOf(g);
    const core = C.analyze(s);
    const old = appletGeometry(g.A, g.B, g.C, C.pointX(s));
    centers = centers && close(core.IB, old.IB, 1e-5) && close(core.IC, old.IC, 1e-5);
    radii = radii && near(core.incBX.radius, old.circleB.radius, 1e-5) &&
      near(core.incCX.radius, old.circleC.radius, 1e-5);
    tangents = tangents && close(core.A2, old.A2, 1e-4) && close(core.X2, old.X2, 1e-4);
    crossings = crossings && close(core.S, old.S, 1e-4);
    touches = touches && close(core.T, old.T, 1e-9);
  }
  check("the core's incenters match FindIncenter for every configuration", centers);
  check("the core's inradii match GetIncircle for every configuration", radii);
  check("the reflected tangent endpoints match ReflectPointInLine", tangents);
  check("the core's S matches the applet's line intersection", crossings);
  check("the core's T matches the applet's CheckPoint touch distance", touches);
}

/* --------------------- 4. every claim on the cut-the-knot page */

{
  let tangentAtT = true, XOnCircle = true, TOnCircle = true;
  let tx = true, midpoints = true, equalTangents = true, innerTangents = true;
  let worstS = 0, worstCircle = 0;
  for (const g of configs) {
    const a = C.analyze(stateOf(g));
    worstS = Math.max(worstS, dist(a.S, a.T));
    tangentAtT = tangentAtT && close(a.S, a.T, 1e-4);
    const dX = Math.abs(dist(a.X, a.circle.center) - a.circle.radius);
    const dT = Math.abs(dist(a.T, a.circle.center) - a.circle.radius);
    worstCircle = Math.max(worstCircle, dX, dT);
    XOnCircle = XOnCircle && dX < 1e-6;
    TOnCircle = TOnCircle && dT < 1e-6;
    // Claim (5): TX equals the gap between the contact points on AX.
    tx = tx && near(dist(a.T, a.X), dist(a.TB, a.TC), 1e-6);
    // The midpoints of SX and B'C' coincide (step 4 of the page's proof).
    midpoints = midpoints && close(midpoint(a.S, a.X), midpoint(a.Bp, a.Cp), 1e-5);
    equalTangents = equalTangents && near(dist(a.S, a.Bp), dist(a.X, a.Cp), 1e-5) &&
      near(dist(a.S, a.Cp), dist(a.X, a.Bp), 1e-5);
    // AX is a common tangent: both incentres are one radius from it.
    innerTangents = innerTangents &&
      near(C.distance(a.IB, C.foot(a.IB, a.A, a.X)), a.incBX.radius, 1e-6) &&
      near(C.distance(a.IC, C.foot(a.IC, a.A, a.X)), a.incCX.radius, 1e-6);
  }
  check("S = T: the second common tangent passes through the touch point", tangentAtT,
    "largest |S-T| = " + worstS.toExponential(2));
  check("X lies on the circle with diameter IB IC", XOnCircle);
  check("T lies on the circle with diameter IB IC", TOnCircle,
    "largest circle error = " + worstCircle.toExponential(2));
  check("claim (5): TX = T_B T_C", tx);
  check("the midpoints of SX and B'C' coincide", midpoints);
  check("SB' = XC' and SC' = XB'", equalTangents);
  check("AX touches both small incircles", innerTangents);
}

/* --------------------------- 5. the position saved for the tutor */

{
  const s = C.start({ t: 0.55, showCircle: true });
  const p = C.position(s);
  const keys = ["A", "B", "C", "X", "T", "S", "IB", "IC", "t", "showCircle", "finished"];
  check("position is plain data with every plotted point", keys.every((k) => k in p));
  check("position is JSON-serialisable", JSON.parse(JSON.stringify(p)).t === 0.55);
  close(p.X, C.pointX(s));
  check("position records the applet's one-unit eyes test", p.finished === C.analyze(s).finished);
  const moved = C.moveVertex(s, "A", { x: 100, y: 80 });
  check("position follows a dragged vertex", C.position(moved).A.x === 100);
}

done("in-tangent");
