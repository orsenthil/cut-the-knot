#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscribed-angle/inscribed-angle-core.js.
 *
 *   node porting/check-inscribed-angle.mjs
 *
 * Two independent readings of the bytecode are compared here:
 *
 *  1. InscribedAngleCanvas.init()/CreatePoint() put A, B and C on the circle
 *     at t = 90°, 180° and 270° plus a random quarter turn; Ap = 2O − A.
 *     InscribedAngleCanvas.DrawAngles() draws the central angle either as the
 *     single arc B-O-C (inscribed angle < 90°) or as two arcs B-O-Ap and
 *     Ap-O-C.  Those drawn arcs are transcribed literally below with
 *     GeoSDoub.ComputeAngle's law of cosines, without the core's clamp, and
 *     their sum is compared with the core's arc measure on a 5° grid of all
 *     three positions plus 3,000 random triples.
 *  2. DrawTangent()'s tangent point is chosen with GeoSDoub.FindOrientation,
 *     transcribed from the bytecode; the check compares it and both angle
 *     measurements for every way of putting B or C on top of A.
 *
 * The page's headline claim (central angle = twice the inscribed angle), the
 * supplementary-angle claim, the right angle in a semicircle used by the
 * proof, the isosceles base angles and the tangent-chord claim are measured
 * independently with the law of cosines at every usable configuration.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inscribed-angle/inscribed-angle-core.js", "InscribedAngleCore");

/* ------------- the applet's own arithmetic, transcribed a second time ----- */

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

// InscribedAngleCanvas.CreatePoint(cx, cy, t, r).
const createPoint = (cx, cy, t, r) => P(cx + r * Math.cos(t), cy + r * Math.sin(t));

// GeoSDoub.ComputeAngle(p, q, r), transcribed from its bytecode (no clamp).
function computeAngle(p, q, r) {
  const s = sqDist(p, q) + sqDist(p, r) - sqDist(q, r);
  return Math.acos(s / 2 / dist(p, q) / dist(p, r));
}

// GeoSDoub.FindOrientation(p, q, r), transcribed from its bytecode.
function findOrientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}

// InscribedAngleCanvas.DrawAngles(g, Color, radius): the central arcs it draws.
function appletCentral(A, B, Cpoint, O) {
  const Ap = P(2 * O.x - A.x, 2 * O.y - A.y);
  const inscribed = computeAngle(A, B, Cpoint);
  return inscribed >= Math.PI / 2
    ? computeAngle(O, B, Ap) + computeAngle(O, Ap, Cpoint)
    : computeAngle(O, B, Cpoint);
}

// InscribedAngleCanvas.DrawTangent(g, chordPoint, Color, radius).
function appletTangentChoice(A, O, chordPoint) {
  const T = P(A.x - (O.y - A.y), A.y + (O.x - A.x));
  const T2 = P(2 * A.x - T.x, 2 * A.y - T.y);
  return findOrientation(A, T, O) === findOrientation(A, T, chordPoint) ? T : T2;
}

const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const O = C.CENTER;
const stateAt = (a, b, c) => ({
  A: createPoint(O.x, O.y, a, C.RADIUS),
  B: createPoint(O.x, O.y, b, C.RADIUS),
  C: createPoint(O.x, O.y, c, C.RADIUS),
  names: true, explored: true,
});

/* ---------------------------------------------- 1. the opening picture */

{
  const s = C.start({});
  const ranges = [
    ["A", Math.PI / 2, C.START_ANGLES.A],
    ["B", Math.PI, C.START_ANGLES.B],
    ["C", 3 * Math.PI / 2, C.START_ANGLES.C],
  ];
  let inRanges = true, matches = true;
  for (const [name, middle, chosen] of ranges) {
    if (chosen < middle - Math.PI / 8 - 1e-12 || chosen > middle + Math.PI / 8 + 1e-12) inRanges = false;
    const expected = createPoint(O.x, O.y, chosen, C.RADIUS);
    if (dist(s[name], expected) > 1e-12) matches = false;
  }
  check("the radius is the applet's min(W/2,H/2)*2/3",
    C.RADIUS === 100 && C.RADIUS === Math.min(200, 150) * 2 / 3);
  check("the centre is the middle of the applet's 400x300 canvas", O.x === 200 && O.y === 150);
  check("the opening angles lie in the applet's three random ranges", inRanges);
  check("the opening points match CreatePoint at those angles", matches);
  check("Show names starts on, as the applet's show=1 default", s.names === true);
  check("a fresh picture is unexplored", s.explored === false);
  check("a picture has no win or loss", C.result(s) === null);
}

/* -------------------------------- 2. dragging, options and the record */

{
  const s = C.start({});
  const dragged = C.move(s, "B", P(500, 150));
  check("dragging a point keeps it on the circle", dist(dragged.B, O) === C.RADIUS);
  check("dragging puts B on the side it was dragged to", dragged.B.x > O.x && s.B.x < O.x);
  check("dragging marks the picture explored without changing the old one",
    dragged.explored === true && s.explored === false);
  check("a drag to the centre falls back to the starting point",
    dist(C.move(s, "A", P(O.x, O.y)).A, C.start({}).A) < 1e-12);
  check("an unknown handle is refused", C.move(s, "Q", P(300, 100)) === s);
  const optioned = C.setOption(s, "names", false);
  check("the names checkbox changes only that option",
    optioned.names === false && s.names === true && dist(optioned.A, s.A) === 0);
  check("an unknown option is refused", C.setOption(s, "size", 4) === s);
  check("reset restores the points but keeps the names option",
    dist(C.reset(optioned).A, s.A) < 1e-12 && C.reset(optioned).names === false);
  check("reset keeps the picture explored", C.reset(dragged).explored === true);
}

/* ----------------- 3. every 5° triple, plus 3,000 random positions ----- */

const configurations = [];
const grid = [];
for (let i = 0; i < 72; i++) grid.push(i * Math.PI / 36);
for (const a of grid) for (const b of grid) for (const c of grid) configurations.push([a, b, c]);
const rand = rng(20261127);
for (let i = 0; i < 3000; i++) {
  configurations.push([rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI]);
}

let normal = 0, tangentB = 0, tangentC = 0;
let claim = 0, drawn = 0, splitChoice = 0, inscribedMatch = 0;
let proofThales = 0, proofBase = 0, supplementary = 0, sameArc = 0, separated = 0, arcMatches = 0, usable = 0;
let maxClaim = 0, maxDrawn = 0, maxProof = 0;

for (const [a, b, c] of configurations) {
  const s = stateAt(a, b, c);
  const g = C.geometry(s);
  if (g.mode === "tangentB") tangentB++;
  else if (g.mode === "tangentC") tangentC++;
  else normal++;

  if (g.tangent) continue;

  // Skip only configurations where the applet's arcs are undefined because
  // two drawn points coincide, or the inscribed angle is exactly a right
  // angle, where the bytecode's single/split branch is borderline.
  if (dist(g.B, g.Ap) <= 1 || dist(g.C, g.Ap) <= 1 || dist(g.B, g.C) <= 1
      || Math.abs(g.inscribed - Math.PI / 2) <= 1e-9) continue;
  usable++;

  const inscribed = computeAngle(g.A, g.B, g.C);
  const central = appletCentral(g.A, g.B, g.C, O);
  const errClaim = Math.abs(g.central - 2 * g.inscribed);
  const errDrawn = Math.abs(g.central - central);
  maxClaim = Math.max(maxClaim, errClaim);
  maxDrawn = Math.max(maxDrawn, errDrawn);
  if (errClaim < 1e-8) claim++;
  if (errDrawn < 1e-8) drawn++;
  if (Math.abs(g.inscribed - inscribed) < 1e-9) inscribedMatch++;
  if (g.split === (inscribed >= Math.PI / 2)) splitChoice++;

  for (const part of g.proof) {
    if (!part.show) continue;
    // A, P and A′ lie on a circle with AA′ a diameter: Thales' right angle.
    const thales = Math.abs(part.atP - Math.PI / 2);
    // OA = OP, so triangle AOP is isosceles and its base angles match.
    const base = Math.abs(part.base - computeAngle(g.A, part.P, O));
    maxProof = Math.max(maxProof, thales, base);
    if (thales < 1e-8) proofThales++;
    if (base < 1e-8) proofBase++;
  }

  // The page's cyclic-quadrilateral claim: when the chord BC separates A
  // from A′, the two angles are supplementary.  When A and A′ are on the
  // same arc of BC they see the chord under the *same* angle instead.
  const fromAprime = C.angle(g.Ap, g.B, g.C);
  const tB = C.angleOf(g.B, C.CIRCLE), tC = C.angleOf(g.C, C.CIRCLE);
  const arcBC = C.ccw(tB, tC);
  const aOn = C.ccw(tB, C.angleOf(g.A, C.CIRCLE)) <= arcBC;
  const apOn = C.ccw(tB, C.angleOf(g.Ap, C.CIRCLE)) <= arcBC;
  if (aOn !== apOn) {
    separated++;
    if (Math.abs(g.inscribed + fromAprime - Math.PI) < 1e-8) supplementary++;
  } else {
    sameArc++;
    if (Math.abs(g.inscribed - fromAprime) < 1e-8) arcMatches++;
  }
}

check(`the grid and random sample ran (${configurations.length} triples)`,
  configurations.length === 72 ** 3 + 3000);
check(`normal triples and both tangent limits occurred (${normal}/${tangentB}/${tangentC})`,
  normal > configurations.length * 0.9 && tangentB > 100 && tangentC > 100);
check(`the core's arc matches the applet's drawn arcs (${drawn}/${usable})`, drawn === usable,
  `worst ${maxDrawn.toExponential(2)}`);
check(`the applet's drawn arcs are twice the inscribed angle (${claim}/${usable})`,
  claim === usable && maxClaim < 1e-8, `worst ${maxClaim.toExponential(2)}`);
check(`the core's angle matches GeoSDoub.ComputeAngle (${inscribedMatch}/${usable})`, inscribedMatch === usable);
check(`the core picks the same single/split arc as DrawAngles (${splitChoice}/${usable})`, splitChoice === usable);
check(`every proof point sees the diameter AA′ at a right angle (${proofThales} arcs)`,
  proofThales === 2 * usable && maxProof < 1e-8);
check(`the proof's isosceles base angles match the applet's arithmetic (${proofBase} arcs)`, proofBase === 2 * usable);
check(`when BC separates A from A′ the two angles add to 180° (${supplementary}/${separated})`,
  separated > 1000 && supplementary === separated);
check(`on the same arc of BC the two angles are equal (${arcMatches}/${sameArc})`,
  sameArc > 1000 && arcMatches === sameArc);
check(`the largest error in any angle claim is ${maxClaim.toExponential(2)}`, maxClaim < 1e-8);
check(`the largest error in any proof angle is ${maxProof.toExponential(2)}`, maxProof < 1e-8);

/* ------------------- 4. both tangent limits, in every configuration ---- */

let choiceFails = 0, angleFails = 0, mirrorFails = 0, maxTangent = 0;
let tangentClaimB = 0, tangentClaimC = 0, casesB = 0, casesC = 0;

for (const a of grid) {
  for (const c of grid) {
    for (const which of ["B", "C"]) {
      // B on A leaves chord AC; C on A leaves chord AB.
      const s = which === "B" ? stateAt(a, a, c) : stateAt(a, c, a);
      const g = C.geometry(s);
      if (!g.tangent) continue;
      const Q = g.tangent.chordPoint;
      if (dist(Q, g.A) < 1 || dist(Q, g.Ap) < 1) continue; // no chord to measure
      if (g.mode === "tangentB") casesB++; else casesC++;
      const expected = appletTangentChoice(g.A, O, Q);
      if (dist(expected, g.tangent.chosen) > 1e-12) choiceFails++;
      const central = computeAngle(O, g.A, Q);
      const marked = computeAngle(g.A, Q, expected);
      if (!near(g.tangent.central, central, 1e-9) || !near(g.tangent.marked, marked, 1e-9)) angleFails++;
      if (!near(g.tangent.marked + computeAngle(g.A, Q, g.tangent.T2), Math.PI)) mirrorFails++;
      const err = Math.abs(g.tangent.acute - central / 2);
      maxTangent = Math.max(maxTangent, err);
      if (err < 1e-8) {
        if (g.mode === "tangentB") tangentClaimB++; else tangentClaimC++;
      }
    }
  }
}

check(`the tangent ray matches FindOrientation in all ${casesB + casesC} cases`, choiceFails === 0, `${choiceFails} bad`);
check(`tangent angles match GeoSDoub.ComputeAngle (${casesB + casesC})`, angleFails === 0, `${angleFails} bad`);
check(`the two tangent rays give supplementary angles (${casesB + casesC})`, mirrorFails === 0, `${mirrorFails} bad`);
check(`B on A: tangent meets the chord at half the central angle (${tangentClaimB}/${casesB})`,
  tangentClaimB === casesB && tangentClaimB > 5000);
check(`C on A: tangent meets the chord at half the central angle (${tangentClaimC}/${casesC})`,
  tangentClaimC === casesC && tangentClaimC > 5000);
check(`the tangent claim holds to ${maxTangent.toExponential(2)}`, maxTangent < 1e-8);

/* ---------------------------------------- 5. status and description */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the status line reports both angles", C.describe(s).includes("90.0°")
    && C.describe(s).includes("45.0°"), C.describe(s));
  check("the status line changes when a point is dragged",
    C.describe(C.move(s, "C", P(300, 150))) !== C.describe(s));
  const tangent = C.move(s, "B", s.A);
  check("the status line switches to the tangent case",
    C.geometry(tangent).mode === "tangentC" && C.describe(tangent).includes("tangent at A"));
  check("every stored position is plain data on the circle", [s.A, s.B, s.C].every((p) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && dist(p, O) === C.RADIUS));
  check("the drawn central angle agrees with the status line", near(g.central, 2 * g.inscribed));
}

done("inscribed-angle");
