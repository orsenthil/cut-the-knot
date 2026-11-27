#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-angles-in-crossed-circles/equal-angles-in-crossed-circles-core.js.
 *
 *   node porting/check-equal-angles-in-crossed-circles.mjs
 *
 * Checked: the applet's four starting handles and three checkboxes; a second
 * literal transcription of Compute(), GetCircle(), GeoSDoub.Intersect() and
 * GeoSDoub.ComputeAngle() compared with the core on the start picture, sweeps
 * of each handle, random configurations, degenerate S/T, collinear points and
 * near-axis chords; then the page's two angle equalities on every drawing
 * where the two chords are nested (the picture the page describes), plus an
 * honest counterexample when the chords are disjoint.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equal-angles-in-crossed-circles/equal-angles-in-crossed-circles-core.js", "EqualAnglesInCrossedCirclesCore");

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const sameNum = (a, b, tol = 1e-9) =>
  (Number.isNaN(a) && Number.isNaN(b)) || close(a, b, tol);
const samePt = (p, q, tol = 1e-9) => Boolean(p && q) &&
  sameNum(p.x, q.x, tol) && sameNum(p.y, q.y, tol);
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ---------------- a second transcription, straight from the bytecode ------ */

function jSqDist(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
function jDist(p, q) { return Math.sqrt(jSqDist(p, q)); }

/* GeoSDoub.Intersect(P1,P2,P3,P4): |det| < 1 gives NaN. */
function jIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter, then GetCircle's average radius. */
function jCircle(U, V, W) {
  const m12 = { x: (U.x + V.x) / 2, y: (U.y + V.y) / 2 };
  const m23 = { x: (V.x + W.x) / 2, y: (V.y + W.y) / 2 };
  const d1 = { x: m12.x + V.y - U.y, y: m12.y - V.x + U.x };
  const d2 = { x: m23.x + W.y - V.y, y: m23.y - W.x + V.x };
  const centre = jIntersect(m12, d1, m23, d2);
  const r = (jDist(centre, U) + jDist(centre, V) + jDist(centre, W)) / 3;
  return { x: centre.x, y: centre.y, r };
}

/*
 * GeoSDoub.Intersect(DoubLine,DoubCircle) and its IntersectX / IntersectY
 * helpers. Note the two different C constants: IntersectX solves for y and
 * uses cy² + (b−cx)², IntersectY solves for x and uses cx² + (b−cy)².
 */
function jLineCircle(P, Q, c) {
  if (Math.abs(P.y - Q.y) > 1) {
    const k = (P.x - Q.x) / (P.y - Q.y), b = Q.x - k * Q.y;
    const A = k * k + 1, B = 2 * (k * (b - c.x) - c.y);
    const Cc = (b - c.x) ** 2 + c.y ** 2 - c.r ** 2;
    const disc = B * B - 4 * A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc), t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
    return [{ x: k * t1 + b, y: t1 }, { x: k * t2 + b, y: t2 }];
  }
  if (Math.abs(P.x - Q.x) > 1) {
    const k = (P.y - Q.y) / (P.x - Q.x), b = Q.y - k * Q.x;
    const A = k * k + 1, B = 2 * (k * (b - c.y) - c.x);
    const Cc = (b - c.y) ** 2 + c.x ** 2 - c.r ** 2;
    const disc = B * B - 4 * A * Cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc), t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
    return [{ x: t1, y: k * t1 + b }, { x: t2, y: k * t2 + b }];
  }
  return null;
}

function jDcmpg(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b) || a > b) return 1;
  return a < b ? -1 : 0;
}
function jDcmpl(a, b) {
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
function jLeft(pair) {
  return jDcmpg(pair[0].x, pair[1].x) < 0 ? [pair[0], pair[1]] : [pair[1], pair[0]];
}

/* GeoSDoub.ComputeAngle(V,P,Q), literally as the bytecode evaluates it. */
function jAngle(V, P, Q) {
  const numerator = jSqDist(V, P) + jSqDist(V, Q) - jSqDist(P, Q);
  const cosine = numerator / 2 / jDist(V, P) / jDist(V, Q);
  return Math.acos(cosine);
}

/* EqualAnglesInCrossedCirclesCanvas.Compute(), in bytecode order. */
function jCompute(s) {
  if (jDcmpg(jDist(s.S, s.T), 1) < 0) {
    return { stale: true, valid: false, S: s.S, T: s.T };
  }
  const S = jDcmpg(s.S.x, s.T.x) < 0 ? s.S : s.T;
  const T = jDcmpg(s.S.x, s.T.x) < 0 ? s.T : s.S;
  const c1 = jCircle(T, S, s.RB), c2 = jCircle(T, S, s.RS);
  const bigger = jDcmpl(c1.r, c2.r) > 0;
  const bigCircle = bigger ? c1 : c2, smallCircle = bigger ? c2 : c1;
  const RB = bigger ? s.RB : s.RS, RS = bigger ? s.RS : s.RB;
  const outer = jLineCircle(RS, RB, bigCircle), inner = jLineCircle(RS, RB, smallCircle);
  const d = { stale: false, valid: Boolean(outer && inner), S, T, c1, c2,
    bigCircle, smallCircle, RB, RS };
  if (!d.valid) return { ...d, A: null, B: null, P: null, Q: null };
  const [A, B] = jLeft(outer), [P, Q] = jLeft(inner);
  return { ...d, A, B, P, Q,
    angleASP: jAngle(S, A, P), angleBTQ: jAngle(T, B, Q),
    angleBSQ: jAngle(S, B, Q), angleATP: jAngle(T, P, A) };
}

/* Compare every field of Compute(), including NaN on degenerate drawings. */
function compareCore(label, states) {
  let bad = 0, worst = 0, finiteFields = 0;
  for (const s of states) {
    const a = C.compute(s), b = jCompute(s);
    if (a.valid !== b.valid || a.stale !== b.stale) { bad++; continue; }
    const pairs = [
      ["S", a.S, b.S], ["T", a.T, b.T],
      ["viaRB", a.viaRB, b.c1], ["viaRS", a.viaRS, b.c2],
      ["big", a.bigCircle, b.bigCircle], ["small", a.smallCircle, b.smallCircle],
      ["RB", a.RB, b.RB], ["RS", a.RS, b.RS],
      ["A", a.A, b.A], ["B", a.B, b.B], ["P", a.P, b.P], ["Q", a.Q, b.Q],
      ["angleASP", a.angleASP, b.angleASP], ["angleBTQ", a.angleBTQ, b.angleBTQ],
      ["angleBSQ", a.angleBSQ, b.angleBSQ], ["angleATP", a.angleATP, b.angleATP],
    ];
    for (const [name, core, java] of pairs) {
      if (core == null && java == null) continue; // the early return has no drawing
      if (name.startsWith("angle")) {
        if (!sameNum(core, java, 1e-9)) {
          if (process.env.DEBUG) console.log("ANGLE MISMATCH", name, core, java, JSON.stringify(s));
          bad++;
          continue;
        }
        if (Number.isFinite(core)) worst = Math.max(worst, Math.abs(core - java));
        continue;
      }
      if (!samePt(core, java)) {
        if (process.env.DEBUG) console.log("MISMATCH", name, core, java, JSON.stringify(s));
        bad++;
        continue;
      }
      if (name === "viaRB" || name === "viaRS" || name === "big" || name === "small") {
        if (!sameNum(core.r, java.r)) {
          if (process.env.DEBUG) console.log("RADIUS MISMATCH", name, core, java, JSON.stringify(s));
          bad++;
        }
        else if (Number.isFinite(core.r)) worst = Math.max(worst, Math.abs(core.r - java.r));
      }
      finiteFields++;
    }
  }
  check(label, bad === 0 && worst < 1e-7,
    `${states.length} drawings, ${finiteFields} points, ${bad} mismatches, worst ${worst.toExponential(2)}`);
}

/* ------------------------------------------------------- 1. the start picture */

const start = C.start();
{
  check("init puts S at (150,320) on a 400×400 canvas",
    closePt(start.S, { x: 150, y: 320 }, 0));
  check("init puts T at (250,320)", closePt(start.T, { x: 250, y: 320 }, 0));
  check("init puts RB at (133,200), using Java integer division",
    closePt(start.RB, { x: 133, y: 200 }, 0));
  check("init puts RS at (400/1.8,200)", closePt(start.RS, { x: 400 / 1.8, y: 200 }, 0));
  check("names are on in the second applet on the page, statement and extra off",
    start.names === true && start.statement === false && start.extra === false);
  check("an illustration has no result and no computer move",
    !("result" in C) && !("move" in C));
  const sized = C.start({ width: 300, height: 200 });
  check("init follows the applet's formulas at another canvas size",
    closePt(sized.S, { x: 150 - 37.5, y: 160 }, 0) &&
    closePt(sized.T, { x: 150 + 37.5, y: 160 }, 0) &&
    closePt(sized.RB, { x: 100, y: 100 }, 0) &&
    closePt(sized.RS, { x: 300 / 1.8, y: 100 }, 0));
}

{
  const dragged = C.withPoint(start, "RS", { x: -100, y: 900 });
  check("dragging clamps a handle into the canvas",
    closePt(dragged.RS, { x: C.MARGIN, y: C.VIEW.height - C.MARGIN }, 0));
  check("dragging leaves the old position alone",
    start.RS.x === 400 / 1.8 && start.RS.y === 200);
  check("an unknown handle is a no-op", C.withPoint(start, "A", { x: 0, y: 0 }) === start);
  check("checkbox changes do not mutate the position",
    C.withToggle(start, "statement", true).statement === true &&
    C.withToggle(start, "names", false).names === false &&
    start.statement === false && start.names === true);
  check("an unknown checkbox is a no-op", C.withToggle(start, "hint", true) === start);
}

/* ------------------- 2. the applet's own method over many drawings --------- */

compareCore("the start drawing against the bytecode", [start]);

const sweep = [];
for (let i = 0; i < 144; i++) {
  const a = (2 * Math.PI * i) / 144;
  sweep.push({ ...start,
    RS: { x: 200 + 70 * Math.cos(a), y: 250 + 70 * Math.sin(a) } });
  sweep.push({ ...start,
    RB: { x: 190 + 65 * Math.cos(a), y: 240 + 65 * Math.sin(a) } });
  sweep.push({ ...start,
    S: { x: 200 + 75 * Math.cos(a), y: 300 + 40 * Math.sin(a) },
    T: { x: 250 - 50 * Math.cos(a), y: 310 - 30 * Math.sin(a) } });
}
compareCore("432 positions sweeping S, T, RB and RS", sweep);

const next = rng(4382019);
const randoms = [];
for (let i = 0; i < 1600; i++) {
  const p = () => ({ x: 14 + next() * 372, y: 14 + next() * 372 });
  randoms.push({ S: p(), T: p(), RB: p(), RS: p(),
    names: false, statement: false, extra: false });
}
compareCore("1600 random configurations", randoms);

/* Small moves from the opening picture keep the chord inside both circles:
   these are the configurations the page actually describes. */
const near = [];
for (let i = 0; i < 1500; i++) {
  const jitter = (p) => ({ x: p.x + (next() - 0.5) * 70, y: p.y + (next() - 0.5) * 70 });
  near.push({ S: jitter(start.S), T: jitter(start.T),
    RB: jitter(start.RB), RS: jitter(start.RS) });
}
compareCore("1500 configurations near the opening picture", near);

const edge = [];
for (const [S, T] of [
  [{ x: 100, y: 100 }, { x: 100.4, y: 100.2 }], // applet returns early
  [{ x: 100, y: 100 }, { x: 100, y: 100 }],
  [{ x: 200, y: 100 }, { x: 150, y: 100 }],      // S and T swapped by x
  [{ x: 150, y: 100 }, { x: 100, y: 100 }],
  [{ x: 100, y: 200 }, { x: 300, y: 200 }],      // flat through S and T
]) {
  edge.push({ S, T, RB: { x: 50, y: 200 }, RS: { x: 350, y: 200 } });
  edge.push({ S, T, RB: { x: 200, y: 25 }, RS: { x: 200, y: 375 } }); // steep chord
  edge.push({ S, T, RB: { x: 25, y: 200 }, RS: { x: 375, y: 200 } }); // flat chord
}
compareCore("early return, swaps, flat and near-axis chords", edge);
check("the early return leaves no new drawing",
  C.compute(edge[0]).stale === true && !C.compute(edge[0]).valid &&
  jCompute(edge[0]).stale === true);
{
  const tied = { S: { x: 100, y: 100 }, T: { x: 300, y: 100 },
    RB: { x: 150, y: 250 }, RS: { x: 250, y: 250 } };
  const a = C.compute(tied), b = jCompute(tied);
  check("equal-radius choice agrees with the applet's dcmpl tie rule",
    close(a.viaRB.r, a.viaRS.r, 1e-9) &&
    samePt(a.RB, b.RB, 0) && samePt(a.RS, b.RS, 0) &&
    samePt(a.bigCircle, b.bigCircle, 0));
}

/* -------------------------- 3. the page's exact claim ---------------------- */

/** Parameter of a point along the chord RS→RB. */
function along(d, p) {
  const vx = d.RB.x - d.RS.x, vy = d.RB.y - d.RS.y;
  return ((p.x - d.RS.x) * vx + (p.y - d.RS.y) * vy) / (vx * vx + vy * vy);
}
/** The page's picture: the two chords are nested along their common line. */
function nested(d) {
  const ab = [along(d, d.A), along(d, d.B)].sort((a, b) => a - b);
  const pq = [along(d, d.P), along(d, d.Q)].sort((a, b) => a - b);
  return (ab[0] <= pq[0] && pq[1] <= ab[1]) || (pq[0] <= ab[0] && ab[1] <= pq[1]);
}

/** Distance of a point from the chord line; zero means the picture collapsed. */
function height(d, p) {
  const vx = d.RB.x - d.RS.x, vy = d.RB.y - d.RS.y;
  return Math.abs(cross(d.RS, d.RB, p)) / Math.max(Math.hypot(vx, vy), 1e-12);
}
/** The page's drawing, with four distinct chord crossings and S,T off the line. */
function nonDegenerate(d) {
  if (!C.drawn(d) || !Number.isFinite(C.angleGap(d))) return false;
  return C.dist(d.A, d.B) > 0.01 && C.dist(d.P, d.Q) > 0.01 &&
    height(d, d.S) > 0.01 && height(d, d.T) > 0.01;
}

const ds = randoms.concat(sweep, near).map((s) => C.compute(s)).filter((d) => C.drawn(d));
const pictured = ds.filter((d) => nested(d) && nonDegenerate(d));
let outside = 0;
for (const d of ds) if (!nested(d)) outside++;
check("plenty of drawings match the page's nested-chord picture",
  pictured.length > 2000, `${pictured.length} nested, ${outside} other`);

/* A collapsed drawing can sit inside a nested span, but its angles are not
   the picture the page is about: S/T on the chord makes the arcs vanish. */
{
  const collapsed = { S: { x: 244, y: 280 }, T: { x: 207, y: 180 },
    RB: { x: 188, y: 210 }, RS: { x: 180, y: 200 } };
  const d = C.compute(collapsed);
  check("a nested but collapsed drawing is not counted as the page's picture",
    C.drawn(d) && nested(d) && !nonDegenerate(d));
}

let radiusErr = 0, inscribedErr = 0, equalityErr = 0;
for (const d of pictured) {
  const scale = Math.max(1, d.bigCircle.r, d.smallCircle.r);
  for (const p of [d.A, d.B]) {
    radiusErr = Math.max(radiusErr,
      Math.abs(C.dist(d.bigCircle, p) - d.bigCircle.r) / scale);
  }
  for (const p of [d.P, d.Q]) {
    radiusErr = Math.max(radiusErr,
      Math.abs(C.dist(d.smallCircle, p) - d.smallCircle.r) / scale);
  }
  inscribedErr = Math.max(inscribedErr,
    Math.abs(d.angleASP - d.angleBTQ) / scale,
    Math.abs(d.angleBSQ - d.angleATP) / scale,
    Math.abs(C.angle(d.S, d.A, d.B) - C.angle(d.T, d.A, d.B)) / scale,
    Math.abs(C.angle(d.S, d.P, d.Q) - C.angle(d.T, d.P, d.Q)) / scale);
  equalityErr = Math.max(equalityErr, C.angleGap(d));
}
check("A,B lie on one circle and P,Q on the other", radiusErr < 1e-10,
  `worst relative error ${radiusErr.toExponential(2)}`);
check("the inscribed angles in quadrilaterals ASTB and PSTQ agree",
  inscribedErr < 1e-9, `worst ${inscribedErr.toExponential(2)} rad`);
check("ASP = BTQ and ATP = BSQ on every nested configuration",
  equalityErr < 1e-9, `${pictured.length} drawings, worst ${equalityErr.toExponential(2)} rad`);

{
  const d = C.compute(start);
  check("the opening picture is nested and shows both equalities",
    nested(d) && C.angleGap(d) < 1e-12,
    `gap ${C.angleGap(d).toExponential(2)} rad`);
  check("the opening picture has A left of B and P left of Q",
    d.A.x < d.B.x && d.P.x < d.Q.x && d.S.x < d.T.x);
}

/* The claim is about a chord that crosses the other circle. When the line
   misses the shared lens, the chords are disjoint and the angles need not
   match; pin down one such configuration instead of hiding it. */
{
  let counterexample = null;
  for (const s of randoms) {
    const d = C.compute(s);
    if (!C.drawn(d) || nested(d) || C.angleGap(d) < 0.1) continue;
    counterexample = { s, d };
    break;
  }
  check("a disjoint-chord configuration exists", Boolean(counterexample));
  if (counterexample) {
    const d = counterexample.d;
    check("the counterexample really misses the other chord's span",
      !nested(d) && C.angleGap(d) > 0.1,
      `gap ${C.angleGap(d).toFixed(3)} rad`);
    check("the counterexample still matches the bytecode's drawing",
      samePt(d.A, jCompute(counterexample.s).A, 1e-9) &&
      samePt(d.P, jCompute(counterexample.s).P, 1e-9));
  }
}

done("equal-angles-in-crossed-circles");
