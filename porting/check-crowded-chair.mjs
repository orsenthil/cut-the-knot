#!/usr/bin/env node
"use strict";

/*
 * Logic test for crowded-chair/crowded-chair-core.js.
 *
 *   node porting/check-crowded-chair.mjs
 *
 * Part 1 transcribes CrowdedChairCanvas.ComputeC/Compute/GetCircle, UpgradePoints
 * and the GeoSDoub helpers a second time, straight from the bytecode, and
 * compares them with the core on a grid of starting angles, thousands of
 * triangles and long sequences of drags.
 *
 * Part 2 checks every claim on the cut-the-knot page over all those triangles:
 * AK ⟂ CD, CE ⟂ BF, U and V on C(ABDE), the right angles at U and V, the
 * diameters AD and BE, and the secant identity CE·CU = CD·CV. It also checks
 * that the page's sentence swaps the applet's U and V labels, and that the
 * identity survives that swap.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("crowded-chair/crowded-chair-core.js", "CrowdedChairCore");

/* --------------------------- a second, literal transcription of the applet */

const plus = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
const cross2 = (p, q) => p.x * q.y - p.y * q.x;
const length = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const half = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const ok = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (p, q, eps = 1e-7) =>
  Math.abs(p.x - q.x) <= eps * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
  Math.abs(p.y - q.y) <= eps * Math.max(1, Math.abs(p.y), Math.abs(q.y));

/** GeoSDoub.Intersect(DoubPoint x4), including its |det| < 1 guard. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.Rotate(p, q, angle, dir). */
function appletRotate(p, q, angle, dir) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    x: p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
    y: p.y + dir * s * (q.x - p.x) + c * (q.y - p.y),
  };
}

/** GeoSDoub.NearestPoint(p, a, b). */
function appletFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return p;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** GeoSDoub.FindCircumcenter(a,b,c) and CrowdedChairCanvas.GetCircle(a,b,c). */
function appletCircumcenter(a, b, c) {
  const m1 = half(a, b), m2 = half(b, c);
  const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  return appletIntersect(m1, p, m2, q);
}
function appletCircle(a, b, c) {
  const o = appletCircumcenter(a, b, c);
  return { center: o, radius: (length(o, a) + length(o, b) + length(o, c)) / 3 };
}

/** GeoSDoub.ComputeAngle(a,b,c): angle at a. */
function appletAngle(a, b, c) {
  const ab = length(a, b), ac = length(a, c);
  const t = (ab * ab + ac * ac - length(b, c) ** 2) / (2 * ab * ac);
  return Math.acos(Math.max(-1, Math.min(1, t)));
}
/** GeoSDoub.FindOrientation(a,b,c). */
function appletOrientation(a, b, c) {
  return cross2(minus(b, a), minus(c, a)) > 0 ? 1 : -1;
}

/** CrowdedChairCanvas.ComputeC(). */
function appletComputeC(A, B, angleA) {
  const S1 = appletRotate(A, B, -angleA, -1);
  const S2 = appletRotate(B, A, Math.PI / 2 - angleA, 1);
  return appletIntersect(A, S1, B, S2);
}

/** CrowdedChairCanvas.Compute(), with the same order of rotations and crosses. */
function appletCompute(A, B, Cc) {
  if (!ok(Cc)) return null;
  const K = appletRotate(B, Cc, Math.PI / 2, 1);
  const H = appletRotate(Cc, B, Math.PI / 2, -1);
  const G = appletRotate(Cc, A, Math.PI / 2, 1);
  const F = appletRotate(A, Cc, Math.PI / 2, -1);
  const E = appletRotate(A, B, Math.PI / 2, 1);
  const D = appletRotate(B, A, Math.PI / 2, -1);
  const L = appletFoot(Cc, D, E);
  const M = appletFoot(Cc, A, B);
  const U = appletIntersect(E, Cc, F, B);
  const V = appletIntersect(Cc, D, A, K);
  const circle = appletCircle(E, D, U);
  if (![K, H, G, F, E, D, L, M, U, V, circle.center].every(ok)) return null;
  return { A, B, C: Cc, K, H, G, F, E, D, L, M, U, V, circle };
}

/** CrowdedChairCanvas.UpgradePoints(), after a drag of one of the three points. */
function appletUpgrade(state, name, target) {
  let { A, B, C: Cc, angleA } = state;
  if (name === "C") {
    const circle = appletCircle(A, B, Cc);
    if (!ok(circle.center)) return null;
    const v = minus(target, circle.center), d = Math.hypot(v.x, v.y);
    if (d < 1e-9) return null;
    Cc = plus(circle.center, scale(v, circle.radius / d));
    angleA = appletAngle(A, B, Cc);
  } else {
    const p = C.clampPoint(target);
    if (C.dist(p, name === "A" ? B : A) < C.MIN_SEP ||
        C.dist(p, Cc) < C.MIN_SEP) return null;
    if (name === "A") A = p; else B = p;
    Cc = appletComputeC(A, B, angleA);
  }
  if (!ok(Cc) || !Number.isFinite(angleA)) return null;
  if (appletOrientation(A, B, Cc) === 1) [A, B] = [B, A];
  return { ...state, A, B, C: Cc, angleA };
}

/* ----------------------------------------------------------- triangle sample */

const R = rng(20261127);
const triangles = [];
const opening = C.start();
triangles.push({ A: opening.A, B: opening.B, C: opening.C });
triangles.push({ A: { x: 70, y: 220 }, B: { x: 330, y: 220 }, C: { x: 200, y: 60 } });  // point up
triangles.push({ A: { x: 70, y: 60 }, B: { x: 330, y: 70 }, C: { x: 200, y: 290 } });   // point down
triangles.push({ A: { x: 60, y: 80 }, B: { x: 340, y: 260 }, C: { x: 100, y: 300 } });  // scalene
triangles.push({ A: { x: 40, y: 180 }, B: { x: 400, y: 184 }, C: { x: 220, y: 190 } }); // very flat
for (let i = 0; i < 6000 && triangles.length < 4000; i++) {
  const A = { x: 10 + R() * 420, y: 10 + R() * 340 };
  const B = { x: 10 + R() * 420, y: 10 + R() * 340 };
  const Cc = { x: 10 + R() * 420, y: 10 + R() * 340 };
  if (Math.min(length(A, B), length(A, Cc), length(B, Cc)) < 30) continue;
  if (Math.abs(cross2(minus(B, A), minus(Cc, A))) < 400) continue;
  triangles.push({ A, B, C: Cc });
}
const geometries = triangles.map((t) => C.compute(t)).filter((g) => !g.degenerate);
const appletGeometries = triangles.map((t) => appletCompute(t.A, t.B, t.C)).filter(Boolean);

/* ------------------------------------------------------ 1. the opening state */

check("opening A sits at 0.2 of the board width, B is one side to its right",
  Math.abs(opening.A.x - 0.2 * C.WIDTH) < 1e-12 &&
  Math.abs(opening.B.x - opening.A.x - C.SIDE) < 1e-12 &&
  opening.A.y === opening.B.y);
check("opening angle is the applet's 30 degrees",
  Math.abs(opening.angleA - Math.PI / 6) < 1e-12);
check("opening C is the applet's ComputeC", close(opening.C, appletComputeC(opening.A, opening.B, Math.PI / 6)));
{
  const g0 = C.compute(opening);
  const points = ["A", "B", "C", "K", "H", "G", "F", "E", "D", "U", "V"].map((k) => g0[k]);
  check("every point of the opening drawing fits inside the board",
    points.every((p) => p.x > 8 && p.x < C.WIDTH - 8 && p.y > 8 && p.y < C.HEIGHT - 8) &&
    g0.circle.center.x - g0.circle.radius > 0 && g0.circle.center.y + g0.circle.radius < C.HEIGHT);
}
check("the three checkboxes start unticked, as in CrowdedChairPanel",
  !opening.showNames && !opening.showStatement && !opening.showHint);
check("an untouched picture has no result", C.result(opening) === null);
equal("legal moves are three corners, three checkboxes and reset", C.legalMoves(opening).length, 7);

/* -------------------------------------- 2. the geometry against the bytecode */

{
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const p = { x: R() * 440, y: R() * 360 };
    const q = { x: R() * 440, y: R() * 360 };
    const a = (R() - 0.5) * 3, d = R() < 0.5 ? -1 : 1;
    const x = C.rotate(p, q, a, d), y = appletRotate(p, q, a, d);
    worst = Math.max(worst, Math.abs(x.x - y.x), Math.abs(x.y - y.y));
  }
  check("Rotate agrees with the bytecode for 500 angle/direction pairs", worst < 1e-10);
}
{
  let worst = 0;
  for (const t of triangles) {
    const a = C.circumcenter(t.A, t.B, t.C), b = appletCircumcenter(t.A, t.B, t.C);
    if (!ok(a) || !ok(b)) continue;
    worst = Math.max(worst, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  check("circumcentres agree for every triangle in the sample", worst < 1e-8);
}
{
  let worst = 0, tested = 0;
  for (const angle of [5, 10, 18, 25, 30, 37, 40, 50, 60, 70, 80, 88]) {
    for (const [ax, ay, bx, by] of [[60, 200, 300, 200], [100, 60, 340, 90], [90, 300, 350, 250]]) {
      const A = { x: ax, y: ay }, B = { x: bx, y: by }, ang = angle * Math.PI / 180;
      const x = C.computeC(A, B, ang), y = appletComputeC(A, B, ang);
      if (!ok(x) || !ok(y)) continue;
      tested++;
      worst = Math.max(worst, Math.abs(x.x - y.x), Math.abs(x.y - y.y));
    }
  }
  check(`ComputeC agrees with the bytecode for all ${tested} non-parallel starting angles`, worst < 1e-8);
}
{
  const names = ["K", "H", "G", "F", "E", "D", "L", "M", "U", "V"];
  let worst = 0;
  check("the same triangles are non-degenerate in core and bytecode",
    geometries.length === appletGeometries.length && geometries.length > 3800);
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i], a = appletGeometries[i];
    for (const name of names) {
      worst = Math.max(worst, Math.abs(g[name].x - a[name].x), Math.abs(g[name].y - a[name].y));
    }
    worst = Math.max(worst, Math.abs(g.circle.center.x - a.circle.center.x),
      Math.abs(g.circle.center.y - a.circle.center.y), Math.abs(g.circle.radius - a.circle.radius));
  }
  check("every constructed point and the circle match the bytecode", worst < 1e-7);
}

/* ------------------------------------------------- 3. the page's claims */

{
  const worst = { perp: 0, concyclic: 0, diameters: 0, right: 0, secant: 0, labels: 0 };
  let swappedFailures = 0;
  for (const g of geometries) {
    const r = C.residuals({ A: g.A, B: g.B, C: g.C }, g);
    worst.perp = Math.max(worst.perp, r.perpAKCD, r.perpCEBF);
    worst.right = Math.max(worst.right, r.rightAtU, r.rightAtV);
    worst.concyclic = Math.max(worst.concyclic, r.onCircle);
    worst.diameters = Math.max(worst.diameters, r.squareCentre);
    worst.secant = Math.max(worst.secant, r.secants);
    // The page's sentence swaps U and V. Its printed product then pairs a
    // point on CE with one on CD, so it is not an identity: count the cases.
    if (r.secantsPageLabels > 1e-7) swappedFailures++;
    // The applet's U is CE ∩ BF; the page calls that point V.
    const line = (p, q, r0) => Math.abs(cross2(minus(q, p), minus(r0, p))) / (length(p, q) * length(p, r0) || 1);
    worst.labels = Math.max(worst.labels,
      line(g.U, g.E, g.C), line(g.U, g.F, g.B),
      line(g.V, g.C, g.D), line(g.V, g.A, g.K));
  }
  check("AK ⟂ CD and CE ⟂ BF in every one of the sampled triangles", worst.perp < 1e-7);
  check("right angles at the applet's U (UE ⊥ UB) and V (VA ⊥ VD)", worst.right < 1e-7);
  check("A, B, D, E, U and V all lie on the circle C(ABDE)", worst.concyclic < 1e-7);
  check("AD and BE are diameters: their midpoints are the circle's centre", worst.diameters < 1e-7);
  check("CE·CU = CD·CV (Intersecting Secants) in every triangle", worst.secant < 1e-7);
  check(`the page's swapped U/V labels make the printed product fail in ${swappedFailures}/${geometries.length} triangles`,
    swappedFailures > geometries.length * 0.95);
  check("the applet's U is CE ∩ BF and its V is CD ∩ AK, the reverse of the page's sentence", worst.labels < 1e-7);
}

/* ------------------------------------------------- 4. drags and the demo end */

{
  const stream = rng(40404);
  let s = C.start();
  let worst = 0, steps = 0, rejected = 0;
  for (let i = 0; i < 400; i++) {
    const name = C.NAMES[i % 3];
    const target = {
      x: 20 + stream() * 400,
      y: 20 + stream() * 320,
    };
    const m = { type: "point", name, point: target };
    const next = C.move(s, m);
    const ref = appletUpgrade(s, name, target);
    if (!next || !ref) {
      check(`rejected drag ${i} is rejected by the bytecode too`, !next === !ref);
      rejected++;
      continue;
    }
    worst = Math.max(worst,
      Math.abs(next.A.x - ref.A.x), Math.abs(next.A.y - ref.A.y),
      Math.abs(next.B.x - ref.B.x), Math.abs(next.B.y - ref.B.y),
      Math.abs(next.C.x - ref.C.x), Math.abs(next.C.y - ref.C.y),
      Math.abs(next.angleA - ref.angleA));
    s = next;
    steps++;
  }
  check(`400 drags: ${steps} accepted moves match the applet's UpgradePoints`, worst < 1e-7);
  const nudge = { x: opening.A.x + 3, y: opening.A.y + 2 };
  const dragged = C.move(opening, { type: "point", name: "A", point: nudge });
  check("the first drag swaps A and B when FindOrientation is 1, as UpgradePoints does",
    !!dragged && C.dist(dragged.B, nudge) < 1e-9 && C.dist(dragged.A, opening.B) < 1e-9);
}
{
  // Dragging C on its circle keeps the angle at C fixed (same chord AB).
  let s = C.start();
  const g = C.compute(s);
  const angleAtC = C.computeAngle(s.C, s.A, s.B);
  let worst = 0, count = 0;
  const base = Math.atan2(s.C.y - g.circle.center.y, s.C.x - g.circle.center.x);
  for (let i = 0; i < 72; i++) {
    // Stay on the arc containing the opening C; on the far arc the inscribed
    // angle is the supplement, which is a different claim.
    const t = base + (i / 72 - 0.5) * 1.2;
    const target = {
      x: g.circle.center.x + g.circle.radius * 1.3 * Math.cos(t),
      y: g.circle.center.y + g.circle.radius * 1.3 * Math.sin(t),
    };
    const next = C.move(s, { type: "point", name: "C", point: target });
    if (!next) continue;
    count++;
    worst = Math.max(worst, Math.abs(C.computeAngle(next.C, next.A, next.B) - angleAtC));
    s = next;
  }
  check(`dragging C around ${count} positions on its circle preserves the angle at C`, count > 60 && worst < 1e-7);
}
{
  let s = C.start();
  check("no move is made with an invalid point name or a non-finite point",
    C.move(s, { type: "point", name: "X", point: { x: 1, y: 2 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: NaN, y: 2 } }) === null);
  check("a corner cannot be dropped on top of another",
    C.move(s, { type: "point", name: "A", point: s.B }) === null);
  check("unknown options and malformed moves are refused",
    C.move(s, { type: "option", key: "nope", value: true }) === null &&
    C.move(s, { type: "option", key: "showHint", value: "yes" }) === null &&
    C.move(s, { type: "unknown" }) === null);
  s = C.move(s, { type: "option", key: "showHint", value: true });
  check("ticking a box records a play that is 'done', never win or lose",
    s.showHint === true && C.result(s) === "done" && s.moves === 1);
  const reset = C.move(s, { type: "reset" });
  check("reset restores the opening corners and angle but keeps the ticked boxes",
    close(reset.A, opening.A) && close(reset.B, opening.B) && close(reset.C, opening.C) &&
    Math.abs(reset.angleA - C.START_ANGLE) < 1e-12 &&
    reset.showHint === true && C.result(reset) === "done");
}

done("crowded-chair");
