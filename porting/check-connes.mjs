#!/usr/bin/env node
"use strict";

/*
 * Logic test for connes/connes-core.js.
 *
 *   node porting/check-connes.mjs
 *
 * The page's exact claim is the iff: for a positively oriented triangle
 * A + jB + j^2 C = 0 exactly when ABC is equilateral (j = +120 degrees).
 * Equivalently, (A-C) + j(B-C) = 0 — one pair of sides already suffices.
 * Geometrically the sum of B1 (B turned +120) and C1 (C turned -120) must be
 * the point opposite A, so the parallelogram corner sits on O and the applet's
 * red sum dot lands on O. This test checks the roots-of-unity identity, the
 * iff in both directions, the one-pair shortcut, the rotation lengths and the
 * rounded sum dot over generated equilateral triangles in both orientations,
 * near misses, degeneracies and an exhaustive integer grid.
 *
 * The last section is a second transcription straight from the bytecode:
 * GeoSDoub.FindOrientation, GeoSDoub.Rotate, and the coordinate arithmetic in
 * ConnesCanvas.DrawConnesSum. It is compared with the core on the whole grid
 * and on 20,000 random triangles (including duplicates and collinear points).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("connes/connes-core.js", "ConnesCore");
const TURN = 2.0943951023931953; // the applet's stored constant
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const vec = (x, y) => ({ x, y });
const allClaims = (s) => C.claims(s);
const claimsPass = (cl) => Object.values(cl).every(Boolean);

/* ---------------- the applet's own computation, transcribed from bytecode */

/* GeoSDoub.FindOrientation: cross > 0 ? 1 : -1, with zero counting as -1. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(P,Q,2pi/3,orientation), arithmetic in bytecode order. */
function appletRotate(P, Q, orientation) {
  const cs = Math.cos(TURN), sn = Math.sin(TURN);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* ConnesCanvas.DrawConnesSum: B1, C1, the parallelogram corner and sum dot. */
function appletDrawConnesSum(A, B, D, O) {
  const orientation = appletOrientation(A, B, D);
  const B1 = appletRotate(O, B, orientation);
  const C1 = appletRotate(O, D, orientation === 1 ? -1 : 1);
  return {
    sign: orientation,
    B1, C1,
    corner: {
      x: Math.round(B1.x + C1.x - O.x),
      y: Math.round(B1.y + C1.y - O.y),
    },
    sumDot: {
      x: Math.round(B1.x + C1.x + A.x - 2 * O.x),
      y: Math.round(B1.y + C1.y + A.y - 2 * O.y),
    },
  };
}

const samePoint = (p, q) => p.x === q.x && p.y === q.y;
function agreesWithApplet(s) {
  const a = appletDrawConnesSum(s.A, s.B, s.C, s.O);
  const b = C.compute(s);
  return a.sign === b.sign && samePoint(a.B1, b.B1) && samePoint(a.C1, b.C1) &&
    samePoint(a.corner, b.corner) && samePoint(a.sumDot, b.sumDot);
}

function triangleAt(O, radius, theta, positive) {
  // Screen y grows down: decreasing angle is a positive mathematical turn.
  const at = (angle) => vec(O.x + radius * Math.cos(angle), O.y + radius * Math.sin(angle));
  const A = at(theta), first = at(theta - TURN), second = at(theta + TURN);
  return {
    A,
    B: positive ? first : second,
    C: positive ? second : first,
    O: { ...O },
    showVectors: false,
  };
}

/* --------------------------------------------- 1. start and the UI options */

{
  const s = C.start({});
  equal("start A matches ConnesCanvas.Reset on a 400x300 applet", s.A, { x: 40, y: 150 });
  equal("start B matches ConnesCanvas.Reset", s.B, { x: 280, y: 230 });
  equal("start C matches ConnesCanvas.Reset", s.C, { x: 200, y: 70 });
  equal("the origin is the canvas centre", s.O, { x: 200, y: 150 });
  check("Show vector sums starts off, as the applet's checkbox does", s.showVectors === false);
  check("an illustration has no result", C.result(s) === null);
  check("the starting triangle is not equilateral", !C.isEquilateral(s));
  check("the starting triangle is positively oriented on the page (screen cross < 0)", C.orientation(s) === -1);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", vec(10, 20));
    return s.A.x === 40 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("withOption changes only the named option", (() => {
    const next = C.withOption(s, "showVectors", true);
    return next.showVectors === true && s.showVectors === false && next.A.x === s.A.x;
  })());
}

/* ---------------------------------- 2. the roots of unity, as complex numbers */

{
  const one = vec(1, 0), j = C.rotateVec(one, -1), j2 = C.rotateVec(j, -1), j3 = C.rotateVec(j2, -1);
  check("j has unit length", close(C.length(j), 1, 1e-12));
  // Screen y grows down, so the mathematical +120 degrees is -TURN here.
  check("j is a turn of 120 degrees", close(Math.atan2(j.y, j.x), -TURN, 1e-12));
  check("1 + j + j^2 = 0 (the page's equation 1)",
    close(C.length(C.add(C.add(one, j), j2)), 0, 1e-12));
  check("j^3 = 1", close(C.length(C.sub(j3, one)), 0, 1e-12));
  check("1 + j = -j^2, used to turn (3) into (2)",
    C.length(C.sub(C.add(one, j), vec(-j2.x, -j2.y))) < 1e-12);
  check("the core reports these roots", allClaims(C.start({})).rootsOfUnity);
}

/* -------------------------- 3. exact equilateral triangles in both orders */

{
  let tested = 0;
  let sumOnO = 0;
  let pairOk = 0;
  for (const radius of [7, 23, 50, 140, 240]) {
    for (const [cx, cy] of [[200, 150], [13, 9], [317, 288]]) {
      const O = vec(cx, cy);
      for (let degree = 0; degree < 360; degree += 10) {
        for (const positive of [true, false]) {
          const s = triangleAt(O, radius, degree * Math.PI / 180, positive);
          const m = C.compute(s), cl = allClaims(s);
          if (!C.isEquilateral(s) || !claimsPass(cl) || m.criterionLength > 1e-7 * radius) {
            check(`equilateral r=${radius} ${degree} deg positive=${positive}: every claim holds`, false,
              JSON.stringify(cl) + ` residue ${m.criterionLength}`);
          }
          if (C.distance(m.sumDot, O) <= 1) sumOnO++;
          if (cl.onePairOfSides) pairOk++;
          // Turn one corner by one thousandth of a radius: both fail.
          const bumped = C.withPoint(s, "A", vec(s.A.x + radius * 0.001, s.A.y));
          if (C.isEquilateral(bumped) || allClaims(bumped).criterion) {
            check(`near miss r=${radius} ${degree} deg: criterion fails`, false);
          }
          tested++;
        }
      }
    }
  }
  check(`the page's iff holds on ${tested} equilateral triangles in both orders`, tested === 1080);
  check(`the rounded sum dot lands on O in all ${tested} cases`, sumOnO === tested);
  check(`one pair of sides is sufficient in all ${tested} cases`, pairOk === tested);
}

/* ------ 4. the preset, its geometry, and a scalene triangle's failure mode */

{
  const s = C.equilateralPreset(C.start({}));
  const m = C.compute(s);
  const sides = C.sideLengths(s);
  check("the preset is equilateral", C.isEquilateral(s));
  check("the preset has three equal sides", close(sides.AB, sides.BC, 1e-10) && close(sides.BC, sides.CA, 1e-10));
  check("the preset uses the page's positive orientation (screen cross < 0)", C.orientation(s) === -1);
  check("the preset's sum dot is exactly O", samePoint(m.sumDot, s.O), JSON.stringify(m.sumDot));
  check("the preset's corner is the point opposite A",
    C.length(C.sub(m.corner, vec(s.O.x - (s.A.x - s.O.x), s.O.y - (s.A.y - s.O.y)))) <= 1);
  check("B1 stays 140 from O", close(C.distance(m.B1, s.O), 140, 1e-9));
  check("the turn from OB to OB1 is 120 degrees",
    close(Math.acos(Math.max(-1, Math.min(1,
      ((m.B1.x - s.O.x) * (s.B.x - s.O.x) + (m.B1.y - s.O.y) * (s.B.y - s.O.y)) /
      (C.distance(m.B1, s.O) * C.distance(s.B, s.O))))), TURN, 1e-9));

  const scalene = C.start({});
  check("a scalene triangle does not satisfy the criterion", !allClaims(scalene).criterion);
  check("the scalene sum dot is not on O", C.distance(C.compute(scalene).sumDot, scalene.O) > 10);
  check("the scalene triangle fails the page's iff honestly", allClaims(scalene).equivalent);
  check("the scalene triangle still passes the geometric construction claims",
    allClaims(scalene).rotationsKeepLength && allClaims(scalene).parallelogram &&
    allClaims(scalene).sumIsMinusA === false);
}

/* ------------------- 5. every case on an exhaustive integer configuration grid */

{
  const offsets = [-120, -60, 0, 60, 120];
  let cases = 0, equivalent = 0, otherClaims = 0, appletAgreement = 0;
  for (const ax of offsets) for (const ay of offsets) {
    const A = vec(200 + ax, 150 + ay);
    for (const bx of offsets) for (const by of offsets) {
      const B = vec(200 + bx, 150 + by);
      for (const cx of offsets) for (const cy of offsets) {
        const Cc = vec(200 + cx, 150 + cy);
        const s = { A, B, C: Cc, O: vec(200, 150), showVectors: false };
        const cl = allClaims(s);
        if (cl.equivalent) equivalent++;
        if (cl.literalPositive && cl.onePairOfSides && cl.rootsOfUnity &&
            cl.rotationsKeepLength && cl.parallelogram && cl.sumDotOnO) otherClaims++;
        if (agreesWithApplet(s)) appletAgreement++;
        cases++;
      }
    }
  }
  check(`the iff is tested on all ${cases} grid configurations`, cases === 15625);
  check(`the iff holds in every grid configuration`, equivalent === cases);
  check(`the other page claims hold in all ${cases} grid configurations`, otherClaims === cases,
    `passed ${otherClaims}`);
  check(`applet and core agree on B1, C1, corner and sum dot in all ${cases} cases`,
    appletAgreement === cases, `agreed ${appletAgreement}`);
}

/* ------------- 6. the same answers as the applet on 20,000 random triangles */

{
  const rand = rng(3692);
  let compared = 0;
  for (let i = 0; i < 20000; i++) {
    const s = {
      A: vec(-500 + rand() * 1300, -400 + rand() * 1100),
      B: vec(-500 + rand() * 1300, -400 + rand() * 1100),
      C: vec(-500 + rand() * 1300, -400 + rand() * 1100),
      O: vec(200, 150),
      showVectors: false,
    };
    if (!agreesWithApplet(s)) {
      check(`random ${i}: applet and core agree`, false, JSON.stringify(s));
    }
    if (!allClaims(s).equivalent) {
      check(`random ${i}: the iff holds`, false, JSON.stringify(s));
    }
    compared++;
  }
  check(`applet and core agree exactly on ${compared} random triangles`, compared === 20000);
}

/* ----------------------------------------- 7. degenerate and edge cases */

{
  const O = vec(200, 150);
  const flat = {
    A: vec(40, 150), B: vec(120, 150), C: vec(280, 150), O, showVectors: false,
  };
  check("a collinear triangle is not equilateral", !C.isEquilateral(flat));
  check("zero cross gives the applet's -1 orientation", C.orientation(flat) === -1);
  check("a collinear triangle does not satisfy the criterion", !allClaims(flat).criterion);

  const same = { A: vec(60, 60), B: vec(60, 60), C: vec(60, 60), O, showVectors: false };
  check("three identical corners are not equilateral", !C.isEquilateral(same));
  check("three corners at O give the zero criterion", C.compute(same).criterionLength < 1e-9);
  check("the geometry claims handle identical corners without throwing", Boolean(allClaims(same)));

  const moved = C.withPoint(same, "B", vec(260, 60));
  check("moving one corner out of coincidence keeps the other points", samePoint(same.B, vec(60, 60)) && samePoint(moved.B, vec(260, 60)));
  check("an arbitrary width and height place O at the centre",
    samePoint(C.start({ width: 640, height: 460 }).O, vec(320, 230)));
}

done("connes");
