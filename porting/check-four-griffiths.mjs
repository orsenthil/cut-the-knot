#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-griffiths/four-griffiths-core.js.
 *
 *   node porting/check-four-griffiths.mjs
 *
 * Two independent readings of the old applet are compared here:
 *
 * 1. A literal second transcription of the bytecode: GeoSDoub.FindCircumcenter
 *    and NearestPoint, the axis-based IntersectCirclesX/Y and IntersectX/Y,
 *    GetCircle, NinePointCircle, PotentialGriffiths, Griffiths, FindCommon,
 *    GetLine and Compute. It shares no code with the core.
 * 2. The complex-number formula printed on the cut-the-knot page,
 *    w_m = (a_i + a_j + a_k - a_i a_j a_k) / 2, normalised so that l is the
 *    real axis and the circumcircle is the unit circle.
 *
 * The claims tested over 240 generated configurations are: the four Griffiths
 * points agree with the formula and are collinear; the four pedal circles of
 * any point of l concur; that common point lies on the Griffiths line; the
 * four nine-point circles concur; P (the applet's average of the other circle
 * meetings) lies on that line; and (w1-w2)/(w1'-w2') = a1a2a3a4. The page's
 * wider claim about non-cyclic quadrangles is tested separately.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-griffiths/four-griffiths-core.js", "FourGriffithsCore");

/* ------------------------------------------------------------- small tools */

const pt = (x, y) => ({ x, y });
const add = (a, b) => pt(a.x + b.x, a.y + b.y);
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const mul = (a, t) => pt(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const lineDist = (p, a, b) => Math.abs(cross(a, b, p)) / dist(a, b);
const cmul = (a, b) => pt(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
const conj = (z) => pt(z.x, -z.y);
const cdiv = (a, b) => pt((a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y),
                          (a.y * b.x - a.x * b.y) / (b.x * b.x + b.y * b.y));
const norm = (p, o, r) => pt((p.x - o.x) / r, (p.y - o.y) / r);
const toWorld = (z, o, r, theta) => add(o, mul(cmul(z, pt(Math.cos(theta), Math.sin(theta))), r));

/* --------------------------------- the applet's own methods, transcribed 2 */

// GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors, solving
// the 2x2 system in coordinates instead of using the core's vector formula.
function appletCircle(a, b, c) {
  const m1 = mul(add(a, b), 0.5), m2 = mul(add(b, c), 0.5);
  const d1 = sub(b, a), d2 = sub(c, b);
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 1e-9) return null;
  // With v = o - m1, the two bisectors say d1·v = 0 and d2·v = d2·(m2-m1).
  // Cramer's rule on that 2x2 system gives the applet's intersection.
  const q = sub(m2, m1);
  const t = dot(q, d2) / det;
  const o = add(m1, pt(-d1.y * t, d1.x * t));
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}

// GeoSDoub.NearestPoint: returns p itself when the side is shorter than sqrt(0.1).
function appletFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

// GeoSDoub.IntersectCirclesX: x = k*y + x0 is the radical axis (k = dx/dy).
function intersectCirclesX(c0, r0, c1, r1) {
  const k = -(c0.y - c1.y) / (c0.x - c1.x);
  const x0 = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - r0 ** 2 + r1 ** 2) /
             (2 * (c0.x - c1.x));
  const dx = x0 - c0.x;
  const b = k * dx - c0.y;
  const c = dx * dx + c0.y * c0.y - r0 * r0;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const t1 = (-b + s) / (k * k + 1), t2 = (-b - s) / (k * k + 1);
  return [pt(k * t1 + x0, t1), pt(k * t2 + x0, t2)];
}

// GeoSDoub.IntersectCirclesY: y = k*x + y0 is the radical axis.
function intersectCirclesY(c0, r0, c1, r1) {
  const k = -(c0.x - c1.x) / (c0.y - c1.y);
  const y0 = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - r0 ** 2 + r1 ** 2) /
             (2 * (c0.y - c1.y));
  const dy = y0 - c0.y;
  const b = k * dy - c0.x;
  const c = dy * dy + c0.x * c0.x - r0 * r0;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const t1 = (-b + s) / (k * k + 1), t2 = (-b - s) / (k * k + 1);
  return [pt(t1, k * t1 + y0), pt(t2, k * t2 + y0)];
}

function appletCircleCircle(c0, r0, c1, r1) {
  if (Math.abs(c0.x - c1.x) > 1) return intersectCirclesX(c0, r0, c1, r1);
  if (Math.abs(c0.y - c1.y) > 1) return intersectCirclesY(c0, r0, c1, r1);
  return []; // the applet returns [null, new DoubPoint()] here: no usable point
}

// GeoSDoub.IntersectX(DoubLine, DoubCircle): x = k*y + b.
function intersectLineX(a, b, circle) {
  const k = (a.x - b.x) / (a.y - b.y);
  const intercept = b.x - k * b.y;
  const dx = intercept - circle.c.x;
  const lin = k * dx - circle.c.y;
  const con = dx * dx + circle.c.y ** 2 - circle.r ** 2;
  const disc = lin * lin - (k * k + 1) * con;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const t1 = (-lin + s) / (k * k + 1), t2 = (-lin - s) / (k * k + 1);
  return [pt(k * t1 + intercept, t1), pt(k * t2 + intercept, t2)];
}

// GeoSDoub.IntersectY(DoubLine, DoubCircle): y = k*x + b.
function intersectLineY(a, b, circle) {
  const k = (a.y - b.y) / (a.x - b.x);
  const intercept = b.y - k * b.x;
  const dy = intercept - circle.c.y;
  const lin = k * dy - circle.c.x;
  const con = dy * dy + circle.c.x ** 2 - circle.r ** 2;
  const disc = lin * lin - (k * k + 1) * con;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const t1 = (-lin + s) / (k * k + 1), t2 = (-lin - s) / (k * k + 1);
  return [pt(t1, k * t1 + intercept), pt(t2, k * t2 + intercept)];
}

function appletLineCircle(a, b, circle) {
  if (Math.abs(a.y - b.y) > 1) return intersectLineX(a, b, circle);
  if (Math.abs(a.x - b.x) > 1) return intersectLineY(a, b, circle);
  return [];
}

function appletNine(a, b, c) {
  return appletCircle(mul(add(a, b), 0.5), mul(add(b, c), 0.5), mul(add(c, a), 0.5));
}

// PotentialGriffiths: pedal circle of q, using three applet feet.
function appletPedal(q, a, b, c) {
  return appletCircle(appletFoot(q, b, c), appletFoot(q, c, a), appletFoot(q, a, b));
}

// DoubPoint.Other: the second point, unless the first is within one pixel.
function appletOther(points, vertex) {
  if (!points || points.length < 2) return null;
  return dist(points[0], vertex) >= 1 ? points[0] : points[1];
}

// FindCommon: keep pairs less than one pixel apart. The bytecode breaks a
// tie by the previous frame's Griffiths line; both implementations here take
// the closest pair instead, which is the point the page's formula gives when
// L is so near O that the two pedal circles almost coincide.
function appletFindCommon(s, t) {
  let best = null, bestD = 1;
  for (const p of s || []) for (const q of t || []) {
    if (!p || !q || dist(p, q) >= bestD) continue;
    bestD = dist(p, q);
    best = mul(add(p, q), 0.5);
  }
  return best;
}

function appletGriffiths(a, b, c, L, circle, lineG) {
  const nine = appletNine(a, b, c);
  if (!nine) return { g: null, pedal: null };
  const pedal = appletPedal(L, a, b, c);
  const pedal2 = appletPedal(mul(add(circle.c, L), 0.5), a, b, c);
  if (!pedal || !pedal2) return { g: null, pedal };
  const s = appletCircleCircle(nine.c, nine.r, pedal.c, pedal.r);
  const t = appletCircleCircle(nine.c, nine.r, pedal2.c, pedal2.r);
  return { g: appletFindCommon(s, t, lineG), pedal };
}

// GetLine: the farthest of the three pairs (ties in bytecode order).
function appletGetLine(p, q, r) {
  const pairs = [[p, q], [p, r], [q, r]].filter(([u, v]) => u && v);
  if (!pairs.length) return null;
  let best = pairs[0];
  for (const pair of pairs) if (dist(pair[0], pair[1]) > dist(best[0], best[1])) best = pair;
  return [best[0], best[1]]; // infinite line: enough for distance/intersection tests
}

function appletCompute(state) {
  const circle = appletCircle(state.A, state.B, state.C);
  if (!circle) return null;
  const tris = [[state.B, state.C, state.D], [state.A, state.C, state.D],
                [state.A, state.B, state.D], [state.A, state.B, state.C]];
  const G = [], pedals = [];
  for (const [a, b, c] of tris) {
    const r = appletGriffiths(a, b, c, state.L, circle);
    G.push(r.g);
    pedals.push(r.pedal);
  }
  const lineG = appletGetLine(G[1], G[2], G[3]) || appletGetLine(G[0], G[2], G[3]) ||
                appletGetLine(G[0], G[1], G[3]) || appletGetLine(G[0], G[1], G[2]);
  let sx = 0, sy = 0, n = 0;
  if (lineG) for (let i = 0; i < 4; i++) {
    if (!G[i] || !pedals[i]) continue;
    const p = appletOther(appletLineCircle(lineG[0], lineG[1], pedals[i]), G[i]);
    if (p) { sx += p.x; sy += p.y; n++; }
  }
  return { circle, G, pedals, lineG, P: n ? pt(sx / n, sy / n) : null };
}

/* -------------------------------------------------------------- test cases */

const rand = rng(20261127);
const cases = [];
const start = C.start({});
cases.push({ name: "applet default", state: start });

// Exact right, isosceles and scalene cyclic quadrilaterals, plus generated
// ones. Every vertex is on one circle, as in CheckForABC.
const exact = [
  { o: pt(300, 275), r: 162.78820596099706, angles: [Math.atan2(-110, -120), Math.atan2(110, 120), Math.atan2(-110, 120), -1.9] },
  { o: pt(200, 150), r: 100, angles: [0.2, 1.7, 3.1, 5.0] },
  { o: pt(200, 150), r: 100, angles: [-2.6, -0.9, 0.9, 2.7] },
  { o: pt(300, 275), r: 150, angles: [0.1, 1.1, 2.2, 4.4] },
];
for (const e of exact) cases.push({
  name: "exact " + e.angles.join(","),
  state: Object.assign({}, start, {
    A: add(e.o, pt(e.r * Math.cos(e.angles[0]), e.r * Math.sin(e.angles[0]))),
    B: add(e.o, pt(e.r * Math.cos(e.angles[1]), e.r * Math.sin(e.angles[1]))),
    C: add(e.o, pt(e.r * Math.cos(e.angles[2]), e.r * Math.sin(e.angles[2]))),
    D: add(e.o, pt(e.r * Math.cos(e.angles[3]), e.r * Math.sin(e.angles[3]))),
    L: pt(420, 400),
  }),
});
for (let i = 0; i < 240; i++) {
  const o = pt(90 + rand() * 420, 90 + rand() * 370);
  const r = 65 + rand() * 115;
  const t = [];
  for (let k = 0; k < 4; k++) t.push(rand() * Math.PI * 2);
  t.sort((a, b) => a - b);
  if (t.some((v, k) => k && v - t[k - 1] < 0.28)) continue;
  const on = (v) => add(o, pt(r * Math.cos(v), r * Math.sin(v)));
  cases.push({
    name: `generated ${i}`,
    state: {
      A: on(t[0]), B: on(t[1]), C: on(t[2]), D: on(t[3]),
      L: pt(20 + rand() * 560, 20 + rand() * 510),
      options: { names: false, circles: false, lines: false }, explored: false,
    },
  });
}

/* ----------------------------------------------- 1. the rules and options */

{
  check("start has the applet's 600x550 board", C.VIEW.width === 600 && C.VIEW.height === 550);
  check("start has the applet's A, B, C and L", start.A.x === 180 && start.A.y === 165 &&
    start.B.x === 420 && start.B.y === 385 && start.C.x === 420 && start.C.y === 165 &&
    Math.abs(start.L.x - 600 * 6 / 11) < 1e-9 && start.L.y === 550 * 3 / 4);
  check("start puts D on the circumcircle", Math.abs(dist(start.D, pt(300, 275)) - C.circleOf(start.A, start.B, start.C).r) < 1e-9);
  check("the applet's three Show checkboxes are off by default",
    !start.options.names && !start.options.circles && !start.options.lines);
  check("a demo never wins or loses", C.result(start) === null &&
    C.result(C.move(start, "L", pt(200, 200))) === "done");
  equal("the five draggable handles", C.legalMoves(start), ["A", "B", "C", "D", "L"]);
  check("an unknown handle is refused", C.move(start, "Z", pt(1, 2)) === start);
  const moved = C.move(start, "A", pt(9999, -9999));
  check("a drag is clamped to the board", moved.A.x <= 600 && moved.A.y >= 0 && start.A.x === 180);
  check("a drag does not change the old state", start.explored === false && moved.explored === true);
  const draggedD = C.move(start, "D", pt(250, 200));
  check("D is free while it is dragged", draggedD.D.x === 250 && draggedD.D.y === 200);
  check("toggling an option is immutable", C.setOption(start, "circles", true).options.circles &&
    !start.options.circles && C.setOption(start, "nope", true) === start);
  check("reset keeps the shown options", C.reset(C.setOption(start, "names", true)).options.names === true &&
    C.reset(start).A.x === start.A.x && C.reset(start).D.x === start.D.x);
  const flat = Object.assign({}, start, { C: pt(300, 275) }); // A, B, C collinear
  check("a collapsed triangle has no geometry", C.geometry(flat) === null &&
    C.describe(flat).includes("straight line"));
}

/* ------------------------- 2. the page's claims, on every generated case */

let live = 0, finite = 0, formulaOk = 0, collinear = 0, concur = 0;
let concurOnLine = 0, nineOk = 0, pOnLine = 0, proofOk = 0, appletOk = 0;
let maxFormula = 0, maxCol = 0, maxConcur = 0, maxLine = 0, maxApplet = 0, maxProof = 0;

for (const { state } of cases) {
  const g = C.geometry(state);
  const x = appletCompute(state);
  if (!g || !x || g.G.some((p) => !p) || x.G.some((p) => !p)) continue;
  live++;
  const vals = [...g.G.flatMap((p) => [p.x, p.y]), g.P.x, g.P.y,
    g.circle.c.x, g.circle.c.y, g.circle.r];
  if (vals.every(Number.isFinite)) finite++;

  // The page's formula, with l rotated onto the real axis and the circle
  // scaled to radius 1. Vertex i,j,k is the triangle opposite the i,j,k missing.
  const O = g.circle.c, R = g.circle.r;
  const theta = Math.atan2(state.L.y - O.y, state.L.x - O.x);
  const unit = [state.A, state.B, state.C, state.D].map((p) =>
    cmul(norm(p, O, R), pt(Math.cos(-theta), Math.sin(-theta))));
  const formulas = [];
  // G[0] omits A, G[1] omits B, G[2] omits C, G[3] omits D.
  const triples = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  for (const ids of triples) {
    const a = unit[ids[0]], b = unit[ids[1]], c = unit[ids[2]];
    const w = mul(add(add(a, b), sub(c, cmul(cmul(a, b), c))), 0.5);
    formulas.push(toWorld(w, O, R, theta));
  }
  for (let i = 0; i < 4; i++) {
    const err = dist(g.G[i], formulas[i]);
    maxFormula = Math.max(maxFormula, err);
    if (err < 1e-6) formulaOk++;
  }

  // The proof's cross ratio: (w1-w2)/(conj(w1)-conj(w2)) = a1a2a3a4.
  const aa = cmul(cmul(unit[0], unit[1]), cmul(unit[2], unit[3]));
  const ws = formulas.map((p) =>
    cmul(norm(p, O, R), pt(Math.cos(-theta), Math.sin(-theta))));
  const ratio = cdiv(sub(ws[0], ws[1]), sub(conj(ws[0]), conj(ws[1])));
  const proofErr = dist(ratio, aa);
  maxProof = Math.max(maxProof, proofErr);
  if (proofErr < 1e-6) proofOk++;

  // Collinearity of the four Griffiths points.
  let colErr = 0;
  for (let i = 2; i < 4; i++) colErr = Math.max(colErr, lineDist(g.G[i], g.G[0], g.G[1]));
  maxCol = Math.max(maxCol, colErr);
  if (colErr < 1e-6) collinear++;

  // Pedal circles of five different points of l, and the nine-point circles.
  const gTris = [[state.B, state.C, state.D], [state.A, state.C, state.D],
                 [state.A, state.B, state.D], [state.A, state.B, state.C]];
  let allConcur = true, allOnLine = true, nineAll = true, tested = 0;
  for (let k = 1; k <= 5; k++) {
    const q = add(O, mul(sub(state.L, O), k / 6));
    const pcs = gTris.map(([a, b, c]) => C.pedalCircle(q, a, b, c));
    // A point of l on the circumcircle makes the pedal feet collinear (a
    // Simson line), so there is no pedal circle to test at that position.
    if (pcs.some((c) => !c)) continue;
    tested++;
    const p1 = C.circleIntersections(pcs[0].c, pcs[0].r, pcs[1].c, pcs[1].r);
    if (!p1.length) { allConcur = false; continue; }
    const point = p1.reduce((best, p) =>
      Math.abs(dist(p, pcs[2].c) - pcs[2].r) < Math.abs(dist(best, pcs[2].c) - pcs[2].r) ? p : best);
    const err = Math.max(...pcs.map((c) => Math.abs(dist(point, c.c) - c.r)));
    maxConcur = Math.max(maxConcur, err);
    if (err >= 1e-6) allConcur = false;
    const lineErr = lineDist(point, g.lineG[0], g.lineG[1]);
    maxLine = Math.max(maxLine, lineErr);
    if (lineErr >= 1e-6) allOnLine = false;
  }
  if (!tested) { allConcur = false; allOnLine = false; }
  const ncs = g.nineCircles;
  const n1 = ncs.every(Boolean)
    ? C.circleIntersections(ncs[0].c, ncs[0].r, ncs[1].c, ncs[1].r) : [];
  if (n1.length && ncs[2] && ncs[3]) {
    const np = n1.reduce((best, p) =>
      Math.abs(dist(p, ncs[2].c) - ncs[2].r) < Math.abs(dist(best, ncs[2].c) - ncs[2].r) ? p : best);
    if (ncs.every((c) => Math.abs(dist(np, c.c) - c.r) < 1e-6)) nineAll = true;
  }
  if (allConcur) concur++;
  if (allOnLine) concurOnLine++;
  if (nineAll) nineOk++;
  if (lineDist(g.P, g.lineG[0], g.lineG[1]) < 1e-6) pOnLine++;

  // Second transcription: circle, four Griffiths points, P and the line.
  const errs = [dist(g.circle.c, x.circle.c), Math.abs(g.circle.r - x.circle.r),
    dist(g.P, x.P), ...g.G.map((p, i) => dist(p, x.G[i]))];
  const worst = Math.max(...errs);
  maxApplet = Math.max(maxApplet, worst);
  if (worst < 0.5) appletOk++; // axis-switched intersections differ by at most a screen pixel
}

check(`every usable configuration has a geometry (${live} of ${cases.length})`, live === cases.length, `${live}/${cases.length}`);
check("all coordinates are finite", finite === live, `${finite}/${live}`);
check(`the page's Griffiths formula holds (worst ${maxFormula.toExponential(1)})`, formulaOk === live * 4);
check(`the proof's cross ratio equals a1a2a3a4 (worst ${maxProof.toExponential(1)})`, proofOk === live, `${proofOk}/${live}`);
check(`the four Griffiths points are collinear (worst ${maxCol.toExponential(1)})`, collinear === live, `${collinear}/${live}`);
check(`pedal circles of any point of l concur (worst ${maxConcur.toExponential(1)})`, concur === live, `${concur}/${live}`);
check(`their common point lies on the Griffiths line (worst ${maxLine.toExponential(1)})`, concurOnLine === live, `${concurOnLine}/${live}`);
check("the four nine-point circles concur", nineOk === live, `${nineOk}/${live}`);
check("the applet's P lies on the Griffiths line", pOnLine === live, `${pOnLine}/${live}`);
check(`the core matches the bytecode transcription (worst ${maxApplet.toExponential(1)})`, appletOk === live, `${appletOk}/${live}`);

/* ---------------------------- 3. the page's wider claim: any quadrangle */

{
  let ok = 0, total = 0, worst = 0;
  for (let i = 0; i < 200; i++) {
    const pts = [];
    for (let k = 0; k < 4; k++) pts.push(pt(20 + rand() * 560, 20 + rand() * 510));
    const q = pt(20 + rand() * 560, 20 + rand() * 510);
    const pcs = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]].map((ids) =>
      C.pedalCircle(q, ...ids.map((j) => pts[j])));
    if (pcs.some((c) => !c)) continue;
    total++;
    const p1 = C.circleIntersections(pcs[0].c, pcs[0].r, pcs[1].c, pcs[1].r);
    if (!p1.length) continue;
    const best = p1.reduce((b, p) =>
      Math.abs(dist(p, pcs[2].c) - pcs[2].r) < Math.abs(dist(b, pcs[2].c) - pcs[2].r) ? p : b);
    const err = Math.max(...pcs.map((c) => Math.abs(dist(best, c.c) - c.r)));
    worst = Math.max(worst, err);
    if (err < 1e-6) ok++;
  }
  check(`non-cyclic quadrangle pedal circles concur too (${ok}/${total}, worst ${worst.toExponential(1)})`,
    total > 100 && ok === total);
}

/* ------------------------------- 4. dragging reproduces the applet's rules */

{
  const s = C.start({});
  const moved = C.move(s, "B", pt(500, 120));
  const x = appletCompute(moved);
  const g = C.geometry(moved);
  check("dragging B keeps D on the new circle",
    Math.abs(dist(moved.D, g.circle.c) - g.circle.r) < 1e-9 && !!x);
  check("dragging B agrees with the bytecode transcription",
    dist(g.G[3], x.G[3]) < 1e-6 && dist(g.circle.c, x.circle.c) < 1e-9);
  const lineBefore = C.clipLine(g.O, s.L);
  const lineAfter = C.clipLine(g.O, moved.L);
  check("moving L rotates l through the same centre",
    Math.abs(lineBefore[0].y - lineAfter[0].y) < 1e-9 && moved.L.x === s.L.x);
  const movedL = C.move(s, "L", pt(400, 100));
  check("L is a free handle", movedL.L.x === 400 && movedL.L.y === 100);
  check("the status describes the four points and two circles",
    C.describe(s).includes("Four Griffiths points") && C.describe(s).includes("four nine-point circles"));
}

done("four-griffiths");
