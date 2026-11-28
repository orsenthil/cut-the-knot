#!/usr/bin/env node
"use strict";

/*
 * Logic test for inradius-semiperimeter/inradius-semiperimeter-core.js.
 *
 *   node porting/check-inradius-semiperimeter.mjs
 *
 * Two independent readings of the applet are compared on 400 triangles: this
 * is a literal second transcription of FindIncenter, NearestPoint, Compute,
 * MoveThem1/2, SetRotatingPoly and FlippingTriangle.Move from the bytecode,
 * written out below without calling the core. Then the page's claims are
 * checked, not copied: area = semiperimeter x inradius over every triangle;
 * the six pieces tile both the triangle and the s by r rectangle (rasterised);
 * base x altitude = twice the area; and rational sides with rational area give
 * a rational inradius, tested over all Heronian triangles with sides up to 40.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inradius-semiperimeter/inradius-semiperimeter-core.js", "InradiusSemiperimeterCore");
const P = (x, y) => ({ x, y });
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const d = (p, q) => Math.sqrt(sq(p, q));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const close = (p, q, eps = 1e-6) => near(p.x, q.x, eps) && near(p.y, q.y, eps);

/* ------------------------------------------- second transcription (bytecode) */

function orientation(A, B, Cc) {
  const cross = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
  return cross > 0 ? 1 : -1;
}
function computeAngle(A, B, Cc) {
  const ab = sq(A, B), ac = sq(A, Cc), bc = sq(B, Cc);
  return Math.acos(Math.max(-1, Math.min(1, (ab + ac - bc) / (2 * Math.sqrt(ab * ac)))));
}
/* GeoSDoub.Rotate(p, center, a, sign) returns p + R(sign*a)(center-p). */
function turnPoint(p, center, a, sign) {
  const cos = Math.cos(a), sin = Math.sin(a) * sign;
  return P(p.x + cos * (center.x - p.x) - sin * (center.y - p.y),
    p.y + sin * (center.x - p.x) + cos * (center.y - p.y));
}
/* GeoSDoub.Intersect: a1 x + b1 y = -c1 and a2 x + b2 y = -c2. */
function linesCross(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det);
}
function nearestOn(O, U, V) {
  if (sq(U, O) < 0.1) return O;
  const dx = V.x - U.x, dy = V.y - U.y;
  const t = ((O.x - U.x) * dx + (O.y - U.y) * dy) / (dx * dx + dy * dy);
  return P(U.x + dx * t, U.y + dy * t);
}
function signedAngleAt(a, b, c) {
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * d(a, b) * d(a, c));
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (ang > 0.99 && sq(b, a) < 0) return Math.PI;
  return orientation(a, b, c) > 0 ? ang : -ang;
}
function bary(poly) {
  return P(poly.reduce((v, p) => v + p.x, 0) / poly.length,
    poly.reduce((v, p) => v + p.y, 0) / poly.length);
}

/** The applet's Compute + MoveThem1/2 + SetRotatingPoly, transcribed directly. */
function applet(A, B, Cc) {
  const sign = orientation(A, B, Cc);
  const rayA = turnPoint(A, B, computeAngle(A, B, Cc) / 2, sign);
  const rayB = turnPoint(B, Cc, computeAngle(B, Cc, A) / 2, sign);
  const O = linesCross(A, rayA, B, rayB);
  const D = nearestOn(O, B, Cc), E = nearestOn(O, Cc, A), F = nearestOn(O, A, B);
  const a = d(B, Cc), b = d(Cc, A), c = d(A, B);
  const s = (a + b + c) / 2;
  const r = (d(O, E) + d(O, F) + d(O, D)) / 3;
  const x = (500 - s) / 2, y = 360 - 10;
  const L = [P(x, y)];
  L.push(P(L[0].x + d(A, E), y));
  L.push(P(L[1].x + d(B, F), y));
  L.push(P(L[2].x + d(Cc, D), y));
  const U = L.map((p) => P(p.x, y - r));
  const mode = orientation(U[0], L[0], L[1]) === orientation(O, E, A) ? 1 : 2;
  const specs = mode === 1 ? [
    [0, "rotate", [O, D, Cc], [U[2], L[2], L[3]], U[2], L[2]],
    [0, "flip", [O, Cc, E], [L[3], U[2], U[3]]],
    [1, "rotate", [O, E, A], [U[0], L[0], L[1]], U[0], L[0]],
    [1, "flip", [O, A, F], [L[1], U[0], U[1]]],
    [2, "rotate", [O, F, B], [U[1], L[1], L[2]], U[1], L[1]],
    [2, "flip", [O, B, D], [L[2], U[1], U[2]]],
  ] : [
    [0, "rotate", [O, Cc, E], [L[3], U[2], U[3]], L[3], U[2]],
    [0, "flip", [O, D, Cc], [U[2], L[2], L[3]]],
    [1, "rotate", [O, A, F], [L[1], U[0], U[1]], L[1], U[0]],
    [1, "flip", [E, A, O], [L[0], L[1], U[0]]],
    [2, "rotate", [O, B, D], [L[2], U[1], U[2]], L[2], U[1]],
    [2, "flip", [O, F, B], [U[1], L[1], L[2]]],
  ];
  const pieces = specs.map(([group, kind, start, target, p4, p5]) => ({
    group, kind, start, target,
    angle: kind === "rotate"
      ? (() => {
        const a = signedAngleAt(start[0], start[1], P(start[0].x + p5.x - p4.x, start[0].y + p5.y - p4.y));
        return Number.isNaN(a) ? Math.PI : a; // SetRotatingPoly's NaN fallback
      })()
      : undefined,
  }));
  return { O, D, E, F, s, r, L, U, mode, pieces, area: Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x)) / 2 };
}

/** The applet's RotatingPoly.UpdateLocation and FlippingTriangle.Move at step k. */
function appletShapes(P0, k) {
  const t = k / 100;
  return P0.pieces.map((piece) => {
    if (piece.kind === "flip") {
      return piece.start.map((p, i) => P(p.x + (piece.target[i].x - p.x) * t, p.y + (piece.target[i].y - p.y) * t));
    }
    const focus = bary(piece.start), goal = bary(piece.target);
    const at = P(focus.x + (goal.x - focus.x) * t, focus.y + (goal.y - focus.y) * t);
    const ang = piece.angle * t;
    const moved = piece.start.map((p) => turnPoint(focus, p, ang, 1));
    return moved.map((p) => P(p.x + at.x - focus.x, p.y + at.y - focus.y));
  });
}

/* ------------------------------------------------------------- point-in-poly */

function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function raster(polys, box, step) {
  let covered = 0, uncovered = 0, overlap = 0;
  // Off-grid offsets keep sample points off the common edges of the pieces.
  for (let x = box[0] + 0.37; x < box[2]; x += step) {
    for (let y = box[1] + 0.71; y < box[3]; y += step) {
      const p = P(x, y);
      let n = 0;
      for (const poly of polys) if (inside(p, poly)) n++;
      if (n === 0) uncovered++;
      else if (n > 1) overlap++;
      else covered++;
    }
  }
  return { covered, uncovered, overlap };
}

/* -------------------------------------------------------------- test corpus */

const corpus = [];
for (let x = 20; x <= 480; x += 46) {
  for (let y = 20; y <= 300; y += 35) corpus.push([P(83, 240), P(417, 240), P(x, y)]);
}
const rnd = rng(20261127);
for (let i = 0; i < 300; i++) {
  corpus.push([P(20 + rnd() * 460, 20 + rnd() * 280),
    P(20 + rnd() * 460, 20 + rnd() * 280),
    P(20 + rnd() * 460, 20 + rnd() * 280)]);
}
const triangles = corpus.filter(([A, B, Cc]) => {
  const m = C.measurements(C.start({ A, B, C: Cc }));
  // The applet's NearestPoint shortcut breaks the construction only when a
  // corner lies within 0.316 units of the incenter; those nearly degenerate
  // triangles are listed separately below, not used for the page's claims.
  return !m.degenerate && !m.shortcut;
});
const shortcutCases = corpus.filter(([A, B, Cc]) => {
  const m = C.measurements(C.start({ A, B, C: Cc }));
  return m.shortcut;
});

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the starting corners are the applet's W/6, 2H/3, W/4, H/6",
    [s.A, s.B, s.C], [P(83, 240), P(417, 240), P(125, 60)]);
  check("a new position has no hint, no progress and no result",
    !s.hint && s.progress === 0 && C.result(s) === null && s.moves === 0);
  check("non-finite or unknown corners are refused",
    C.move(s, { type: "point", name: "A", x: NaN, y: 1 }) === null &&
    C.move(s, { type: "point", name: "D", x: 1, y: 1 }) === null);
  check("a corner move resets the dissection but not the other corners",
    (() => {
      const q = C.move(C.measurements(s).degenerate ? s : C.move(s, { type: "animate", f: 1 }),
        { type: "point", name: "A", x: 90, y: 250 });
      return q.A.x === 90 && q.progress === 0 && !q.explored && q.B.x === 417 && C.result(q) === null;
    })());
  check("the hint toggles, the animation clamps, and Reset keeps the hint",
    (() => {
      let q = C.move(s, { type: "hint", value: true });
      q = C.move(q, { type: "animate", f: 4 });
      const done = C.result(q) === "done" && q.progress === 1;
      const back = C.move(q, { type: "reset" });
      return done && q.hint && back.hint && back.progress === 0 &&
        C.move(s, { type: "animate", f: NaN }) === null &&
        C.move(s, { type: "hint", value: 3 }) === null && C.move(s, { type: "bogus" }) === null;
    })());
  check("a position is plain JSON data for Track.state",
    JSON.parse(JSON.stringify(C.move(s, { type: "animate", f: 1 }))).explored === true);
  check("the applet's canvas constants are kept", C.W === 500 && C.H === 360 && C.GAP === 10 && C.NSTEPS === 100);
}

/* ------------------------------------ 2. core vs a second bytecode reading */

{
  let worstCenter = 0, worstPoint = 0, worstRect = 0, worstAngle = 0, worstFrame = 0;
  let modes = [0, 0];
  for (const [A, B, Cc] of triangles) {
    const m = C.measurements(C.start({ A, B, C: Cc }));
    const q = applet(A, B, Cc);
    worstCenter = Math.max(worstCenter, d(m.O, q.O));
    for (const key of ["D", "E", "F"]) worstPoint = Math.max(worstPoint, d(m[key], q[key]));
    worstRect = Math.max(worstRect, Math.abs(m.s - q.s), Math.abs(m.r - q.r),
      ...m.L.map((p, i) => d(p, q.L[i])), ...m.U.map((p, i) => d(p, q.U[i])));
    if (m.mode !== q.mode) worstRect = Infinity;
    modes[m.mode - 1]++;
    worstAngle = Math.max(worstAngle, ...m.pieces.map((p, i) =>
      p.kind === "rotate" ? Math.abs(p.angle - q.pieces[i].angle) : 0));
    for (let i = 0; i < 6; i++) {
      const a = m.pieces[i], b = q.pieces[i];
      if (a.group !== b.group || a.kind !== b.kind) worstRect = Infinity;
      for (let j = 0; j < 3; j++) worstPoint = Math.max(worstPoint, d(a.start[j], b.start[j]), d(a.target[j], b.target[j]));
    }
    const ours = C.piecesAt(m, 37 / 100), theirs = appletShapes(q, 37);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      worstFrame = Math.max(worstFrame, d(ours[i][j], theirs[i][j]));
    }
  }
  check(`the incenter matches a second transcription of FindIncenter on ${triangles.length} triangles (worst ${worstCenter.toExponential(2)})`, worstCenter < 1e-6);
  check(`all three touch points and all six start/target triangles match (worst ${worstPoint.toExponential(2)})`, worstPoint < 1e-6);
  check(`s, r, the rectangle corners and the MoveThem1/2 choice match (worst ${worstRect.toExponential(2)})`, worstRect < 1e-6);
  check(`all swinging angles match ComputeSignedAngle (worst ${worstAngle.toExponential(2)})`, worstAngle < 1e-6);
  check(`the animation at step 37 matches RotatingPoly/FlippingTriangle (worst ${worstFrame.toExponential(2)})`, worstFrame < 1e-5);
  check(`both animation orders occur (MoveThem1 ${modes[0]}, MoveThem2 ${modes[1]})`, modes[0] > 0 && modes[1] > 0);
}

/* ------------------------------------------------------- 3. the page's claims */

{
  let worst = 0;
  for (const [A, B, Cc] of triangles) {
    const m = C.measurements(C.start({ A, B, C: Cc }));
    worst = Math.max(worst, Math.abs(m.s * m.r - m.area) / m.area);
  }
  check(`area = semiperimeter x inradius on all ${triangles.length} triangles (worst relative error ${worst.toExponential(2)})`, worst < 1e-9);

  let altWorst = 0;
  for (const [A, B, Cc] of triangles) {
    const m = C.measurements(C.start({ A, B, C: Cc }));
    const foot = C.nearestPoint(A, B, Cc);
    altWorst = Math.max(altWorst, Math.abs(d(A, foot) * m.a - 2 * m.area) / m.area);
  }
  check(`base x altitude = twice the area on all triangles (worst ${altWorst.toExponential(2)})`, altWorst < 1e-9);

  let badRadii = 0, badTangents = 0;
  for (const [A, B, Cc] of triangles) {
    const m = C.measurements(C.start({ A, B, C: Cc }));
    if (!m.radiusFromCenter.every((v) => near(v, m.r))) badRadii++;
    const [ae, af, bf, bd, cd, ce] = m.tangentLengths;
    if (![near(ae, af), near(bf, bd), near(cd, ce), near(ae + bf + cd, m.s)].every(Boolean)) badTangents++;
  }
  check("the incircle touches all three sides: OD = OE = OF = r", badRadii === 0);
  check("tangent lengths from each corner match and AE + BF + CD = s", badTangents === 0);
}

{
  // The six pieces tile the triangle at step 0 and the rectangle at step 100.
  let gaps = 0, overlaps = 0, sampleCount = 0;
  for (let i = 0; i < triangles.length; i += 12) {
    const [A, B, Cc] = triangles[i];
    const m = C.measurements(C.start({ A, B, C: Cc }));
    const xs = [A.x, B.x, Cc.x], ys = [A.y, B.y, Cc.y];
    const boxTri = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const tri = raster(C.piecesAt(m, 0), boxTri, 2);
    const insideT = raster([[A, B, Cc]], boxTri, 2);
    gaps += Math.abs(tri.covered - insideT.covered) + tri.uncovered - insideT.uncovered;
    overlaps += tri.overlap;
    const rect = raster(C.piecesAt(m, 1), [m.L[0].x, m.U[0].y, m.L[3].x, m.L[0].y], 2);
    gaps += rect.uncovered;
    overlaps += rect.overlap;
    sampleCount += tri.covered + rect.covered;
  }
  check(`the six pieces tile both shapes (${sampleCount} raster samples, ${gaps} gaps, ${overlaps} overlaps)`,
    sampleCount > 20000 && gaps <= 4 && overlaps <= 4);

  let misplaced = 0;
  for (const [A, B, Cc] of triangles) {
    const m = C.measurements(C.start({ A, B, C: Cc }));
    const end = C.piecesAt(m, 1);
    for (let i = 0; i < 6; i++) {
      const target = m.pieces[i].target;
      if (!target.every((p) => end[i].some((q) => near(p.x, q.x) && near(p.y, q.y)))) misplaced++;
    }
  }
  check("every swinging and flipping piece lands exactly on its rectangle target", misplaced === 0);
}

{
  // Douglas Rogers' remark: rational sides and rational area give rational r.
  let count = 0, bad = 0;
  for (let a = 1; a <= 40; a++) {
    for (let b = a; b <= 40; b++) {
      for (let c = b; c <= 40; c++) {
        if (a + b <= c) continue;
        const heron = (a + b + c) * (-a + b + c) * (a - b + c) * (a + b - c);
        if (heron % 16 !== 0) continue;
        const K2 = heron / 16;
        const root = Math.round(Math.sqrt(K2));
        if (root * root !== K2 || root === 0) continue;
        count++;
        const A = P(0, 0), B = P(c, 0);
        const Cc = P((b * b + c * c - a * a) / (2 * c), (2 * root) / c);
        const m = C.measurements(C.start({ A, B, C: Cc }));
        const exact = root / ((a + b + c) / 2); // a rational number: 2K/(a+b+c)
        if (m.degenerate || !near(m.r, exact, 1e-8)) bad++;
      }
    }
  }
  check(`${count} Heronian triangles with sides <= 40 have r = 2*Area/(a+b+c) exactly`, count >= 68 && bad === 0);
  check("3-4-5 has inradius 1 and 5-12-13 has inradius 2", (() => {
    const rFor = (a, b, c) => C.measurements(C.start({
      A: P(0, 0), B: P(c, 0), C: P((b * b + c * c - a * a) / (2 * c), Math.sqrt((a + b + c) * (-a + b + c) * (a - b + c) * (a + b - c)) / (2 * c)),
    })).r;
    return near(rFor(3, 4, 5), 1, 1e-8) && near(rFor(5, 12, 13), 2, 1e-8);
  })());
}

{
  // Edge cases: the applet refuses to draw a degenerate triangle.
  const flat = C.measurements(C.start({ A: P(10, 20), B: P(100, 20), C: P(200, 20) }));
  const pinch = C.measurements(C.start({ A: P(10, 20), B: P(10, 20), C: P(200, 80) }));
  check("collinear or coincident corners are degenerate, with no pieces to move",
    flat.degenerate && pinch.degenerate && C.piecesAt(flat, 0.5).length === 0);
  check(`the applet's near-vertex shortcut in NearestPoint is kept (${shortcutCases.length} thin triangles in the corpus)`,
    shortcutCases.length > 0 && shortcutCases.every(([A, B, Cc]) =>
      C.measurements(C.start({ A, B, C: Cc })).shortcut) &&
    near(C.nearestPoint(P(1, 1), P(1, 1), P(3, 4)).x, 1) &&
    near(C.nearestPoint(P(0, 0), P(-1, -1), P(1, 1)).y, 0));
}

done("inradius-semiperimeter");
