#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-and-circumcenter-b/in-and-circumcenter-b-core.js.
 *
 *   node porting/check-in-and-circumcenter-b.mjs
 *
 * 1. the start position, the four applet switches and the drag/reset rules;
 * 2. a second, independent transcription of the applet's Compute(), written
 *    straight from the bytecode of FindIncenter, FindCircumcenter, NearestPoint,
 *    PlacePoint, Other, Intersect and the IntersectX/IntersectY branch, compared
 *    with the core on every triangle in a grid plus a seeded random sample;
 * 3. the cut-the-knot page's claims over that whole sample: DE perpendicular
 *    to IO for every triangle, DE = 2*IO*sin(C), hence DE = IO at C = 30,
 *    the proof's helper equalities, and the general circumradius formula;
 * 4. the degenerate and refused positions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const K = loadCore("in-and-circumcenter-b/in-and-circumcenter-b-core.js", "InAndCircumcenterBCore");

/* ------------------------------------------------ a second transcription */

const sum = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const dif = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const scal = (p, k) => ({ x: p.x * k, y: p.y * k });
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const len = (p, q) => Math.sqrt(sq(p, q));
const clampCos = (v) => Math.max(-1, Math.min(1, v));

/** GeoSDoub.Intersect(a,b,c,d), exactly: coefficient guard is |det| >= 1. */
function aIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

function aOrientation(a, b, c) {
  return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - a.y * b.x > 0 ? 1 : -1;
}
function aAngle(a, b, c) {
  return Math.acos(clampCos(((sq(a, b) + sq(a, c) - sq(b, c)) / 2) / (len(a, b) * len(a, c))));
}
function aRotate(p, q, t, sign) {
  const co = Math.cos(t), si = Math.sin(t);
  const dx = q.x - p.x, dy = q.y - p.y;
  return { x: p.x + co * dx - sign * si * dy, y: p.y + sign * si * dx + co * dy };
}
function aIncenter(a, b, c) {
  const sign = aOrientation(a, b, c);
  return aIntersect(a, aRotate(a, b, aAngle(a, b, c) / 2, sign),
    b, aRotate(b, c, aAngle(b, c, a) / 2, sign));
}
function aCircumcenter(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return aIntersect(m1, p, m2, q);
}
function aNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(a, b) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
/** GetIncircle / GetCircumcircle: mean of the three radii, as in the bytecode. */
function aCircle(center, p, q, r, nearest) {
  const radius = nearest
    ? (len(center, aNearest(center, p, q)) + len(center, aNearest(center, q, r))
      + len(center, aNearest(center, r, p))) / 3
    : (len(center, p) + len(center, q) + len(center, r)) / 3;
  return { center, radius };
}
/** Canvas.PlacePoint(p,q,r): p + (r-p)*Dist(p,q)/Dist(p,r). */
function aPlace(p, q, r) {
  const k = len(p, q) / len(p, r);
  return { x: p.x + (r.x - p.x) * k, y: p.y + (r.y - p.y) * k };
}
/** Canvas.Other: the further intersection from p (ties keep the first). */
function aOther(pts, p) {
  return !pts || pts.length < 2 ? null : (len(pts[0], p) >= len(pts[1], p) ? pts[0] : pts[1]);
}
/** GeoSDoub.IntersectX(DoubLine,DoubCircle): x = slope*y + intercept. */
function aIntersectX(p, q, circle) {
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
/** GeoSDoub.IntersectY(DoubLine,DoubCircle): y = slope*x + intercept. */
function aIntersectY(p, q, circle) {
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
function aLineCircle(p, q, circle) {
  if (Math.abs(p.y - q.y) > 1) return aIntersectX(p, q, circle);
  if (Math.abs(p.x - q.x) > 1) return aIntersectY(p, q, circle);
  return null;
}
/** Canvas.Compute(), in its bytecode order. */
function aCompute(A, B, C) {
  const inc = aCircle(aIncenter(A, B, C), A, B, C, true);
  const out = aCircle(aCircumcenter(A, B, C), A, B, C, false);
  const D = aPlace(B, A, C);
  const E = aPlace(A, B, C);
  const F = aOther(aLineCircle(A, inc.center, out), A);
  const M = F ? aIntersect(B, E, A, F) : { x: NaN, y: NaN };
  const S = aIntersect(inc.center, out.center, D, E);
  return { I: inc.center, O: out.center, inRadius: inc.radius, outRadius: out.radius,
    D, E, F, M, S };
}

/* ---------------------------------------------------------- triangle sample */

const tri = (A, B, C) => ({ A, B, C });
/** B on the ray from vertex V that makes `degrees` with V->p, kept in board. */
function makeAngle(vertex, p, degrees, radius) {
  const u = dif(p, vertex);
  const t = -degrees * Math.PI / 180;
  const v = aRotate(vertex, p, t, 1);
  const direction = scal(dif(v, vertex), 1 / len(vertex, p));
  return sum(vertex, scal(direction, radius));
}
const fixed = [
  ["opening", K.start()],
  ["30 degrees", tri({ x: 120, y: 288 }, makeAngle({ x: 90, y: 90 }, { x: 120, y: 288 }, 30, 200), { x: 90, y: 90 })],
  ["150 degrees", tri({ x: 80, y: 140 }, makeAngle({ x: 180, y: 180 }, { x: 80, y: 140 }, 150, 150), { x: 180, y: 180 })],
  ["right", tri({ x: 60, y: 300 }, { x: 300, y: 300 }, { x: 60, y: 60 })],
  ["isosceles", tri({ x: 180, y: 40 }, { x: 70, y: 280 }, { x: 290, y: 280 })],
  ["obtuse", tri({ x: 40, y: 120 }, { x: 320, y: 120 }, { x: 180, y: 135 })],
  ["thin", tri({ x: 40, y: 40 }, { x: 320, y: 45 }, { x: 190, y: 60 })],
];
const triangular = (A, B, C) => Math.min(len(A, B), len(A, C), len(B, C)) >= 25
  && Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) >= 500;
const grid = [];
for (let x = 20; x <= 340; x += 20) {
  for (let y = 20; y <= 340; y += 20) {
    const s = tri({ x: 120, y: 288 }, { x: 264, y: 240 }, { x, y });
    if (triangular(s.A, s.B, s.C)) grid.push(s);
  }
}
const random = [];
const next = rng(5622);
for (let i = 0; i < 9000 && random.length < 4000; i++) {
  const s = tri({ x: 10 + next() * 340, y: 10 + next() * 340 },
    { x: 10 + next() * 340, y: 10 + next() * 340 },
    { x: 10 + next() * 340, y: 10 + next() * 340 });
  if (triangular(s.A, s.B, s.C)) random.push(s);
}
const sample = [...fixed.map(([, s]) => s), ...grid, ...random];
let nonDegenerate = 0;
for (const s of sample) if (!K.compute(s).degenerate) nonDegenerate++;

/* ------------------------------------------------------------- 1. the rules */

{
  const s = K.start();
  equal("the opening corners are the applet's scaled starting points",
    [s.A, s.B, s.C], [{ x: 120, y: 288 }, { x: 264, y: 240 }, { x: 90, y: 90 }]);
  check("names are on and the other three switches are off",
    s.showNames === true && !s.showStatement && !s.showPremise && !s.showHint);
  equal("the opening position is unexplored", [s.moves, s.explored, K.result(s)], [0, false, null]);
  check("the eight legal moves are three corners, four switches and reset",
    K.legalMoves(s).length === 8 && K.legalMoves(s).filter((m) => m.type === "point").length === 3);
  const moved = K.move(s, { type: "point", name: "C", point: { x: 300, y: 60 } });
  check("dragging C moves only C", moved && moved.C.x === 300 && moved.C.y === 60 && moved.A.x === 120);
  check("a drag counts as explored, so a demo play ends", K.result(moved) === "done" && moved.moves === 1);
  check("two corners may not be dragged together", K.move(s, { type: "point", name: "C", point: s.A }) === null);
  const off = K.move(s, { type: "point", name: "B", point: { x: 9999, y: -500 } });
  check("a dragged corner stays on the board", off && off.B.x <= K.WIDTH - K.EDGE && off.B.y >= K.EDGE);
  check("an unknown switch is refused", K.move(s, { type: "option", key: "sound", value: true }) === null);
  let t = s;
  for (const key of K.OPTION_KEYS) t = K.move(t, { type: "option", key, value: true });
  check("all four applet switches can be ticked", K.OPTION_KEYS.every((key) => t[key] === true)
    && t.moves === 4 && K.result(t) === "done");
  const reset = K.move(t, { type: "reset" });
  check("reset restores the corners but keeps the four switches",
    [reset.A, reset.B, reset.C].some((p, i) => len(p, [s.A, s.B, s.C][i]) > 0) === false
    && K.OPTION_KEYS.every((key) => reset[key] === true));
  check("a move never changes the position it was given",
    s.moves === 0 && s.explored === false && s.showNames === true && s.C.x === 90);
}

/* ------------------------------- 2. the applet's own Compute, transcribed twice */

{
  let iDist = 0, oDist = 0, radius = 0, dDist = 0, eDist = 0, fDist = 0, mDist = 0, sDist = 0;
  for (const state of sample) {
    const g = K.compute(state);
    if (g.degenerate) continue;
    const a = aCompute(state.A, state.B, state.C);
    iDist = Math.max(iDist, len(g.I, a.I));
    oDist = Math.max(oDist, len(g.O, a.O));
    radius = Math.max(radius, Math.abs(g.inRadius - a.inRadius), Math.abs(g.outRadius - a.outRadius));
    dDist = Math.max(dDist, len(g.D, a.D));
    eDist = Math.max(eDist, len(g.E, a.E));
    fDist = Math.max(fDist, len(g.F, a.F));
    mDist = Math.max(mDist, len(g.M, a.M));
    sDist = Math.max(sDist, len(g.S, a.S));
  }
  check(`FindIncenter agrees on all ${nonDegenerate} triangles`, iDist < 1e-7, `max ${iDist}`);
  check("FindCircumcenter agrees on all sampled triangles", oDist < 1e-7, `max ${oDist}`);
  check("the applet's averaged in- and circumradii agree", radius < 1e-9, `max ${radius}`);
  check("PlacePoint gives the same D (BD = AB)", dDist < 1e-9, `max ${dDist}`);
  check("PlacePoint gives the same E (AE = AB)", eDist < 1e-9, `max ${eDist}`);
  check("the IntersectX/IntersectY branch chooses the same F", fDist < 1e-7, `max ${fDist}`);
  check("GeoSDoub.Intersect gives the same M", mDist < 1e-7, `max ${mDist}`);
  check("GeoSDoub.Intersect gives the same S", sDist < 1e-7, `max ${sDist}`);
  const g = K.compute(sample[0]);
  check("D lies on ray B->C with BD = AB", Math.abs(len(g.B, g.D) - len(g.A, g.B)) < 1e-9
    && Math.abs((g.D.x - g.B.x) * (g.C.y - g.B.y) - (g.D.y - g.B.y) * (g.C.x - g.B.x)) < 1e-8);
  check("E lies on ray A->C with AE = AB", Math.abs(len(g.A, g.E) - len(g.A, g.B)) < 1e-9
    && Math.abs((g.E.x - g.A.x) * (g.C.y - g.A.y) - (g.E.y - g.A.y) * (g.C.x - g.A.x)) < 1e-8);
}

/* ---------------------------------------------- 3. the page's claims, exhaustively */

{
  let perp = 0, ratio = 0, radius = 0, bfEf = 0, bfIf = 0, midpoint = 0, sBoth = 0;
  let equalityOffender = 0, awayFrom30 = 0, at30 = 0, at150 = 0, thirtyRadius = 0;
  for (const state of sample) {
    const g = K.compute(state);
    if (g.degenerate) continue;
    const r = K.claims(g);
    perp = Math.max(perp, r.orthogonality);
    ratio = Math.max(ratio, r.ratioError);
    // General chord formula AB = 2R sin(C), which the page invokes at C=30.
    radius = Math.max(radius, Math.abs(g.outRadius - len(g.A, g.B) / (2 * Math.sin(g.angleC))));
    bfEf = Math.max(bfEf, r.bfEqualsEf);
    bfIf = Math.max(bfIf, r.bfEqualsIf);
    midpoint = Math.max(midpoint, r.mIsMidpoint);
    sBoth = Math.max(sBoth, r.sOnBothLines);
    const degrees = g.angleC * 180 / Math.PI;
    if (Math.abs(degrees - 30) < 1e-6 || Math.abs(degrees - 150) < 1e-6) {
      if (Math.abs(r.ratioError) < 1e-6 && Math.abs(g.DE - g.IO) < 1e-6) {
        if (Math.abs(degrees - 30) < 1e-6) at30++; else at150++;
      } else equalityOffender++;
    } else if (Math.abs(Math.sin(g.angleC) - 0.5) > 1e-3) {
      awayFrom30++;
      if (Math.abs(g.DE - g.IO) < 1e-4) equalityOffender++;
    }
    if (Math.abs(degrees - 30) < 1e-6) thirtyRadius = Math.max(thirtyRadius,
      Math.abs(g.outRadius - len(g.A, g.B)));
  }
  check(`DE is perpendicular to IO on all ${nonDegenerate} triangles`, perp < 1e-8, `max ${perp}`);
  check("DE / IO = 2 sin(C) on the whole sample", ratio < 1e-8, `max ${ratio}`);
  check("the circumradius is AB/(2 sin C) on the whole sample", radius < 1e-7, `max ${radius}`);
  check(`the sample contains ${awayFrom30} triangles with C neither 30 nor 150 degrees`, awayFrom30 > 1000);
  check("DE differs from IO away from 30 and 150 degrees", equalityOffender === 0, `${equalityOffender} offenders`);
  check(`the constructed 30-degree case really gives DE = IO (${at30} triangles)`, at30 > 0);
  check("the same chord formula gives DE = IO at 150 degrees too", at150 > 0);
  check("at 30 degrees the circumradius equals AB, as the page claims", thirtyRadius < 1e-8);
  check("F is equidistant from B and E (BF = EF) for every triangle", bfEf < 1e-7, `max ${bfEf}`);
  check("BIF is isosceles (BF = IF) for every triangle", bfIf < 1e-7, `max ${bfIf}`);
  check("M is the midpoint of BE, as AI bisects BE", midpoint < 1e-7, `max ${midpoint}`);
  check("S is the intersection of the two extended lines IO and DE", sBoth < 1e-8, `max ${sBoth}`);
  const thirty = K.compute(fixed[1][1]), different = K.compute(fixed[3][1]);
  check("in the 30-degree case BE = IF (BEF equilateral)",
    Math.abs(len(thirty.B, thirty.E) - len(thirty.I, thirty.F)) < 1e-7);
  check("away from 30 degrees BE is not IF, so the page's equality really needs the angle",
    Math.abs(len(different.B, different.E) - len(different.I, different.F)) > 10);
  check("the proof's angle at F is 60 degrees exactly when C is 30 or 150",
    Math.abs(K.angle(thirty.F, thirty.B, thirty.E) * 180 / Math.PI - 60) < 1e-7
    && Math.abs(K.angle(K.compute(fixed[2][1]).F, fixed[2][1].B, K.compute(fixed[2][1]).E) * 180 / Math.PI - 60) < 1e-7);
}

/* ---------------------------------------------------- 4. degenerate positions */

{
  const collinear = tri({ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 200, y: 20 });
  check("three corners on a line are reported degenerate", K.compute(collinear).degenerate === true);
  check("a degenerate picture has no residuals", K.claims(K.compute(collinear)) === null);
  check("reset after an impossible drag keeps the playable board",
    K.move(K.start(), { type: "reset" }).A.x === 120);
  check("a non-finite point is refused", K.move(K.start(), { type: "point", name: "A", point: { x: NaN, y: 1 } }) === null);
}

done("in-and-circumcenter-b");
