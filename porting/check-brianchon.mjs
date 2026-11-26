#!/usr/bin/env node
"use strict";

/*
 * Logic test for brianchon/brianchon-core.js.
 *
 *   node porting/check-brianchon.mjs
 *
 * Checked: the starting circle and six dots against BrianchonCanvas.init;
 * the applet's own GetCircle / GetTangent / GeoSDoub.Intersect transcribed a
 * second time from the bytecode and compared with the core on 400 random
 * six-dot configurations plus fixed ones; every claim on the applet's page
 * (tangency, lying on the circle, concurrence of the major diagonals, the
 * quadrilateral limit, Pascal duality) over 500 random configurations; and
 * the degenerate cases the applet's |det| < 1 test creates.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("brianchon/brianchon-core.js", "BrianchonCore");
const NAMES = C.NAMES;

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  C.isFinitePoint(p) && C.isFinitePoint(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
/* GeoSDoub.Intersect writes (NaN, NaN) for a near-parallel pair: both sides of
   a comparison may be unusable, and the applet's answer is still the same. */
const samePoint = (p, q, tol) => C.isFinitePoint(p) && C.isFinitePoint(q)
  ? closePoint(p, q, tol)
  : !C.isFinitePoint(p) && !C.isFinitePoint(q);
const sameNumber = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b)
  ? close(a, b, tol)
  : !Number.isFinite(a) && !Number.isFinite(b);
const angleState = (angles, options) => {
  const base = C.start(options);
  const points = {};
  angles.forEach((a, i) => { points[NAMES[i]] = C.pointOnCircle(base.circle, a); });
  return C.start({ ...(options || {}), points, circle: base.circle });
};

/* -------------------------------- the applet's own math, transcribed again */

/* GeoSDoub.Intersect(DoubPoint x4): a1,b1,c1 / a2,b2,c2, |det| < 1 -> NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* BrianchonCanvas.GetCircle(A,C,E) and CTKMoveableDoub.RestrictToCircle. */
function appletCircle(A, Cc, E) {
  const midAB = { x: (A.x + Cc.x) / 2, y: (A.y + Cc.y) / 2 };
  const midBC = { x: (Cc.x + E.x) / 2, y: (Cc.y + E.y) / 2 };
  const perpAB = { x: midAB.x + (Cc.y - A.y), y: midAB.y - (Cc.x - A.x) };
  const perpBC = { x: midBC.x + (E.y - Cc.y), y: midBC.y - (E.x - Cc.x) };
  const center = appletIntersect(midAB, perpAB, midBC, perpBC);
  const radius = (dist(center, A) + dist(center, Cc) + dist(center, E)) / 3;
  return { center, radius };
}
/* The deliberately awkward expression above is just midBC.y - (E.x - Cc.x). */
function appletTangentPoint(P, circle) {
  return { x: P.x - (P.y - circle.center.y), y: P.y + (P.x - circle.center.x) };
}
function appletVertices(points, circle) {
  const tangentPoints = NAMES.map((n) => appletTangentPoint(points[n], circle));
  return NAMES.map((n, i) => {
    const j = (i + 1) % 6;
    return appletIntersect(points[n], tangentPoints[i], points[NAMES[j]], tangentPoints[j]);
  });
}
function appletDiagonals(points, circle) {
  const v = appletVertices(points, circle);
  return [[v[0], v[3]], [v[1], v[4]], [v[2], v[5]]];
}

/* Pascal's line for the six points of contact, and its pole in the circle. */
function pascal(points, circle) {
  const inter = (a, b, c, d) => appletIntersect(a, b, c, d);
  const p = NAMES.map((n) => points[n]);
  const x0 = inter(p[0], p[1], p[3], p[4]);
  const x1 = inter(p[1], p[2], p[4], p[5]);
  const x2 = inter(p[2], p[3], p[5], p[0]);
  const dx = x1.x - x0.x, dy = x1.y - x0.y;
  const a = dy, b = -dx, c = dx * x0.y - dy * x0.x; // a*x + b*y + c = 0
  const third = (a * x2.x + b * x2.y + c) / Math.hypot(a, b);
  const d = -(a * circle.center.x + b * circle.center.y + c);
  const pole = Math.abs(d) < 1e-9 ? { x: NaN, y: NaN } : {
    x: circle.center.x + (circle.radius * circle.radius * a) / d,
    y: circle.center.y + (circle.radius * circle.radius * b) / d,
  };
  return { x0, x1, x2, third, pole };
}

/* --------------------------------------------------- 1. the starting diagram */

{
  const s = C.start();
  equal("the default canvas is 400 by 250", [s.width, s.height], [400, 250]);
  equal("the circle is the one from init()", s.circle, { center: { x: 200, y: 125 }, radius: 62.5 });
  const expected = C.start().circle;
  NAMES.forEach((n, i) => {
    const a = C.START_ANGLES[i];
    const p = { x: 200 + 62.5 * Math.cos(a), y: 125 + 62.5 * Math.sin(a) };
    check(`${n} starts at angle ${a} from GetPoint`, closePoint(s.points[n], p, 1e-9));
  });
  check("the first dot is at angle 0, right of centre", close(s.points.A.x, 262.5, 1e-9) && close(s.points.A.y, 125, 1e-9));
  check("the sixth dot is at angle 5.5", closePoint(s.points.F, C.pointOnCircle(expected, 5.5), 1e-9));
  const fromApplet = appletCircle(s.points.A, s.points.C, s.points.E);
  check("GetCircle of A,C,E gives the starting circle",
    closePoint(fromApplet.center, s.circle.center, 1e-7) && close(fromApplet.radius, s.circle.radius, 1e-7));
  check("both applet checkboxes start unchecked", !s.addons && !s.drawLong);
  check("an illustration has no result", C.result(s) === null);
  const moved = C.withPoint(s, "A", { x: 0, y: 0 });
  check("withPoint does not change the old position", s.points.A.x === 262.5);
  check("withPoint keeps a dragged dot on the circle",
    close(dist(moved.points.A, moved.circle.center), moved.circle.radius, 1e-9));
  check("withPoint preserves the dragged dot's angle",
    close(Math.atan2(moved.points.A.y - 125, moved.points.A.x - 200),
      Math.atan2(-125, -200), 1e-9));
  check("an unknown dot name leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  const toggled = C.withOptions(s, { addons: true, drawLong: true });
  check("withOptions sets both checkboxes without changing the old one",
    toggled.addons && toggled.drawLong && !s.addons && !s.drawLong);
}

/* ------------------------------- 2. the applet's own construction vs the core */

{
  const rand = rng(4821);
  const trials = [
    ["start", C.start()],
    ["regular hexagon", angleState([0, 1, 2, 3, 4, 5].map((k) => (2 * Math.PI * k) / 6))],
    ["near-parallel tangents", angleState([0, Math.PI - 1e-7, 1.5, 2.2, 3.9, 5.0])],
  ];
  for (let t = 0; t < 400; t++) {
    const angles = Array.from({ length: 6 }, () => rand() * 2 * Math.PI);
    trials.push([`random ${t}`, angleState(angles)]);
  }
  let compared = 0;
  for (const [name, s] of trials) {
    /* In the applet GetCircle is called once at init and the dots then glide
       on that circle, so compare the two transcriptions of the computation
       itself, not a later diagram's fixed circle. */
    const a = appletCircle(s.points.A, s.points.C, s.points.E);
    const c = C.circumcircle(s.points.A, s.points.C, s.points.E);
    check(`${name}: GetCircle matches circumcircle`, samePoint(a.center, c.center, 1e-7) &&
      sameNumber(a.radius, c.radius, 1e-7),
      `applet ${JSON.stringify(a)}, core ${JSON.stringify(c)}`);
    const av = appletVertices(s.points, s.circle);
    const cv = C.vertices(s);
    for (let i = 0; i < 6; i++) {
      if (!samePoint(av[i], cv[i], 1e-6 * s.circle.radius)) {
        check(`${name}: vertex ${i} matches the applet`, false,
          `applet ${JSON.stringify(av[i])}, core ${JSON.stringify(cv[i])}`);
      }
    }
    const al = appletDiagonals(s.points, s.circle), cl = C.diagonals(s);
    for (let i = 0; i < 3; i++) {
      check(`${name}: diagonal ${i} matches the applet`,
        samePoint(al[i][0], cl[i][0], 1e-6 * s.circle.radius) &&
        samePoint(al[i][1], cl[i][1], 1e-6 * s.circle.radius));
    }
    compared++;
  }
  check(`applet and core agree on ${compared} configurations`, compared === trials.length);

  /* The near-parallel case must reproduce the applet's NaN, not a wild point. */
  const edge = trials[2][1];
  const v = C.vertices(edge);
  check("the applet's |det| < 1 test leaves an unusable vertex", !C.isFinitePoint(v[0]));
  check("claims do not assert a theorem with an unusable vertex", !C.claims(edge).finiteVertices &&
    !C.claims(edge).majorDiagonals);
}

/* ---------------------------------------- 3. every claim over many diagrams */

{
  const rand = rng(6132);
  let tested = 0, skipped = 0, quadTested = 0;
  for (let t = 0; t < 500; t++) {
    const angles = Array.from({ length: 6 }, () => rand() * 2 * Math.PI);
    const s = angleState(angles);
    const m = C.measurements(s);
    if (!m.finite) { skipped++; continue; }
    const cl = C.claims(s);
    const all = Object.values(cl).every(Boolean);
    if (!all) check(`diagram ${t}: every claim holds`, false, JSON.stringify(cl));
    /* The page's own wording: the major diagonals meet in a single point. */
    if (m.concurrent.error >= m.tolerance) {
      check(`diagram ${t}: the three diagonals really concur`, false, `error ${m.concurrent.error}`);
    }
    /* Duality: the touch points form a Pascal hexagon; the Brianchon point
       is the pole of its Pascal line. */
    const p = pascal(s.points, s.circle);
    const tol = 1e-5 * s.circle.radius;
    if (C.isFinitePoint(p.pole) && Math.abs(p.third) < tol) {
      if (!closePoint(p.pole, m.concurrent.point, tol)) {
        check(`diagram ${t}: Pascal pole is the Brianchon point`, false,
          `pole ${JSON.stringify(p.pole)}, point ${JSON.stringify(m.concurrent.point)}`);
      }
      quadTested++;
    }
    /* The quadrilateral case: let two pairs of dots coalesce. */
    const q = C.quadrilateral(s);
    if (q && q.error >= m.tolerance) {
      check(`diagram ${t}: the circumscribed quadrilateral case concurs`, false, `error ${q.error}`);
    }
    tested++;
  }
  check(`all claims hold on ${tested} non-degenerate random diagrams`, tested >= 490);
  check(`Pascal's dual was checked on ${quadTested} diagrams`, quadTested >= 480);
  check(`only a handful of diagrams were near-parallel (${skipped})`, skipped <= 6);

  /* Fixed cases: a regular hexagon, a lopsided one, and a quadrilateral. */
  for (const [name, angles] of [
    ["near-regular", [0.04, 1.12, 2.07, 3.15, 4.18, 5.22]],
    ["crowded", [0, 0.1, 0.2, 2.0, 4.0, 5.0]],
    ["alternating", [0, 2.0, 0.3, 2.3, 0.6, 2.6]],
  ]) {
    const s = angleState(angles);
    const cl = C.claims(s);
    check(`${name} hexagon: all claims hold`, Object.values(cl).every(Boolean), JSON.stringify(cl));
    check(`${name} hexagon: Pascal pole matches`, closePoint(
      pascal(s.points, s.circle).pole, C.measurements(s).concurrent.point, 1e-5 * s.circle.radius));
    check(`${name} hexagon: quadrilateral limit concurs`, C.quadrilateral(s) !== null &&
      C.quadrilateral(s).error < C.measurements(s).tolerance);
  }
}

/* --------------------------------- 4. what the extra checkboxes actually draw */

{
  const s = C.start();
  const ch = C.chords(s);
  check("the extra chords join opposite touch points",
    ch.length === 3 && ch[0][0] === s.points.A && ch[0][1] === s.points.D &&
    ch[1][0] === s.points.B && ch[1][1] === s.points.E &&
    ch[2][0] === s.points.C && ch[2][1] === s.points.F);
  const cc = C.concurrency(ch);
  /* The applet's label says "Additional Concurrencies", but for a circle
     these three chords need not meet: the test keeps that honest. */
  const rand = rng(991);
  let notConcurrent = 0;
  for (let t = 0; t < 100; t++) {
    const s2 = angleState(Array.from({ length: 6 }, () => rand() * 2 * Math.PI));
    const q = C.concurrency(C.chords(s2));
    if (!q || q.error > 1e-2 * s2.circle.radius) notConcurrent++;
  }
  check(`the extra chords are not always concurrent (${notConcurrent} of 100)`, notConcurrent > 90);
  check("at the start the extra chords are only nearly concurrent",
    Boolean(cc) && cc.error > 1e-3 * s.circle.radius);
}

done("brianchon");
