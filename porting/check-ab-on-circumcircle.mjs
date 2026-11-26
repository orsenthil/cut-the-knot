#!/usr/bin/env node
"use strict";

/*
 * Logic test for ab-on-circumcircle/ab-on-circumcircle-core.js.
 *
 *   node porting/check-ab-on-circumcircle.mjs
 *
 * Checks the page's claim (AD ⟂ EF) and the construction behind it on seven
 * exact triangles and 600 generated ones, then compares the core with a
 * second, literal transcription of the applet's own Compute() method:
 * GeoSDoub.FindCircumcenter, FindAngleBisector (rotate by half the angle),
 * line/circle intersection, Other(), and the two line intersections for M
 * and I.  The two implementations share no code.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ab-on-circumcircle/ab-on-circumcircle-core.js", "AbOnCircumcircleCore");

/* ------------------------------------------- the applet's own construction */

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// GeoSDoub.ComputeAngle: the angle at the first argument (law of cosines).
function computeAngle(p, q, r) {
  const num = dist(p, q) ** 2 + dist(p, r) ** 2 - dist(q, r) ** 2;
  const den = 2 * dist(p, q) * dist(p, r);
  return Math.acos(Math.max(-1, Math.min(1, num / den)));
}
// GeoSDoub.FindOrientation: 1 when q is to the left of p->r, else -1.
function orientation(p, q, r) {
  return cross(sub(q, p), sub(r, p)) > 0 ? 1 : -1;
}
// GeoSDoub.Rotate: screen-coordinate rotation by `t`, sign `sgn`.
function rotate(center, point, t, sgn) {
  const c = Math.cos(t), s = Math.sin(t);
  const dx = point.x - center.x, dy = point.y - center.y;
  return P(center.x + c * dx - sgn * s * dy,
           center.y + sgn * s * dx + c * dy);
}
// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint).
function intersectLines(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  return P(a.x + r.x * cross(sub(c, a), s) / den,
           a.y + r.y * cross(sub(c, a), s) / den);
}
// GeoSDoub.FindAngleBisector: foot of v's bisector on the opposite side.
function findAngleBisector(v, p, q) {
  const half = computeAngle(v, p, q) / 2;
  const rotated = rotate(v, p, half, orientation(v, p, q));
  return intersectLines(v, rotated, p, q);
}
// GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors.
function findCircumcenter(a, b, c) {
  const ab = C.midpoint(a, b), bc = C.midpoint(b, c);
  const t1 = P(ab.x + (b.y - a.y), ab.y - (b.x - a.x));
  const t2 = P(bc.x + (c.y - b.y), bc.y - (c.x - b.x));
  return intersectLines(ab, t1, bc, t2);
}
// GetCircle: the applet averages the three centre-to-vertex distances.
function getCircle(a, b, c) {
  const o = findCircumcenter(a, b, c);
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}
// Intersect(DoubLine, DoubCircle), written from the line/circle equation.
function intersectLineCircle(v, towards, circle) {
  const d = sub(towards, v);
  const t = -2 * dot(sub(v, circle.c), d) / dot(d, d);
  return [v, add(v, mul(d, t))];
}
// ABOnCircumcircleCanvas.Other: the intersection that is not this vertex.
function other(points, vertex) {
  return dist(points[0], vertex) >= 1 ? points[0] : points[1];
}
// ABOnCircumcircleCanvas.Compute(), method for method.
function appletCompute(a, b, c) {
  const circle = getCircle(a, b, c);
  const E = other(intersectLineCircle(b, findAngleBisector(b, a, c), circle), b);
  const F = other(intersectLineCircle(c, findAngleBisector(c, a, b), circle), c);
  const D = other(intersectLineCircle(a, findAngleBisector(a, b, c), circle), a);
  const M = intersectLines(E, F, a, D);
  const I = intersectLines(a, D, b, E);
  return { circle, D, E, F, M, I };
}

/* ------------------------------------------------------------- test cases */

const exact = [
  ["equilateral", P(200, 50), P(113.397, 225), P(286.603, 225)],
  ["right", P(250, 60), P(110, 220), P(300, 220)],
  ["isosceles", P(200, 60), P(120, 220), P(280, 220)],
  ["obtuse", P(200, 80), P(150, 220), P(380, 200)],
  ["scalene", P(60, 200), P(320, 100), P(180, 50)],
  ["translated", P(30, 30), P(370, 30), P(200, 270)],
  ["nearly flat", P(100, 100), P(300, 100.5), P(200, 110)],
];

function usable(a, b, c) {
  const sides = [dist(b, c), dist(a, c), dist(a, b)];
  const area = Math.abs(cross(sub(b, a), sub(c, a))) / 2;
  if (area < 900) return false;
  const ang = [C.angle(a, b, c), C.angle(b, a, c), C.angle(c, a, b)];
  return ang.every((x) => x > 0.10 && x < 3.0) && sides.every((s) => s > 20);
}

const rand = rng(20261126);
const cases = exact.map(([name, a, b, c]) => ({ name, a, b, c }));
for (let i = 0; i < 300; i++) {
  let a, b, c;
  do {
    a = P(30 + rand() * 340, 30 + rand() * 240);
    b = P(30 + rand() * 340, 30 + rand() * 240);
    c = P(30 + rand() * 340, 30 + rand() * 240);
  } while (!usable(a, b, c));
  cases.push({ name: `random-${i}`, a, b, c });
}
for (let i = 0; i < 300; i++) {
  const o = P(120 + rand() * 160, 100 + rand() * 100);
  const r = 65 + rand() * 45;
  const t = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
  if (t[1] - t[0] < 0.3 || t[2] - t[1] < 0.3) continue;
  const on = (v) => P(o.x + r * Math.cos(v), o.y + r * Math.sin(v));
  const a = on(t[0]), b = on(t[1]), c = on(t[2]);
  if (usable(a, b, c)) cases.push({ name: `on-circle-${i}`, a, b, c });
}

/* ------------------------------------------------------------- 1. the core */

{
  const s = C.start({});
  check("start has the three draggable vertices", [s.A, s.B, s.C].every((p) => p && Number.isFinite(p.x)));
  check("start has the applet's show options", s.options.names === true && s.options.statement === false && s.options.hint === false);
  check("the demo has no result", C.result(s) === null);
  check("a valid start geometry exists", !!C.geometry(s));
  const moved = C.move(s, "A", { x: 9999, y: -9999 });
  check("dragging clamps a vertex to the board", moved.A.x <= C.VIEW.width - 24 && moved.A.y >= 24);
  check("dragging marks the picture explored", moved.explored === true && s.explored === false);
  check("an unknown handle is refused", C.move(s, "Z", { x: 1, y: 1 }) === s);
  const optioned = C.setOption(s, "hint", true);
  check("toggling an option keeps the old state", optioned.options.hint && !s.options.hint);
  check("reset keeps the chosen options", C.reset(optioned).options.hint === true && C.reset(optioned).A.x === s.A.x);
}

/* --------------------------------- 2. the claims, on every exact/random case */

let live = 0, finite = 0, onCircle = 0, arcMid = 0, concur = 0, incenter = 0;
let perpA = 0, perpB = 0, perpC = 0, mOn = 0, rightM = 0;
let angIFM = 0, angFIM = 0, angIMF = 0, inscribed = 0, arcEq = 0, angleSum = 0, halfSum = 0;
let maxErr = 0, maxClaimErr = 0, maxAppletErr = 0;
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

for (const { a, b, c } of cases) {
  const g = C.compute(a, b, c);
  const x = appletCompute(a, b, c);
  if (!g) continue;
  live++;

  const vals = [g.circle.c.x, g.circle.c.y, g.circle.r, g.D.x, g.D.y, g.E.x, g.E.y,
                g.F.x, g.F.y, g.I.x, g.I.y, g.M.x, g.M.y];
  if (vals.every(Number.isFinite)) finite++;
  const deg = [g.angles.A, g.angles.B, g.angles.C];
  if (near(deg[0] + deg[1] + deg[2], Math.PI, 1e-9)) angleSum++;
  if (near((deg[0] + deg[1] + deg[2]) / 2, Math.PI / 2, 1e-9)) halfSum++;

  const R = dist(g.circle.c, a);
  for (const p of [g.D, g.E, g.F]) maxClaimErr = Math.max(maxClaimErr, Math.abs(dist(g.circle.c, p) - R));
  if ([g.D, g.E, g.F].every((p) => near(dist(g.circle.c, p), R, 1e-6))) onCircle++;

  // D, E and F are the midpoints of arcs BC, CA and AB: equal chords.
  const chords = [dist(g.D, b) - dist(g.D, c), dist(g.E, c) - dist(g.E, a), dist(g.F, a) - dist(g.F, b)];
  maxClaimErr = Math.max(maxClaimErr, ...chords.map(Math.abs));
  if (chords.every((d) => Math.abs(d) < 1e-6)) arcMid++;
  if ([dist(g.D, a), dist(g.E, b), dist(g.F, c)].every((d) => d > 1e-6)) arcEq++;

  // The bisectors concur at I; I is the incenter, equidistant from the sides.
  const collinear = [
    C.distanceToLine(g.I, a, g.D), C.distanceToLine(g.I, b, g.E), C.distanceToLine(g.I, c, g.F),
  ];
  if (collinear.every((d) => d < 1e-6)) concur++;
  const toSides = [C.distanceToLine(g.I, b, c), C.distanceToLine(g.I, a, c), C.distanceToLine(g.I, a, b)];
  maxClaimErr = Math.max(maxClaimErr, Math.max(...toSides) - Math.min(...toSides));
  if (Math.max(...toSides) - Math.min(...toSides) < 1e-6) incenter++;

  // The page's claim and its two siblings: AD ⟂ EF, BE ⟂ FD, CF ⟂ DE.
  const perps = [
    dot(sub(g.D, a), sub(g.F, g.E)),
    dot(sub(g.E, b), sub(g.D, g.F)),
    dot(sub(g.F, c), sub(g.E, g.D)),
  ];
  maxClaimErr = Math.max(maxClaimErr, ...perps.map(Math.abs));
  if (Math.abs(perps[0]) < 1e-6) perpA++;
  if (Math.abs(perps[1]) < 1e-6) perpB++;
  if (Math.abs(perps[2]) < 1e-6) perpC++;
  if (C.distanceToLine(g.M, a, g.D) < 1e-6 && C.distanceToLine(g.M, g.E, g.F) < 1e-6) mOn++;

  // ShowStatement: all four corners at M are right angles.
  const atM = [C.angle(g.M, a, g.E), C.angle(g.M, a, g.F),
               C.angle(g.M, g.D, g.E), C.angle(g.M, g.D, g.F)];
  if (atM.every((v) => Math.abs(v - Math.PI / 2) < 1e-6)) rightM++;

  // The article's angle chase, and equal inscribed angles on equal arcs.
  if (dist(g.F, g.I) > 1e-6 && dist(g.F, g.M) > 1e-6) {
    const diff = Math.abs(C.angle(g.F, g.I, g.M) - g.angles.B / 2);
    maxClaimErr = Math.max(maxClaimErr, diff);
    if (diff < 1e-6) angIFM++;
  }
  const aim = C.angle(g.I, g.F, g.M);
  if (Math.abs(aim - (g.angles.A + g.angles.C) / 2) < 1e-6) angFIM++;
  if (Math.abs(C.angle(g.M, g.I, g.F) - Math.PI / 2) < 1e-6) angIMF++;
  // A and E lie on the same arc of chord CF, so ∠CAF = ∠CEF; F and B lie
  // on the same arc of chord CE, so ∠CFE = ∠CBE = B/2.
  const equalAngles = Math.abs(C.angle(a, c, g.F) - C.angle(g.E, c, g.F))
                    + Math.abs(C.angle(g.F, c, g.E) - C.angle(b, c, g.E));
  maxClaimErr = Math.max(maxClaimErr, equalAngles);
  if (equalAngles < 1e-6) inscribed++;

  // Second transcription: same D, E, F, M, I and circle as the applet.
  const errs = [dist(g.circle.c, x.circle.c), Math.abs(g.circle.r - x.circle.r),
    dist(g.D, x.D), dist(g.E, x.E), dist(g.F, x.F), dist(g.I, x.I), dist(g.M, x.M)];
  const worst = Math.max(...errs);
  maxAppletErr = Math.max(maxAppletErr, worst);
  if (worst > maxErr) maxErr = worst;
}

{
  const n = cases.length;
  check(`every exact/generated triangle (${n}) has a geometry`, live === n, `${live}/${n}`);
  check("all computed coordinates are finite", finite === live, `${finite}/${live}`);
  check("the three angles add to 180°", angleSum === live, `${angleSum}/${live}`);
  check("the circumcircle is equidistant from the vertices", onCircle === live, `${onCircle}/${live}`);
  check("D, E and F are the far intersections, not the vertices", arcEq === live, `${arcEq}/${live}`);
  check("D, E and F bisect their arcs (equal chords)", arcMid === live, `${arcMid}/${live}`);
  check("the three bisectors concur at I", concur === live, `${concur}/${live}`);
  check("I is the incenter (equal distance to the three sides)", incenter === live, `${incenter}/${live}`);
  check("the page's claim AD ⟂ EF holds", perpA === live, `${perpA}/${live}`);
  check("BE ⟂ FD also holds", perpB === live, `${perpB}/${live}`);
  check("CF ⟂ DE also holds", perpC === live, `${perpC}/${live}`);
  check("M lies on both AD and EF", mOn === live, `${mOn}/${live}`);
  check("all four angles at M are right angles", rightM === live, `${rightM}/${live}`);
  check("∠IFM = ∠CFE = ∠CBE = B/2", angIFM === live, `${angIFM}/${live}`);
  check("∠FIM = ∠ACI + ∠CAI = A/2 + C/2", angFIM === live, `${angFIM}/${live}`);
  check("the remaining angle at M is 90°", angIMF === live, `${angIMF}/${live}`);
  check("equal arcs subtend equal inscribed angles", inscribed === live, `${inscribed}/${live}`);
  check("A/2 + B/2 + C/2 = 90° on every triangle", halfSum === live, `${halfSum}/${live}`);
  check(`the geometry claims hold to ${maxClaimErr.toExponential(1)}`, maxClaimErr < 1e-6);
  check(`the core matches the applet's Compute() within ${maxAppletErr.toExponential(1)}`, maxAppletErr < 1e-5);
}

/* ------------------------------------- 3. status text and an explored state */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the default status describes the three arc midpoints", /D, E and F/.test(C.describe(s)));
  check("statement mode describes the right angles", /perpendicular/.test(C.describe(C.setOption(s, "statement", true))));
  check("hint mode quotes the angle chase", /∠IFM/.test(C.describe(C.setOption(s, "hint", true))));
  const moved = C.move(s, "B", P(170, 210));
  check("moving a vertex changes the circle", dist(C.geometry(moved).circle.c, g.circle.c) > 1e-6);
  check("the moved triangle still satisfies the page's claim",
    Math.abs(dot(sub(C.geometry(moved).D, moved.A),
                 sub(C.geometry(moved).F, C.geometry(moved).E))) < 1e-6);
}

done("ab-on-circumcircle");
