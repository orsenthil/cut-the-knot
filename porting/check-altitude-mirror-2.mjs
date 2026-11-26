#!/usr/bin/env node
"use strict";

/*
 * Logic test for altitude-mirror-2/altitude-mirror-2-core.js.
 *
 *   node porting/check-altitude-mirror-2.mjs
 *
 * Every claim on the cut-the-knot page is checked on a 40x40 grid of C and D
 * positions in the applet's two arcs and on 600 deterministic random pairs
 * spread over the whole upper semicircle:
 *   - ACB and ADB are right angles, E is the orthocenter of triangle ABS;
 *   - E = AD n BC, F = foot of E on AB, E' = reflected E;
 *   - F = DC' n CD' and E' = C'B n D'A (the other two Pascal points), so
 *     E, F, E' are collinear on the line through the centre's vertical;
 *   - EF bisects angle CFD, each half being |angle(C) - angle(D)| / 2.
 * The last block writes Compute() out a second time, straight from the
 * bytecode (reflection, upper-point swap, Intersect, NearestPoint, reflection
 * of E), and compares it with the core, including the mirrored swap branch.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("altitude-mirror-2/altitude-mirror-2-core.js", "AltitudeMirror2Core");
const B = C.BOARD;
const TAU = Math.PI * 2;

/** Shortest absolute angle between two directions, in [0, PI]. */
function between(u, v) {
  let d = (u - v) % TAU;
  if (d < -Math.PI) d += TAU;
  if (d > Math.PI) d -= TAU;
  return Math.abs(d);
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** Independent intersection by Cramer's rule, as in GeoSDoub.Intersect. */
function appletIntersect(a, b, c, d) {
  const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
  const x3 = c.x, y3 = c.y, x4 = d.x, y4 = d.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) return { x: NaN, y: NaN };
  const q1 = x1 * y2 - y1 * x2, q2 = x3 * y4 - y3 * x4;
  return {
    x: (q1 * (x3 - x4) - (x1 - x2) * q2) / den,
    y: (q1 * (y3 - y4) - (y1 - y2) * q2) / den,
  };
}

/** Independent foot of the perpendicular, as in GeoSDoub.NearestPoint. */
function appletNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/*
 * AltitudeMirror2Canvas.Compute(), transcribed from the bytecode:
 *   Cp0 = Reflect(Cm, A, B); Dp0 = Reflect(Dm, A, B);
 *   if Cp0.y > Cm.y then C = Cm, Cp = Cp0; else C = Cp0, Cp = Cm;
 *   (the same swap for D);
 *   E = Intersect(A, D, B, C); if isNaN(E.y) return;
 *   F = NearestPoint(E, A, B); Ep = Reflect(E, A, B).
 * Angles below AB exercise the else branch of each swap.
 */
function appletCompute(cAngle, dAngle) {
  const cx = B.cx, cy = B.cy, r = B.r;
  const A = { x: cx - r, y: cy }, Bp = { x: cx + r, y: cy };
  const Cm = C.anglePoint(cx, cy, r, cAngle);
  const Dm = C.anglePoint(cx, cy, r, dAngle);
  const Cp0 = C.reflectInAB(Cm, cy), Dp0 = C.reflectInAB(Dm, cy);

  let c, cp, swapC, d, dp, swapD;
  if (Cp0.y > Cm.y) { c = Cm; cp = Cp0; swapC = false; }
  else { c = Cp0; cp = Cm; swapC = true; }
  if (Dp0.y > Dm.y) { d = Dm; dp = Dp0; swapD = false; }
  else { d = Dp0; dp = Dm; swapD = true; }

  const E = appletIntersect(A, d, Bp, c);
  if (Number.isNaN(E.y)) return { valid: false };
  const F = appletNearestPoint(E, A, Bp);
  const Ep = C.reflectInAB(E, cy);
  return { A, B: Bp, C: c, Cp: cp, D: d, Dp: dp, E, F, Ep, swapC, swapD, valid: true };
}

/* ------------------------------------------------------------ 1. the position */

{
  const s = C.start({});
  check("default C lies in the applet's left arc", s.c >= 3 * Math.PI / 4 && s.c <= 7 * Math.PI / 8);
  check("default D lies in the applet's right arc", s.d >= Math.PI / 8 && s.d <= Math.PI / 4);
  check("names start on as in the applet", s.names === true);
  check("hint and statement start off", s.hint === false && s.statement === false);
  check("random start uses the supplied random source", (() => {
    const r = C.start({ random: () => 0 });
    const q = C.start({ random: () => 0.999 });
    return near(r.c, 3 * Math.PI / 4, 1e-12)
      && near(q.d, Math.PI / 8 + (0.999 * Math.PI) / 8, 1e-12);
  })());
  check("start clamps angles outside the arcs", (() => {
    const s2 = C.start({ c: -5, d: 99 });
    return s2.c === C.C_MIN && s2.d === C.D_MAX;
  })());
  check("start does not keep a reference to the caller's options", (() => {
    const o = { c: 2.4, d: 0.6 };
    const a = C.start(o); o.c = 0.1; o.d = 3;
    return a.c > 2 && a.d < 1;
  })());
  check("an illustration never finishes", C.result(C.start({})) === null);
}

/* ---------------------------------------------------- 2. legal moves only */

{
  const s = C.start({ c: 2.4, d: 0.6 });
  check("moving C changes only C", (() => {
    const t = C.move(s, { which: "C", angle: 2.9 });
    return t.c === 2.9 && t.d === s.d && s.c === 2.4;
  })());
  check("moving D changes only D", (() => {
    const t = C.move(s, { which: "D", angle: 0.4 });
    return t.d === 0.4 && t.c === s.c && s.d === 0.6;
  })());
  check("a handle is clamped at the ends of its arc", (() => {
    return C.move(s, { which: "C", angle: 9 }).c === C.C_MAX
      && C.move(s, { which: "D", angle: -9 }).d === C.D_MIN;
  })());
  check("unknown moves are refused", C.move(s, { which: "nowhere", angle: 1 }) === null
    && C.move(s, { which: "C" }) === null && C.move(null, { which: "C", angle: 1 }) === null);
  check("non-finite angles are refused", C.move(s, { which: "C", angle: NaN }) === null
    && C.move(s, { which: "D", angle: Infinity }) === null);
  check("the three checkboxes flip without touching the angles", (() => {
    let t = C.move(s, { which: "hint" });
    t = C.move(t, { which: "names" });
    t = C.move(t, { which: "statement" });
    return t.hint && !t.names && t.statement && t.c === 2.4 && t.d === 0.6;
  })());
  check("random move uses its source and keeps the flags", (() => {
    const t = C.move({ ...s, hint: true }, { which: "random", random: () => 0.5 });
    return near(t.c, 13 * Math.PI / 16, 1e-12) && near(t.d, 3 * Math.PI / 16, 1e-12) && t.hint;
  })());
  check("dragging a board point stays on its arc", (() => {
    for (let i = 0; i < 200; i++) {
      const q = { x: -300 + i * 3, y: -200 + (i * 137) % 400 };
      for (const w of ["C", "D"]) {
        const p = C.constrain(w, q);
        if (!near(Math.hypot(p.x - B.cx, p.y - B.cy), B.r, 1e-9)) return false;
        const a = Math.atan2(B.cy - p.y, p.x - B.cx);
        if (a < C.clampAngle(w, a) - 1e-12) return false;
      }
    }
    return true;
  })());
}

/* ------------------------------- 3. every claim, on a grid and at random */

const rand = rng(20261126);
const configs = [];
for (let i = 0; i < 40; i++) {
  for (let j = 0; j < 40; j++) {
    configs.push({
      c: C.C_MIN + (C.C_MAX - C.C_MIN) * (i / 39),
      d: C.D_MIN + (C.D_MAX - C.D_MIN) * (j / 39),
    });
  }
}
for (let i = 0; i < 600; i++) {
  configs.push({ c: 0.12 * Math.PI + 0.76 * Math.PI * rand(), d: 0.12 * Math.PI + 0.76 * Math.PI * rand() });
}

{
  let circle = true, reflected = true, right = true, ortho = true;
  let footOK = true, pascalF = true, pascalE = true, collinear = true;
  let vertical = true, bisect = true, exactHalf = true, totalAngle = true, valid = true;
  let worstAngle = 0, worstHalf = 0, worstCross = 0;

  for (const { c, d } of configs) {
    const g = C.geometry({ c, d });
    const m = C.claims({ c, d });
    const acg = appletCompute(c, d);
    valid = valid && g.valid && acg.valid;

    for (const p of [g.C, g.D, g.Cp, g.Dp]) {
      if (!near(Math.hypot(p.x - B.cx, p.y - B.cy), B.r, 1e-8)) circle = false;
    }
    if (!near(g.Cp.x, g.C.x, 1e-9) || !near(g.Cp.y, 2 * B.cy - g.C.y, 1e-9)) reflected = false;
    if (!near(g.Dp.x, g.D.x, 1e-9) || !near(g.Dp.y, 2 * B.cy - g.D.y, 1e-9)) reflected = false;

    /* Thales: the angles ACB and ADB are right angles. */
    if (Math.abs(m.acb) > 1e-6 * B.r * B.r || Math.abs(m.adb) > 1e-6 * B.r * B.r) right = false;
    /* AD, BC and EF are the three altitudes of triangle ABS. */
    if (Math.abs(m.altitudeA) > 1e-6 * B.r * B.r || Math.abs(m.altitudeB) > 1e-6 * B.r * B.r) ortho = false;
    if (Math.abs(m.altitudeS) > 1e-8) ortho = false;

    /* F is the foot from E; the reflected E is E' of the Pascal hexagon. */
    const ownFoot = appletNearestPoint(g.E, g.A, g.B);
    if (dist(ownFoot, g.F) > 1e-8) footOK = false;
    if (dist(C.reflectInAB(g.E, B.cy), g.Ep) > 1e-9) footOK = false;

    /* The remaining two Pascal points, computed independently. */
    const fp = appletIntersect(g.D, g.Cp, g.C, g.Dp);
    const e2 = appletIntersect(g.Cp, g.B, g.Dp, g.A);
    if (!Number.isFinite(fp.x) || dist(fp, g.F) > 1e-6) pascalF = false;
    if (!Number.isFinite(e2.x) || dist(e2, g.Ep) > 1e-6) pascalE = false;
    if (m.fpGap > 1e-6 || m.e2Gap > 1e-6) { pascalF = false; pascalE = false; }

    /* Pascal line: E, F and E' are collinear, vertically through F. */
    const denom = dist(g.E, g.F) * dist(e2, g.F);
    const cross = denom ? Math.abs(m.pascalCross) / denom : Math.abs(m.pascalCross);
    worstCross = Math.max(worstCross, cross);
    if (cross > 1e-9 || Math.abs(m.sameVertical) > 1e-6) { collinear = false; vertical = false; }
    if (!near(g.E.x, g.F.x, 1e-8)) vertical = false;

    /* The mirror property: EF bisects angle CFD. Use directions from F,
     * not the core's angle() helper, so this is an independent reading. */
    const toC = Math.atan2(g.C.y - g.F.y, g.C.x - g.F.x);
    const toD = Math.atan2(g.D.y - g.F.y, g.D.x - g.F.x);
    const toE = Math.atan2(g.E.y - g.F.y, g.E.x - g.F.x);
    const left = between(toC, toE), right = between(toE, toD);
    const half = Math.abs(c - d) / 2;
    worstAngle = Math.max(worstAngle, Math.abs(left - right));
    worstHalf = Math.max(worstHalf, Math.abs(left - half));
    if (Math.abs(left - right) > 1e-8) bisect = false;
    if (Math.abs(left - half) > 1e-8 || Math.abs(right - half) > 1e-8) exactHalf = false;
    if (Math.abs(m.angleCFE - m.angleEFD) > 1e-9 || Math.abs(m.angleCFD - Math.abs(c - d)) > 1e-9) bisect = false;
    if (!near(m.halfAngle, half, 1e-12)) totalAngle = false;
  }

  check(`construction is defined for all ${configs.length} configurations`, valid);
  check("C, D and their reflections lie on the circle", circle);
  check("C' and D' are the reflections of C and D in AB", reflected);
  check("the inscribed angles ACB and ADB are right", right);
  check("E is the orthocenter: AD, BC and EF are altitudes", ortho);
  check("F is the foot of the perpendicular from E", footOK);
  check("F is the Pascal point DC' n CD'", pascalF);
  check("E' is the Pascal point C'B n D'A", pascalE);
  check(`E, F, E' are collinear (worst cross ${worstCross.toExponential(2)})`, collinear);
  check("the Pascal line is perpendicular to AB through F", vertical);
  check(`EF bisects angle CFD (worst gap ${worstAngle.toExponential(2)})`, bisect);
  check(`each half-angle equals |C-D|/2 (worst ${worstHalf.toExponential(2)})`, exactHalf);
  check("angle CFD equals |C-D|", totalAngle);
}

/* ------------------------- 4. the applet's own Compute(), transcribed twice */

{
  let sameUpper = true, sameMirrored = true, swapped = false, samePascal = true;
  for (const { c, d } of configs) {
    const g = C.geometry({ c, d });
    const a = appletCompute(c, d);
    for (const name of ["C", "Cp", "D", "Dp", "E", "F", "Ep"]) {
      if (dist(a[name], g[name]) > 1e-8) sameUpper = false;
    }
    /* Put both handles below AB: Compute() must swap each with its reflection.
     * The resulting construction must be the same as the upper one. */
    const m = appletCompute(-c, -d);
    if (m.swapC && m.swapD) swapped = true;
    for (const name of ["C", "Cp", "D", "Dp", "E", "F", "Ep"]) {
      if (dist(m[name], g[name]) > 1e-8) sameMirrored = false;
    }
    const fp = appletIntersect(a.D, a.Cp, a.C, a.Dp);
    const e2 = appletIntersect(a.Cp, a.B, a.Dp, a.A);
    if (dist(fp, a.F) > 1e-6 || dist(e2, a.Ep) > 1e-6) samePascal = false;
  }
  check(`core matches the bytecode Compute() on all ${configs.length} upper-half cases`, sameUpper);
  check("core matches Compute() with both handles reflected below AB", sameMirrored);
  check("the bytecode's swap branch is exercised", swapped);
  check("the bytecode's points give the same Pascal intersections", samePascal);
}

/* ------------------------------------------------------------- 5. degenerate */

{
  const s = { c: 2.4, d: 0.6 };
  check("start/move/geometry never modify the position", (() => {
    const before = JSON.stringify(s);
    C.geometry(s); C.claims(s); C.move(s, { which: "C", angle: 1.7 });
    return JSON.stringify(s) === before;
  })());
  equal("result of an illustration is null", C.result(s), null);
  check("a new position is independent of the previous one", (() => {
    const a = C.start({}); const b = C.start({});
    a.c = 1; return b.c !== 1;
  })());
}

done("altitude-mirror-2");
