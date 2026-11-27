#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-np-circles/four-np-circles-core.js.
 *
 *   node porting/check-four-np-circles.mjs
 *
 * Checked: the applet's Reset points (including its y-offset quirk), the
 * Index table, the cycle of canvas clicks and all six checkboxes; then a
 * second, literal transcription of the applet's own methods (GeoSDoub.Intersect,
 * FindAltitude, FindCircumcenter, FourNPCirclesCanvas.FindNinepointscenter,
 * DrawNCircle and ShowPedal) compared with the core on all 12,650 quadruples
 * of a 5×5 grid plus 800 random quadrilaterals. The page's claim — the four
 * nine-point circles and the four pedal circles are concurrent for an
 * arbitrary quadrilateral — is checked exhaustively on the grid and on
 * random/concyclic samples; for a cyclic quadrilateral the pedal circles
 * collapse to Simson lines, so those lines are checked too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-np-circles/four-np-circles-core.js", "FourNpCirclesCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sameNum = (a, b, tol) =>
  (Number.isNaN(a) && Number.isNaN(b)) ||
  (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const samePt = (p, q, tol) => Boolean(p && q) && sameNum(p.x, q.x, tol) && sameNum(p.y, q.y, tol);
const isCircle = (c) => Boolean(c) && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r);

/* --------- a second transcription, straight from the applet's bytecode ---- */

/* GeoSDoub.Intersect: a1=P1.y−P2.y, b1=P2.x−P1.x, c1=P1.x*P2.y−P1.y*P2.x. */
function javaIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y;
  const b1 = P2.x - P1.x;
  const c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y;
  const b2 = P4.x - P3.x;
  const c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAltitude(P,A,B) */
function javaAltitude(P, A, B) {
  const direction = { x: P.x + B.y - A.y, y: P.y - B.x + A.x };
  return javaIntersect(P, direction, A, B);
}

/* FourNPCirclesCanvas.FindOrthocenter(A,B,C): two altitudes, then Intersect. */
function javaOrthocenter(A, B, C) {
  const hA = javaAltitude(A, B, C);
  const hB = javaAltitude(B, A, C);
  return javaIntersect(A, hA, B, hB);
}

/* GeoSDoub.FindCircumcenter(A,B,C): perpendicular bisectors of AB and BC. */
function javaCircumcenter(A, B, C) {
  const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const midBC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
  const perpAB = { x: midAB.x + B.y - A.y, y: midAB.y - B.x + A.x };
  const perpBC = { x: midBC.x + C.y - B.y, y: midBC.y - C.x + B.x };
  return javaIntersect(midAB, perpAB, midBC, perpBC);
}

const javaMid2 = (P, Q) => ({ x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 });
const javaMid3 = (P, Q, R) => ({ x: (P.x + Q.x + R.x) / 3, y: (P.y + Q.y + R.y) / 3 });

/* FindNinepointscenter = MidPoint(FindOrthocenter, FindCircumcenter). */
function javaNineCenter(A, B, C) {
  return javaMid2(javaOrthocenter(A, B, C), javaCircumcenter(A, B, C));
}

/* DrawNCircle: centre N, radius = mean distance to the three side midpoints. */
function javaNineCircle(A, B, C) {
  const N = javaNineCenter(A, B, C);
  const m1 = javaMid2(B, C), m2 = javaMid2(C, A), m3 = javaMid2(A, B);
  const r = (dist(N, m1) + dist(N, m2) + dist(N, m3)) / 3;
  return { x: N.x, y: N.y, r };
}

/* ShowPedal(g,L2,L3,L4,L5) + DrawCircle: feet on L3L4, L4L2, L2L3. */
function javaPedalCircle(L2, L3, L4, L5) {
  const f1 = javaAltitude(L5, L3, L4);
  const f2 = javaAltitude(L5, L4, L2);
  const f3 = javaAltitude(L5, L2, L3);
  const O = javaCircumcenter(f1, f2, f3);
  const r = (dist(O, f1) + dist(O, f2) + dist(O, f3)) / 3;
  return { x: O.x, y: O.y, r, feet: [f1, f2, f3] };
}

/* FourNPCirclesCanvas.Reset: angles, radius and the third vertex's +10 quirk. */
function javaReset(width, height) {
  const angles = [
    0.5235987755982988, 2.6179938779914944,
    3.765191430678208, 5.235987755982989,
  ];
  const r = Math.floor(Math.min(width, height) / 3);
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  return angles.map((a, i) => ({
    x: cx + r * Math.cos(a),
    y: i === 2 ? cy + (cy + 10) * Math.sin(a) : cy + r * Math.sin(a),
  }));
}

/* The applet's ShowPedals and DrawNinepoints, in their own array order. */
function javaCompute(s) {
  const P = [s.A, s.B, s.C, s.D];
  const javaIndex = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
  const nine = javaIndex.map((ix) => javaNineCircle(P[ix[0]], P[ix[1]], P[ix[2]]));
  const pedal = javaIndex.map((ix, i) =>
    javaPedalCircle(P[ix[0]], P[ix[1]], P[ix[2]], P[i]));
  const mids = [
    javaMid2(s.A, s.B), javaMid2(s.B, s.C), javaMid2(s.C, s.D),
    javaMid2(s.D, s.A), javaMid2(s.A, s.C), javaMid2(s.B, s.D),
  ];
  return { nine, pedal, mids };
}

function compareWithApplet(label, s) {
  const core = C.compute(s);
  const app = javaCompute(s);
  const radii = app.nine.map((c) => Math.abs(c.r)).filter(Number.isFinite);
  const scale = Math.max(1, ...radii);
  const tol = 1e-7 * scale;
  const diffs = [];
  for (let i = 0; i < 4; i++) {
    if (!samePt(core.nine[i], app.nine[i], tol) || !sameNum(core.nine[i].r, app.nine[i].r, tol)) {
      diffs.push(`nine${i}`);
    }
    if (!samePt(core.pedal[i], app.pedal[i], tol) || !sameNum(core.pedal[i].r, app.pedal[i].r, tol)) {
      diffs.push(`pedal${i}`);
    }
    for (let j = 0; j < 3; j++) {
      if (!samePt(core.pedal[i].feet[j], app.pedal[i].feet[j], tol)) diffs.push(`foot${i}.${j}`);
    }
  }
  for (let i = 0; i < 6; i++) {
    if (!samePt(core.mids[i], app.mids[i], tol)) diffs.push(`mid${i}`);
  }
  check(`${label}: every circle and point matches the applet (${diffs.length ? diffs.join(", ") : "all"})`,
    diffs.length === 0);
  return core;
}

/* Distance from P to the infinite line through U and V. */
function lineDistance(P, U, V) {
  const dx = V.x - U.x, dy = V.y - U.y;
  const len = Math.hypot(dx, dy);
  if (!len) return Infinity;
  return Math.abs((P.x - U.x) * dy - (P.y - U.y) * dx) / len;
}

const stateOf = (pts) => ({
  ...C.start(), A: pts[0], B: pts[1], C: pts[2], D: pts[3],
});

/* ------------------------------------------------------ 1. applet controls */

{
  const s = C.start();
  const expected = javaReset(C.VIEW.width, C.VIEW.height);
  check("Reset places A,B,C,D at the applet's four angles",
    ["A", "B", "C", "D"].every((name, i) => samePt(s[name], expected[i], 1e-12)));
  check("Reset's third vertex keeps the +10 y quirk",
    Math.abs(s.C.y - (150 + 160 * Math.sin(C.ANGLES[2]))) < 1e-12 && Math.abs(s.C.y - (150 + 100 * Math.sin(C.ANGLES[2]))) > 1);
  check("all six checkboxes start unticked, as in the applet",
    C.OPTIONS.every((name) => s[name] === false));
  check("the applet's Index table leaves out the right vertex",
    JSON.stringify(C.INDEX) === JSON.stringify([[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]]));
  let cycle = s;
  const seen = [];
  for (let i = 0; i < 6; i++) { cycle = C.cycleHighlight(cycle); seen.push(cycle.which); }
  check("a click cycles WhichClicked as -1,0,1,2,3,none,0",
    JSON.stringify(seen) === JSON.stringify([0, 1, 2, 3, 4, 0]));
  check("a checkbox change is stored and cannot invent a flag",
    C.withOption(C.withOption(s, "showPedalCircles", true), "nope", true).showPedalCircles === true &&
    C.withOption(s, "nope", true).nope === undefined);
  const moved = C.withPoint(s, "B", { x: -20, y: 999 });
  check("a dragged point follows the pointer and stays on the canvas",
    moved.B.x === 0 && moved.B.y === C.VIEW.height && samePt(s.B, expected[1], 1e-12));
  check("an illustration has no win and no loss", C.result(s) === null && C.result(moved) === null);
}

/* ----------------------------------------- 2. all 5×5 grid quadruples ----- */

const grid = [];
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) grid.push({ x: 40 + 80 * i, y: 25 + 65 * j });
}

{
  let mismatches = 0;
  let worst = 0;
  let generic = 0;
  let claimFails = 0;
  let worstResidual = 0;
  let nineFormulaFails = 0;
  for (let a = 0; a < grid.length; a++) {
    for (let b = a + 1; b < grid.length; b++) {
      for (let c = b + 1; c < grid.length; c++) {
        for (let d = c + 1; d < grid.length; d++) {
          const pts = [grid[a], grid[b], grid[c], grid[d]];
          const s = stateOf(pts);
          const core = C.compute(s);
          const app = javaCompute(s);
          const radii = app.nine.map((x) => Math.abs(x.r)).filter(Number.isFinite);
          const scale = Math.max(1, ...radii);
          const tol = 1e-7 * scale;
          for (let i = 0; i < 4; i++) {
            if (!samePt(core.nine[i], app.nine[i], tol) || !sameNum(core.nine[i].r, app.nine[i].r, tol) ||
                !samePt(core.pedal[i], app.pedal[i], tol) || !sameNum(core.pedal[i].r, app.pedal[i].r, tol)) {
              mismatches++;
            }
            for (let j = 0; j < 3; j++) {
              if (!samePt(core.pedal[i].feet[j], app.pedal[i].feet[j], tol)) mismatches++;
            }
            // The nine-point circle really is (O+H)/2 with radius R/2.
            const t = core.triangles[i];
            const O = C.circumcenter(t[0], t[1], t[2]);
            const H = C.orthocenter(t[0], t[1], t[2]);
            const N = C.nineCenter(t[0], t[1], t[2]);
            const mids = [C.midpoint(t[1], t[2]), C.midpoint(t[2], t[0]), C.midpoint(t[0], t[1])];
            if (!samePt(N, C.midpoint(O, H), 1e-7 * scale) ||
                mids.some((m) => Math.abs(dist(N, m) - dist(O, t[0]) / 2) > 1e-7 * scale)) {
              nineFormulaFails++;
            }
          }
          for (let i = 0; i < 6; i++) {
            if (!samePt(core.mids[i], app.mids[i], tol)) mismatches++;
          }
          const area = (p, q, r) =>
            Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
          const nonDegenerate = core.nine.every(isCircle) && core.pedal.every(isCircle) &&
            core.triangles.every((t) => area(...t) > 500) &&
            core.nine.every((circle) => circle.r < 10 * scale);
          if (nonDegenerate) {
            generic++;
            const err = core.common.errorRelative;
            worstResidual = Math.max(worstResidual, err);
            if (!core.common.reliable) claimFails++;
          }
          if (isCircle(core.common) && Number.isFinite(core.common.error)) {
            worst = Math.max(worst, core.common.error);
          }
        }
      }
    }
  }
  check("all 12,650 grid quadruples match a second transcription of the applet",
    mismatches === 0, `${mismatches} differing values`);
  check("all grid quadruples satisfy the (O+H)/2, R/2 nine-point formula",
    nineFormulaFails === 0, `${nineFormulaFails} failures`);
  check(`the page's concurrence claim holds on all ${generic} non-degenerate grid quadrilaterals`,
    generic > 2000 && claimFails === 0,
    `${claimFails} failures, worst relative error ${worstResidual.toExponential(2)}`);
  check("every finite grid candidate has a measured residual (no silent NaN)",
    Number.isFinite(worst), `worst ${worst}`);
}

/* ----------------------------- 3. random and concyclic quadrilaterals ----- */

{
  const rand = rng(20261127);
  let mismatches = 0;
  let claimFails = 0;
  let tested = 0;
  for (let k = 0; k < 400; k++) {
    const pts = [0, 1, 2, 3].map(() => ({
      x: 10 + rand() * 380, y: 10 + rand() * 280,
    }));
    const s = stateOf(pts);
    const core = C.compute(s);
    const app = javaCompute(s);
    const tol = 1e-6;
    for (let i = 0; i < 4; i++) {
      if (!samePt(core.nine[i], app.nine[i], tol) || !sameNum(core.nine[i].r, app.nine[i].r, tol) ||
          !samePt(core.pedal[i], app.pedal[i], tol) || !sameNum(core.pedal[i].r, app.pedal[i].r, tol)) mismatches++;
    }
    if (core.nine.every(isCircle) && core.pedal.every(isCircle)) {
      tested++;
      if (!core.common.reliable) claimFails++;
    }
  }
  check("400 random quadrilaterals match the applet's transcription", mismatches === 0);
  check(`the concurrence claim holds on all ${tested} generic random quadrilaterals`,
    tested > 350 && claimFails === 0, `${claimFails} failures`);
}

{
  const rand = rng(5032);
  let simsonFails = 0;
  let circleFails = 0;
  let tested = 0;
  for (let k = 0; k < 400; k++) {
    const angles = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + 0.15 + rand() * 0.9);
    const pts = angles.map((a) => ({ x: 200 + 100 * Math.cos(a), y: 150 + 100 * Math.sin(a) }));
    const core = C.compute(stateOf(pts));
    // On a circle the pedal feet of each vertex are collinear: no pedal circle.
    if (!core.pedal.every((p) => Number.isNaN(p.x) && Number.isNaN(p.r))) circleFails++;
    if (!core.common.reliable) { simsonFails++; continue; }
    tested++;
    const M = { x: core.common.x, y: core.common.y };
    for (let i = 0; i < 4; i++) {
      const feet = core.pedal[i].feet;
      let pair = null;
      for (let a = 0; a < 3 && !pair; a++) {
        for (let b = a + 1; b < 3; b++) {
          if (C.finite(feet[a]) && C.finite(feet[b]) && dist(feet[a], feet[b]) > 1) {
            pair = [feet[a], feet[b]];
            break;
          }
        }
      }
      if (!pair || lineDistance(M, pair[0], pair[1]) > 1e-4) simsonFails++;
    }
  }
  check("all 400 concyclic quadrilaterals have collinear pedal feet (no pedal circle)", circleFails === 0);
  check(`on all ${tested} cyclic quadrilaterals the common point lies on all four Simson lines`,
    tested > 350 && simsonFails === 0, `${simsonFails} failures`);
}

/* ------------------------------------------- 4. a known default picture --- */

{
  const s = C.start();
  const d = C.compute(s);
  compareWithApplet("the opening quadrilateral", s);
  check("the opening picture has four nine-point circles and four pedal circles",
    d.nine.every(isCircle) && d.pedal.every(isCircle));
  check("the opening picture's eight circles really meet at one point",
    d.common.reliable && d.common.errorRelative < 1e-9,
    `relative error ${d.common.errorRelative.toExponential(2)}`);
  const s2 = C.withOption(C.withOption(s, "showPedalPoints", true), "showMidpoints", true);
  check("ticking options never changes the geometry",
    JSON.stringify(C.compute(s2).nine) === JSON.stringify(d.nine));
}

done("four-np-circles");
