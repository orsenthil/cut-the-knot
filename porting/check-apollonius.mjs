#!/usr/bin/env node
"use strict";

/*
 * Logic test for apollonius/apollonius-core.js.
 *
 *   node porting/check-apollonius.mjs
 *
 * The applet solves the three-circle (CCC) case of the Problem of Apollonius
 * algebraically: for eight independent sign choices it solves two linear
 * equations for the centre in terms of the radius, then a quadratic in the
 * radius. The page claims up to 2*2*2 = 8 solutions, "not always" that many,
 * and no solution at all for concentric circles. All three are checked here.
 *
 * Section 3 is a second, literal transcription of ApolloniusCircle's
 * SetCircles/Compute and ApolloniusCanvas's DrawOneCircle/WasUsed from the
 * bytecode, with the same static fields, thresholds and fix-ups. It is compared
 * with the core over thousands of random and degenerate configurations, not a
 * handful of examples. Section 4 verifies the actual tangency conditions:
 * every drawn circle really touches all three given circles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("apollonius/apollonius-core.js", "ApolloniusCore");
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const geometry = (state) => state.circles.map((c) => ({ center: c.center, radius: C.radius(c) }));

/* ------------------------------------------------------------ 1. the setup */

{
  equal("the applet's canvas and Reset constant",
    [C.DEFAULT_WIDTH, C.DEFAULT_HEIGHT, C.DEFAULT_UNIT], [400, 300, 40]);
  const s = C.start({});
  equal("Reset: the first circle at (W/2 - 4R, H/2) with radius R",
    [s.circles[0].center, C.radius(s.circles[0])], [{ x: 40, y: 150 }, 40]);
  equal("Reset: the second circle at (W/2 + 2R, H/2 + 2R) with radius 1.5R",
    [s.circles[1].center, C.radius(s.circles[1])], [{ x: 280, y: 230 }, 60]);
  equal("Reset: the third circle at (W/2, H/2 - 2R) with radius 2R",
    [s.circles[2].center, C.radius(s.circles[2])], [{ x: 200, y: 70 }, 80]);
  const again = C.start({});
  check("start is driven only by its options", JSON.stringify(s) === JSON.stringify(again));
  const reset = C.reset(s);
  check("Reset restores all three circles", JSON.stringify(reset) === JSON.stringify(s));
  const small = C.start({ width: 360, height: 240, unit: 30 });
  equal("the board size and scale can be changed",
    [small.circles[0].center.x, small.circles[2].center.y, C.radius(small.circles[2])],
    [60, 60, 60]);
}

/* -------------------------------------------- 2. dragging the six points */

{
  const s = C.start({});
  const moved = C.movePoint(s, "C1", { x: 100, y: 150 });
  check("dragging a centre moves it without changing the radius",
    moved.circles[0].center.x === 100 && near(C.radius(moved.circles[0]), 40, 1e-12));
  check("the rim travels with the centre",
    near(moved.circles[0].rim.x, 140, 1e-12) && near(moved.circles[0].rim.y, 150, 1e-12));
  check("other circles are untouched",
    JSON.stringify(moved.circles[1]) === JSON.stringify(s.circles[1]));
  check("dragging a centre leaves the input alone",
    s.circles[0].center.x === 40 && s.circles[0].rim.x === 80);

  const resized = C.movePoint(s, "R2", { x: 280, y: 290 });
  check("dragging a rim changes only that radius",
    resized.circles[2].center.x === s.circles[2].center.x &&
    near(C.radius(resized.circles[1]), 60, 1e-12));
  check("the new radius follows the rim point",
    near(C.radius(resized.circles[1]), 60, 1e-12));
  const wide = C.movePoint(s, "R1", { x: 10000, y: 150 });
  check("a rim is clamped to the board", C.radius(wide.circles[0]) <= 150);
  const tiny = C.movePoint(s, "R3", { x: 202, y: 70 });
  check("a rim cannot collapse a circle", C.radius(tiny.circles[0]) === 40 && C.radius(tiny.circles[2]) >= C.MIN_RADIUS);
  check("an unknown handle is ignored", C.movePoint(s, "Q9", { x: 1, y: 2 }) === s);
}

/* ------- 3. a second transcription of the applet's Compute and DrawOneCircle */

/*
 * ApolloniusCircle has static Ci[], A1, A2, B1, B2, D1, D2, K, G, I and o.
 * This is the same list of arithmetic operations in the same order as javap
 * shows, including the 0.01, 0.001 and 0 thresholds and the negative-root
 * fix-up that keeps the centre on the signed root but the radius positive.
 */
const applet = {
  Ci: [], A1: 0, A2: 0, B1: 0, B2: 0, D1: 0, D2: 0, K: 0, G: 0, I: 0, o: 0,
};

function appletCInfo(c) {
  return c.center.x * c.center.x + c.center.y * c.center.y - c.radius * c.radius;
}

function appletSetCircles(a, b, c) {
  applet.Ci[0] = a; applet.Ci[1] = b; applet.Ci[2] = c;
  applet.A1 = 2.0 * (b.center.x - a.center.x);
  applet.A2 = 2.0 * (c.center.x - a.center.x);
  applet.B1 = 2.0 * (b.center.y - a.center.y);
  applet.B2 = 2.0 * (c.center.y - a.center.y);
  applet.o = appletCInfo(a);
  applet.D1 = applet.o - appletCInfo(b);
  applet.D2 = applet.o - appletCInfo(c);
  applet.K = applet.A1 * applet.B2 - applet.A2 * applet.B1;
  applet.G = (applet.B1 * applet.D2 - applet.B2 * applet.D1) / applet.K;
  applet.I = -(applet.A1 * applet.D2 - applet.A2 * applet.D1) / applet.K;
}

/** Bytecode TreatZeroDeterminant: both arms jump to aconst_null. */
function appletTreatZeroDeterminant() {
  if (applet.A1 * applet.A1 + applet.B1 * applet.B1 < 0.1) return null;
  return null;
}

function appletCompute(s0, s1, s2) {
  if (Math.abs(applet.K) < 0.01) return appletTreatZeroDeterminant(s0, s1, s2);
  const a = applet.Ci[0];
  const d3 = 2.0 * (s0 * a.radius - s1 * applet.Ci[1].radius);
  const d5 = 2.0 * (s0 * a.radius - s2 * applet.Ci[2].radius);
  const v = (applet.B1 * d5 - applet.B2 * d3) / applet.K;
  const w = -(applet.A1 * d5 - applet.A2 * d3) / applet.K;
  const L = v * v + w * w - 1.0;
  if (Math.abs(L) < 0.001) return null;
  const coef = 2.0 * (v * applet.G + w * applet.I - v * a.center.x - w * a.center.y + s0 * a.radius);
  const q = applet.G * applet.G + applet.I * applet.I -
    2.0 * applet.G * a.center.x - 2.0 * applet.I * a.center.y + applet.o;
  let disc = coef * coef - 4.0 * L * q;
  if (disc < 0.0) return null;
  disc = Math.sqrt(disc);
  let t = (-coef + disc) / 2.0 / L;
  const first = { x: v * t + applet.G, y: w * t + applet.I, radius: Math.abs(t), signedR: t };
  t = (-coef - disc) / 2.0 / L;
  const second = { x: v * t + applet.G, y: w * t + applet.I, radius: Math.abs(t), signedR: t };
  return [first, second];
}

function appletSignature(i, j, k) {
  let n = 0;
  if (i < 0) n++;
  if (j < 0) n++;
  if (k < 0) n++;
  return n;
}

/** DrawOneCircle + WasUsed: pick the first root unless it repeats a drawn one. */
function appletSolve(gs) {
  appletSetCircles(gs[0], gs[1], gs[2]);
  const used = [];
  const drawn = [];
  for (const [i, j, k] of C.SIGN_TRIPLES) {
    const pair = appletCompute(i, j, k);
    if (!pair) continue;
    let c = pair[0];
    for (const u of used) {
      if (Math.hypot(u.x - c.x, u.y - c.y, u.radius - c.radius) < 1) { c = pair[1]; break; }
    }
    c.color = appletSignature(i, j, k);
    c.signs = [i, j, k];
    drawn.push(c);
    used.push(c);
  }
  return drawn;
}

function sameCircles(a, b, tol, withLabels) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!near(a[i].x, b[i].x, tol) || !near(a[i].y, b[i].y, tol) ||
        !near(a[i].radius, b[i].radius, tol) ||
        !near(a[i].signedR, b[i].signedR, tol)) return false;
    if (withLabels && (a[i].color !== b[i].color ||
        a[i].signs.join() !== b[i].signs.join())) return false;
  }
  return true;
}

{
  const random = rng(20261126);
  let pairs = true, drawn = true, counts = 0;
  for (let t = 0; t < 1200; t++) {
    const gs = [0, 1, 2].map(() => ({
      center: { x: random() * 400 - 200, y: random() * 300 - 150 },
      radius: 5 + random() * 95,
    }));
    appletSetCircles(gs[0], gs[1], gs[2]);
    for (const s of C.SIGN_TRIPLES) {
      const mine = C.compute(gs, s);
      const theirs = appletCompute(...s);
      if ((mine === null) !== (theirs === null)) { pairs = false; continue; }
      if (!mine) continue;
      const tol = 1e-7 * Math.max(1, Math.abs(mine[0].x), Math.abs(mine[0].y), mine[0].radius);
      pairs = pairs && sameCircles(mine, theirs, tol, false);
    }
    drawn = drawn && sameCircles(C.solve(gs), appletSolve(gs), 1e-6 * 400, true);
    counts += C.solve(gs).length;
  }
  check("all 9600 sign choices agree with the applet's Compute", pairs);
  check("the core's entire drawing agrees with DrawOneCircle/WasUsed", drawn);
  check("the random set produces many solutions", counts > 4000);
}

{
  // Structured configurations: nested, overlapping, collinear, nearly
  // concentric and coincident circles - the cases most likely to expose a
  // transcribed sign or a missing fix-up.
  let pairs = true, drawn = true;
  for (let a = 0; a <= 6; a++) {
    for (let b = 0; b <= 6; b++) {
      for (let c = 0; c <= 6; c++) {
        const gs = [
          { center: { x: 0, y: 0 }, radius: 10 + a * 10 },
          { center: { x: b * 20, y: b * 5 }, radius: 10 + b * 10 },
          { center: { x: c * 5 - 30, y: c * 20 }, radius: 10 + c * 10 },
        ];
        appletSetCircles(gs[0], gs[1], gs[2]);
        for (const s of C.SIGN_TRIPLES) {
          const mine = C.compute(gs, s);
          const theirs = appletCompute(...s);
          if ((mine === null) !== (theirs === null)) { pairs = false; continue; }
          if (mine) pairs = pairs && sameCircles(mine, theirs, 1e-7 * Math.max(1, mine[0].radius), false);
        }
        drawn = drawn && sameCircles(C.solve(gs), appletSolve(gs), 1e-6 * 200, true);
      }
    }
  }
  check("343 structured configurations agree with the applet's Compute", pairs);
  check("343 structured configurations agree with its drawing order", drawn);
}

/* ---------------------------------- 4. tangency conditions and the claims */

{
  const random = rng(712311);
  let signedOk = true, geometricOk = true, bounded = true, orderOk = true;
  let eight = 0, none = 0, colors = {};
  for (let t = 0; t < 1500; t++) {
    const gs = [0, 1, 2].map(() => ({
      center: { x: random() * 500 - 250, y: random() * 400 - 200 },
      radius: 5 + random() * 95,
    }));
    const scale = Math.max(1, ...gs.map((g) => g.radius));
    const found = C.solve(gs);
    bounded = bounded && found.length <= 8;
    if (found.length === 8) eight++;
    if (found.length === 0) none++;
    for (const c of found) colors[c.color] = (colors[c.color] || 0) + 1;
    let last = -1;
    for (const c of found) {
      const idx = C.SIGN_TRIPLES.findIndex((s) => s.join() === c.signs.join());
      orderOk = orderOk && idx > last;
      last = idx;
    }
    for (const c of found) {
      for (let i = 0; i < 3; i++) {
        const s = c.signs[i];
        const d = Math.hypot(c.x - gs[i].center.x, c.y - gs[i].center.y);
        const eSigned = Math.abs(d - Math.abs(c.signedR - s * gs[i].radius));
        const eGeom = Math.min(
          Math.abs(d - (c.radius + gs[i].radius)),
          Math.abs(d - Math.abs(c.radius - gs[i].radius)),
        );
        signedOk = signedOk && eSigned < 1e-6 * Math.max(scale, d, Math.abs(c.signedR));
        geometricOk = geometricOk && eGeom < 1e-6 * Math.max(scale, d, c.radius);
      }
    }
  }
  check("every drawn circle satisfies its own (signed) tangency equation 4500 times", signedOk);
  check("every drawn circle is geometrically tangent to all three given circles", geometricOk);
  check("at most eight circles are drawn, as the page says", bounded);
  check("eight solutions really occur", eight > 50);
  check("some configurations have fewer solutions", none > 0 || eight < 1500);
  check("all four signature colours occur", Object.keys(colors).length === 4);
  check("solutions keep the applet's eight-sign order",
    C.SIGN_TRIPLES.length === 8 && C.SIGN_TRIPLES[0].join() === "1,1,1" &&
    C.SIGN_TRIPLES[7].join() === "-1,-1,-1" && orderOk);
}

{
  const concentric = [
    { center: { x: 100, y: 100 }, radius: 20 },
    { center: { x: 100, y: 100 }, radius: 40 },
    { center: { x: 100, y: 100 }, radius: 60 },
  ];
  check("concentric circles have no solution, as the page says", C.solve(concentric).length === 0);
  check("every sign choice gives up on concentric circles",
    C.SIGN_TRIPLES.every((s) => C.compute(concentric, s) === null));
  const equalCircles = [
    { center: { x: 10, y: 20 }, radius: 30 },
    { center: { x: 10, y: 20 }, radius: 30 },
    { center: { x: 10, y: 20 }, radius: 30 },
  ];
  check("three coincident circles give up too (the applet's K test)",
    C.solve(equalCircles).length === 0);
  const collinear = [
    { center: { x: 0, y: 0 }, radius: 10 },
    { center: { x: 40, y: 0 }, radius: 20 },
    { center: { x: 80, y: 0 }, radius: 30 },
  ];
  check("collinear centres have a zero determinant and no drawn circle",
    C.solve(collinear).length === 0);
  const commonPoint = [
    { center: { x: 20, y: 0 }, radius: 20 },
    { center: { x: 50, y: 0 }, radius: 50 },
    { center: { x: 80, y: 0 }, radius: 80 },
  ];
  check("circles all touching at one point: the page's infinite family is not drawn",
    C.solve(commonPoint).length === 0);
  const s = C.start({});
  check("the default diagram shows all eight solutions", C.solutions(s).length === 8);
  check("signature counts are 1, 3, 3, 1",
    C.SIGN_TRIPLES.map(C.signature).join() === "0,1,1,1,2,2,2,3");

  // Three circles of almost zero radius behave like three points: all eight
  // signs give nearly the same circumcircle, so WasUsed has to fall through to
  // the second quadratic root after the first one has been drawn.
  const nearPoints = [
    { center: { x: 0, y: 0 }, radius: 0.001 },
    { center: { x: 100, y: 0 }, radius: 0.001 },
    { center: { x: 40, y: 80 }, radius: 0.001 },
  ];
  const nearSolutions = C.solve(nearPoints);
  check("a near-point configuration uses the second root seven times",
    nearSolutions.filter((c) => c.root === 1).length === 7);
  check("the applet's drawing agrees on that near-point configuration",
    sameCircles(nearSolutions, appletSolve(nearPoints), 1e-6, true));
}

/* --------------------------------------------------- 5. the saved position */

{
  const s = C.start({});
  const p = C.position(s);
  check("the saved position is plain data for the tutor",
    typeof p.width === "number" && p.circles.length === 3 &&
    p.circles.every((c) => typeof c.center.x === "number" && typeof c.radius === "number") &&
    p.count === 8 && p.tangent.length === 8);
  check("the saved position records the signs of each solution",
    p.tangent.every((t) => t.signs.length === 3 && t.signs.every((x) => x === 1 || x === -1)));
  const before = JSON.stringify(s);
  C.position(C.movePoint(s, "C2", { x: 10, y: 10 }));
  check("computing a position never changes the state", JSON.stringify(s) === before);
}

done("apollonius");
