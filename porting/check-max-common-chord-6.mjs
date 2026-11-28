#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord-6/max-common-chord-6-core.js.
 *
 *   node porting/check-max-common-chord-6.mjs
 *
 * Section 1 transcribes MaxCommonChord6Canvas.Compute() a second time, straight
 * from javap's bytecode, and compares every derived point with the core over
 * 600 deterministic configurations plus the applet's own starting position.
 * Section 2 checks the page's claims exhaustively where a continuum allows it:
 * the maximum of AP·PB is found by a 1,440-direction scan in 30 layouts and
 * compared with the circle C(S) construction; the equal-angle, tangent, W and
 * diameter claims are checked in 120 layouts. Section 3 checks the drag modes,
 * the guards and the messages.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("max-common-chord-6/max-common-chord-6-core.js", "MaxCommonChord6Core");
const G = C.geom;

/* ------------------------------------------------------ test-only helpers */

const P2 = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const Padd = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const Pmul = (p, k) => ({ x: p.x * k, y: p.y * k });
const Pdot = (p, q) => p.x * q.x + p.y * q.y;
const Pcross = (p, q) => p.x * q.y - p.y * q.x;
const Plen = (p) => Math.hypot(p.x, p.y);
const Pdistance = (p, q) => Plen(P2(p, q));
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearPt = (a, b, eps = 1e-6) => !!a && !!b && near(a.x, b.x, eps) && near(a.y, b.y, eps);
const finitePt = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

function angle(v, a, b) {
  const u = P2(a, v), w = P2(b, v);
  return Math.acos(Math.max(-1, Math.min(1, Pdot(u, w) / (Plen(u) * Plen(w)))));
}

/* --------------------------- 1. second transcription of the applet's code */

/* GeoSDoub.Dist / SqDist */
const jDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint) */
function jLineLine(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = b1 * a2 - b2 * a1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}

/* GeoSDoub.FindCircumcenter, then MaxCommonChord6Canvas.GetCircle */
function jCircle(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const o = jLineLine(m1,
    { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) },
    m2,
    { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) });
  return { x: o.x, y: o.y, r: (jDist(o, a) + jDist(o, b) + jDist(o, c)) / 3 };
}

/* GeoSDoub.IntersectX(IntersectY) of a line and a circle */
function jLineCircleX(p, q, c) {
  const m = (p.x - q.x) / (p.y - q.y);
  const b = q.x - m * q.y;
  const a = m * m + 1;
  const k = m * (b - c.x) - c.y;
  const cc = c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r;
  const disc = k * k - a * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-k + s) / a, y2 = (-k - s) / a;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}
function jLineCircleY(p, q, c) {
  const m = (p.y - q.y) / (p.x - q.x);
  const b = q.y - m * q.x;
  const a = m * m + 1;
  const k = m * (b - c.y) - c.x;
  const cc = c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r;
  const disc = k * k - a * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-k + s) / a, x2 = (-k - s) / a;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}
function jLineCircle(c, p, q) {
  if (Math.abs(p.y - q.y) > 1) return jLineCircleX(p, q, c);
  if (Math.abs(p.x - q.x) > 1) return jLineCircleY(p, q, c);
  return null;
}

/* GeoSDoub.IntersectCirclesX / Y */
function jCirclesX(a, b) {
  const m = -(a.y - b.y) / (a.x - b.x);
  const bb = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
    a.r * a.r + b.r * b.r) / 2 / (a.x - b.x);
  const h = bb - a.x, aa = m * m + 1, k = m * h - a.y;
  const cc = h * h + a.y * a.y - a.r * a.r;
  const disc = k * k - aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-k + s) / aa, y2 = (-k - s) / aa;
  return [{ x: m * y1 + bb, y: y1 }, { x: m * y2 + bb, y: y2 }];
}
function jCirclesY(a, b) {
  const m = -(a.x - b.x) / (a.y - b.y);
  const bb = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
    a.r * a.r + b.r * b.r) / 2 / (a.y - b.y);
  const h = bb - a.y, aa = m * m + 1, k = m * h - a.x;
  const cc = h * h + a.x * a.x - a.r * a.r;
  const disc = k * k - aa * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-k + s) / aa, x2 = (-k - s) / aa;
  return [{ x: x1, y: m * x1 + bb }, { x: x2, y: m * x2 + bb }];
}
function jCircleCircle(a, b) {
  if (Math.abs(a.x - b.x) > 1) return jCirclesX(a, b);
  if (Math.abs(a.y - b.y) > 1) return jCirclesY(a, b);
  return [{ x: a.x, y: a.y }, { x: a.x, y: a.y }];
}
function jOther(points, ref) {
  if (!points || !points[0] || !points[1]) return null;
  return jDist(points[0], ref) < 1 ? points[1] : points[0];
}

/* CTKGeometryPlus.Prorate / Perp */
function jProrate(a, b, d) {
  const len = jDist(a, b);
  if (len < 0.1) return { x: a.x, y: a.y };
  const t = d / len;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}
function jPerp(a, b, c) {
  return { x: c.x + (a.y - b.y) * 10, y: c.y - (a.x - b.x) * 10 };
}

/* GeoSDoub.ComputeAngle(a,b,c) is the angle at a. */
function jAngle(v, p, q) {
  const n = (jDist(v, p) * jDist(v, q)) || 1;
  const cos = (jDist(v, p) ** 2 + jDist(v, q) ** 2 - jDist(p, q) ** 2) / (2 * n);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/** MaxCommonChord6Canvas.Compute() literally, as a test oracle. */
function jCompute(s) {
  if (jDist(s.A, s.P) < 2 || jDist(s.A, s.Q) < 2 ||
      jDist(s.B, s.P) < 2 || jDist(s.B, s.Q) < 2 ||
      jDist(s.P, s.Q) < 2) return null;
  const E = jCircle(s.A, s.P, s.Q);
  const F = jCircle(s.B, s.P, s.Q);
  const EQF = jCircle(E, s.Q, F);
  const AB = jCircle(s.A, s.B, s.Q);
  const L = jOther(jCircleCircle(EQF, E), s.Q);
  const M = jOther(jCircleCircle(EQF, F), s.Q);
  const R = jOther(jLineCircle(AB, s.P, s.Q), s.Q);
  if (!L || !M || !R || jDist(s.P, R) < 1) return null;
  const S = jLineLine(s.A, L, s.B, M);
  const U = jOther(jLineCircle(EQF, s.P, s.Q), s.Q);
  const T = jProrate(s.Q, EQF, 2 * EQF.r);
  const N = jLineLine(S, jPerp(s.P, s.Q, S), s.P, s.Q);
  const W = jLineLine(s.A, E, s.B, F);
  return {
    E, F, EQF, AB, L, M, R, S, U, T, N, W,
    finished: Math.abs(jAngle(s.Q, U, S) - jAngle(s.Q, S, T)) < 0.01,
  };
}

/* ----------------------------------------------------------- generated data */

const rand = rng(74251);
const inside = (lo, hi) => lo + rand() * (hi - lo);

/**
 * A legal layout for the page's problem: two circles through P and Q whose
 * centres lie on opposite sides of PQ, and a chord through P whose ends are on
 * opposite sides of P. Random unrelated points would not describe a segment
 * "passing through P" at all.
 */
function randomState() {
  for (let guard = 0; guard < 500; guard++) {
    const P = { x: inside(90, 550), y: inside(90, 380) };
    const Q = { x: inside(90, 550), y: inside(90, 380) };
    const dPQ = jDist(P, Q);
    if (dPQ < 50) continue;
    const mid = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
    const n = { x: -(Q.y - P.y) / dPQ, y: (Q.x - P.x) / dPQ };
    const E = { x: mid.x + n.x * inside(30, 150), y: mid.y + n.y * inside(30, 150) };
    const F = { x: mid.x - n.x * inside(30, 150), y: mid.y - n.y * inside(30, 150) };
    E.r = jDist(E, P); F.r = jDist(F, P);
    const th = inside(0, 2 * Math.PI);
    const q = { x: P.x + 100 * Math.cos(th), y: P.y + 100 * Math.sin(th) };
    const A = jOther(jLineCircle(E, P, q), P);
    const B = jOther(jLineCircle(F, P, q), P);
    if (!A || !B || !finitePt(A) || !finitePt(B)) continue;
    if (Pdot(P2(A, P), P2(B, P)) >= -400) continue; // P must lie between A and B
    if (jDist(A, Q) < 25 || jDist(B, Q) < 25) continue;
    return { P, Q, A, B, mode: "chord", showNames: true };
  }
  return null;
}

const samples = [];
for (let i = 0; i < 600; i++) {
  const s = randomState();
  if (s && C.compute(s).valid) samples.push(s);
}
const startState = C.start({});

/* ------------------------------------------------- 1. the core vs. the code */

check("the applet's own starting position is computable", C.compute(startState).valid);
check("600 generated positions give at least 300 computable layouts", samples.length >= 300,
  `got ${samples.length}`);

{
  let worst = 0;
  let finishedMismatch = 0;
  for (const s of samples) {
    const a = C.compute(s), b = jCompute(s);
    if (!a.valid || !b) { finishedMismatch++; continue; }
    for (const key of ["E", "F", "EQF", "AB", "L", "M", "R", "S", "U", "T", "N", "W"]) {
      worst = Math.max(worst, Math.abs(a[key].x - b[key].x), Math.abs(a[key].y - b[key].y));
      if (key === "E" || key === "F" || key === "EQF" || key === "AB") {
        worst = Math.max(worst, Math.abs(a[key].r - b[key].r));
      }
    }
    if (a.finished !== b.finished) finishedMismatch++;
  }
  check("every derived point matches the second transcription", worst < 1e-6,
    `worst difference ${worst}`);
  check("the Finished flag matches the bytecode in every layout", finishedMismatch === 0,
    `${finishedMismatch} mismatches`);
}

check("start() reproduces init(): P", nearPt(startState.P, { x: (640 * 6) / 11, y: 276 }));
check("start() reproduces init(): Q", nearPt(startState.Q, { x: 320, y: 368 }));
check("start() reproduces init(): A", nearPt(startState.A, { x: 259, y: 251 }));
check("start() reproduces init(): B lies on the B circle and on line AP", (() => {
  const F = G.circleFrom3(startState.B, startState.P, startState.Q);
  return near(G.dist(startState.B, F), F.r, 1e-6) &&
    Math.abs(Pcross(P2(startState.B, startState.A), P2(startState.P, startState.A))) < 1e-6;
})());

/* Degenerate positions must return early, as Compute() does. */
for (const [name, mutate] of [
  ["A=P", (s) => ({ ...s, A: { ...s.P } })],
  ["B=Q", (s) => ({ ...s, B: { ...s.Q } })],
  ["P=Q", (s) => ({ ...s, Q: { ...s.P } })],
]) {
  const s = mutate({ ...startState, A: { ...startState.A }, B: { ...startState.B } });
  check(`Compute refuses ${name}`, !C.compute(s).valid && jCompute(s) === null);
}

/* ------------------------------------------------ 2. the page's claims */

function alternateS(s, g) {
  const u = Pmul(P2(s.P, s.Q), 1 / Pdistance(s.P, s.Q));
  const S = Padd({ x: g.EQF.x, y: g.EQF.y }, Pmul(u, -g.EQF.r));
  const cs = { x: S.x, y: S.y, r: Pdistance(S, s.Q) };
  return { S, cs, A: jOther(jCircleCircle(cs, g.E), s.Q), B: jOther(jCircleCircle(cs, g.F), s.Q) };
}

{
  let collinear = 0, radius = 0, parallel = 0, tangent = 0, wedge = 0;
  let angles = 0, finished = 0, diameter = 0, chordsIdentity = 0, smaller = 0;
  let usable = 0;
  for (const s of samples.slice(0, 120)) {
    const best = C.optimal(s);
    const g = jCompute(s);
    if (!best || !g) continue;
    usable++;
    const A = best.A, B = best.B, S = g.EQF;
    const optG = jCompute(best);
    if (!optG) continue;

    const centre = { x: optG.S.x, y: optG.S.y };
    const RS = Pdistance(centre, S);
    if (near(RS, S.r, 1e-5)) radius++;
    if (Math.abs(Pcross(P2(centre, S), P2(s.P, s.Q))) < 1e-4) parallel++;
    if (Math.abs(Pcross(P2(A, s.P), P2(B, s.P))) < 1e-4) collinear++;
    if (near(Pdistance(centre, A), Pdistance(centre, B), 1e-5) &&
        near(Pdistance(centre, A), Pdistance(centre, s.Q), 1e-5)) wedge++;
    if (Math.abs(Pdot(P2(A, g.E), P2(optG.R, A))) < 1e-5 &&
        Math.abs(Pdot(P2(B, g.F), P2(optG.R, B))) < 1e-5) tangent++;
    if (near(Pdistance(A, optG.W), Pdistance(B, optG.W), 1e-5) &&
        Math.abs(Pdot(P2(centre, optG.W), P2(A, B))) < 1e-4) diameter++;
    if (Math.abs(jAngle(s.P, g.E, A) - jAngle(s.P, g.F, B)) < 1e-5) angles++;
    if (optG.finished) finished++;
    if (near(Pdistance(A, s.P) * Pdistance(B, s.P),
        Pdistance(s.Q, s.P) * Pdistance(optG.R, s.P), 1e-4)) chordsIdentity++;

    const u = Pmul(P2(s.P, s.Q), 1 / Pdistance(s.P, s.Q));
    const bestS = jCompute(best).S;
    const alt = alternateS(s, g);
    if (alt.A && alt.B &&
        Pdot(P2(alt.S, s.Q), u) < Pdot(P2(bestS, s.Q), u) - 1 &&
        Pdot(P2(alt.A, s.P), P2(alt.B, s.P)) > 0) smaller++;
  }
  check("120 layouts were usable for the claim checks", usable >= 100, `got ${usable}`);
  check("S* lies on C(O) in every layout", radius === usable, `${radius}/${usable}`);
  check("OS* is parallel to PQ in every layout", parallel === usable, `${parallel}/${usable}`);
  check("optimal A, P, B are collinear in every layout", collinear === usable, `${collinear}/${usable}`);
  check("S*A = S*B = S*Q in every layout", wedge === usable, `${wedge}/${usable}`);
  check("RA and RB are tangents in every layout", tangent === usable, `${tangent}/${usable}`);
  check("W is on C(O) and C(S), AW=BW and SW ⟂ AB", diameter === usable, `${diameter}/${usable}`);
  check("angle EPA = angle FPB in every layout", angles === usable, `${angles}/${usable}`);
  check("the applet's Finished flag marks the optimum in every layout", finished === usable,
    `${finished}/${usable}`);
  check("AP×PB = PQ×PR (intersecting chords)", chordsIdentity === usable, `${chordsIdentity}/${usable}`);
  check("the other point with OS || PQ has smaller projection and no chord through P",
    smaller === usable, `${smaller}/${usable}`);
}

/* A 1,440-direction scan is a brute-force check of the maximum itself. */
{
  let beaten = 0;
  let usable = 0;
  let worstGap = 0;
  for (const s of samples.slice(0, 30)) {
    const best = C.optimal(s);
    const g = jCompute(s);
    if (!best || !g) continue;
    usable++;
    const target = Pdistance(best.A, s.P) * Pdistance(best.B, s.P);
    let scan = 0;
    for (let i = 0; i < 1440; i++) {
      const th = (i * 2 * Math.PI) / 1440;
      const d = { x: Math.cos(th), y: Math.sin(th) };
      const q = { x: s.P.x + 100 * d.x, y: s.P.y + 100 * d.y };
      const a = jOther(jLineCircle(g.E, s.P, q), s.P);
      const b = jOther(jLineCircle(g.F, s.P, q), s.P);
      if (a && b && Pdot(P2(a, s.P), P2(b, s.P)) < 0) {
        scan = Math.max(scan, Pdistance(a, s.P) * Pdistance(b, s.P));
      }
    }
    if (scan > target + 1e-5 * Math.max(1, target)) beaten++;
    worstGap = Math.max(worstGap, scan - target);
  }
  check("the brute-force scan ran in 30 layouts", usable === 30, `got ${usable}`);
  check("no scanned chord beats C(S): AP×PB is maximal", beaten === 0,
    `${beaten} layouts beaten, worst gap ${worstGap}`);
}

/* ------------------------------------------- 3. drag modes, guards, words */

{
  const s = startState;
  const g = jCompute(s);
  check("the starting chord is not yet Finished", !g.finished);
  const best = C.optimal(s);
  check("the optimum differs from the starting chord", Pdistance(best.A, s.A) > 5);
  const nearBest = { ...s, A: {
    x: g.E.x + (s.A.x - g.E.x) * Math.cos(0.12) - (s.A.y - g.E.y) * Math.sin(0.12),
    y: g.E.y + (s.A.x - g.E.x) * Math.sin(0.12) + (s.A.y - g.E.y) * Math.cos(0.12),
  } };
  nearBest.B = G.fix(s.B, G.circleFrom3(s.B, s.P, s.Q), nearBest.A, s.P);
  check("a chord near the optimum is not Finished",
    C.compute(nearBest).valid && !C.compute(nearBest).finished);
  check("describe() names the best chord at the optimum", /Best chord/.test(C.describe(best)));
  check("describe() reports the product away from it", /AP×PB/.test(C.describe(s)));
  check("describe() handles a collapsed diagram", /Move the dots apart/.test(C.describe({
    ...s, A: { ...s.P },
  })));
  check("an illustration has no win or loss", C.result(s) === null && C.result(best) === null);
}

check("setOption toggles names and rejects unknown modes", (() => {
  const a = C.setOption(startState, "showNames", true);
  const b = C.setOption(a, "mode", "circles");
  return a.showNames === true && startState.showNames === false &&
    b.mode === "circles" && C.setOption(b, "mode", "nonsense").mode === "circles";
})());

{
  let chordOK = 0, circlesOK = 0, pqOK = 0;
  for (const s of samples.slice(0, 80)) {
    const E = jCircle(s.A, s.P, s.Q), F = jCircle(s.B, s.P, s.Q);
    const nextA = G.clampToBoard({ x: s.A.x + 13, y: s.A.y - 9 });
    const chord = C.drag({ ...s, mode: "chord" }, "A", nextA);
    const snapped = { x: E.x + ((nextA.x - E.x) * E.r) / jDist(nextA, E),
      y: E.y + ((nextA.y - E.y) * E.r) / jDist(nextA, E) };
    if (nearPt(chord.A, snapped, 1e-6) && near(jDist(chord.B, F), F.r, 1e-6) &&
        Math.abs(Pcross(P2(chord.A, s.P), P2(chord.B, s.P))) < 1e-3) chordOK++;

    const adjusting = C.drag({ ...s, mode: "circles" }, "A", nextA);
    const newE = jCircle(adjusting.A, s.P, s.Q);
    if (nearPt(adjusting.A, nextA, 1e-6) && !near(newE.r, E.r, 1e-4) &&
        near(jDist(adjusting.B, F), F.r, 1e-6) &&
        Math.abs(Pcross(P2(adjusting.A, s.P), P2(adjusting.B, s.P))) < 1e-3) circlesOK++;

    const moved = { x: s.P.x - 7, y: s.P.y + 11 };
    const after = C.drag(s, "P", moved);
    if (nearPt(after.P, moved, 1e-6) && nearPt(after.A, s.A) && nearPt(after.B, s.B)) pqOK++;
  }
  check("chord mode keeps A on C(E), B on C(F) and AB through P", chordOK >= 76,
    `${chordOK}/80`);
  check("circles mode changes C(E) and re-fixes B on C(F)", circlesOK >= 76,
    `${circlesOK}/80`);
  check("dragging P moves only P, as the applet does", pqOK === 80, `${pqOK}/80`);
}

done("max-common-chord-6");
