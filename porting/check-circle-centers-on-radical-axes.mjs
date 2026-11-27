#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-centers-on-radical-axes/circle-centers-on-radical-axes-core.js.
 *
 *   node porting/check-circle-centers-on-radical-axes.mjs
 *
 * The applet draws the three pairwise radical axes of three movable circles,
 * their common point O, and a dot on a centre that lies on the axis of the
 * other two. Its page claims: if P lies on L(Q,R) and Q lies on L(P,R), then R
 * lies on L(P,Q); the radical axis is perpendicular to the centreline; and the
 * radical centre doubles as the triangle's orthocenter. All three are tested
 * here on hundreds of configurations built to satisfy the two hypotheses.
 *
 * Section 4 is a second, literal transcription of the applet's own arithmetic
 * (CTKGeometryPlus.RadicalAxis/Perp/Prorate/Barycenter, GeoSDoub.Intersect,
 * circle intersections, Dist and IsOn, and the canvas Compute guard). It is
 * compared with the core over random, grid and hypothesis-satisfying
 * configurations, not a handful of examples.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-centers-on-radical-axes/circle-centers-on-radical-axes-core.js", "CircleCentersOnRadicalAxesCore");
const D = C.dist;
const stateOf = (centers, radii) => ({
  width: 400, height: 300,
  center: { x: 200, y: 150 },
  circles: centers.map((p, i) => ({ center: { x: p.x, y: p.y }, rim: { x: p.x + radii[i], y: p.y } })),
});

/* ------------------------------------------------------------ 1. the setup */

{
  equal("the applet's suggested board size", [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT], [400, 300]);
  const s = C.start({});
  equal("the guide circle and its centre", s.center, { x: 200, y: 150 });
  const guide = 75;
  const expected = C.START_ANGLES.map((a, i) => ({
    x: 200 + guide * Math.cos(a), y: 150 + guide * Math.sin(a),
  }));
  expected.forEach((p, i) => {
    check("circle " + i + " starts on the guide circle at the applet's angle",
      Math.abs(s.circles[i].center.x - p.x) < 1e-12 &&
      Math.abs(s.circles[i].center.y - p.y) < 1e-12);
    check("circle " + i + " has the applet's rim offset",
      Math.abs(C.radius(s.circles[i]) - [100, 120, 80][i]) < 1e-12 &&
      s.circles[i].rim.y === s.circles[i].center.y);
  });
  check("start depends only on its options",
    JSON.stringify(s) === JSON.stringify(C.start({})));
  const sized = C.start({ width: 360, height: 240 });
  check("the board size scales the starting diagram",
    sized.center.x === 180 && sized.center.y === 120 &&
    Math.abs(sized.circles[2].center.y - 180) < 1e-12);
  check("Reset restores the diagram and keeps the board size",
    JSON.stringify(C.reset(sized)) === JSON.stringify(sized));
}

/* --------------------------------------------- 2. dragging the six points */

{
  const s = C.start({});
  const p = { x: 100, y: 90 };
  const moved = C.movePoint(s, "P", p);
  check("dragging a centre moves it and carries its rim",
    moved.circles[0].center.x === 100 && moved.circles[0].center.y === 90 &&
    Math.abs(moved.circles[0].rim.x - (100 + 100)) < 1e-12 &&
    moved.circles[0].rim.y === 90);
  check("dragging a centre keeps the radius",
    Math.abs(C.radius(moved.circles[0]) - 100) < 1e-12);
  check("other circles are untouched",
    JSON.stringify(moved.circles[1]) === JSON.stringify(s.circles[1]) &&
    JSON.stringify(moved.circles[2]) === JSON.stringify(s.circles[2]));
  check("moving a centre leaves the input state alone", s.circles[0].center.x !== 100);
  const resized = C.movePoint(s, "Qp", { x: s.circles[1].center.x, y: s.circles[1].center.y + 50 });
  check("dragging a rim changes only that radius",
    resized.circles[1].center.x === s.circles[1].center.x &&
    Math.abs(C.radius(resized.circles[1]) - 50) < 1e-12 &&
    JSON.stringify(resized.circles[0]) === JSON.stringify(s.circles[0]));
  const unknown = C.movePoint(s, "X", p);
  check("an unknown handle is ignored", unknown === s);
}

/* -------------------------- 3. the page's three claims, over many cases --- */

/** Independent orthocenter of a triangle, from two altitude intersections. */
function orthocenter(a, b, c) {
  // The altitude from a is perpendicular to the side bc, and likewise at b.
  const d1 = { x: -(c.y - b.y), y: c.x - b.x };
  const d2 = { x: -(c.y - a.y), y: c.x - a.x };
  const cross = d1.x * d2.y - d1.y * d2.x;
  const t = ((b.x - a.x) * d2.y - (b.y - a.y) * d2.x) / cross;
  return { x: a.x + d1.x * t, y: a.y + d1.y * t };
}

/**
 * Build circles whose centres are P,Q,R and whose radii make P and Q "on".
 * `extra` is a free radius slack: R's radius is raised only as far as needed
 * for the other two radii to be real and positive.
 */
function satisfying(centers, extra) {
  const [P, Q, R] = centers;
  const a = D(P, Q) * D(P, Q), b = D(P, R) * D(P, R), c = D(Q, R) * D(Q, R);
  const rR = Math.sqrt(Math.max(b - a, c - a, 0) + extra * extra);
  const q2 = a - b + rR * rR, p2 = a - c + rR * rR;
  if (q2 <= 1 || p2 <= 1) return null;
  return stateOf(centers, [Math.sqrt(p2), Math.sqrt(q2), rR]);
}

{
  const random = rng(20261126);
  let built = 0, exact = true, flags = true, orth = true, perps = true, powers = true;
  let skipped = 0;
  for (let t = 0; t < 900; t++) {
    const centers = [0, 1, 2].map(() => ({
      x: 20 + random() * 360, y: 20 + random() * 260,
    }));
    const s = satisfying(centers, 20 + random() * 60);
    if (!s) continue;
    built++;
    const gs = s.circles.map(C.asCircle);
    // The hypotheses and the conclusion, as powers (independent of the axes).
    const e1 = C.power(s.circles[1], centers[0]) - C.power(s.circles[2], centers[0]);
    const e2 = C.power(s.circles[0], centers[1]) - C.power(s.circles[2], centers[1]);
    const e3 = C.power(s.circles[0], centers[2]) - C.power(s.circles[1], centers[2]);
    const scale = Math.max(1, ...gs.map((g) => g.radius));
    powers = powers && Math.abs(e1) < 1e-8 * scale && Math.abs(e2) < 1e-8 * scale &&
      Math.abs(e3) < 1e-8 * scale;
    const info = C.compute(s);
    if (info.skipped) { skipped++; continue; }
    flags = flags && info.on.P && info.on.Q && info.on.R && info.all;
    if (Number.isFinite(info.center.x)) {
      const h = orthocenter(centers[0], centers[1], centers[2]);
      orth = orth && D(info.center, h) < 1e-5 * scale;
    }
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const axis = C.radicalAxis(gs[a], gs[b]);
      if (!axis) continue;
      const u = { x: axis.r.x - axis.p.x, y: axis.r.y - axis.p.y };
      const v = { x: gs[b].center.x - gs[a].center.x, y: gs[b].center.y - gs[a].center.y };
      perps = perps && Math.abs(u.x * v.x + u.y * v.y) < 1e-6 * (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) + 1);
    }
  }
  check("900 random trials built many theorem-satisfying configurations", built > 500);
  check("the two hypotheses and the conclusion hold as power equalities", powers);
  check("the applet marks P, Q and R in every satisfying configuration", flags);
  check("the theorem-satisfying trials reach Compute", skipped === 0);
  check("the computed radical centre is the orthocenter of PQR", orth);
  check("every radical axis is perpendicular to its centreline", perps);
}

{
  // Once P and Q are marked the theorem forces R to be marked as well; that
  // is the whole droodle. Nudging R's radius breaks the two hypotheses but
  // not R's own condition, which only involves P, Q and their two radii.
  const centers = [{ x: 80, y: 220 }, { x: 310, y: 200 }, { x: 230, y: 60 }];
  const s = satisfying(centers, 70);
  const info = C.compute(s);
  check("the example marks all three centres", info.on.P && info.on.Q && info.on.R && info.all);
  const gs = s.circles.map(C.asCircle);
  const moved = stateOf(centers, [gs[0].radius, gs[1].radius, gs[2].radius + 4]);
  const after = C.compute(moved);
  check("nudging R's radius breaks the two hypotheses", !after.on.P && !after.on.Q);
  check("R's own condition does not depend on R's radius", after.on.R);
}

/* ------------- 4. a second transcription of the applet's own computation -- */

const A = {
  d: (p, q) => Math.hypot(p.x - q.x, p.y - q.y),
  sq: (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y),
};
function aMid(p, q) { return { x: (p.x + q.x) / 2.0, y: (p.y + q.y) / 2.0 }; }
function aPerp(p, q, c) {
  if (c === null) c = aMid(p, q);
  return { x: c.x + (p.y - q.y) * 10.0, y: c.y - (p.x - q.x) * 10.0 };
}
function aProrate(p, q, t) {
  const d = A.d(p, q);
  if (d < 0.1) return p;
  t = t / d;
  return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
}
function aBary(p, q, r) {
  return { x: (p.x + q.x + r.x) / 3.0, y: (p.y + q.y + r.y) / 3.0 };
}
function aCircleX(a, b) {
  const slope = -(a.center.y - b.center.y) / (a.center.x - b.center.x);
  const B = ((a.center.x * a.center.x - b.center.x * b.center.x +
    a.center.y * a.center.y - b.center.y * b.center.y -
    a.radius * a.radius + b.radius * b.radius) / 2.0) / (a.center.x - b.center.x);
  const h = B - a.center.x;
  const qa = slope * slope + 1.0;
  const qb = slope * h - a.center.y;
  const qc = h * h + a.center.y * a.center.y - a.radius * a.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
  return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
}
function aCircleY(a, b) {
  const slope = -(a.center.x - b.center.x) / (a.center.y - b.center.y);
  const B = ((a.center.y * a.center.y - b.center.y * b.center.y +
    a.center.x * a.center.x - b.center.x * b.center.x -
    a.radius * a.radius + b.radius * b.radius) / 2.0) / (a.center.y - b.center.y);
  const h = B - a.center.y;
  const qa = slope * slope + 1.0;
  const qb = slope * h - a.center.x;
  const qc = h * h + a.center.x * a.center.x - a.radius * a.radius;
  let disc = qb * qb - qa * qc;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
  return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
}
function aCircleIntersect(a, b) {
  if (Math.abs(a.center.x - b.center.x) > 1.0) return aCircleX(a, b);
  if (Math.abs(a.center.y - b.center.y) > 1.0) return aCircleY(a, b);
  return [{ x: a.center.x, y: a.center.y }, { x: a.center.x, y: a.center.y }];
}
function aRadical(a, b) {
  const pts = aCircleIntersect(a, b);
  if (pts !== null && pts[0] !== null && pts[1] !== null) {
    if (A.d(pts[0], pts[1]) < 1.0) {
      const m = aMid(pts[0], pts[1]);
      return { p: m, r: aPerp(pts[0], pts[1], m) };
    }
    return { p: pts[0], r: pts[1] };
  }
  const d = A.d(a.center, b.center);
  if (d < 1.0) return null;
  const t = (a.radius * a.radius - b.radius * b.radius) / d;
  const m = aProrate(a.center, b.center, (t + d) / 2.0);
  return { p: aPerp(a.center, b.center, m), r: m };
}
function aLineIntersection(p, q, u, v) {
  const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
  const d = u.y - v.y, e = v.x - u.x, f = u.x * v.y - u.y * v.x;
  const den = a * e - d * b;
  let x = NaN, y = NaN;
  if (!(Math.abs(den) < 1.0)) { x = (b * f - e * c) / den; y = (c * d - f * a) / den; }
  return { x, y };
}
function aDistPointLine(p, line) {
  if (A.sq(line.p, p) < 0.1) return 0.0;
  const dx = line.r.x - line.p.x, dy = line.r.y - line.p.y;
  const t = (dx * (p.x - line.p.x) + dy * (p.y - line.p.y)) / (dx * dx + dy * dy);
  const rx = line.p.x - p.x + dx * t, ry = line.p.y - p.y + dy * t;
  return Math.sqrt(rx * rx + ry * ry);
}
function aIsOn(p, line) { return aDistPointLine(p, line) < 1.0; }
function aCompute(state, previous) {
  const prev = previous || state.center;
  const P = state.circles[0].center, Q = state.circles[1].center, R = state.circles[2].center;
  if (A.d(prev, P) < 1.0 || A.d(prev, Q) < 1.0 || A.d(prev, R) < 1.0) {
    return { skipped: true, center: prev, axes: null, on: [false, false, false] };
  }
  const gs = state.circles.map((c) => ({ center: c.center, radius: C.radius(c) }));
  const PQ = aRadical(gs[0], gs[1]), QR = aRadical(gs[1], gs[2]), RP = aRadical(gs[2], gs[0]);
  let center = { x: NaN, y: NaN };
  if (PQ !== null && QR !== null && RP !== null) {
    center = aBary(
      aLineIntersection(PQ.p, PQ.r, QR.p, QR.r),
      aLineIntersection(QR.p, QR.r, RP.p, RP.r),
      aLineIntersection(RP.p, RP.r, PQ.p, PQ.r));
  }
  return {
    skipped: false, center, axes: { PQ, QR, RP },
    on: [aIsOn(P, QR), aIsOn(Q, RP), aIsOn(R, PQ)],
  };
}

/** Treat a NaN pair as an equal pair; everything else is compared with a tol. */
function samePoint(a, b, tol) {
  const same = (x, y) => (Number.isNaN(x) && Number.isNaN(y)) ||
    (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tol);
  return !!a && !!b && same(a.x, b.x) && same(a.y, b.y);
}
function sameLine(a, b, tol) {
  if (!a || !b) return a === b;
  return samePoint(a.p, b.p, tol) && samePoint(a.r, b.r, tol);
}
function sameResult(mine, theirs, tol) {
  if (mine.skipped !== theirs.skipped) return false;
  if (!samePoint(mine.center, theirs.center, tol)) return false;
  if (mine.skipped) return true;
  return sameLine(mine.axes.PQ, theirs.axes.PQ, tol) &&
    sameLine(mine.axes.QR, theirs.axes.QR, tol) &&
    sameLine(mine.axes.RP, theirs.axes.RP, tol) &&
    mine.on.P === theirs.on[0] && mine.on.Q === theirs.on[1] && mine.on.R === theirs.on[2];
}

{
  const random = rng(4711);
  let agree = true, axesExist = 0;
  for (let t = 0; t < 1200; t++) {
    const s = stateOf(
      [0, 1, 2].map(() => ({ x: random() * 400, y: random() * 300 })),
      [5 + random() * 160, 5 + random() * 160, 5 + random() * 160]);
    const mine = C.compute(s);
    const theirs = aCompute(s);
    const tol = 1e-6 * Math.max(1, ...s.circles.map((c) => C.radius(c)));
    agree = agree && sameResult(mine, theirs, tol);
    if (mine.axes && mine.axes.PQ && mine.axes.QR && mine.axes.RP) axesExist++;
  }
  check("1200 random configurations agree with the applet's Compute", agree);
  check("the random set exercises the drawn axes", axesExist > 1000);
}

{
  // Grid cases: vertical, horizontal, coincident and nearly coincident
  // centres, circles that meet and circles that do not.
  let agree = true, chord = 0, centerline = 0, degenerate = 0;
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      for (let c = 0; c <= 5; c++) {
        const centers = [
          { x: 100 + a * 10, y: 150 },
          { x: 200, y: 100 + b * 10 },
          { x: 300 - c * 40, y: 200 + c * 5 },
        ];
        const radii = [20 + a * 20, 30 + b * 15, 25 + c * 20];
        const s = stateOf(centers, radii);
        const mine = C.compute(s), theirs = aCompute(s);
        const tol = 1e-6 * Math.max(...radii);
        agree = agree && sameResult(mine, theirs, tol);
        if (mine.axes && mine.axes.PQ) {
          if (C.circleIntersections(C.asCircle(s.circles[0]), C.asCircle(s.circles[1]))) chord++;
          else centerline++;
        }
        if (mine.skipped) degenerate++;
      }
    }
  }
  check("216 grid configurations agree with the applet's Compute", agree);
  check("the grid covers both intersecting and separate circles", chord > 20 && centerline > 20);
  check("the grid covers the guard's degenerate cases", degenerate > 0);
}

{
  const random = rng(99173);
  let agree = true, built = 0;
  for (let t = 0; t < 500; t++) {
    const centers = [0, 1, 2].map(() => ({ x: 30 + random() * 340, y: 30 + random() * 240 }));
    const s = satisfying(centers, 25 + random() * 50);
    if (!s) continue;
    built++;
    agree = agree && sameResult(C.compute(s), aCompute(s), 1e-6 * 250);
  }
  check("theorem-satisfying configurations agree with the applet too", built > 200 && agree);

  // The guard: an O within one pixel of a centre stops the update, as in the
  // bytecode's three dcmpg/iflt tests.
  const s = C.start({});
  check("the applet's guard skips when O is on a centre",
    C.compute(s, s.circles[0].center).skipped && aCompute(s, s.circles[0].center).skipped);
  check("the applet's guard lets a distant O through",
    !C.compute(s).skipped && !aCompute(s).skipped);
  check("the applet's guard likewise skips Q and R",
    [1, 2].every((i) => C.compute(s, s.circles[i].center).skipped));
}

/* ------------------------------------------------------ 5. saved position */

{
  const s = C.start({});
  const info = C.compute(s);
  const p = C.position(s, info);
  check("the saved position is plain data for the tutor",
    typeof p.width === "number" && p.circles.length === 3 &&
    p.circles.every((c) => typeof c.center.x === "number" && typeof c.radius === "number") &&
    typeof p.all === "boolean");
  check("the saved position includes the radical centre and the three marks",
    typeof p.center.x === "number" && Object.keys(p.on).join() === "P,Q,R");
  const before = JSON.stringify(s);
  C.position(C.movePoint(s, "R", { x: 10, y: 10 }));
  check("computing a position never changes the state", JSON.stringify(s) === before);
}

done("circle-centers-on-radical-axes");
