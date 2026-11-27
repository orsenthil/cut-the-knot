#!/usr/bin/env node
"use strict";

/*
 * Logic test for fixed-point/fixed-point-core.js.
 *
 *   node porting/check-fixed-point.mjs
 *
 * 1. The start position and the applet's pointer limits.
 * 2. A second, literal transcription of the applet's bytecode (ComputeAngle,
 *    FindOrientation, Rotate, Intersect, FindIncenter and the run() loop)
 *    compared with the core over thousands of triples and hundreds of full
 *    two-trip animations.
 * 3. The page's claims, exhaustively over a grid of triangles: one trip is a
 *    half-turn about the incircle's touch point on AB, two trips restore every
 *    point, the tangent-length formulas, and "the midpoint is fixed sometimes,
 *    but not in general" (exactly when CA = CB).
 * 4. The animation's own bookkeeping: when the C marker joins, what a drag
 *    clears, and which positions are refused.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fixed-point/fixed-point-core.js", "FixedPointCore");
const P = C.pt;
const near = (p, q, tol = 1e-7) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const close = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

/* ------------------------------------------------ 1. the start and the board */

{
  const s = C.start();
  // GetPoint(i) with width=500, height=400: radius min(w,h)/4 = 100.
  const expected = [0, 1, 2].map((i) => P(
    250 + 100 * Math.cos((i * 2 * Math.PI) / 3),
    200 + 100 * Math.sin((i * 2 * Math.PI) / 3),
  ));
  check("start uses the applet's three GetPoint positions",
    expected.every((p, i) => near(s[i ? i === 1 ? "B" : "C" : "A"], p, 1e-9)));
  check("the starting triangle is equilateral",
    close(C.dist(s.A, s.B), C.dist(s.B, s.C), 1e-9) &&
    close(C.dist(s.B, s.C), C.dist(s.C, s.A), 1e-9));
  check("the starting midpoint of AB is the tangency point",
    near(C.midpoint(s.A, s.B), C.tangentLengths(s.A, s.B, s.C).touchAB));
  check("a fresh illustration has no tracked line points", s.pts === null && s.firstTime === true);
  check("a fresh illustration is idle", s.phase === C.IDLE && s.trips === 0);
  equal("the position is plain data", JSON.parse(JSON.stringify(s)), s);

  check("PointIsEligible refuses the left and top edges",
    !C.eligible(P(2, 100)) && !C.eligible(P(100, 0)));
  check("PointIsEligible refuses the right and bottom edges",
    !C.eligible(P(500, 100)) && !C.eligible(P(100, 398)));
  check("PointIsEligible accepts a point just inside",
    C.eligible(P(3, 1)) && C.eligible(P(499, 397)));
  check("a flat triangle has no angle to rotate through",
    !C.valid({ ...s, C: C.midpoint(s.A, s.B) }) && C.valid(s));
}

/* ---------------------------------- 2. a second transcription of the bytecode */

/* PointOnLine / LineOfPoints straight from `javap -c`, independently named. */
function jSq(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx * dx + dy * dy;
}
function jDistance(p, q) { return Math.sqrt(jSq(p, q)); }
function jAngle(p, q, r) {
  const s3 = jSq(p, q) + jSq(p, r) - jSq(q, r);
  return Math.acos(s3 / 2 / jDistance(p, q) / jDistance(p, r));
}
function jOrientation(p, q, r) {
  const cross = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return cross > 0 ? 1 : -1; // dcmpl 0; ifle -> -1, otherwise 1
}
function jRotate(centre, p, theta, orientation) {
  const s5 = Math.cos(theta), s7 = Math.sin(theta);
  const s9 = centre.x + s5 * (p.x - centre.x) - orientation * s7 * (p.y - centre.y);
  const s11 = centre.y + orientation * s7 * (p.x - centre.x) + s5 * (p.y - centre.y);
  return P(s9, s11);
}
function jSteps(angle) { return Math.round((angle * 6.0 * 10) / Math.PI) + 1; }
function jIntersect(p, q, r, s) {
  const s4 = p.y - q.y, s6 = q.x - p.x, s8 = p.x * q.y - p.y * q.x;
  const s10 = r.y - s.y, s12 = s.x - r.x, s14 = r.x * s.y - r.y * s.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  return P(s16 / s20, s18 / s20);
}
function jIncenter(A, B, Cc) {
  const s3 = jAngle(A, B, Cc) / 2;
  const s5 = jAngle(B, Cc, A) / 2;
  const orientation = jOrientation(A, B, Cc);
  const bisectors = [jRotate(A, B, s3, orientation), jRotate(B, Cc, s5, orientation)];
  return jIntersect(A, bisectors[0], B, bisectors[1]);
}

/* FixedPointCanvas.run(), including the late addition of C after turn two. */
function jTrip(A, B, Cc, trips) {
  let pts = [P(A.x, A.y), P(B.x, B.y), P((A.x + B.x) / 2, (A.y + B.y) / 2)];
  let addedC = false;
  for (let t = 0; t < trips; t++) {
    const stages = [
      { pivot: A, angle: jAngle(A, B, Cc), o: jOrientation(A, B, Cc) },
      { pivot: Cc, angle: jAngle(Cc, A, B), o: jOrientation(Cc, A, B) },
      { pivot: B, angle: jAngle(B, Cc, A), o: jOrientation(B, Cc, A) },
    ];
    for (let stage = 0; stage < 3; stage++) {
      const { pivot, angle, o } = stages[stage];
      const total = jSteps(angle);
      const theta = angle / total;
      for (let i = 0; i < total; i++) {
        // PointOnLine.Equals: squared distance below 0.1, so the pivot skips.
        pts = pts.map((p) => (jSq(p, pivot) < 0.1 ? p : jRotate(pivot, p, theta, o)));
      }
      if (stage === 1 && !addedC) {
        pts.push(P(Cc.x, Cc.y)); // run(): AddPoint(C) after the C rotation
        addedC = true;
      }
    }
  }
  return pts;
}

const rand = rng(20261127);
{
  let badAngle = 0, badOrient = 0, badRotate = 0, badSteps = 0;
  for (let i = 0; i < 2000; i++) {
    const p = P(rand() * 500, rand() * 400);
    const q = P(rand() * 500, rand() * 400);
    const r = P(rand() * 500, rand() * 400);
    if (!close(C.computeAngle(p, q, r), jAngle(p, q, r), 1e-12)) badAngle++;
    if (C.findOrientation(p, q, r) !== jOrientation(p, q, r)) badOrient++;
    const theta = rand() * Math.PI;
    const o = rand() < 0.5 ? -1 : 1;
    if (!near(C.rotate(q, p, theta, o), jRotate(q, p, theta, o), 1e-12)) badRotate++;
    if (C.steps(theta) !== jSteps(theta)) badSteps++;
  }
  check("ComputeAngle matches the applet on 2000 triples", badAngle === 0, `${badAngle} differences`);
  check("FindOrientation including its zero case matches the applet", badOrient === 0, `${badOrient} differences`);
  check("a straight-line triple has the applet's -1 orientation",
    C.findOrientation(P(0, 0), P(1, 1), P(2, 2)) === -1 &&
    jOrientation(P(0, 0), P(1, 1), P(2, 2)) === -1);
  check("Rotate by zero is the identity and by pi is a half-turn",
    near(C.rotate(P(100, 100), P(250, 50), 0, 1), P(250, 50)) &&
    near(C.rotate(P(100, 100), P(250, 50), Math.PI, 1), P(-50, 150)));
  check("Rotate's sign and centre match the applet on 2000 turns", badRotate === 0, `${badRotate} differences`);
  check("the animation step count matches round(a*6*10/pi)+1", badSteps === 0, `${badSteps} differences`);
}

{
  let badIntersect = 0, badIncenter = 0, cases = 0;
  for (let i = 0; i < 400; i++) {
    const p = P(rand() * 500, rand() * 400), q = P(rand() * 500, rand() * 400);
    const r = P(rand() * 500, rand() * 400), s = P(rand() * 500, rand() * 400);
    if (!near(C.intersect(p, q, r, s), jIntersect(p, q, r, s), 1e-7)) badIntersect++;
    const A = P(350, 200), B = P(80 + rand() * 120, 260 + rand() * 120);
    const Cc = P(80 + rand() * 120, 20 + rand() * 120);
    if (!near(C.incenter(A, B, Cc), jIncenter(A, B, Cc), 1e-7)) badIncenter++;
    cases++;
  }
  check(`Intersect matches the applet on ${cases} random line pairs`, badIntersect === 0, `${badIntersect} differences`);
  check(`FindIncenter matches the applet on ${cases} triangles`, badIncenter === 0, `${badIncenter} differences`);
}

/* A grid of triangles plus random ones: the whole animation is compared here. */
const triangles = [];
{
  const s = C.start();
  triangles.push([s.A, s.B, s.C]);
  triangles.push([P(350, 200), P(150, 300), P(210, 80)]);
  triangles.push([P(320, 210), P(120, 300), P(400, 90)]);
  for (let bx = 80; bx <= 420; bx += 68) {
    for (let by = 60; by <= 340; by += 70) {
      for (let cx = 80; cx <= 420; cx += 68) {
        for (let cy = 60; cy <= 340; cy += 70) {
          const tri = [P(350, 200), P(bx, by), P(cx, cy)];
          if (C.valid({ A: tri[0], B: tri[1], C: tri[2] })) triangles.push(tri);
        }
      }
    }
  }
  for (let i = 0; i < 120; i++) {
    const tri = [P(350, 200), P(60 + rand() * 380, 20 + rand() * 370),
      P(60 + rand() * 380, 20 + rand() * 370)];
    if (C.valid({ A: tri[0], B: tri[1], C: tri[2] })) triangles.push(tri);
  }
}

{
  let badOne = 0, badTwo = 0, badCfg = 0;
  for (const [A, B, Cc] of triangles) {
    const s = { ...C.start(), A, B, C: Cc };
    const one = C.trip(s);
    const two = C.trip(one);
    const refOne = jTrip(A, B, Cc, 1);
    const refTwo = jTrip(A, B, Cc, 2);
    one.pts.forEach((p, i) => { if (!near(p, refOne[i], 1e-6)) badOne++; });
    two.pts.forEach((p, i) => { if (!near(p, refTwo[i], 1e-6)) badTwo++; });
    for (let phase = 0; phase < 3; phase++) {
      const cfg = C.stageConfig(s, phase);
      const ref = [
        [A, B, Cc], [Cc, A, B], [B, Cc, A],
      ][phase];
      if (cfg.total !== jSteps(jAngle(ref[0], ref[1], ref[2])) ||
          cfg.orientation !== jOrientation(ref[0], ref[1], ref[2])) badCfg++;
    }
  }
  check(`${triangles.length} full trips match the applet's run() point by point`,
    badOne === 0, `${badOne} differences`);
  check(`${triangles.length} second trips match the applet's run() point by point`,
    badTwo === 0, `${badTwo} differences`);
  check("each stage's pivot, direction and step count match the applet",
    badCfg === 0, `${badCfg} differences`);
}

/* ------------------------------------------------ 3. the page's claims */

{
  const s = C.start();
  let badHalfTurn = 0, badTwoTrips = 0, badReverse = 0;
  let badTangent = 0, badTouch = 0, badFormula = 0, badMid = 0;
  let cases = 0;
  const grid = [];
  for (let bx = 60; bx <= 440; bx += 38) {
    for (let by = 40; by <= 360; by += 40) {
      for (let cx = 60; cx <= 440; cx += 38) {
        for (let cy = 40; cy <= 360; cy += 40) {
          const tri = [P(350, 200), P(bx, by), P(cx, cy)];
          if (C.valid({ A: tri[0], B: tri[1], C: tri[2] })) grid.push(tri);
        }
      }
    }
  }
  for (const [A, B, Cc] of grid) {
    const t = C.tangentLengths(A, B, Cc);
    // The page: x+y=a, y+z=b, z+x=c with a=BC, b=CA, c=AB, so
    // x=tB, y=tC, z=tA. Its solution is x=(a-b+c)/2, etc.
    if (!close(t.tB + t.tC, t.a) || !close(t.tC + t.tA, t.b) || !close(t.tA + t.tB, t.c)) badTangent++;
    if (!close(t.tB, (t.a - t.b + t.c) / 2) ||
        !close(t.tC, (t.a + t.b - t.c) / 2) ||
        !close(t.tA, (t.b + t.c - t.a) / 2) ||
        !close(t.tA + t.tB + t.tC, (t.a + t.b + t.c) / 2)) badFormula++;
    if (!near(t.touchAB, P(A.x + ((B.x - A.x) * t.tA) / t.c,
      A.y + ((B.y - A.y) * t.tA) / t.c))) badTouch++;

    // "One trip is a half-turn about the fixed point", tested on five points.
    for (const f of [0, 0.25, 0.5, 1, 1.5]) {
      const p = P(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f);
      const mapped = C.mapPoint(p, A, B, Cc);
      const halfTurn = P(2 * t.touchAB.x - p.x, 2 * t.touchAB.y - p.y);
      if (!near(mapped, halfTurn)) badHalfTurn++;
      if (!near(C.mapPoint(mapped, A, B, Cc), p)) badTwoTrips++;
    }
    // The line is in the same place but faces the other way: its direction
    // vector is reversed (up to a positive scale factor).
    const u0 = P(B.x - A.x, B.y - A.y);
    const u1 = P(C.mapPoint(B, A, B, Cc).x - C.mapPoint(A, A, B, Cc).x,
      C.mapPoint(B, A, B, Cc).y - C.mapPoint(A, A, B, Cc).y);
    if (u0.x * u1.x + u0.y * u1.y >= 0 ||
        Math.abs(u0.x * u1.y - u0.y * u1.x) > 1e-6 * C.dist(A, B) ** 2) badReverse++;

    // The applet also marks the midpoint of AB: it is fixed exactly when
    // CA = CB (the start triangle happens to be equilateral).
    const isIsosceles = close(t.b, t.a, 1e-7);
    if (C.midpointIsFixed(A, B, Cc) !== isIsosceles) badMid++;
    cases++;
  }
  check(`one trip is a half-turn about the incircle's touch point on AB (${cases} triangles)`,
    badHalfTurn === 0, `${badHalfTurn} failures`);
  check(`two trips restore every sampled point on the line (${cases} triangles)`,
    badTwoTrips === 0, `${badTwoTrips} failures`);
  check(`the line returns to AB with its direction reversed (${cases} triangles)`,
    badReverse === 0, `${badReverse} failures`);
  check(`the page's tangent equations x+y=a, y+z=b, z+x=c hold (${cases} triangles)`,
    badTangent === 0, `${badTangent} failures`);
  check(`the page's formulas x=(a-b+c)/2, y=(a+b-c)/2, z=(b+c-a)/2 hold, and x+y+z is the semiperimeter`,
    badFormula === 0, `${badFormula} failures`);
  check(`the fixed point is where the incircle touches AB (${cases} triangles)`,
    badTouch === 0, `${badTouch} failures`);
  check(`the midpoint is fixed exactly when CA=CB (${cases} triangles)`,
    badMid === 0, `${badMid} failures`);
}

/* --------------------------------------- 4. the animation's own bookkeeping */

{
  const s = C.start();
  let a = C.beginTrip(s);
  while (a.phase === 0) a = C.stepOnce(a);
  check("the applet's three line dots exist before vertex C joins", a.pts.length === 3);
  check("the dot on the pivot stays put through the A rotation", near(a.pts[0], s.A));
  check("the second stage is about C", a.phase === 1 && a.firstTime === true);
  while (a.phase === 1) a = C.stepOnce(a);
  check("C's dot joins after the second rotation", a.pts.length === 4 && a.addedC && !a.firstTime);
  check("pressing Go twice while running does nothing", C.beginTrip(a) === a);
  while (a.phase !== C.IDLE) a = C.stepOnce(a);
  check("a finished trip is idle and counted once", a.phase === C.IDLE && a.trips === 1);

  const moved = C.withVertex(a, "A", P(300, 180));
  check("dragging a vertex clears the pivot line and the count",
    moved.pts === null && moved.firstTime && moved.trips === 0 && moved.phase === C.IDLE);
  check("dragging an unknown vertex or off-board point is refused",
    C.withVertex(moved, "X", P(100, 100)) === moved &&
    C.withVertex(moved, "B", P(600, 100)) === moved);
  check("an invalid triangle cannot start a trip", C.beginTrip({ ...moved, C: P(300, 180) }).phase === C.IDLE);

  const one = C.trip(moved);
  const two = C.trip(one);
  check("two trips bring the three original line dots back",
    near(two.pts[0], moved.A, 1e-6) && near(two.pts[1], moved.B, 1e-6) &&
    near(two.pts[2], C.midpoint(moved.A, moved.B), 1e-6));
  check("a completed trip leaves the line's dots at their half-turned places",
    near(one.pts[0], C.mapPoint(moved.A, moved.A, moved.B, moved.C), 1e-6) &&
    near(one.pts[1], C.mapPoint(moved.B, moved.A, moved.B, moved.C), 1e-6) &&
    near(one.pts[2], C.mapPoint(C.midpoint(moved.A, moved.B), moved.A, moved.B, moved.C), 1e-6));
}

done("fixed-point");
