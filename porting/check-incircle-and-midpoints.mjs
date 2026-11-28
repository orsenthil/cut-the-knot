#!/usr/bin/env node
"use strict";

/*
 * Logic test for incircle-and-midpoints/incircle-and-midpoints-core.js.
 *
 *   node porting/check-incircle-and-midpoints.mjs
 *
 * 1. The applet's starting triangle, its three display options and its
 *    vertex moves.
 * 2. The page's exact claim ("DE bisects AB and AC") and every step of its
 *    proof, checked over a whole grid of triangles plus random ones.
 * 3. A second literal transcription of IncircleAndMidpointsCanvas.Compute()
 *    with GeoSDoub's helpers from the bytecode, compared point by point with
 *    the core on every triangle in that sample.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("incircle-and-midpoints/incircle-and-midpoints-core.js", "IncircleAndMidpointsCore");

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  const W = C.VIEW.width, H = C.VIEW.height;
  check("initial A is the applet's (2W/3, 2H/3)",
    s.A.x === (2 * W) / 3 && s.A.y === (2 * H) / 3);
  check("initial B is the applet's (W/2, H/6)",
    s.B.x === W / 2 && s.B.y === H / 6);
  check("initial C is the applet's (W/4, 2H/5)",
    s.C.x === W / 4 && s.C.y === (2 * H) / 5);
  const area = Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x));
  check("the starting triangle is not flat", area > 5000, `twice area ${area}`);
  check("an illustration has no win or loss", C.result(s) === null);
  check("all three applet display options start off (the page has no Show parameter)",
    Object.keys(s.options).length === 3 &&
    Object.values(s.options).every((v) => v === false));
  check('Show="1" turns on names and hint 2 but not hint 1',
    C.start({ show: "1" }).options.names && C.start({ show: "1" }).options.hint2 &&
    !C.start({ show: "1" }).options.hint1);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("dragging a vertex clamps it to the drawing",
    moved.A.x === W - 18 && moved.A.y === 18);
  check("moving a vertex leaves the old position alone",
    s.A.x === C.START.A.x && s.touches === 0 && moved.touches === 1);
  check("an unknown vertex or a bad point is ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "A", { x: NaN, y: 3 }) === s);
  check("a display option changes without moving the points",
    C.setOption(s, "hint1", true).options.hint1 === true &&
    C.setOption(s, "hint1", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a flat triangle cannot be drawn",
    !C.geometry({ ...s, C: s.A }).valid);
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
  if (area < 3000) { skipped++; continue; } // practically flat: construction explodes
  const g = C.geometry({ A, B, C: Cc });
  if (g.valid) geometries.push(g);
  else skipped++;
}
check("the sample covers thousands of non-flat triangles", geometries.length >= 4000,
  `${geometries.length} used, ${skipped} flat ones skipped`);

const worst = (key) => geometries.reduce((m, g) => Math.max(m, g.error[key]), 0);
const near = (v, limit = 1e-5) => Number.isFinite(v) && v < limit;
for (const g of geometries) g.error = C.claimErrors(g);
check("every claimed point is computed on every sampled triangle",
  geometries.every((g) => g.error && Object.values(g.error).every(Number.isFinite)));

{
  // The page: "Show that the line DE bisects sides AB and AC of triangle ABC."
  check("page: F is the midpoint of AB", near(worst("FmidAB")),
    `largest error ${worst("FmidAB")}`);
  check("page: G is the midpoint of AC", near(worst("GmidAC")),
    `largest error ${worst("GmidAC")}`);
  check("page: DE is parallel to BC", near(worst("DEparBC")),
    `largest sine ${worst("DEparBC")}`);

  // The proof: AU = AV, so A is the midpoint of UV; then D and E are
  // midpoints of NU and NV, and the three parallels bisect every transversal.
  check("page: AU = AV", near(worst("AUeqAV")), `largest error ${worst("AUeqAV")}`);
  check("page: A is the midpoint of UV", near(worst("AmidUV")),
    `largest error ${worst("AmidUV")}`);
  check("page: D is the midpoint of NU", near(worst("DmidNU")),
    `largest error ${worst("DmidNU")}`);
  check("page: E is the midpoint of NV", near(worst("EmidNV")),
    `largest error ${worst("EmidNV")}`);
  check("page: UV is parallel to BC", near(worst("UVparBC")),
    `largest sine ${worst("UVparBC")}`);

  // The equal tangents from each corner, which make the proof work.
  check("page: AM = AU", near(worst("AMeqAU")), `largest error ${worst("AMeqAU")}`);
  check("page: AK = AV", near(worst("AKeqAV")), `largest error ${worst("AKeqAV")}`);
  check("page: AM = AK", near(worst("AMeqAK")), `largest error ${worst("AMeqAK")}`);
  check("page: BN = BM", near(worst("BNeqBM")), `largest error ${worst("BNeqBM")}`);
  check("page: CN = CK", near(worst("CNeqCK")), `largest error ${worst("CNeqCK")}`);

  // The incircle drawn by hint 1 really is tangent to all three sides.
  check("M, N and K are equally far from the incenter", near(worst("radii")),
    `largest spread ${worst("radii")}`);
  check("the applet's averaged incircle radius equals incenter-to-touch-point",
    near(worst("radius")), `largest error ${worst("radius")}`);
  const perpendicular = geometries.reduce((m, g) => Math.max(m,
    Math.abs((g.M.x - g.I.x) * (g.A.x - g.B.x) + (g.M.y - g.I.y) * (g.A.y - g.B.y)) / C.dist(g.A, g.B),
    Math.abs((g.N.x - g.I.x) * (g.B.x - g.C.x) + (g.N.y - g.I.y) * (g.B.y - g.C.y)) / C.dist(g.B, g.C),
    Math.abs((g.K.x - g.I.x) * (g.C.x - g.A.x) + (g.K.y - g.I.y) * (g.C.y - g.A.y)) / C.dist(g.C, g.A)), 0);
  check("the three touch points are perpendicular feet on their sides",
    near(perpendicular), `largest offset ${perpendicular}`);
}

/* ----------------------------- 3. the applet's own construction, again */

// Literal transcription of IncircleAndMidpointsCanvas.Compute() with GeoSDoub
// (javap -c -p on IncircleAndMidpoints.zip and CTKGeometry.zip in classes.zip).
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
  if (sqDist(a, b) < 0.1) return p;
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
function getParallelTo(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}
function appletCompute(A, B, Cc) {
  const I = findIncenter(A, B, Cc);
  const K = nearestPoint(I, A, Cc);
  const M = nearestPoint(I, B, A);
  const N = nearestPoint(I, Cc, B);
  const D = intersect(getParallelTo(A, K, N), A, M, N);
  const E = intersect(getParallelTo(A, M, N), A, K, N);
  const U = intersect(getParallelTo(A, B, Cc), A, M, N);
  const V = intersect(getParallelTo(A, B, Cc), A, K, N);
  const F = intersect(A, B, D, E);
  const G = intersect(A, Cc, D, E);
  const radius = (appletDist(I, nearestPoint(I, A, B)) +
    appletDist(I, nearestPoint(I, B, Cc)) +
    appletDist(I, nearestPoint(I, Cc, A))) / 3;
  return { I, K, M, N, D, E, U, V, F, G, radius };
}

const names = ["I", "K", "M", "N", "D", "E", "U", "V", "F", "G"];
const worstPoint = Object.fromEntries(names.map((n) => [n, 0]));
let worstRadius = 0, compared = 0, unrepresentable = 0;
for (const g of geometries) {
  const a = appletCompute(g.A, g.B, g.C);
  if (![...names.map((n) => a[n]), a.radius].every((v) =>
      typeof v === "number"
        ? Number.isFinite(v)
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
check("core incircle radius matches the applet's averaged radius",
  near(worstRadius, 1e-4), `largest difference ${worstRadius}`);

// The applet's private DrawLine(g,p,q,r) chooses the piece that lies on p--q--r;
// its InsideTest is dot(r-q, r-p) <= 0.
{
  const p = { x: 0, y: 0 }, q = { x: 10, y: 0 };
  check("DrawLine keeps the nearer end when the third point is outside",
    C.drawSpan(p, q, { x: 20, y: 0 })[1].x === 10);
  check("DrawLine uses the third point when it lies between the ends",
    C.drawSpan(p, q, { x: 4, y: 0 })[1].x === 4);
}

done("incircle-and-midpoints");
