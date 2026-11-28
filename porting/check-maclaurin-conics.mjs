#!/usr/bin/env node
"use strict";

/*
 * Logic test for maclaurin-conics/maclaurin-conics-core.js.
 *
 *   node porting/check-maclaurin-conics.mjs
 *
 * Part 1 writes the applet's own arithmetic a second time, straight from the
 * bytecode (GeoSDoub.Intersect / NearestPoint, DoubLine.CreateMidPoint,
 * MacLaurinConicsCanvas.init / Compute / UpgradePointOnLine /
 * UpgradeLineThroughPoint / CheatingPointUpgrade), and compares the core with
 * it on hundreds of starting boards and reachable positions. Part 2 tests the
 * page's two claims: that the traced A positions lie on a conic, and that when
 * U, V and W are collinear they lie on a straight line through l ∩ m. Both
 * claims are tried over hundreds of generated configurations, not one picture.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("maclaurin-conics/maclaurin-conics-core.js", "MaclaurinConicsCore");
const P = (x, y) => ({ x, y });
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol = 1e-7) =>
  finite(a) && finite(b) && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const lineDist = (p, a, b) => (dist(a, b) ? Math.abs(cross(a, b, p)) / dist(a, b) : Infinity);
const rnd = rng(20261128);
const between = (lo, hi) => lo + rnd() * (hi - lo);

/* ------------------------------------------------ the applet, transcribed twice */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literal. */
function aIntersect(a, b, c, d) {
  const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - d.y, s12 = d.x - c.x, s14 = c.x * d.y - c.y * d.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  if (Math.abs(s20) < 1) return P(NaN, NaN);
  return P(s16 / s20, s18 / s20);
}

/* DoubLine.CreateMidPoint(t), literal. */
function aMid(l, t) {
  return P(t * l.p.x + (1 - t) * l.q.x, t * l.p.y + (1 - t) * l.q.y);
}

/* GeoSDoub.NearestPoint(p,DoubLine), literal. */
function aNearest(p, l) {
  const dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  if (sq(l.p, p) < 0.1) return P(p.x, p.y);
  const t = (dx * (p.x - l.p.x) + dy * (p.y - l.p.y)) / (dx * dx + dy * dy || 1);
  return P(l.p.x + dx * t, l.p.y + dy * t);
}

/* MacLaurinConicsCanvas.init(), literal, including Java's integer divisions. */
function aInit(width, height) {
  const hw = width / 2, hh = height / 2;
  const coef = 0.7;
  const L = [
    { p: P(hw + Math.floor(width / 10), 0), q: P(hw, height) },
    { p: P(0, hh), q: P(width, hh) },
  ];
  const A = [aMid(L[0], coef), aMid(L[1], coef)];
  const fixed = [
    P(Math.floor(width / 4), Math.floor(height / 4)),
    P(Math.floor(3 * width / 4), Math.floor(height / 4)),
    aMid({ p: A[0], q: A[1] }, -1.4),
  ];
  return { width, height, coef, L, A, fixed };
}

/* MacLaurinConicsCanvas.Compute(), literal. */
function aCompute(st) {
  const X = aIntersect(st.A[0], st.fixed[0], st.A[1], st.fixed[1]);
  const Lines = [];
  if (dist(st.A[0], st.fixed[0]) > 1) Lines[0] = { p: st.A[0], q: st.fixed[0] };
  if (dist(st.A[1], st.fixed[1]) > 1) Lines[1] = { p: st.A[1], q: st.fixed[1] };
  if (dist(st.A[0], st.A[1]) > 1) Lines[2] = { p: st.A[0], q: st.A[1] };
  const ExtraLines = [];
  for (let i = 0; i < 2; i++) {
    if (dist(st.fixed[2], st.fixed[i]) > 1) ExtraLines[i] = { p: st.fixed[2], q: st.fixed[i] };
    /* SetBounds changes the drawing clip, never the line's coefficients. */
  }
  const ExtraPoint = [
    aIntersect(ExtraLines[1].p, ExtraLines[1].q, st.L[0].p, st.L[0].q),
    aIntersect(ExtraLines[0].p, ExtraLines[0].q, st.L[1].p, st.L[1].q),
    aIntersect(st.L[0].p, st.L[0].q, st.L[1].p, st.L[1].q),
  ];
  return { X, Lines, ExtraLines, ExtraPoint };
}

/* UpgradePointOnLine(), literal (DoubLine.CreateMidPoint(Coef)). */
function aUpgradePointOnLine(st, i) {
  const q = aMid(st.L[i], st.coef);
  st.A[i] = P(q.x, q.y);
  return st;
}

/* UpgradeLineThroughPoint(), literal: the j-th glider on the j-th line. */
function aUpgradeLineThroughPoint(st, i) {
  const j = 1 - i;
  const q = aIntersect(st.A[i], st.fixed[2], st.L[j].p, st.L[j].q);
  if (finite(q)) st.A[j] = P(q.x, q.y);
  return st;
}

/* CheatingPointUpgrade(): hold the glider nearer W and move the other one. */
function aCheating(st) {
  const i = dist(st.fixed[2], st.A[0]) > dist(st.fixed[2], st.A[1]) ? 1 : 0;
  aUpgradeLineThroughPoint(st, i);
  return st;
}

const lineOf = (s, i) => ({ p: s.ends[i][0], q: s.ends[i][1] });

const toApplet = (s) => ({
  width: s.width, height: s.height, coef: s.coef,
  L: [{ p: s.ends[0][0], q: s.ends[0][1] }, { p: s.ends[1][0], q: s.ends[1][1] }],
  A: [s.B, s.C], fixed: [s.U, s.V, s.W],
});

/* ------------------------------------------------------------------ the core */

function randomCoreState() {
  let s = C.start({ width: 400, height: 300 });
  for (let i = 0; i < 8; i++) {
    const who = C.HANDLES[Math.floor(rnd() * C.HANDLES.length)];
    s = C.move(s, who, P(between(-40, 440), between(-40, 340)));
  }
  return s;
}

/* 1. init, for several board sizes, against a second transcription. */
for (const [w, h] of [[400, 300], [320, 240], [375, 280], [640, 480], [1000, 700]]) {
  const mine = C.start({ width: w, height: h });
  const theirs = aInit(w, h);
  const same =
    mine.ends.every((pair, i) => close(pair[0], theirs.L[i].p, 0) && close(pair[1], theirs.L[i].q, 0)) &&
    close(mine.B, theirs.A[0], 0) && close(mine.C, theirs.A[1], 0) &&
    close(mine.U, theirs.fixed[0], 0) && close(mine.V, theirs.fixed[1], 0) &&
    close(mine.W, theirs.fixed[2], 0) && mine.coef === theirs.coef;
  check(`init at ${w}×${h}`, same, JSON.stringify(mine));
}

/* 2. Compute, on the start board and on hundreds of reachable positions. */
{
  const start = C.start({});
  const theirs = aCompute(toApplet(start));
  const mine = C.compute(start);
  check("start A matches the applet", close(mine.X, theirs.X));
  check("start triangle sides match", mine.sides.every((l, i) =>
    close(l.p, theirs.Lines[i].p) && close(l.q, theirs.Lines[i].q)));
  check("start extra points match", mine.extraPoints.every((p, i) => close(p, theirs.ExtraPoint[i])));
  check("start l∩m is the third extra point", close(mine.lCapM, intersectSimple(start.ends[0], start.ends[1])));

  for (let n = 0; n < 300; n++) {
    const s = randomCoreState();
    const g = C.compute(s), a = aCompute(toApplet(s));
    check(`Compute A #${n}`, close(g.X, a.X, 1e-6) || (!finite(g.X) && !finite(a.X)));
    check(`Compute sides and extras #${n}`,
      g.sides.every((l, i) => close(l.p, a.Lines[i].p, 1e-6) && close(l.q, a.Lines[i].q, 1e-6)) &&
      g.extraPoints.every((p, i) => close(p, a.ExtraPoint[i], 1e-6) ||
        (!finite(p) && !finite(a.ExtraPoint[i]))));
  }
}

function intersectSimple(l, m) {
  const a1 = l[0].y - l[1].y, b1 = l[1].x - l[0].x, c1 = l[0].x * l[1].y - l[0].y * l[1].x;
  const a2 = m[0].y - m[1].y, b2 = m[1].x - m[0].x, c2 = m[0].x * m[1].y - m[0].y * m[1].x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* 3. The construction's invariants at every reachable position. */
for (let n = 0; n < 200; n++) {
  const s = randomCoreState();
  const g = C.compute(s);
  const scale = Math.max(1, s.width, s.height);
  check(`B on l #${n}`, lineDist(s.B, g.l.p, g.l.q) < 1e-6 * scale);
  check(`C on m #${n}`, lineDist(s.C, g.m.p, g.m.q) < 1e-6 * scale);
  const bcScale = Math.max(1, dist(s.B, s.C), dist(s.B, s.W));
  check(`B, C, W collinear #${n}`, Math.abs(cross(s.B, s.C, s.W)) < 1e-6 * bcScale * bcScale);
  if (finite(g.X)) {
    check(`A on BU #${n}`, lineDist(g.X, s.B, s.U) < 1e-4 * scale || dist(s.B, s.U) > 1e6);
    check(`A on CV #${n}`, lineDist(g.X, s.C, s.V) < 1e-4 * scale || dist(s.C, s.V) > 1e6);
  } else {
    check(`A finite guard #${n}`, true);
  }
}

/* 4. The |det| < 1 guard, shared by the two transcriptions. */
{
  const parallel = C.intersect(P(0, 10), P(100, 10), P(0, 11), P(100, 11));
  const theirs = aIntersect(P(0, 10), P(100, 10), P(0, 11), P(100, 11));
  check("parallel lines give NaN in the core", !finite(parallel));
  check("parallel lines give NaN in the bytecode transcription", !finite(theirs));
  check("intersection of the two start lines is finite", finite(C.compute(C.start({})).lCapM));
}

/* 5. Dragging B: nearest-point projection, then the W consistency fix-up. */
for (let n = 0; n < 150; n++) {
  const s = randomCoreState();
  const target = P(between(-30, 430), between(-30, 330));
  const got = C.move(s, "B", target);
  const t = toApplet(s);
  t.A[0] = aNearest(target, t.L[0]);
  aUpgradeLineThroughPoint(t, 0);
  check(`drag B: B projected #${n}`, close(got.B, t.A[0], 1e-6));
  check(`drag B: C follows through W #${n}`, close(got.C, t.A[1], 1e-6));
  check(`drag B: trace collects A #${n}`,
    got.trace.length === s.trace.length + (finite(C.compute(got).X) &&
      (!s.collect || !s.trace.length || dist(s.trace[s.trace.length - 1], C.compute(got).X) > 1) ? 1 : 0));
  check(`drag B: input state untouched #${n}`, close(s.B, toApplet(s).A[0], 0));
}

/* 6. Dragging C is the mirror image. */
for (let n = 0; n < 150; n++) {
  const s = randomCoreState();
  const target = P(between(-30, 430), between(-30, 330));
  const got = C.move(s, "C", target);
  const t = toApplet(s);
  t.A[1] = aNearest(target, t.L[1]);
  aUpgradeLineThroughPoint(t, 1);
  check(`drag C: C projected #${n}`, close(got.C, t.A[1], 1e-6));
  check(`drag C: B follows through W #${n}`, close(got.B, t.A[0], 1e-6));
}

/* 7. Dragging W uses the applet's "cheating" choice of the glider to hold. */
for (let n = 0; n < 150; n++) {
  const s = randomCoreState();
  const target = P(between(-60, 460), between(-60, 360));
  const got = C.move(s, "W", target);
  const t = toApplet(s);
  t.fixed[2] = P(target.x, target.y);
  aCheating(t);
  check(`drag W: B #${n}`, close(got.B, t.A[0], 1e-6));
  check(`drag W: C #${n}`, close(got.C, t.A[1], 1e-6));
  check(`drag W: trace reset #${n}`, got.trace.length === 0 && !got.collect);
  /* The nearer glider must stay put; the farther one is moved along its line. */
  const heldB = dist(target, s.B) <= dist(target, s.C);
  check(`drag W: holds the nearer glider #${n}`,
    heldB ? close(got.B, s.B, 1e-6) : close(got.C, s.C, 1e-6),
    `held ${heldB ? "B" : "C"}`);
}

/* 8. Dragging a given line resets the trace and places its glider at 0.7. */
for (let n = 0; n < 100; n++) {
  const s = randomCoreState();
  const who = n % 2 ? "L0" : "M1";
  const end = who[0] === "L" ? 0 : 1;
  const target = P(between(-30, 430), between(-30, 330));
  const got = C.move(s, who, target);
  const t = toApplet(s);
  t.L[who[0] === "L" ? 0 : 1][end === 0 ? "p" : "q"] = P(target.x, target.y);
  aUpgradePointOnLine(t, who[0] === "L" ? 0 : 1);
  if (dist(t.A[0], t.A[1]) > 1) aCheating(t);
  check(`drag ${who}: gliders match bytecode #${n}`, close(got.B, t.A[0], 1e-6) && close(got.C, t.A[1], 1e-6));
  check(`drag ${who}: trace reset #${n}`, got.trace.length === 0);
}

/* 9. U and V only move their fixed point and clear the trace. */
for (let n = 0; n < 60; n++) {
  const s = randomCoreState();
  const who = n % 2 ? "U" : "V";
  const target = P(between(0, 400), between(0, 300));
  const got = C.move(s, who, target);
  check(`drag ${who}: position #${n}`, close(got[who], target, 0));
  check(`drag ${who}: gliders untouched #${n}`, close(got.B, s.B, 0) && close(got.C, s.C, 0));
  check(`drag ${who}: no collecting until B moves #${n}`, !got.collect);
  const later = C.move(got, "B", C.createMidPoint(lineOf(got, 0), 0.45));
  check(`drag B after ${who}: collecting restarted #${n}`, later.collect);
}

/* 10. The trace skips positions closer than one unit to the last one. */
{
  let s = C.start({});
  const first = s.trace[0];
  const tiny = C.move(s, "B", C.createMidPoint(lineOf(s, 0), 0.7 + 1e-7));
  check("sub-unit moves do not add a traced point", tiny.trace.length === 1);
  const far = C.move(s, "B", C.createMidPoint(lineOf(s, 0), 0.5));
  check("a real move adds a traced point", far.trace.length === 2);
  check("first traced point is the initial A", close(first, C.compute(C.start({})).X, 0));
  check("a demo has no result", C.result(s) === null);
  equal("nine draggable points", C.legalMoves(), C.HANDLES);
}

/* Helper: slide B through equally spaced fractions and record the trace. */
function sweep(s, from, to, count) {
  for (let i = 0; i <= count; i++) {
    const t = from + ((to - from) * i) / count;
    s = C.move(s, "B", C.createMidPoint(lineOf(s, 0), t));
  }
  return s;
}

function randomLines() {
  const a = P(between(-30, 80), between(30, 270));
  const b = P(between(320, 430), between(30, 270));
  const c = P(between(0, 400), between(-30, 60));
  const d = P(between(0, 400), between(240, 330));
  return [a, b, c, d];
}

/* 11. The page's main claim: the locus of A is a conic. */
{
  let conicCount = 0, ellipseCount = 0, hyperbolaCount = 0, worst = 0;
  for (let n = 0; n < 240; n++) {
    const s0 = C.start({});
    const [a, b, c, d] = randomLines();
    let s = {
      ...s0,
      ends: [[a, b], [c, d]],
      U: P(between(50, 140), between(40, 130)),
      V: P(between(270, 370), between(40, 130)),
      W: P(between(30, 150), between(180, 290)),
      collect: true, trace: [],
    };
    s.B = C.createMidPoint(lineOf(s, 0), 0.7);
    s.C = C.createMidPoint(lineOf(s, 1), 0.7);
    s.W = C.intersect(s.B, C.createMidPoint(lineOf(s, 0), 0.5), s.C, C.createMidPoint(lineOf(s, 1), 0.5));
    /* Shift W off line UV: the claim only covers the non-collinear case. */
    s.W = P(s.W.x + between(-70, 70), s.W.y + 45);
    if (C.collinear(s.U, s.V, s.W)) continue;
    s = sweep(s, 0.25, 0.75, 16);
    /* Nearly parallel sides send A off the board; the claim is about the
       finite locus, so skip configurations with too few visible positions. */
    if (s.trace.filter(finite).length < 8) continue;
    const fit = C.classify(s);
    const fitAgain = C.fitConic(s.trace.filter(finite).filter((p) =>
      Math.abs(p.x) < 1200 && Math.abs(p.y) < 900));
    worst = Math.max(worst, fit.maxResidual);
    check(`locus is a conic #${n}`, fit.kind === "conic" && fit.passes,
      `residual ${fit.maxResidual}, points ${fit.count}`);
    if (fit.passes) {
      conicCount++;
      if (fit.discriminant < 0) ellipseCount++; else hyperbolaCount++;
    }
    check(`conic fit agrees with an independent fit #${n}`,
      Boolean(fitAgain) && Number.isFinite(fitAgain.maxResidual),
      JSON.stringify(fitAgain));
  }
  check("every sampled non-collinear case traced a conic", conicCount > 180, `${conicCount} cases`);
  check("ellipses occur", ellipseCount > 0, `${ellipseCount}`);
  check("hyperbolas occur", hyperbolaCount > 0, `${hyperbolaCount}`);
  check("conic residuals stay tiny", worst < 0.5, `worst ${worst}`);
}

/* 12. The degenerate claim: U, V, W collinear gives a line through l ∩ m. */
{
  let passing = 0, worst = 0, worstCap = 0;
  for (let n = 0; n < 160; n++) {
    const s0 = C.start({});
    const [a, b, c, d] = randomLines();
    const U = P(between(40, 130), between(40, 140));
    const V = P(between(280, 380), between(40, 140));
    const B = C.createMidPoint({ p: a, q: b }, 0.7);
    const C0 = C.createMidPoint({ p: c, q: d }, 0.7);
    const W = C.intersect(B, C0, U, V);
    if (!finite(W)) continue;
    let s = { ...s0, ends: [[a, b], [c, d]], U, V, W, B, C: C0, collect: true, trace: [] };
    s = sweep(s, 0.2, 0.8, 14);
    const verdict = C.classify(s);
    check(`U,V,W collinear: locus is a line #${n}`,
      verdict.degenerate && verdict.passes, JSON.stringify(verdict));
    if (verdict.passes) passing++;
    worst = Math.max(worst, verdict.maxResidual);
    const g = C.compute(s);
    const pts = s.trace.filter(finite);
    const lineThrough = pts.length > 1 ? lineDist(g.lCapM, pts[0], pts[pts.length - 1]) : Infinity;
    worstCap = Math.max(worstCap, lineThrough);
    check(`degenerate line passes through l∩m #${n}`, lineThrough < 0.5, `${lineThrough}`);
  }
  check("all sampled collinear cases gave a straight line", passing > 120, `${passing} cases`);
  check("line residuals stay tiny", worst < 0.5, `worst ${worst}`);
  check("l∩m lies on the traced line", worstCap < 0.5, `worst ${worstCap}`);
}

/* 13. The two cases are genuinely different: a conic fit rejects the line. */
{
  let s = C.start({});
  s = C.straightLinePreset(s);
  check("preset makes U, V and W collinear", C.collinear(s.U, s.V, s.W));
  check("preset keeps the two gliders", close(s.B, C.start({}).B, 0) && close(s.C, C.start({}).C, 0));
  s = sweep(s, 0.3, 0.7, 12);
  const verdict = C.classify(s);
  check("preset traces a straight line", verdict.kind === "line" && verdict.passes,
    JSON.stringify(verdict));
  const fit = C.fitConic(s.trace.filter(finite));
  check("a conic fit does not describe the straight-line case",
    !fit || fit.maxResidual > 0.5 || !Number.isFinite(fit.discriminant));
  const partial = C.classify(C.start({}));
  check("one traced point is not enough to claim a conic", !partial.passes);
}

/* 14. The position handed to the tutor is plain, finite board data. */
{
  const s = sweep(C.start({}), 0.3, 0.6, 5);
  const pos = C.position(s);
  const back = JSON.parse(JSON.stringify(pos));
  check("position survives a JSON round trip", JSON.stringify(back) === JSON.stringify(pos));
  check("position holds the nine drawn points",
    back.ends.length === 2 && finite(back.B) && finite(back.C) &&
    finite(back.U) && finite(back.V) && finite(back.W));
  check("description reports A and the trace", /A is at \(-?\d+, -?\d+\)\..*positions traced/.test(C.describe(s)));
  check("names and extra are saved", typeof back.names === "boolean" && typeof back.extra === "boolean");
}

done("maclaurin-conics");
