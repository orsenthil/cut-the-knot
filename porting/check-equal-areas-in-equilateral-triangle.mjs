#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-areas-in-equilateral-triangle/equal-areas-in-equilateral-triangle-core.js.
 *
 *   node porting/check-equal-areas-in-equilateral-triangle.mjs
 *
 * The claim on the cut-the-knot page is
 *   Area(AMB') + Area(BMC') + Area(CMA') = Area(A'MB) + Area(B'MC) + Area(C'MA).
 * The Java applet computes six numbers W[0..5], each a base length times the
 * distance from M to that side (twice a small triangle's area). The odd W's
 * are the left side of (1), the even W's the right side. This test compares
 * the core with a second, literal transcription of Canvas.Compute() and of
 * Canvas.DoDraw() over a full barycentric grid and random positions, checks
 * the identity itself and the stronger fact that each side is exactly half
 * the whole triangle, and exercises the applet's two checkboxes and its
 * restriction of M to the inside of the triangle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "equal-areas-in-equilateral-triangle/equal-areas-in-equilateral-triangle-core.js",
  "EqualAreasInEquilateralTriangleCore",
);

const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, eps = 1e-8) => near(p.x, q.x, eps) && near(p.y, q.y, eps);

/* ----------------------------------------------------- a second transcription */

/* GeoSDoub.NearestPoint(p, a, b) as the bytecode uses it. */
function rawNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}
function rawDist(p, q) {
  return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
}

/* Canvas.Compute(): the six W's in the applet's own order. */
function appletCompute(state) {
  const { A, B, C: V, M } = state;
  const Ap = rawNearest(M, B, V);
  const Bp = rawNearest(M, V, A);
  const Cp = rawNearest(M, A, B);
  return {
    Ap, Bp, Cp,
    W: [
      rawDist(M, Cp) * rawDist(A, Cp),
      rawDist(M, Cp) * rawDist(B, Cp),
      rawDist(M, Ap) * rawDist(B, Ap),
      rawDist(M, Ap) * rawDist(V, Ap),
      rawDist(M, Bp) * rawDist(V, Bp),
      rawDist(M, Bp) * rawDist(A, Bp),
    ],
  };
}

/* GeoSDoub.Intersect of the line through M parallel to a side with another
   side, written straight from the determinant formula. Canvas.Compute uses
   these six points when "hint" is on. */
function rawParallelHit(M, from, to, sideP, sideQ) {
  const rx = to.x - from.x, ry = to.y - from.y; // direction of the side
  const sx = sideQ.x - sideP.x, sy = sideQ.y - sideP.y;
  const det = rx * sy - ry * sx;
  const t = ((sideP.x - M.x) * sy - (sideP.y - M.y) * sx) / det;
  return { x: M.x + rx * t, y: M.y + ry * t };
}

function appletHintPoints(state) {
  const { A, B, C: V, M } = state;
  const qBC = { x: M.x + (V.x - B.x), y: M.y + (V.y - B.y) };
  const qAC = { x: M.x + (V.x - A.x), y: M.y + (V.y - A.y) };
  const qAB = { x: M.x + (B.x - A.x), y: M.y + (B.y - A.y) };
  return {
    Ab: rawParallelHit(M, qBC, M, A, B),
    Ac: rawParallelHit(M, qBC, M, A, V),
    Ba: rawParallelHit(M, qAC, M, B, A),
    Bc: rawParallelHit(M, qAC, M, B, V),
    Ca: rawParallelHit(M, qAB, M, V, A),
    Cb: rawParallelHit(M, qAB, M, V, B),
  };
}

/* GeoSDoub.FindOrientation, written out again for the second transcription. */
function rawOrientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/* Canvas.DoDraw(): all three orientations of M must agree. */
function appletInside(state, p) {
  const o1 = rawOrientation(p, state.B, state.C);
  const o2 = rawOrientation(p, state.C, state.A);
  const o3 = rawOrientation(p, state.A, state.B);
  return (o1 === o2 && o2 === o3) || (o1 > 0 && o2 > 0 && o3 > 0) ||
    (o1 < 0 && o2 < 0 && o3 < 0);
}

/* Barycentric coordinates: alpha is proportional to the distance to BC. */
function barycentric(state, p) {
  const total = rawOrientation(state.A, state.B, state.C);
  return [
    rawOrientation(p, state.B, state.C) / total,
    rawOrientation(p, state.C, state.A) / total,
    rawOrientation(p, state.A, state.B) / total,
  ];
}
function wholePart(whole, d, length) { return whole * d * length; }

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("the board has the applet's 420 by 360 viewBox", C.WIDTH === 420 && C.HEIGHT === 360);
  check("the side is min(width*sqrt(3)/2, height)*9/10",
    near(s.side, Math.min(420 * Math.sqrt(3) / 2, 360) * 0.9));
  check("A and B are a horizontal base", near(s.A.y, s.B.y) && near(s.B.x - s.A.x, s.side));
  check("C is above the midpoint of AB", near(s.C.x, (s.A.x + s.B.x) / 2) && s.C.y < s.A.y);
  check("ABC is equilateral", near(C.distance(s.A, s.B), C.distance(s.B, s.C)) &&
    near(C.distance(s.B, s.C), C.distance(s.C, s.A)));
  check("M starts at (A + 3B + 2C)/6, not at the centroid",
    nearPoint(s.M, {
      x: (s.A.x + 3 * s.B.x + 2 * s.C.x) / 6,
      y: (s.A.y + 3 * s.B.y + 2 * s.C.y) / 6,
    }) && !nearPoint(s.M, { x: (s.A.x + s.B.x + s.C.x) / 3, y: (s.A.y + s.B.y + s.C.y) / 3 }));
  check("M starts inside the triangle", C.inside(s, s.M));
  check("both checkboxes start unchecked", !s.showNames && !s.hint);
  equal("the options carried by a new picture are plain data",
    C.start({ showNames: true, hint: true }).showNames, true);
  check("outside points are refused by moveM", C.moveM(s, { x: 0, y: 0 }) === s);
  const moved = C.moveM(s, { x: 200, y: 150 });
  check("inside points are accepted by moveM", moved !== s && nearPoint(moved.M, { x: 200, y: 150 }));
  check("moveM does not change the given position", nearPoint(s.M, {
    x: (s.A.x + 3 * s.B.x + 2 * s.C.x) / 6,
    y: (s.A.y + 3 * s.B.y + 2 * s.C.y) / 6,
  }));
  const toggled = C.toggle(C.toggle(s, "hint"), "showNames");
  check("the two checkboxes toggle independently", toggled.hint && toggled.showNames && !s.hint);
  check("an unknown option is ignored", C.toggle(s, "other") === s);
  const reset = C.reset(toggled);
  check("Reset restores M and keeps the checkboxes", nearPoint(reset.M, s.M) &&
    reset.hint && reset.showNames);
}

/* ------------------------------------------- 2. core against the applet code */

{
  let wBad = 0, footBad = 0, hintBad = 0, worst = 0;
  let cases = 0;
  const base = C.start({});

  /* Every interior lattice point of the triangle at 1/20 barycentric steps. */
  for (let i = 0; i <= 20; i++) {
    for (let j = 0; j <= 20 - i; j++) {
      const k = 20 - i - j;
      const p = {
        x: (i * base.A.x + j * base.B.x + k * base.C.x) / 20,
        y: (i * base.A.y + j * base.B.y + k * base.C.y) / 20,
      };
      const state = C.moveM(base, p);
      const g = C.geometry(state);
      const a = appletCompute(state);
      for (let n = 0; n < 6; n++) {
        if (!near(g.W[n], a.W[n], 1e-7)) { wBad++; worst = Math.max(worst, Math.abs(g.W[n] - a.W[n])); }
      }
      if (!nearPoint(g.Ap, a.Ap) || !nearPoint(g.Bp, a.Bp) || !nearPoint(g.Cp, a.Cp)) footBad++;
      const h = appletHintPoints(state);
      for (const key of ["Ab", "Ac", "Ba", "Bc", "Ca", "Cb"]) {
        if (!g[key] || !nearPoint(g[key], h[key], 1e-7)) hintBad++;
      }
      cases++;
    }
  }

  /* And random positions, including ones very near a vertex or a side. */
  const rnd = rng(20261127);
  for (let n = 0; n < 400; n++) {
    let a = rnd(), b = rnd();
    if (a + b > 1) { a = 1 - a; b = 1 - b; }
    const c = 1 - a - b;
    const p = {
      x: a * base.A.x + b * base.B.x + c * base.C.x,
      y: a * base.A.y + b * base.B.y + c * base.C.y,
    };
    const state = C.moveM(base, p);
    const g = C.geometry(state);
    const ref = appletCompute(state);
    for (let n2 = 0; n2 < 6; n2++) {
      if (!near(g.W[n2], ref.W[n2], 1e-7)) { wBad++; worst = Math.max(worst, Math.abs(g.W[n2] - ref.W[n2])); }
    }
    if (!nearPoint(g.Ap, ref.Ap) || !nearPoint(g.Bp, ref.Bp) || !nearPoint(g.Cp, ref.Cp)) footBad++;
    cases++;
  }

  check(`${cases} configurations: every W matches the applet's Compute`, wBad === 0,
    `${wBad} differences, worst ${worst}`);
  check(`${cases} configurations: the three pedal points match`, footBad === 0, `${footBad} differences`);
  check(`the ${231} hint intersections match a second transcription`, hintBad === 0, `${hintBad} differences`);
}

/* ------------------------------------------------- 3. page claim, exhaustively */

{
  let claimBad = 0, halfBad = 0, partitionBad = 0, baryBad = 0;
  const base = C.start({});
  let cases = 0;
  for (let i = 0; i <= 24; i++) {
    for (let j = 0; j <= 24 - i; j++) {
      const k = 24 - i - j;
      const p = {
        x: (i * base.A.x + j * base.B.x + k * base.C.x) / 24,
        y: (i * base.A.y + j * base.B.y + k * base.C.y) / 24,
      };
      const state = C.moveM(base, p);
      const s = C.sums(state);
      const g = C.geometry(state);
      if (!near(s.left, s.right, 1e-7)) claimBad++;
      if (!near(s.left, s.whole / 2, 1e-7) || !near(s.right, s.whole / 2, 1e-7)) halfBad++;
      if (!near(s.all, s.whole, 1e-7)) partitionBad++;

      /* Independently: with barycentric (a,b,c), the applet's W's are
         whole*a*(c + a/2), whole*b*(a + b/2), whole*c*(b + c/2) and their
         complements. This proves (1) without reusing the core's W array. */
      const [a, b, c] = barycentric(state, state.M);
      const expect = [
        wholePart(s.whole, c, b + c / 2),
        wholePart(s.whole, c, a + c / 2),
        wholePart(s.whole, a, c + a / 2),
        wholePart(s.whole, a, b + a / 2),
        wholePart(s.whole, b, a + b / 2),
        wholePart(s.whole, b, c + b / 2),
      ];
      for (let n = 0; n < 6; n++) if (!near(g.W[n], expect[n], 1e-7)) baryBad++;

      /* The six coloured triangles tile the big one. */
      let pieces = 0;
      for (const tri of g.triangles) pieces += C.doubledArea(tri[0], tri[1], tri[2]);
      if (!near(pieces, s.whole, 1e-7)) partitionBad++;
      cases++;
    }
  }
  check(`${cases} positions: (1) holds, left = right`, claimBad === 0, `${claimBad} failures`);
  check(`${cases} positions: each side of (1) is exactly half the triangle`, halfBad === 0, `${halfBad} failures`);
  check(`${cases} positions: the six pieces tile the triangle`, partitionBad === 0, `${partitionBad} failures`);
  check(`${cases} positions: W's match a barycentric derivation`, baryBad === 0, `${baryBad} failures`);

  /* The two bars the applet draws are the two equal triples: after scaling
     all six W's so they add to the board width, each bar is half as wide. */
  const s = C.sums(C.start({}));
  const scale = C.WIDTH / s.all;
  const even = (s.all - s.left) * scale;
  const odd = s.left * scale;
  check("the applet's two area bars have equal width", near(even, odd) && near(even, C.WIDTH / 2));
}

/* ----------------------------------------------- 4. edges, feet and messages */

{
  const s = C.start({});
  const corners = [s.A, s.B, s.C];
  let perpBad = 0, parallelBad = 0, barBad = 0;
  for (const corner of corners) {
    const p = {
      x: corner.x * 0.98 + s.M.x * 0.02,
      y: corner.y * 0.98 + s.M.y * 0.02,
    };
    const state = C.moveM(s, p);
    const g = C.geometry(state);
    const perp = (f, p, q) =>
      Math.abs((state.M.x - f.x) * (q.x - p.x) + (state.M.y - f.y) * (q.y - p.y)) < 1e-6;
    if (!perp(g.Ap, state.B, state.C)) perpBad++;
    if (!perp(g.Bp, state.C, state.A)) perpBad++;
    if (!perp(g.Cp, state.A, state.B)) perpBad++;
    const cross = (p1, p2, q1, q2) =>
      (p2.x - p1.x) * (q2.y - q1.y) - (p2.y - p1.y) * (q2.x - q1.x);
    if (!near(cross(g.Ab, g.Ac, state.B, state.C), 0, 1e-6)) parallelBad++;
    if (!near(cross(g.Ba, g.Bc, state.A, state.C), 0, 1e-6)) parallelBad++;
    if (!near(cross(g.Ca, g.Cb, state.A, state.B), 0, 1e-6)) parallelBad++;
    if (!near(C.sums(state).left, C.sums(state).whole / 2, 1e-7)) barBad++;
  }
  check("near each vertex, the feet are perpendicular", perpBad === 0, `${perpBad} failures`);
  check("near each vertex, the hint lines are parallel to the sides", parallelBad === 0, `${parallelBad} failures`);
  check("the claim still holds almost on a vertex", barBad === 0, `${barBad} failures`);

  /* DoDraw() and inside() agree even for points outside the picture. */
  let edgeBad = 0;
  for (let x = -40; x <= C.WIDTH + 40; x += 20) {
    for (let y = -40; y <= C.HEIGHT + 40; y += 20) {
      const p = { x: x, y: y };
      if (C.inside(s, p) !== appletInside(s, p)) edgeBad++;
    }
  }
  check("DoDraw and inside agree over the whole canvas", edgeBad === 0, `${edgeBad} disagreements`);
  check("the corners themselves count as drawable", corners.every((p) => C.inside(s, p)));
  check("a point well outside is not drawable", !C.inside(s, { x: 0, y: 0 }));

  const words = C.status(s);
  check("the status reports the two equal totals", /same area/.test(words) &&
    words.includes("half of the big triangle"));
  check("the status has no win or loss", !/won|lose|win/.test(words));
}

done("equal-areas-in-equilateral-triangle");
