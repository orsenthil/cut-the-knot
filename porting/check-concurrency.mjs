#!/usr/bin/env node
"use strict";

/*
 * Logic test for concurrency/concurrency-core.js.
 *
 *   node porting/check-concurrency.mjs
 *
 * The applet's own methods (FindOrientation, Rotate, ComputeAngle, Intersect,
 * GetOneMPoint, MirrorPoint, RecomputeAandD and the three branches of Draw) are
 * transcribed a second time, straight from javap, and compared with the core
 * over hundreds of generated triangles and ray points. The page's claim is
 * then checked exhaustively over that same space: each of its three triples of
 * lines is concurrent, and Lyness's proportion gives Ceva's product 1.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("concurrency/concurrency-core.js", "ConcurrencyCore");
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const nearPoint = (a, b, eps = 1e-7) => !!a && !!b && near(a.x, b.x, eps) && near(a.y, b.y, eps);
const random = rng(3642);
const between = (lo, hi) => lo + random() * (hi - lo);

/* ------------------------------------------------- 1. the starting picture */

{
  const s = C.start({});
  equal("three vertices start at the applet's angles", s.V.map((v, i) => ({
    x: C.CENTER.x + C.SCALE * Math.cos(C.START_ANGLES[i]),
    y: C.CENTER.y + C.SCALE * Math.sin(C.START_ANGLES[i]),
  })), s.V);
  equal("the applet's starting fractions and reach", [0.3, 0.2, 0.25, 0.3],
    [...C.START_FRACTIONS, C.REACH]);
  check("the first checkbox is selected", s.mode === 0);
  check("the three ray points are inside their corners", s.P.every((p, i) =>
    C.computeAngle(s.V[i], s.V[(i + 1) % 3], p) <
      C.computeAngle(s.V[i], s.V[(i + 1) % 3], s.V[(i + 2) % 3])));
  check("the initial distances use the 0.3 reach", s.P.every((p, i) =>
    near(C.measure(s).lengths[i], 0.3 * Math.hypot(
      s.V[i].x - s.V[(i + 1) % 3].x, s.V[i].y - s.V[(i + 1) % 3].y))));
  const moved = C.movePoint(s, 1, { x: 150, y: 150 });
  check("dragging one ray point leaves the others and the vertices alone",
    nearPoint(moved.V[1], s.V[1]) && nearPoint(moved.P[0], s.P[0]) && !nearPoint(moved.P[1], s.P[1]));
  const corner = C.moveVertex(s, 0, { x: 100, y: 30 });
  check("dragging a corner leaves the ray points alone", nearPoint(corner.P[0], s.P[0]) &&
    nearPoint(corner.V[0], { x: 100, y: 30 }));
  check("mode is clamped to the applet's three checkboxes", C.setMode(s, 9).mode === 2 &&
    C.setMode(s, -4).mode === 0);
  check("reset keeps the chosen family", C.reset(C.setMode(s, 2)).mode === 2);
  const t = C.trisect(s);
  check("trisecting makes all three fractions one third", t.P.every((p, i) => {
    const whole = C.computeAngle(t.V[i], t.V[(i + 1) % 3], t.V[(i + 2) % 3]);
    return near(C.computeAngle(t.V[i], t.V[(i + 1) % 3], p) / whole, 1 / 3, 1e-9);
  }));
  check("a point outside the board is brought back inside",
    C.movePoint(s, 0, { x: -500, y: 900 }).P[0].x === 12 &&
      C.movePoint(s, 0, { x: -500, y: 900 }).P[0].y === C.HEIGHT - 12);
  check("an illustration has no win or loss", !("result" in C));
}

/* ------------------------------- 2. a second transcription of the applet */

/* GeoSDoub and ConcurrencyCanvas, written again from the bytecode. */
function jSq(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function jDist(a, b) { return Math.sqrt(jSq(a, b)); }
function jOrient(a, b, c) {
  const cr = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return cr > 0 ? 1 : -1;
}
function jRotate(a, b, theta, s) {
  const co = Math.cos(theta), si = Math.sin(theta);
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x: a.x + co * dx - s * si * dy, y: a.y + s * si * dx + co * dy };
}
function jAngle(a, b, c) {
  const num = jSq(a, b) + jSq(a, c) - jSq(b, c);
  const cos = num / (2 * jDist(a, b) * jDist(a, c));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}
function jIntersect(p, q, r, s) {
  const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
  const d = r.y - s.y, e = s.x - r.x, f = r.x * s.y - r.y * s.x;
  const den = a * e - b * d;
  return { x: (b * f - e * c) / den, y: (c * d - f * a) / den };
}
function jGetOneMPoint(a, b, c, t, d) {
  const theta = jAngle(a, b, c) * t;
  const turned = jRotate(a, b, theta, jOrient(a, b, c));
  return { x: a.x + d * (turned.x - a.x), y: a.y + d * (turned.y - a.y) };
}
function jRecompute(V, P) {
  return [0, 1, 2].map((i) => [jAngle(V[i], V[(i + 1) % 3], P[i]), jDist(V[i], P[i])]);
}
function jMirror(V, P, measured, i) {
  const a = V[i], b = V[(i + 1) % 3], c = V[(i + 2) % 3], y = P[i];
  const sign = jOrient(a, b, y);
  const out = jRotate(a, c, measured[i][0], -sign);
  const k = jDist(a, out) / measured[i][1];
  return { x: out.x + (a.x - out.x) / k, y: out.y + (a.y - out.y) / k };
}
/** ConcurrencyCanvas.Draw: the mirrored points and all three intersection arrays. */
function jDraw(V, P) {
  const measured = jRecompute(V, P);
  const M = [0, 1, 2].map((i) => jMirror(V, P, measured, i));
  const X = [0, 1, 2].map((i) => jIntersect(V[i], P[i], V[(i + 1) % 3], M[(i + 1) % 3]));
  const Y = [0, 1, 2].map((i) => jIntersect(V[i], P[i], V[(i + 2) % 3], M[(i + 2) % 3]));
  const Z = [0, 1, 2].map((i) => jIntersect(V[i], M[i], V[(i + 1) % 3], P[(i + 1) % 3]));
  return { measured, M, X, Y, Z };
}

function generated() {
  const V = [0, 1, 2].map(() => ({ x: between(40, 320), y: between(30, 230) }));
  if (V.some((v, i) => jDist(v, V[(i + 1) % 3]) < 50)) return null;
  if (Math.abs(jOrient(V[0], V[1], V[2])) < 1) return null;
  const P = V.map((v, i) => jGetOneMPoint(
    v, V[(i + 1) % 3], V[(i + 2) % 3], between(0.08, 0.92), between(0.15, 0.65)));
  return { V, P, mode: Math.floor(random() * 3) };
}

{
  let compared = 0, mismatches = 0;
  for (let attempt = 0; attempt < 2400 && compared < 400; attempt++) {
    const s = generated();
    if (!s) continue;
    const core = C.geometry(s);
    const applet = jDraw(s.V, s.P);
    compared++;
    if (!applet.M.every((p, i) => nearPoint(core.M[i], p, 1e-8))) mismatches++;
    if (!core.angles.every((a, i) => near(a, applet.measured[i][0], 1e-10) &&
      near(core.lengths[i], applet.measured[i][1], 1e-8))) mismatches++;
    if (![core.X, core.Y, core.Z].every((arr, k) => arr.every((p, i) =>
      nearPoint(p, [applet.X, applet.Y, applet.Z][k][i], 1e-7)))) mismatches++;
  }
  check("400 generated pictures compared with a literal javap transcription", compared === 400);
  check("every angle, mirror point and intersection matches the bytecode", mismatches === 0,
    `${mismatches} differences`);
}

/* --------------------------------------------- 3. the page's three triples */

function jConcur(lines) {
  const a = jIntersect(...lines[0], ...lines[1]);
  const b = jIntersect(...lines[1], ...lines[2]);
  return Math.max(jDist(a, b), 0);
}

{
  let seen = 0, failed = [0, 0, 0], worst = [0, 0, 0];
  for (let attempt = 0; attempt < 2400 && seen < 400; attempt++) {
    const s = generated();
    if (!s) continue;
    const g = jDraw(s.V, s.P);
    const triples = [
      [0, 1, 2].map((i) => [s.V[(i + 2) % 3], g.X[i]]),
      [0, 1, 2].map((i) => [s.V[(i + 1) % 3], g.Y[i]]),
      [0, 1, 2].map((i) => [g.X[i], g.Z[i]]),
    ];
    triples.forEach((lines, i) => {
      const spread = jConcur(lines);
      if (!Number.isFinite(spread) || spread > 1e-4 * 400) failed[i]++;
      worst[i] = Math.max(worst[i], Number.isFinite(spread) ? spread : Infinity);
    });
    C.families(s).forEach((family, i) => {
      if (!family.point) failed[i]++;
    });
    seen++;
  }
  check("400 generated triangles tested against the concurrency claim", seen === 400);
  [0, 1, 2].forEach((i) => check(["AP, BQ, CR", "AU, BV, CW", "PU, QV, RW"][i] +
    " meet in one point in every case", failed[i] === 0, `${failed[i]} failures, worst ${worst[i]}`));
  const points = C.families(C.start({})).map((f) => f.point);
  check("the three meeting points of the starting picture are distinct",
    points.every(Boolean) && jDist(points[0], points[1]) > 1 && jDist(points[1], points[2]) > 1);
  check("the equal-parts case keeps all three concurrencies", (() => {
    const s = C.start({});
    return C.families(C.trisect(s)).every((f) => !!f.point);
  })());
}

/* ------------------------------------------- 4. Lyness's ratio and Ceva */

{
  let seen = 0, badRatio = 0, badProduct = 0;
  for (let attempt = 0; attempt < 4000 && seen < 300; attempt++) {
    const s = generated();
    if (!s) continue;
    /* Lyness's unsigned angles assume the mirror point stays on the near
       side of the corner; the applet lets a long ray pull it past the corner,
       which leaves the lines (and the concurrencies) unchanged. */
    const measured = C.measure(s);
    if ([0, 1, 2].some((i) => measured.lengths[i] >=
      Math.hypot(s.V[i].x - s.V[(i + 2) % 3].x, s.V[i].y - s.V[(i + 2) % 3].y))) continue;
    const { parts, product } = C.ceva(s);
    if (!parts.every((p) => p && Number.isFinite(p.ratio) && Number.isFinite(p.predicted))) {
      badRatio++; seen++; continue;
    }
    parts.forEach((p) => {
      if (!near(p.ratio, p.predicted, 1e-5 * Math.max(1, Math.abs(p.ratio)))) badRatio++;
    });
    if (!near(product, 1, 1e-5)) badProduct++;
    seen++;
  }
  check("300 generated pictures tested against Lyness's proportion", seen === 300);
  check("BS/SC = (cot b - cot B) / (cot g - cot C) on all three sides", badRatio === 0,
    `${badRatio} differences`);
  check("the cyclic ratios multiply to 1, as Ceva requires", badProduct === 0,
    `${badProduct} failures`);
}

/* -------------------------------------------------- 5. degenerate pictures */

{
  const s = C.start({});
  const collapsed = C.movePoint(s, 0, s.V[0]);
  const g = C.geometry(collapsed);
  check("a ray point on its corner gives a zero length, not a NaN", g.lengths[0] === 0 &&
    Number.isFinite(g.M[0].x));
  check("a degenerate picture has no meeting point to report",
    C.families(collapsed).some((f) => f.point === null) &&
      C.describe(collapsed).includes("move a dot"));
  check("moving a point onto another one does not corrupt the state", (() => {
    const once = C.movePoint(s, 1, s.P[0]);
    return C.families(once).every((f) => f.point === null || Number.isFinite(f.point.x));
  })());
  check("parallel lines return no intersection", C.intersect({ x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: 5 }, { x: 1, y: 5 }) === null);
  check("the status names the three lines of the chosen family",
    /AP, BQ, CR/.test(C.describe(C.setMode(s, 0))) &&
    /AU, BV, CW/.test(C.describe(C.setMode(s, 1))) &&
    /PU, QV, RW/.test(C.describe(C.setMode(s, 2))));
}

done("concurrency");
