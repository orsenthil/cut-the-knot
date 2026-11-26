#!/usr/bin/env node
"use strict";

/*
 * Logic test for bottema/bottema-core.js.
 *
 *   node porting/check-bottema.mjs
 *
 * Checked: the starting position against BottemaCanvas.init for the applet's
 * preferred 400x250 canvas and for other canvas sizes; every claim made by
 * Bogomolny's article (M is independent of C, AMB and A_c M B_c are isosceles
 * right triangles, B_aU = AZ, A_bV = BZ, MW = AB/2) on fixed configurations and
 * on 600 random ones; the independence of C over a grid of 240 positions; and
 * a second, literal transcription of the applet's own GeoSDoub.Rotate,
 * BottemaCanvas.FormSquare and BottemaCanvas.Midpoint over all of them.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bottema/bottema-core.js", "BottemaCore");

const HALF_PI = Math.PI / 2;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const pos = (A, B, Cc, opts) => C.start({ points: { A, B, C: Cc }, ...(opts || {}) });
const P = (x, y) => ({ x, y });

/* -------------------------------- the applet's computation, transcribed again */

/* GeoSDoub.Rotate(DoubPoint P, DoubPoint Q, double angle, int orientation). */
function appletRotate(P0, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P0.x + cs * (Q.x - P0.x) - orientation * sn * (Q.y - P0.y),
    y: P0.y + orientation * sn * (Q.x - P0.x) + cs * (Q.y - P0.y),
  };
}

/* BottemaCanvas.FormSquare, with the four points written into in place. */
function appletFormSquare(p, q, corner1, corner2) {
  const r1 = appletRotate(p, q, HALF_PI, 1);
  corner1.x = r1.x; corner1.y = r1.y;
  const r2 = appletRotate(q, p, HALF_PI, -1);
  corner2.x = r2.x; corner2.y = r2.y;
}

/* BottemaCanvas.Draw: FormSquare(B,C,AB,AC), FormSquare(C,A,BC,BA), Midpoint. */
function appletDraw(s) {
  const B = { x: s.B.x, y: s.B.y }, Cc = { x: s.C.x, y: s.C.y }, A = { x: s.A.x, y: s.A.y };
  const Ab = { x: 0, y: 0 }, Ac = { x: 0, y: 0 };
  const Bc = { x: 0, y: 0 }, Ba = { x: 0, y: 0 };
  appletFormSquare(B, Cc, Ab, Ac);
  appletFormSquare(Cc, A, Bc, Ba);
  const M = { x: (Ba.x + Ab.x) / 2, y: (Ba.y + Ab.y) / 2 };
  return { A, B, C: Cc, Ab, Ac, Bc, Ba, M };
}

/* BottemaCanvas.init, for the two canvas sizes the applet suggests. */
function appletStart(width, height) {
  const x = width / 2, y = height / 2, dx = width / 8, dy = height / 3;
  return pos(
    P(x - dx, y + dy), P(x + dx, y + dy),
    P(x + dx * Math.cos(Math.PI / 3), y - dx * Math.sin(Math.PI / 3) + dy / 2),
  );
}

/* -------------------------------------- 1. the start and the applet's options */

{
  const s = C.start();
  equal("start is the applet's 400x250 diagram", s, appletStart(400, 250));
  equal("a custom canvas follows init's formulas", C.start({ width: 800, height: 500 }), appletStart(800, 500));
  check("names are hidden at the start", s.showNames === false);
  check("lines are hidden at the start", s.showLines === false);
  check("the hint is hidden at the start", s.showHint === false);
  check("an illustration has no result", C.result(s) === null);
  check("moving a point leaves the old position alone", (() => {
    const next = C.withPoint(s, "C", P(10, 20));
    return s.C.x !== 10 && next.C.x === 10 && next.A.x === s.A.x && next.B.x === s.B.x;
  })());
  check("an unknown handle name changes nothing", C.withPoint(s, "Z", P(1, 2)).B.y === s.B.y);
  check("the hint is switched off with the lines", (() => {
    const on = C.withOption(C.withOption(s, "showLines", true), "showHint", true);
    const off = C.withOption(on, "showLines", false);
    return on.showHint === true && off.showHint === false && off.showLines === false;
  })());
}

/* ------------------------------- 2. fixed configurations, including odd ones */

const fixed = [
  ["the applet's start", C.start()],
  ["C straight above AB", pos(P(100, 200), P(300, 200), P(200, 40))],
  ["C to the left", pos(P(180, 180), P(280, 180), P(40, 120))],
  ["C below AB", pos(P(120, 80), P(320, 80), P(200, 240))],
  ["a tall thin triangle", pos(P(190, 230), P(210, 230), P(200, 10))],
  ["C on the line AB", pos(P(100, 150), P(300, 150), P(180, 150))],
  ["A and B coincide", pos(P(200, 150), P(200, 150), P(100, 60))],
];

for (const [name, s] of fixed) {
  const tol = 1e-8 * Math.max(1, dist(s.A, s.B));
  const mine = C.figure(s);
  const theirs = appletDraw(s);
  for (const key of ["A", "B", "C", "Ab", "Ac", "Bc", "Ba", "M"]) {
    check(`${name}: ${key} matches the applet's Draw`, closePoint(mine[key], theirs[key], tol),
      `core ${JSON.stringify(mine[key])}, applet ${JSON.stringify(theirs[key])}`);
  }
  const cl = C.claims(s);
  check(`${name}: M is the square's centre`, cl.midpointIndependent);
  if (dist(s.A, s.B) > 1) check(`${name}: AMB is isosceles right`, cl.rightIsosceles);
  check(`${name}: A_c M B_c is isosceles right`, cl.otherRightIsosceles);
  check(`${name}: the two flanks are proper squares`, cl.squares);
  if (dist(s.A, s.B) > 1) {
    check(`${name}: the heights match the elementary proof`, cl.heightsMatch);
    check(`${name}: M is half a base above AB`, cl.halfway);
  }
}

/* ---------------- 3. M does not depend on C: a grid and a second closed form */

{
  const A = P(110, 190), B = P(310, 190);
  let tested = 0;
  const centre = C.squareCentre(pos(A, B, P(200, 50)));
  for (let gx = 0; gx < 20; gx++) {
    for (let gy = 0; gy < 12; gy++) {
      const Cc = P(20 + gx * 20, 20 + gy * 20);
      const s = pos(A, B, Cc);
      const f = C.figure(s);
      if (!closePoint(f.M, centre, 1e-9)) {
        check(`grid C=(${Cc.x},${Cc.y}): M is fixed`, false, JSON.stringify(f.M));
      }
      if (!closePoint(f.M, appletDraw(s).M, 1e-9)) {
        check(`grid C=(${Cc.x},${Cc.y}): M matches the applet`, false);
      }
      tested++;
    }
  }
  check(`M stayed put for ${tested} positions of C`, tested === 240);
  check("the closed form matches the applet on the grid", closePoint(centre, appletDraw(pos(A, B, P(20, 20))).M, 1e-9));
}

/* -------------------------- 4. every claim over many random configurations */

{
  const rand = rng(2742);
  let tested = 0;
  for (let trial = 0; trial < 600; trial++) {
    const s = pos(
      P(20 + rand() * 360, 20 + rand() * 210),
      P(20 + rand() * 360, 20 + rand() * 210),
      P(20 + rand() * 360, 20 + rand() * 210),
    );
    if (dist(s.A, s.B) < 1) continue;
    const tol = 1e-7 * dist(s.A, s.B);
    const mine = C.figure(s), theirs = appletDraw(s);
    if (!closePoint(mine.M, theirs.M, tol) ||
        !closePoint(mine.Ab, theirs.Ab, tol) || !closePoint(mine.Ba, theirs.Ba, tol) ||
        !closePoint(mine.Ac, theirs.Ac, tol) || !closePoint(mine.Bc, theirs.Bc, tol)) {
      check(`random ${trial}: figure matches the applet's Draw`, false,
        `core ${JSON.stringify(mine)}, applet ${JSON.stringify(theirs)}`);
    }
    const cl = C.claims(s);
    for (const [key, value] of Object.entries(cl)) {
      if (!value) check(`random ${trial}: ${key}`, false, JSON.stringify(s));
    }
    tested++;
  }
  check(`all claims hold on ${tested} random configurations`, tested > 580);
}

/* --------------------------------------- 5. the applet's own rotation details */

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
  check("illustrations stay unfinished", fixed.every(([, s]) => C.result(s) === null));
}

/* ----------------------------------------- 6. degenerate positions stay safe */

{
  const flat = pos(P(0, 0), P(0, 0), P(50, 50));
  check("no heights for a zero-length base", C.flankHeights(flat) === null);
  check("a zero-length base has no right triangle or heights",
    C.claims(flat).rightIsosceles === false && C.claims(flat).heightsMatch === false &&
    C.claims(flat).midpointIndependent === true);
  check("flank heights follow a tilted base", (() => {
    const f = C.flankHeights(pos(P(0, 0), P(3, 4), P(5, 1)));
    return f && close(f.base, 5, 1e-9) && close(f.MW, 2.5, 1e-9) &&
      close(f.BaU, f.AZ, 1e-9) && close(f.AbV, f.BZ, 1e-9);
  })());
}

done("bottema");
