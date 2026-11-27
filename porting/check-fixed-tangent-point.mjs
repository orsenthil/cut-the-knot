#!/usr/bin/env node
"use strict";

/*
 * Logic test for fixed-tangent-point/fixed-tangent-point-core.js.
 *
 *   node porting/check-fixed-tangent-point.mjs
 *
 * The page claims that, for a circle C and a line m that does not meet it,
 * there is a point Q such that PQ equals the tangent length PT from every P
 * on m; equivalently, every circle centred on m and orthogonal to C passes
 * through Q. It also remarks that the reflection of Q in m is a second such
 * point. Sections 2 and 3 check those statements over a grid and thousands of
 * random configurations, not a handful of examples.
 *
 * Section 4 is a second transcription of the applet's own arithmetic, this
 * time the literal path through Tangents.GetExternalTangents,
 * Inversion.Tangent and GeoSDoub.IntersectCirclesX/Y from the bytecode. It is
 * compared point-by-point (including the order of T) with the analytic core.
 * Section 5 covers the applet's two quiet states: P inside C stops Compute;
 * a line meeting C makes z imaginary and leaves Q and N at their last values.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fixed-tangent-point/fixed-tangent-point-core.js", "FixedTangentPointCore");
const D = C.dist;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const nearPoint = (p, q, tol) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/** A state with the four handles put wherever we want them. */
function stateOf(O, R, X, P, width, height) {
  const w = width === undefined ? 480 : width;
  const h = height === undefined ? 360 : height;
  return {
    width: w, height: h,
    O: { x: O.x, y: O.y }, R: { x: R.x, y: R.y },
    X: { x: X.x, y: X.y }, P: { x: P.x, y: P.y },
    options: C.initialOptions(),
  };
}

/* ------------------------------------------------------------ 1. the setup */

{
  equal("the applet's suggested board size", [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT], [600, 550]);
  const s = C.start({});
  check("O starts at half the width and a quarter height",
    s.O.x === 300 && s.O.y === Math.floor(550 / 4));
  check("R keeps the original three-eighths height",
    s.R.x === 300 - 600 / 8 && s.R.y === (3 * 550) / 8);
  check("the starting radius is the distance OR, not w/8",
    near(D(s.O, s.R), Math.hypot(75, 206.25 - 137), 1e-9));
  check("X is fixed in x and P shares its y",
    s.X.x === 600 - 20 && s.X.y === Math.floor((3 * 550) / 5) && s.P.y === s.X.y);
  check("P starts 1.3 radii of the width to the right of O",
    near(s.P.x - s.O.x, 1.3 * (600 / 8), 1e-9));
  check("names are on and the other two overlays are off at the start",
    JSON.stringify(s.options) === JSON.stringify({ names: true, hint: false, statement: false }));

  const ui = C.start({ width: 480, height: 360 });
  check("the board size scales the starting diagram",
    ui.O.x === 240 && ui.O.y === 90 && ui.X.x === 460 && ui.X.y === 216 &&
    near(ui.P.x, 318, 1e-9));
  const moved = C.movePoint(ui, "X", { x: 12, y: 260 });
  check("X only moves up and down and carries P with it",
    moved.X.x === ui.X.x && moved.X.y === 260 && moved.P.y === 260 && moved.P.x === ui.P.x);
  const slid = C.movePoint(ui, "P", { x: 100, y: 40 });
  check("P only slides along m", slid.P.x === 100 && slid.P.y === ui.X.y);
  const centre = C.movePoint(ui, "O", { x: 70, y: 75 });
  check("the centre is free and does not carry R", nearPoint(centre.O, { x: 70, y: 75 }, 0) &&
    nearPoint(centre.R, ui.R, 0));
  check("an unknown handle is ignored", C.movePoint(ui, "Z", { x: 1, y: 1 }) === ui);
  check("dragging leaves the old state alone", ui.O.x === 240 && ui.X.y === 216);
  const reset = C.reset(moved);
  check("Reset keeps the board size and the overlays",
    reset.width === ui.width && reset.height === ui.height &&
    JSON.stringify(reset.O) === JSON.stringify(ui.O) &&
    JSON.stringify(reset.options) === JSON.stringify(moved.options));
  const named = C.setOption(moved, "statement", true);
  check("an overlay changes without disturbing the points",
    named.options.statement === true && nearPoint(named.P, moved.P, 0));
}

/* --------------------------- 2. the page's claim over a grid of diagrams -- */

{
  const random = rng(20261127);
  let cases = 0;
  let equalLengths = true, orthogonal = true, fixed = true, mirrored = true;
  let tangencies = true, feet = true, nTangent = true, finite = true;
  let worst = 0;

  // A small, exhaustive grid over the centre, the radius, the height of m
  // above the circle and the position of P along m.
  for (const ox of [140, 240, 340]) {
    for (const oy of [50, 110]) {
      for (const r of [30, 50, 70]) {
        for (let lift = 12; lift <= 84; lift += 12) {
          const lineY = oy + r + lift;
          if (lineY > 350) continue;
          const X = { x: 460, y: lineY };
          const R = { x: ox - r, y: oy };
          // Q does not depend on P: compare every P to the first one.
          let referenceQ = null;
          for (let dx = -180; dx <= 180; dx += 20) {
            const P = { x: ox + dx, y: lineY };
            // P == X leaves the applet's NearestPoint with a zero-length
            // direction; it yields NaN there too, so skip that degenerate pair.
            if (P.x === X.x) continue;
            const s = stateOf({ x: ox, y: oy }, R, X, P);
            const g = C.compute(s);
            cases++;
            if (g.noDraw || g.noDot) { finite = false; continue; }
            const tol = 1e-8 * Math.max(1, r, Math.abs(dx), lift);
            equalLengths = equalLengths && near(g.pq, g.tangentLength, tol);
            worst = Math.max(worst, Math.abs(g.pq - g.tangentLength) / Math.max(1, g.tangentLength));
            // Orthogonality of C and the circle centred at P: OP^2 = r^2 + PT^2.
            orthogonal = orthogonal && near(D(s.O, P) * D(s.O, P),
              r * r + g.tangentLength * g.tangentLength, 1e-7 * (r * r + 400));
            if (!referenceQ) referenceQ = g.Q;
            fixed = fixed && nearPoint(g.Q, referenceQ, 1e-9);
            // The remark: reflection of Q in m is a second common point.
            mirrored = mirrored &&
              near(g.mirrorQ.x, g.Q.x, 1e-9) &&
              near(g.mirrorQ.y - lineY, lineY - g.Q.y, 1e-9) &&
              near(D(P, g.mirrorQ), g.tangentLength, tol);
            // T lies on C, PT is perpendicular to OT, M is the foot from O.
            for (const t of g.T) {
              tangencies = tangencies && near(D(t, s.O), r, tol) &&
                near((P.x - t.x) * (t.x - s.O.x) + (P.y - t.y) * (t.y - s.O.y), 0,
                  tol * Math.max(1, r));
            }
            feet = feet && nearPoint(g.M, { x: ox, y: lineY }, tol) &&
              near((g.M.x - ox) * (P.x - X.x) + (g.M.y - lineY) * (P.y - X.y), 0, tol);
            if (g.N) {
              nTangent = nTangent && near(D(g.N, s.O), r, tol) &&
                near((g.M.x - g.N.x) * (g.N.x - ox) + (g.M.y - g.N.y) * (g.N.y - oy), 0,
                  tol * Math.max(1, r));
            }
          }
        }
      }
    }
  }
  check("the grid covers thousands of line-and-point positions", cases > 1500);
  check("no grid case fell into a quiet state", finite);
  check("PQ equals the tangent length PT in every grid case", equalLengths);
  check("the worst relative error is below 1e-10", worst < 1e-10);
  check("each circle centred on m is orthogonal to C", orthogonal);
  check("Q does not move as P slides along m", fixed);
  check("the reflection of Q in m is a second fixed point", mirrored);
  check("both tangency points lie on C and make a right angle", tangencies);
  check("M is the foot of the perpendicular from O to m", feet);
  check("N is a tangency point from M to C", nTangent);

  // Random widths, radii, line heights and P positions, with the line clear
  // of the circle. This also exercises the near-vertical branch of Intersect.
  let randomCases = 0;
  let claim = true;
  for (let i = 0; i < 1400; i++) {
    const w = 200 + random() * 600, h = 200 + random() * 400;
    const O = { x: 30 + random() * (w - 60), y: 30 + random() * (h / 2 - 30) };
    const radius = 15 + random() * 60;
    const R = { x: O.x - radius, y: O.y };
    const lineY = O.y + radius + 5 + random() * (h - radius - O.y - 15);
    if (!(lineY < h - 5)) continue;
    const P = { x: 5 + random() * (w - 10), y: lineY };
    const X = { x: w - 20, y: lineY };
    const s = stateOf(O, R, X, P, w, h);
    const g = C.compute(s);
    if (g.noDraw || g.noDot || !g.N) { claim = false; break; }
    randomCases++;
    const tol = 1e-8 * Math.max(1, radius, w);
    claim = claim && near(g.pq, g.tangentLength, tol) &&
      near(D(P, g.mirrorQ), g.tangentLength, tol) &&
      near(g.Q.x, g.mirrorQ.x, 1e-9) &&
      near(g.Q.y - lineY, lineY - g.mirrorQ.y, 1e-9) &&
      near(D(g.T[0], O), radius, tol) && near(D(g.T[1], O), radius, tol);
  }
  check("1400 random diagrams were built", randomCases >= 1300);
  check("the claim holds for every random diagram", claim);
}

/* -------------- 3. a literal second transcription of the applet's Compute */

const A = {
  d: (p, q) => Math.hypot(p.x - q.x, p.y - q.y),
  sq: (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y),
};

/** GeoSDoub.IntersectCirclesX: the larger y is the first point. */
function aCircleX(a, b) {
  const slope = -(a.y - b.y) / (a.x - b.x);
  const B = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
    a.r * a.r + b.r * b.r) / 2.0 / (a.x - b.x);
  const h = B - a.x;
  const qa = slope * slope + 1.0;
  const qb = slope * h - a.y;
  const qc = h * h + a.y * a.y - a.r * a.r;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
  return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
}

/** GeoSDoub.IntersectCirclesY: the larger x is the first point. */
function aCircleY(a, b) {
  const slope = -(a.x - b.x) / (a.y - b.y);
  const B = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
    a.r * a.r + b.r * b.r) / 2.0 / (a.y - b.y);
  const h = B - a.y;
  const qa = slope * slope + 1.0;
  const qb = slope * h - a.x;
  const qc = h * h + a.x * a.x - a.r * a.r;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
  return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
}

function aCircleIntersect(a, b) {
  if (Math.abs(a.x - b.x) > 1.0) return aCircleX(a, b);
  if (Math.abs(a.y - b.y) > 1.0) return aCircleY(a, b);
  return [{ x: a.x, y: a.y }, { x: a.x, y: a.y }];
}

/** Inversion.Tangent(circle, point): line(m_1 = point, m_2 = tangency). */
function aTangent(circle, p) {
  const power = A.sq(circle, p) - circle.r * circle.r;
  if (power < 0.0) return null;
  const aux = { x: p.x, y: p.y, r: Math.sqrt(power) };
  const pts = aCircleIntersect(circle, aux);
  return [{ m_1: { x: p.x, y: p.y }, m_2: pts[0] },
    { m_1: { x: p.x, y: p.y }, m_2: pts[1] }];
}

/** Tangents.GetExternalTangents: the bigger circle is the first argument. */
function aExternalTangents(c1, c2) {
  const big = c1.r > c2.r ? c1 : c2;
  const small = c1.r > c2.r ? c2 : c1;
  const rBig = big.r, rSmall = small.r;
  const aux = { x: big.x, y: big.y, r: rBig - rSmall };
  const lines = aTangent(aux, small);
  const onBig = lines.map((l) => ({
    x: big.x + (l.m_2.x - big.x) * rBig / (rBig - rSmall),
    y: big.y + (l.m_2.y - big.y) * rBig / (rBig - rSmall),
  }));
  const onSmall = lines.map((l) => ({
    x: small.x + (l.m_2.x - big.x) * rSmall / (rBig - rSmall),
    y: small.y + (l.m_2.y - big.y) * rSmall / (rBig - rSmall),
  }));
  return [{ m_1: onBig[0], m_2: onSmall[0] }, { m_1: onBig[1], m_2: onSmall[1] }];
}

function aOther(a, b, p) {
  return A.d(a, p) < 1.0 ? b : a;
}

function aNearest(p, a, b) {
  if (A.sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const ux = b.x - a.x, uy = b.y - a.y;
  const t = (ux * (p.x - a.x) + uy * (p.y - a.y)) / (ux * ux + uy * uy);
  return { x: a.x + t * ux, y: a.y + t * uy };
}

function aCompute(s, previous) {
  const O = s.O, P = s.P, X = s.X;
  const radius = A.d(O, s.R);
  if (!(A.d(P, O) > A.d(s.R, O))) {
    return Object.assign({}, previous, { noDraw: true, radius });
  }
  const circle = { x: O.x, y: O.y, r: radius };
  const M = aNearest(O, P, X);
  const lines = aExternalTangents(circle, { x: P.x, y: P.y, r: 0.0 });
  const T = [aOther(lines[0].m_1, lines[0].m_2, P),
    aOther(lines[1].m_1, lines[1].m_2, P)];
  const tangentCircle = { center: { x: P.x, y: P.y }, radius: A.d(P, T[0]) };
  const z = Math.sqrt((O.y - X.y) * (O.y - X.y) - radius * radius);
  const result = {
    noDraw: false, radius, M, T, tangentCircle,
    tangentLength: tangentCircle.radius,
  };
  if (Number.isNaN(z)) {
    return Object.assign({ noDot: true }, result, {
      Q: previous && previous.Q, mirrorQ: previous && previous.mirrorQ,
      N: previous && previous.N, z: null, pq: null,
    });
  }
  const Q = { x: O.x, y: X.y - z };
  const mirrorQ = { x: O.x, y: X.y + z };
  const mLines = aExternalTangents(circle, { x: M.x, y: M.y, r: 0.0 });
  const candidates = [
    aOther(mLines[0].m_1, mLines[0].m_2, M),
    aOther(mLines[1].m_1, mLines[1].m_2, M),
  ];
  let N;
  if (P.x < M.x) N = candidates[0].x <= M.x ? candidates[0] : candidates[1];
  else N = candidates[0].x <= M.x ? candidates[1] : candidates[0];
  return Object.assign(result, {
    noDot: false, Q, mirrorQ, N, z, pq: A.d(P, Q),
  });
}

/** Compare the analytic core with the inversion path, point by point. */
function agrees(mine, theirs, tol) {
  if (mine.noDraw !== theirs.noDraw || mine.noDot !== theirs.noDot) return false;
  if (mine.noDraw) return near(mine.radius, theirs.radius, tol);
  if (!nearPoint(mine.M, theirs.M, tol)) return false;
  if (!mine.T || !theirs.T || mine.T.length !== theirs.T.length) return false;
  for (let i = 0; i < mine.T.length; i++) {
    if (!nearPoint(mine.T[i], theirs.T[i], tol)) return false;
  }
  if (!near(mine.tangentLength, theirs.tangentLength, tol)) return false;
  if (mine.noDot) return true;
  return nearPoint(mine.Q, theirs.Q, tol) && nearPoint(mine.mirrorQ, theirs.mirrorQ, tol) &&
    nearPoint(mine.N, theirs.N, tol) && near(mine.z, theirs.z, tol) &&
    near(mine.pq, theirs.pq, tol);
}

{
  const random = rng(4711);
  let agree = true, withN = 0;
  for (let t = 0; t < 1600; t++) {
    const w = 240 + random() * 500, h = 240 + random() * 320;
    const O = { x: 40 + random() * (w - 80), y: 40 + random() * (h - 80) };
    const radius = 20 + random() * 70;
    const R = { x: O.x - radius, y: O.y };
    const lineY = O.y + radius + 5 + random() * Math.max(1, h - O.y - radius - 10);
    const P = { x: 5 + random() * (w - 10), y: lineY };
    const X = { x: w - 20, y: lineY };
    const s = stateOf(O, R, X, P, w, h);
    const mine = C.compute(s);
    const theirs = aCompute(s, null);
    const tol = 1e-6 * Math.max(1, radius, w);
    agree = agree && agrees(mine, theirs, tol);
    if (mine.N) withN++;
  }
  check("1600 random diagrams match the literal applet transcription", agree);
  check("the random comparison reaches N in nearly every case", withN > 1500);

  // Grid cases: near-vertical tangent lines, P on either side of M, and the
  // exact x-switch at P.x == M.x in Compute's choice of N.
  let gridAgree = true, vertical = 0, equalX = 0;
  for (let ox = 100; ox <= 380; ox += 40) {
    for (const r of [25, 45, 65]) {
      for (let lift = 15; lift <= 75; lift += 20) {
        for (let dx = -150; dx <= 150; dx += 30) {
          const X = { x: 460, y: 90 + r + lift };
          const P = { x: ox + dx, y: X.y };
          if (P.x === X.x) continue; // a zero-length line has no foot in either transcription
          const s = stateOf({ x: ox, y: 90 }, { x: ox - r, y: 90 }, X, P);
          const mine = C.compute(s), theirs = aCompute(s, null);
          gridAgree = gridAgree && agrees(mine, theirs, 1e-6 * Math.max(1, r, 200));
          if (Math.abs(s.O.x - s.P.x) <= 1) vertical++;
          if (s.P.x === s.O.x) equalX++;
        }
      }
    }
  }
  check("the grid agrees with the applet too", gridAgree);
  check("the grid exercises near-vertical tangents and P.x == M.x",
    vertical > 0 && equalX > 0);
}

/* --------------------------- 4. the applet's two quiet states and the save */

{
  const s = C.start({ width: 480, height: 360 });
  const shown = C.compute(s);
  // Move P inside the circle: the guard returns before M, T and Q are touched.
  const inside = C.movePoint(C.movePoint(s, "X", { x: s.X.x, y: s.O.y + 10 }),
    "P", { x: s.O.x, y: s.O.y + 10 });
  const quiet = C.compute(inside, shown);
  check("P inside C stops Compute before anything is redrawn", quiet.noDraw);
  check("the stopped frame keeps the last Q, T and N",
    quiet.T === shown.T && quiet.Q === shown.Q && quiet.N === shown.N);

  // Drop m so it cuts C: z is imaginary, so Q and N stay as they were while M
  // and the two tangents from P are still recomputed.
  const cutting = C.movePoint(s, "X", { x: s.X.x, y: s.O.y + 10 });
  const stale = C.compute(cutting, shown);
  check("a line cutting C makes z imaginary but does not stop the frame",
    stale.noDot && !stale.noDraw);
  check("the cut case keeps the old Q and N",
    stale.Q === shown.Q && stale.N === shown.N);
  check("the cut case recomputes M and the tangent circle",
    nearPoint(stale.M, { x: s.O.x, y: cutting.X.y }, 1e-9) &&
    near(stale.tangentLength, D(cutting.P, stale.T[0]), 1e-9));
  check("the cut case agrees with the bytecode transcription",
    agrees(stale, aCompute(cutting, shown), 1e-6 * 100));
  check("the guard agrees with the bytecode transcription",
    agrees(quiet, aCompute(inside, shown), 1e-6 * 100));

  const saved = C.position(cutting, stale);
  check("the saved position is plain board data for the tutor",
    saved.width === 480 && saved.height === 360 &&
    saved.O.x === s.O.x && saved.X.y === cutting.X.y &&
    saved.T.length === 2 && typeof saved.noDot === "boolean" &&
    typeof saved.tangentLength === "number");
  check("saving a position does not change the state", s.X.y === 216 && cutting.P.y === 100);
  check("an illustration has no win or loss", C.result(cutting) === null && C.result(s) === null);
}

done("fixed-tangent-point");
