#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-angles-in-two-circles/equal-angles-in-two-circles-core.js.
 *
 *   node porting/check-equal-angles-in-two-circles.mjs
 *
 * Checked: the applet's four starting handles and four checkboxes; a second
 * literal transcription of Compute(), GetCircle(), DoubCircle.Tangent(),
 * GeoSDoub.FindOrientation(), GeoSDoub.Intersect(DoubLine,DoubCircle) and
 * GeoSDoub.ComputeAngle(), compared field for field on the start picture,
 * sweeps of every handle, thousands of random and near-opening drawings and
 * the degenerate edges (S≈T, a tangent that does not exist, flat chords).
 * Then the page's exact claims: with P on the inner circle and inside the
 * outer one, ASP = BTP and ATP = BSP, plus the tangent–chord and cyclic-
 * quadrilateral steps of its proof, checked over every pictured drawing in
 * those sets; an honest counterexample when P is outside the outer circle.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equal-angles-in-two-circles/equal-angles-in-two-circles-core.js", "EqualAnglesInTwoCirclesCore");

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const sameNum = (a, b, tol = 1e-9) =>
  (a === undefined && b === undefined) || (Number.isNaN(a) && Number.isNaN(b)) || close(a, b, tol);
const samePt = (p, q, tol = 1e-9) => Boolean(p && q) &&
  sameNum(p.x, q.x, tol) && sameNum(p.y, q.y, tol);
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* ---------------- a second transcription, straight from the bytecode ------ */

function jSq(p, q) { return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); }
function jDist(p, q) { return Math.sqrt(jSq(p, q)); }

function jDcmpg(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b) || a > b) return 1;
  return a < b ? -1 : 0;
}
function jDcmpl(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/* GeoSDoub.Intersect(P1,P2,P3,P4); a determinant below 1 yields NaN. */
function jIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GetCircle(U,V,W): FindCircumcenter then the average of the three radii. */
function jCircle(U, V, W) {
  const p = { x: (U.x + V.x) / 2, y: (U.y + V.y) / 2 };
  const q = { x: (V.x + W.x) / 2, y: (V.y + W.y) / 2 };
  const p2 = { x: p.x + V.y - U.y, y: p.y - V.x + U.x };
  const q2 = { x: q.x + W.y - V.y, y: q.y - W.x + V.x };
  const o = jIntersect(p, p2, q, q2);
  const r = (jDist(o, U) + jDist(o, V) + jDist(o, W)) / 3;
  return { x: o.x, y: o.y, r };
}

/* DoubCircle.Tangent(P): null unless P is within one unit of the circle. */
function jTangent(c, p) {
  if (jDcmpl(Math.abs(jDist(c, p) - c.r), 1) > 0) return null;
  return { x: p.x + c.y - p.y, y: p.y - (c.x - p.x) };
}

/* GeoSDoub.FindOrientation(A,B,C), dcmpl(expr,0) > 0 ? +1 : -1. */
function jOrientation(A, B, Cc) {
  const expr = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return jDcmpl(expr, 0) > 0 ? 1 : -1;
}

/*
 * GeoSDoub.Intersect(DoubLine,DoubCircle): IntersectX when |y1-y2|>1, else
 * IntersectY, else null. The +sqrt crossing is element 0. The Java bytecode
 * keeps B = k*(b-c) - c (not doubled) and disc = B² - A*C.
 */
function jLineCircle(P, Q, c) {
  let k, b, A, B, Cc, alongX;
  if (Math.abs(P.y - Q.y) > 1) {
    k = (P.x - Q.x) / (P.y - Q.y);
    b = Q.x - k * Q.y;
    A = k * k + 1;
    B = k * (b - c.x) - c.y;
    Cc = c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r;
    alongX = true;
  } else if (Math.abs(P.x - Q.x) > 1) {
    k = (P.y - Q.y) / (P.x - Q.x);
    b = Q.y - k * Q.x;
    A = k * k + 1;
    B = k * (b - c.y) - c.x;
    Cc = c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r;
    alongX = false;
  } else return null;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B + s) / A, t1 = (-B - s) / A;
  return alongX
    ? [{ x: k * t0 + b, y: t0 }, { x: k * t1 + b, y: t1 }]
    : [{ x: t0, y: k * t0 + b }, { x: t1, y: k * t1 + b }];
}

/* GeoSDoub.ComputeAngle: the bytecode's exact division order. */
function jAngle(V, P, Q) {
  const top = jSq(V, P) + jSq(V, Q) - jSq(P, Q);
  const cosine = top / 2 / jDist(V, P) / jDist(V, Q);
  return Math.acos(cosine);
}

/* EqualAnglesInTwoCirclesCanvas.Compute(), in bytecode order. */
function jCompute(s) {
  const c1 = jCircle(s.T, s.S, s.RB), c2 = jCircle(s.T, s.S, s.RS);
  const bigger = jDcmpl(c1.r, c2.r) > 0;
  const big = bigger ? c1 : c2, small = bigger ? c2 : c1;
  const RB = bigger ? s.RB : s.RS, RS = bigger ? s.RS : s.RB;
  const close = jDcmpg(jDist(s.S, s.T), 1) < 0;
  const stEnd = close ? jTangent(big, s.T) : null;
  const st = close ? (stEnd ? { p1: s.T, p2: stEnd } : null) : { p1: s.S, p2: s.T };
  const chordEnd = jTangent(small, RS);
  const chord = chordEnd ? { p1: RS, p2: chordEnd } : null;
  const cross = chord ? jLineCircle(RS, chordEnd, big) : null;
  const d = { stale: false, valid: Boolean(cross && st), S: s.S, T: s.T,
    viaRB: c1, viaRS: c2, big, small, RB, RS, st, chord, close,
    A: null, B: null, P: RS };
  if (!d.valid) return d;
  const ref = jOrientation(RS, s.S, s.T);
  const first = jOrientation(cross[0], s.S, RS);
  d.A = first === ref ? cross[0] : cross[1];
  d.B = first === ref ? cross[1] : cross[0];
  d.angleASP = jAngle(s.S, d.A, RS);
  d.angleBTP = jAngle(s.T, d.B, RS);
  d.angleATP = jAngle(s.T, d.A, RS);
  d.angleBSP = jAngle(s.S, d.B, RS);
  d.anglePST = jAngle(s.S, RS, s.T);
  d.anglePBT = jAngle(d.B, RS, s.T);
  d.angleBPT = jAngle(RS, d.B, s.T);
  d.angleSTP = jAngle(s.T, s.S, RS);
  d.angleSPA = jAngle(RS, s.S, d.A);
  d.angleABT = jAngle(d.B, d.A, s.T);
  d.angleABS = jAngle(d.A, d.B, s.S);
  return d;
}

function compareCore(label, states) {
  let bad = 0, worst = 0, finiteFields = 0;
  for (const s of states) {
    const a = C.compute(s), b = jCompute(s);
    if (a.valid !== b.valid || a.stale !== b.stale || a.close !== b.close) { bad++; continue; }
    const pairs = [
      ["S", a.S, b.S], ["T", a.T, b.T],
      ["viaRB", a.viaRB, b.viaRB], ["viaRS", a.viaRS, b.viaRS],
      ["big", a.bigCircle, b.big], ["small", a.smallCircle, b.small],
      ["RB", a.RB, b.RB], ["RS", a.RS, b.RS], ["P", a.P, b.P],
      ["st.p1", a.st && a.st.p1, b.st && b.st.p1],
      ["st.p2", a.st && a.st.p2, b.st && b.st.p2],
      ["chord.p1", a.chord && a.chord.p1, b.chord && b.chord.p1],
      ["chord.p2", a.chord && a.chord.p2, b.chord && b.chord.p2],
      ["A", a.A, b.A], ["B", a.B, b.B],
    ];
    for (const [name, core, java] of pairs) {
      if (core == null && java == null) continue;
      if (!samePt(core, java)) {
        if (process.env.DEBUG) console.log("MISMATCH", name, core, java, JSON.stringify(s));
        bad++;
        continue;
      }
      if (["viaRB", "viaRS", "big", "small"].includes(name)) {
        if (!sameNum(core.r, java.r)) {
          if (process.env.DEBUG) console.log("RADIUS MISMATCH", name, core.r, java.r);
          bad++;
        } else if (Number.isFinite(core.r)) worst = Math.max(worst, Math.abs(core.r - java.r));
      }
      finiteFields++;
    }
    for (const name of ["angleASP", "angleBTP", "angleATP", "angleBSP",
      "anglePST", "anglePBT", "angleBPT", "angleSTP", "angleSPA", "angleABT", "angleABS"]) {
      if (!sameNum(a[name], b[name], 1e-9)) {
        if (process.env.DEBUG) console.log("ANGLE MISMATCH", name, a[name], b[name], JSON.stringify(s));
        bad++;
      } else if (Number.isFinite(a[name])) worst = Math.max(worst, Math.abs(a[name] - b[name]));
    }
  }
  check(label, bad === 0 && worst < 1e-7,
    `${states.length} drawings, ${finiteFields} points, ${bad} mismatches, worst ${worst.toExponential(2)}`);
}

/* ------------------------------------------------------- 1. the start picture */

const start = C.start();
{
  check("init puts S at (100,320) on the page's 400×400 canvas", closePt(start.S, { x: 100, y: 320 }, 0));
  check("init puts T at (300,320)", closePt(start.T, { x: 300, y: 320 }, 0));
  check("init puts RB at (133,200), using Java integer division", closePt(start.RB, { x: 133, y: 200 }, 0));
  check("init puts RS at (400/1.8,200)", closePt(start.RS, { x: 400 / 1.8, y: 200 }, 0));
  check("the page's second applet shows names; statement, hint and extra are off",
    start.names === true && !start.statement && !start.hint && !start.extra);
  check("an illustration has no result and no computer move",
    !("result" in C) && !("move" in C));
  const sized = C.start({ width: 300, height: 250 });
  check("init follows the applet's formulas at another canvas size",
    closePt(sized.S, { x: 75, y: 200 }, 0) && closePt(sized.T, { x: 225, y: 200 }, 0) &&
    closePt(sized.RB, { x: 100, y: 125 }, 0) && closePt(sized.RS, { x: 300 / 1.8, y: 125 }, 0));
}

{
  const dragged = C.withPoint(start, "RS", { x: -100, y: 900 });
  check("dragging clamps a handle into the canvas",
    closePt(dragged.RS, { x: C.MARGIN, y: C.VIEW.height - C.MARGIN }, 0));
  check("dragging leaves the old position alone", start.RS.x === 400 / 1.8 && start.RS.y === 200);
  check("an unknown handle is a no-op", C.withPoint(start, "A", { x: 0, y: 0 }) === start);
  const toggled = C.withToggle(C.withToggle(start, "hint", true), "names", false);
  check("checkbox changes do not mutate the position",
    toggled.hint === true && toggled.names === false && start.hint === false && start.names === true);
  check("an unknown checkbox is a no-op", C.withToggle(start, "hintbox", true) === start);
}

/* ------------------- 2. the applet's own method over many drawings --------- */

compareCore("the start drawing against the bytecode", [start]);

const sweep = [];
for (let i = 0; i < 120; i++) {
  const a = (2 * Math.PI * i) / 120;
  sweep.push({ ...start, RS: { x: 200 + 80 * Math.cos(a), y: 230 + 80 * Math.sin(a) } });
  sweep.push({ ...start, RB: { x: 180 + 70 * Math.cos(a), y: 230 + 70 * Math.sin(a) } });
  sweep.push({ ...start,
    S: { x: 200 + 90 * Math.cos(a), y: 300 + 45 * Math.sin(a) },
    T: { x: 250 - 60 * Math.cos(a), y: 310 - 35 * Math.sin(a) } });
}
compareCore("360 positions sweeping S, T, RB and RS", sweep);

const next = rng(718233);
const randoms = [];
for (let i = 0; i < 2000; i++) {
  const p = () => ({ x: 14 + next() * 372, y: 14 + next() * 372 });
  randoms.push({ S: p(), T: p(), RB: p(), RS: p(),
    names: false, statement: false, hint: false, extra: false });
}
compareCore("2000 random configurations", randoms);

/* Small moves from the opening picture are the page's actual construction. */
const near = [];
for (let i = 0; i < 2400; i++) {
  const jitter = (p) => ({ x: p.x + (next() - 0.5) * 110, y: p.y + (next() - 0.5) * 110 });
  near.push({ S: jitter(start.S), T: jitter(start.T), RB: jitter(start.RB), RS: jitter(start.RS) });
}
compareCore("2400 configurations near the opening picture", near);

const edge = [
  { S: { x: 200, y: 200.4 }, T: { x: 200.2, y: 200 }, RB: { x: 130, y: 100 }, RS: { x: 250, y: 120 } },
  { S: { x: 200, y: 200 }, T: { x: 200, y: 200 }, RB: { x: 130, y: 100 }, RS: { x: 250, y: 120 } },
  { S: { x: 150, y: 300 }, T: { x: 250, y: 300 }, RB: { x: 90, y: 100 }, RS: { x: 320, y: 100 } },
  { S: { x: 150, y: 300 }, T: { x: 250, y: 300 }, RB: { x: 200, y: 20 }, RS: { x: 200, y: 380 } },
  { S: { x: 150, y: 300 }, T: { x: 250, y: 300 }, RB: { x: 20, y: 300 }, RS: { x: 380, y: 300 } },
  { S: { x: 100, y: 100 }, T: { x: 300, y: 100 }, RB: { x: 200, y: 250 }, RS: { x: 200, y: 250 } },
];
compareCore("near-coincident S/T, steep, flat and tied-radius edges", edge);
{
  const d = C.compute(edge[0]), j = jCompute(edge[0]);
  check("S and T within one unit use the applet's tangent-at-T line ST",
    d.close === true && j.close === true && d.valid &&
    samePt(d.st.p1, j.st.p1, 0) && samePt(d.st.p2, j.st.p2, 1e-9));
  const tied = C.compute(edge[5]);
  check("equal-radius tie follows the applet's dcmpl choice",
    close(tied.viaRB.r, tied.viaRS.r, 1e-9) &&
    samePt(tied.bigCircle, jCompute(edge[5]).big, 0));
}

/* -------------------------- 3. the page's exact claims --------------------- */

const all = randoms.concat(sweep, near, edge).map((s) => C.compute(s));
const pictures = all.filter((d) => C.pictured(d));
check("plenty of drawings match the page's P-inside-the-other-circle picture",
  pictures.length > 3000, `${pictures.length} pictured of ${all.length}`);
{
  const d = C.compute(start);
  check("the opening picture is the page's construction", C.pictured(d),
    `gap ${C.angleGap(d).toExponential(2)} rad`);
  check("the opening picture shows both angle equalities to better than 1e-12",
    C.angleGap(d) < 1e-12, `gap ${C.angleGap(d).toExponential(2)} rad`);
  check("the opening picture names A left of B on the tangent chord", d.A.x < d.B.x);
}

let equalErr = 0, tangentErr = 0, cyclicErr = 0, radiiErr = 0;
for (const d of pictures) {
  const scale = Math.max(1, d.bigCircle.r, d.smallCircle.r);
  equalErr = Math.max(equalErr, C.angleGap(d));
  tangentErr = Math.max(tangentErr, Math.abs(d.anglePST - d.angleBPT) / scale,
    Math.abs(d.angleSTP - d.angleSPA) / scale);
  cyclicErr = Math.max(cyclicErr,
    Math.abs(d.angleASP + d.anglePST + d.angleABT - Math.PI) / scale,
    Math.abs(d.anglePBT + d.angleBPT + d.angleBTP - Math.PI) / scale);
  for (const p of [d.A, d.B]) {
    radiiErr = Math.max(radiiErr, Math.abs(C.dist(d.bigCircle, p) - d.bigCircle.r) / scale);
  }
  radiiErr = Math.max(radiiErr,
    Math.abs(C.dist(d.smallCircle, d.P) - d.smallCircle.r) / scale,
    Math.abs(C.dist(d.S, d.bigCircle) - d.bigCircle.r) / scale,
    Math.abs(C.dist(d.T, d.smallCircle) - d.smallCircle.r) / scale);
}
check("ASP = BTP and ATP = BSP on every pictured drawing",
  equalErr < 1e-8, `${pictures.length} drawings, worst ${equalErr.toExponential(2)} rad`);
check("the proof's tangent-chord step PST = BPT holds on every pictured drawing",
  tangentErr < 1e-8, `worst ${tangentErr.toExponential(2)} rad`);
check("the two cyclic-quadrilateral angle sums are 180° on every pictured drawing",
  cyclicErr < 1e-8, `worst ${cyclicErr.toExponential(2)} rad`);
check("A and B are on the outer circle and P, S, T on their circles",
  radiiErr < 1e-9, `worst relative error ${radiiErr.toExponential(2)}`);

/* The claim needs P inside the other circle. Outside it the marked angles
   become supplementary instead; pin down such a configuration honestly. */
{
  let counterexample = null;
  for (const s of randoms) {
    const d = C.compute(s);
    if (!C.drawn(d) || C.pictured(d)) continue;
    if (C.dist(d.bigCircle, d.P) < d.bigCircle.r || C.angleGap(d) < 0.3) continue;
    counterexample = { s, d };
    break;
  }
  check("a drawing with P outside the outer circle exists", Boolean(counterexample));
  if (counterexample) {
    const d = counterexample.d;
    check("outside the outer circle the two angles are supplementary, not equal",
      C.angleGap(d) > 0.3 && close(d.angleASP + d.angleBTP, Math.PI, 1e-8),
      `gap ${C.angleGap(d).toFixed(3)} rad, sum ${(d.angleASP + d.angleBTP).toFixed(6)}`);
    check("the counterexample is drawn exactly as the bytecode draws it",
      samePt(d.A, jCompute(counterexample.s).A, 1e-9) &&
      samePt(d.B, jCompute(counterexample.s).B, 1e-9));
  }
}

done("equal-angles-in-two-circles");
