#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord-5/max-common-chord-5-core.js.
 *
 *   node porting/check-max-common-chord-5.mjs
 *
 * The cut-the-knot page "Two Circles and Two More" claims that with A on C(E),
 * B on C(F) and AB through P, the points E, Q, W, F are concyclic, as are
 * A, Q, W, B, where W = AE ∩ BF, and that ∠EWF = ∠EPF is independent of AB.
 * Both circle claims are checked at every one of 720 draggable positions of A
 * (and the same for B), at 400 circle-mode positions, and at 400 random ones.
 * The angle claim is checked as an angle between two lines: at some positions
 * W gives the supplement of EPF, which the page's directed angles identify.
 *
 * The second half transcribes MaxCommonChord5Canvas.init/Compute/Fix and
 * GeoSDoub's line, circle-line and circle-circle intersections straight from
 * the bytecode, and compares them with the core over the whole drag range.
 * It also checks that dragging P or Q does not re-fix B, the applet's own
 * quirk: AB then no longer passes through P and the page's claim need not hold.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("max-common-chord-5/max-common-chord-5-core.js", "MaxCommonChord5Core");
const near = (a, b, tol = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ptNear = (a, b, tol = 1e-7) => !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const onCircle = (p, c, tol = 1e-6) => !!p && !!c && near(dist(p, c), c.r, tol);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/* ----------------------------------------- a literal second transcription */

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), line by line. */
function lineMeet(a, b, c, d) {
  const a1 = b.y - a.y, b1 = a.x - b.x, c1 = b.x * a.y - a.x * b.y;
  const a2 = d.y - c.y, b2 = c.x - d.x, c2 = d.x * c.y - c.x * d.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

/** GeoSDoub.FindCircumcenter, then GetCircle's averaged radius. */
function getCircle(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const n1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
  const n2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
  const o = lineMeet(m1, n1, m2, n2);
  const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
  return { x: o.x, y: o.y, r };
}

/** GeoSDoub.Intersect(DoubLine,DoubCircle), its IntersectX / IntersectY paths. */
function lineCircleLiteral(c, p, q) {
  const dp = Math.abs(p.y - q.y);
  const dq = Math.abs(p.x - q.x);
  if (dp <= 1 && dq <= 1) return null;
  const xPath = dp > 1;
  const m = xPath ? (p.x - q.x) / (p.y - q.y) : (p.y - q.y) / (p.x - q.x);
  const b = xPath ? q.x - m * q.y : q.y - m * q.x;
  const A = m * m + 1;
  // The applet halves the quadratic: B is the linear coefficient / 2 and C
  // is the constant / 2, so the discriminant is B*B - A*C (no factor 4).
  const B = xPath ? m * (b - c.x) - c.y : m * (b - c.y) - c.x;
  const Cc = xPath
    ? c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r
    : c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B + s) / A, t2 = (-B - s) / A;
  return [t1, t2].map((t) => xPath ? { x: m * t + b, y: t } : { x: t, y: m * t + b });
}

/** GeoSDoub.IntersectCirclesX, with a coordinate swap for the Y path. */
function circleCircleX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
    c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
  const u = b - c0.x;
  const A = m * m + 1;
  const B = m * u - c0.y;
  const Cc = u * u + c0.y * c0.y - c0.r * c0.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [(-B + s) / A, (-B - s) / A].map((y) => ({ x: m * y + b, y }));
}

function circleCircleLiteral(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return circleCircleX(c0, c1);
  const swap = (c) => ({ x: c.y, y: c.x, r: c.r });
  const hits = circleCircleX(swap(c0), swap(c1));
  return hits && hits.map((p) => ({ x: p.y, y: p.x }));
}

/** The applet's Other: the farther crossing from a reference point. */
function otherLiteral(points, reference) {
  if (!points || points.length !== 2) return null;
  return dist(points[0], reference) < dist(points[1], reference) ? points[1] : points[0];
}

/** Fix(MoveablePoint, DoubCircle, MoveablePoint), from the canvas bytecode. */
function fixLiteral(state, name) {
  const opposite = name === "A" ? "B" : "A";
  const circle = getCircle(state[opposite], state.P, state.Q);
  if (dist(state[name], state.P) < 1) return state;
  const chosen = otherLiteral(lineCircleLiteral(circle, state[name], state.P), state.P);
  if (!chosen) return state;
  const next = {
    P: { ...state.P }, Q: { ...state.Q }, A: { ...state.A }, B: { ...state.B },
  };
  next[opposite] = { x: chosen.x, y: chosen.y };
  return next;
}

/** MaxCommonChord5Canvas.init, in board units. */
function startLiteral() {
  const s = {
    P: { x: (6 * C.WIDTH) / 11, y: C.HEIGHT / 2 + C.HEIGHT / 10 },
    Q: { x: C.WIDTH / 2, y: (3 * C.HEIGHT) / 5 + C.HEIGHT / 5 },
    A: { x: (2 * C.WIDTH) / 5, y: (3 * C.HEIGHT) / 5 },
    B: { x: (18 * C.WIDTH) / 20, y: (3 * C.HEIGHT) / 5 + C.HEIGHT / 5 },
  };
  return fixLiteral(s, "A");
}

/** MoveablePoint.UpdateLocation's circle projection plus the canvas Fix. */
function moveLiteral(state, name, target, mode) {
  const next = {
    P: { ...state.P }, Q: { ...state.Q }, A: { ...state.A }, B: { ...state.B },
  };
  if (name === "P" || name === "Q") {
    next[name] = { x: target.x, y: target.y };
    return next;
  }
  if (mode === "circles") {
    next[name] = { x: target.x, y: target.y };
  } else {
    const c = getCircle(state[name], state.P, state.Q);
    const d = dist(target, c);
    next[name] = d < 1e-12 ? { ...state[name] } : {
      x: c.x + ((target.x - c.x) * c.r) / d,
      y: c.y + ((target.y - c.y) * c.r) / d,
    };
  }
  return fixLiteral(next, name);
}

/** MaxCommonChord5Canvas.Compute, including its distance guards. */
function computeLiteral(s) {
  const { P, Q, A, B } = s;
  if ([dist(A, P), dist(A, Q), dist(B, P), dist(B, Q)].some((d) => d < 2) || dist(P, Q) < 2) {
    return null;
  }
  const E = getCircle(A, P, Q);
  const F = getCircle(B, P, Q);
  const EQF = getCircle(E, Q, F);
  const ABQ = getCircle(A, B, Q);
  const R = otherLiteral(lineCircleLiteral(ABQ, P, Q), Q);
  if (!R || dist(P, R) < 1) return null;
  const L = otherLiteral(circleCircleLiteral(EQF, E), Q);
  const M = otherLiteral(circleCircleLiteral(EQF, F), Q);
  if (!L || !M) return null;
  const S = lineMeet(A, L, B, M);
  const U = otherLiteral(lineCircleLiteral(EQF, P, Q), Q);
  const T = (() => {
    const d = dist(Q, EQF);
    if (d < 0.1) return { ...Q };
    const t = (2 * EQF.r) / d;
    return { x: Q.x + t * (EQF.x - Q.x), y: Q.y + t * (EQF.y - Q.y) };
  })();
  const perp = { x: S.x + 10 * (Q.y - P.y), y: S.y - 10 * (Q.x - P.x) };
  const N = lineMeet(S, perp, P, Q);
  const W = lineMeet(A, E, B, F);
  return { E, F, EQF, ABQ, R, S, U, T, N, W };
}

/* ------------------------------------------------ 1. the applet's constants */

{
  equal("the canvas is 400 x 250", [C.WIDTH, C.HEIGHT], [400, 250]);
  ptNear(C.P0, { x: 218.1818181818182, y: 150 }) &&
    check("P starts at (6w/11, h/2 + h/10)", ptNear(C.P0, { x: (6 * 400) / 11, y: 150 }));
  check("Q starts at (w/2, 4h/5)", ptNear(C.Q0, { x: 200, y: 200 }));
  check("A starts at (2w/5, 3h/5)", ptNear(C.A0, { x: 160, y: 150 }));
  check("B starts at (9w/10, 4h/5) before Fix", ptNear(C.B0, { x: 360, y: 200 }));
  equal("a fresh diagram is plain data", Object.keys(C.start({})).sort(), ["A", "B", "P", "Q"]);
}

{
  const coreStart = C.start({});
  const literalStart = startLiteral();
  check("start() reproduces init's Fix(B, C(F), A)",
    ["P", "Q", "A", "B"].every((n) => ptNear(coreStart[n], literalStart[n])),
    JSON.stringify(coreStart));
  const g = C.geometry(coreStart);
  check("the starting chord goes through P and A, B sit on their circles",
    g.throughP && onCircle(g.A, g.E) && onCircle(g.B, g.F));
  check("the starting W is AE ∩ BF and lies off both original circles",
    ptNear(g.W, C.intersect(g.A, g.E, g.B, g.F)) &&
    !onCircle(g.W, g.E, 1) && !onCircle(g.W, g.F, 1));
}

/* ----------------------------------- 2. the page's claims at every drag of A */

{
  const s = C.start({});
  const g0 = C.geometry(s);
  const positions = [];
  for (let i = 0; i < 720; i++) {
    const t = (i * 2 * Math.PI) / 720;
    positions.push(C.move(s, "A", C.onCircle(g0.E, t), "chord"));
  }
  let valid = 0, c1 = true, c2 = true, fixedAngle1 = true, fixedAngle2 = true;
  let chord = true, refEQF = true, finiteAll = true;
  let flippedEWF = 0, flippedAQB = 0;
  for (const s2 of positions) {
    const g = C.geometry(s2);
    if (!g.valid || !finite(g.W)) continue;
    valid++;
    chord = chord && g.throughP && onCircle(g.A, g.E) && onCircle(g.B, g.F);
    c1 = c1 && [g.E, g.Q, g.W, g.F].every((p) => onCircle(p, g.EQF));
    c2 = c2 && [g.A, g.Q, g.W, g.B].every((p) => onCircle(p, g.ABQ));
    refEQF = refEQF && onCircle(g.Q, g.EQF) && onCircle(g.W, g.ABQ);
    const dE = Math.abs(g.angleEWF - g.angleEPF);
    const dA = Math.abs(g.angleAQB - g.angleEPF);
    if (dE > 1e-6) flippedEWF++;
    if (dA > 1e-6) flippedAQB++;
    fixedAngle1 = fixedAngle1 &&
      Math.min(dE, Math.abs(g.angleEWF + g.angleEPF - 180)) < 1e-6;
    fixedAngle2 = fixedAngle2 &&
      Math.min(dA, Math.abs(g.angleAQB + g.angleEPF - 180)) < 1e-6;
    finiteAll = finiteAll && [g.R, g.S, g.U, g.T, g.N].every(finite);
  }
  check("720 A drags leave A on C(E), B on C(F) and AB through P", chord && valid > 680);
  check("E, Q, W, F are concyclic at every valid A drag (page claim 1)", c1);
  check("A, Q, W, B are concyclic at every valid A drag (page claim 2)", c2);
  check("Q and W lie on both circumcircles, as the page says", refEQF);
  check("EWF is EPF or its supplement: the angle between AE and BF is fixed", fixedAngle1,
    `supplement taken at ${flippedEWF} of ${valid} positions`);
  check("AQB is fixed by the same invariant", fixedAngle2,
    `supplement taken at ${flippedAQB} of ${valid} positions`);
  check("the applet's R, S, U, T and N stay finite while the chord is drawn", finiteAll);
}

/* ---------------------------------- 3. the same sweep for drags of B and mode */

{
  const s = C.start({});
  const g0 = C.geometry(s);
  let chord = true, c1 = true, c2 = true;
  let n = 0;
  for (let i = 0; i < 720; i++) {
    const t = (i * 2 * Math.PI) / 720;
    const s2 = C.move(s, "B", C.onCircle(g0.F, t), "chord");
    const g = C.geometry(s2);
    if (!g.valid || !finite(g.W)) continue;
    n++;
    chord = chord && g.throughP && onCircle(g.A, g.E) && onCircle(g.B, g.F);
    c1 = c1 && [g.E, g.Q, g.W, g.F].every((p) => onCircle(p, g.EQF));
    c2 = c2 && [g.A, g.Q, g.W, g.B].every((p) => onCircle(p, g.ABQ));
  }
  check("dragging B keeps the chord through P", chord && n > 680);
  check("both circle claims hold for every valid B drag", c1 && c2);
}

{
  // "Adjust circles": A and B are free; their circles follow them.
  let fixed = true, claims = true, ref = true, n = 0;
  for (let i = 0; i < 400; i++) {
    const x = 40 + (i % 20) * 16;
    const y = 25 + Math.floor(i / 20) * 11;
    const s2 = C.move(C.start({}), "A", { x, y }, "circles");
    const g = C.geometry(s2);
    if (!g.valid || !finite(g.W)) continue;
    n++;
    fixed = fixed && onCircle(s2.A, g.E) &&
      (g.throughP ? onCircle(s2.B, g.F) : true);
    ref = ref && ptNear(g.W, C.intersect(s2.A, g.E, s2.B, g.F));
    if (g.throughP) {
      claims = claims && [g.E, g.Q, g.W, g.F].every((p) => onCircle(p, g.EQF)) &&
        [g.A, g.Q, g.W, g.B].every((p) => onCircle(p, g.ABQ));
    }
  }
  check("circle mode lets A leave its old circle and recomputes C(E)", fixed && n > 350);
  check("circle mode still places W on the two lines AE and BF", ref);
  check("both claims hold whenever circle mode still leaves AB through P", claims);
}

/* ------------------------- 4. the applet's own P/Q quirk and Reset behaviour */

{
  const s = C.start({});
  const movedP = C.move(s, "P", { x: 122, y: 90 }, "chord");
  const movedQ = C.move(s, "Q", { x: 168, y: 214 }, "chord");
  const gp = C.geometry(movedP), gq = C.geometry(movedQ);
  check("moving P or Q does not re-fix B, so AB can miss P (applet quirk)",
    !gp.throughP || !gq.throughP);
  check("the page's claim is not asserted once AB misses P",
    gp.throughP || ![gp.E, gp.Q, gp.W, gp.F].every((p) => p && onCircle(p, gp.EQF)));
  check("A B P Q are plain numbers after a P or Q drag",
    [movedP, movedQ].every((s2) => Object.values(s2).every((p) =>
      Number.isFinite(p.x) && Number.isFinite(p.y))));
  const movedA = C.move(s, "A", { x: 170, y: 125 }, "chord");
  check("Reset returns to the untouched starting diagram",
    ptNear(C.start({}).A, s.A) && ptNear(C.start({}).B, s.B) &&
    !ptNear(movedA.A, s.A));
}

/* -------------------------------- 5. core against the bytecode transcription */

{
  const s = C.start({});
  const g0 = C.geometry(s);
  const random = rng(5005);
  let compared = 0, names = true, geom = true, moves = true;
  let worstPoint = 0;
  const tol = 2e-6;
  for (let i = 0; i < 400; i++) {
    const t = ((i + 0.5) * 2 * Math.PI) / 400;
    const mode = i % 2 ? "circles" : "chord";
    const target = i < 200
      ? C.onCircle(g0.E, t)
      : { x: 60 + 280 * random(), y: 25 + 200 * random() };
    const name = i % 3 === 0 ? "B" : "A";
    const coreNext = C.move(s, name, target, mode);
    const litNext = moveLiteral(s, name, target, mode);
    if (process.env.DEBUG_MCC5 && !["P", "Q", "A", "B"].every((n) =>
      ptNear(coreNext[n], litNext[n], tol))) {
      console.log("move mismatch", i, name, mode, target, coreNext, litNext);
    }
    moves = moves && ["P", "Q", "A", "B"].every((n) =>
      ptNear(coreNext[n], litNext[n], tol));
    const g = C.geometry(coreNext);
    const a = computeLiteral(coreNext);
    if (!g.valid || !a) continue;
    compared++;
    for (const key of ["E", "F", "EQF", "ABQ", "R", "S", "U", "T", "N", "W"]) {
      if (!finite(g[key]) || !finite(a[key])) {
        if (process.env.DEBUG_MCC5) console.log("point missing", i, key, g[key], a[key]);
        geom = false;
        continue;
      }
      worstPoint = Math.max(worstPoint, dist(g[key], a[key]));
      geom = geom && dist(g[key], a[key]) < tol;
    }
    if (process.env.DEBUG_MCC5 && !Number.isFinite(C.angle(coreNext.A, g.W, coreNext.B))) {
      console.log("bad angle", i, coreNext.A, g.W, coreNext.B);
    }
    names = names && Number.isFinite(C.angle(coreNext.A, g.W, coreNext.B));
  }
  check("core drags agree with MoveablePoint.UpdateLocation + Fix at 400 targets", moves);
  check("Compute's ten derived points agree with the core at every valid target", geom,
    `worst deviation ${worstPoint.toExponential(2)} of ${compared} diagrams`);
  check("W forms a real angle AWB in every valid diagram", names);
}

/* ----------------------------------- 6. random configurations, all three claims */

{
  const random = rng(777);
  const s0 = C.start({});
  const g0 = C.geometry(s0);
  let n = 0, c1 = true, c2 = true, angle = true, chord = true;
  while (n < 300) {
    const t = random() * 2 * Math.PI;
    const s2 = C.move(s0, random() < 0.5 ? "A" : "B", C.onCircle(
      random() < 0.5 ? g0.E : g0.F, t), "chord");
    const g = C.geometry(s2);
    if (!g.valid || !finite(g.W)) continue;
    n++;
    chord = chord && g.throughP;
    c1 = c1 && [g.E, g.Q, g.W, g.F].every((p) => onCircle(p, g.EQF));
    c2 = c2 && [g.A, g.Q, g.W, g.B].every((p) => onCircle(p, g.ABQ));
    const d = Math.abs(g.angleEWF - g.angleEPF);
    angle = angle &&
      Math.min(d, Math.abs(g.angleEWF + g.angleEPF - 180)) < 1e-6;
  }
  check("300 random drags keep AB through P", chord);
  check("300 random drags keep E, Q, W, F concyclic", c1);
  check("300 random drags keep A, Q, W, B concyclic", c2);
  check("300 random drags keep the EWF angle invariant", angle);
}

/* --------------------------------- 7. edge cases and the saved position */

{
  const s = C.start({});
  const degenerate = C.move(s, "A", { ...s.P }, "circles");
  const g = C.geometry(degenerate);
  check("a point on P is refused by the guard instead of drawing NaNs",
    !g.valid && g.W === null && g.EQF === null);
  check("move() refuses a non-point and an unknown point name",
    C.move(s, "A", null, "chord") === s && C.move(s, "X", { x: 1, y: 1 }) === s);
  const p = C.position(s);
  check("the saved position is plain JSON with the two circles and W",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.throughP === true && p.W && p.circleEQF.radius > 0 &&
    p.circleABQ.radius > 0 && near(p.angleEPF, p.angleEWF, 1e-5));
  const outside = C.move(s, "P", { x: -500, y: 900 }, "chord");
  check("drags outside the canvas clamp to the board",
    outside.P.x === C.EDGE && outside.P.y === C.HEIGHT - C.EDGE);
}

done("max-common-chord-5");
