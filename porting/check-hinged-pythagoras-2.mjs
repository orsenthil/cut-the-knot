#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-pythagoras-2/hinged-pythagoras-2-core.js.
 *
 *   node porting/check-hinged-pythagoras-2.mjs
 *
 * Checks the applet's two scrollbar ranges and start values, its layout(),
 * Compute() geometry and DrawRPyth() hinged triangles. The page's claim
 * (Proof #10: the four Proof #3 triangles can be rearranged to show
 * c² = a² + b²) is checked with the areas of the actual cut pieces for every
 * whole-degree shape angle 30..90 and 600 fractional angles. Every point of
 * the dissection is also compared with a second, independent transcription of
 * the applet's bytecode over all 66 x 276 slider settings (18,216 states) and
 * on four canvas sizes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hinged-pythagoras-2/hinged-pythagoras-2-core.js", "HingedPythagoras2Core");
const P = C.pt;
const near = (p, q, tol = 1e-6) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const rad = (d) => (d * Math.PI) / 180;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
};
const sides = (poly) => poly.map((p, i) => dist(p, poly[(i + 1) % poly.length]));

/* -------------------------------------------------------- 1. start / ranges */

{
  const s = C.start();
  equal("a new illustration starts with the applet's slider values", s, { angle: 0, beta: 30 });
  check("Rotation scrollbar is 0..275", C.LIMITS.angleMin === 0 && C.LIMITS.angleMax === 275);
  check("ForSine scrollbar is 30..95", C.LIMITS.betaMin === 30 && C.LIMITS.betaMax === 95);
  check("the canvas subtracts twice the 80-unit inset", C.DEFAULT_LAYOUT.side === 160);
  check("the left square sits at x=80, the right one at x=320",
    C.DEFAULT_LAYOUT.leftX === 80 && C.DEFAULT_LAYOUT.rightX === 320 && C.DEFAULT_LAYOUT.y === 134);
  check("a drop below a slider's minimum is clamped",
    C.withAngle(s, -9).angle === 0 && C.withBeta(s, 3).beta === 30);
  check("a drop above a slider's maximum is clamped",
    C.withAngle(s, 999).angle === 275 && C.withBeta(s, 999).beta === 95);
  check("slider values are whole degrees and do not change the other slider",
    C.withBeta(C.withAngle(s, 41.6), 68.2).angle === 42 &&
    C.withBeta(C.withAngle(s, 41.6), 68.2).beta === 68);
}

/* ------------------------------------------- 2. the geometry helpers themselves */

{
  const origin = P(0, 0), east = P(10, 0), north = P(0, -10);
  check("Rotate by 90° sends east to north in canvas coordinates",
    near(C.rotate(origin, east, Math.PI / 2, -1), north));
  check("Rotate keeps the distance from the hinge",
    nearNum(dist(origin, C.rotate(origin, east, 1.234, 1)), 10));
  check("Rotate with sign +1 is the Graphics2D turn of the right square",
    near(C.rotate(origin, east, Math.PI / 2, 1), P(0, 10)));
  const nanPoint = C.intersect(origin, P(1, 0), P(0, 1), P(1, 1));
  check("Intersect returns NaN for parallel lines, as GeoSDoub.Intersect does",
    Number.isNaN(nanPoint.x) && Number.isNaN(nanPoint.y));
  check("Intersect solves crosswise lines",
    near(C.intersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), P(5, 5)));
  check("NearestPoint projects onto the line",
    near(C.nearestPoint(P(7, 7), P(0, 0), P(10, 0)), P(7, 0)));
  check("InsideTest is the applet's obtuse-angle test",
    C.insideTest(P(0, 0), P(-1, 0), P(1, 0)) && !C.insideTest(P(2, 0), P(-1, 0), P(1, 0)));
  check("DrawLine keeps the inner part of a turned side",
    near(C.visibleCut(P(0, 0), P(5, 0), P(10, 0))[0], P(5, 0)));
}

/* -------------------------- 3. the page's claim, over all shape angles */

{
  const betaList = [];
  for (let b = 30; b <= 90; b++) betaList.push(b);
  const rand = rng(271828);
  for (let i = 0; i < 600; i++) betaList.push(30 + rand() * 60);
  let badSum = 0, badIdentity = 0, badClaim = 0;
  for (const beta of betaList) {
    const id = C.identity(beta);
    if (!nearNum(id.filled, id.c2, 1e-6)) badSum++;
    if (!id.holds) badIdentity++;
    if (!nearNum(id.algebraicError, 0, 1e-6)) badClaim++;
  }
  check(`the four cut pieces exactly fill c² for ${betaList.length} shape angles`,
    badSum === 0, `${badSum} failures`);
  check("a² + b² = c² for every shape angle in the applet's range",
    badIdentity === 0, `${badIdentity} failures`);
  check("c² = (a-b)² + 2ab, the linked Proof #3 calculation, for 30°..90°",
    badClaim === 0, `${badClaim} failures`);
}

{
  let badSquare = 0, badTriangle = 0, badSides = 0, badCuts = 0;
  for (let b = 30; b <= 89; b++) {
    const g = C.leftDissection(b);
    const holeSides = sides(g.inner);
    const a = g.corners[0], c = g.corners[2];
    const diagonal = dist(g.inner[0], g.inner[2]);
    if (holeSides.some((s) => !nearNum(s, holeSides[0], 1e-6)) ||
        !nearNum(diagonal, holeSides[0] * Math.SQRT2, 1e-6)) badSquare++;
    const refSides = sides(g.triangles[0]).sort((x, y) => x - y);
    for (const t of g.triangles.slice(1)) {
      const s = sides(t).sort((x, y) => x - y);
      if (s.some((v, i) => !nearNum(v, refSides[i], 1e-6))) badTriangle++;
    }
    if (!nearNum(holeSides[0], C.identity(b).hole, 1e-6)) badSides++;
    for (const [p, q] of g.cuts) {
      const inBox = (v) => v.x >= Math.min(a.x, c.x) - 1e-6 && v.x <= Math.max(a.x, c.x) + 1e-6 &&
        v.y >= Math.min(a.y, c.y) - 1e-6 && v.y <= Math.max(a.y, c.y) + 1e-6;
      if (!inBox(p) || !inBox(q)) badCuts++;
    }
  }
  check("the cut-out middle is always a square", badSquare === 0, `${badSquare} failures`);
  check("the four hinged triangles are congruent", badTriangle === 0, `${badTriangle} failures`);
  check("its side is |a-b|, as Proof #3 says", badSides === 0, `${badSides} failures`);
  check("the drawn cuts stay inside the left square", badCuts === 0, `${badCuts} failures`);
}

/* ------------------------------ 4. the right square and its hinge details */

{
  let badRigid = 0;
  for (let b = 30; b <= 95; b++) {
    const base = C.rightDissection({ angle: 0, beta: b });
    for (let angle = 0; angle <= 275; angle += 5) {
      const g = C.rightDissection({ angle, beta: b });
      g.triangles.forEach((t, i) => {
        const s0 = sides(base.triangles[i]).sort((x, y) => x - y);
        const s1 = sides(t).sort((x, y) => x - y);
        if (s1.some((v, k) => !nearNum(v, s0[k], 1e-6))) badRigid++;
      });
    }
  }
  check("all four right-hand pieces are rigid at every slider setting", badRigid === 0,
    `${badRigid} failures`);

  let badCongruent = 0, badFill = 0, compared = 0;
  for (let b = 30; b <= 90; b++) {
    const source = sides(C.leftDissection(b).triangles[0]).sort((x, y) => x - y);
    for (let a = 0; a <= 275; a += 5) {
      const g = C.rightDissection({ angle: a, beta: b });
      g.triangles.forEach((t) => {
        const s = sides(t).sort((x, y) => x - y);
        if (s.some((v, i) => !nearNum(v, source[i], 1e-6))) badCongruent++;
      });
      const filled = area(g.inner) + g.triangles.reduce((sum, t) => sum + area(t), 0);
      if (!nearNum(filled, C.identity(b).c2, 1e-5)) badFill++;
      compared++;
    }
  }
  check(`the right-hand triangles are the same four pieces as the left (${compared} states)`,
    badCongruent === 0, `${badCongruent} failures`);
  check("their area plus the middle square still fills c² at every turn", badFill === 0,
    `${badFill} failures`);

  check("the inset square is drawn only past 269.4° with P and R apart",
    !C.rightDissection({ angle: 269, beta: 30 }).showInset &&
    C.rightDissection({ angle: 270, beta: 30 }).showInset &&
    C.rightDissection({ angle: 275, beta: 30 }).showInset);
  check("at 90° the four triangles have shrunk to nothing and the middle is the whole square",
    nearNum(C.identity(90).tri, 0) && nearNum(C.identity(90).hole, 160));

  const g = C.rightDissection({ angle: 275, beta: 30 });
  const T = g.points.T, S = g.points.S, R = g.points.R, Q = g.points.Q;
  const B = C.shift(C.corners().L[1], g.dx, 0);
  check("the dashed line starts on the parallel through B, as Compute() says",
    nearNum((T.x - B.x) * (R.y - Q.y) - (T.y - B.y) * (R.x - Q.x), 0, 1e-4));
  check("the dashed line ends at the nearer of S and R",
    near(g.dashed[1], dist(T, S) < dist(T, R) ? S : R));
  check("the two orange hinges stay at the left corners of the right square",
    near(g.hinges[0], P(320, 294)) && near(g.hinges[1], P(480, 134)));
}

/* ---------------------------- 5. the applet's 90°..95° quirk is preserved */

{
  let bad = 0;
  for (let b = 91; b <= 95; b++) {
    const id = C.identity(b);
    if (id.tilingError < 1 || id.algebraicError > 1e-6) bad++;
  }
  check("ForSine above 90° still moves the pieces but no longer tiles the square",
    bad === 0, `${bad} failures`);
  const s = C.withBeta(C.start(), 95);
  check("the slider really offers that broken range", s.beta === 95);
}

/* --------- 6. a second transcription of the applet's own bytecode methods */

/* Cross-product line intersection, a different route from the core's Cramer form. */
function intersect2(a, b, c, d) {
  const ux = b.x - a.x, uy = b.y - a.y;
  const vx = d.x - c.x, vy = d.y - c.y;
  const den = ux * vy - uy * vx;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / den;
  return P(a.x + ux * t, a.y + uy * t);
}

/* Complex multiplication by (cos, sign*sin), as GeoSDoub.Rotate computes. */
function rotate2(center, point, theta, sign) {
  const u = Math.cos(theta), v = sign * Math.sin(theta);
  const dx = point.x - center.x, dy = point.y - center.y;
  return P(center.x + u * dx - v * dy, center.y + v * dx + u * dy);
}

function nearest2(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

/* Literal init(), Compute() and DrawRPyth() locals, written independently. */
function applet(width, height, angleDeg, betaDeg) {
  const inset = 80;
  const side = Math.min(Math.floor(width / 2), height) - 2 * inset;
  const lx = Math.floor((Math.floor(width / 2) - side) / 2);
  const ry = Math.floor((height - side) / 2);
  const rx = Math.floor(width / 2);
  const L = [P(lx, ry + side), P(lx + side, ry + side),
    P(lx + side, ry), P(lx, ry)];
  const R = [P(rx, ry + side), P(rx + side, ry + side),
    P(rx + side, ry), P(rx, ry)];
  const beta = (betaDeg * Math.PI) / 180;
  const angle = (angleDeg * Math.PI) / 180;
  const dx = R[0].x - L[0].x;
  const turned = [0, 1, 2, 3].map((i) => rotate2(L[i], L[(i + 1) % 4], beta, -1));
  const Ppt = intersect2(L[0], turned[0], L[1], turned[1]);
  const Qpt = intersect2(L[1], turned[1], L[2], turned[2]);
  const Rpt = intersect2(L[2], turned[2], L[3], turned[3]);
  const Spt = intersect2(L[3], turned[3], L[0], turned[0]);
  // GetParallelTo(L1, R, Q), then NearestPoint(S, line, L1).
  const L5 = P(L[1].x + 100 * (Rpt.x - Qpt.x), L[1].y + 100 * (Rpt.y - Qpt.y));
  const Tpt = nearest2(Spt, L5, L[1]);

  const across = (p) => P(p.x + dx, p.y);
  const Pp = across(Ppt), Qp = across(Qpt), Rp = across(Rpt), Sp = across(Spt);
  const swung = (hinge, relative, a) => relative.map((v) => {
    const r = rotate2(P(0, 0), v, a, 1);
    return P(hinge.x + r.x, hinge.y + r.y);
  });
  const top = swung(R[2], [P(0, 0), P(R[3].x - R[2].x, R[3].y - R[2].y),
    P(Rp.x - R[2].x, Rp.y - R[2].y)], angle);
  const bottom = swung(R[0], [P(0, 0), P(R[3].x - R[0].x, R[3].y - R[0].y),
    P(Sp.x - R[0].x, Sp.y - R[0].y)], -angle);
  return {
    L, R, side, dx,
    points: { P: Ppt, Q: Qpt, R: Rpt, S: Spt, T: Tpt },
    inner: [Pp, Qp, Rp, Sp],
    triangles: [[R[0], R[1], Pp], [R[1], R[2], Qp], top, bottom],
    inset: angle > 4.70238898038469 && dist(Pp, Rp) > 0.5,
  };
}

{
  let badPoints = 0, badTriangles = 0, badFlags = 0, compared = 0;
  for (let b = 30; b <= 95; b++) {
    for (let a = 0; a <= 275; a++) {
      const state = { angle: a, beta: b };
      const ours = C.geometry(state);
      const theirs = applet(640, 428, a, b);
      for (const name of ["P", "Q", "R", "S"]) {
        if (!near(ours.left.points[name], theirs.points[name])) badPoints++;
      }
      // At 45° the middle square has shrunk to a point, so R and Q coincide
      // and the auxiliary parallel line is undefined in both transcriptions.
      if (dist(theirs.points.R, theirs.points.Q) > 1e-6 &&
          !near(ours.right.points.T, P(theirs.points.T.x + theirs.dx,
            theirs.points.T.y))) badPoints++;
      ours.right.triangles.forEach((t, i) => {
        t.forEach((p, k) => { if (!near(p, theirs.triangles[i][k])) badTriangles++; });
      });
      if (ours.right.showInset !== theirs.inset) badFlags++;
      compared++;
    }
  }
  check(`Compute matches the bytecode at all ${compared} slider settings`, badPoints === 0,
    `${badPoints} differing points`);
  check("DrawRPyth's four triangles match at every slider setting", badTriangles === 0,
    `${badTriangles} differing vertices`);
  check("the inset-square condition matches at every slider setting", badFlags === 0,
    `${badFlags} differing flags`);
}

{
  let bad = 0, layouts = 0;
  for (const [w, h] of [[500, 400], [800, 500], [1000, 600], [640, 428]]) {
    for (const b of [30, 37, 45, 60, 75, 89, 90, 95]) {
      for (const a of [0, 45, 90, 180, 269, 270, 275]) {
        const lay = C.layout(w, h);
        const ours = C.geometry({ angle: a, beta: b }, lay);
        const theirs = applet(w, h, a, b);
        for (const name of ["P", "Q", "R", "S"]) {
          if (!near(ours.left.points[name], theirs.points[name])) bad++;
        }
        if (dist(theirs.points.R, theirs.points.Q) > 1e-6 &&
            !near(ours.right.points.T, P(theirs.points.T.x + theirs.dx,
              theirs.points.T.y))) bad++;
        ours.right.triangles.forEach((t, i) => t.forEach((p, k) => {
          if (!near(p, theirs.triangles[i][k])) bad++;
        }));
        layouts++;
      }
    }
  }
  check(`the same construction matches on ${layouts} other canvas sizes`, bad === 0,
    `${bad} differing points`);
}

/* -------------------------------------------- 7. the saved position is data */

{
  const s = C.withBeta(C.withAngle(C.start(), 270), 60);
  equal("the player's position survives JSON unchanged", JSON.parse(JSON.stringify(s)), s);
  const a = C.start();
  C.withAngle(a, 275);
  C.withBeta(a, 95);
  equal("core calls never mutate the position they are given", a, { angle: 0, beta: 30 });
}

done("hinged-pythagoras-2");
