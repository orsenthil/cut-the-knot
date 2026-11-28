#!/usr/bin/env node
"use strict";

/*
 * Logic test for mcgee/mcgee-core.js.
 *
 *   node porting/check-mcgee.mjs
 *
 * Section 1 checks the opening position and the moves (two circle handles,
 * the -200..200 length slider, four switches, reset) and the demo's "done".
 * Section 2 transcribes the applet's DoubCircle.Tangent, McGeeCanvas.Extend,
 * GeoSDoub.Intersect and McGeeCanvas.Compute a second time from the bytecode
 * and compares them with the core over a 48×48 grid of circle positions and
 * 41 slider values, plus 6,000 seeded random configurations. Section 3 checks
 * the page's claim and every step of its hint over the same configurations:
 * AB bisects PQ, S is the midpoint, AP = BQ = AR, TA = TB, TR = TQ, QR is
 * parallel to AB, A is the midpoint of PR, and the two tangent directions add
 * to a vector parallel to AB. The applet's |det| < 1 NaN guard and its pause
 * for short tangents / nearly coincident A and B are checked too.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("mcgee/mcgee-core.js", "McgeeCore");
const TWO_PI = 2 * Math.PI;

/* ------------------------------------------------------------- configuration */

const onCircle = (theta) => C.pointOnCircle(theta);
const lengths = [];
for (let L = -200; L <= 200; L += 10) lengths.push(L);
lengths.push(-2, 2, -1, 0, 1, 199, -199); // the guard's two boundaries and its dead band

const configurations = [];
for (let i = 0; i < 48; i++) {
  for (let j = 0; j < 48; j++) {
    for (const L of lengths) {
      configurations.push({ A: onCircle((i * TWO_PI) / 48), B: onCircle((j * TWO_PI) / 48), length: L });
    }
  }
}
const next = rng(6272);
for (let i = 0; i < 6000; i++) {
  configurations.push({
    A: onCircle(next() * TWO_PI),
    B: onCircle(next() * TWO_PI),
    length: Math.round(-200 + next() * 400),
  });
}

/* ----------------------------- a second transcription of the applet's methods */

const plus = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const minus = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const hypot = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

/** DoubCircle.Tangent: if |dist(O,p) - r| > 1 return null, else the rotation. */
function appletTangent(O, r, p) {
  if (Math.abs(hypot(O, p) - r) > 1) return null;
  return { x: p.x + (O.y - p.y), y: p.y - (O.x - p.x) };
}

/** McGeeCanvas.Extend(p, q, d), straight from its bytecode. */
function appletExtend(p, q, d) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const n = Math.sqrt(dx * dx + dy * dy);
  return { x: p.x + (dx * d) / n, y: p.y + (dy * d) / n };
}

/** GeoSDoub.Intersect(a,b,c,d), including the |det| < 1 NaN branch. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** McGeeCanvas.Compute(), in the bytecode's order, with its early return. */
function appletCompute(state) {
  const A = state.A, B = state.B, L = state.length;
  const O = C.CENTER, r = C.RADIUS;
  if (hypot(A, B) < 2) return { valid: false, reason: "close" };
  if (L > -2 && L < 2) return { valid: false, reason: "short" };
  const tA = appletTangent(O, r, A), tB = appletTangent(O, r, B);
  if (!tA || !tB) return { valid: false, reason: "offcircle" };
  const P = appletExtend(A, tA, L);
  const Q = appletExtend(B, tB, L);
  const R = appletExtend(A, tA, -L);
  const T = appletIntersect(B, Q, A, P);
  const S = appletIntersect(P, Q, A, B);
  return { valid: true, P, Q, R, S, T, dirA: minus(tA, A), dirB: minus(tB, B) };
}

function samePoint(a, b) {
  if (Number.isNaN(a.x) || Number.isNaN(a.y) || Number.isNaN(b.x) || Number.isNaN(b.y)) {
    return Number.isNaN(a.x) === Number.isNaN(b.x) && Number.isNaN(a.y) === Number.isNaN(b.y);
  }
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

/* ---------------------------------------------------------- 1. opening / moves */

{
  const s = C.start();
  const a = C.pointOnCircle(C.ANGLE_A), b = C.pointOnCircle(C.ANGLE_B);
  check("opening A is the applet's 108-degree point", samePoint(s.A, a));
  check("opening B is the applet's -30-degree point", samePoint(s.B, b));
  check("opening A and B lie on the circle",
    Math.abs(C.dist(C.CENTER, s.A) - C.RADIUS) < 1e-9 &&
    Math.abs(C.dist(C.CENTER, s.B) - C.RADIUS) < 1e-9);
  check("the slider opens at -100, the scrollbar's initial value", s.length === C.LENGTH_DEFAULT);
  check("only names are ticked at the start",
    s.showNames === true && !s.showStatement && !s.showPremise && !s.showHint);
  check("the start position is not yet explored", C.result(s) === null);

  const long = C.move(s, { type: "length", value: 9999 });
  const short = C.move(s, { type: "length", value: -9999 });
  check("the slider clamps to 200 at the top", long && long.length === 200);
  check("the slider clamps to -200 at the bottom", short && short.length === -200);
  check("slider steps are whole numbers", C.move(s, { type: "length", value: 13.7 }).length === 14);

  let s2 = C.move(s, { type: "point", name: "A", point: { x: 20, y: 20 } });
  check("dragging A snaps to the circle",
    !!s2 && Math.abs(C.dist(C.CENTER, s2.A) - C.RADIUS) < 1e-9 && C.dist(s2.A, { x: 20, y: 20 }) > 1);
  s2 = C.move(s, { type: "point", name: "A", point: { ...C.CENTER } });
  check("a handle dropped on the centre is refused", s2 === null);
  check("an unknown handle is refused", C.move(s, { type: "point", name: "C", point: { x: 1, y: 1 } }) === null);
  check("an unknown switch is refused", C.move(s, { type: "option", key: "showMagic", value: true }) === null);

  s2 = C.move(s, { type: "option", key: "showHint", value: true });
  check("ticking hint keeps the geometry and marks the play explored",
    !!s2 && s2.showHint && samePoint(s2.A, s.A) && s2.length === s.length && C.result(s2) === "done");
  const reset = C.move(s2, { type: "reset" });
  check("reset restores the opening picture but keeps the switches",
    !!reset && samePoint(reset.A, s.A) && samePoint(reset.B, s.B) &&
    reset.length === -100 && reset.showHint && C.result(reset) === "done");
  check("every legal move from the opening is accepted",
    C.legalMoves(s).every((m) => C.move(s, m) !== null));
}

/* -------------------------- 2. core against a second reading of the bytecode */

{
  let mismatches = 0, compared = 0, guards = 0, nanCases = 0, maxDiff = 0;
  let firstMismatch = "";
  for (const cfg of configurations) {
    const s = C.start(cfg);
    const ours = C.compute(s);
    const theirs = appletCompute(s);
    if (ours.valid !== theirs.valid || (ours.valid ? null : ours.reason) !== (theirs.valid ? null : theirs.reason)) {
      if (mismatches++ < 3) firstMismatch = `guard: ${JSON.stringify([cfg, ours.reason, theirs.reason])}`;
      continue;
    }
    if (!ours.valid) { guards++; continue; }
    if (!ours.drawable) nanCases++;
    for (const key of ["P", "Q", "R", "S", "T", "dirA", "dirB"]) {
      const p = ours[key], q = theirs[key];
      compared++;
      if (!samePoint(p, q)) {
        if (mismatches++ < 3) firstMismatch = `${key}: ${JSON.stringify([cfg, p, q])}`;
      } else if (Number.isFinite(p.x) && Number.isFinite(q.x)) {
        maxDiff = Math.max(maxDiff, Math.abs(p.x - q.x), Math.abs(p.y - q.y));
      }
    }
  }
  check("core matches Tangent/Extend/Intersect/Compute on every configuration",
    mismatches === 0, `${mismatches} mismatches, first ${firstMismatch}`);
  check("the comparison covered all derived points", compared > 600000, `${compared} points`);
  check("the applet's short/close guard was exercised", guards > 10000, `${guards} paused cases`);
  check("the applet's near-parallel NaN branch was exercised", nanCases > 0, `${nanCases} NaN cases`);
  check("the largest coordinate difference is below 1e-6", maxDiff < 1e-6, `${maxDiff}`);

  const O = C.CENTER, r = C.RADIUS;
  const p = { x: O.x + r, y: O.y };
  check("Tangent rotates the radius a quarter turn", (() => {
    const t = C.tangent(p), a = appletTangent(O, r, p);
    return !!t && samePoint(t, a) && Math.abs(t.y - (O.y + r)) < 1e-9;
  })());
  check("Tangent returns null when the point is off the circle", C.tangent({ x: O.x + r + 5, y: O.y }) === null);
  const base = { x: 100, y: 100 }, dir = { x: 130, y: 90 };
  check("Extend uses a unit direction times the signed length", (() => {
    const a = C.extend(base, dir, -75), b = appletExtend(base, dir, -75);
    return samePoint(a, b) && Math.abs(C.dist(base, a) - 75) < 1e-9;
  })());
  check("Intersect returns NaN when |det| is below one", (() => {
    const a = { x: 0, y: 0 }, b = { x: 1, y: 0 };
    const c = { x: 0, y: 0.1 }, d = { x: 1, y: 0.1 };
    const ours = C.intersect(a, b, c, d), theirs = appletIntersect(a, b, c, d);
    return Number.isNaN(ours.x) && Number.isNaN(ours.y) && samePoint(ours, theirs);
  })());
  check("Intersect agrees with the applet away from the guard", (() => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 1, y: -2 }, { x: 2, y: 5 }];
    return samePoint(C.intersect(...pts), appletIntersect(...pts));
  })());
}

/* ---------------------------------------- 3. the page's claim, configuration by configuration */

{
  const worst = {};
  const keys = ["bisect", "equalHalves", "onChord", "equalTangents", "radiusPerp",
    "ARequalsAP", "equalTA_TB", "equalTR_TQ", "AIsMidOfPR", "QRparallelAB", "dirSumParallel"];
  for (const k of keys) worst[k] = 0;
  let finiteCases = 0, nonFinite = 0;
  for (const cfg of configurations) {
    const g = C.compute(C.start(cfg));
    if (!g.valid || !g.drawable) { nonFinite++; continue; }
    const res = C.residuals(g);
    finiteCases++;
    for (const k of keys) {
      if (!Number.isFinite(res[k])) { worst[k] = Infinity; continue; }
      worst[k] = Math.max(worst[k], res[k]);
    }
  }
  check("every claim had a drawable figure to test", finiteCases > 90000,
    `${finiteCases} figures, ${nonFinite} paused or undefined`);
  for (const k of keys) {
    check(`the page's ${k} residual is zero in every figure`, worst[k] < 1e-6, `worst ${worst[k]}`);
  }
  console.log(`  worst residuals over ${finiteCases} figures:`,
    keys.map((k) => `${k}=${worst[k].toExponential(1)}`).join(" "));

  // The guard is a real part of the applet's drawing behaviour.
  const close = C.start({ A: onCircle(0), B: onCircle(0.001), length: 100 });
  const short = C.start({ A: onCircle(0), B: onCircle(2), length: 0 });
  check("A and B less than two pixels apart pauses Compute", C.compute(close).reason === "close");
  check("a slider reading between -2 and 2 pauses Compute", C.compute(short).reason === "short");
  check("lengths of exactly -2 and 2 still draw", (() => {
    const a = C.compute(C.start({ A: onCircle(0), B: onCircle(2), length: -2 }));
    const b = C.compute(C.start({ A: onCircle(0), B: onCircle(2), length: 2 }));
    return a.valid && b.valid;
  })());
}

done("mcgee");
