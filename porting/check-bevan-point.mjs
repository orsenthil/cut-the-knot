#!/usr/bin/env node
"use strict";

/*
 * Logic test for bevan-point/bevan-point-core.js.
 *
 *   node porting/check-bevan-point.mjs
 *
 * Checked: the starting triangle against the applet's init() formula; every
 * numbered claim from the article (midpoint, collinearity, doubled radius,
 * perpendiculars, equal distance from the Euler line, nine-point circle) on
 * fixed acute/right/obtuse/thin triangles and on hundreds of random ones;
 * degenerate input is refused. The last group is a second, literal
 * transcription of the applet's own GeoSDoub methods straight from bytecode
 * (rotate a ray by half an angle, intersect two lines, average three
 * distances) and compares its I, Ia, Ib, Ic, V, O, radii and Ea/Eb/Ec with the
 * core's closed-form answers over the same triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bevan-point/bevan-point-core.js", "BevanPointCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ------------------------------------------------ the applet's own methods */

/* GeoSDoub.SqDist / Dist / ComputeAngle: the angle at the first argument. */
function apSq(P, Q) {
  return (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2;
}
function apDist(P, Q) {
  return Math.sqrt(apSq(P, Q));
}
function apAngle(P, Q, R) {
  const cos =
    (apSq(P, Q) + apSq(P, R) - apSq(Q, R)) /
    (2 * apDist(P, Q) * apDist(P, R));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/* GeoSDoub.FindOrientation: +1 for a positive cross product, else -1. */
function apOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: turn Q about P by angle, using the applet's sign. */
function apRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect(P1,P2,P3,P4): lines in ax+by+c=0 form; |det| < 1 is NaN. */
function apIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / det,
    y: (c1 * a2 - c2 * a1) / det,
  };
}

/* GeoSDoub.FindIncenter(A,B,C): two half-angle rays, then intersect them. */
function apIncenter(A, B, Cc) {
  const halfA = apAngle(A, B, Cc) / 2;
  const halfB = apAngle(B, Cc, A) / 2;
  const orient = apOrientation(A, B, Cc);
  return apIntersect(
    A, apRotate(A, B, halfA, orient),
    B, apRotate(B, Cc, halfB, orient),
  );
}

/* GeoSDoub.FindExcenter(A,B,C): the excentre opposite A. The two rotation
 * angles are (pi - angle B)/2 and (pi - angle C)/2, with opposite signs. */
function apExcenter(A, B, Cc) {
  const halfB = (Math.PI - apAngle(B, A, Cc)) / 2;
  const halfC = (Math.PI - apAngle(Cc, A, B)) / 2;
  const orient = apOrientation(B, A, Cc);
  return apIntersect(
    B, apRotate(B, Cc, halfB, orient),
    Cc, apRotate(Cc, B, halfC, -orient),
  );
}

/* GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
function apCircumcenter(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const v1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const v2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return apIntersect(m1, v1, m2, v2);
}

/* GeoSDoub.NearestPoint(P,A,B): projection on the line AB, with the applet's
 * "P within sqrt(0.1) of A" early return. */
function apNearest(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if (apSq(P, A) < 0.1) return { x: P.x, y: P.y };
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* BevanPointCanvas.GetCircle / GetInTouchFrom: radius is a mean of distances. */
function apCircle(P, Q, R) {
  const center = apCircumcenter(P, Q, R);
  return {
    center,
    radius: (apDist(center, P) + apDist(center, Q) + apDist(center, R)) / 3,
  };
}
function apTouch(D, s) {
  return {
    center: D,
    radius: (
      apDist(D, apNearest(D, s.B, s.C)) +
      apDist(D, apNearest(D, s.C, s.A)) +
      apDist(D, apNearest(D, s.A, s.B))
    ) / 3,
  };
}

/* One run of BevanPointCanvas.Compute(), in the applet's own order. */
function apDiagram(s) {
  const I = apIncenter(s.A, s.B, s.C);
  const Ia = apExcenter(s.A, s.B, s.C);
  const Ib = apExcenter(s.B, s.C, s.A);
  const Ic = apExcenter(s.C, s.A, s.B);
  const circleE = apCircle(Ia, Ib, Ic);
  const circum = apCircle(s.A, s.B, s.C);
  return {
    I, Ia, Ib, Ic,
    V: circleE.center, Re: circleE.radius,
    O: circum.center, R: circum.radius,
    incircle: apTouch(I, s),
    Ea: apIntersect(s.B, s.C, Ia, circleE.center),
    Eb: apIntersect(s.C, s.A, Ib, circleE.center),
    Ec: apIntersect(s.A, s.B, Ic, circleE.center),
  };
}

function compare(s, label) {
  const m = C.measurements(s);
  const a = apDiagram(s);
  const tol = 8e-6 * Math.max(m.sides.a, m.sides.b, m.sides.c);
  const detail = (name, x, y) => `${name}: applet ${JSON.stringify(x)}, core ${JSON.stringify(y)}`;
  check(`${label}: incenter matches GeoSDoub.FindIncenter`, closePoint(a.I, m.I, tol), detail("I", a.I, m.I));
  check(`${label}: Ia matches GeoSDoub.FindExcenter`, closePoint(a.Ia, m.ex.Ia, tol), detail("Ia", a.Ia, m.ex.Ia));
  check(`${label}: Ib matches GeoSDoub.FindExcenter`, closePoint(a.Ib, m.ex.Ib, tol), detail("Ib", a.Ib, m.ex.Ib));
  check(`${label}: Ic matches GeoSDoub.FindExcenter`, closePoint(a.Ic, m.ex.Ic, tol), detail("Ic", a.Ic, m.ex.Ic));
  check(`${label}: O matches GeoSDoub.FindCircumcenter`, closePoint(a.O, m.O, tol), detail("O", a.O, m.O));
  check(`${label}: V is the circumcentre of the excentral triangle`, closePoint(a.V, m.V, tol), detail("V", a.V, m.V));
  check(`${label}: circumradius matches the applet's mean`, close(a.R, m.R, tol), detail("R", a.R, m.R));
  check(`${label}: excentral radius matches the applet's mean`, close(a.Re, m.Re, tol), detail("Re", a.Re, m.Re));
  check(`${label}: incircle radius matches GetInTouchFrom`, close(a.incircle.radius, m.incircle.radius, tol), detail("r", a.incircle.radius, m.incircle.radius));
  check(`${label}: Ea matches the applet's line intersection`, closePoint(a.Ea, m.feet.Ea, tol), detail("Ea", a.Ea, m.feet.Ea));
  check(`${label}: Eb matches the applet's line intersection`, closePoint(a.Eb, m.feet.Eb, tol), detail("Eb", a.Eb, m.feet.Eb));
  check(`${label}: Ec matches the applet's line intersection`, closePoint(a.Ec, m.feet.Ec, tol), detail("Ec", a.Ec, m.feet.Ec));
}

/* ---------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A matches Canvas.init for a 400x300 canvas", s.A, { x: 160, y: 200 });
  equal("start B matches Canvas.init for a 400x300 canvas", s.B, { x: 240, y: 200 });
  equal("start C matches Canvas.init for a 400x300 canvas", s.C, { x: 180, y: 150 });
  equal("start honours a different canvas size", C.start({ width: 600, height: 450 }).A, { x: 240, y: 300 });
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 160 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 160);
  check("a fresh diagram has finite measurements", Number.isFinite(C.measurements(s).V.x));
}

/* ------------------------- 2. fixed triangles, including obtuse and thin ones */

const fixed = [
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 })],
  ["the applet's own start", C.start()],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  check(`${name}: O is the midpoint of I and V`, cl.midpoint);
  check(`${name}: I, O, V are collinear`, cl.collinear);
  check(`${name}: the excentral radius is twice the circumradius`, cl.doubleRadius);
  check(`${name}: VIa, VIb, VIc meet the sides at right angles`, cl.perpendicular);
  check(`${name}: I and V are equally far from the Euler line`, cl.eulerEquidistant);
  check(`${name}: the circumcircle is the excentral nine-point circle`, cl.ninePoint);
  check(`${name}: every claim holds at once`, Object.values(cl).every(Boolean));
  compare(s, name);
}

/* ------------------------- 3. every claim over hundreds of random triangles */

{
  const rand = rng(2572);
  let tested = 0;
  let allClaims = true;
  let allApplet = true;
  for (let trial = 0; trial < 600; trial++) {
    const s = tri(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 900) continue;
    tested++;
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      allClaims = false;
      check(`random ${trial}: all claims hold`, false, JSON.stringify(cl));
    }
    const m = C.measurements(s), a = apDiagram(s);
    const tol = 8e-6 * Math.max(m.sides.a, m.sides.b, m.sides.c);
    if (!closePoint(a.I, m.I, tol) || !closePoint(a.V, m.V, tol) ||
        !closePoint(a.Ia, m.ex.Ia, tol) || !closePoint(a.Ib, m.ex.Ib, tol) ||
        !closePoint(a.Ic, m.ex.Ic, tol) || !close(a.R, m.R, tol) ||
        !close(a.Re, m.Re, tol) || !closePoint(a.Ea, m.feet.Ea, tol)) {
      allApplet = false;
      check(`random ${trial}: core matches the applet`, false,
        `I ${JSON.stringify([a.I, m.I])}, V ${JSON.stringify([a.V, m.V])}`);
    }
  }
  check(`all claims hold on ${tested} random triangles`, tested > 520 && allClaims);
  check(`the applet transcription agrees on ${tested} random triangles`, tested > 520 && allApplet);
}

/* --------------------------------------------- 4. degenerate input is safe */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no claims pass for collinear points", !Object.values(C.claims(flat)).some(Boolean));
  check("the duplicate-point case is degenerate", C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("the applet's two-unit side limit is respected", C.isDegenerate(tri({ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 100 })));
  check("a degenerate diagram has no Bevan point", C.measurements(flat).V === undefined);
}

done("bevan-point");
