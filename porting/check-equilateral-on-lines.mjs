#!/usr/bin/env node
"use strict";

/*
 * Logic test for equilateral-on-lines/equilateral-on-lines-core.js.
 *
 *   node porting/check-equilateral-on-lines.mjs
 *
 * Three parts:
 *  1. the controls, dragging, snapping and the demo's lack of a win/loss;
 *  2. the cut-the-knot page's claim, checked over hundreds of line and point
 *     configurations: rotating line 1 about C through 60 degrees and cutting
 *     line 2 gives B, rotating B back gives A, both A and B land on their
 *     lines, CA = CB = AB and the angle at C is 60 degrees; with C fixed there
 *     are exactly two differently oriented solutions;
 *  3. a second transcription of the applet's own Compute/ClipPoints bytecode
 *     (PointOnLine, Rotate, Intersect, NearestPoint, CreateMidPoint, Dist),
 *     compared with the core case by case over a grid and random positions,
 *     including the order-dependent 3px snap.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equilateral-on-lines/equilateral-on-lines-core.js", "EquilateralOnLinesCore");

const P = (x, y) => ({ x, y });
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const same = (a, b, tol = 1e-7) => !!a && !!b && Number.isFinite(a.x) &&
  Number.isFinite(b.x) && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const SIN60 = Math.sqrt(3) / 2;

/* ---------------------------------------------------------------------------
 * The applet's method, written a second time straight from javap:
 * GeoSDoub.Rotate / Intersect / NearestPoint / Dist, the canvas's
 * PointOnLine, DoubLine.CreateMidPoint, Compute() and ClipPoints().
 * ------------------------------------------------------------------------- */

function jpSqDist(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }
function jpDist(a, b) { return Math.sqrt(jpSqDist(a, b)); }

function jpRotate(c, q, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return P(c.x + co * (q.x - c.x) - dir * si * (q.y - c.y),
           c.y + dir * si * (q.x - c.x) + co * (q.y - c.y));
}

function jpPointOnLine(l, t) {
  return P(l.b.x * t + l.a.x * (1 - t), l.b.y * t + l.a.y * (1 - t));
}

function jpCreateMidPoint(l, t) {
  return P(l.a.x * t + l.b.x * (1 - t), l.a.y * t + l.b.y * (1 - t));
}

function jpIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

function jpNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (jpSqDist(a, b) < 0.1) return P(p.x, p.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}

function jpCompute(raw) {
  const line1 = { a: P(10, raw.lines[1]), b: P(390, raw.lines[1]) };
  const line2 = { a: P(10, raw.lines[2]), b: P(390, raw.lines[2]) };
  const p1 = jpPointOnLine(line1, 0);
  const p2 = jpPointOnLine(line1, 1);
  const theta = raw.angle * Math.PI / 180;
  const solutions = [];
  for (let i = 0; i < 2; i++) {
    const dir = i === 0 ? 1 : -1;
    const r1 = jpRotate(raw.points[0], p1, theta, dir);
    const r2 = jpRotate(raw.points[0], p2, theta, dir);
    const extra = { a: r1, b: r2 };
    const image = jpCreateMidPoint(extra, raw.coef[1]);
    const foot = jpNearestPoint(raw.points[0], r1, r2);
    const q1 = jpRotate(raw.points[0], p1, 1.0471975511965976, dir);
    const q2 = jpRotate(raw.points[0], p2, 1.0471975511965976, dir);
    const B = jpIntersect(q1, q2, line2.a, line2.b);
    const A = jpRotate(raw.points[0], B, 1.0471975511965976, i === 0 ? -1 : 1);
    solutions.push({ rotated: extra, image, foot, A, B });
  }
  return solutions;
}

/** Compute()'s ClipPoints() and Finished test, mutating a copy of the points. */
function jpRepaint(raw) {
  const solutions = jpCompute(raw);
  const pts = raw.points.map((p) => P(p.x, p.y));
  for (let i = 0; i < 2; i++) {
    if (jpDist(pts[1], solutions[i].A) < 3) pts[1] = P(solutions[i].A.x, solutions[i].A.y);
    if (jpDist(pts[2], solutions[i].B) < 3) pts[2] = P(solutions[i].B.x, solutions[i].B.y);
  }
  const ok0 = jpDist(pts[1], solutions[0].A) < 1 && jpDist(pts[2], solutions[0].B) < 1;
  const ok1 = jpDist(pts[1], solutions[1].A) < 1 && jpDist(pts[2], solutions[1].B) < 1;
  return { solutions, points: pts, finished: ok0 || ok1, index: ok0 ? 0 : (ok1 ? 1 : -1) };
}

/* ---------------------------------------------------------------------------
 * An independent closed form from the page's text: with C on line 0, A on
 * line 1 and B on line 2, B = rotate(A about C by sign*60 degrees) forces
 *   y2 - y0 = sign*sin60*(Ax-Cx) + cos60*(y1-y0)
 * which has exactly one solution in Ax for each sign because sin60 != 0.
 * ------------------------------------------------------------------------- */

function analytic(lines, Cc, sign) {
  const d1 = lines[1] - lines[0], d2 = lines[2] - lines[0];
  const dx = (d2 - 0.5 * d1) / (sign * SIN60);
  const A = P(Cc.x + dx, lines[1]);
  const B = P(Cc.x + 0.5 * dx - sign * SIN60 * d1,
              Cc.y + sign * SIN60 * dx + 0.5 * d1);
  return { A, B, coefficient: sign * SIN60 };
}

/* ------------------------------------------------------------- 1. controls */

{
  const s = C.start({});
  check("a new drawing has three lines and three points",
    s.lines.length === 3 && s.points.length === 3 && s.lines.every(Number.isFinite));
  check("every point starts on its own line",
    s.points.every((p, i) => p.y === s.lines[i] && p.x >= C.LEFT && p.x <= C.RIGHT));
  check("the slider starts at the applet's 0 degrees", s.angle === 0);
  check("names start on and the hint starts off", s.names === true && s.hint === false);
  check("a demo has no win, loss or end even when matched", C.result(s) === null);
  check("the starting points are not already a solution", !s.finished && s.solvedIndex === -1);

  const bad = C.movePoint(s, 4, P(10, 10));
  check("an unknown point is refused", bad === s);
  const moved = C.movePoint(s, 1, P(9999, 10));
  check("a dragged point stays on its line and inside the board",
    moved.points[1].y === s.lines[1] && moved.points[1].x === C.RIGHT);
  check("dragging leaves the other points and lines alone",
    same(moved.points[0], s.points[0]) && same(moved.points[2], s.points[2]) &&
    moved.lines.join() === s.lines.join());
  check("dragging a point updates its reversed coefficient",
    near(moved.coef[1], (C.RIGHT - moved.points[1].x) / (C.RIGHT - C.LEFT)));
  check("a drag marks the picture explored without changing the old state",
    moved.explored && !s.explored);

  const beforeCoef = s.coef[2];
  const lifted = C.moveLine(s, 2, 35);
  check("a dragged line moves its own point and keeps its coefficient",
    lifted.lines[2] === s.lines[2] + 35 && lifted.points[2].y === lifted.lines[2] &&
    near(lifted.coef[2], beforeCoef) &&
    same(lifted.points[0], s.points[0]) && same(lifted.points[1], s.points[1]));
  const limited = C.moveLine(s, 0, -10000);
  check("a line cannot be dragged past the top of the board",
    limited.lines[0] === C.Y_MIN && limited.points[0].y === C.Y_MIN);

  check("the rotation scrollbar clamps to 0..65 and is integral",
    C.setAngle(s, -12).angle === 0 && C.setAngle(s, 99).angle === 65 &&
    C.setAngle(s, 31.7).angle === 32);
  const hinted = C.setOption(C.setOption(s, "hint", true), "names", false);
  check("both checkboxes toggle and the old drawing is untouched",
    hinted.hint && !hinted.names && !s.hint && s.names);
  check("unknown options are ignored", C.setOption(s, "size", 4) === s);
  const reset = C.reset(hinted);
  check("reset restores the starting lines and keeps the options",
    reset.lines.join() === C.DEFAULT_Y.join() && reset.hint && !reset.names);

  let seed = 99;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const shuffled = C.shuffle(s, rand);
  check("shuffle keeps the applet's random offsets in range",
    shuffled.lines.every((y) => y >= C.VIEW.height / 2 - C.VIEW.height / 6 - 1e-9 &&
      y <= C.VIEW.height / 2 + 2 * C.VIEW.height / 6 + 1e-9) &&
    shuffled.coef.every((t) => t >= 0.3 && t <= 0.7));
  check("shuffle keeps all three points on their lines",
    shuffled.points.every((p, i) => near(p.y, shuffled.lines[i], 1e-9)));
}

/* ------------------------------------------- 2. the page's claim, in bulk */

const lineValues = [45, 80, 120, 160, 200, 240, 275];
const xValues = [45, 120, 200, 280, 355];
const angles = [0, 9, 30, 50, 65];
let cases = 0, equilateral = 0, onLines = 0, orientations = 0, distinct = 0;
let maxLengthError = 0, maxSideError = 0;

for (let a = 0; a < lineValues.length; a++) {
  for (let b = 0; b < lineValues.length; b++) {
    for (let d = 0; d < lineValues.length; d++) {
      if (a === b || b === d || a === d) continue; // three genuinely parallel, distinct lines
      for (const cx of xValues) {
        const lines = [lineValues[a], lineValues[b], lineValues[d]];
        const Cc = P(cx, lines[0]);
        const sols = [analytic(lines, Cc, 1), analytic(lines, Cc, -1)];
        const g = C.geometry(C.make({ lines, points: [Cc] }));
        for (let i = 0; i < 2; i++) {
          const got = g.solutions[i];
          const want = sols[i];
          if (!same(got.A, want.A) || !same(got.B, want.B)) continue;
          cases++;
          if (near(got.B.y, lines[2]) && near(got.A.y, lines[1])) onLines++;
          const ca = len(Cc, got.A), cb = len(Cc, got.B), ab = len(got.A, got.B);
          const sideError = Math.max(Math.abs(ca - cb), Math.abs(ca - ab));
          maxSideError = Math.max(maxSideError, sideError);
          if (sideError < 1e-7) equilateral++;
          const dot = (got.A.x - Cc.x) * (got.B.x - Cc.x) +
                      (got.A.y - Cc.y) * (got.B.y - Cc.y);
          const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ca * cb))));
          maxLengthError = Math.max(maxLengthError, Math.abs(ang - Math.PI / 3));
          if (Math.abs(ang - Math.PI / 3) < 1e-9) orientations++;
        }
        // The two solutions have opposite orientation and are different points.
        const z0 = cross(P(sols[0].A.x - Cc.x, sols[0].A.y - Cc.y),
                         P(sols[0].B.x - Cc.x, sols[0].B.y - Cc.y));
        const z1 = cross(P(sols[1].A.x - Cc.x, sols[1].A.y - Cc.y),
                         P(sols[1].B.x - Cc.x, sols[1].B.y - Cc.y));
        // When line 1 is midway between the others the two triangles share B
        // but have different A; when y2 is midway they share A but not B.
        const separation = Math.max(len(sols[0].A, sols[1].A),
                                    len(sols[0].B, sols[1].B));
        if (z0 > 0 && z1 < 0 && separation > 1e-6 &&
            Math.abs(sols[0].coefficient) > 0.8) distinct++;
      }
    }
  }
}

check("the construction matches the closed-form solution in every configuration",
  cases === 2 * 210 * xValues.length && cases > 2000, `${cases} matching solutions`);
check("A lands on line 1 and B on line 2 in every case", onLines === cases);
check("every constructed triangle has three equal sides", equilateral === cases,
  `worst side difference ${maxSideError.toExponential(2)}px`);
check("the angle at C is 60 degrees in every case", orientations === cases,
  `worst angle error ${maxLengthError.toExponential(2)} rad`);
check("each fixed C gives two differently oriented solutions",
  distinct === 210 * xValues.length && distinct > 1000,
  `${distinct}/${210 * xValues.length} line-and-point configurations`);
check("the linear equation for each orientation has one nonzero coefficient",
  Math.abs(SIN60) > 0.8 && Math.abs(-SIN60) > 0.8);

/* ---------------------------------- 3. the same answers as the applet code */

let compared = 0, repaints = 0, badSolutions = 0, badSnaps = 0, mismatches = 0;
function compare(raw) {
  const state = C.make(raw);
  const core = C.geometry(state);
  const applet = jpCompute(state);
  for (let i = 0; i < 2; i++) {
    const g = core.solutions[i], j = applet[i];
    if (!same(g.rotated.a, j.rotated.a) || !same(g.rotated.b, j.rotated.b) ||
        !same(g.image, j.image) || !same(g.foot, j.foot) ||
        !same(g.A, j.A) || !same(g.B, j.B)) badSolutions++;
  }
  const settled = C.settle(state);
  const repaint = jpRepaint(state);
  if (settled.finished !== repaint.finished || settled.solvedIndex !== repaint.index ||
      !settled.points.every((p, i) => same(p, repaint.points[i]))) badSnaps++;
  compared++;
}

for (const y0 of [30, 95, 150, 220]) {
  for (const y1 of [60, 130, 190, 265]) {
    for (const y2 of [40, 110, 175, 245]) {
      for (const x0 of [40, 150, 260, 360]) {
        for (const x1 of [30, 120, 210, 300]) {
          for (const x2 of [60, 170, 250, 380]) {
            const angle = angles[(x0 + x1 + x2) % angles.length];
            compare({ lines: [y0, y1, y2], angle,
              points: [P(x0, y0), P(x1, y1), P(x2, y2)] });
          }
        }
      }
    }
  }
}

const rr = rng(31415926);
for (let i = 0; i < 600; i++) {
  const lines = [0, 1, 2].map(() => 20 + rr() * 260);
  compare({
    lines: lines,
    angle: Math.floor(rr() * 66),
    coef: [rr(), rr(), rr()],
    points: lines.map((y) => P(15 + rr() * 370, y)),
  });
  repaints++;
}

check("the core's two rotations, images, feet and cuts match the bytecode",
  badSolutions === 0, `${badSolutions} disagreements in ${compared} configurations`);
check("the core's 3px snap and 1px success match the bytecode",
  badSnaps === 0, `${badSnaps} disagreements in ${compared} configurations`);
check("the bytecode comparison covers the whole slider range and many layouts",
  compared === 4 * 4 * 4 * 4 * 4 * 4 + 600 && repaints === 600 && compared > 4000);

/* The loop order in ClipPoints matters when both solutions are within 3px. */
const trickyLines = [120, 200, 162];
const trickyC = P(200, 120);
const trickyG = C.geometry(C.make({ lines: trickyLines, points: [trickyC] }));
const trickyA0 = trickyG.solutions[0].A, trickyA1 = trickyG.solutions[1].A;
const trickyB0 = trickyG.solutions[0].B;
const tricky = C.make({ lines: trickyLines,
  points: [trickyC, P(200, trickyLines[1]), P(trickyB0.x, trickyLines[2])] });
const jpTricky = jpRepaint(tricky);
check("the test really has two solutions within 3px of C1",
  len(trickyA0, trickyA1) > 3 && len(trickyA0, trickyA1) < 6 &&
  len(trickyA0, P(200, trickyLines[1])) < 3 &&
  len(trickyA1, P(200, trickyLines[1])) < 3);
check("a point near both solutions snaps to the first candidate and stays",
  same(C.settle(tricky).points[1], trickyA0) &&
  same(jpTricky.points[1], trickyA0) &&
  same(C.settle(tricky).points[2], trickyB0));
check("the first snap wins and is counted as a finished triangle",
  C.settle(tricky).finished && C.settle(tricky).solvedIndex === 0 &&
  jpTricky.finished && jpTricky.index === 0);

/* Snap to one complete solution: the two triangles are really achievable. */
const base = C.start({});
const g0 = C.geometry(base).solutions[0];
const nearSolution = C.make({ lines: base.lines,
  points: [base.points[0], P(g0.A.x + 1, base.lines[1]), P(g0.B.x - 1, base.lines[2])] });
const snapped = C.settle(nearSolution);
check("moving both points within 3px of a solution completes a triangle",
  snapped.finished && snapped.solvedIndex === 0 &&
  same(snapped.points[1], g0.A) && same(snapped.points[2], g0.B));
check("a finished triangle is still not a win or a loss",
  C.result(snapped) === null &&
  /equilateral/i.test(C.describe(snapped)));
const movedAway = C.movePoint(snapped, 1, P(g0.A.x + 40, base.lines[1]));
check("moving away from the solution makes the triangle unfinished",
  !movedAway.finished && movedAway.solvedIndex === -1);
const jpNear = jpRepaint(nearSolution);
check("the successful snap matches the applet exactly",
  jpNear.finished && jpNear.index === 0 &&
  jpNear.points.every((p, i) => same(p, snapped.points[i])));

/* Out-of-board solutions: the source clamps nothing, so the applet can draw
 * hints beyond its canvas; our viewBox is larger than the point clamp. */
const farLines = [270, 40, 30];
const farState = C.make({ lines: farLines, points: [P(380, farLines[0])] });
const farG = C.geometry(farState);
check("solutions stay finite for extreme line spacing",
  farG.solutions.every((s) => Number.isFinite(s.A.x) && Number.isFinite(s.B.y)));

console.log(`  ${cases} closed-form solutions, ${compared} bytecode comparisons; ` +
  `worst side error ${maxSideError.toExponential(2)}px, angle ${maxLengthError.toExponential(2)}rad`);
done("equilateral-on-lines");
