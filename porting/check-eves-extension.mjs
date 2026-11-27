#!/usr/bin/env node
"use strict";

/*
 * Logic test for eves-extension/eves-extension-core.js.
 *
 *   node porting/check-eves-extension.mjs
 *
 * The page claims that (a) for even polygons the second trip around the
 * polygon repeats exactly the points of the first, whatever the start, (b) for
 * odd polygons this happens when the start is a point of tangency, (c) an even
 * tangential polygon has a1+a3+... = a2+a4+..., which for a quadrilateral is
 * necessary and sufficient for an incircle but for larger n is only necessary,
 * and (d) Stone's sequence still closes for even polygons with no incircle and
 * may close for odd ones without one. All of these are checked over n=3..20.
 *
 * The first section is a second, literal transcription of the applet's own
 * bytecode (GeoSDoub.Intersect/FindOrientation/ComputeSignedAngle/Rotate/
 * NearestPoint and EvesExtensionCanvas.GetCircle/GetTangent/Compute), compared
 * with the core on every value of N and many configurations and start points.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("eves-extension/eves-extension-core.js", "EvesExtensionCore");

const close = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const closePoint = (p, q, tol = 1e-8) => isFinite(p.x) && isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const closeArray = (a, b, tol = 1e-8) => a.length === b.length &&
  a.every((p, i) => closePoint(p, b[i], tol));

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("default N is 5", s.n, 5);
  equal("default board is 400 by 250", [s.width, s.height], [400, 250]);
  equal("five tangency points", s.points.length, 5);
  check("no win or loss in a picture", C.result(s) === null);
  check("the start point is on the horizontal radius",
    close(s.start.y, C.circleFor(s.points).center.y) &&
    close(s.start.x, C.circleFor(s.points).center.x + C.circleFor(s.points).radius / 5));
  equal("N is clamped at 3", C.setCount(s, 1).n, 3);
  equal("N is clamped at 20", C.setCount(s, 99).n, 20);
  equal("Reset keeps N", C.reset(C.start({ n: 12 })).n, 12);
  const moved = C.movePoint(s, 2, C.point(300, 90));
  const circle = C.circleFor(s.points);
  check("a dragged point stays on the circle",
    close(C.dist(moved.points[2], circle.center), circle.radius, 1e-9));
  check("other points are not moved", closePoint(moved.points[1], s.points[1]));
  const s2 = C.setStart(s, C.point(310, 180));
  check("the start point can be dragged anywhere", closePoint(s2.start, C.point(310, 180)));
  check("tangency start is the point on side 1",
    closePoint(C.startAtTangency(s).start, s.points[1]));
  check("positions are plain data", JSON.stringify(C.position(s)).length > 100 &&
    typeof C.position(s).n === "number");
}

/* --------------- configurations: points on the circle, well spread out --- */
function configuration(n, seed) {
  const rand = rng(seed);
  let gaps, total;
  do {
    gaps = Array.from({ length: n }, () => 0.16 + 1.0 * rand());
    total = gaps.reduce((a, b) => a + b, 0);
    // Every side of a genuine tangential polygon must be shorter than a
    // semicircle; otherwise tangents meet on the wrong side of the circle.
  } while (Math.max.apply(null, gaps) / total > 0.42);
  const center = C.point(200, 125), radius = 62;
  let angle = 2 * Math.PI * rand();
  const points = gaps.map((g) => {
    const p = C.point(center.x + radius * Math.cos(angle),
      center.y - radius * Math.sin(angle));
    angle += 2 * Math.PI * g / total;
    return p;
  });
  return { center: center, radius: radius, points: points };
}

/* ---- 2. a second transcription, line by line from the applet's bytecode --- */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
function jIntersect(a, b, c, d) {
  const s1 = a.y - b.y;                       // local 4, bytecode 0..9
  const s2 = b.x - a.x;                       // local 6, 11..20
  const s3 = a.x * b.y - a.y * b.x;           // local 8, 22..41
  const t1 = c.y - d.y;                       // local 10, 43..52
  const t2 = d.x - c.x;                       // local 12, 54..63
  const t3 = c.x * d.y - c.y * d.x;           // local 14, 65..84
  const det = s1 * t2 - t1 * s2;              // local 20, 112..123
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };  // bytecode 128..147
  return {
    x: (s2 * t3 - t2 * s3) / det,             // local 16 / det
    y: (s3 * t1 - t3 * s1) / det,             // local 18 / det
  };
}

/* GeoSDoub.FindCircumcenter(a,b,c) and GetCircle's mean radius. */
function jCircle(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const q1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  const center = jIntersect(m1, q1, m2, q2);
  const length = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const r = (length(center, a) + length(center, b) + length(center, c)) / 3;
  return { center: center, radius: r };
}

/* GeoSDoub.FindOrientation(a,b,c): bytecode 0..59 of javap. */
function jOrientation(a, b, c) {
  const value = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return value > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle(a,b,c): law of cosines, sign by orientation. */
function jAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const len = (p, q) => Math.sqrt(sq(p, q));
  const cos = (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * len(a, b) * len(a, c));
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (angle > 0.99 && sq(a, b) === 0) return Math.PI;
  return jOrientation(a, b, c) === 1 ? angle : -angle;
}

/* GeoSDoub.Rotate(center,p,angle,1): bytecode 423..495. */
function jRotate(center, p, angle) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: center.x + co * (p.x - center.x) - si * (p.y - center.y),
    y: center.y + si * (p.x - center.x) + co * (p.y - center.y),
  };
}

/* GeoSDoub.NearestPoint(p,a,b): bytecode 1434..1487. */
function jNearest(p, a, b) {
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* EvesExtensionCanvas.Reset + GetTangent + Compute, without the drawing. */
function jCompute(points, S) {
  const n = points.length;
  const circle = jCircle(points[0], points[1], points[2]);
  const tangents = points.map((p) => ({
    from: { x: p.x, y: p.y },
    to: { x: p.x - (p.y - circle.center.y), y: p.y + (p.x - circle.center.x) },
  }));
  const V = tangents.map((line, i) => {
    const next = tangents[(i + 1) % n];
    return jIntersect(line.from, line.to, next.from, next.to);
  });
  const F = [jNearest(S, V[0], V[1])];
  for (let i = 1; i < n; i++) {
    const next = (i + 1) % n;
    F.push(jRotate(V[i], F[i - 1], jAngle(V[i], V[i - 1], V[next])));
  }
  const G = [jRotate(V[0], F[n - 1], jAngle(V[0], V[n - 1], V[1]))];
  for (let i = 1; i < n; i++) {
    const next = (i + 1) % n;
    G.push(jRotate(V[i], G[i - 1], jAngle(V[i], V[i - 1], V[next])));
  }
  // Compute()'s last Rotate(V[0], ..., G[n-1]) is popped, not stored.
  return { circle: circle, V: V, F: F, G: G };
}

for (let n = 3; n <= 20; n++) {
  let same = true;
  for (let seed = 1; seed <= 12 && same; seed++) {
    const cfg = configuration(n, seed * 1000 + n);
    const starts = [
      { x: cfg.center.x + cfg.radius / n, y: cfg.center.y },
      cfg.points[1],
      { x: 251 + seed, y: 97 + seed },
    ];
    for (const S of starts) {
      const state = C.setStart({
        n: n, width: 400, height: 250, points: cfg.points, start: S,
      }, S);
      const mine = C.compute(state);
      const j = jCompute(cfg.points, S);
      if (!closePoint(mine.circle.center, j.circle.center, 1e-7) ||
          !close(mine.circle.radius, j.circle.radius, 1e-7) ||
          !closeArray(mine.V, j.V, 1e-7) ||
          !closeArray(mine.F, j.F, 1e-7) ||
          !closeArray(mine.G, j.G, 1e-7)) same = false;
    }
  }
  check(`core = second bytecode transcription for N=${n}`, same);
}

/* Golden numbers printed by the original class files under Java 21, with
 * reflection calling Reset() and Compute() at 400x250 and the applet's S. */
const golden = (n, F, G) => {
  const d = C.compute(C.start({ n: n }));
  check(`Java golden F for N=${n}`, closeArray(d.F, F.map((p) => C.point(p[0], p[1])), 1e-8));
  check(`Java golden G for N=${n}`, closeArray(d.G, G.map((p) => C.point(p[0], p[1])), 1e-8));
};
golden(4,
  [[215.5, 63], [138, 140.5], [184.5, 187], [262, 109.5]],
  [[215.5, 63], [138, 140.5], [184.5, 187], [262, 109.5]]);
golden(6,
  [[238.75, 75.78088955158445], [161.25, 75.78088955158438], [138, 116.05107082756085],
    [176.75, 183.16803962085473], [223.25, 183.1680396208547], [262, 116.05107082756078]],
  [[238.75, 75.78088955158455], [161.24999999999991, 75.78088955158435],
    [138.00000000000006, 116.05107082756079], [176.7499999999999, 183.1680396208548],
    [223.24999999999991, 183.16803962085467], [262.00000000000006, 116.05107082756071]]);

/* ------------------------------------------- 3. every claim on the page */

for (let n = 4; n <= 20; n += 2) {
  let closes = true, sums = true;
  for (let seed = 1; seed <= 40; seed++) {
    const cfg = configuration(n, seed * 7919 + n);
    const S = seed % 2
      ? C.point(cfg.center.x + cfg.radius / n, cfg.center.y)
      : C.point(cfg.center.x + 30 + seed, cfg.center.y - 20 - seed);
    const d = C.compute(C.setStart({ n: n, width: 400, height: 250,
      points: cfg.points, start: S }, S));
    if (d.gap > 1e-6) closes = false;
    if (Math.abs(d.alternating) > 1e-6) sums = false;
  }
  check(`even N=${n}: the second lap repeats the first for every start`, closes);
  check(`even N=${n}: a1+a3+... = a2+a4+...`, sums);
}

for (let n = 3; n <= 19; n += 2) {
  let atTangency = true, atDefault = false;
  for (let seed = 1; seed <= 30; seed++) {
    const cfg = configuration(n, seed * 104729 + n);
    const base = { n: n, width: 400, height: 250, points: cfg.points, start: null };
    const tangency = C.compute(C.startAtTangency(C.setStart(base, cfg.points[1])));
    if (tangency.gap > 1e-6) atTangency = false;
    const S = C.point(cfg.center.x + cfg.radius / n, cfg.center.y);
    if (C.compute(C.setStart(base, S)).gap > 1e-4) atDefault = true;
  }
  check(`odd N=${n}: closure at a tangency point`, atTangency);
  check(`odd N=${n}: the default start does not close`, atDefault);
}

/* The quadrilateral condition: necessary and sufficient. */
{
  let tangentialPasses = true, pitotHasIncircle = true, nonPitotFails = true;
  for (let seed = 1; seed <= 120; seed++) {
    const rand = rng(seed * 31);
    // Four tangent points on one circle give a tangential quadrilateral.
    const cfg = configuration(4, seed * 313);
    const corners = C.compute(C.start({ n: 4, points: cfg.points })).V;
    if (Math.abs(C.alternatingSum(corners)) > 1e-6 || !C.hasIncircle(corners)) {
      tangentialPasses = false;
    }

    // Converse: build a convex quadrilateral with a+c=b+d using two circles.
    const a = 1 + rand() * 3, b = 1 + rand() * 3;
    const A = C.point(0, 0), B = C.point(a, 0);
    const Cc = C.point(a + rand() * 2 - 0.5, 1 + rand() * 2);
    const r2 = C.dist(B, Cc), r3 = r2 + 0.2 + rand() * 3, r4 = r3 + a - r2;
    const d = C.dist(Cc, A);
    if (r4 <= 0 || d > r3 + r4 || d < Math.abs(r3 - r4)) continue;
    const x = (r3 * r3 - r4 * r4 + d * d) / (2 * d);
    const h2 = r3 * r3 - x * x;
    if (h2 <= 0) continue;
    const ex = C.mul(C.sub(A, Cc), 1 / d), base = C.add(Cc, C.mul(ex, x));
    const perp = C.point(-ex.y, ex.x), D = C.add(base, C.mul(perp, Math.sqrt(h2)));
    const quad = [A, B, Cc, D];
    const crosses = quad.map((p, i) => {
      const q = quad[(i + 1) % 4], r = quad[(i + 2) % 4];
      return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    });
    if (!crosses.every((v) => v > 0) && !crosses.every((v) => v < 0)) continue;
    if (Math.abs(C.alternatingSum(quad)) > 1e-9 || !C.hasIncircle(quad)) {
      pitotHasIncircle = false;
    }
    // Break Pitot by moving D slightly: a convex quadrilateral then has no incircle.
    const broken = [A, B, Cc, C.add(D, C.point(0.35, 0.12))];
    if (Math.abs(C.alternatingSum(broken)) > 1e-3 && C.hasIncircle(broken, 1e-4)) {
      nonPitotFails = false;
    }
  }
  check("tangential quadrilaterals satisfy Pitot and have an incircle", tangentialPasses);
  check("convex quadrilaterals with a+c=b+d have an incircle", pitotHasIncircle);
  check("convex quadrilaterals without a+c=b+d have no incircle", nonPitotFails);
}

/* Larger n: the sum is necessary but not sufficient; the loops still close. */
{
  const hex = [[181.1453, 41.9972], [189.8911, 40.5695], [254.2405, 58.181],
    [206.7762, 219.7445], [203.9147, 219.9148], [125.65, 219.4588]]
    .map((p) => C.point(p[0], p[1]));
  check("the hexagon has no incircle", C.incircleError(hex) > 100);
  check("but its alternating side sum is 0", Math.abs(C.alternatingSum(hex)) < 1e-4);
  let closes = true;
  for (let k = 0; k < 20; k++) {
    const S = C.point(200 + 7 * k, 130 - 3 * k);
    if (C.polygonLoop(hex, S).gap > 1e-4) closes = false;
  }
  check("Stone's sequence closes on this hexagon for every start", closes);

  /* An odd polygon with no incircle can still close, at the fixed point of
   * the half-turn left by one lap (a point of tangency in the tangential case). */
  const pent = [[116.769, 95.7567], [158.8975, 49.9339], [158.9503, 49.9068],
    [289.9588, 127.2783], [150.6468, 131.9079]].map((p) => C.point(p[0], p[1]));
  check("the pentagon has no incircle", C.incircleError(pent) > 10);
  const mid = C.polygonLoop(pent, C.point(150, 90));
  const fixed = C.point((mid.F[0].x + mid.G[0].x) / 2, (mid.F[0].y + mid.G[0].y) / 2);
  const lap = C.polygonLoop(pent, fixed);
  check("the half-turn fixed point lies on the first side",
    C.dist(fixed, C.nearest(fixed, pent[0], pent[1])) < 1e-3);
  check("an odd polygon without an incircle closes there", lap.gap < 1e-6);

  /* An n-gon with n>3 is flexible: the same six side lengths, one tangential
   * and one not. */
  const regular = C.compute(C.start({ n: 6 })).V;
  const regularSides = C.sideLengths(regular).map((s) => s.toFixed(6));
  const hexSides = C.sideLengths(hex).map((s) => s.toFixed(6));
  check("two hexagons need not have the same side lengths",
    regularSides.join(",") !== hexSides.join(","));
}

done("eves-extension");
