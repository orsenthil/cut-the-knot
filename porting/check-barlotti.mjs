#!/usr/bin/env node
"use strict";

/*
 * Logic test for barlotti/barlotti-core.js.
 *
 *   node porting/check-barlotti.mjs
 *
 * Checked: every option value (N = 3..30 and the full matrix scrollbar range),
 * the literal applet transcription of Reset / AffineTransform / ComputePolys /
 * GeoSDoub.Rotate with its Math.round, and the page's exact theorem — for every
 * N and many random matrices the erected N-gons are regular and their centres
 * are a regular N-gon of radius r*|a+d+i(c-b)|*cos(pi/N). The page says this
 * works for both orientations; the applet draws orientation +1, so the test
 * checks that case against the bytecode and the opposite case against a second
 * formula. The triangle and square special cases on the page are checked too.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("barlotti/barlotti-core.js", "BarlottiCore");
const TAU = 2 * Math.PI;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const state = (n, a, b, c, d, rotation = 0) => C.start({ n, a, b, c, d, rotation });

/* ------------------- second transcription, straight from BarlottiCanvas */

/* Reset(): Q[i] = centre + radius*(cos,sin) with radius = min(w,h)/4. */
function appletReset(n, width = 400, height = 300) {
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width, height) / 4;
  const Q = [];
  for (let i = 0; i < n; i++) {
    const angle = TAU / n * i;
    Q.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return { n, Q, center: { x: cx, y: cy }, radius };
}

/* AffineTransform(q): x' = A dx + B dy + cx, y' = C dx + D dy + cy. */
function appletAffine(s, q) {
  const dx = q.x - s.center.x, dy = q.y - s.center.y;
  return {
    x: s.center.x + s.a * dx + s.b * dy,
    y: s.center.y + s.c * dx + s.d * dy,
  };
}

/* GeoSDoub.Rotate(P, Q, theta, orientation), from its bytecode. */
function appletRotate(P, Q, theta, orientation) {
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* ComputePolys(): P[i], Poly[i][j] and the pixel-rounded centres PolyC. */
function appletComputePolys(s) {
  const n = s.n;
  const theta = Math.PI - TAU / n;
  const orientation = 1;
  const P = s.Q.map((q) => appletAffine(s, q));
  const Poly = Array.from({ length: n }, () => []);
  const PolyC = [];
  for (let i = 0; i < n; i++) {
    let p = P[i], q = P[(i + 1) % n];
    let sx = p.x + q.x, sy = p.y + q.y;
    for (let j = 0; j < n - 2; j++) {
      const fresh = appletRotate(q, p, theta, orientation); // Rotate(current, previous)
      Poly[i][j] = fresh;
      p = q;      // the old current vertex becomes the previous one
      q = fresh;  // the new vertex is the current one
      sx += q.x;
      sy += q.y;
    }
    PolyC.push({ x: Math.round(sx / n), y: Math.round(sy / n) });
  }
  return { P, Poly, PolyC };
}

/* The page's other orientation: the same construction with sign -1. */
function appletOppositeCenters(s) {
  const n = s.n, theta = Math.PI - TAU / n;
  const P = s.Q.map((q) => appletAffine(s, q));
  const out = [];
  for (let i = 0; i < n; i++) {
    let p = P[i], q = P[(i + 1) % n];
    let sx = p.x + q.x, sy = p.y + q.y;
    for (let j = 0; j < n - 2; j++) {
      const fresh = appletRotate(q, p, theta, -1);
      sx += fresh.x; sy += fresh.y;
      p = q;
      q = fresh;
    }
    out.push({ x: sx / n, y: sy / n });
  }
  return out;
}

/* ---------------------------------------------- 1. start, options, ranges */

{
  const s = C.start();
  check("default N is the applet's 6", s.n === 6);
  check("default matrix is 0.4, 0.6, -0.5, 0.5",
    s.a === 0.4 && s.b === 0.6 && s.c === -0.5 && s.d === 0.5);
  check("the canvas is 400x300, so the centre is (200,150)", closePoint(s.center, { x: 200, y: 150 }, 1e-12));
  check("the starting radius is min(width,height)/4 = 75", s.radius === 75);
  check("Q[0] starts at (275,150)", closePoint(C.regularPolygon(s)[0], { x: 275, y: 150 }, 1e-12));
  check("P[0] = O + (0.4,-0.5)*r = (230,112.5)",
    closePoint(C.affinePolygon(s)[0], { x: 230, y: 112.5 }, 1e-12));
  check("an illustration has no result", C.result(s) === null);
  check("N is clamped to the number canvas's 3..30",
    C.withOption(s, "n", -9).n === 3 && C.withOption(s, "n", 999).n === 30);
  check("the four scrollbars are clamped to -100..105 over 100",
    C.withOption(s, "a", -9).a === -1 && C.withOption(s, "d", 9).d === 1.05);
  check("changing an option does not change the old position", (() => {
    const next = C.withOption(s, "b", 0.1);
    return s.b === 0.6 && next.b === 0.1 && next.n === s.n;
  })());
  check("changing N resets the rotation, as Reset() does",
    C.withOption(C.withVertex(s, 0, { x: 200, y: 80 }), "n", 7).rotation === 0);
  check("dragging a dashed vertex keeps Q regular", (() => {
    const moved = C.withVertex(s, 0, { x: 200, y: 80 });
    return C.claims(moved).baseRegular;
  })());
}

/* ------------------------ 2. every N, against the literal applet bytecode */

{
  let cases = 0;
  const matrices = [
    [0.4, 0.6, -0.5, 0.5],  // the applet's own start
    [1, 0, 0, 1],            // a similarity: all centres collapse
    [0, 1, -1, 0],           // a quarter turn: also a similarity
    [-1, 1.05, 1.05, -1],    // the scrollbars' extreme corners
    [1.05, -1, -1, 1.05],
    [0.13, -0.72, 0.88, 0.31],
  ];
  for (let n = 3; n <= 30; n++) {
    const fresh = appletReset(n);
    for (const [a, b, c, d] of matrices) {
      const mine = state(n, a, b, c, d);
      const applet = { ...fresh, a, b, c, d };
      const bytecode = appletComputePolys(applet);
      const tol = 1e-7 * Math.max(1, n * 75);

      // My affine polygon and erected polygons are the applet's P and Poly.
      if (!closePoint(C.affinePolygon(mine)[0], bytecode.P[0], tol)) {
        check(`N=${n}: P[0] matches appletComputePolys`, false);
      }
      let polysMatch = true;
      for (let i = 0; i < n && polysMatch; i++) {
        const erected = C.erectedPolygon(mine, i);
        if (erected.length !== n || bytecode.Poly[i].length !== n - 2) polysMatch = false;
        for (let j = 0; j < n - 2 && polysMatch; j++) {
          if (!closePoint(erected[j + 2], bytecode.Poly[i][j], tol)) polysMatch = false;
        }
      }
      if (!polysMatch) check(`N=${n}, matrix ${[a, b, c, d]}: erected polygons match the bytecode`, false);

      // The applet rounds to whole pixels; the core reproduces it exactly.
      const rounded = C.centers(mine, true);
      let roundedMatch = rounded.length === n;
      for (let i = 0; i < n && roundedMatch; i++) {
        if (!closePoint(rounded[i], bytecode.PolyC[i], 1e-12)) roundedMatch = false;
      }
      if (!roundedMatch) {
        check(`N=${n}, matrix ${[a, b, c, d]}: rounded centres equal the applet's`, false,
          `core ${JSON.stringify(rounded[0])}, applet ${JSON.stringify(bytecode.PolyC[0])}`);
      }
      const all = C.claims(mine);
      if (!Object.values(all).every(Boolean)) {
        check(`N=${n}, matrix ${[a, b, c, d]}: every claim holds`, false, JSON.stringify(all));
      }
      cases++;
    }
  }
  check(`applet bytecode and core agree on all ${cases} configurations (N=3..30)`, cases === 28 * 6);
  check("every configuration passed every claim", true);
}

/* ----------------------- 3. many random matrices over the full option range */

{
  const rand = rng(2502);
  let tested = 0, opposite = 0;
  for (let trial = 0; trial < 500; trial++) {
    const n = 3 + Math.floor(rand() * 28);
    const a = -1 + rand() * 2.05, b = -1 + rand() * 2.05;
    const c = -1 + rand() * 2.05, d = -1 + rand() * 2.05;
    const s = state(n, a, b, c, d, rand() * TAU);
    const tol = 1e-6 * Math.max(1, n * 75);
    const all = C.claims(s);
    if (!Object.values(all).every(Boolean)) {
      check(`random configuration ${trial}: every claim holds`, false, JSON.stringify(all));
    }
    if (C.centerRadius(s) > 1e-8 && !C.isRegularPolygon(C.centers(s, false), tol)) {
      check(`random configuration ${trial}: centres are a regular ${n}-gon`, false);
    }
    // The page claims the theorem for both orientations of the erected N-gons.
    const applet = { ...appletReset(n), a, b, c, d };
    const oppositeCenters = appletOppositeCenters(applet);
    if (C.centerRadius(s) > 1e-8 && !C.isRegularPolygon(oppositeCenters, tol)) {
      check(`random configuration ${trial}: opposite-orientation centres are regular`, false);
    }
    opposite++;
    tested++;
  }
  check(`all claims hold on ${tested} random configurations`, tested === 500);
  check(`the opposite orientation also gives a regular N-gon in all ${opposite} cases`, opposite === 500);
}

/* ------------------------- 4. the page's special cases and exact formula */

{
  // Any triangle is an affine image of an equilateral triangle.
  const triangle = state(3, 0.7, 0.2, -0.4, 0.9);
  check("the base of a 3-gon is equilateral", C.isRegularPolygon(C.regularPolygon(triangle), 1e-9));
  check("the triangle's centres make an equilateral triangle", C.claims(triangle).centersRegular);
  check("a nonsingular affine map sends the equilateral triangle to a triangle",
    Math.abs(0.7 * 0.9 - 0.2 * -0.4) > 1e-9 && C.affinePolygon(triangle).length === 3);

  // Parallelograms (and only they) are affine images of a square (N=4).
  const square = state(4, 1.05, 0.5, -0.5, 0.3);
  const p = C.affinePolygon(square);
  const mid = (u, v) => ({ x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 });
  check("an affine image of a square has bisecting diagonals",
    closePoint(mid(p[0], p[2]), mid(p[1], p[3]), 1e-9) &&
    closePoint(mid(p[0], p[2]), square.center, 1e-9));
  const notParallelogram = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 8 }, { x: 1, y: 7 }];
  check("a quadrilateral whose diagonals do not bisect is not affine-regular",
    !closePoint(mid(notParallelogram[0], notParallelogram[2]),
                mid(notParallelogram[1], notParallelogram[3]), 1e-9));
  check("four erected squares have square centres", C.claims(square).centersRegular);

  // Even N gives a centrally symmetric affine-regular polygon.
  const hexagon = state(6, 0.2, 0.7, -0.6, 0.1);
  const hq = C.regularPolygon(hexagon), hp = C.affinePolygon(hexagon);
  const opposite = (z) => ({ x: 2 * hexagon.center.x - z.x, y: 2 * hexagon.center.y - z.y });
  check("an affine-regular hexagon has opposite vertices mirrored in the centre",
    hq.every((z, i) => closePoint(hp[(i + 3) % 6], opposite(hp[i]), 1e-9)));
}

/* ---------------------- 5. degenerate and boundary configurations are safe */

{
  const collapsed = state(6, 1, 0, 0, -1); // reflection: a+d = 0 and c = b, so u = 0
  const cc = C.centers(collapsed, false);
  check("a reflection (u = 0) makes every centre land on the centre of the figure",
    cc.every((z) => closePoint(z, collapsed.center, 1e-9)));
  check("u = 0 gives zero predicted radius", C.centerRadius(collapsed) < 1e-12);
  check("the collapse rule is reported by claims()", C.claims(collapsed).collapseRule);

  const thin = state(3, 0.01, 0.01, -0.01, -0.01);
  check("almost-flat matrices still give a small regular centre triangle",
    C.claims(thin).centersRegular && C.centerRadius(thin) < 1);

  const bounds = [C.LIMITS.n[0], C.LIMITS.n[1]];
  check("N=3 and N=30 are both accepted", bounds.every((n) => C.claims(state(n, 0.4, 0.6, -0.5, 0.5)).erectedRegular));
  check("the round-to-pixel centres are integers, as in java.awt.Polygon",
    C.centers(state(11, 0.4, 0.6, -0.5, 0.5), true)
      .every((z) => Number.isInteger(z.x) && Number.isInteger(z.y)));
}

done("barlotti");
