#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-pythagoras-3/hinged-pythagoras-3-core.js.
 *
 *   node porting/check-hinged-pythagoras-3.mjs
 *
 * Checks the applet's slider range and its Java-int layout; the page's claim
 * (Proof #2: two squares a² and b², with two triangles turned a quarter turn,
 * become a square of side c) for every one of the 201 whole-pixel hinge
 * positions and all 91 slider settings; and every drawn point against a
 * second, literal transcription of init(), Compute() and DrawRPyth() from the
 * applet's bytecode, over all 18,291 states and four other canvas sizes.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hinged-pythagoras-3/hinged-pythagoras-3-core.js", "HingedPythagoras3Core");
const P = C.pt;
const near = (p, q, tol = 1e-6) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const sides = (poly) => poly.map((p, i) => dist(p, poly[(i + 1) % poly.length]));
const area = (pts) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
};
const isRight = (t) => {
  const v = [sub(t[1], t[0]), sub(t[2], t[0]), sub(t[2], t[1])];
  return [dot(v[0], v[1]), dot(v[0], v[2]), dot(v[1], v[2])].some((d) => nearNum(d, 0, 1e-6));
};
const bOf = (a, side = 200) => side - a;

/* ------------------------------------------------- 1. start, ranges, layout */

{
  equal("a new illustration starts with the applet's hinge and angle", C.start(), { a: 46, angle: 0 });
  check("the scrollbar is declared 0..95 with a thumb of 5",
    C.LIMITS.declaredMin === 0 && C.LIMITS.declaredMax === 95 && C.LIMITS.visibleAmount === 5);
  check("Java clamps that scrollbar to 90 whole degrees", C.LIMITS.maxAngle === 90 &&
    C.setAngle(C.start(), 95).angle === 90 && C.setAngle(C.start(), 90).angle === 90 &&
    C.setAngle(C.start(), -9).angle === 0 && C.setAngle(C.start(), 41.6).angle === 42);
  const g = C.layout(C.start());
  check("the applet subtracts twice the 60-unit inset and centres the squares",
    g.side === 200 && g.dx === 60 && g.dy === 130 && g.shift === 256);
  check("M is one third along L0..L1, with integer truncation",
    near(g.M, P(106, 330)) && g.a === 46 && g.b === 154);
  check("init() and Compute() build this six-point staircase",
    near(g.L[0], P(60, 330)) && near(g.L[1], P(260, 330)) &&
    near(g.L[2], P(260, 284)) && near(g.L[3], P(214, 284)) &&
    near(g.L[4], P(214, 176)) && near(g.L[5], P(60, 176)));
  check("the right staircase is the left one moved by D = 2*width/5",
    g.R.every((p, i) => near(p, P(g.L[i].x + 256, g.L[i].y))));
  check("the mouse only takes M inside the bottom edge and its 20-unit band",
    C.dragHinge(C.start(), P(160, 330)).a === 100 &&
    C.dragHinge(C.start(), P(160, 349)).a === 100 &&
    C.dragHinge(C.start(), P(160, 350)).a === 100 &&
    C.dragHinge(C.start(), P(160, 351)) === null &&
    C.dragHinge(C.start(), P(59, 330)) === null &&
    C.dragHinge(C.start(), P(261, 330)) === null);
  check("the hinge drag is clamped to the corners of the edge",
    C.setHinge(C.start(), -10).a === 0 && C.setHinge(C.start(), 999).a === 200);
}

/* ------------------------------ 2. the dissection, for every hinge position */

{
  let badTriangle = 0, badArea = 0, badStair = 0, badQuadrant = 0;
  for (let a = 0; a <= 200; a++) {
    const s = { a, angle: 0 };
    const p = C.pieces(s);
    const id = C.identity(s);
    for (const t of p.leftTriangles) {
      const sl = sides(t).sort((x, y) => x - y);
      const expected = [a, bOf(a), Math.sqrt(a * a + bOf(a) * bOf(a))].sort((x, y) => x - y);
      if (!isRight(t) || sl.some((v, i) => !nearNum(v, expected[i], 1e-6)) ||
          !nearNum(area(t), (a * bOf(a)) / 2, 1e-6)) badTriangle++;
      // The right angle sits at one of the staircase's own corners.
      const corner = [0, 1, 2].some((i) => {
        const j = (i + 1) % 3, k = (i + 2) % 3;
        return (nearNum(t[i].y, t[j].y) && nearNum(t[i].x, t[k].x)) ||
          (nearNum(t[i].y, t[k].y) && nearNum(t[i].x, t[j].x));
      });
      if (!corner) badQuadrant++;
    }
    if (!nearNum(area(p.g.L), a * a + bOf(a) * bOf(a), 1e-6)) badStair++;
    if (!nearNum(area(p.g.L), id.side2 - id.triangles2, 1e-6)) badArea++;
  }
  check("both left triangles are right triangles with legs a and b at every hinge", badTriangle === 0,
    `${badTriangle} failures`);
  check("each left triangle has its right angle at a corner of the staircase", badQuadrant === 0);
  check("the staircase outline has area a² + b² for all 201 hinge positions", badStair === 0);
  check("a² + b² = (a+b)² - 2ab, Proof #4's calculation, at every hinge", badArea === 0);
}

/* -------------------------------------- 3. the rotated pieces and the claim */

{
  let badRigid = 0, badHyp = 0, badSquare = 0, badTiling = 0, badMeet = 0;
  for (let a = 0; a <= 200; a++) {
    const s = { a, angle: 0 };
    const base = C.pieces(s);
    const c = Math.sqrt(a * a + bOf(a) * bOf(a));
    for (let angle = 0; angle <= 90; angle++) {
      const p = C.pieces({ a, angle });
      p.rightTriangles.forEach((t, i) => {
        const now = sides(t).sort((x, y) => x - y);
        const was = sides(base.rightTriangles[i]).sort((x, y) => x - y);
        if (now.some((v, k) => !nearNum(v, was[k], 1e-6))) badRigid++;
        if (!nearNum(area(t), (a * bOf(a)) / 2, 1e-6)) badRigid++;
      });
      if (!nearNum(dist(p.hingeLow, p.MR), c, 1e-6) ||
          !nearNum(dist(p.MR, p.hingeHigh), c, 1e-6) ||
          !nearNum(dist(p.g.R[5], p.g.R[4]), bOf(a), 1e-6) ||
          !nearNum(dist(p.g.R[3], p.g.R[2]), a, 1e-6)) badHyp++;

      if (C.formed({ a, angle }) !== (angle === 90)) badMeet++;
      if (angle !== 90) continue;

      // At a quarter turn both free corners are the same apex, and the two
      // swung triangles exactly fill the top of the tilted square.
      if (!near(p.rightTriangles[0][2], p.apex, 1e-6) ||
          !near(p.rightTriangles[1][1], p.apex, 1e-6)) badMeet++;
      const sq = p.cSquare;
      const sqSides = sides(sq);
      if (sqSides.some((v) => !nearNum(v, c, 1e-6)) ||
          !nearNum(dot(sub(sq[1], sq[0]), sub(sq[2], sq[1])), 0, 1e-6) ||
          !nearNum(dot(sub(sq[2], sq[1]), sub(sq[3], sq[2])), 0, 1e-6) ||
          !nearNum(area(sq), c * c, 1e-5)) badSquare++;
      const pentagon = [p.hingeLow, p.MR, p.hingeHigh, p.g.R[3], p.g.R[4]];
      const filled = area(pentagon) + area(p.rightTriangles[0]) + area(p.rightTriangles[1]);
      if (!nearNum(filled, area(sq), 1e-5)) badTiling++;
    }
  }
  check("the two right triangles stay rigid at all 201 x 91 settings", badRigid === 0,
    `${badRigid} failures`);
  check("the fixed cut lines are the hypotenuse c, and the stair steps are b and a",
    badHyp === 0, `${badHyp} failures`);
  check("formed() is true only at 90°, where both free corners coincide", badMeet === 0,
    `${badMeet} failures`);
  check("the outline at 90° is a square of side c for every hinge position", badSquare === 0,
    `${badSquare} failures`);
  check("the pentagon plus the two turned triangles fill exactly that square", badTiling === 0,
    `${badTiling} failures`);
  check("the linked Proof #2 claim c² = a² + b² holds at every hinge",
    [0, 1, 17, 46, 79, 100, 154, 199, 200].every((a) =>
      nearNum(C.identity({ a, angle: 90 }).c2, a * a + bOf(a) ** 2, 1e-9)));
}

{
  let bad = 0, cases = 0;
  for (const [w, h] of [[500, 400], [800, 500], [1000, 600], [640, 460]]) {
    const side = C.initial(w, h).side;
    for (let a = 0; a <= side; a += Math.max(1, Math.floor(side / 20))) {
      for (const angle of [0, 30, 45, 89, 90]) {
        const s = { a, angle };
        const p = C.pieces(s, w, h);
        const id = C.identity(s, w, h);
        if (!nearNum(area(p.g.L), id.a2 + id.b2, 1e-6) || !id.holds ||
            !nearNum(area(p.cSquare), id.c2, 1e-5) ||
            !nearNum(dist(p.hingeLow, p.MR), id.c, 1e-6)) bad++;
        cases++;
      }
    }
  }
  check(`the same claim holds on ${cases} cases at four canvas sizes`, bad === 0, `${bad} failures`);
}

/* --------------- 4. a second, literal transcription of the applet's bytecode */

/** init(), Compute() and DrawRPyth() written straight from javap -c -p. */
function applet(width, height, mx, angleDeg) {
  const half = Math.trunc(width / 2);
  const side = Math.min(half, height) - 2 * 60;
  const dx = Math.trunc((half - side) / 2);
  const dy = Math.trunc((height - side) / 2);
  const D = Math.trunc((2 * width) / 5);
  const L = new Array(6);
  L[0] = P(dx, dy + side);
  L[1] = P(dx + side, dy + side);
  const M = P(mx, L[0].y);
  const A = M.x - L[0].x;
  const B = L[1].x - M.x;
  L[5] = P(L[0].x, L[0].y - B);
  L[4] = P(L[0].x + B, L[5].y);
  L[3] = P(L[4].x, L[4].y + B - A);
  L[2] = P(L[1].x, L[1].y - A);
  const R = L.map((p) => P(p.x + D, p.y));

  // DrawRPyth's P4, and its two hinges (the identical points R5 and R2).
  const P4 = P(M.x + R[0].x - L[0].x, R[0].y);
  const low = P(R[0].x, R[0].y - B);
  const high = P(R[2].x, R[2].y);
  const theta = (angleDeg * Math.PI) / 180;
  const rot = (p, a) => P(p.x * Math.cos(a) - p.y * Math.sin(a),
    p.x * Math.sin(a) + p.y * Math.cos(a));
  const triLow = [[0, 0], [0, B], [A, B]].map(([x, y]) => {
    const q = rot(P(x, y), -theta);
    return P(low.x + q.x, low.y + q.y);
  });
  const triHigh = [[0, 0], [-B, A], [0, A]].map(([x, y]) => {
    const q = rot(P(x, y), theta);
    return P(high.x + q.x, high.y + q.y);
  });
  return {
    side, dx, dy, D, A, B, L, R, M, P4, low, high, triLow, triHigh,
    apex: P(R[0].x + B, dy),
  };
}

{
  let bad = 0, compared = 0;
  for (let a = 0; a <= 200; a++) {
    for (let angle = 0; angle <= 90; angle++) {
      const s = { a, angle };
      const ours = C.pieces(s);
      const theirs = applet(640, 460, 60 + a, angle);
      ours.g.L.forEach((p, i) => { if (!near(p, theirs.L[i])) bad++; });
      ours.g.R.forEach((p, i) => { if (!near(p, theirs.R[i])) bad++; });
      if (!near(ours.M, theirs.M) || !near(ours.MR, theirs.P4) ||
          !near(ours.hingeLow, theirs.low) || !near(ours.hingeHigh, theirs.high) ||
          !near(ours.apex, theirs.apex)) bad++;
      ours.rightTriangles[0].forEach((p, i) => { if (!near(p, theirs.triLow[i])) bad++; });
      ours.rightTriangles[1].forEach((p, i) => { if (!near(p, theirs.triHigh[i])) bad++; });
      if (ours.g.a !== theirs.A || ours.g.b !== theirs.B) bad++;
      compared++;
    }
  }
  check(`init(), Compute() and DrawRPyth() match the bytecode at all ${compared} states`,
    bad === 0, `${bad} differing points`);
}

{
  let bad = 0, compared = 0;
  for (const [w, h] of [[500, 400], [800, 500], [1000, 600]]) {
    const side = C.initial(w, h).side;
    for (let a = 0; a <= side; a += 7) {
      for (const angle of [0, 17, 45, 89, 90]) {
        const ours = C.pieces({ a, angle }, w, h);
        const theirs = applet(w, h, C.layout({ a, angle }, w, h).L[0].x + a, angle);
        ours.g.L.forEach((p, i) => { if (!near(p, theirs.L[i])) bad++; });
        ours.rightTriangles[0].forEach((p, i) => { if (!near(p, theirs.triLow[i])) bad++; });
        ours.rightTriangles[1].forEach((p, i) => { if (!near(p, theirs.triHigh[i])) bad++; });
        if (!near(ours.MR, theirs.P4) || !near(ours.apex, theirs.apex)) bad++;
        compared++;
      }
    }
  }
  check(`the same transcription matches on ${compared} other canvas sizes`, bad === 0,
    `${bad} differing points`);
}

/* --------------------------------------------------- 5. the saved position */

{
  const s = { a: 46, angle: 90 };
  equal("the player's position survives JSON unchanged", JSON.parse(JSON.stringify(s)), s);
  const start = C.start();
  C.setHinge(start, 190);
  C.setAngle(start, 90);
  equal("core calls never mutate the position they are given", start, { a: 46, angle: 0 });
}

done("hinged-pythagoras-3");
