#!/usr/bin/env node
"use strict";

/*
 * Logic test for line-circle-and-fixed-points/line-circle-and-fixed-points-core.js.
 *
 *   node porting/check-line-circle-and-fixed-points.mjs
 *
 * 1. The opening picture, the four handles, the four switches and Reset obey
 *    the applet's rules, including the shared line of Q and V.
 * 2. The page's claim is checked over a grid of P on C(O), Q and V on a line,
 *    and many V sweeps: S is always the same fixed point, namely the second
 *    intersection of the line through R∞ (the other point where line PQ
 *    meets C(O)) parallel to QV with C(O). The circle PQV' for V' = PS ∩ QV
 *    is tangent to C(O) at P, as the page's parenthesis says. Ill-conditioned
 *    positions (V making the two circles tangent at P, so R is within a few
 *    pixels of P) are skipped: the applet's Other() uses a fixed threshold of
 *    1 there and its answer is not defined in floating point.
 * 3. LineCircleAndFixedPointsCanvas.Compute is transcribed a second time,
 *    straight from the bytecode, with GeoSDoub's own line intersection,
 *    circumcentre, circle-circle and line-circle intersection formulas. The
 *    core and this transcription are compared on every sample position.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("line-circle-and-fixed-points/line-circle-and-fixed-points-core.js",
  "LineCircleAndFixedPointsCore");

/* ------------------------------- a second, independent transcription of Compute */

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const clone = (p) => ({ x: p.x, y: p.y });

/** GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint). */
function bytecodeIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** GeoSDoub.FindCircumcenter via the two perpendicular bisectors. */
function bytecodeCircumcenter(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  return bytecodeIntersect(
    m1, { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) },
    m2, { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) });
}

/** Canvas.GetCircle: centre plus the mean of the three radii. */
function bytecodeCircle(a, b, c) {
  const center = bytecodeCircumcenter(a, b, c);
  return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
}

function bytecodeCircleX(c1, c2) {
  const a = -(c1.center.y - c2.center.y) / (c1.center.x - c2.center.x);
  const b = (c1.center.x ** 2 - c2.center.x ** 2 + c1.center.y ** 2 - c2.center.y ** 2
    - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.center.x - c2.center.x));
  const m = b - c1.center.x, A = a * a + 1, B = a * m - c1.center.y;
  const Cc = m * m + c1.center.y ** 2 - c1.radius ** 2;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const s = Math.sqrt(D), y1 = (-B + s) / A, y2 = (-B - s) / A;
  return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
}

function bytecodeCircleY(c1, c2) {
  const a = -(c1.center.x - c2.center.x) / (c1.center.y - c2.center.y);
  const b = (c1.center.y ** 2 - c2.center.y ** 2 + c1.center.x ** 2 - c2.center.x ** 2
    - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.center.y - c2.center.y));
  const m = b - c1.center.y, A = a * a + 1, B = a * m - c1.center.x;
  const Cc = m * m + c1.center.x ** 2 - c1.radius ** 2;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const s = Math.sqrt(D), x1 = (-B + s) / A, x2 = (-B - s) / A;
  return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
}

function bytecodeCircles(c1, c2) {
  if (Math.abs(c1.center.x - c2.center.x) > 1) return bytecodeCircleX(c1, c2);
  if (Math.abs(c1.center.y - c2.center.y) > 1) return bytecodeCircleY(c1, c2);
  return [clone(c1.center), clone(c1.center)];
}

function bytecodeLineXCircle(p, q, c) {
  const a = (p.y - q.y) / (p.x - q.x), b = q.y - a * q.x;
  const A = a * a + 1, B = a * (b - c.center.y) - c.center.x;
  const Cc = (b - c.center.y) ** 2 + c.center.x ** 2 - c.radius ** 2;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const s = Math.sqrt(D), x1 = (-B + s) / A, x2 = (-B - s) / A;
  return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
}

function bytecodeLineYCircle(p, q, c) {
  const a = (p.x - q.x) / (p.y - q.y), b = q.x - a * q.y;
  const A = a * a + 1, B = a * (b - c.center.x) - c.center.y;
  const Cc = (b - c.center.x) ** 2 + c.center.y ** 2 - c.radius ** 2;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const s = Math.sqrt(D), y1 = (-B + s) / A, y2 = (-B - s) / A;
  return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
}

function bytecodeLineCircle(p, q, c) {
  if (Math.abs(p.y - q.y) > 1) return bytecodeLineXCircle(p, q, c);
  if (Math.abs(p.x - q.x) > 1) return bytecodeLineYCircle(p, q, c);
  return null;
}

function bytecodeOther(points, reference) {
  if (!points) return null;
  if (dist(points[0], reference) < 1) return points[1];
  return points[0];
}

/** Canvas.Compute() itself, following the bytecode statement by statement. */
function bytecodeCompute(P, Q, V, O) {
  if (dist(V, Q) < 1) return null;
  const circleO = { center: clone(O), radius: dist(O, P) };
  const circleX = bytecodeCircle(P, Q, V);
  const R = bytecodeOther(bytecodeCircles(circleX, circleO), P);
  if (!R) return null;
  const S = bytecodeOther(bytecodeLineCircle(V, R, circleO), R);
  if (!S) return null;
  const T = bytecodeIntersect(S, P, V, Q);
  const circleT = bytecodeCircle(P, Q, T);
  return { circleO, circleX, circleT, R, S, T };
}

/* --------------------------------------------------------------- the sample grid */

const states = [];
const rnd = rng(6062);
for (let i = 0; i < 2400; i++) {
  const O = { x: 70 + rnd() * 260, y: 50 + rnd() * 200 };
  const radius = 25 + rnd() * 50;
  const angle = rnd() * Math.PI * 2;
  const P = { x: O.x + radius * Math.cos(angle), y: O.y + radius * Math.sin(angle) };
  if (P.x < 15 || P.x > C.WIDTH - 15 || P.y < 15 || P.y > C.HEIGHT - 15) continue;
  const lineY = 50 + rnd() * 210;
  if (Math.abs(P.y - lineY) < 10) continue;
  const Q = { x: 60 + rnd() * 280, y: lineY };
  const V0 = { x: Q.x + (Q.x > 200 ? -110 : 110), y: lineY };
  if (V0.x < 15 || V0.x > C.WIDTH - 15 || Math.abs(V0.x - Q.x) < C.MIN_VQ) continue;
  states.push({ P, Q, V: V0, O, showNames: true, showPremise: false,
    showStatement: false, showHint: false, moves: 0, explored: false });
}

/** A position is well-conditioned when R is well away from P: the applet's
 *  Other() only distinguishes points more than 1 unit apart, and a tangent
 *  circle makes R coincide with P. */
function wellConditioned(g, state) {
  return !!g && !!g.circleT && !!g.Sfixed && dist(g.R, state.P) > 5
    && Math.abs(g.V.y - g.R.y) > 3 // the applet's Y-branch divides by dy
    && dist(g.S, g.R) > 5; // near-tangent line VR: S and R coincide
}

/* ------------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  equal("opening points match Canvas.init() fractions", [s.P, s.Q, s.V, s.O], [
    { x: 200, y: 150 }, { x: 300, y: 262.5 }, { x: 100, y: 262.5 }, { x: 140, y: 131.25 },
  ]);
  check("the given circle really passes through P", C.dist(s.P, s.O) > 0);
  check("Q and V start together on one horizontal line", s.Q.y === s.V.y && s.Q.x !== s.V.x);
  check("names start on and the other three boxes start off",
    s.showNames === true && !s.showPremise && !s.showStatement && !s.showHint);
  equal("counters start at zero", [s.moves, s.explored], [0, false]);
  check("the demo has not been explored yet", C.result(s) === null);
  equal("four handles, four switches and Reset are legal", C.legalMoves(s).length, 9);
  check("legal moves name every handle and switch",
    C.legalMoves(s).slice(0, 4).map((m) => m.name).join(",") === "P,Q,V,O"
    && C.legalMoves(s).slice(4, 8).map((m) => m.key).join(",") === C.OPTION_KEYS.join(","));
}

/* -------------------------------------------- 2. dragging, switches and reset */

{
  const s = C.start();
  const q = C.move(s, { type: "point", name: "Q", point: { x: 260, y: 200 } });
  check("dragging Q moves it freely; V keeps its old y",
    q.Q.x === 260 && q.Q.y === 200 && q.V.y === s.V.y);
  const qv = C.move(q, { type: "point", name: "V", point: { x: 200, y: 123 } });
  check("dragging V snaps it onto Q's horizontal line",
    qv.V.y === q.Q.y && qv.V.x === 200);
  check("dragging Q does not change P or O", C.dist(s.P, q.P) === 0 && C.dist(s.O, q.O) === 0);
  const v = C.move(q, { type: "point", name: "V", point: { x: 350, y: 200 } });
  check("dragging V moves it along Q's line, not P's circle",
    v.V.x === 350 && v.V.y === v.Q.y && C.dist(v.V, v.Q) > C.MIN_VQ);
  check("V cannot be dropped on top of Q",
    C.move(v, { type: "point", name: "V", point: { x: v.Q.x, y: v.Q.y } }).V.x !== v.Q.x);
  const p = C.move(s, { type: "point", name: "P", point: { x: 999, y: -999 } });
  check("P stays inside the board", p.P.x <= C.WIDTH - C.EDGE && p.P.y >= C.EDGE);
  const o = C.move(s, { type: "point", name: "O", point: { x: -999, y: 999 } });
  check("O stays inside the board", o.O.x >= C.EDGE && o.O.y <= C.HEIGHT - C.EDGE);
  check("the degenerate case dist(V,Q) < 1 is refused by Compute()",
    C.compute({ ...s, V: { x: s.Q.x + 0.5, y: s.Q.y } }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all four applet boxes can be ticked without moving the points",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 4
    && C.HANDLES.every((n) => C.dist(s[n], t[n]) === 0));
  const reset = C.move(t, { type: "reset" });
  check("Reset restores the opening points and keeps the boxes",
    C.HANDLES.every((n) => C.dist(s[n], reset[n]) === 0)
    && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves do not change the position they were given",
    s.moves === 0 && !s.explored && t.showHint === true && C.result(t) === "done");
  check("an unknown handle, an unknown switch and bad moves are refused",
    C.move(s, { type: "point", name: "Z", point: s.P }) === null
    && C.move(s, { type: "option", key: "wrong", value: true }) === null
    && C.move(s, { type: "option", key: "showHint", value: 1 }) === null
    && C.move(s, null) === null && C.move(null, { type: "reset" }) === null);
  check("any move finishes this picture once it was explored",
    C.result(t) === "done" && C.result(reset) === "done" && C.result(q) === "done");
}

/* ------------------------------------------- 3. the page's claim, over the grid */

{
  let maxFixed = 0, maxOnCircle = 0, maxTangency = 0, maxIncidence = 0;
  let cases = 0;
  for (const s of states) {
    const g = C.compute(s);
    if (!wellConditioned(g, s)) continue;
    maxFixed = Math.max(maxFixed, g.fixedError);
    const r = C.residuals(g);
    for (const key of ["onCircleO", "onCircleX", "onCircleT", "pOnBoth",
      "vrCollinear", "sptCollinear", "tvqCollinear"]) {
      maxIncidence = Math.max(maxIncidence, r[key]);
    }
    maxOnCircle = Math.max(maxOnCircle, Math.abs(C.dist(g.O, g.S) - g.circleO.radius));
    const dXO = C.dist(g.circleT.center, g.O);
    maxTangency = Math.max(maxTangency,
      Math.min(Math.abs(dXO - (g.circleT.radius + g.circleO.radius)),
        Math.abs(dXO - Math.abs(g.circleT.radius - g.circleO.radius))));
    cases++;
  }
  check("enough well-posed configurations were exercised", cases > 800, `${cases} cases`);
  check("S is always the same fixed point predicted by the page",
    maxFixed < 1e-4, `max ${maxFixed}`);
  check("S really lies on the given circle in every configuration",
    maxOnCircle < 1e-4, `max ${maxOnCircle}`);
  check("V' = PS ∩ QV makes the circle PQV' tangent to C(O) at P",
    maxTangency < 1e-4, `max ${maxTangency}`);
  check("all incidences of the construction hold to floating-point precision",
    maxIncidence < 1e-4, `max ${maxIncidence}`);

  // One exact position: the opening picture's fixed point (151.586…, 69.466…).
  const opening = C.compute(C.start());
  check("the opening picture's S is its fixed point",
    opening.fixedError < 1e-6, `${opening.fixedError}`);
  equal("the opening fixed point lies on the given circle",
    Math.abs(C.dist(opening.Sfixed, opening.O) - opening.circleO.radius) < 1e-9, true);

  // For one fixed P, O, Q, sweep V across the whole line and compare S.
  const base = states[0];
  let maxSpread = 0, swept = 0;
  for (let vx = 20; vx <= 380; vx += 3) {
    const V = { x: vx, y: base.Q.y };
    if (Math.abs(V.x - base.Q.x) < C.MIN_VQ) continue;
    const g = C.compute({ ...base, V });
    if (!wellConditioned(g, base)) continue;
    maxSpread = Math.max(maxSpread, g.fixedError);
    swept++;
  }
  check("sweeping V across the line leaves S at the fixed point",
    swept > 60 && maxSpread < 1e-4, `${swept} positions, max ${maxSpread}`);
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  let circles = 0, radii = 0, points = 0, compared = 0;
  for (const s of states) {
    const core = C.compute(s);
    const applet = bytecodeCompute(s.P, s.Q, s.V, s.O);
    if (!core || !applet || !core.circleT) continue;
    circles = Math.max(circles, dist(core.circleO.center, applet.circleO.center),
      dist(core.circleX.center, applet.circleX.center),
      dist(core.circleT.center, applet.circleT.center));
    radii = Math.max(radii, Math.abs(core.circleO.radius - applet.circleO.radius),
      Math.abs(core.circleX.radius - applet.circleX.radius),
      Math.abs(core.circleT.radius - applet.circleT.radius));
    points = Math.max(points, dist(core.R, applet.R), dist(core.S, applet.S), dist(core.T, applet.T));
    compared++;
  }
  check("both transcriptions agree on every sample configuration", compared > 800,
    `${compared} compared`);
  check("circle centres match the bytecode on every position", circles < 1e-4, `max ${circles}`);
  check("GetCircle's averaged radii match the bytecode on every position",
    radii < 1e-4, `max ${radii}`);
  check("R, S and T match the bytecode on every position", points < 1e-4, `max ${points}`);

  equal("circlesX from bytecode matches the core",
    bytecodeCircleX({ center: { x: 0, y: 0 }, radius: 5 }, { center: { x: 8, y: 0 }, radius: 5 }),
    C.intersectCirclesX({ center: { x: 0, y: 0 }, radius: 5 }, { center: { x: 8, y: 0 }, radius: 5 }));
  equal("circlesY from bytecode matches the core",
    bytecodeCircleY({ center: { x: 0, y: 0 }, radius: 5 }, { center: { x: 0, y: 8 }, radius: 5 }),
    C.intersectCirclesY({ center: { x: 0, y: 0 }, radius: 5 }, { center: { x: 0, y: 8 }, radius: 5 }));
  equal("lineXcircle from bytecode matches the core",
    bytecodeLineXCircle({ x: 0, y: 0 }, { x: 2, y: 0 }, { center: { x: 1, y: 0 }, radius: 1 }),
    C.intersectLineXCircle({ x: 0, y: 0 }, { x: 2, y: 0 }, { center: { x: 1, y: 0 }, radius: 1 }));
  const s = C.start();
  check("the early return at dist(V,Q) < 1 is kept by both transcriptions",
    bytecodeCompute(s.P, s.Q, { x: s.Q.x + 0.5, y: s.Q.y }, s.O) === null
    && C.compute({ ...s, V: { x: s.Q.x + 0.5, y: s.Q.y } }) === null);

  // The tangent circle's centre is collinear with P and O, as the page says.
  let maxOff = 0, tangentCases = 0;
  for (const s of states) {
    const g = C.compute(s);
    if (!wellConditioned(g, s)) continue;
    const cross = C.cross({ x: g.circleT.center.x - s.O.x, y: g.circleT.center.y - s.O.y },
      { x: s.P.x - s.O.x, y: s.P.y - s.O.y });
    maxOff = Math.max(maxOff, Math.abs(cross));
    tangentCases++;
  }
  check("the tangent circle's centre lies on PO in every well-posed case",
    tangentCases > 800 && maxOff < 1e-3, `${tangentCases} cases, max ${maxOff}`);
}

done("line-circle-and-fixed-points");
