#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-division/circle-division-core.js.
 *
 *   node porting/check-circle-division.mjs
 *
 * Checks the start picture and every move, then walks many configurations of
 * the two draggable points (the opening, sides of regular polygons 3..24,
 * axis positions and 120 deterministic random arcs). At each one it compares
 * the core with a second, literal transcription of Compute() and of
 * GeoSDoub.NearestPoint / IntersectX / IntersectY / GetParallelTo from the
 * applet's bytecode. It also measures the band between the two parallel
 * chords and checks the page's claim: an arc that is 1/n of a turn cuts off
 * 1/n of the circle (1/3 for the opening equilateral triangle).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-division/circle-division-core.js", "CircleDivisionCore");
const R = C.R, O = { x: C.CX, y: C.CY }, TURN = C.TURN;

const near = (a, b, eps = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const unit = (v) => {
  const len = Math.hypot(v.x, v.y);
  return len ? { x: v.x / len, y: v.y / len } : null;
};
const samePoint = (p, q, eps = 1e-6) => {
  if (!p || !q) return !p && !q;
  return near(p.x, q.x, eps) && near(p.y, q.y, eps);
};

/* ----------------------------- the applet's own second version, from javap */

function sqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}

// GeoSDoub.NearestPoint(DoubPoint, DoubPoint, DoubPoint)
function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

// GeoSDoub.GetParallelTo(p, a, b) = p + 100 (a - b)
function getParallelTo(p, a, b) {
  return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
}

// GeoSDoub.Intersect(DoubLine, DoubCircle): IntersectX if |dy| > 1,
// IntersectY if |dx| > 1, else null. Both roots are kept in bytecode order.
function intersectCircleLine(p, q) {
  if (Math.abs(p.y - q.y) > 1) {
    const a = (p.x - q.x) / (p.y - q.y);
    const b = q.x - a * q.y;
    const A = 1 + a * a;
    const B = a * (b - O.x) - O.y;
    const K = O.y * O.y + (b - O.x) * (b - O.x) - R * R;
    const disc = B * B - A * K;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y0 = (-B + s) / A, y1 = (-B - s) / A;
    return [{ x: a * y0 + b, y: y0 }, { x: a * y1 + b, y: y1 }];
  }
  if (Math.abs(p.x - q.x) > 1) {
    const a = (p.y - q.y) / (p.x - q.x);
    const b = q.y - a * q.x;
    const A = 1 + a * a;
    const B = a * (b - O.y) - O.x;
    const K = O.x * O.x + (b - O.y) * (b - O.y) - R * R;
    const disc = B * B - A * K;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x0 = (-B + s) / A, x1 = (-B - s) / A;
    return [{ x: x0, y: a * x0 + b }, { x: x1, y: a * x1 + b }];
  }
  return null;
}

// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint)
function intersectLines(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (!(Math.abs(det) >= 1)) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

// CircleDivisionCanvas.Compute(), transcribed from the bytecode.
function appletCompute(A, Cp) {
  const one = 1;
  if (!(dist(A, Cp) >= one)) return null; // ifge: continue; NaN would continue too
  const M = nearestPoint(O, A, Cp);
  if (!(dist(O, M) >= one)) return null;

  let pts = intersectCircleLine(O, M);
  if (!pts || Number.isNaN(pts[0].x) || Number.isNaN(pts[0].y)) return null;
  // dcmpg: NaN or d0 >= d1 picks pts[1].
  const E = dist(M, pts[0]) < dist(M, pts[1]) ? pts[0] : pts[1];

  pts = intersectCircleLine(O, getParallelTo(O, A, Cp));
  if (!pts) return null;
  // dcmpg against 1: NaN or d0 >= 1 picks pts[0].
  const B = !(dist(A, pts[0]) < one) ? pts[0] : pts[1];

  pts = intersectCircleLine(E, getParallelTo(E, B, Cp));
  if (!pts) return null;
  const Z = !(dist(E, pts[0]) < one) ? pts[0] : pts[1];

  return { M, E, B, Z, K: intersectLines(A, B, E, Z) };
}

/* --------------------------- measuring the band independently of the core */

// Area of the circular cap beyond a chord at distance h from the centre.
const capArea = (h) => R * R * Math.acos(Math.min(1, Math.max(0, h / R))) -
  h * Math.sqrt(Math.max(0, R * R - h * h));

function bandArea(g) {
  const v = unit(sub(g.E, g.Z));
  if (!v) return NaN;
  const n = { x: -v.y, y: v.x };
  const s1 = n.x * (g.E.x - O.x) + n.y * (g.E.y - O.y);
  const s2 = n.x * (g.B.x - O.x) + n.y * (g.B.y - O.y);
  if (s1 * s2 >= 0) return Math.abs(capArea(Math.abs(s1)) - capArea(Math.abs(s2)));
  return Math.PI * R * R - capArea(Math.abs(s1)) - capArea(Math.abs(s2));
}

/* ------------------------------------------------------------ 1. the rules */

{
  equal("opening C is at 120 degrees", C.start().C, C.pointAt(2 * Math.PI / 3));
  equal("opening A is at 240 degrees", C.start().A, C.pointAt(4 * Math.PI / 3));
  check("the centre D is (200, 125)", C.CX === 200 && C.CY === 125);
  check("the radius is min(400/3, 250/3) = 83", R === 83);
  check("a new picture has no result", C.result(C.start()) === null);
  check("names and hint start off", !C.start().names && !C.start().hint);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover both drags, both ticks and reset",
    ["point", "names", "hint", "reset"].every((t) => types.has(t)));

  const s = C.start();
  const a = C.move(s, { type: "point", name: "A", x: 250, y: 200 });
  check("dragging A moves only A, and keeps it on the circle",
    !samePoint(a.A, s.A) && near(dist(a.A, O), R) && samePoint(a.C, s.C));
  check("the dragged point is where it was aimed (projected)", samePoint(a.A, C.project({ x: 250, y: 200 })));
  check("dragging C moves only C, and keeps it on the circle",
    !samePoint(C.move(s, { type: "point", name: "C", x: 100, y: 80 }).C, s.C) &&
    near(dist(C.move(s, { type: "point", name: "C", x: 100, y: 80 }).C, O), R));
  check("a move counts and explores", a.moves === 1 && a.explored && C.result(a) === "done");
  check("the original position is untouched", s.moves === 0 && !s.explored);
  check("ticks behave", C.move(s, { type: "names", value: true }).names === true &&
    C.move(s, { type: "hint", value: true }).hint === true);
  check("reset restores the picture and keeps the ticks",
    samePoint(C.move(a, { type: "reset" }).A, C.START_A) &&
    C.move({ ...a, names: true }, { type: "reset" }).names === true &&
    C.move(a, { type: "reset" }).explored === false);
  check("bad moves are refused",
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: "x", y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: 200, y: 125 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null && C.move(null, { type: "reset" }) === null);
}

/* ------------------------------------ 2. many configurations, two methods */

const configs = [];
const add = (a, c, label) => configs.push({ a: a % TURN, c: c % TURN, label });
const THIRD = TURN / 3;
add(2 * THIRD, THIRD, "opening");
for (const a of [0, 0.37, 1.9, -2.3, Math.PI / 2]) {
  add(a + Math.PI / 2, a - Math.PI / 2, "diameter near " + a.toFixed(2));
}
for (let n = 3; n <= 24; n++) {
  for (const base of [0, 0.37, 1.9, -2.3]) add(base + Math.PI / n, base - Math.PI / n, `n=${n}`);
}
const rand = rng(20261126);
for (let i = 0; i < 120; i++) {
  const a = rand() * TURN;
  const span = 0.05 + rand() * (Math.PI - 0.1);
  add(a, a + (rand() < 0.5 ? span : -span), "random " + i);
}

let claimCount = 0;
for (const cfg of configs) {
  const state = C.start({ A: C.pointAt(cfg.a), C: C.pointAt(cfg.c) });
  const g = C.construct(state);
  const ap = appletCompute(state.A, state.C);
  const where = cfg.label;

  check(`${where}: core and applet agree on the degenerate case`, !g === !ap);
  if (!g || !ap) continue;

  check(`${where}: M, E, B and Z match Compute() exactly`,
    samePoint(g.M, ap.M) && samePoint(g.E, ap.E) && samePoint(g.B, ap.B) && samePoint(g.Z, ap.Z));
  check(`${where}: K matches the applet's line intersection`,
    (!g.K && Number.isNaN(ap.K.x)) || samePoint(g.K, ap.K));
  check(`${where}: all five circle points lie on the circle`,
    [state.A, state.C, g.E, g.B, g.Z].every((p) => near(dist(p, O), R)));

  check(`${where}: EZ and BC are parallel`,
    Math.abs(cross(sub(g.E, g.Z), sub(g.B, g.C))) < 1e-6);
  check(`${where}: E is the midpoint of the shorter arc AC`,
    near(dist(g.E, state.A), dist(g.E, state.C), 1e-6));
  check(`${where}: B is on the line through D parallel to AC`,
    Math.abs(cross(sub(g.B, O), sub(state.A, state.C))) < 1e-5);
  check(`${where}: Z is on the line through E parallel to BC`,
    Math.abs(cross(sub(g.Z, g.E), sub(g.B, state.C))) < 1e-5);
  check(`${where}: the fraction is the shorter arc over a full turn`,
    near(g.fraction, C.fractionFor(state)));

  const area = bandArea(g);
  check(`${where}: the band area is the arc fraction of the circle`,
    near(area, g.fraction * Math.PI * R * R, 1e-5));
  if (near(g.fraction * 3, 1, 1e-6)) claimCount++;
}

/* ------------------------------------------- 3. the article's exact claims */

{
  const g = C.construct(C.start());
  check("the opening chord AC spans 120 degrees", near(g.arcDegrees, 120, 1e-6));
  check("the opening parallel chords cut off exactly one third", near(g.fraction, 1 / 3, 1e-9));
  check("the opening band has area pi R^2 / 3", near(bandArea(g), Math.PI * R * R / 3, 1e-5));
  for (let n = 3; n <= 12; n++) {
    const base = 0.41;
    const state = C.start({ A: C.pointAt(base + Math.PI / n), C: C.pointAt(base - Math.PI / n) });
    const q = C.construct(state);
    check(`an inscribed ${n}-gon side cuts off 1/${n}`, near(q.fraction, 1 / n, 1e-9) &&
      near(bandArea(q), Math.PI * R * R / n, 1e-5));
  }
  check("many tested arcs really did hit the one-third case", claimCount > 0);
  check("the heptagon note is about ruler-and-compass, not this digital construction",
    near(C.construct(C.start({ A: C.pointAt(Math.PI / 7), C: C.pointAt(-Math.PI / 7) })).fraction, 1 / 7, 1e-9));
}

/* ------------------------------------------------- 4. degenerate positions */

{
  const same = C.start();
  check("A coinciding with C gives no new picture",
    C.construct(C.move(same, { type: "point", name: "C", x: same.A.x, y: same.A.y })) === null &&
    appletCompute(same.A, same.A) === null);
  const oppositePoint = { x: 2 * C.CX - same.A.x, y: 2 * C.CY - same.A.y };
  const dia = C.start({ A: same.A, C: oppositePoint });
  check("a diameter puts the chord midpoint on D, so the applet stops",
    C.construct(dia) === null && appletCompute(dia.A, dia.C) === null);
  check("fractionFor reports null for a stopped picture", C.fractionFor(dia) === null);
}

done("circle-division");
