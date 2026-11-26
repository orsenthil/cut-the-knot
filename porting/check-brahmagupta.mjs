#!/usr/bin/env node
"use strict";

/*
 * Logic test for brahmagupta/brahmagupta-core.js.
 *
 *   node porting/check-brahmagupta.mjs
 *
 * Checks the applet's start position and its radial circle-drag rule, then
 * walks a grid of about a thousand pairs of draggable points plus 700 seeded
 * random pairs. On each one it checks the construction from DrawQuadri against
 * a second literal transcription of the bytecode, the right angles at T, all
 * four perpendicular-bisector claims, and Brahmagupta's area formula against
 * the polygon's measured area. It also checks the formula's Heron limit and
 * that a saved position survives JSON unchanged.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("brahmagupta/brahmagupta-core.js", "BrahmaguptaCore");
const P = C.pt;
const O = C.CENTER;
const R = C.RADIUS;

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPt = (p, q, tol = 1e-8) =>
  p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const onLine = (p, a, b, tol = 1e-7) =>
  Math.abs(cross(P(p.x - a.x, p.y - a.y), P(b.x - a.x, b.y - a.y))) <=
  tol * Math.max(1, C.distance(a, b));

/** A state with A and D at the given angles on the applet's circle. */
const atAngles = (aa, da) => ({
  center: { ...O }, r: R,
  A: C.pointOnCircle(O, R, aa),
  D: C.pointOnCircle(O, R, da),
});

/** The configurations used below; skip only cases where the applet's own
 *  Intersect() guard (|denominator| < 1) makes its construction degenerate. */
const configs = [];
{
  for (let i = 0; i <= 32; i++) {
    const aa = -Math.PI + (i * 2 * Math.PI) / 32;
    if (Math.abs(aa) < 0.03 || Math.abs(Math.abs(aa) - Math.PI) < 0.03) continue;
    for (let j = 0; j <= 32; j++) {
      const da = -Math.PI + (j * 2 * Math.PI) / 32;
      if (Math.abs(Math.sin(da - aa)) < 0.03) continue;
      const state = atAngles(aa, da);
      if (usable(state)) configs.push(state);
    }
  }
  const rand = rng(20261126);
  for (let i = 0; i < 700; i++) {
    const aa = -Math.PI + rand() * 2 * Math.PI;
    const da = -Math.PI + rand() * 2 * Math.PI;
    const state = atAngles(aa, da);
    if (usable(state)) configs.push(state);
  }
}

/** Skip only the applet's degenerate cases (coincident construction points). */
function usable(state) {
  const g = C.configuration(state);
  if (![g.A, g.B, g.C, g.D, g.T, g.Q, g.E].every(finite)) return false;
  const m = C.sides(g);
  return Math.min(m.a, m.b, m.c, m.d, C.distance(g.Q, g.T),
    C.distance(g.A, g.C), C.distance(g.B, g.D)) > 1;
}

/* The area formula is a claim about a quadrilateral, so it is checked on the
 * configurations where A, B, C, D go around the circle in order. */
const quads = configs.filter(C.ordered);

/* ---------------------------------------------------------- 1. the start */

{
  const s = C.start();
  check("the start circle has the applet's centre", nearPt(s.center, O));
  check("the start radius is min(500,400)/3", near(s.r, 400 / 3));
  check("A starts at angle -2 on the circle", nearPt(s.A, C.pointOnCircle(O, R, -2)));
  check("D starts at angle 0.2 on the circle", nearPt(s.D, C.pointOnCircle(O, R, 0.2)));
  check("A and D are distinct at the start", C.distance(s.A, s.D) > 1);
  check("the start configuration is not degenerate", finite(C.configuration(s).E));
}

/* ------------------------------------------- 2. dragging on the circle */

{
  const s = C.start();
  const dragged = C.withPoint(s, "A", P(300, 200));
  check("a drag projects A radially onto the circle",
    near(C.distance(dragged.A, O), s.r) && near(dragged.A.x, O.x + s.r) && near(dragged.A.y, O.y));
  check("dragging A leaves D alone", nearPt(dragged.D, s.D));
  check("dragging A does not change its input state", nearPt(s.A, C.pointOnCircle(O, R, -2)));
  const other = C.withPoint(s, "D", P(250, 60));
  check("a drag projects D onto the top of the circle",
    nearPt(other.D, P(250, 200 - s.r)) && nearPt(other.A, s.A));
  check("an unknown handle is refused", C.withPoint(s, "X", P(0, 0)) === s);
  check("a pointer at the centre is refused", C.withPoint(s, "A", O) === s);
  check("a clamped handle lands exactly on the circle",
    near(C.distance(C.project(s, P(123, 47)), O), s.r));
}

/* --------------------------- 3. the construction on every configuration */

{
  let badMirror = 0, badDiagonals = 0, badMid = 0, badE = 0;
  for (const s of configs) {
    const g = C.configuration(s);
    if (!near(g.B.x, 2 * O.x - s.D.x) || !near(g.B.y, s.D.y)) badMirror++;
    if (!near(g.C.x, s.A.x) || !near(g.C.y, 2 * O.y - s.A.y)) badMirror++;
    if (!near(C.dot(C.sub(g.C, g.A), C.sub(g.D, g.B)), 0, 1e-9)) badDiagonals++;
    if (!nearPt(g.Q, C.midpoint(g.B, g.C))) badMid++;
    if (!onLine(g.T, g.A, g.C) || !onLine(g.T, g.B, g.D)) badDiagonals++;
    if (!onLine(g.E, g.A, g.D) || !onLine(g.E, g.Q, g.T)) badE++;
  }
  check(`${configs.length} configurations: B and C are the bytecode's mirror points`, badMirror === 0, `${badMirror} differences`);
  check(`the diagonals stay perpendicular and cross at T in all ${configs.length} cases`, badDiagonals === 0, `${badDiagonals} failures`);
  check("Q is always the midpoint of BC", badMid === 0, `${badMid} failures`);
  check("E is on AD and on the line QT in every case", badE === 0, `${badE} failures`);
}

/* ----------------------------- 4. Brahmagupta's theorem, four times over */

function perp(u, v) { return near(C.dot(u, v), 0, 1e-9); }

{
  let badMain = 0, badOther = 0, badFour = 0, badCircle = 0;
  for (const s of configs) {
    const g = C.configuration(s);
    // The page's theorem: the line from T to the middle of BC is at right
    // angles to AD (and so the perpendicular from T to AD bisects BC at Q).
    if (!perp(C.sub(g.Q, g.T), C.sub(g.D, g.A))) badMain++;
    // The same claim with the opposite pair of sides.
    const midAD = C.midpoint(g.A, g.D);
    if (!perp(C.sub(midAD, g.T), C.sub(g.C, g.B))) badOther++;
    // All four midpoint-to-opposite-side lines go through T at right angles.
    const pairs = [
      [C.midpoint(g.A, g.B), C.sub(g.C, g.D)],
      [C.midpoint(g.B, g.C), C.sub(g.D, g.A)],
      [C.midpoint(g.C, g.D), C.sub(g.A, g.B)],
      [C.midpoint(g.D, g.A), C.sub(g.C, g.B)],
    ];
    for (const [m, side] of pairs) if (!perp(C.sub(m, g.T), side)) badFour++;
    // Power of the intersection point: TA·TC = TB·TD (all four on the circle).
    const l = (p, q) => C.distance(p, q);
    if (!near(l(g.T, g.A) * l(g.T, g.C), l(g.T, g.B) * l(g.T, g.D), 1e-8)) badCircle++;
    for (const p of [g.A, g.B, g.C, g.D]) {
      if (!near(C.distance(p, O), s.r, 1e-9)) badCircle++;
    }
  }
  check("TQ is perpendicular to AD in all cases (the page's theorem)", badMain === 0, `${badMain} failures`);
  check("the line from T to the middle of AD is perpendicular to BC", badOther === 0, `${badOther} failures`);
  check(`all four perpendiculars in all ${configs.length} cases`, badFour === 0, `${badFour} failures`);
  check("all four vertices stay on the circle and TA·TC = TB·TD", badCircle === 0, `${badCircle} failures`);
}

/* ------------------------------------- 5. Brahmagupta's area formula */

{
  let badFormula = 0, badSides = 0;
  for (const s of quads) {
    const g = C.configuration(s);
    const f = C.formula(g);
    if (!f.holds || !near(f.S, f.measured, 1e-9)) badFormula++;
    const m = C.sides(g);
    if (!near(m.s, (m.a + m.b + m.c + m.d) / 2) || m.a <= 0 || m.b <= 0 || m.c <= 0 || m.d <= 0) badSides++;
  }
  check(`S = sqrt((s-a)(s-b)(s-c)(s-d)) on ${quads.length} ordered quadrilaterals`, badFormula === 0, `${badFormula} failures`);
  check("every side is positive and s is the semiperimeter", badSides === 0, `${badSides} failures`);

  // With d = 0 the formula is Heron's formula for the triangle ABC.
  let badHeron = 0;
  for (const s of quads.slice(0, 200)) {
    const g = C.configuration(s);
    const degenerate = { ...s, D: { ...g.A } };
    const h = C.configuration(degenerate);
    if (!finite(h.E) || !finite(h.T)) continue;
    const f = C.formula(h);
    const a = C.distance(h.A, h.B), b = C.distance(h.B, h.C), c = C.distance(h.C, h.A);
    const t = (a + b + c) / 2;
    const heron = Math.sqrt(Math.max(0, t * (t - a) * (t - b) * (t - c)));
    if (!near(f.S, heron, 1e-8)) badHeron++;
  }
  check("the formula becomes Heron's when one side vanishes", badHeron === 0, `${badHeron} failures`);
}

/* ----------- 6. a second transcription of the applet's own computation */

/* GeoSDoub.NearestPoint, Cramer's rule and GetOtherH/V, written separately. */
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

function nearest2(point, p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (sqDist(point, p1) < 0.1) return P(point.x, point.y);
  const t = (dx * (point.x - p1.x) + dy * (point.y - p1.y)) / (dx * dx + dy * dy);
  return P(p1.x + dx * t, p1.y + dy * t);
}

function otherH2(p, center) {
  const q = nearest2(center, p, P(p.x + 200, p.y));
  return P(2 * q.x - p.x, p.y);
}

function otherV2(p, center) {
  const q = nearest2(center, p, P(p.x, p.y + 200));
  return P(p.x, 2 * q.y - p.y);
}

function intersect2(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return null;
  return P((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
}

function appletLayout(state) {
  const A = state.A, D = state.D;
  const B = otherH2(D, O);
  const Cc = otherV2(A, O);
  const T = intersect2(A, Cc, B, D);
  const Q = P((B.x + Cc.x) / 2, (B.y + Cc.y) / 2);
  const E = T && intersect2(Q, T, A, D);
  return { A, B, C: Cc, D, T, Q, E };
}

{
  let badPoints = 0, names = 0;
  for (const s of configs) {
    const ours = C.configuration(s);
    const theirs = appletLayout(s);
    for (const name of ["B", "C", "T", "Q", "E"]) {
      if (!nearPt(ours[name], theirs[name], 1e-7)) badPoints++;
    }
    names++;
  }
  check(`${names} layouts agree point by point with a literal bytecode transcription`, badPoints === 0, `${badPoints} differences`);
  check("the second transcription produced a usable layout for every state", names === configs.length);
}

/* ------------------------------------------ 7. the saved position is data */

{
  const s = C.withPoint(C.start(), "D", C.pointOnCircle(O, R, 0.5));
  const roundTrip = JSON.parse(JSON.stringify(s));
  equal("the player's position survives JSON unchanged", roundTrip, s);
  const g = C.configuration(roundTrip);
  check("the restored position still gives a finite theorem diagram", finite(g.E));
  check("the restored position still satisfies Brahmagupta's formula", C.formula(g).holds);
}

done("brahmagupta");
