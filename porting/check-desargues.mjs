#!/usr/bin/env node
"use strict";

/*
 * Logic test for desargues/desargues-core.js.
 *
 *   node porting/check-desargues.mjs
 *
 * Checks the applet's six starting corners, Direct/Converse modes, drags and
 * reset; then the cut-the-knot page's two claims (concurrent vertex lines give
 * collinear side crossings, and the converse) over thousands of constructed
 * and random configurations, including the page's Menelaus product. Finally
 * it transcribes DesargueCanvas.Draw, GeoSDoub.Intersect and ConnectPoints a
 * second time straight from the bytecode and compares them with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("desargues/desargues-core.js", "DesarguesCore");

/* ------------------------------- a second transcription of the applet's code */

const nanPoint = { x: NaN, y: NaN };
const near = (p, q, tol = 1e-6) =>
  (Number.isNaN(p.x) && Number.isNaN(q.x) && Number.isNaN(p.y) && Number.isNaN(q.y)) ||
  (Number.isFinite(p.x) && Number.isFinite(q.x) &&
    Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol);

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), line by line. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y;
  const b1 = b.x - a.x;
  const c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y;
  const b2 = d.x - c.x;
  const c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { ...nanPoint };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** DesargueCanvas.Average: mean of the three pairwise vertex-line crossings. */
function appletAverage(p, q, r) {
  return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
}

function appletCrosses(s) {
  const pairs = [
    ["ab", s.A1, s.B1, s.A2, s.B2],
    ["bc", s.B1, s.C1, s.B2, s.C2],
    ["ca", s.C1, s.A1, s.C2, s.A2],
  ];
  const out = {};
  for (const [name, a, b, c, d] of pairs) {
    const point = appletIntersect(a, b, c, d);
    // CrossPoint.Draw sets IsNaN to true exactly when Intersect fails.
    out[name] = { point, nan: !Number.isFinite(point.x) || !Number.isFinite(point.y), line1: [a, b] };
  }
  return out;
}

/** DesargueCanvas.Draw's yellow dot: show it only when all three are near. */
function appletDot(s) {
  const o1 = appletIntersect(s.A1, s.A2, s.B1, s.B2);
  const o2 = appletIntersect(s.A1, s.A2, s.C1, s.C2);
  const o3 = appletIntersect(s.B1, s.B2, s.C1, s.C2);
  const os = [o1, o2, o3];
  let shown = os.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  for (let i = 0; i < 3 && shown; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (Math.hypot(os[i].x - os[j].x, os[i].y - os[j].y) >= 8) shown = false;
    }
  }
  return { shown, point: shown ? appletAverage(o1, o2, o3) : null };
}

/** DesargueCanvas.ConnectPoints(g, first, second): magenta line endpoints. */
function appletConnect(first, second) {
  if (first.nan && second.nan) return null;
  if (first.nan) {
    const u = second.line1[0], v = second.line1[1];
    const dx = 10 * (u.x - v.x), dy = 10 * (u.y - v.y);
    return [{ x: second.point.x + dx, y: second.point.y + dy },
      { x: second.point.x - dx, y: second.point.y - dy }];
  }
  return [first.point, second.point];
}

function appletAxis(s) {
  const x = appletCrosses(s);
  return [appletConnect(x.ab, x.bc), appletConnect(x.bc, x.ca), appletConnect(x.ca, x.ab)]
    .filter(Boolean);
}

/* --------------------------------------------------------------- test sample */

const next = rng(20261127);
const rnd = (lo, hi) => lo + next() * (hi - lo);
const determinant = (a, b, c, d) => (a.y - b.y) * (d.x - c.x) - (c.y - d.y) * (b.x - a.x);
const wellConditioned = (s) => {
  const ds = [
    determinant(s.A1, s.A2, s.B1, s.B2),
    determinant(s.A1, s.A2, s.C1, s.C2),
    determinant(s.B1, s.B2, s.C1, s.C2),
  ];
  return Math.min(...ds.map(Math.abs)) >= 4 && C.compute(s).direct.intersections.every((p) =>
    C.finite(p) && Math.max(Math.abs(p.x), Math.abs(p.y)) <= 2000);
};
const randomTriangle = () => ({
  A1: { x: rnd(20, 380), y: rnd(20, 280) },
  B1: { x: rnd(20, 380), y: rnd(20, 280) },
  C1: { x: rnd(20, 380), y: rnd(20, 280) },
});
const bounded = (s) => C.NAMES.every((n) =>
  Number.isFinite(s[n].x) && Number.isFinite(s[n].y) &&
  Math.abs(s[n].x) < 1e6 && Math.abs(s[n].y) < 1e6);

const general = [];
for (let i = 0; i < 8000 && general.length < 4000; i++) {
  const s = { ...randomTriangle() };
  for (const n of ["A2", "B2", "C2"]) s[n] = { x: rnd(20, 380), y: rnd(20, 280) };
  if (!bounded(s)) continue;
  general.push(s);
}

/* Triangles perspective from a point: A2 = O + lambda_A * (A1 - O), etc. */
const fromPoint = [];
for (let i = 0; i < 9000 && fromPoint.length < 1500; i++) {
  const O = { x: rnd(40, 360), y: rnd(40, 260) };
  const s = randomTriangle();
  const ls = [rnd(0.4, 2.0), rnd(0.4, 2.0), rnd(0.4, 2.0)];
  if (ls.some((l) => Math.abs(l - 1) < 0.15)) continue;
  if (Math.abs(ls[0] - ls[1]) < 0.15 || Math.abs(ls[1] - ls[2]) < 0.15 ||
      Math.abs(ls[0] - ls[2]) < 0.15) continue;
  ["A", "B", "C"].forEach((name, j) => {
    const p = s[name + "1"];
    s[name + "2"] = { x: O.x + ls[j] * (p.x - O.x), y: O.y + ls[j] * (p.y - O.y) };
  });
  if (!bounded(s) || !wellConditioned(s)) continue;
  fromPoint.push(s);
}

/* Triangles perspective from a line: a homology with centre O and axis l.
   Along OX the collineation fixes O and F = OX ∩ l and multiplies the
   cross-ratio by k, so X' = O + [f / (1 - k(1 - f))] * (X - O). */
const fromLine = [];
for (let i = 0; i < 12000 && fromLine.length < 1500; i++) {
  const axisPoint = { x: rnd(60, 340), y: rnd(60, 240) };
  const d = { x: rnd(-1, 1), y: rnd(-1, 1) };
  const n = { x: -d.y, y: d.x };
  const nl = Math.hypot(n.x, n.y);
  if (nl < 1e-6) continue;
  n.x /= nl; n.y /= nl;
  const O = { x: rnd(60, 340), y: rnd(60, 240) };
  const offset = (axisPoint.x - O.x) * n.x + (axisPoint.y - O.y) * n.y;
  if (Math.abs(offset) < 20) continue;
  const k = rnd(0.3, 2.5);
  if (Math.abs(k - 1) < 0.2) continue;
  const s = randomTriangle();
  let ok = true;
  for (const name of ["A", "B", "C"]) {
    const X = s[name + "1"];
    const den = (X.x - O.x) * n.x + (X.y - O.y) * n.y;
    if (Math.abs(den) < 10) { ok = false; break; }
    const f = offset / den;
    const denom = 1 - k * (1 - f);
    if (Math.abs(denom) < 0.15) { ok = false; break; }
    const t = f / denom;
    if (!Number.isFinite(t) || Math.abs(t) > 20 || Math.abs(t - 1) < 0.1) { ok = false; break; }
    s[name + "2"] = { x: O.x + t * (X.x - O.x), y: O.y + t * (X.y - O.y) };
  }
  if (!ok || !bounded(s) || !wellConditioned(s)) continue;
  fromLine.push(s);
}

// Exceptional configurations the page's proof sets aside: matching vertex
// lines parallel / corresponding corners coincident / corners in one line.
const special = [
  { ...C.START },
  { ...C.START, A2: { x: 102, y: 30 }, B2: { x: 214, y: 30 } }, // AA and BB vertical, parallel
  { ...C.START, A2: { x: 102, y: 144 } },                       // A1 = A2
  { ...C.START, C1: { x: 170, y: 144 }, B1: { x: 140, y: 144 } },// triangle 1 in a line
  { ...C.START, C2: { x: 288, y: 242 - 400 } },                 // far outside the board
];
const all = [...special, ...general, ...fromPoint, ...fromLine];

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  equal("the applet's opening corners", [s.A1, s.B1, s.C1, s.A2, s.B2, s.C2], [
    { x: 102, y: 144 }, { x: 214, y: 90 }, { x: 142, y: 260 },
    { x: 336, y: 188 }, { x: 258, y: 110 }, { x: 288, y: 242 },
  ]);
  check("Direct is selected when the applet opens", s.mode === "direct" &&
    C.compute(s).mode === "direct" && C.result(s) === null);
  equal("the six corners, two triangles, two modes and reset are available",
    C.legalMoves(s).map((m) => m.type),
    ["point", "point", "point", "point", "point", "point", "shape", "shape", "mode", "mode", "reset"]);
  check("an unknown mode is refused", C.move(s, { type: "mode", mode: "sideways" }) === null);
  check("an unknown corner is refused", C.move(s, { type: "point", name: "D1", point: s.B1 }) === null);
  const moved = C.move(s, { type: "point", name: "C2", point: { x: 300, y: 100 } });
  check("dragging one corner moves only that corner", moved && moved.C2.x === 300 &&
    moved.C2.y === 100 && moved.C1.x === s.C1.x && moved.A2.y === s.A2.y);
  check("a corner cannot be dropped on another corner",
    C.move(s, { type: "point", name: "C2", point: s.A2 }) === null);
  const outside = C.move(s, { type: "point", name: "A2", point: { x: 9999, y: -9999 } });
  check("a corner dragged outside stays inside the board", outside &&
    outside.A2.x === C.WIDTH - C.MARGIN && outside.A2.y === C.MARGIN);
  const shifted = C.move(s, { type: "shape", name: "one", base: s, dx: 20, dy: -10 });
  check("dragging a whole triangle moves its three corners together", shifted &&
    ["A1", "B1", "C1"].every((n) => shifted[n].x === s[n].x + 20 && shifted[n].y === s[n].y - 10) &&
    ["A2", "B2", "C2"].every((n) => shifted[n].x === s[n].x && shifted[n].y === s[n].y));
  const far = C.move(shifted, { type: "shape", name: "one", base: shifted, dx: 9999, dy: -9999 });
  check("a triangle dragged past the edge is clamped as a rigid shape", far &&
    ["A1", "B1", "C1"].every((n) => far[n].x <= C.WIDTH - C.MARGIN && far[n].y >= C.MARGIN));
  const converse = C.move(moved, { type: "mode", mode: "converse" });
  check("switching modes changes only the mode and marks the picture explored",
    converse && converse.mode === "converse" && converse.C2.x === moved.C2.x &&
    C.result(converse) === "done" && moved.moves === 1 && converse.moves === 2);
  const reset = C.move(converse, { type: "reset" });
  check("reset restores the six corners but keeps the chosen mode", reset &&
    reset.mode === "converse" && C.NAMES.every((n) => reset[n].x === C.START[n].x && reset[n].y === C.START[n].y));
  check("no move changes the position it was given", s.moves === 0 && s.mode === "direct" &&
    s.A1.x === 102 && moved.A1.x === 102);
}

/* ---------------------------------- 2. the page's two claims, over the sample */

{
  let maxPointSpread = 0, maxLineSpread = 0, maxMenelaus = 0;
  let dotOnPoint = 0, lineOnPoint = 0, dotOnLine = 0, lineOnLine = 0;
  for (const s of fromPoint) {
    const r = C.residuals(s);
    const g = C.compute(s);
    if (!Number.isFinite(r.concurrency) || !Number.isFinite(r.collinearity)) continue;
    maxPointSpread = Math.max(maxPointSpread, r.concurrency);
    maxLineSpread = Math.max(maxLineSpread, r.collinearity);
    if (g.direct.shown) dotOnPoint++;
    if (r.collinearity < 1e-6) lineOnPoint++;
    // The page's Menelaus product, with directed lengths along each side.
    const param = (a, b, p) => {
      const d = C.sub(b, a), t = C.dot(C.sub(p, a), d) / C.dot(d, d);
      // A crossing essentially at a vertex makes the directed ratio blow up;
      // those are the exceptional configurations the page sets aside.
      return Math.abs(1 - t) < 0.02 ? NaN : t / (1 - t);
    };
    // The page renames these: P = bc, Q = ca, R = ab.
    const P = r.crossings.bc, Q = r.crossings.ca, R = r.crossings.ab;
    if (P && Q && R) {
      const ratios = [param(s.B1, s.C1, P), param(s.C1, s.A1, Q), param(s.A1, s.B1, R)];
      if (ratios.every((v) => Number.isFinite(v) && Math.abs(v) < 20)) {
        maxMenelaus = Math.max(maxMenelaus, Math.abs(ratios[0] * ratios[1] * ratios[2] + 1));
      }
    }
  }
  for (const s of fromLine) {
    const r = C.residuals(s);
    const g = C.compute(s);
    if (!Number.isFinite(r.concurrency) || !Number.isFinite(r.collinearity)) continue;
    maxPointSpread = Math.max(maxPointSpread, r.concurrency);
    maxLineSpread = Math.max(maxLineSpread, r.collinearity);
    if (g.direct.shown) dotOnLine++;
    if (r.collinearity < 1e-6) lineOnLine++;
  }
  check("1 implies 2: concurrent matching-vertex lines give collinear crossings",
    fromPoint.length >= 1000 && lineOnPoint === fromPoint.length && maxLineSpread < 1e-6,
    `${lineOnPoint}/${fromPoint.length}, max ${maxLineSpread}`);
  check("the converse: collinear crossings give concurrent matching-vertex lines",
    fromLine.length >= 1000 && lineOnLine === fromLine.length && maxPointSpread < 1e-6,
    `${lineOnLine}/${fromLine.length}, max ${maxPointSpread}`);
  check("the yellow centre dot appears for these perspective-from-point triangles",
    dotOnPoint === fromPoint.length, `${dotOnPoint}/${fromPoint.length}`);
  check("the yellow centre dot also appears for the converse configurations",
    dotOnLine === fromLine.length, `${dotOnLine}/${fromLine.length}`);
  check("the page's Menelaus product is -1 for perspective triangles",
    maxMenelaus < 1e-6, `max ${maxMenelaus}`);

  let dotWhenNear = 0, rareLineUp = 0, maxDotError = 0, maxRareSpread = 0;
  for (const s of general) {
    const g = C.compute(s);
    if (g.direct.shown) {
      dotWhenNear++;
      maxDotError = Math.max(maxDotError,
        Math.abs(g.direct.point.x - C.average(...g.direct.intersections).x),
        Math.abs(g.direct.point.y - C.average(...g.direct.intersections).y));
    }
    const r = C.residuals(s);
    if (Number.isFinite(r.collinearity) && r.collinearity < 1e-6) {
      rareLineUp++;
      maxRareSpread = Math.max(maxRareSpread, r.concurrency);
    }
  }
  check("a shown dot is the mean of three crossings within 8 units", maxDotError === 0);
  check("random general triangles do not all show the centre dot",
    dotWhenNear > 0 && dotWhenNear < general.length / 10, `${dotWhenNear}/${general.length}`);
  check("on the rare random triangles with collinear crossings the vertex lines also meet",
    maxRareSpread < 1e-6, `${rareLineUp} cases, max ${maxRareSpread}`);
}

/* ----------------------------- 3. the same answers as the applet's own methods */

{
  let inter = 0, crossing = 0, dots = 0, segments = 0;
  for (const s of all) {
    const g = C.compute(s);
    const xs = appletCrosses(s);
    for (const name of C.CROSS_NAMES) {
      const a = g.crosses[name], b = xs[name];
      if (a.nan !== b.nan || !near(a.point, b.point)) crossing++;
    }
    const ad = appletDot(s);
    if (ad.shown !== g.direct.shown ||
        (ad.shown && !near(ad.point, g.direct.point))) dots++;
    const raw = appletAxis(s);
    const mine = g.axisSegments;
    if (raw.length !== mine.length) segments++;
    else for (let i = 0; i < raw.length; i++) {
      if (!near(raw[i][0], mine[i][0]) || !near(raw[i][1], mine[i][1])) segments++;
    }
  }
  // Extra pairs with very shallow angles, where the applet's 1.0 determinant
  // cut-off makes GeoSDoub.Intersect return NaN rather than a huge point.
  for (let i = 0; i < 3000; i++) {
    const a = { x: rnd(0, 400), y: rnd(0, 300) }, b = { x: rnd(0, 400), y: rnd(0, 300) };
    const c = { x: rnd(0, 400), y: rnd(0, 300) };
    const d = { x: c.x + rnd(-1, 1) * rnd(0, 3), y: c.y + rnd(-1, 1) * rnd(0, 3) };
    if (!near(C.intersect(a, b, c, d), appletIntersect(a, b, c, d))) inter++;
  }
  check("GeoSDoub.Intersect matches the core, including its NaN threshold", inter === 0,
    `${inter} differences in 3000 pairs`);
  check("applet crosses ab, bc, ca match the core over every configuration", crossing === 0,
    `${crossing} differences in ${all.length} configurations`);
  check("DesargueCanvas.Draw's yellow dot matches the core", dots === 0,
    `${dots} differences in ${all.length} configurations`);
  check("DesargueCanvas.ConnectPoints matches the core's magenta segments", segments === 0,
    `${segments} differences in ${all.length} configurations`);
  check("the sample includes general, point-perspective, line-perspective and exceptional cases",
    general.length === 4000 && fromPoint.length === 1500 && fromLine.length === 1500 &&
    special.length === 5);
}

done("desargues");
