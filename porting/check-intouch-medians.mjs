#!/usr/bin/env node
"use strict";

/*
 * Logic test for intouch-medians/intouch-medians-core.js.
 *
 *   node porting/check-intouch-medians.mjs
 *
 * 1. The applet's start triangle, its two display checkboxes and its moves.
 * 2. The page's claims, checked on every non-flat triangle of a 6x6 grid
 *    plus 400 random ones: the three perpendiculars are concurrent, and
 *    S, G' and I are collinear with 2*|SG'| = |G'I|.
 * 3. A second, literal transcription of IntouchMediansCanvas.Compute() from
 *    the bytecode (GeoSDoub.FindIncenter by two rotated angle bisectors,
 *    NearestPoint, Intersect, the three Midpoints and the averaged radius),
 *    compared point by point with the core on every one of those triangles.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("intouch-medians/intouch-medians-core.js", "IntouchMediansCore");

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  check("initial A is the applet's (W/8, floor(5H/6)) with Java integer division",
    s.A.x === Math.floor(C.VIEW.width / 8) && s.A.y === Math.floor((5 * C.VIEW.height) / 6));
  check("initial B is the applet's (W - A.x, A.y)",
    s.B.x === C.VIEW.width - s.A.x && s.B.y === s.A.y);
  check("initial C is the applet's (4W/5, H/5)",
    s.C.x === Math.floor((4 * C.VIEW.width) / 5) && s.C.y === Math.floor(C.VIEW.height / 5));
  const area = Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x));
  check("the starting triangle is not flat", area > 5000, `twice area ${area}`);
  check("an illustration has no win or loss", C.result(s) === null);
  check("both applet display options start off (no ShowNames parameter)",
    Object.keys(s.options).length === 2 &&
    Object.values(s.options).every((v) => v === false));
  const shown = C.start({ show: "1" });
  check('ShowNames="1" turns on both names and hint',
    shown.options.names && shown.options.hint);
  check("show=1 as a number also turns on both options",
    C.start({ show: 1 }).options.names && C.start({ show: 1 }).options.hint);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a vertex clamps it to the drawing",
    moved.A.x === C.VIEW.width - 18 && moved.A.y === 18);
  check("moving a vertex leaves the old position alone",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown vertex or a bad point is ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "A", { x: NaN, y: 3 }) === s);
  check("a display option changes without moving the points",
    C.setOption(s, "hint", true).options.hint === true &&
    C.setOption(s, "hint", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a flat triangle cannot be drawn", !C.geometry({ ...s, C: s.A }).valid);
}

/* ------------------------------------------- 2. the page's claims, in bulk */

const triangles = [];
const xs = [20, 76, 132, 188, 244, 300];
const ys = [20, 68, 116, 164, 212, 260];
const grid = [];
for (const x of xs) for (const y of ys) grid.push({ x, y });
for (let i = 0; i < grid.length; i++) {
  for (let j = i + 1; j < grid.length; j++) {
    for (let k = j + 1; k < grid.length; k++) {
      triangles.push([grid[i], grid[j], grid[k]]);
    }
  }
}
const rand = rng(20261127);
for (let i = 0; i < 400; i++) {
  triangles.push([
    { x: 18 + rand() * 324, y: 18 + rand() * 224 },
    { x: 18 + rand() * 324, y: 18 + rand() * 224 },
    { x: 18 + rand() * 324, y: 18 + rand() * 224 },
  ]);
}
const geometries = [];
let skipped = 0;
for (const [A, B, Cc] of triangles) {
  const area = Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));
  if (area < 3000) { skipped++; continue; } // nearly flat: the construction explodes
  const g = C.geometry({ A, B, C: Cc });
  if (g.valid) geometries.push(g);
  else skipped++;
}
check("the sample covers thousands of non-flat triangles", geometries.length >= 4000,
  `${geometries.length} used, ${skipped} nearly flat ones skipped`);

const worst = (key) => geometries.reduce((m, g) => Math.max(m, g.error[key]), 0);
const near = (v, limit = 1e-5) => Number.isFinite(v) && v < limit;
for (const g of geometries) g.error = C.claimErrors(g);
check("every claim is computed on every sampled triangle",
  geometries.every((g) => g.error && Object.values(g.error).every(Number.isFinite)));

{
  // Page: "The three lines AmAh, BmBh, CmCh are concurrent."
  check("page: the three perpendiculars have one common point",
    near(worst("concurrency"), 1e-4), `largest spread ${worst("concurrency")}`);
  check("the three perp segments really are perpendicular to the opposite sides",
    near(Math.max(worst("perpBC"), worst("perpCA"), worst("perpAB"))),
    `largest cosine ${Math.max(worst("perpBC"), worst("perpCA"), worst("perpAB"))}`);

  // Page: "S and the incenter I are collinear with G' and 2*SG' = G'I."
  check("page: S, G' and I are collinear", near(worst("collinear")),
    `largest distance ${worst("collinear")}`);
  check("page: 2*|SG'| = |G'I|", near(worst("ratio")),
    `largest error ${worst("ratio")}`);
  check("the common point is exactly (3G' - I)/2", near(worst("predicted")),
    `largest error ${worst("predicted")}`);
  check("the line SI passes through G'", near(worst("SIthroughG")),
    `largest distance ${worst("SIthroughG")}`);

  // The proof: the homothety with center G' and ratio -2 sends each midpoint
  // of the intouch triangle to the opposite touch point.
  check("proof: homothety of ratio -2 about G' maps Am,Bm,Cm to A',B',C'",
    near(worst("homothety")), `largest error ${worst("homothety")}`);
  check("proof: equal tangent lengths from each corner",
    near(Math.max(worst("tangentsA"), worst("tangentsB"), worst("tangentsC"))),
    `largest error ${Math.max(worst("tangentsA"), worst("tangentsB"), worst("tangentsC"))}`);
  check("proof: A', B', C' are the perpendicular feet of the incenter",
    near(Math.max(worst("touchBC"), worst("touchCA"), worst("touchAB"))),
    `largest cosine ${Math.max(worst("touchBC"), worst("touchCA"), worst("touchAB"))}`);
  check("the incircle touches all three sides at equal distances from I",
    near(worst("radii")), `largest spread ${worst("radii")}`);
  check("the applet's averaged radius equals incenter-to-touch-point",
    near(worst("radius")), `largest error ${worst("radius")}`);
}

/* ----------------------------- 3. the applet's own construction, again */

// Second transcription: javap -c -p on IntouchMediansCanvas.Compute() and
// GeoSDoub/DoubLine from classes.zip.
function sqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}
function appletDist(p, q) { return Math.sqrt(sqDist(p, q)); }
function computeAngle(p, q, r) {
  const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
    (2 * appletDist(p, q) * appletDist(p, r));
  return Math.acos(c);
}
function findOrientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function rotate(p, q, angle, dir) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
    y: p.y + dir * s * (q.x - p.x) + c * (q.y - p.y),
  };
}
function findIncenter(A, B, Cc) {
  const halfA = computeAngle(A, B, Cc) / 2;
  const halfB = computeAngle(B, Cc, A) / 2;
  const dir = findOrientation(A, B, Cc);
  return intersect(rotate(A, B, halfA, dir), A, rotate(B, Cc, halfB, dir), B);
}
function nearestPoint(p, a, b) {
  if (sqDist(a, b) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function intersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // GeoSDoub returns NaN
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function midpoint(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}
function midpoint3(p, q, r) {
  return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
}
function appletCompute(A, B, Cc) {
  const I = findIncenter(A, B, Cc);
  const Ap = nearestPoint(I, B, Cc);
  const Bp = nearestPoint(I, Cc, A);
  const Cp = nearestPoint(I, A, B);
  const Am = midpoint(Bp, Cp);
  const Bm = midpoint(Cp, Ap);
  const Cm = midpoint(Ap, Bp);
  const Ah = nearestPoint(Am, B, Cc);
  const Bh = nearestPoint(Bm, Cc, A);
  const Ch = nearestPoint(Cm, A, B);
  const S = intersect(Ah, Am, Bh, Bm);
  const G = midpoint3(Ap, Bp, Cp);
  const radius = (appletDist(I, Ap) + appletDist(I, Bp) + appletDist(I, Cp)) / 3;
  return { I, Ap, Bp, Cp, Am, Bm, Cm, Ah, Bh, Ch, S, G, radius };
}

const names = ["I", "Ap", "Bp", "Cp", "Am", "Bm", "Cm", "Ah", "Bh", "Ch", "S", "G"];
const worstPoint = Object.fromEntries(names.map((n) => [n, 0]));
let worstRadius = 0, compared = 0, unrepresentable = 0;
for (const g of geometries) {
  const a = appletCompute(g.A, g.B, g.C);
  if (![...names.map((n) => a[n]), a.radius].every((v) =>
      typeof v === "number" ? Number.isFinite(v)
        : Number.isFinite(v.x) && Number.isFinite(v.y))) {
    unrepresentable++;
    continue;
  }
  compared++;
  for (const n of names) worstPoint[n] = Math.max(worstPoint[n], C.dist(g[n], a[n]));
  worstRadius = Math.max(worstRadius, Math.abs(g.radius - a.radius));
}
check("the second transcription is comparable on thousands of triangles", compared >= 4000,
  `${compared} compared, ${unrepresentable} produced NaN in the applet's own method`);
for (const n of names) {
  check(`core ${n} matches the applet's Compute() everywhere`,
    near(worstPoint[n], 1e-4), `largest difference ${worstPoint[n]}`);
}
check("core inradius matches the applet's averaged radius",
  near(worstRadius, 1e-4), `largest difference ${worstRadius}`);

// A few edge cases the grid cannot hit: the applet's NearestPoint guard.
{
  const p = { x: 10, y: 20 };
  check("NearestPoint returns p for a side shorter than sqrt(0.1)",
    C.dist(C.foot(p, { x: 0, y: 0 }, { x: 0.2, y: 0 }), p) === 0);
  check("a NaN intersection matches GeoSDoub's parallel-line result",
    Number.isNaN(C.intersect({ x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 0, y: 5 }, { x: 10, y: 5 }).x));
  const g = C.geometry(C.start({ show: "1" }));
  check("the starting triangle draws every named point", g.valid &&
    Object.values(g.labels).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  check("the applet's six hint segments are the equal halves of the touch sides",
    g.lines.marks.length === 6 &&
    Math.abs(C.dist(g.Ap, g.Bm) - C.dist(g.Bm, g.Cp)) < 1e-9 &&
    Math.abs(C.dist(g.Bp, g.Cm) - C.dist(g.Cm, g.Ap)) < 1e-9 &&
    Math.abs(C.dist(g.Cp, g.Am) - C.dist(g.Am, g.Bp)) < 1e-9);
}

done("intouch-medians");
