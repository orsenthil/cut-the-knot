#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-ex-circum/in-ex-circum-core.js.
 *
 *   node porting/check-in-ex-circum.mjs
 *
 * Checked: the starting triangle against InExCircumCanvas.init(); the `show`
 * and two-unit rules; every claim on the cut-the-knot page (the three
 * midpoints lie on the circumcircle; they are the arc midpoints; ABC is the
 * orthic triangle of IaIbIc; I is its orthocentre; ABC's circle is the
 * excentral nine-point circle) on fixed acute/right/obtuse/thin triangles and
 * on hundreds of random ones. A second, literal transcription of the applet's
 * own GeoSDoub geometry (two half-angle rays intersected, circles with a mean
 * radius, perpendicular bisectors) is compared with the core over the same
 * triangles, including an independent construction of each arc midpoint as the
 * circumcentre of the opposite side and the incenter.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("in-ex-circum/in-ex-circum-core.js", "InExCircumCore");

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
  const cos = (apSq(P, Q) + apSq(P, R) - apSq(Q, R)) / (2 * apDist(P, Q) * apDist(P, R));
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

/* GeoSDoub.Intersect(P1,P2,P3,P4) in ax+by+c=0 form; |det| < 1 is NaN. */
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

/* GeoSDoub.FindIncenter(A,B,C): intersect the two half-angle rays at A and B. */
function apIncenter(A, B, Cc) {
  const halfA = apAngle(A, B, Cc) / 2;
  const halfB = apAngle(B, Cc, A) / 2;
  const orient = apOrientation(A, B, Cc);
  return apIntersect(A, apRotate(A, B, halfA, orient), B, apRotate(B, Cc, halfB, orient));
}

/* GeoSDoub.FindExcenter(A,B,C): the excentre opposite A, with opposite signs. */
function apExcenter(A, B, Cc) {
  const halfB = (Math.PI - apAngle(B, A, Cc)) / 2;
  const halfC = (Math.PI - apAngle(Cc, A, B)) / 2;
  const orient = apOrientation(B, A, Cc);
  return apIntersect(B, apRotate(B, Cc, halfB, orient), Cc, apRotate(Cc, B, halfC, -orient));
}

/* GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
function apCircumcenter(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const v1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const v2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return apIntersect(m1, v1, m2, v2);
}

/* GeoSDoub.NearestPoint(P,A,B), with the sqrt(0.1) early return. */
function apNearest(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if (apSq(P, A) < 0.1) return { x: P.x, y: P.y };
  const t = (dx * (P.x - A.x) + dy * (P.y - A.y)) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* InExCircumCanvas.GetCircle / GetInTouchFrom: the radius is a mean distance. */
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
const apMid = (P, Q) => ({ x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 });

/* The arc midpoint: the point equidistant from B, C and I is the circumcentre
 * of BCI. Unlike intersecting two lines, this also works for an equilateral
 * triangle, where the two bisectors coincide. */
function apArc(A, B, Cc, I) {
  return apCircle(B, Cc, I).center;
}

/* One run of InExCircumCanvas.Compute(), in the applet's own order. */
function apDiagram(s) {
  const I = apIncenter(s.A, s.B, s.C);
  const Ia = apExcenter(s.A, s.B, s.C);
  const Ib = apExcenter(s.B, s.C, s.A);
  const Ic = apExcenter(s.C, s.A, s.B);
  const Ma = apMid(I, Ia), Mb = apMid(I, Ib), Mc = apMid(I, Ic);
  const circum = apCircle(s.A, s.B, s.C);
  return {
    I, Ia, Ib, Ic, Ma, Mb, Mc,
    O: circum.center, R: circum.radius,
    incircle: apTouch(I, s),
    excircleA: apTouch(Ia, s),
    excircleB: apTouch(Ib, s),
    excircleC: apTouch(Ic, s),
    arcMa: apArc(s.A, s.B, s.C, I),
    arcMb: apArc(s.B, s.C, s.A, I),
    arcMc: apArc(s.C, s.A, s.B, I),
  };
}

function compare(s, label) {
  const m = C.measurements(s);
  const a = apDiagram(s);
  const tol = C.tolerance(s, m) * 2;
  const detail = (name, x, y) => `${name}: applet ${JSON.stringify(x)}, core ${JSON.stringify(y)}`;
  check(`${label}: I matches GeoSDoub.FindIncenter`, closePoint(a.I, m.I, tol), detail("I", a.I, m.I));
  check(`${label}: Ia matches GeoSDoub.FindExcenter`, closePoint(a.Ia, m.ex.Ia, tol), detail("Ia", a.Ia, m.ex.Ia));
  check(`${label}: Ib matches GeoSDoub.FindExcenter`, closePoint(a.Ib, m.ex.Ib, tol), detail("Ib", a.Ib, m.ex.Ib));
  check(`${label}: Ic matches GeoSDoub.FindExcenter`, closePoint(a.Ic, m.ex.Ic, tol), detail("Ic", a.Ic, m.ex.Ic));
  check(`${label}: Ma/Mb/Mc match the applet's Midpoint`, closePoint(a.Ma, m.mid.Ma, tol) && closePoint(a.Mb, m.mid.Mb, tol) && closePoint(a.Mc, m.mid.Mc, tol));
  check(`${label}: O matches GeoSDoub.FindCircumcenter`, closePoint(a.O, m.O, tol), detail("O", a.O, m.O));
  check(`${label}: circumradius matches the applet's mean`, close(a.R, m.R, tol), detail("R", a.R, m.R));
  check(`${label}: incircle radius matches GetInTouchFrom`, close(a.incircle.radius, m.incircle.radius, tol));
  check(`${label}: excircle radii match GetInTouchFrom`,
    close(a.excircleA.radius, m.excircles.Ia.radius, tol) &&
    close(a.excircleB.radius, m.excircles.Ib.radius, tol) &&
    close(a.excircleC.radius, m.excircles.Ic.radius, tol));
  check(`${label}: arc midpoints match the independent construction`,
    Boolean(m.arc) && closePoint(a.arcMa, m.arc.Ma, tol) && closePoint(a.arcMb, m.arc.Mb, tol) && closePoint(a.arcMc, m.arc.Mc, tol),
    detail("arcMa", a.arcMa, m.arc && m.arc.Ma));
}

/* ---------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A matches Canvas.init for a 400x300 canvas", s.A, { x: 160, y: 200 });
  equal("start B matches Canvas.init for a 400x300 canvas", s.B, { x: 240, y: 200 });
  equal("start C matches Canvas.init for a 400x300 canvas", s.C, { x: 180, y: 150 });
  equal("start honours another canvas size", C.start({ width: 600, height: 450 }).B, { x: 360, y: 300 });
  check("start honours explicit points", closePoint(C.start({ points: s }).C, s.C, 0));
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("the three corners are the only moves", JSON.stringify(C.legalMoves(s)) === JSON.stringify(["A", "B", "C"]));
  check("a move returns a new triangle", (() => {
    const next = C.move(s, { name: "A", point: { x: 10, y: 20 } });
    return s.A.x === 160 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown corner is refused", C.move(s, { name: "Z", point: { x: 1, y: 2 } }) === null);
  check("a missing move is refused", C.move(s, null) === null);
  check("a fresh diagram has finite measurements", Number.isFinite(C.measurements(s).O.x));
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
  check(`${name}: the three midpoints lie on the circumcircle`, cl.onCircle);
  check(`${name}: they are the midpoints of the arcs they cross`, cl.arcMidpoint);
  check(`${name}: ABC is the orthic triangle of IaIbIc`, cl.orthic);
  check(`${name}: I is the orthocentre of IaIbIc`, cl.orthocenter);
  check(`${name}: the circumcircle is the excentral nine-point circle`, cl.ninePoint);
  check(`${name}: every claim holds at once`, Object.values(cl).every(Boolean));
  compare(s, name);
}

/* ------------------------- 3. every claim over hundreds of random triangles */

{
  const rand = rng(5702);
  let tested = 0;
  let allClaims = true;
  let allApplet = true;
  let bad = "";
  for (let trial = 0; trial < 700; trial++) {
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
      if (!bad) bad = `trial ${trial}: ${JSON.stringify(cl)}`;
    }
    const m = C.measurements(s), a = apDiagram(s);
    const tol = C.tolerance(s, m) * 2;
    if (!closePoint(a.I, m.I, tol) || !closePoint(a.Ia, m.ex.Ia, tol) ||
        !closePoint(a.Ib, m.ex.Ib, tol) || !closePoint(a.Ic, m.ex.Ic, tol) ||
        !closePoint(a.Ma, m.mid.Ma, tol) || !closePoint(a.O, m.O, tol) ||
        !close(a.R, m.R, tol) || !close(a.incircle.radius, m.incircle.radius, tol) ||
        !closePoint(a.arcMa, m.arc.Ma, tol) || !closePoint(a.arcMc, m.arc.Mc, tol)) {
      allApplet = false;
      if (!bad) bad = `trial ${trial}: core differs from the applet transcription`;
    }
  }
  check(`all page claims hold on ${tested} random triangles`, tested > 560 && allClaims, bad);
  check(`the applet transcription agrees on ${tested} random triangles`, tested > 560 && allApplet, bad);
}

/* --------------------------------------------- 4. degenerate input is safe */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no claim passes for collinear points", !Object.values(C.claims(flat)).some(Boolean));
  check("duplicate points are degenerate", C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("the applet's two-unit side limit is respected", C.isDegenerate(tri({ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 100 })));
  check("a degenerate diagram has no circumcircle", C.measurements(flat).circumcircle === undefined);
  check("a degenerate diagram draws nothing extra", !C.measurements(flat).mid);
}

done("in-ex-circum");
