#!/usr/bin/env node
"use strict";

/*
 * Logic test for mcworter/mcworter-core.js.
 *
 *   node porting/check-mcworter.mjs
 *
 * Checked: the start against a second transcription of McWorterCanvas.init;
 * the whole figure against a second, literal transcription of FormSquare,
 * Midpoint and Compute on fixed, degenerate, grid (3,375 triples) and 600
 * random configurations; every claim on the page (M does not depend on C;
 * D completes ADBC; B_a D A_b is isosceles with a right angle at D; the two
 * flank squares; the hint's equal sides) over all of them; the rotation
 * routine's bytecode formula; and the difference from McWorter2's theorem
 * (similar parallelograms with angle and ratio sliders, no right-angle claim).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("mcworter/mcworter-core.js", "McworterCore");

const HALF_PI = Math.PI / 2;
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const pos = (A, B, Cc, opts) => C.start({ points: { A, B, C: Cc }, ...(opts || {}) });

/* ------------------------ the applet's computation, transcribed a second time */

/* GeoSDoub.Rotate(DoubPoint P, DoubPoint Q, double angle, int orientation). */
function appletRotate(P0, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = Q.x - P0.x, dy = Q.y - P0.y;
  return {
    x: P0.x + cs * dx - orientation * sn * dy,
    y: P0.y + orientation * sn * dx + cs * dy,
  };
}

/* McWorterCanvas.FormSquare(p, q, corner1, corner2), writing in place. */
function appletFormSquare(p, q, corner1, corner2) {
  const r1 = appletRotate(p, q, HALF_PI, 1);
  corner1.x = r1.x; corner1.y = r1.y;
  const r2 = appletRotate(q, p, HALF_PI, -1);
  corner2.x = r2.x; corner2.y = r2.y;
}

/* McWorterCanvas.Compute: FormSquare(B,C,AB,AC), FormSquare(C,A,BC,BA),
 * M = Midpoint(BA,AB), D = new DoubPoint(A.x+B.x-C.x, A.y+B.y-C.y). */
function appletDraw(s) {
  const A = { x: s.A.x, y: s.A.y }, B = { x: s.B.x, y: s.B.y }, Cc = { x: s.C.x, y: s.C.y };
  const Ab = { x: 0, y: 0 }, Ac = { x: 0, y: 0 };
  const Bc = { x: 0, y: 0 }, Ba = { x: 0, y: 0 };
  appletFormSquare(B, Cc, Ab, Ac);
  appletFormSquare(Cc, A, Bc, Ba);
  const M = { x: (Ba.x + Ab.x) / 2, y: (Ba.y + Ab.y) / 2 };
  const D = { x: A.x + B.x - Cc.x, y: A.y + B.y - Cc.y };
  return { A, B, C: Cc, Ab, Ac, Bc, Ba, M, D };
}

/* McWorterCanvas.init on a width x height canvas. */
function appletStart(width, height) {
  const x = width / 2, y = height / 2, dx = width / 8, dy = height / 3;
  return pos(P(x - dx, y + dy), P(x + dx, y + dy),
    P(x + dx * Math.cos(Math.PI / 3), y - dx * Math.sin(Math.PI / 3) + dy / 2));
}

/* The article's closed form, written by hand as (a+b)/2 + (a-b)i/2. */
function articleMidpoint(A, B) {
  return P((A.x + B.x - A.y + B.y) / 2, (A.y + B.y + A.x - B.x) / 2);
}

/* McWorter2Canvas.ComputePoint(out, pivot, point, angle, K) then its
 * CompleteParallelogram: the sibling applet's sliders, for the contrast. */
function applet2(pivot, point, angle, K) {
  const r = appletRotate(pivot, point, angle, -1);
  return P(pivot.x + K * (r.x - pivot.x), pivot.y + K * (r.y - pivot.y));
}
function applet2Figure(A, B, Cc, angle, K) {
  const Ac = applet2(Cc, B, angle, K);
  const Ab = P(Ac.x + B.x - Cc.x, Ac.y + B.y - Cc.y);
  const Ba = applet2(A, Cc, angle, K);
  const M = P((Ba.x + Ab.x) / 2, (Ba.y + Ab.y) / 2);
  const D = P(A.x + B.x - Cc.x, A.y + B.y - Cc.y);
  return { Ab, Ba, M, D };
}

/* -------------------------------------- 1. the start and the three checkboxes */

{
  const s = C.start();
  equal("start is McWorterCanvas.init at 400x250", s, appletStart(400, 250));
  equal("start follows init at 500x500 (the size on the page)",
    C.start({ width: 500, height: 500 }), appletStart(500, 500));
  check("names start hidden", s.showNames === false);
  check("rotation lines start hidden", s.showLines === false);
  check("hint starts hidden", s.showHint === false);
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("moving C changes only C", (() => {
    const next = C.withPoint(s, "C", P(10, 20));
    return next.C.x === 10 && next.C.y === 20 && next.A.x === s.A.x &&
      next.B.y === s.B.y && s.C.x !== 10;
  })());
  check("an unknown handle changes nothing",
    closePoint(C.withPoint(s, "Z", P(1, 2)).C, s.C, 0));
  check("the three applet checkboxes are independent", (() => {
    let t = C.withOption(s, "showHint", true);
    t = C.withOption(t, "showNames", true);
    t = C.withOption(t, "showLines", true);
    return t.showHint && t.showNames && t.showLines &&
      C.withOption(t, "showHint", false).showLines === true;
  })());
  check("position is plain data", JSON.parse(JSON.stringify(s)).A.x === s.A.x);
}

/* --------------------------- 2. fixed configurations, including odd ones */

const fixed = [
  ["the applet's start", C.start()],
  ["C straight above AB", pos(P(100, 200), P(300, 200), P(200, 40))],
  ["C to the left", pos(P(180, 180), P(280, 180), P(40, 120))],
  ["C below AB", pos(P(120, 80), P(320, 80), P(200, 240))],
  ["a tall thin triangle", pos(P(190, 230), P(210, 230), P(200, 10))],
  ["C on the line AB", pos(P(100, 150), P(300, 150), P(180, 150))],
  ["C above the midpoint", pos(P(110, 200), P(310, 200), P(210, 20))],
];

for (const [name, s] of fixed) {
  const tol = 1e-8 * Math.max(1, dist(s.A, s.B));
  const mine = C.figure(s), theirs = appletDraw(s);
  for (const key of ["A", "B", "C", "Ab", "Ac", "Bc", "Ba", "M", "D"]) {
    check(`${name}: ${key} matches Compute`, closePoint(mine[key], theirs[key], tol),
      `core ${JSON.stringify(mine[key])}, applet ${JSON.stringify(theirs[key])}`);
  }
  const cl = C.claims(s);
  for (const [key, value] of Object.entries(cl)) {
    check(`${name}: ${key}`, value, key === "rightAtD" ? `angle ${C.angleAtD(s)}` : "");
  }
  check(`${name}: the angle at D is 90 degrees`, close(C.angleAtD(s), 90, 1e-7),
    `${C.angleAtD(s)}`);
  check(`${name}: M is the article's closed form`,
    closePoint(mine.M, articleMidpoint(s.A, s.B), tol));
}

/* ------------------------- 3. C can go anywhere: a grid with A and B fixed */

{
  const A = P(110, 190), B = P(310, 190);
  const centre = C.squareCentre(pos(A, B, P(200, 50)));
  let tested = 0;
  for (let gx = 0; gx < 20; gx++) {
    for (let gy = 0; gy < 12; gy++) {
      const Cc = P(20 + gx * 20, 20 + gy * 20);
      const s = pos(A, B, Cc);
      const f = C.figure(s);
      if (!closePoint(f.M, centre, 1e-9) ||
          !closePoint(f.M, appletDraw(s).M, 1e-9) ||
          !closePoint(f.D, appletDraw(s).D, 1e-9)) {
        check(`grid C=(${Cc.x},${Cc.y}): M fixed and matches the applet`, false,
          JSON.stringify({ M: f.M, D: f.D, centre }));
      }
      if (!close(C.angleAtD(s), 90, 1e-7)) {
        check(`grid C=(${Cc.x},${Cc.y}): right angle at D`, false, `${C.angleAtD(s)}`);
      }
      tested++;
    }
  }
  check(`M stayed put and D followed the applet for ${tested} positions of C`, tested === 240);
  check("the closed form agrees with the applet's midpoint",
    closePoint(centre, appletDraw(pos(A, B, P(20, 20))).M, 1e-9));
}

/* ------------- 4. every claim on a grid of 3,375 triples of point positions */

{
  const xs = [40, 120, 200, 280, 360], ys = [40, 120, 200];
  let tested = 0, rejected = 0, degenerate = 0;
  for (const ax of xs) for (const ay of ys) for (const bx of xs) for (const by of ys) {
    if (ax === bx && ay === by) continue;
    for (const cx of xs) for (const cy of ys) {
      if ((cx === ax && cy === ay) || (cx === bx && cy === by)) continue;
      const s = pos(P(ax, ay), P(bx, by), P(cx, cy));
      const tol = 1e-8 * Math.max(1, dist(s.A, s.B));
      const mine = C.figure(s), theirs = appletDraw(s);
      for (const key of ["Ab", "Ac", "Bc", "Ba", "M", "D"]) {
        if (!closePoint(mine[key], theirs[key], tol)) {
          check(`grid A,B,C=(${ax},${ay}),(${bx},${by}),(${cx},${cy}): ${key}`, false);
        }
      }
      const cl = C.claims(s);
      const legA = dist(mine.D, mine.Ba), legB = dist(mine.D, mine.Ab);
      const live = legA > 1e-6 && legB > 1e-6;
      if (!live) degenerate++;
      for (const [key, value] of Object.entries(cl)) {
        const expected = key === "rightAtD" ? live : true;
        if (value !== expected) {
          check(`grid A,B,C=(${ax},${ay}),(${bx},${by}),(${cx},${cy}): ${key}`, false);
        }
      }
      if (live && !close(C.angleAtD(s), 90, 1e-7)) {
        check(`grid A,B,C=(${ax},${ay}),(${bx},${by}),(${cx},${cy}): angle`, false);
      }
      if (tested === 0) {
        check("the first grid triple has all claims", Object.values(cl).every(Boolean));
      }
      tested++;
    }
  }
  check(`all claims and all six computed points hold on ${tested} triples`,
    tested === 210 * 13); // 210 distinct A,B pairs times 13 other positions of C
  rejected = xs.length * ys.length * xs.length * ys.length * xs.length * ys.length - tested;
  check(`the grid skipped only the ${rejected} coincident-point triples`,
    rejected === 3375 - 2730);
  check(`${degenerate} triples collapse the triangle at D, where no angle is claimed`,
    degenerate > 0 && degenerate < tested);
}

/* -------------------------- 5. 600 random configurations, second transcript */

{
  const rand = rng(6282);
  let tested = 0;
  for (let trial = 0; trial < 600; trial++) {
    const s = pos(
      P(20 + rand() * 360, 20 + rand() * 210),
      P(20 + rand() * 360, 20 + rand() * 210),
      P(20 + rand() * 360, 20 + rand() * 210),
    );
    const tol = 1e-7 * Math.max(1, dist(s.A, s.B));
    const mine = C.figure(s), theirs = appletDraw(s);
    for (const key of ["Ab", "Ac", "Bc", "Ba", "M", "D"]) {
      if (!closePoint(mine[key], theirs[key], tol)) {
        check(`random ${trial}: ${key} matches Compute`, false,
          `core ${JSON.stringify(mine[key])}, applet ${JSON.stringify(theirs[key])}`);
      }
    }
    const cl = C.claims(s);
    for (const [key, value] of Object.entries(cl)) {
      if (!value) check(`random ${trial}: ${key}`, false, JSON.stringify(s));
    }
    if (!close(C.angleAtD(s), 90, 1e-6)) {
      check(`random ${trial}: angle at D`, false, `${C.angleAtD(s)}`);
    }
    tested++;
  }
  check(`all claims hold on ${tested} random configurations`, tested === 600);
}

/* ----------------------- 6. bytecode rotation and the McWorter2 distinction */

{
  const O = P(13, -7), Q = P(-41, 29);
  for (const s of [1, -1]) {
    for (const angle of [0, HALF_PI, Math.PI, 7 * HALF_PI / 3]) {
      equal(`Rotate matches the bytecode at ${angle.toFixed(3)}, ${s}`,
        C.rotate(O, Q, angle, s), appletRotate(O, Q, angle, s));
    }
  }
  check("a quarter turn twice is a half turn", closePoint(
    C.rotate(O, C.rotate(O, Q, HALF_PI, 1), HALF_PI, 1),
    C.rotate(O, Q, Math.PI, 1), 1e-9));
  check("opposite quarter turns cancel", closePoint(
    C.rotate(O, C.rotate(O, Q, HALF_PI, 1), HALF_PI, -1), Q, 1e-9));

  /* McWorter2: Angle starts at 90 degrees and K at 1; its midpoint is still
   * independent of C, for any slider values, but there is no D right angle. */
  const A = P(150, 208), B = P(250, 208);
  const square = applet2Figure(A, B, P(225, 123), HALF_PI, 1);
  check("at Angle=90 and K=1, sibling M is this applet's M",
    closePoint(square.M, C.squareCentre(pos(A, B, P(225, 123))), 1e-8));
  let fixedForSibling = true, fixedForSlanted = true;
  for (const Cc of [P(60, 60), P(190, 30), P(360, 230), P(100, 240)]) {
    const sq = applet2Figure(A, B, Cc, HALF_PI, 1);
    const sl = applet2Figure(A, B, Cc, Math.PI / 3, 1);
    if (!closePoint(sq.M, square.M, 1e-8)) fixedForSibling = false;
    if (!closePoint(sl.M, applet2Figure(A, B, P(60, 60), Math.PI / 3, 1).M, 1e-8)) fixedForSlanted = false;
  }
  check("McWorter2's M is independent of C for the square sliders", fixedForSibling);
  check("McWorter2's M is independent of C for slanted parallelograms too", fixedForSlanted);
  const slanted = applet2Figure(A, B, P(225, 123), Math.PI / 3, 1);
  const u = { x: slanted.Ba.x - slanted.D.x, y: slanted.Ba.y - slanted.D.y };
  const v = { x: slanted.Ab.x - slanted.D.x, y: slanted.Ab.y - slanted.D.y };
  check("the slanted sibling does not give a right angle at D",
    Math.abs(C.dot(u, v)) > 1e-3);
  check("this applet has no angle or ratio sliders",
    Object.keys(C.start()).sort().join(",") === "A,B,C,showHint,showLines,showNames");
}

/* ---------------------------------------- 7. degeneracies stay well behaved */

{
  const sameBase = pos(P(200, 150), P(200, 150), P(100, 60));
  const cl = C.claims(sameBase);
  check("with A=B the construction still gives a right angle at D", cl.rightAtD === true);
  check("with A=B the two legs have equal length", cl.isoscelesAtD === true);
  check("with A=B the angle readout is 90 degrees", close(C.angleAtD(sameBase), 90, 1e-7));
  /* If ABC is an isosceles right triangle at B, both far corners fall on D. */
  const collapsed = pos(P(200, 120), P(280, 40), P(280, 120));
  check("when the two far corners fall on D no angle is claimed",
    C.claims(collapsed).rightAtD === false && Number.isNaN(C.angleAtD(collapsed)));
  check("a degenerate figure still matches Compute",
    closePoint(C.figure(collapsed).D, appletDraw(collapsed).D, 1e-9));
  check("point arrays are never shared between positions", (() => {
    const s = pos(P(0, 0), P(10, 0), P(5, 5));
    const f = C.figure(s);
    return f.D !== s.D && f.A === s.A && C.withPoint(s, "A", P(1, 1)).B !== s.B;
  })());
}

done("mcworter");
