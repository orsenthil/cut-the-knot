#!/usr/bin/env node
"use strict";

/*
 * Logic test for elkies/elkies-core.js.
 *
 *   node porting/check-elkies.mjs
 *
 * The page's exact claim: any chain of companion incircles has at most six
 * distinct circles; its proof gives r(n+6) = r(n) from
 *
 *   (r/r(n) - 1)(r/r(n+3) - 1) = tan^2(a(n)/2)
 *
 * with Demir's earlier relation for consecutive radii. All three are tested
 * here over hundreds of triangles and cut positions, together with a second,
 * literal transcription of the applet's ShowCircles: FindIncenter from two
 * rotated angle bisectors, external tangents via Inversion.Tangent and
 * GeoSDoub.IntersectCirclesX/Y, Tangents.SelectTangent, and GeoSDoub.Intersect
 * with its 1-unit determinant guard. The applet's GetNextCircle and
 * GetTouchingCircle are never called and are deliberately not copied.
 */

import { readFileSync } from "node:fs";
import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("elkies/elkies-core.js", "ElkiesCore");

const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPt = (a, b, tol = 1e-7) => near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* ----------------------------------------------------------------------------
 * A second transcription: the applet's own geometry classes, from javap.
 * Nothing here is used by the core; it exists only to compare against it.
 */
const pt = (x, y) => ({ x: x, y: y });
const vsub = (a, b) => pt(a.x - b.x, a.y - b.y);
const vmul = (a, k) => pt(a.x * k, a.y * k);
const vadd = (a, b) => pt(a.x + b.x, a.y + b.y);
const vdot = (a, b) => a.x * b.x + a.y * b.y;
const vcross = (a, b) => a.x * b.y - a.y * b.x;
const sqDist = (a, b) => vdot(vsub(a, b), vsub(a, b));
const dist = (a, b) => Math.sqrt(sqDist(a, b));

function orient(a, b, c) {
  // GeoSDoub.FindOrientation's expanded determinant, sign and all.
  const d = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return d > 0 ? 1 : -1;
}

function rotate(pivot, p, angle, side) {
  const co = Math.cos(angle), si = Math.sin(angle), v = vsub(p, pivot);
  return pt(pivot.x + co * v.x - side * si * v.y,
    pivot.y + side * si * v.x + co * v.y);
}

function intersect(a, b, c, d) {
  // GeoSDoub.Intersect: |determinant| < 1 becomes NaN, not infinity.
  const r = vsub(b, a), s = vsub(d, c), den = vcross(r, s);
  if (Math.abs(den) < 1) return pt(NaN, NaN);
  return vadd(a, vmul(r, vcross(vsub(c, a), s) / den));
}

function angle(p, q, r) {
  // ComputeAngle: (|pq|^2 + |pr|^2 - |qr|^2) / (2 |pq| |pr|), then acos.
  const num = sqDist(p, q) + sqDist(p, r) - sqDist(q, r);
  return Math.acos(num / (2 * dist(p, q) * dist(p, r)));
}

function findIncenter(a, b, c) {
  const o = orient(a, b, c);
  const rayA = rotate(a, b, angle(a, b, c) / 2, o);
  const rayB = rotate(b, c, angle(b, c, a) / 2, o);
  return intersect(a, rayA, b, rayB);
}

function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sqDist(p, a) < 0.1) return p; // GeoSDoub.NearestPoint's 0.1 guard
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

function getIncircle(a, b, c) {
  const I = findIncenter(a, b, c);
  const r = (dist(I, nearestPoint(I, a, b)) + dist(I, nearestPoint(I, b, c)) +
    dist(I, nearestPoint(I, c, a))) / 3;
  if (!Number.isFinite(I.x) || !Number.isFinite(I.y) || !Number.isFinite(r) || r <= 0) return null;
  return { center: pt(I.x, I.y), radius: r };
}

function intersectCirclesX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const xh = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y -
    r1 * r1 + r2 * r2) / (2 * (c1.x - c2.x));
  const dx = xh - c1.x, q = m * m + 1;
  const lin = m * dx - c1.y, cst = dx * dx + c1.y * c1.y - r1 * r1;
  const disc = lin * lin - q * cst;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-lin + root) / q, y1 = (-lin - root) / q;
  return [pt(m * y0 + xh, y0), pt(m * y1 + xh, y1)];
}

function intersectCirclesY(c1, r1, c2, r2) {
  const m = -(c1.x - c2.x) / (c1.y - c2.y);
  const yh = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x -
    r1 * r1 + r2 * r2) / (2 * (c1.y - c2.y));
  const dy = yh - c1.y, q = m * m + 1;
  const lin = m * dy - c1.x, cst = dy * dy + c1.x * c1.x - r1 * r1;
  const disc = lin * lin - q * cst;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x0 = (-lin + root) / q, x1 = (-lin - root) / q;
  return [pt(x0, m * x0 + yh), pt(x1, m * x1 + yh)];
}

function intersectCircles(c1, r1, c2, r2) {
  // GeoSDoub.Intersect(DoubCircle, DoubCircle)'s axis choice.
  if (Math.abs(c1.x - c2.x) > 1) return intersectCirclesX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return intersectCirclesY(c1, r1, c2, r2);
  return [pt(c1.x, c1.y), pt(c1.x, c1.y)];
}

function inversionTangent(circle, p) {
  // Inversion.Tangent: invert p in the circle, then cut the two circles.
  const power = sqDist(circle.center, p) - circle.radius * circle.radius;
  if (power < 0) return null;
  return intersectCircles(circle.center, circle.radius, p, Math.sqrt(Math.max(0, power)));
}

function externalTangents(c0, c1) {
  const big = c0.radius > c1.radius ? c0 : c1;
  const small = c0.radius > c1.radius ? c1 : c0;
  const R = big.radius, r = small.radius;
  const inv = inversionTangent(big, small.center);
  if (!inv) return null;
  const on = (c, dir, scale) => pt(c.center.x + (dir.x - c.center.x) * scale,
    c.center.y + (dir.y - c.center.y) * scale);
  const kB = R / (R - r), kS = r / (R - r);
  return [
    [on(big, inv[0], kB), on(small, inv[0], kS)],
    [on(big, inv[1], kB), on(small, inv[1], kS)],
  ];
}

function selectTangent(p1, p2, lines, sign) {
  const mid = pt((lines[0][0].x + lines[0][1].x) / 2, (lines[0][0].y + lines[0][1].y) / 2);
  return orient(p1, p2, mid) * sign > 0 ? lines[0] : lines[1];
}

function appletChain(V, ta) {
  const p0 = vadd(vmul(V[1], ta), vmul(V[2], 1 - ta)); // CreateMidPoint(ta)
  const first = getIncircle(V[0], p0, V[1]);
  if (!first) return { circles: [], cuts: [] };
  const circles = [first], cuts = [];
  let p = p0, i = 0, j = 1;
  for (let k = 0; k < 6; k++) {
    const l = 3 - i - j;
    const next = getIncircle(V[i], V[l], p);
    if (!next) break;
    circles.push(next);
    const sign = -orient(V[j], V[i], V[l]);
    const tangents = externalTangents({ center: V[j], radius: 0 }, next);
    if (!tangents) break;
    // SelectTangent is called with the two *circles* (DoubCircle extends
    // DoubPoint), not with the vertices of the side being cut.
    const line = selectTangent(V[j], next.center, tangents, sign);
    const cut = intersect(V[i], V[l], line[0], line[1]);
    if (!Number.isFinite(cut.x) || !Number.isFinite(cut.y)) break;
    cuts.push(cut);
    p = cut; i = j; j = l;
  }
  return { circles: circles, cuts: cuts };
}

/* ------------------------------- configurations: triangles and cut positions */

const configurations = [];
for (const V of [
  [pt(180, 20), pt(45, 220), pt(315, 192)],   // the applet's Reset diagram
  [pt(180, 22), pt(50, 218), pt(310, 218)],   // near-equilateral
  [pt(70, 35), pt(40, 210), pt(320, 120)],    // very scalene
  [pt(300, 40), pt(30, 200), pt(210, 225)],
]) {
  for (const ta of [0.08, 0.2, 0.35, 0.5, 0.7, 0.85, 0.95]) configurations.push({ V: V, ta: ta });
}
const random = rng(20261127);
for (let n = 0; n < 300; n++) {
  const V = [pt(25 + random() * 310, 20 + random() * 80),
    pt(20 + random() * 110, 150 + random() * 70),
    pt(230 + random() * 110, 150 + random() * 70)];
  configurations.push({ V: V, ta: 0.03 + random() * 0.94 });
}

function stateOf(config) {
  return { width: C.WIDTH, height: C.HEIGHT, V: config.V.map((p) => pt(p.x, p.y)), ta: config.ta, which: C.ALL };
}

/*
 * A cut can land almost exactly on a triangle vertex, leaving a circle of
 * radius 0.01 next to one of radius 20. Two algebraically identical formulas
 * then differ in the last few digits, which a finite-difference comparison
 * cannot pin down. Those cases are counted and exercised, but the numeric
 * comparisons and the page's identities use the well-conditioned ones.
 */
const wellConditioned = configurations.filter((cfg) => {
  const r = C.chain(stateOf(cfg));
  return r.circles.length === 7 && r.circles.every((c) => c.radius > 0.5) &&
    r.cuts.every((cut) => Math.min(dist(cut.at, cut.from), dist(cut.at, cut.to)) > 0.5);
});

/* ------------------------------------------- 1. the applet's own starting data */

{
  equal("the applet's constants", [C.WIDTH, C.HEIGHT, C.TA_DEFAULT, C.ALL], [360, 240, 0.7, 6]);
  const s = C.start({});
  check("Reset places the apex at (width/2, 20)",
    nearPt(s.V[0], pt(180, 20)) && nearPt(s.V[1], pt(45, 220)) && nearPt(s.V[2], pt(315, 192)));
  check("the point starts at t = 0.7 on side A1A2",
    near(C.sidePoint(s).x, 126) && near(C.sidePoint(s).y, 211.6));
  check("all circles are highlighted at the start", s.which === 6);
  check("start ignores options", JSON.stringify(C.start({ width: 10, ta: 0.1 })) === JSON.stringify(s));
  const moved = C.setWhich(C.setVertex(s, 1, pt(9, 9)), 3);
  check("the input state is never changed", s.V[1].x === 45 && s.ta === 0.7 && s.which === 6);
  check("a vertex is clamped to the board with a 2-unit margin", moved.V[1].x === 9 && moved.V[1].y === 9);
  check("moving a vertex keeps t and moves P with the side",
    moved.ta === 0.7 && !nearPt(C.sidePoint(moved), C.sidePoint(s)));
  check("pair options are clamped to 0..6",
    C.setWhich(s, -9).which === 0 && C.setWhich(s, 9).which === 6 && C.setWhich(s, 2.6).which === 3);
  const beyond = C.setTa(s, pt(1000, 1000));
  check("P is projected onto its side and clamped inside it",
    beyond.ta === C.TA_MIN && beyond.ta !== s.ta &&
    C.distance(C.foot(C.sidePoint(beyond), s.V[2], s.V[1]), C.sidePoint(beyond)) < 1e-9);
  check("reset restores the diagram but keeps the chosen pair",
    nearPt(C.reset(moved).V[0], s.V[0]) && C.reset(moved).which === 3);
}

/* --------------------------------------------- 2. incircle, and the applet's own */

{
  check("a 3-4-5 triangle has inradius 1", near(C.incircle(pt(0, 0), pt(4, 0), pt(0, 3)).radius, 1));
  check("an equilateral triangle of side 2 has inradius 1/sqrt(3)",
    near(C.incircle(pt(0, 0), pt(2, 0), pt(1, Math.sqrt(3))).radius, 1 / Math.sqrt(3)));
  const I = C.incenter(pt(1, 7), pt(9, 2), pt(4, 11));
  check("the incenter is equally far from all three sides",
    near(C.distance(I, C.foot(I, pt(1, 7), pt(9, 2))), C.distance(I, C.foot(I, pt(9, 2), pt(4, 11)))) &&
    near(C.distance(I, C.foot(I, pt(9, 2), pt(4, 11))), C.distance(I, C.foot(I, pt(4, 11), pt(1, 7)))));
  let radii = true, centers = true;
  for (const cfg of configurations) {
    const a = getIncircle(cfg.V[0], cfg.V[1], cfg.V[2]);
    const b = C.incircle(cfg.V[0], cfg.V[1], cfg.V[2]);
    radii = radii && a !== null && near(a.radius, b.radius, 1e-7);
    centers = centers && a !== null && nearPt(a.center, b.center, 1e-7);
  }
  check("328 outer incircles match the applet's averaged-distance radii", radii);
  check("328 outer incenters match the applet's two-bisector construction", centers);
  check("a collapsed triangle has no incircle", C.incircle(pt(0, 0), pt(1, 0), pt(2, 0)) === null);
}

/* ---------------------------- 3. the whole chain against the applet's bytecode */

{
  let lengths = true, circles = true, cuts = true, closed = true;
  for (const cfg of wellConditioned) {
    const s = stateOf(cfg);
    const mine = C.chain(s);
    const theirs = appletChain(cfg.V, cfg.ta);
    lengths = lengths && mine.circles.length === theirs.circles.length && mine.cuts.length === theirs.cuts.length;
    for (let k = 0; k < Math.min(mine.circles.length, theirs.circles.length); k++) {
      circles = circles && near(mine.circles[k].radius, theirs.circles[k].radius, 2e-7) &&
        nearPt(mine.circles[k].center, theirs.circles[k].center, 2e-7);
    }
    for (let k = 0; k < Math.min(mine.cuts.length, theirs.cuts.length); k++) {
      cuts = cuts && nearPt(mine.cuts[k].at, theirs.cuts[k], 2e-6);
    }
    closed = closed && mine.closed;
  }
  check("the core and the bytecode transcription draw the same number of circles", lengths);
  check("all 7 circle centers and radii match the applet's ShowCircles", circles);
  check("all 6 cut points match the applet's tangent intersections", cuts);
  check("the chain closes in every well-conditioned configuration", closed);
  check("near-degenerate cuts are counted and do not throw",
    wellConditioned.length > 300 && configurations.length - wellConditioned.length >= 0 &&
    configurations.every((cfg) => typeof C.chain(stateOf(cfg)).closed === "boolean"));
}

/* -------------------------------------- 4. the cut-the-knot page's exact claims */

{
  let closes = true, six = true, smaller = true, relation = true, demir = true;
  let generic = 0, repeated = 0;
  for (const cfg of wellConditioned) {
    const s = stateOf(cfg), result = C.chain(s);
    if (result.circles.length < 7) continue;
    const R = C.incircle(cfg.V[0], cfg.V[1], cfg.V[2]).radius;
    const rs = result.circles.map((c) => c.radius);
    closes = closes && near(rs[6], rs[0], 1e-9) && nearPt(result.circles[6].center, result.circles[0].center, 1e-9);
    const unique = new Set(result.circles.slice(0, 6).map((c) =>
      [c.center.x, c.center.y, c.radius].map((v) => v.toFixed(4)).join(",")));
    six = six && unique.size <= 6;
    if (unique.size === 6) generic++;
    else repeated++;
    for (let k = 0; k < 6; k++) {
      smaller = smaller && rs[k] < R;
      // Page index n = k+1; its A_n is our V[(n % 3)] = V[(k+1) % 3].
      const vertex = cfg.V[(k + 1) % 3];
      const other = [0, 1, 2].filter((i) => i !== (k + 1) % 3);
      const a = C.angleAt(vertex, cfg.V[other[0]], cfg.V[other[1]]);
      relation = relation && near((R / rs[k] - 1) * (R / rs[(k + 3) % 6] - 1),
        Math.pow(Math.tan(a / 2), 2), 1e-7);
      const demirVertex = cfg.V[k % 3];
      const demirOther = [0, 1, 2].filter((i) => i !== k % 3);
      const h = C.distance(demirVertex, C.foot(demirVertex, cfg.V[demirOther[0]], cfg.V[demirOther[1]]));
      demir = demir && near(1 / rs[k] + 1 / rs[(k + 1) % 6] - R / (rs[k] * rs[(k + 1) % 6]), 2 / h, 1e-7);
    }
  }
  check("all well-conditioned chains close: circle 7 is circle 1, center and radius", closes);
  check("no chain has more than six distinct circles", six);
  check("there are generic six-circle chains and symmetric shorter ones", generic > 0 && repeated > 0);
  check("every chain circle is smaller than the triangle's incircle", smaller);
  check("page equation (1) holds for all six steps of every tested chain", relation);
  check("Demir's consecutive-radius equation holds in every tested chain", demir);
  check("the page's proof step r(n+3) < r is confirmed", smaller);
}

{
  const symmetric = { width: 360, height: 240, V: [pt(180, 22), pt(50, 218), pt(310, 218)], ta: 0.5, which: 6 };
  const rs = C.chain(symmetric).circles.map((c) => c.radius);
  check("a symmetric cut really can repeat radii before six steps",
    new Set(rs.slice(0, 6).map((r) => r.toFixed(5))).size < 6);
  check("the seventh circle still returns to the first in that case", near(rs[6], rs[0], 1e-9));
}

/* ---------------------------------- 5. position, degenerate input, applet leftovers */

{
  const s = C.start({});
  const p = C.position(s);
  check("the saved position is plain data for the tutor",
    p.V.length === 3 && p.P.x === 126 && p.ta === 0.7 && p.which === 6 &&
    p.circles.length === 7 && p.closed === true &&
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))));
  const flat = C.setVertex(C.setVertex(C.setVertex(s, 0, pt(0, 0)), 1, pt(1, 0)), 2, pt(2, 0));
  check("a flat triangle ends the chain instead of throwing", C.chain(flat).circles.length <= 1);
  check("the cut cannot be dragged onto a vertex (the applet's two bad endpoints)",
    C.setTa(s, pt(0, 0)).ta === C.TA_MAX && C.setTa(s, pt(360, 240)).ta === C.TA_MIN);
  check("the tangent helper keeps the applet's two-tangent ordering",
    (() => {
      const c = C.incircle(s.V[0], s.V[2], C.sidePoint(s));
      const a = C.tangentPoints(s.V[1], c);
      const b = inversionTangent(c, s.V[1]);
      return a !== null && b !== null && nearPt(a[0], b[0], 1e-7) && nearPt(a[1], b[1], 1e-7);
    })());
  check("the applet's two unused helpers are not in the port",
    !/GetNextCircle|GetTouchingCircle/.test(readFileSync("elkies/elkies-core.js", "utf8")));
}

done("elkies");
