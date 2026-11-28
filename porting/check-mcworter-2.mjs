#!/usr/bin/env node
"use strict";

/*
 * Logic test for mcworter-2/mcworter-2-core.js.
 *
 *   node porting/check-mcworter-2.mjs
 *
 * Checked: the start position against McWorter2Canvas.init, both scrollbar
 * ranges and their conversion in McWorter2Panel.adjustmentValueChanged, and a
 * second literal transcription of Compute, ComputePoint,
 * CompleteParallelogram, Midpoint and FormSquare over every one of the
 * 49 × 181 reachable slider pairs, over a grid of positions of C and over random
 * triangles. The page's claims are checked on all of them: M = b(1+c)/2 is
 * independent of C, the two flanks are similar parallelograms with equal
 * angles, and at the default settings they are squares. The collapsed case
 * K = 0 is checked separately: the midpoint claim survives, the angle claim
 * does not (the parallelograms have zero sides).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("mcworter-2/mcworter-2-core.js", "Mcworter2Core");

const HALF_PI = Math.PI / 2;
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const state = (A, B, Cc, coef = 0, angle = 0) =>
  C.start({ points: { A, B, C: Cc }, coef, angle });

/* ---------------------- the applet's own methods, transcribed a second time */

/* GeoSDoub.Rotate(P, Q, angle, orientation), read from its bytecode. */
function jRotate(P0, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(
    P0.x + cs * (Q.x - P0.x) - orientation * sn * (Q.y - P0.y),
    P0.y + orientation * sn * (Q.x - P0.x) + cs * (Q.y - P0.y),
  );
}

/* McWorter2Panel.adjustmentValueChanged: slider values -> Angle and K. */
function jSettings(coefValue, angleValue) {
  return {
    K: (coefValue + 20) / 20,
    angle: (angleValue + 90) * Math.PI / 180,
  };
}

/* McWorter2Canvas.ComputePoint(out, pivot, point): out = pivot + K(rot − pivot). */
function jComputePoint(out, pivot, point, angle, K) {
  const r = jRotate(pivot, point, angle, -1);
  out.x = pivot.x + K * (r.x - pivot.x);
  out.y = pivot.y + K * (r.y - pivot.y);
}

/* McWorter2Canvas.CompleteParallelogram(out, p, q, r): out = p + q − r. */
function jComplete(out, p, q, r) {
  out.x = p.x + q.x - r.x;
  out.y = p.y + q.y - r.y;
}

/* McWorter2Canvas.Compute, with all four scratch points written in place. */
function jFigure(s) {
  const { K, angle } = jSettings(s.coef, s.angle);
  const Ac = P(0, 0), Ab = P(0, 0), Ba = P(0, 0), Bc = P(0, 0);
  jComputePoint(Ac, s.C, s.B, angle, K);
  jComplete(Ab, Ac, s.B, s.C);
  jComputePoint(Ba, s.A, s.C, angle, K);
  jComplete(Bc, Ba, s.C, s.A);
  const M = P((Ba.x + Ab.x) / 2, (Ba.y + Ab.y) / 2);
  return { A: s.A, B: s.B, C: s.C, Ab, Ac, Ba, Bc, M };
}

/* McWorter2Canvas.init for a width × height canvas. */
function jStart(width, height) {
  const cx = width / 2, cy = height / 2, dx = width / 8, dy = height / 4;
  return state(P(cx - dx, cy + dy), P(cx + dx, cy + dy),
    P(cx + dx / 2, cy - dy * 3 / 2));
}

/* FormSquare from the sibling applet: only used to check K=1, angle=90°. */
function jSquare(a, b, corner1, corner2) {
  const r1 = jRotate(a, b, HALF_PI, 1);
  corner1.x = r1.x; corner1.y = r1.y;
  const r2 = jRotate(b, a, HALF_PI, -1);
  corner2.x = r2.x; corner2.y = r2.y;
}

/* ------------------------------------------- 1. start and the two scrollbars */

{
  const s = C.start();
  equal("start is the applet's 400×250 diagram", s, jStart(400, 250));
  equal("a custom canvas follows init's formulas",
    C.start({ width: 800, height: 500 }), jStart(800, 500));
  check("coefficient slider starts at 0, i.e. K = 1", s.coef === 0 && C.settings(s).K === 1);
  check("angle slider starts at 0, i.e. 90°",
    s.angle === 0 && close(C.settings(s).degrees, 90, 1e-12));
  check("names start on, as in the embedded explanatory applet", s.showNames === true);
  check("an illustration has no result", C.result(s) === null);
  check("the reachable scrollbar ranges are the applet's (maximum − visible)",
    C.COEF_MIN === -20 && C.COEF_MAX === 30 - 2 &&
    C.ANGLE_MIN === -90 && C.ANGLE_MAX === 100 - 10);
  check("coefficient converts (value+20)/20", (() => {
    for (let v = C.COEF_MIN; v <= C.COEF_MAX; v++) {
      if (!close(C.settings(C.withOption(s, "coef", v)).K, jSettings(v, 0).K, 1e-12)) return false;
    }
    return true;
  })());
  check("angle converts (value+90)°", (() => {
    for (let v = C.ANGLE_MIN; v <= C.ANGLE_MAX; v++) {
      if (!close(C.settings(C.withOption(s, "angle", v)).degrees,
        jSettings(0, v).angle * 180 / Math.PI, 1e-9)) return false;
    }
    return true;
  })());
  check("sliders clamp and round to the applet's integer values", (() => {
    const a = C.withOption(C.withOption(s, "coef", -999), "angle", 999);
    const b = C.withOption(C.withOption(s, "coef", 999), "angle", -999);
    const c = C.withOption(s, "coef", 1.6);
    return a.coef === -20 && a.angle === 90 && b.coef === 28 && b.angle === -90 && c.coef === 2;
  })());
  check("unknown options and handles change nothing", (() => {
    const p = C.withPoint(s, "Z", P(9, 9));
    const o = C.withOption(s, "Z", 9);
    return p.A.x === s.A.x && p.B.y === s.B.y && o.coef === s.coef && o.showNames === s.showNames;
  })());
  check("moves never change the position they are given", (() => {
    const moved = C.withPoint(s, "C", P(20, 30));
    return s.C.x !== 20 && moved.A.x === s.A.x && moved.showNames === s.showNames;
  })());
}

/* ------------------------------- 2. the default diagram reduces to squares */

{
  const s = C.start();
  const f = C.figure(s);
  const theirs = jFigure(s);
  for (const key of ["Ab", "Ac", "Ba", "Bc", "M"]) {
    check(`default ${key} matches the applet's Compute`, closePoint(f[key], theirs[key], 1e-9));
  }
  /* At K = 1 and a quarter turn, AB and BA are the squares' far corners. */
  const Ab = P(0, 0), Ac = P(0, 0), Bc = P(0, 0), Ba = P(0, 0);
  jSquare(s.B, s.C, Ab, Ac);
  jSquare(s.C, s.A, Bc, Ba);
  check("default A_b is the square's far corner on BC", closePoint(f.Ab, Ab, 1e-9));
  check("default A_c is the other square corner on BC", closePoint(f.Ac, Ac, 1e-9));
  check("default B_a is the square's far corner on CA", closePoint(f.Ba, Ba, 1e-9));
  check("default B_c is the other square corner on CA", closePoint(f.Bc, Bc, 1e-9));
  check("default flanks are squares", C.defaultSquares(s));
  check("default midpoint equals the square's centre", closePoint(f.M,
    P((s.A.x + s.B.x + s.B.y - s.A.y) / 2, (s.A.y + s.B.y - s.B.x + s.A.x) / 2), 1e-9));
  const cl = C.claims(s);
  for (const [key, value] of Object.entries(cl)) check(`default claim ${key}`, value);
}

/* ---------------------- 3. every slider pair: second transcription + claims */

{
  const base = state(P(110, 190), P(310, 190), P(225, 40));
  let tested = 0;
  let allMatch = true, allMidpoints = true, allParallelograms = true;
  let allSimilar = true, allAngles = true, allIndependent = true;
  for (let coef = C.COEF_MIN; coef <= C.COEF_MAX; coef++) {
    for (let angle = C.ANGLE_MIN; angle <= C.ANGLE_MAX; angle++) {
      const s = C.withOption(C.withOption(base, "coef", coef), "angle", angle);
      const f = C.figure(s), theirs = jFigure(s);
      for (const key of ["Ab", "Ac", "Ba", "Bc", "M"]) {
        if (!closePoint(f[key], theirs[key], 1e-8 * Math.max(1, dist(s.A, s.B)))) allMatch = false;
      }
      const cl = C.claims(s);
      if (!cl.midpointIndependent) allMidpoints = false;
      if (!cl.independenceOverC) allIndependent = false;
      if (!cl.parallelograms) allParallelograms = false;
      if (!cl.similar) allSimilar = false;
      /* At coef = −20 the multiplier K is 0: both flanks collapse onto
       * their sides and the angle between their zero-length edges is undefined. */
      if (!cl.equalAngles && coef !== C.COEF_MIN) allAngles = false;
      if (coef === C.COEF_MIN && cl.equalAngles) allAngles = false;
      tested++;
    }
  }
  check(`all ${tested} slider pairs match the second transcription`, allMatch);
  check("M = b(1+c)/2 on every slider pair", allMidpoints);
  check("M ignores C on every slider pair", allIndependent);
  check("both flanks close as parallelograms on every slider pair", allParallelograms);
  check("both flanks are similar on every slider pair", allSimilar);
  check("equal angles hold on every non-collapsed slider pair", allAngles);
  check("only the default settings give squares", C.defaultSquares(C.start()) &&
    !C.defaultSquares(C.withOption(base, "angle", 30)) &&
    !C.defaultSquares(C.withOption(base, "coef", 1)));
}

/* -------------------- 4. M does not move as C travels: a grid of triangles */

{
  const A = P(120, 180), B = P(320, 180);
  const settings = [[0, 0], [-7, 30], [11, -40], [20, 90], [-20, 100], [4, 12]];
  let tested = 0, fixed = true, matches = true;
  for (const [coef, angle] of settings) {
    const expected = C.claimedMidpoint(state(A, B, P(200, 50), coef, angle));
    for (let gx = 0; gx < 12; gx++) {
      for (let gy = 0; gy < 10; gy++) {
        const s = state(A, B, P(20 + gx * 30, 20 + gy * 24), coef, angle);
        if (!closePoint(C.figure(s).M, expected, 1e-8)) fixed = false;
        if (!closePoint(C.figure(s).M, jFigure(s).M, 1e-8)) matches = false;
        tested++;
      }
    }
  }
  check(`M stayed put at ${tested} positions of C across six settings`, fixed);
  check("the grid agrees with the applet's Compute at every setting", matches);
  check("the closed form agrees with the applet far from the base", closePoint(
    C.figure(state(A, B, P(-3000, 1200), 13, 70)).M,
    jFigure(state(A, B, P(-3000, 1200), 13, 70)).M, 1e-7));
}

/* ---------------------- 5. random configurations, including tilted triangles */

{
  const rand = rng(6292);
  let tested = 0, figures = true, claimsOk = true;
  for (let trial = 0; trial < 500; trial++) {
    const s = state(
      P(30 + rand() * 340, 30 + rand() * 190),
      P(30 + rand() * 340, 30 + rand() * 190),
      P(30 + rand() * 340, 30 + rand() * 190),
      Math.round(-20 + rand() * 50),
      Math.round(-90 + rand() * 190),
    );
    const tol = 1e-8 * Math.max(1, dist(s.A, s.B), dist(s.A, s.C));
    const f = C.figure(s), theirs = jFigure(s);
    for (const key of ["Ab", "Ac", "Ba", "Bc", "M"]) {
      if (!closePoint(f[key], theirs[key], tol)) figures = false;
    }
    const cl = C.claims(s);
    for (const [key, value] of Object.entries(cl)) {
      if (key === "equalAngles" && s.coef === C.COEF_MIN) {
        if (value) claimsOk = false;
      } else if (!value) claimsOk = false;
    }
    tested++;
  }
  check(`all ${tested} random figures match the second transcription`, figures);
  check(`all claims hold on ${tested} random configurations`, claimsOk);
}

/* ----------------------------------- 6. rotation and the degenerate setting */

{
  const O = P(13, -7), Q = P(-41, 29);
  for (const orientation of [1, -1]) {
    for (const angle of [0, HALF_PI, Math.PI, 7 * HALF_PI / 3]) {
      equal(`Rotate matches the bytecode at ${angle.toFixed(3)}, ${orientation}`,
        C.rotate(O, Q, angle, orientation), jRotate(O, Q, angle, orientation));
    }
  }
  check("opposite quarter turns cancel", closePoint(
    C.rotate(O, C.rotate(O, Q, HALF_PI, 1), HALF_PI, -1), Q, 1e-9));
  check("a clockwise quarter turn is multiplication by −i", closePoint(
    C.rotate(P(0, 0), Q, HALF_PI, -1), P(Q.y, -Q.x), 1e-9));
  check("ComputePoint is rotate scaled from the pivot", (() => {
    const pivot = P(40, 12), point = P(-8, 77), K = 1.7, angle = 1.1;
    const r = C.rotate(pivot, point, angle, -1);
    const got = C.computePoint(pivot, point, angle, K);
    return closePoint(got, P(pivot.x + K * (r.x - pivot.x),
      pivot.y + K * (r.y - pivot.y)), 1e-9);
  })());
  const collapsed = state(P(100, 200), P(300, 200), P(180, 90), C.COEF_MIN, 0);
  const f = C.figure(collapsed);
  check("K = 0 collapses B_a onto A and A_b onto B",
    closePoint(f.Ba, collapsed.A, 1e-9) && closePoint(f.Ab, collapsed.B, 1e-9));
  check("K = 0 still gives the claimed midpoint", closePoint(f.M,
    C.claimedMidpoint(collapsed), 1e-9));
  check("K = 0 has no equal-angle claim", C.claims(collapsed).equalAngles === false);
  check("all positions stay unfinished illustrations",
    C.result(C.start()) === null && C.result(collapsed) === null);
}

done("mcworter-2");
