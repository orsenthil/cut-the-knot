#!/usr/bin/env node
"use strict";

/*
 * Logic test for griffiths/griffiths-core.js.
 *
 *   node porting/check-griffiths.mjs
 *
 * Two independent readings of the old applet are compared here:
 *
 * 1. A second transcription of the bytecode: GeoSDoub.FindCircumcenter and
 *    NearestPoint, the axis-switched IntersectCirclesX/Y, GetCircle, DrawNPC,
 *    GetPerp and FindCommon (SqDist < 2, first close pair wins). It shares no
 *    code with the core.
 * 2. The page's theorem, checked with the complex-number formula from
 *    GriffithsSolution.shtml: with the circumcircle as the unit circle and
 *    the fixed line as the real axis, the Griffiths point is
 *    w = (a1 + a2 + a3 − a1 a2 a3) / 2, which has no p in it.
 *
 * Over 200 generated triangles and many points on each line the test checks:
 * the core equals the bytecode transcription; the pedal circles of every
 * point of the line meet the nine-point circle at that same w; w lies on the
 * nine-point circle; the nine-point circle is the pedal circle of O; and the
 * applet's Q/P dragging rules hold. The page's claim is true in every case.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("griffiths/griffiths-core.js", "GriffithsCore");

/* ------------------------------------------------------------- small tools */

const pt = (x, y) => ({ x, y });
const add = (a, b) => pt(a.x + b.x, a.y + b.y);
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const mul = (a, t) => pt(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const lineDist = (p, a, b) => Math.abs(cross(a, b, p)) / dist(a, b);
const cmul = (a, b) => pt(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
const rot = (p, theta) => pt(p.x * Math.cos(theta) - p.y * Math.sin(theta),
                             p.x * Math.sin(theta) + p.y * Math.cos(theta));

/* -------------------------- the bytecode, transcribed a second time */

// GeoSDoub.Intersect(P1,P2,P3,P4): line coefficients a=p1.y−p2.y,
// b=p2.x−p1.x, c=p1.x·p2.y−p1.y·p2.x; NaN when |a1 b2 − a2 b1| < 1.
function intersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

// GeoSDoub.FindCircumcenter: two bisector points, then Intersect.
function circumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const u = pt(m1.x + b.y - a.y, m1.y - (b.x - a.x));
  const v = pt(m2.x + c.y - b.y, m2.y - (c.x - b.x));
  return intersect(m1, u, m2, v);
}

// GriffithsCanvas.GetCircle: circumcentre plus the average of the 3 radii.
function getCircle(a, b, c) {
  const o = circumcenter(a, b, c);
  if (!o || ![o.x, o.y].every(Number.isFinite)) return null;
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}

// GeoSDoub.NearestPoint(P,X,Y), with the SqDist(X,P) < 0.1 fallback.
function nearest(p, x, y) {
  if (sqDist(x, p) < 0.1) return p;
  const dx = y.x - x.x, dy = y.y - x.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-12) return x;
  return pt(x.x + dx * (dx * (p.x - x.x) + dy * (p.y - x.y)) / len2,
            x.y + dy * (dx * (p.x - x.x) + dy * (p.y - x.y)) / len2);
}

// GeoSDoub.IntersectCirclesX: radical axis x = k·y + x0.
function circlesX(s, t) {
  const k = -(s.c.y - t.c.y) / (s.c.x - t.c.x);
  const x0 = (s.c.x ** 2 - t.c.x ** 2 + s.c.y ** 2 - t.c.y ** 2 - s.r ** 2 + t.r ** 2) /
             (2 * (s.c.x - t.c.x));
  const dx = x0 - s.c.x;
  const b = k * dx - s.c.y;
  const c = dx * dx + s.c.y ** 2 - s.r ** 2;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const h = Math.sqrt(disc);
  const y1 = (-b + h) / (k * k + 1), y2 = (-b - h) / (k * k + 1);
  return [pt(k * y1 + x0, y1), pt(k * y2 + x0, y2)];
}

// GeoSDoub.IntersectCirclesY: radical axis y = k·x + y0.
function circlesY(s, t) {
  const k = -(s.c.x - t.c.x) / (s.c.y - t.c.y);
  const y0 = (s.c.x ** 2 - t.c.x ** 2 + s.c.y ** 2 - t.c.y ** 2 - s.r ** 2 + t.r ** 2) /
             (2 * (s.c.y - t.c.y));
  const dy = y0 - s.c.y;
  const b = k * dy - s.c.x;
  const c = dy * dy + s.c.x ** 2 - s.r ** 2;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const h = Math.sqrt(disc);
  const x1 = (-b + h) / (k * k + 1), x2 = (-b - h) / (k * k + 1);
  return [pt(x1, k * x1 + y0), pt(x2, k * x2 + y0)];
}

function circleCircle(s, t) {
  if (Math.abs(s.c.x - t.c.x) > 1) return circlesX(s, t);
  if (Math.abs(s.c.y - t.c.y) > 1) return circlesY(s, t);
  return []; // the applet returns [null, new DoubPoint()] here: no usable point
}

// GriffithsCanvas.FindCommon: first pair with SqDist < 2, midpoint of the pair.
function findCommon(one, two) {
  for (const p of one) for (const q of two) {
    if (sqDist(p, q) < 2) return mid(p, q);
  }
  return null;
}

// Compute(), straight from the bytecode: AB, BC, CA feet and DrawNPC.
function appletCompute(s) {
  const O = circumcenter(s.A, s.B, s.C);
  if (!O) return null;
  const PFeet = [nearest(s.P, s.A, s.B), nearest(s.P, s.B, s.C), nearest(s.P, s.C, s.A)];
  const QFeet = [nearest(s.Q, s.A, s.B), nearest(s.Q, s.B, s.C), nearest(s.Q, s.C, s.A)];
  const Pcircle = getCircle(PFeet[0], PFeet[1], PFeet[2]);
  const Qcircle = getCircle(QFeet[0], QFeet[1], QFeet[2]);
  const nine = getCircle(mid(s.B, s.C), mid(s.C, s.A), mid(s.A, s.B));
  const one = Pcircle && nine ? circleCircle(Pcircle, nine) : [];
  const two = Qcircle && nine ? circleCircle(Qcircle, nine) : [];
  const common = findCommon(one, two);
  return { O, PFeet, QFeet, Pcircle, Qcircle, nine, one, two, common };
}

/** The mathematical common point: the closest of the four circle meetings.
 *  FindCommon takes the FIRST pair within sqrt(2) pixels, which can be a near
 *  miss when P and Q are close together; that is an applet quirk, not the
 *  theorem. The page's claim is about the exact common point. */
function closestCommon(x) {
  let best = null, bestD = Infinity;
  for (const p of x.one) for (const q of x.two) {
    const d = dist(p, q);
    if (d < bestD) { bestD = d; best = mid(p, q); }
  }
  return bestD < 1e-5 ? best : null;
}

// GriffithsSolution.shtml's w, after rotating l onto the real axis.
function formulaPoint(a, b, c, O, R, direction) {
  const theta = Math.atan2(direction.y, direction.x);
  const unit = [a, b, c].map((p) => rot(mul(sub(p, O), 1 / R), -theta));
  const prod = cmul(cmul(unit[0], unit[1]), unit[2]);
  const w = mul(add(add(unit[0], unit[1]), sub(unit[2], prod)), 0.5);
  return add(O, mul(rot(w, theta), R));
}

/* ---------------------------------------------------------------- 1. rules */

const start = C.start({});
{
  const midBoard = pt(C.VIEW.width / 2, C.VIEW.height / 2);
  const at = (angle, radius) => add(midBoard, pt(radius * Math.cos(angle), radius * Math.sin(angle)));
  check("the archived page embeds a 500x300 applet; R is integer min/3",
    C.VIEW.width === 500 && C.VIEW.height === 300 && C.R === 100);
  check("start places A1, A2, A3 at the applet's −1.6, −4, −0.2 angles",
    dist(start.A, at(-1.6, 100)) < 1e-9 && dist(start.B, at(-4, 100)) < 1e-9 &&
    dist(start.C, at(-0.2, 100)) < 1e-9);
  check("start places P at R/2 on the 2.0 ray and O at the circumcentre",
    dist(start.P, at(2, 50)) < 1e-9 && dist(start.O, midBoard) < 1e-9);
  check("start gives Q DoubLine.CreateMidPoint(4/3) between P and O",
    Math.abs(start.t - 4 / 3) < 1e-12 && dist(start.Q, add(midBoard, mul(sub(start.P, midBoard), 4 / 3))) < 1e-9);
  check("the applet's two checkboxes are off; ShowNames is forced on in the code",
    !start.options.perps && !start.options.circles);
  check("a new drawing has neither won nor lost", C.result(start) === null);
  equal("the five draggable points", C.legalMoves(), ["A", "B", "C", "P", "Q"]);
  check("an unknown handle is refused", C.move(start, "Z", pt(1, 2)) === start);
  const moved = C.move(start, "A", pt(9999, -9999));
  check("a drag is clamped to the board and does not mutate the old state",
    moved.A.x <= 500 && moved.A.y === 0 && start.A.x !== moved.A.x &&
    start.explored === false && moved.explored === true);
  check("a finished drawing is done, never win or lose", C.result(moved) === "done");
  check("toggling an option is immutable and unknown options are refused",
    C.setOption(start, "circles", true).options.circles && !start.options.circles &&
    C.setOption(start, "perps", true).options.perps && C.setOption(start, "nope", true) === start);
  const reset = C.reset(C.setOption(moved, "circles", true));
  check("Reset restores the points but keeps the checkboxes",
    dist(reset.P, start.P) < 1e-9 && dist(reset.Q, start.Q) < 1e-9 &&
    reset.options.circles && !reset.explored);
  const flat = Object.assign({}, start, { C: pt(start.A.x, start.A.y) });
  check("a collapsed triangle has no geometry", C.geometry(flat) === null &&
    C.describe(flat).includes("straight line"));
  check("the status explains the picture in plain words",
    C.describe(start).includes("same line through O") &&
    C.describe(C.setOption(start, "circles", true)).includes("meet at"));
}

/* ------------------------------------- 2. the core against the bytecode */

const rand = rng(20261127);
const cases = [{ name: "applet default", state: start }];
for (let i = 0; i < 240; i++) {
  const O = pt(100 + rand() * 300, 70 + rand() * 160);
  const R = 60 + rand() * 70;
  const angles = [];
  for (let k = 0; k < 3; k++) angles.push(rand() * Math.PI * 2);
  angles.sort((a, b) => a - b);
  if (angles.some((v, k) => k && v - angles[k - 1] < 0.3)) continue;
  const on = (v) => add(O, pt(R * Math.cos(v), R * Math.sin(v)));
  const theta = rand() * Math.PI * 2;
  const d = 20 + rand() * 130;
  const t = -0.6 + rand() * 2.3;
  const P = add(O, pt(d * Math.cos(theta), d * Math.sin(theta)));
  const Q = add(O, mul(sub(P, O), t));
  cases.push({ name: `generated ${i}`, state: {
    A: on(angles[0]), B: on(angles[1]), C: on(angles[2]), P, Q, t, O,
    options: { perps: false, circles: false }, explored: false,
  } });
}

let compared = 0, skipped = 0, nearCoincident = 0;
let worstPoint = 0, worstCircle = 0, worstCommon = 0;
for (const { state } of cases) {
  const g = C.geometry(state), x = appletCompute(state);
  if (!g || !x || !g.common || !x.common || !g.nine || !x.nine) {
    skipped++;
    // The old Intersect returns no points when two circle centres are within
    // one pixel in both coordinates; Q is then almost at the circumcentre.
    if (x && x.Qcircle && x.nine &&
        Math.abs(x.Qcircle.c.x - x.nine.c.x) <= 1 && Math.abs(x.Qcircle.c.y - x.nine.c.y) <= 1) {
      nearCoincident++;
    }
    continue;
  }
  compared++;
  const errs = [
    dist(g.O, x.O),
    ...g.PFeet.map((p, i) => dist(p, x.PFeet[i])),
    ...g.QFeet.map((p, i) => dist(p, x.QFeet[i])),
  ];
  worstPoint = Math.max(worstPoint, ...errs);
  for (const [a, b] of [[g.Pcircle, x.Pcircle], [g.Qcircle, x.Qcircle], [g.nine, x.nine]]) {
    worstCircle = Math.max(worstCircle, dist(a.c, b.c), Math.abs(a.r - b.r));
  }
  worstCommon = Math.max(worstCommon, dist(g.common, x.common));
}
check(`${compared} of ${cases.length} configurations have a picked dot; the other ${skipped} have Q within a pixel of O`,
  compared + skipped === cases.length && nearCoincident === skipped,
  `${compared}/${cases.length}, near-coincident ${nearCoincident}/${skipped}`);
check(`circumcentre and both sets of perpendicular feet agree (worst ${worstPoint.toExponential(1)})`,
  worstPoint < 1e-7);
check(`pedal and nine-point circles agree (worst ${worstCircle.toExponential(1)})`, worstCircle < 1e-7);
check(`FindCommon agrees with the bytecode (worst ${worstCommon.toExponential(1)})`, worstCommon < 0.5);

/* ------------------------------------------- 3. the page's claim, exhaustively */

let claim = 0, onNine = 0, fixed = 0, pedalAtO = 0, movedCorrectly = 0, usable = 0;
let worstPedal = 0, worstNine = 0, worstFixed = 0;
// k = 1 would put Q on P, making the two pedal circles identical and their
// intersection pairs indistinguishable; the on-circle claim above still
// covers that case.
const lineParameters = [0.25, 0.5, 0.8, 1.2, 1.3, 1.8, 2.2];
for (const { state } of cases) {
  const g = C.geometry(state), x = appletCompute(state);
  if (!g || !g.circle || !g.nine || !x || !x.Pcircle || !x.Qcircle) continue;
  usable++;
  const O = g.O, R = g.circle.r;
  const direction = sub(state.P, O);
  const w = formulaPoint(state.A, state.B, state.C, O, R, direction);

  // W lies on the pedal circle of P and of Q: the page's concurrency claim,
  // tested from the proof formula rather than from the pixel-picking dot.
  const pedalErr = Math.abs(dist(w, x.Pcircle.c) - x.Pcircle.r);
  worstPedal = Math.max(worstPedal, pedalErr);
  if (pedalErr < 1e-6 && Math.abs(dist(w, x.Qcircle.c) - x.Qcircle.r) < 1e-6) claim++;

  // ... and the pedal circle and the nine-point circle share that same W.
  const nineErr = Math.abs(dist(w, g.nine.c) - g.nine.r);
  worstNine = Math.max(worstNine, nineErr);
  if (nineErr < 1e-6) onNine++;

  // Sliding P and Q along this same line leaves the picked common dot at the
  // same place. The closest-pair reconstruction avoids the applet's quirk of
  // taking the first pair within sqrt(2) pixels.
  let first = null, allFixed = true;
  for (const k of lineParameters) {
    const slide = { ...state, Q: add(O, mul(direction, k)) };
    const y = appletCompute(slide);
    const exact = y && closestCommon(y);
    if (!exact) { allFixed = false; continue; }
    if (!first) first = exact;
    else worstFixed = Math.max(worstFixed, dist(first, exact));
    if (dist(exact, w) >= 1e-5) allFixed = false;
  }
  if (allFixed) fixed++;

  // The explanation also says the nine-point circle is the pedal circle of O.
  const atO = getCircle(nearest(O, state.A, state.B), nearest(O, state.B, state.C),
                        nearest(O, state.C, state.A));
  if (atO && dist(atO.c, g.nine.c) < 1e-6 && Math.abs(atO.r - g.nine.r) < 1e-6) pedalAtO++;

  // Dragging P leaves the applet's line parameter t, and hence Q, in step.
  const to = C.clampPoint(add(O, mul(direction, 0.73)));
  const after = C.move(state, "P", to);
  if (dist(after.Q, add(after.O, mul(sub(to, after.O), state.t))) < 1e-9 &&
      Math.abs(after.t - state.t) < 1e-12) movedCorrectly++;
}
check(`the page's pedal circles share w from its proof (${claim}/${usable}, worst ${worstPedal.toExponential(1)})`,
  claim === usable && usable === cases.length);
check(`w lies on the nine-point circle (${onNine}/${usable}, worst ${worstNine.toExponential(1)})`,
  onNine === usable);
check(`sliding along the line fixes the dot (${fixed}/${usable}, worst ${worstFixed.toExponential(1)})`,
  fixed === usable);
check(`the nine-point circle is the pedal circle of O (${pedalAtO}/${usable})`, pedalAtO === usable);
check(`dragging P carries Q at the same line parameter (${movedCorrectly}/${usable})`,
  movedCorrectly === usable);

/* ------------------------------------- 4. dragging rules and edge cases */

{
  const s = C.start({});
  const P = pt(180, 220);
  const m = C.move(s, "P", P);
  check("P drag: Q keeps t, stays on OP, and the record ends",
    Math.abs(m.t - s.t) < 1e-12 && dist(m.Q, add(m.O, mul(sub(P, m.O), s.t))) < 1e-9 &&
    lineDist(m.Q, m.P, m.O) < 1e-9 && C.result(m) === "done");
  const qTarget = pt(120, 250);
  const q = C.move(m, "Q", qTarget);
  check("Q drag: the point is projected onto the infinite line and P, O stay put",
    lineDist(q.Q, q.P, q.O) < 1e-9 && dist(q.P, m.P) === 0 && dist(q.O, m.O) === 0 &&
    dist(q.Q, C.projectToLine(q.P, q.O, qTarget)) < 1e-9);
  check("Q drag does not change the Griffiths dot for that line",
    dist(C.geometry(q).common, C.geometry(m).common) < 1e-6);

  const before = C.geometry(q).common;
  const tri = C.move(q, "A", pt(260, 40));
  const triG = C.geometry(tri);
  check("A drag: O is the new circumcentre and Q rides the line with t",
    dist(tri.O, circumcenter(tri.A, tri.B, tri.C)) < 1e-9 &&
    dist(tri.Q, add(tri.O, mul(sub(tri.P, tri.O), q.t))) < 1e-9 &&
    lineDist(tri.Q, tri.P, tri.O) < 1e-9 && !!triG);
  check("A drag changes the theorem's dot, which still matches the proof",
    dist(before, triG.common) > 1 &&
    dist(triG.common, formulaPoint(tri.A, tri.B, tri.C, triG.O, triG.circle.r, sub(tri.P, triG.O))) < 1e-6);

  const shown = C.setOption(start, "circles", true);
  const shownPerps = C.setOption(shown, "perps", true);
  check("checkboxes change only the shown options, not the geometry",
    dist(C.geometry(start).common, C.geometry(shownPerps).common) === 0 &&
    shownPerps.options.circles && shownPerps.options.perps && start.options.perps === false);

  let onLine = 0, matches = 0;
  for (let i = 0; i < 120; i++) {
    const p = pt(rand() * 500, rand() * 300);
    const target = i % 3 === 0 ? "P" : i % 3 === 1 ? "Q" : "B";
    const n = C.move(s, target, p);
    const x = appletCompute(n), g = C.geometry(n);
    if (n.O && lineDist(n.Q, n.P, n.O) < 1e-6) onLine++;
    if (x && g && Boolean(g.common) === Boolean(x.common) &&
        (!g.common || dist(g.common, x.common) < 0.5)) matches++;
  }
  check(`120 random drags keep Q on OP (${onLine}/120)`, onLine === 120);
  check(`120 random drags agree with the bytecode (${matches}/120)`, matches === 120);

  // P = O makes the pedal circle coincide with the nine-point circle: the
  // applet's Intersect returns no usable points, so there is no picked dot.
  const degenerate = Object.assign({}, start, { P: { ...start.O }, Q: { ...start.O } });
  check("P and Q at O leave no single picked dot and do not crash",
    C.geometry(degenerate).common === null && typeof C.describe(degenerate) === "string");
  // A point on the circumcircle has collinear feet: a Simson line, no pedal
  // circle (the explanation page mentions this case).
  const onCircle = add(start.O, pt(Math.cos(-1.6) * 100, Math.sin(-1.6) * 100));
  const simson = Object.assign({}, start, { P: onCircle, Q: onCircle });
  check("a point on the circumcircle has no pedal circle to draw",
    C.geometry(simson).Pcircle === null && C.geometry(simson).common === null);
}

done("griffiths");
