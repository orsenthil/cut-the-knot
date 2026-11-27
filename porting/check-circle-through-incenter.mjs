#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-through-incenter/circle-through-incenter-core.js.
 *
 *   node porting/check-circle-through-incenter.mjs
 *
 * Checked: the starting triangle against CircleThroughIncenterCanvas.init's
 * cos/sin placement; a second, literal transcription of the applet's own
 * GeoSDoub methods (FindIncenter by rotated bisector rays, FindCircumcenter by
 * perpendicular-bisector intersection, IntersectX/Y of a circle and a line,
 * and Other's one-pixel rule) compared with the core on fixed triangles and
 * hundreds of random ones; and every claim of the applet's page and its
 * summary article on each of them: AX = BY, the centre of (ABI) on the C
 * bisector and on the circumcircle of ABC, symmetry about that bisector,
 * J on the circle, the chord BE = AB with angle ABE = ACB and BE perpendicular
 * to BO. Tangency when AC = BC is covered as well.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-through-incenter/circle-through-incenter-core.js", "CircleThroughIncenterCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const scale = (s) => Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));

/* ------------- the applet's own arithmetic, transcribed from the bytecode */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const apDist = (p, q) => Math.sqrt(sq(p, q));

/* GeoSDoub.ComputeAngle(P,Q,R): the angle at P. */
function apAngle(P, Q, R) {
  const numerator = (sq(P, Q) + sq(P, R) - sq(Q, R)) / 2;
  return Math.acos(numerator / (apDist(P, Q) * apDist(P, R)));
}

/* GeoSDoub.FindOrientation(A,B,C): +1 for a left turn, else -1. */
function apOrientation(A, B, Cc) {
  const s = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(P,Q,angle,orientation). */
function apRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect of two lines, with its one-unit determinant guard. */
function apIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindIncenter: intersect the rotated rays at A and at B. */
function apIncenter(A, B, Cc) {
  const halfA = apAngle(A, B, Cc) / 2;
  const halfB = apAngle(B, Cc, A) / 2;
  const orient = apOrientation(A, B, Cc);
  return apIntersect(A, apRotate(A, B, halfA, orient), B, apRotate(B, Cc, halfB, orient));
}

/* GeoSDoub.FindCircumcenter: intersect the perpendicular bisectors of AB and BC. */
function apCircumcenter(A, B, Cc) {
  const m1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const m2 = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  return apIntersect(
    m1, { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) },
    m2, { x: m2.x + (Cc.y - B.y), y: m2.y - (Cc.x - B.x) },
  );
}

/* GeoSDoub.IntersectX(DoubLine,DoubCircle): y is the free variable. */
function apIntersectX(p, q, circle) {
  const slope = (p.x - q.x) / (p.y - q.y);
  const b = q.x - slope * q.y;
  const aa = slope * slope + 1;
  const bb = slope * (b - circle.center.x) - circle.center.y;
  const cc = circle.center.y ** 2 + (b - circle.center.x) ** 2 - circle.radius ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-bb + root) / aa, y2 = (-bb - root) / aa;
  return [{ x: slope * y1 + b, y: y1 }, { x: slope * y2 + b, y: y2 }];
}

/* GeoSDoub.IntersectY(DoubLine,DoubCircle): x is the free variable. */
function apIntersectY(p, q, circle) {
  const slope = (p.y - q.y) / (p.x - q.x);
  const b = q.y - slope * q.x;
  const aa = slope * slope + 1;
  const bb = slope * (b - circle.center.y) - circle.center.x;
  const cc = circle.center.x ** 2 + (b - circle.center.y) ** 2 - circle.radius ** 2;
  const disc = bb * bb - aa * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-bb + root) / aa, x2 = (-bb - root) / aa;
  return [{ x: x1, y: slope * x1 + b }, { x: x2, y: slope * x2 + b }];
}

/* GeoSDoub.Intersect(DoubLine,DoubCircle): pick X or Y by the line's slope. */
function apCircleLine(circle, p, q) {
  if (Math.abs(p.y - q.y) > 1) return apIntersectX(p, q, circle);
  if (Math.abs(p.x - q.x) > 1) return apIntersectY(p, q, circle);
  return null;
}

/* CircleThroughIncenterCanvas.Other: keep the point far from the reference. */
function apOther(points, ref) {
  if (!points) return null;
  return apDist(points[0], ref) >= 1 ? points[0] : points[1] || points[0];
}

/* CircleThroughIncenterCanvas.Compute, in the bytecode's order. */
function apCompute(s) {
  const I = apIncenter(s.A, s.B, s.C);
  const circle = { center: apCircumcenter(s.A, s.B, I) };
  circle.radius =
    (apDist(circle.center, s.A) + apDist(circle.center, s.B) + apDist(circle.center, I)) / 3;
  const X = apOther(apCircleLine(circle, s.C, s.A), s.A);
  const Y = apOther(apCircleLine(circle, s.C, s.B), s.B);
  const J = apOther(apCircleLine(circle, s.C, I), I);
  return { I, circle, X, Y, J };
}

/* --------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  const radius = 450 / 4;
  const at = (a) => ({ x: 300 + radius * Math.cos(a), y: 225 + radius * Math.sin(a) });
  equal("start A matches the applet's cos(-1.6), sin(-1.6)", s.A, at(-1.6));
  equal("start B matches the applet's cos(-4), sin(-4)", s.B, at(-4));
  equal("start C matches the applet's cos(-0.2), sin(-0.2)", s.C, at(-0.2));
  const small = C.start({ width: 400, height: 300 });
  check("a 400x300 canvas uses min(width,height)/4", Math.abs(small.A.y - (150 + 75 * Math.sin(-1.6))) < 1e-12);
  check("a fresh diagram has no result", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === at(-1.6).x && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);
}

/* --------------------------------- 2. fixed triangles, including isosceles */

const fixed = [
  ["applet start", C.start()],
  ["equilateral", tri({ x: 300, y: 40 }, { x: 90, y: 360 }, { x: 510, y: 360 })],
  ["right angle at B", tri({ x: 80, y: 330 }, { x: 80, y: 50 }, { x: 470, y: 330 })],
  ["obtuse at A", tri({ x: 90, y: 210 }, { x: 520, y: 110 }, { x: 450, y: 330 })],
  ["obtuse at B", tri({ x: 270, y: 30 }, { x: 60, y: 400 }, { x: 550, y: 380 })],
  ["obtuse at C", tri({ x: 60, y: 60 }, { x: 540, y: 80 }, { x: 290, y: 380 })],
  ["very flat", tri({ x: 50, y: 220 }, { x: 550, y: 235 }, { x: 300, y: 270 })],
  ["isosceles, AC = BC", tri({ x: 180, y: 120 }, { x: 420, y: 120 }, { x: 300, y: 380 })],
];

const everyCase = [];
for (const [name, s] of fixed) everyCase.push([name, s]);
{
  const rand = rng(3362);
  for (let i = 0; i < 320; i++) {
    const s = tri(
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
      { x: 20 + rand() * 560, y: 20 + rand() * 410 },
    );
    const area2 = Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x));
    if (!C.isDegenerate(s) && area2 > 2000) everyCase.push([`random ${i}`, s]);
  }
}
check(`collected ${everyCase.length} non-degenerate configurations`, everyCase.length >= 250);

/* ----------------------- 3. the applet's computation vs the core's answer */

{
  let compared = 0;
  const agree = { incenter: 0, centre: 0, X: 0, Y: 0, J: 0, radius: 0 };
  for (const [name, s] of everyCase) {
    const tol = 3e-5 * scale(s);
    const ap = apCompute(s);
    const core = C.measure(s);
    const points = [
      ["incenter", "incenter", ap.I, core.I],
      ["circle centre", "centre", ap.circle.center, core.Oc],
      ["X", "X", ap.X, core.X],
      ["Y", "Y", ap.Y, core.Y],
      ["J", "J", ap.J, core.J],
    ];
    for (const [what, key, a, b] of points) {
      if (closePoint(a, b, tol)) agree[key]++;
      else check(`${name}: ${what} matches the applet`, false,
        `applet ${JSON.stringify(a)}, core ${JSON.stringify(b)}`);
    }
    if (close(ap.circle.radius, core.circle.radius, tol)) agree.radius++;
    else check(`${name}: circle radius matches the applet`, false,
      `applet ${ap.circle.radius}, core ${core.circle.radius}`);
    compared++;
  }
  for (const [what, count] of Object.entries(agree)) {
    check(`${what} matches the applet on all ${compared} triangles`, count === compared);
  }
  check(`the core matches the applet's computation on ${compared} triangles`, compared === everyCase.length);
}

/* --------------------------------- 4. every claim on the page, every time */

{
  const passed = {};
  let failed = 0;
  for (const [name, s] of everyCase) {
    const cl = C.claims(s);
    for (const [claim, value] of Object.entries(cl)) {
      passed[claim] = (passed[claim] || 0) + (value ? 1 : 0);
      if (!value) {
        failed++;
        check(`${name}: ${claim}`, false, JSON.stringify(C.measure(s)));
      }
    }
  }
  for (const [claim, count] of Object.entries(passed)) {
    check(`${claim} holds on all ${everyCase.length} configurations`, count === everyCase.length);
  }
  check(`all ten claims hold on all ${everyCase.length} configurations`, failed === 0);

  /* The page's stated reason: angle AIB = 90 degrees + half of angle C. */
  let bad = 0;
  for (const [, s] of everyCase) {
    const m = C.measure(s);
    const gamma = C.angleAt(s.C, s.A, s.B) / 2;
    if (Math.abs(m.angleAIB - (Math.PI / 2 + gamma)) > 1e-9) bad++;
  }
  check("angle AIB = 90 degrees + gamma throughout", bad === 0);
}

/* --------------------------- 5. degenerate and tangency edge cases */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear corners are degenerate", C.isDegenerate(flat));
  check("no incenter for a collinear triangle", C.incenter(flat) === null);
  check("no circle for a collinear triangle", C.abiCircle(flat) === null);
  check("no claims pass for a collinear triangle", !Object.values(C.claims(flat)).some(Boolean));
  const same = tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 });
  check("coincident corners are degenerate too", C.isDegenerate(same));
  check("Other keeps the far point", closePoint(
    C.other([{ x: 100, y: 0 }, { x: 200, y: 0 }], { x: 0, y: 0 }), { x: 100, y: 0 }, 1e-12));
  check("Other rejects the reference point", closePoint(
    C.other([{ x: 0, y: 0 }, { x: 200, y: 0 }], { x: 0, y: 0 }), { x: 200, y: 0 }, 1e-12));
  const tangent = C.measure(fixed[7][1]);
  check("when AC = BC the second crossing at A is A itself", dist(tangent.X, tangent.A) < 1e-4,
    `X ${JSON.stringify(tangent.X)}, A ${JSON.stringify(tangent.A)}`);
  check("when AC = BC the second crossing at B is B itself", dist(tangent.Y, tangent.B) < 1e-4,
    `Y ${JSON.stringify(tangent.Y)}, B ${JSON.stringify(tangent.B)}`);
}

done("circle-through-incenter");
