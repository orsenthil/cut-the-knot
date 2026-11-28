#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord/max-common-chord-core.js.
 *
 *   node porting/check-max-common-chord.mjs
 *
 * The applet is an illustration: there is no win or loss. Its page claims
 *   (1) PQ x PR = AP x PB (intersecting chords in the circumcircle ABQ),
 *   (2) the tangents from any X on the radical axis PQ have equal lengths,
 *   (3) R is the only X on PQ for which the two tangent points and P are in
 *       line, and PR - hence AP x PB - is largest there.
 * Sections 3 and 4 test those claims by sweeping every chord direction and
 * every position of X on PQ for many circle pairs, not a few samples.
 *
 * Section 5 is a second, literal transcription of the bytecode (GeoSDoub,
 * InsideTest, MaxCommonChordCanvas.Compute / Fix / PointOfTangency and
 * CTKMoveableDoub's circle glider), compared with the core over random and
 * grid configurations including all three degenerate cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("max-common-chord/max-common-chord-core.js", "MaxCommonChordCore");

/* ------------------------------------------------- 1. the applet's setup ---- */

{
  equal("the applet's suggested board size", [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT], [640, 460]);
  const s = C.start({});
  equal("the initial four points, in whole pixels", [s.P, s.Q, s.A], [
    { x: 320, y: 276 }, { x: 320, y: 368 }, { x: 192, y: 322 },
  ]);
  check("the initial B lies on the first chord through P",
    Math.abs(C.dist(s.A, s.P) + C.dist(s.P, s.B) - C.dist(s.A, s.B)) < 1e-9);
  check("the initial B lies on circle F",
    Math.abs(C.dist(s.B, { x: 384, y: 322 }) - 78.81624198095213) < 1e-9);
  check("the default radio button is chord, not circles", s.mode === "chord");
  check("start is pure and Reset keeps mode and size",
    JSON.stringify(C.start({})) === JSON.stringify(s) &&
    JSON.stringify(C.reset(C.start({ width: 480, height: 360, mode: "circles" }))) ===
      JSON.stringify(C.start({ width: 480, height: 360, mode: "circles" })));
  check("changing mode does not move any point",
    JSON.stringify(C.pointsOf(C.setMode(s, "circles"))) === JSON.stringify(C.pointsOf(s)));
}

/* ------------------------------------------------- 2. the four drag rules --- */

const collinear = (a, p, b) =>
  Math.abs((a.x - p.x) * (b.y - p.y) - (a.y - p.y) * (b.x - p.x)) < 1e-7;

{
  const s = C.start({});
  const movedP = C.movePoint(s, "P", { x: 300, y: 260 });
  check("dragging P moves only P (the applet never re-fixes the chord)",
    JSON.stringify(movedP.P) === JSON.stringify({ x: 300, y: 260 }) &&
    JSON.stringify(movedP.Q) === JSON.stringify(s.Q) &&
    JSON.stringify(movedP.A) === JSON.stringify(s.A) &&
    JSON.stringify(movedP.B) === JSON.stringify(s.B));
  const movedQ = C.movePoint(s, "Q", { x: 320, y: 400 });
  check("dragging Q moves only Q", movedQ.Q.y === 400 && movedQ.P.y === s.P.y);

  const E = C.circle(s.A, s.P, s.Q);
  const chord = C.movePoint(s, "A", { x: 260, y: 380 });
  check("in chord mode A is glued back onto circle E",
    Math.abs(C.dist(chord.A, E.center) - E.radius) < 1e-8);
  check("in chord mode dragging A keeps A, P, B in line",
    collinear(chord.A, s.P, chord.B));
  const F = C.circle(s.B, s.P, s.Q);
  const chordB = C.movePoint(s, "B", { x: 500, y: 200 });
  check("in chord mode B is glued back onto circle F",
    Math.abs(C.dist(chordB.B, F.center) - F.radius) < 1e-8);
  check("in chord mode dragging B keeps A, P, B in line",
    collinear(chordB.A, s.P, chordB.B));

  const circles = C.setMode(s, "circles");
  const freeA = C.movePoint(circles, "A", { x: 170, y: 340 });
  check("in circles mode A is not projected onto the old circle",
    freeA.A.x === 170 && freeA.A.y === 340);
  check("in circles mode B is still re-fixed through P",
    collinear(freeA.A, freeA.P, freeA.B));
  check("an unknown handle is ignored", C.movePoint(s, "X", { x: 1, y: 1 }) === s);
  check("a move leaves the input state untouched",
    JSON.stringify(s) === JSON.stringify(C.start({})));
}

/* ------------------------- independent geometry for claims 3 and 4 ---------- */

const EPS = 1e-9;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sgn = (v) => (v > 0 ? 1 : -1);

/** Two circles through P=(0,0) and Q=(d,0), with centres on x = d/2. */
function pair(d, hE, hF) {
  return {
    P: { x: 0, y: 0 }, Q: { x: d, y: 0 },
    E: { c: { x: d / 2, y: hE }, r: Math.hypot(d / 2, hE) },
    F: { c: { x: d / 2, y: hF }, r: Math.hypot(d / 2, hF) },
  };
}

/** The chord through P in direction theta: A on E, B on F, P between them. */
function chord(g, theta) {
  const u = { x: Math.cos(theta), y: Math.sin(theta) };
  const Eu = dot(sub(g.E.c, g.P), u), Fu = dot(sub(g.F.c, g.P), u);
  if (Eu * Fu >= 0 || Math.abs(Eu) < 2 || Math.abs(Fu) < 2) return null;
  return {
    A: { x: 2 * Eu * u.x, y: 2 * Eu * u.y },
    B: { x: 2 * Fu * u.x, y: 2 * Fu * u.y },
    u, Eu, Fu,
  };
}

/** Circumcentre by a 2x2 solve, deliberately different from GeoSDoub. */
function circum(a, b, c) {
  const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
  const bb = b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y;
  const cc = c.x * c.x + c.y * c.y - a.x * a.x - a.y * a.y;
  const det = bx * cy - by * cx;
  if (Math.abs(det) < EPS) return null;
  const o = { x: (bb * cy - cc * by) / (2 * det), y: (bx * cc - cx * bb) / (2 * det) };
  return { c: o, r: d2(o, a) };
}

/** Circle-circle intersections by the base-point/h method (not GeoSDoub). */
function cuts(c1, c2) {
  const delta = sub(c2.c, c1.c), d = Math.hypot(delta.x, delta.y);
  if (d < EPS || d > c1.r + c2.r + EPS || d < Math.abs(c1.r - c2.r) - EPS) return null;
  const ux = delta.x / d, uy = delta.y / d;
  const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a));
  const bx = c1.c.x + a * ux, by = c1.c.y + a * uy;
  return [{ x: bx - h * uy, y: by + h * ux }, { x: bx + h * uy, y: by - h * ux }];
}

/** The two tangent points from X to a circle, and the chosen one. */
function tangents(g, X, circle, hint) {
  const power = d2(X, circle.c) ** 2 - circle.r ** 2;
  if (power <= 0) return null;
  const pts = cuts(circle, { c: X, r: Math.sqrt(power) });
  if (!pts) return null;
  const side = sgn(cross(sub(g.Q, g.P), sub(hint, g.P)));
  return pts[sgn(cross(sub(g.Q, g.P), sub(pts[0], g.P))) === side ? 0 : 1];
}

/** R and the free geometry of a chord, without using the core. */
function describe(g, ch) {
  const { P, Q } = g;
  const circ = circum(ch.A, ch.B, Q);
  if (!circ) return null;
  const disc = circ.r * circ.r - circ.c.y * circ.c.y;
  if (disc < 0) return null;
  const xs = [circ.c.x - Math.sqrt(disc), circ.c.x + Math.sqrt(disc)];
  const R = { x: Math.abs(xs[0] - Q.x) < Math.abs(xs[1] - Q.x) ? xs[1] : xs[0], y: 0 };
  const At = tangents(g, R, g.E, ch.A), Bt = tangents(g, R, g.F, ch.B);
  return {
    R, At, Bt,
    AP: d2(ch.A, P), PB: d2(ch.B, P), PQ: d2(P, Q), PR: d2(P, R),
    between: !!(At && Bt && Math.abs(d2(At, P) + d2(P, Bt) - d2(At, Bt)) < 1e-6),
  };
}

/** Signed collinearity of At, P, Bt: its zeros are the special R's. */
function bend(g, theta) {
  const ch = chord(g, theta);
  if (!ch) return NaN;
  const info = describe(g, ch);
  if (!info || !info.At || !info.Bt) return NaN;
  return cross(sub(info.At, g.P), sub(info.Bt, g.P));
}

/* ----------------------------------------- 3. the three claims on the page --- */

{
  const random = rng(19750404);
  let tested = 0, chords = true, tangents = true, marks = true;
  for (let t = 0; t < 220; t++) {
    const d = 140 + 260 * random();
    const hE = -160 + 320 * random();
    const hF = -160 + 320 * random();
    const g = pair(d, hE, hF);
    for (let k = 0; k < 14; k++) {
      const theta = Math.PI * (k + 0.5) / 14;
      const ch = chord(g, theta);
      if (!ch) continue;
      const info = describe(g, ch);
      if (!info || !info.At || !info.Bt || info.PR < 3 ||
          d2(ch.A, g.Q) < 3 || d2(ch.B, g.Q) < 3) continue;
      tested++;
      const scale = Math.max(1, d, Math.abs(hE), Math.abs(hF));
      chords = chords && Math.abs(info.AP * info.PB - info.PQ * info.PR) < 1e-7 * scale * scale;
      tangents = tangents &&
        Math.abs(d2(info.R, info.At) - d2(info.R, info.Bt)) < 1e-7 * scale;
      const state = {
        width: 640, height: 460, mode: "chord",
        P: g.P, Q: g.Q, A: ch.A, B: ch.B,
      };
      const got = C.compute(state);
      marks = marks && got.valid && got.onChord && got.between === info.between &&
        d2(got.At, info.At) < 1e-6 * scale && d2(got.Bt, info.Bt) < 1e-6 * scale;
    }
  }
  check("3080 chord directions give enough non-degenerate configurations", tested > 400);
  check("AP x PB = PQ x PR in every one of them", chords);
  check("the two tangents from R are always equal", tangents);
  check("the core's tangent choice and between flag follow the page", marks);
}

{
  // Equal tangents hold for EVERY X on the radical axis, not just for R.
  const random = rng(2718);
  let equalLengths = true, perpendicular = true, count = 0;
  for (let t = 0; t < 120; t++) {
    const d = 120 + 240 * random();
    const hE = -140 + 280 * random(), hF = -140 + 280 * random();
    const g = pair(d, hE, hF);
    for (const x of [-160, -90, -30, d + 25, d + 90, d + 190]) {
      const X = { x, y: 0 };
      const At = tangents(g, X, g.E, { x: d / 2, y: hE > 0 ? 1 : -1 });
      const Bt = tangents(g, X, g.F, { x: d / 2, y: hF > 0 ? 1 : -1 });
      if (!At || !Bt) continue;
      count++;
      const len = Math.max(d2(X, At), d2(X, Bt));
      equalLengths = equalLengths && Math.abs(d2(X, At) - d2(X, Bt)) < 1e-7 * len;
      // A radius to a tangent point is perpendicular to the tangent segment.
      perpendicular = perpendicular &&
        Math.abs(dot(sub(At, g.E.c), sub(X, At))) < 1e-7 * g.E.r * d2(X, At) &&
        Math.abs(dot(sub(Bt, g.F.c), sub(X, Bt))) < 1e-7 * g.F.r * d2(X, Bt);
    }
  }
  check("tangent lengths agree for hundreds of X on PQ", count > 500 && equalLengths);
  check("each tangent is perpendicular to its radius", perpendicular);
}

{
  // For a fixed pair of circles, sweep EVERY chord direction; the tangent
  // chord occurs once and is the unique maximum. Then bisect to its exact
  // direction and compare with the core's own verdict.
  const cases = [[200, 80, -60], [240, -110, 70], [180, 60, 120], [300, -100, -50]];
  let unique = true, maxima = true, coreAgrees = true, roots = 0;
  for (const [d, hE, hF] of cases) {
    const g = pair(d, hE, hF);
    const N = 7200;
    const values = [], bends = [];
    let best = -Infinity, bestTheta = NaN;
    for (let i = 0; i < N; i++) {
      const theta = Math.PI * i / N;
      const ch = chord(g, theta);
      const b = bend(g, theta);
      bends.push(b);
      if (!ch) { values.push(NaN); continue; }
      const prod = d2(ch.A, g.P) * d2(ch.B, g.P);
      values.push(prod);
      if (prod > best) { best = prod; bestTheta = theta; }
    }
    // The signed bend reaches exactly zero at the special chord; it does not
    // change sign there, so look for local minima of its absolute value.
    let crossings = 0;
    for (let i = 1; i < N - 1; i++) {
      if (Number.isFinite(bends[i]) && Number.isFinite(bends[i - 1]) &&
          Number.isFinite(bends[i + 1]) &&
          Math.abs(bends[i]) < Math.abs(bends[i - 1]) &&
          Math.abs(bends[i]) <= Math.abs(bends[i + 1]) &&
          Math.abs(bends[i]) < 1e-2) crossings++;
    }
    roots += crossings;
    unique = unique && crossings === 1;
    // Refine the zero first, then polish the product: the top of a smooth
    // maximum is very flat, so a bend-only bisection leaves a noticeable gap.
    let lo = bestTheta - 0.02, hi = bestTheta + 0.02;
    for (let j = 0; j < 100; j++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (Math.abs(bend(g, m1)) < Math.abs(bend(g, m2))) hi = m2; else lo = m1;
    }
    let tl = (lo + hi) / 2 - 0.002, tr = (lo + hi) / 2 + 0.002;
    const prodAt = (th) => {
      const c = chord(g, th);
      return c ? d2(c.A, g.P) * d2(c.B, g.P) : -Infinity;
    };
    for (let j = 0; j < 120; j++) {
      const m1 = tl + (tr - tl) / 3, m2 = tr - (tr - tl) / 3;
      if (prodAt(m1) < prodAt(m2)) tl = m1; else tr = m2;
    }
    const theta = (tl + tr) / 2;
    const ch = chord(g, theta);
    const info = describe(g, ch);
    maxima = maxima && info.between &&
      d2(ch.A, g.P) * d2(ch.B, g.P) >= best * (1 - 1e-10);
    const state = { width: 640, height: 460, mode: "chord", P: g.P, Q: g.Q, A: ch.A, B: ch.B };
    const got = C.compute(state);
    coreAgrees = coreAgrees && got.valid && got.between && got.onChord &&
      got.product >= best * (1 - 1e-10) &&
      Math.abs(got.pqpr - got.product) < 1e-7 * Math.max(1, best);
  }
  check("four circle pairs each have exactly one tangent chord", roots === 4 && unique);
  check("at that chord PR and AP x PB are maximal, as the page says", maxima);
  check("the core finds the maximum chord and the equality there", coreAgrees);
}

/* ------------------- 4. a literal second transcription of the bytecode ----- */

const A = {
  d: (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y)),
  sq: (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y),
};
function aMid(p, q) { return { x: (p.x + q.x) / 2.0, y: (p.y + q.y) / 2.0 }; }
function aOrient(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - p.y * q.x;
  return v > 0 ? 1 : -1;
}
function aInside(r, p, q) {
  return (r.x - p.x) * (r.x - q.x) + (r.y - p.y) * (r.y - q.y) <= 0;
}
function aBetween(a, p, b) {
  if (a === null || b === null) return false;
  return Math.abs(A.d(a, p) + A.d(p, b) - A.d(a, b)) < 1.0e-6;
}
function aLineInter(p, q, u, v) {
  const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
  const d = u.y - v.y, e = v.x - u.x, f = u.x * v.y - u.y * v.x;
  const den = a * e - d * b;
  if (Math.abs(den) < 1.0) return { x: NaN, y: NaN };
  return { x: (b * f - e * c) / den, y: (c * d - f * a) / den };
}
function aCircum(a, b, c) {
  const m1 = aMid(a, b), m2 = aMid(b, c);
  return aLineInter(m1,
    { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) }, m2,
    { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) });
}
function aCircle(a, b, c) {
  const o = aCircum(a, b, c);
  return { center: o, radius: (A.d(o, a) + A.d(o, b) + A.d(o, c)) / 3.0 };
}
function aLineCircleX(p, q, c) {
  const slope = (p.x - q.x) / (p.y - q.y);
  const B = q.x - slope * q.y;
  const qa = slope * slope + 1.0, qb = slope * (B - c.center.x) - c.center.y;
  const qc = (B - c.center.x) * (B - c.center.x) + c.center.y * c.center.y - c.radius * c.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
  return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
}
function aLineCircleY(p, q, c) {
  const slope = (p.y - q.y) / (p.x - q.x);
  const B = q.y - slope * q.x;
  const qa = slope * slope + 1.0, qb = slope * (B - c.center.y) - c.center.x;
  const qc = (B - c.center.y) * (B - c.center.y) + c.center.x * c.center.x - c.radius * c.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
  return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
}
function aLineCircle(p, q, c) {
  if (Math.abs(p.y - q.y) > 1.0) return aLineCircleX(p, q, c);
  if (Math.abs(p.x - q.x) > 1.0) return aLineCircleY(p, q, c);
  return null;
}
function aCircleX(a, b) {
  const slope = -(a.center.y - b.center.y) / (a.center.x - b.center.x);
  const B = (a.center.x * a.center.x - b.center.x * b.center.x +
    a.center.y * a.center.y - b.center.y * b.center.y -
    a.radius * a.radius + b.radius * b.radius) / 2.0 / (a.center.x - b.center.x);
  const h = B - a.center.x, qa = slope * slope + 1.0, qb = slope * h - a.center.y;
  const qc = h * h + a.center.y * a.center.y - a.radius * a.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
  return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
}
function aCircleY(a, b) {
  const slope = -(a.center.x - b.center.x) / (a.center.y - b.center.y);
  const B = (a.center.y * a.center.y - b.center.y * b.center.y +
    a.center.x * a.center.x - b.center.x * b.center.x -
    a.radius * a.radius + b.radius * b.radius) / 2.0 / (a.center.y - b.center.y);
  const h = B - a.center.y, qa = slope * slope + 1.0, qb = slope * h - a.center.x;
  const qc = h * h + a.center.x * a.center.x - a.radius * a.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
  return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
}
function aCircles(a, b) {
  if (Math.abs(a.center.x - b.center.x) > 1.0) return aCircleX(a, b);
  if (Math.abs(a.center.y - b.center.y) > 1.0) return aCircleY(a, b);
  return [{ x: a.center.x, y: a.center.y }, { x: a.center.x, y: a.center.y }];
}
function aOther(pts, known) {
  return A.d(pts[0], known) < 1.0 ? pts[1] : pts[0];
}
function aRestrict(p, c) {
  const r = c.radius, d = A.d(p, c.center);
  return { x: c.center.x + (p.x - c.center.x) * r / d,
    y: c.center.y + (p.y - c.center.y) * r / d };
}
function aFix(target, c, anchor, P) {
  if (A.d(anchor, P) < 1.0) return target;
  const pts = aLineCircle(anchor, P, c);
  if (pts === null || pts[0] === null || pts[1] === null) return target;
  const q = aOther(pts, P);
  return { x: q.x, y: q.y };
}
function aTangency(R, c, hint, P, Q) {
  const power = A.sq(R, c.center) - c.radius * c.radius;
  if (power <= 0.0) return null;
  const aux = { center: { x: R.x, y: R.y }, radius: Math.sqrt(power) };
  const pts = aCircles(c, aux);
  return aOrient(P, Q, hint) === aOrient(P, Q, pts[0]) ? pts[0] : pts[1];
}
function aCompute(s) {
  const { P, Q, A: pa, B: pb } = s;
  const blank = () => ({ valid: false, R: null, At: null, Bt: null, Pe: null, Pf: null,
    between: false, onChord: false, E: null, F: null, ABQ: null });
  if (A.d(pa, P) < 2.0 || A.d(pa, Q) < 2.0 || A.d(pb, P) < 2.0 ||
      A.d(pb, Q) < 2.0 || A.d(P, Q) < 2.0) return blank();
  const E = aCircle(pa, P, Q), F = aCircle(pb, P, Q), ABQ = aCircle(pa, pb, Q);
  const R = aOther(aLineCircle(P, Q, ABQ), Q);
  if (A.d(P, R) < 1.0) return blank();
  if (![E, F, ABQ].every((c) => Number.isFinite(c.center.x) &&
      Number.isFinite(c.center.y) && Number.isFinite(c.radius)) ||
      !Number.isFinite(R.x) || !Number.isFinite(R.y)) return blank();
  const result = { valid: true, R, At: null, Bt: null, Pe: null, Pf: null,
    between: false, onChord: aBetween(pa, P, pb), E, F, ABQ };
  if (aInside(R, P, Q)) return result;
  result.At = aTangency(R, E, pa, P, Q);
  result.Bt = aTangency(R, F, pb, P, Q);
  try {
    result.Pe = aOther(aLineCircle(result.At, result.Bt, E), result.At);
    result.Pf = aOther(aLineCircle(result.At, result.Bt, F), result.Bt);
  } catch (e) { /* the applet catches exceptions here */ }
  result.between = aBetween(result.At, P, result.Bt);
  return result;
}

function samePoint(p, q, tol) {
  const ok = (x, y) => (Number.isNaN(x) && Number.isNaN(y)) ||
    (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tol);
  return (!p && !q) || (!!p && !!q && ok(p.x, q.x) && ok(p.y, q.y));
}
function sameCircle(c, d, tol) {
  if (!c || !d) return !c && !d;
  if (!samePoint(c.center, d.center, tol)) return false;
  if (Number.isNaN(c.radius) || Number.isNaN(d.radius))
    return Number.isNaN(c.radius) && Number.isNaN(d.radius);
  return Math.abs(c.radius - d.radius) <= tol;
}
function sameResult(mine, theirs, tol) {
  if (mine.valid !== theirs.valid) return false;
  return samePoint(mine.R, theirs.R, tol) && samePoint(mine.At, theirs.At, tol) &&
    samePoint(mine.Bt, theirs.Bt, tol) && samePoint(mine.Pe, theirs.Pe, tol) &&
    samePoint(mine.Pf, theirs.Pf, tol) &&
    sameCircle(mine.E, theirs.E, tol) && sameCircle(mine.F, theirs.F, tol) &&
    sameCircle(mine.ABQ, theirs.ABQ, tol) &&
    mine.between === theirs.between && mine.onChord === theirs.onChord;
}

{
  const random = rng(4711);
  let agree = true, degenerates = 0, insides = 0, tangents = 0;
  for (let i = 0; i < 1500; i++) {
    const s = {
      width: 640, height: 460, mode: "chord",
      P: { x: 30 + random() * 580, y: 30 + random() * 400 },
      Q: { x: 30 + random() * 580, y: 30 + random() * 400 },
      A: { x: 20 + random() * 600, y: 20 + random() * 420 },
      B: { x: 20 + random() * 600, y: 20 + random() * 420 },
    };
    const tol = 1e-6 * 700;
    agree = agree && sameResult(C.compute(s), aCompute(s), tol);
    const m = C.compute(s);
    if (!m.valid) degenerates++;
    else if (m.inside) insides++;
    else if (m.At && m.Bt) tangents++;
  }
  check("1500 random positions agree with the applet's Compute", agree);
  check("the random set covers degenerate, inside and tangent cases",
    degenerates > 0 && insides > 20 && tangents > 1000);
}

{
  let agree = true, count = 0, invalid = 0;
  for (let p = 0; p <= 4; p++) {
    for (let q = 0; q <= 4; q++) {
      for (let a = 0; a <= 4; a++) {
        for (let b = 0; b <= 4; b++) {
          const s = {
            width: 640, height: 460, mode: "circles",
            P: { x: 200, y: 200 }, Q: { x: p % 2 ? 400 : 200, y: q % 2 ? 380 : 200 },
            A: { x: 100 + a * 20, y: 120 + a * 13 },
            B: { x: 500 - b * 20, y: 120 + b * 17 },
          };
          count++;
          if (!C.compute(s).valid) invalid++;
          agree = agree && sameResult(C.compute(s), aCompute(s), 1e-6 * 700);
        }
      }
    }
  }
  check("625 grid positions agree with the applet's Compute", agree && count === 625);
  check("the grid exercises the applet's early return", invalid > 0);
}

{
  // A second transcription of the mouse methods, checked on every drag in a
  // grid of targets from both modes and both endpoints.
  let agree = true, moved = 0;
  const base = C.start({});
  for (const mode of ["chord", "circles"]) {
    const s = C.setMode(base, mode);
    for (const name of ["A", "B"]) {
      for (let i = 0; i < 30; i++) {
        const target = { x: 100 + 14 * i, y: 180 + (i % 7) * 31 };
        const mine = C.movePoint(s, name, target);
        const ps = C.pointsOf(s);
        let pa = { ...ps.A }, pb = { ...ps.B };
        if (name === "A") {
          if (mode === "chord") pa = aRestrict(target, aCircle(pa, ps.P, ps.Q));
          else pa = { x: target.x, y: target.y };
          pb = aFix(pb, aCircle(pb, ps.P, ps.Q), pa, ps.P);
        } else {
          if (mode === "chord") pb = aRestrict(target, aCircle(pb, ps.P, ps.Q));
          else pb = { x: target.x, y: target.y };
          pa = aFix(pa, aCircle(pa, ps.P, ps.Q), pb, ps.P);
        }
        agree = agree && samePoint(mine.A, pa, 1e-8) && samePoint(mine.B, pb, 1e-8);
        moved++;
      }
    }
  }
  check("120 drags agree with a literal Fix/Restrict transcription", agree && moved === 120);
}

/* ----------------------------- 5. the saved position ---------------------- */

{
  const s = C.start({});
  const info = C.compute(s);
  const p = C.position(s, info);
  check("the saved position is plain data for the tutor",
    typeof p.width === "number" && p.mode === "chord" &&
    ["P", "Q", "A", "B", "R", "At", "Bt"].every((k) =>
      p[k] === null || (typeof p[k].x === "number" && typeof p[k].y === "number")) &&
    typeof p.product === "number" && typeof p.between === "boolean");
  check("the saved position carries the equal chord products",
    Math.abs(p.product - p.pqpr) < 1e-8 * p.product);
  const before = JSON.stringify(s);
  C.position(C.movePoint(s, "A", { x: 210, y: 330 }));
  check("computing a position never changes the state", JSON.stringify(s) === before);
}

done("max-common-chord");
