#!/usr/bin/env node
"use strict";

/*
 * Logic test for fagnano/fagnano-core.js.
 *
 *   node porting/check-fagnano.mjs
 *
 * (1) The opening figure and the applet's own Reflect(int)/ComputeReflection
 *     and CheckMidPoint are written a second time, straight from the Java
 *     bytecode, and compared with the core over thousands of configurations,
 *     including the applet's near-vertical short path. (2) Every claim on the
 *     cut-the-knot page is tested: after five reflections the final AB is
 *     parallel and equally directed; the six red pieces fold into one line of
 *     length 2x the orthic perimeter exactly when PQR is orthic, and are
 *     longer otherwise; Fejer's angle is 2A and AP'=AP; the minimum perimeter
 *     is the orthic one in acute triangles, while in right/obtuse triangles the
 *     infimum is twice the shortest altitude and no proper inscribed triangle
 *     reaches it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fagnano/fagnano-core.js", "FagnanoCore");
const TOL = 1e-7;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const lerp = (a, b, t) => add(mul(a, t), mul(b, 1 - t));
const samePoint = (a, b, tol = TOL) => dist(a, b) <= tol;
const scaleOf = (A, B, Cp) => Math.max(1, dist(A, B), dist(B, Cp), dist(Cp, A));

/* ----------------------------------- a second transcription of the bytecode */

/*
 * FagnanoCanvas$FagnanoTriangle.ComputeReflection(p, a, b):
 *   if (abs(b.x-a.x) >= 1) {
 *     L4 = b.Diff(p); L5 = a.Diff(b);
 *     t = -(L4*L5)/(L5*L5);
 *     return (2*(b.x + t*L5.x) - p.x, 2*(b.y + t*L5.y) - p.y);
 *   }
 *   return (2*a.x - p.x, p.y);
 */
function javaReflectPoint(p, a, b) {
  if (Math.abs(b.x - a.x) >= 1) {
    const l4 = sub(b, p);
    const l5 = sub(a, b);
    const t = -dot(l4, l5) / dot(l5, l5);
    return { x: 2 * (b.x + t * l5.x) - p.x, y: 2 * (b.y + t * l5.y) - p.y };
  }
  return { x: 2 * a.x - p.x, y: p.y };
}

/* Reflect(int), with the same case order and the same "unchanged" points. */
function javaReflect(t, kind) {
  if (kind === 0) {
    const newC = javaReflectPoint(t.C, t.A, t.B);
    return {
      A: t.A, B: t.B, C: newC,
      P: javaReflectPoint(t.P, t.A, t.B),
      Q: javaReflectPoint(t.Q, t.A, t.B),
      R: t.R, type: 2,
    };
  }
  if (kind === 1) {
    const newA = javaReflectPoint(t.A, t.B, t.C);
    return {
      A: newA, B: t.B, C: t.C,
      P: t.P,
      Q: javaReflectPoint(t.Q, t.B, t.C),
      R: javaReflectPoint(t.R, t.B, t.C), type: 0,
    };
  }
  const newB = javaReflectPoint(t.B, t.C, t.A);
  return {
    A: t.A, B: newB, C: t.C,
    P: javaReflectPoint(t.P, t.C, t.A),
    Q: t.Q,
    R: javaReflectPoint(t.R, t.C, t.A), type: 1,
  };
}

/* FagnanoCanvas.Draw(): original with type 2, then 2, 1, 0, 2, 1. */
function javaChain(s) {
  const t0 = {
    A: s.A, B: s.B, C: s.C, P: s.P, Q: s.Q, R: s.R, type: 2,
  };
  const all = [t0];
  for (const k of [2, 1, 0, 2, 1]) all.push(javaReflect(all[all.length - 1], k));
  return all;
}

function javaRed(t) {
  if (t.type === 2) return [t.Q, t.R];
  if (t.type === 1) return [t.P, t.Q];
  return [t.R, t.P];
}

/* The true reflection, without the applet's |b.x-a.x| < 1 short cut. The
   page's geometric claims are about this; the short cut is checked above. */
function exactReflectPoint(p, a, b) {
  const d = sub(b, a);
  const t = dot(sub(p, a), d) / dot(d, d);
  return sub(add(mul(a, 2), mul(d, 2 * t)), p);
}

function exactTriangle(t, kind) {
  if (kind === 0) {
    return {
      A: t.A, B: t.B, C: exactReflectPoint(t.C, t.A, t.B),
      P: exactReflectPoint(t.P, t.A, t.B),
      Q: exactReflectPoint(t.Q, t.A, t.B),
      R: t.R, type: 2,
    };
  }
  if (kind === 1) {
    return {
      A: exactReflectPoint(t.A, t.B, t.C), B: t.B, C: t.C,
      P: t.P,
      Q: exactReflectPoint(t.Q, t.B, t.C),
      R: exactReflectPoint(t.R, t.B, t.C), type: 0,
    };
  }
  return {
    A: t.A, B: exactReflectPoint(t.B, t.C, t.A), C: t.C,
    P: exactReflectPoint(t.P, t.C, t.A),
    Q: t.Q,
    R: exactReflectPoint(t.R, t.C, t.A), type: 1,
  };
}

function exactChain(s) {
  const first = { A: s.A, B: s.B, C: s.C, P: s.P, Q: s.Q, R: s.R, type: 2 };
  const all = [first];
  for (const k of [2, 1, 0, 2, 1]) all.push(exactTriangle(all[all.length - 1], k));
  return all;
}

function exactPath(s) {
  return exactChain(s).map(javaRed);
}

function pathLength(path) {
  return path.reduce((sum, seg) => sum + dist(seg[0], seg[1]), 0);
}

/* DoubLine.UpdateMidPoint(p): t = -(u-v).(v-p)/(u-v).(u-v), clamped. */
function javaUpdateMidPoint(p, u, v) {
  const d = sub(u, v);
  const denom = dot(d, d);
  let t = denom === 0 ? 0 : -dot(d, sub(v, p)) / denom;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return { t, point: lerp(u, v, t) };
}

/* FagnanoCanvas.CheckMidPoint() plus the point the mouse just moved. */
function javaMove(s, name, raw) {
  const q = { x: Math.max(2, Math.min(C.WIDTH, raw.x)), y: Math.max(1, Math.min(C.HEIGHT - 2, raw.y)) };
  const next = Object.assign({}, s);
  if (name === "A") {
    next.A = q;
    const m = javaUpdateMidPoint(q, next.B, next.C);
    next.P = m.point; next.tP = m.t;
  } else if (name === "B") {
    next.B = q;
    const m = javaUpdateMidPoint(q, next.C, next.A);
    next.Q = m.point; next.tQ = m.t;
  } else if (name === "C") {
    next.C = q;
    const m = javaUpdateMidPoint(q, next.A, next.B);
    next.R = m.point; next.tR = m.t;
  } else if (name === "P") {
    next.P = q;
    next.Q = lerp(next.C, next.A, s.tQ);
    next.R = lerp(next.A, next.B, s.tR);
  } else if (name === "Q") {
    next.Q = q;
    next.P = lerp(next.B, next.C, s.tP);
    next.R = lerp(next.A, next.B, s.tR);
  } else if (name === "R") {
    next.R = q;
    next.P = lerp(next.B, next.C, s.tP);
    next.Q = lerp(next.C, next.A, s.tQ);
  }
  return next;
}

/* ------------------------------------------------------------ 1. the opening */

{
  const s = C.start();
  equal("the opening vertices use the applet's min(w,h)/8 construction",
    [s.A, s.B, s.C], [{ x: 100, y: 200 }, { x: 50, y: 350 }, { x: 200, y: 300 }]);
  equal("the opening P, Q, R use the applet's 0.4, 0.4, 0.3 side fractions",
    [s.P, s.Q, s.R], [{ x: 140, y: 320 }, { x: 140, y: 240 }, { x: 65, y: 305 }]);
  check("Show names and Show altitudes both start unchecked",
    !s.showNames && !s.showAltitudes);
  const f = C.compute(s);
  check("the opening triangle is acute",
    dot(sub(s.B, s.A), sub(s.C, s.A)) > 0 &&
    dot(sub(s.A, s.B), sub(s.C, s.B)) > 0 &&
    dot(sub(s.A, s.C), sub(s.B, s.C)) > 0);
  check("the opening red path is bent, not straight", f.bend > 1e-3);
  check("the opening broken line is longer than twice the orthic perimeter",
    f.foldedLength > 2 * f.orthicPerimeter + 1,
    `${f.foldedLength} versus ${2 * f.orthicPerimeter}`);
  check("the opening status line reports all three lengths",
    /Perimeter/.test(C.describe(s)) && /orthic/.test(C.describe(s)));
}

/* ------------------------ 2. the bytecode transcribed twice, everywhere */

{
  const rnd = rng(20261127);
  let worst = 0, shortPathCases = 0, cases = 0;
  for (let i = 0; i < 4000; i++) {
    // Include ordinary triangles and triangles whose sides are near vertical,
    // so the applet's |b.x-a.x| < 1 branch is exercised too.
    const A = { x: rnd() * C.WIDTH, y: rnd() * C.HEIGHT };
    const nearVertical = i % 4 === 0;
    const B = nearVertical
      ? { x: A.x + (rnd() - 0.5) * 1.8, y: rnd() * C.HEIGHT }
      : { x: rnd() * C.WIDTH, y: rnd() * C.HEIGHT };
    const Cp = nearVertical
      ? { x: A.x + (rnd() - 0.5) * 1.8, y: rnd() * C.HEIGHT }
      : { x: rnd() * C.WIDTH, y: rnd() * C.HEIGHT };
    const s = {
      A, B, C: Cp,
      P: lerp(B, Cp, rnd()), Q: lerp(Cp, A, rnd()), R: lerp(A, B, rnd()),
      tP: 0.5, tQ: 0.5, tR: 0.5, showNames: false, showAltitudes: false,
    };
    if (Math.abs(B.x - A.x) < 1 || Math.abs(Cp.x - B.x) < 1 || Math.abs(A.x - Cp.x) < 1) shortPathCases++;
    const mine = C.chain(s);
    const theirs = javaChain(s);
    check(`chain has six triangles (case ${i})`, mine.length === 6 && theirs.length === 6);
    for (let j = 0; j < 6; j++) {
      for (const k of ["A", "B", "C", "P", "Q", "R"]) {
        const err = dist(mine[j][k], theirs[j][k]) / scaleOf(A, B, Cp);
        worst = Math.max(worst, err);
      }
      if (mine[j].type !== theirs[j].type) worst = Infinity;
    }
    for (let j = 0; j < 6; j++) {
      const a = C.redSide(mine[j]), b = javaRed(theirs[j]);
      worst = Math.max(worst, dist(a[0], b[0]) / scaleOf(A, B, Cp),
        dist(a[1], b[1]) / scaleOf(A, B, Cp));
    }
    cases++;
  }
  check(`4000 configurations were compared with the bytecode (${shortPathCases} near-vertical)`,
    cases === 4000 && shortPathCases > 100);
  check(`every reflection and red side matches the second transcription (max ${worst})`,
    worst <= 1e-11);
}

/* -------------------------- 3. CheckMidPoint, transcribed a second time */

{
  const rnd = rng(73119);
  let worst = 0, cases = 0;
  for (let i = 0; i < 3000; i++) {
    const A = { x: 40 + rnd() * 300, y: 20 + rnd() * 250 };
    const B = { x: 30 + rnd() * 300, y: 30 + rnd() * 250 };
    const Cp = { x: 40 + rnd() * 300, y: 40 + rnd() * 250 };
    let s = {
      A, B, C: Cp,
      P: lerp(B, Cp, rnd()), Q: lerp(Cp, A, rnd()), R: lerp(A, B, rnd()),
      tP: rnd(), tQ: rnd(), tR: rnd(), showNames: false, showAltitudes: false,
    };
    for (let step = 0; step < 6; step++) {
      const name = ["A", "B", "C", "P", "Q", "R"][step];
      const q = { x: rnd() * C.WIDTH, y: rnd() * C.HEIGHT };
      const mine = C.move(s, name, q);
      const theirs = javaMove(s, name, q);
      for (const k of ["A", "B", "C", "P", "Q", "R"]) {
        worst = Math.max(worst, dist(mine[k], theirs[k]) / scaleOf(s.A, s.B, s.C));
      }
      for (const k of ["tP", "tQ", "tR"]) {
        worst = Math.max(worst, Math.abs(mine[k] - theirs[k]));
      }
      s = mine;
      cases++;
    }
  }
  check(`18000 drags were compared with CheckMidPoint (max ${worst})`,
    cases === 18000 && worst <= 1e-11);
  const s = C.start();
  check("an unknown handle or a missing point is refused",
    C.move(s, "X", { x: 1, y: 1 }) === s && C.move(s, "A", null) === s);
  check("the checkboxes change only the flags",
    C.option(C.option(s, "showNames", true), "showAltitudes", true).showNames &&
    C.option(s, "showNames", true).B === s.B);
}

/* -------------------------------------------- 4. Schwarz's five reflections */

function acute(A, B, Cp) {
  return dot(sub(B, A), sub(Cp, A)) > 1e-6 &&
    dot(sub(A, B), sub(Cp, B)) > 1e-6 &&
    dot(sub(A, Cp), sub(B, Cp)) > 1e-6;
}

function randomAcute(rnd) {
  for (let tries = 0; tries < 1000; tries++) {
    const L = 120 + rnd() * 260;
    const x = 0.12 * L + rnd() * 0.76 * L;
    const h = Math.sqrt(x * (L - x)) * (1.05 + rnd() * 2);
    const A = { x, y: -h }, B = { x: 0, y: 0 }, Cp = { x: L, y: 0 };
    if (acute(A, B, Cp)) return { A, B, C: Cp };
  }
  throw new Error("no acute triangle generated");
}

{
  const rnd = rng(918273);
  let worstParallel = 0, minDot = Infinity, cases = 0;
  let quirkCases = 0, worstQuirk = 0;
  for (let i = 0; i < 600; i++) {
    const { A, B, C: Cp } = randomAcute(rnd);
    const s = {
      A, B, C: Cp,
      P: lerp(B, Cp, rnd()), Q: lerp(Cp, A, rnd()), R: lerp(A, B, rnd()),
      tP: 0, tQ: 0, tR: 0, showNames: false, showAltitudes: false,
    };
    const exact = exactChain(s);
    const scale = scaleOf(A, B, Cp);
    const v0 = sub(s.B, s.A), v5 = sub(exact[5].B, exact[5].A);
    const norm = Math.hypot(v0.x, v0.y) * Math.hypot(v5.x, v5.y);
    worstParallel = Math.max(worstParallel, Math.abs(cross(v0, v5)) / norm);
    minDot = Math.min(minDot, dot(v0, v5) / norm);
    // The applet's vertical short cut can perturb the picture; measure it.
    const mine = C.chain(s);
    for (let j = 0; j < 6; j++) {
      for (const k of ["A", "B", "C", "P", "Q", "R"]) {
        const d = dist(mine[j][k], exact[j][k]) / scale;
        if (d > 1e-10) quirkCases++;
        worstQuirk = Math.max(worstQuirk, d);
      }
    }
    cases++;
  }
  check("600 acute triangles were used for the five-reflection claim", cases === 600);
  check(`final AB is parallel to the original AB (max sine ${worstParallel})`, worstParallel < 1e-10);
  check(`the direction is preserved, not reversed (min cosine ${minDot})`, minDot > 0.999);
  check(`the applet's near-vertical short cut stays tiny (${quirkCases} affected points, max ${worstQuirk})`,
    worstQuirk < 0.05);
}

/* ------------------------- 5. the orthic triangle and the straightened line */

{
  const rnd = rng(5150);
  let worstBend = 0, worstLength = 0, worstShort = 0, cases = 0;
  for (let i = 0; i < 600; i++) {
    const { A, B, C: Cp } = randomAcute(rnd);
    const s0 = {
      A, B, C: Cp,
      P: lerp(B, Cp, 0.31), Q: lerp(Cp, A, 0.44), R: lerp(A, B, 0.62),
      tP: 0.31, tQ: 0.44, tR: 0.62, showNames: false, showAltitudes: false,
    };
    const s = C.orthicState(s0);
    const f = C.compute(s);
    const exact = exactPath(s);
    const scale = scaleOf(A, B, Cp);
    worstBend = Math.max(worstBend, C.bend(exact));
    worstLength = Math.max(worstLength, Math.abs(pathLength(exact) - 2 * f.orthicPerimeter) / scale);
    worstShort = Math.min(worstShort, pathLength(exactPath(s0)) - 2 * f.orthicPerimeter);
    // The orthic feet really are the feet of the three altitudes.
    if (!samePoint(f.orthic.P, C.foot(A, B, Cp), TOL * scale) ||
        !samePoint(f.orthic.Q, C.foot(B, Cp, A), TOL * scale) ||
        !samePoint(f.orthic.R, C.foot(Cp, A, B), TOL * scale)) worstBend = Infinity;
    cases++;
  }
  check("600 acute triangles were folded with orthic and non-orthic PQR", cases === 600);
  check(`the six orthic pieces are one straight line (max sine ${worstBend})`, worstBend < 1e-9);
  check(`the straight line is exactly two orthic perimeters (max ${worstLength})`, worstLength < 1e-9);
  check(`every other broken line is longer (smallest margin ${worstShort})`, worstShort > -1e-9);
}

/* ------------------------------------------- 6. Fejér's two reflections */

{
  const rnd = rng(24680);
  let worstAngle = 0, worstAp = 0, worstBase = 0, cases = 0;
  for (let i = 0; i < 600; i++) {
    const { A, B, C: Cp } = randomAcute(rnd);
    const P = lerp(B, Cp, 0.05 + rnd() * 0.9);
    const f = C.fejer({ A, B, C: Cp }, P);
    const scale = scaleOf(A, B, Cp);
    worstAngle = Math.max(worstAngle, Math.abs(f.angle - 2 * f.angleA));
    worstAp = Math.max(worstAp, Math.abs(f.ap - dist(A, f.prime)) / scale);
    worstBase = Math.max(worstBase, Math.abs(f.base - 2 * f.ap * Math.sin(f.angleA)) / scale);
    cases++;
  }
  check("600 Fejér reflections were checked", cases === 600);
  check(`angle P'AP'' is always twice angle A (max ${worstAngle})`, worstAngle < 1e-9);
  check(`AP' equals AP (max ${worstAp})`, worstAp < 1e-9);
  check(`P'P'' = 2 AP sin(A) (max ${worstBase})`, worstBase < 1e-9);
}

/* ------------------- 7. the minimum, by Fejér and by brute-force search */

{
  const rnd = rng(35791);
  let worstMin = 0, cases = 0, bestAtFoot = 0;
  for (let i = 0; i < 250; i++) {
    const { A, B, C: Cp } = randomAcute(rnd);
    const s = { A, B, C: Cp };
    // Ternary search on the Fejér base; for an acute triangle the shortest
    // broken path for a fixed P has Q and R on the line P'P''.
    let lo = 0, hi = 1;
    for (let k = 0; k < 160; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      const b1 = C.fejer(s, lerp(B, Cp, m1)).base;
      const b2 = C.fejer(s, lerp(B, Cp, m2)).base;
      if (b1 < b2) hi = m2; else lo = m1;
    }
    const t = (lo + hi) / 2;
    const scale = scaleOf(A, B, Cp);
    const minBase = C.fejer(s, lerp(B, Cp, t)).base;
    const o = C.orthic(s);
    const tFoot = C.sideParameter(o.P, B, Cp);
    worstMin = Math.max(worstMin, Math.abs(minBase - C.perimeter(o.P, o.Q, o.R)) / scale);
    if (Math.abs(t - tFoot) < 1e-5) bestAtFoot++;
    cases++;
  }
  check("250 acute triangles were minimised with Fejér's construction", cases === 250);
  check(`the minimum base is the orthic perimeter (max ${worstMin})`, worstMin < 1e-7);
  check(`the minimum occurs at the altitude foot in all ${bestAtFoot} cases`, bestAtFoot === 250);
}

{
  // An independent brute-force search over the three side parameters. It can
  // only bracket the minimum, but it must never beat the orthic perimeter.
  const rnd = rng(8642);
  let below = 0, worstMargin = 0, cases = 0;
  for (let i = 0; i < 12; i++) {
    const { A, B, C: Cp } = randomAcute(rnd);
    const scale = scaleOf(A, B, Cp);
    const orth = C.orthic({ A, B, C: Cp });
    const target = C.perimeter(orth.P, orth.Q, orth.R);
    let best = Infinity;
    for (let a = 0; a <= 26; a++) for (let b = 0; b <= 26; b++) for (let c = 0; c <= 26; c++) {
      const p = C.perimeter(
        lerp(B, Cp, a / 26), lerp(Cp, A, b / 26), lerp(A, B, c / 26));
      if (p < best) best = p;
    }
    if (best < target - 1e-9) below++;
    worstMargin = Math.max(worstMargin, (best - target) / scale);
    cases++;
  }
  check("12 acute triangles got a full 27^3 grid search", cases === 12);
  check("no sampled inscribed triangle beats the orthic perimeter", below === 0);
  check(`the coarse grid stays within 1.5% of the answer (max ${worstMargin})`, worstMargin < 0.015);
}

/* --------------- 8. the page's remark about right and obtuse triangles */

function altitudes(A, B, Cp) {
  return [dist(A, C.foot(A, B, Cp)), dist(B, C.foot(B, Cp, A)),
    dist(Cp, C.foot(Cp, A, B))];
}

/** Random search plus local refinement: the infimum of PQR perimeters. */
function bruteInfimum(A, B, Cp, rnd) {
  let best = Infinity, bestProper = Infinity, bp = [0.5, 0.5, 0.5];
  for (let k = 0; k < 30000; k++) {
    const t = [rnd(), rnd(), rnd()];
    const p = C.perimeter(lerp(B, Cp, t[0]), lerp(Cp, A, t[1]), lerp(A, B, t[2]));
    if (p < best) { best = p; bp = t; }
    if (t.every((v) => v > 0.03 && v < 0.97)) bestProper = Math.min(bestProper, p);
  }
  let step = 0.05;
  for (let k = 0; k < 60; k++) {
    let improved = false;
    for (let d = 0; d < 3; d++) for (const sign of [-1, 1]) {
      const t = bp.slice();
      t[d] = Math.max(0, Math.min(1, t[d] + sign * step));
      const p = C.perimeter(lerp(B, Cp, t[0]), lerp(Cp, A, t[1]), lerp(A, B, t[2]));
      if (p < best) { best = p; bp = t; improved = true; }
    }
    if (!improved) step /= 2;
  }
  return { best, bestProper, bp };
}

{
  const rnd = rng(11223);
  let worst = 0, strictlyAbove = 0, worstProperMargin = Infinity, cases = 0;
  for (let i = 0; i < 24; i++) {
    const L = 120 + rnd() * 200;
    // Half the cases are right at B or C; the rest are obtuse at A.
    const x = i % 2 === 0 ? (i % 4 === 0 ? 0 : L)
      : L * (0.08 + rnd() * 0.84);
    const h = i % 2 === 0 ? 20 + rnd() * 90
      : Math.sqrt(x * (L - x)) * (0.1 + rnd() * 0.7);
    const A = { x, y: -h }, B = { x: 0, y: 0 }, Cp = { x: L, y: 0 };
    if (acute(A, B, Cp)) continue; // only right and obtuse cases here
    const scale = scaleOf(A, B, Cp);
    const target = 2 * Math.min(...altitudes(A, B, Cp));
    const { best, bestProper, bp } = bruteInfimum(A, B, Cp, rnd);
    worst = Math.max(worst, Math.abs(best - target) / scale);
    worstProperMargin = Math.min(worstProperMargin, (bestProper - target) / scale);
    // The infimum is approached only as one PQR vertex collapses onto a
    // triangle vertex, so a proper triangle never attains it.
    const onVertex = Math.min(...bp.map((t) => Math.min(t, 1 - t))) < 0.02;
    if (best > target - 1e-8 * scale && onVertex) strictlyAbove++;
    cases++;
  }
  check(`24 right/obtuse triangles were searched (${cases} usable)`, cases === 24);
  check(`the infimum is twice the shortest altitude (max ${worst})`, worst < 0.002);
  check(`it is approached only by a degenerate triangle in ${strictlyAbove} of ${cases} cases`,
    strictlyAbove === cases);
  check(`every sampled proper triangle stays above it (min margin ${worstProperMargin})`,
    worstProperMargin > 0);
}

/* -------------------------------------- 9. the page-side helpers and status */

{
  const s0 = C.start();
  const dragged = C.setSide(s0, "P", { x: 400, y: 400 });
  const onSide = C.sideParameter(dragged.P, dragged.B, dragged.C);
  check("the page's P handle stays on BC", near(onSide, dragged.tP) && dragged.tP <= 1);
  check("the page's snapped P is on the segment, not at the raw pointer",
    samePoint(dragged.P, lerp(dragged.B, dragged.C, dragged.tP)));
  const o = C.orthicState(s0);
  const f = C.compute(o);
  check("the Orthic feet button straightens the red path", f.bend < 1e-9);
  check("its straight line really is twice the orthic perimeter",
    near(f.foldedLength, 2 * f.orthicPerimeter, 1e-7));
  check("the original picture is untouched by the helper functions",
    samePoint(s0.P, { x: 140, y: 320 }) && s0.tP === 0.4);
}

done("fagnano");
