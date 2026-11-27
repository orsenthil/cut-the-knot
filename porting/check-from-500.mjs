#!/usr/bin/env node
"use strict";

/*
 * Logic test for from-500/from-500-core.js.
 *
 *   node porting/check-from-500.mjs
 *
 * 1. The two switches, the two draggable points, Reset and the demo's "explored"
 *    result.
 * 2. The cut-the-knot page's claim, over every whole degree of the circle,
 *    several grid sizes and thousands of seeded random pictures: the tangent
 *    at X, the line YZ and the diameter AB are either parallel or meet at P;
 *    U is the midpoint of AY, V the midpoint of BZ, and UA = UX = UY,
 *    VB = VX = VZ. An independent closed-form solution checks the same points.
 * 3. From500Canvas.Perp and GeoSDoub.Intersect (general-form coefficients, the
 *    |det| < 1 NaN cut-off) are transcribed a second time straight from the
 *    javap output and compared with the core's construction on every sample.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("from-500/from-500-core.js", "From500Core");

/* ------------------------------------------- a second transcription of the applet */

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });

/** From500Canvas.Perp(p,q), from javap: the second point is
 *  (p.x + (q.y - p.y)*10, p.y - (q.x - p.x)*10). */
function appletPerp(p, q) {
  return {
    p,
    q: { x: p.x + (q.y - p.y) * 10.0, y: p.y - (q.x - p.x) * 10.0 },
  };
}

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), from javap.
 *  coefficients a1,b1,c1; a2,b2,c2; numerator x/y; det; |det|<1 -> NaN. */
function appletIntersect(l, m) {
  const a1 = l.p.y - l.q.y;
  const b1 = l.q.x - l.p.x;
  const c1 = l.p.x * l.q.y - l.p.y * l.q.x;
  const a2 = m.p.y - m.q.y;
  const b2 = m.q.x - m.p.x;
  const c2 = m.p.x * m.q.y - m.p.y * m.q.x;
  const nx = b1 * c2 - b2 * c1;
  const ny = c1 * a2 - c2 * a1;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: nx / det, y: ny / det };
}

/** From500Canvas.Draw's line construction, in bytecode order. */
function appletDraw(state) {
  const O = state.O, X = state.X;
  const r = Math.hypot(O.x - X.x, O.y - X.y); // GeoSDoub.Dist
  const A = { x: O.x - r, y: O.y };
  const B = { x: O.x + r, y: O.y };
  const TA = appletPerp(A, O);
  const TB = appletPerp(B, O);
  const TX = appletPerp(X, O);
  const XB = { p: X, q: B };
  const XA = { p: X, q: A };
  const Y = appletIntersect(TA, XB);
  const Z = appletIntersect(TB, XA);
  const YZ = { p: Y, q: Z };
  return {
    A, B, r,
    Y, Z,
    P: appletIntersect(YZ, TX),
    U: appletIntersect(TA, TX),
    V: appletIntersect(TB, TX),
  };
}

/* ------------------------------------------------- independent closed-form values */

/** With X = O + (r cos t, -r sin t), write u = r cos t, v = r sin t.
 *  U = (-r, r cot(t/2)) and Y = (-r, 2r cot(t/2)) above A; V and Z use
 *  tan(t/2) above B; the meeting point is P = (r / cos t, 0) on AB extended.
 *  This is a third, algebraic derivation of the page's claim. */
function analytic(O, X) {
  const u = X.x - O.x, v = O.y - X.y;
  const r = Math.hypot(u, v);
  const cot = (r + u) / v; // cot(t/2)
  const tan = (r - u) / v; // tan(t/2)
  return {
    r,
    U: { x: O.x - r, y: O.y - r * cot },
    Y: { x: O.x - r, y: O.y - 2 * r * cot },
    V: { x: O.x + r, y: O.y - r * tan },
    Z: { x: O.x + r, y: O.y - 2 * r * tan },
    P: Math.abs(u) < 1e-9 ? null : { x: O.x + (r * r) / u, y: O.y },
  };
}

/** Relative distance, so huge near-parallel coordinates are compared fairly. */
const close = (p, q, tol = 1e-6) => {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    return !Number.isFinite(q.x) && !Number.isFinite(q.y);
  }
  if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return false;
  const scale = Math.max(1, Math.abs(p.x), Math.abs(p.y), Math.abs(q.x), Math.abs(q.y));
  return Math.hypot(p.x - q.x, p.y - q.y) <= tol * scale;
};

/* ------------------------------------------------------------- configurations */

const exact = [];
const O0 = C.O_START;
for (let deg = 1; deg < 360; deg++) {
  const a = (deg * Math.PI) / 180;
  exact.push(C.start({ O: O0, X: { x: O0.x + 60 * Math.cos(a), y: O0.y - 60 * Math.sin(a) } }));
}
for (const O of [{ x: 80, y: 80 }, { x: 250, y: 320 }, { x: 420, y: 140 }]) {
  for (const r of [30, 60, 90]) {
    for (const deg of [15, 37, 60, 90, 121, 150, 213, 270, 305]) {
      const a = (deg * Math.PI) / 180;
      exact.push(C.start({ O, X: { x: O.x + r * Math.cos(a), y: O.y - r * Math.sin(a) } }));
    }
  }
}
const random = [];
const next = rng(5112);
for (let i = 0; i < 20000 && random.length < 4000; i++) {
  const O = { x: 40 + next() * 420, y: 40 + next() * 320 };
  const X = { x: 20 + next() * 460, y: 20 + next() * 360 };
  if (C.dist(O, X) < 20) continue;
  random.push(C.start({ O, X }));
}
const sample = [...exact, ...random];
const midpoints = exact.filter((s) => Math.abs(C.dist(s.O, s.X) - 60) < 1e-9
  && Math.abs(s.X.x - s.O.x) < 1e-9).length;

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  check("opening centre is the applet's (width/3, 3*height/4)",
    s.O.x === C.WIDTH / 3 && s.O.y === (C.HEIGHT * 3) / 4);
  check("opening radius is the applet's 60", Math.abs(C.dist(s.O, s.X) - C.RADIUS) < 0.01);
  check("opening X is in the applet's random angle range", (() => {
    const a = Math.atan2(s.O.y - s.X.y, s.X.x - s.O.x);
    return a >= C.ANGLE_MIN - 1e-12 && a <= C.ANGLE_MAX + 1e-12;
  })());
  check("both applet checkboxes start unticked (the page passes no ShowNames parameter)",
    s.showNames === false && s.showHint === false);
  check("a picture has no result until it has been explored", C.result(s) === null);
  equal("opening counters", [s.moves, s.explored], [0, false]);
  check("legal moves are the two points, two switches and Reset", C.legalMoves(s).length === 5);
  const g = C.compute(s);
  check("the opening picture is drawable and concurrent", g.valid && !g.parallel && C.finite(g.P));
}

/* ------------------------------------------------------ 2. moves and options */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "X", point: { x: 300, y: 180 } });
  check("dragging X moves only X and marks the picture explored",
    moved && moved.X.x === 300 && moved.X.y === 180 && moved.O.x === s.O.x
      && C.result(moved) === "done" && moved.moves === 1);
  const off = C.move(s, { type: "point", name: "O", point: { x: -50, y: 9999 } });
  check("a centre dragged off the board stays inside it",
    off && off.O.x >= C.MARGIN && off.O.y <= C.HEIGHT - C.MARGIN);
  const collapsed = C.move(s, { type: "point", name: "X", point: { x: s.O.x, y: s.O.y } });
  check("X cannot collapse the circle to radius zero", C.dist(collapsed.O, collapsed.X) >= C.MIN_RADIUS - 1e-9);
  check("an unknown point, switch or move is refused",
    C.move(s, { type: "point", name: "Y", point: s.X }) === null
      && C.move(s, { type: "option", key: "wrong", value: true }) === null
      && C.move(s, { type: "frobnicate" }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("both applet switches can be ticked", C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 2);
  check("switching does not move either point", C.HANDLES.every((n) => C.dist(s[n], t[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("Reset restores the opening points but keeps the switches",
    C.HANDLES.every((n) => C.dist(s[n], reset[n]) === 0)
      && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("a move leaves the position it came from untouched", s.moves === 0 && !s.explored && !s.showHint);
  const degenerate = C.compute(C.start({ X: { x: s.O.x + 60, y: s.O.y } }));
  check("X on the diameter gives no Y and Z (the secants collapse)", !degenerate.valid && degenerate.reason === "diameter");
}

/* --------------------------------------- 3. the page's claim over every sample */

{
  let worst = Object.create(null);
  let parallel = 0, concurrent = 0, checked = 0;
  let minP = Infinity, maxP = 0;
  for (const state of sample) {
    const g = C.compute(state);
    if (!g.valid) continue;
    if (g.parallel) {
      parallel++;
      const r = C.residuals(g);
      if (r.parallelTX > 1e-8 || r.parallelYZ > 1e-8) {
        throw new Error("a parallel picture has a non-parallel line");
      }
      continue;
    }
    concurrent++;
    const r = C.residuals(g);
    for (const k of Object.keys(r)) worst[k] = Math.max(worst[k] || 0, r[k]);
    checked++;
    const xOnLine = C.finite(analytic(state.O, state.X).P);
    if (xOnLine) {
      const ratio = Math.abs(g.P.x - state.O.x);
      minP = Math.min(minP, ratio);
      maxP = Math.max(maxP, ratio);
    }
  }
  check(`every valid configuration is parallel or concurrent (${sample.length} pictures, ${parallel} parallel, ${concurrent} concurrent)`,
    parallel + concurrent > 4000 && checked > 4000);
  check("U and V are the midpoints of AY and BZ",
    worst.UIsMidpointAY < 1e-7 && worst.VIsMidpointBZ < 1e-7,
    `${worst.UIsMidpointAY} / ${worst.VIsMidpointBZ}`);
  check("UA = UX = UY (equal tangents from U and the median to the hypotenuse)",
    worst.UATangents < 1e-6, `${worst.UATangents}`);
  check("VB = VX = VZ", worst.VBTangents < 1e-6, `${worst.VBTangents}`);
  check("U lies on TA and on TX, V on TB and on TX",
    Math.max(worst.UOnTA, worst.UOnTX, worst.VOnTB, worst.VOnTX) < 1e-7);
  check("Y is TA crossed with XB, Z is TB crossed with XA",
    Math.max(worst.YOnTA, worst.YOnXB, worst.ZOnTB, worst.ZOnXA) < 1e-7);
  check("all three drawn tangents are perpendicular to their radii",
    Math.max(worst.tangentAtA, worst.tangentAtB, worst.tangentAtX) < 1e-9);
  check("P lies on the tangent at X and on YZ", Math.max(worst.POnTX, worst.POnYZ) < 1e-7);
  check("the page's claim: P also lies on the diameter AB", worst.POnAB < 1e-7, `${worst.POnAB}`);
  check("a parallel picture really has TX and YZ parallel to AB", parallel > 0, `${parallel} cases`);
  check("both midpoint configurations of the arc are covered", midpoints >= 2, `${midpoints}`);
  check("P moves from near the circle to far away as X approaches the top", minP < 30 && maxP > 100,
    `${minP.toFixed(2)}..${maxP.toFixed(0)}`);
}

/* --------------------------------- 4. the third, closed-form transcription */

{
  let worstP = 0, worstU = 0, worstV = 0, worstY = 0, worstZ = 0, compared = 0;
  for (const state of sample) {
    const g = C.compute(state);
    if (!g.valid || g.parallel) continue;
    const a = analytic(state.O, state.X);
    if (!a.P) continue;
    worstP = Math.max(worstP, Math.hypot(g.P.x - a.P.x, g.P.y - a.P.y) / Math.max(1, Math.abs(a.P.x)));
    worstU = Math.max(worstU, Math.hypot(g.U.x - a.U.x, g.U.y - a.U.y) / a.r);
    worstV = Math.max(worstV, Math.hypot(g.V.x - a.V.x, g.V.y - a.V.y) / a.r);
    worstY = Math.max(worstY, Math.hypot(g.Y.x - a.Y.x, g.Y.y - a.Y.y) / a.r);
    worstZ = Math.max(worstZ, Math.hypot(g.Z.x - a.Z.x, g.Z.y - a.Z.y) / a.r);
    compared++;
  }
  check(`closed-form U=(-r,r cot(t/2)), V=(r,r tan(t/2)) match every picture (${compared})`,
    worstU < 1e-7 && worstV < 1e-7, `${worstU} / ${worstV}`);
  check("closed-form Y and Z (twice as far above A and B) match every picture",
    worstY < 1e-6 && worstZ < 1e-6, `${worstY} / ${worstZ}`);
  check("closed-form P = O + (r/cos t, 0) matches the concurrent pictures", worstP < 1e-7, `${worstP}`);
  const top = C.compute(C.start({ X: { x: O0.x, y: O0.y - 60 } }));
  const bottom = C.compute(C.start({ X: { x: O0.x, y: O0.y + 60 } }));
  check("at the top or bottom of the circle all three lines are parallel",
    top.parallel && bottom.parallel);
  check("the page's parallel case occurs when X is in the middle of the arc",
    C.residuals(top).parallelTX < 1e-8 && C.residuals(bottom).parallelYZ < 1e-8);
}

/* --------------------------- 5. the applet's own bytecode, transcribed twice */

{
  let worstU = 0, worstV = 0, worstY = 0, worstZ = 0, worstP = 0;
  let compared = 0, nanBoth = 0, finiteBoth = 0;
  for (const state of sample) {
    const g = C.compute(state);
    if (!g.valid) continue;
    const a = appletDraw(state);
    if (close(a.U, g.U)) worstU = Math.max(worstU, 0);
    else throw new Error("Perp/Intersect gave a different U");
    if (!close(a.V, g.V)) throw new Error("Perp/Intersect gave a different V");
    if (!close(a.Y, g.Y)) throw new Error("Perp/Intersect gave a different Y");
    if (!close(a.Z, g.Z)) throw new Error("Perp/Intersect gave a different Z");
    if (!close(a.P, g.P)) {
      throw new Error(`Perp/Intersect gave a different P: ${a.P.x},${a.P.y} vs ${g.P.x},${g.P.y}`);
    }
    if (!Number.isFinite(a.P.x)) nanBoth += Number.isNaN(g.P.x) ? 1 : 0;
    else finiteBoth++;
    worstU = Math.max(worstU, Math.hypot(a.U.x - g.U.x, a.U.y - g.U.y));
    worstV = Math.max(worstV, Math.hypot(a.V.x - g.V.x, a.V.y - g.V.y));
    worstY = Math.max(worstY, Math.hypot(a.Y.x - g.Y.x, a.Y.y - g.Y.y));
    worstZ = Math.max(worstZ, Math.hypot(a.Z.x - g.Z.x, a.Z.y - g.Z.y));
    if (Number.isFinite(a.P.x)) {
      worstP = Math.max(worstP, Math.hypot(a.P.x - g.P.x, a.P.y - g.P.y) / Math.max(1, Math.abs(a.P.x)));
    }
    compared++;
  }
  check(`Perp and GeoSDoub.Intersect match the core on all ${compared} drawable pictures`,
    compared > 4000 && worstU < 1e-6 && worstV < 1e-6 && worstY < 1e-6 && worstZ < 1e-6 && worstP < 1e-6,
    `U ${worstU}, V ${worstV}, Y ${worstY}, Z ${worstZ}, P ${worstP}`);
  check("the applet's NaN cut-off for parallel lines agrees with the core",
    nanBoth > 0 && nanBoth === sample.filter((s) => C.compute(s).valid && C.compute(s).parallel).length);
  check("concurrent pictures agree on a finite P", finiteBoth > 4000, `${finiteBoth}`);
  const opening = appletDraw(C.start());
  check("the applet's opening P is on AB extended to the right",
    Math.abs(opening.P.y - O0.y) < 1e-9 && opening.P.x > O0.x + C.RADIUS);
  // The det threshold is a pixel-scale test, not an algebraic one.
  const nearly = C.start({ X: { x: O0.x + Math.cos(Math.PI / 2 - 1e-6) * 60,
    y: O0.y - Math.sin(Math.PI / 2 - 1e-6) * 60 } });
  check("a picture within a millionth of a radian of the midpoint is treated as parallel",
    C.compute(nearly).parallel && !Number.isFinite(appletDraw(nearly).P.x));
}

done("from-500");
