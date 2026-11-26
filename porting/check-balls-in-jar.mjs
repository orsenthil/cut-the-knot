#!/usr/bin/env node
"use strict";

/*
 * Logic test for balls-in-jar/balls-in-jar-core.js.
 *
 *   node porting/check-balls-in-jar.mjs
 *
 * The second half of this file is a second, literal transcription of the
 * applet's own computation, read from the bytecode:
 *
 *   BallsInJarCanvas.Compute / TangentToTwo / DownTangentToTwo /
 *     TangentToLineAndCircle / CheckCrossing / CheckCrossing2 / SetPercent /
 *     PushBFrom / init
 *   GeoSDoub.Intersect / IntersectCirclesX / IntersectCirclesY / IntersectX
 *
 * It keeps the applet's radical-axis formulas, its root ordering, its choice
 * of the "upper" intersection and its two repair rules. It is compared with
 * the core over the whole scroll-bar range (0..105) at every percent, over 21
 * positions of bottle B each, and over 500 seeded random configurations.
 *
 * The page's claims are then tested: the top row K, L, M being "always
 * perfectly horizontal", the article's correction that at least one of the
 * pairs K,L or L,M is horizontal, and the invariant that G sits on the rack's
 * vertical axis. The first two turn out to be false at the smallest radius,
 * so the test records the exact counterexamples and its math section says so.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("balls-in-jar/balls-in-jar-core.js", "BallsInJarCore");
const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol = 1e-6) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

/* ------------------------------------------------------------------------- */
/* The applet's own methods, transcribed a second time from the bytecode.     */
/* ------------------------------------------------------------------------- */

const circ = (p, r) => ({ x: p.x, y: p.y, r: r });

/** GeoSDoub.Intersect(DoubCircle, DoubCircle), including its root ordering. */
function geoCircles(a, b) {
  if (Math.abs(a.x - b.x) > 1) {
    // IntersectCirclesX: x = m*y + aa; the + square root is element 0.
    const m = -(a.y - b.y) / (a.x - b.x);
    const aa = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y - a.r * a.r + b.r * b.r) / (2 * (a.x - b.x));
    const q = m * m + 1;
    const bb = m * (aa - a.x) - a.y;
    const cc = (aa - a.x) * (aa - a.x) + a.y * a.y - a.r * a.r;
    const disc = bb * bb - q * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y0 = (-bb + s) / q, y1 = (-bb - s) / q;
    return [{ x: m * y0 + aa, y: y0 }, { x: m * y1 + aa, y: y1 }];
  }
  if (Math.abs(a.y - b.y) > 1) {
    // IntersectCirclesY: y = m*x + aa; the + square root is element 0.
    const m = -(a.x - b.x) / (a.y - b.y);
    const aa = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x - a.r * a.r + b.r * b.r) / (2 * (a.y - b.y));
    const q = m * m + 1;
    const bb = m * (aa - a.y) - a.x;
    const cc = (aa - a.y) * (aa - a.y) + a.x * a.x - a.r * a.r;
    const disc = bb * bb - q * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x0 = (-bb + s) / q, x1 = (-bb - s) / q;
    return [{ x: x0, y: m * x0 + aa }, { x: x1, y: m * x1 + aa }];
  }
  // GeoSDoub.Intersect returns two copies of the first centre here.
  return [{ x: a.x, y: a.y }, { x: a.x, y: a.y }];
}

/** GeoSDoub.Intersect(DoubCircle, DoubLine) for the vertical lines used here. */
function geoLineCircle(x, c) {
  // IntersectX: x = m*y + aa with m = 0 and aa = x for a vertical line.
  const m = 0, aa = x;
  const q = m * m + 1;
  const bb = m * (aa - c.x) - c.y;
  const cc = (aa - c.x) * (aa - c.x) + c.y * c.y - c.r * c.r;
  const disc = bb * bb - q * cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y0 = (-bb + s) / q, y1 = (-bb - s) / q;
  return [{ x: m * y0 + aa, y: y0 }, { x: m * y1 + aa, y: y1 }];
}

/** BallsInJarCanvas.TangentToTwo / DownTangentToTwo. */
function appletTangentTwo(r, c1, c2, down) {
  const e1 = circ(c1, 2 * r), e2 = circ(c2, 2 * r);
  const ps = geoCircles(e1, e2);
  if (!ps) return null;
  const useFirst = down ? ps[0].y > e1.y : ps[0].y < e1.y;
  return circ(useFirst ? ps[0] : ps[1], r);
}

/** BallsInJarCanvas.TangentToLineAndCircle: side of the rack at x. */
function appletTangentWall(r, x, c) {
  const expanded = circ(c, 2 * r);
  const ps = geoLineCircle(x, expanded);
  if (!ps) return null;
  return circ(ps[0].y < expanded.y ? ps[0] : ps[1], r);
}

/** BallsInJarCanvas.CheckCrossing / CheckCrossing2. */
function appletCross(r, c1, c2, c3) {
  return geoCircles(circ(c1, r), circ(c2, r)) ? appletTangentTwo(r, c2, c3, false) : c1;
}
function appletCross2(r, c1, c2) {
  if (geoCircles(circ(c1, r), circ(c2, r))) c1.y = c2.y - 2 * r;
  return c1;
}

/** BallsInJarCanvas.Compute, including its silent catch on a bad geometry. */
function appletStack(state) {
  try {
    const r = state.r;
    const cA = circ(state.A, r), cB = circ(state.B, r), cC = circ(state.C, r);
    let cD = appletTangentTwo(r, cA, cB, false);
    if (!cD) return null; // the applet would throw and keep the old drawing
    let cE = appletTangentTwo(r, cB, cC, false);
    if (!cE) return null;
    let cF = appletTangentWall(r, C.P1.x + r, cD);
    if (!cF) return null;
    cF = appletCross(r, cF, cA, cD);
    if (!cF) return null;
    let cG = appletTangentTwo(r, cD, cE, false);
    if (!cG) return null;
    cG = cG.x > state.B.x ? appletCross(r, cG, cB, cE) : appletCross(r, cG, cB, cD);
    if (!cG) return null;
    let cH = appletTangentWall(r, C.P2.x - r, cE);
    if (!cH) return null;
    cH = appletCross2(r, cH, cC);
    const cI = appletTangentTwo(r, cF, cG, false);
    const cJ = appletTangentTwo(r, cG, cH, false);
    if (!cI || !cJ) return null;
    let cK = appletTangentWall(r, C.P1.x + r, cI);
    if (!cK) return null;
    cK = appletCross(r, cK, cF, cI);
    if (!cK) return null;
    const cL = appletTangentTwo(r, cI, cJ, false);
    if (!cL) return null;
    let cM = appletTangentWall(r, C.P2.x - r, cJ);
    if (!cM) return null;
    cM = appletCross(r, cM, cH, cJ);
    if (!cM) return null;
    const dKL = Math.abs(cK.y - cL.y), dML = Math.abs(cM.y - cL.y);
    return {
      circles: { A: cA, B: cB, C: cC, D: cD, E: cE, F: cF, G: cG, H: cH, I: cI, J: cJ, K: cK, L: cL, M: cM },
      hints: { IL: appletTangentTwo(r, cI, cL, true), JL: appletTangentTwo(r, cJ, cL, true) },
      dKL: dKL, dML: dML,
      showIL: dML > dKL + 1, showJL: dKL > dML + 1,
      showAll: dML <= dKL + 1 && dKL <= dML + 1,
    };
  } catch (e) {
    return null;
  }
}

function sameFigure(a, b, tol = 1e-5) {
  if (!a || !b) return !a && !b;
  for (const n of NAMES) {
    if (!closePoint(a.circles[n], b.circles[n], tol)) return false;
  }
  for (const n of ["IL", "JL"]) {
    if (!closePoint(a.hints[n], b.hints[n], tol)) return false;
  }
  return a.showIL === b.showIL && a.showJL === b.showJL && a.showAll === b.showAll &&
    close(a.dKL, b.dKL, tol) && close(a.dML, b.dML, tol);
}

/* ----------------------------------------------------- 1. start and options */

{
  equal("rack P1 matches the applet's W/4, 0.9H", C.P1, { x: 100, y: 270 });
  equal("rack P2 matches the applet's W-W/4, 0.9H", C.P2, { x: 300, y: 270 });
  equal("scroll bar minimum is 0", C.PERCENT_MIN, 0);
  equal("scroll bar maximum is 105", C.PERCENT_MAX, 105);
  check("smallest radius is width/8 + 0.05", close(C.radius(0), 25.05));
  check("radius at 50 is the midpoint of the range", close(C.radius(50), (25.05 + 100 / 3) / 2));
  check("largest radius is width/6", close(C.radius(100), 100 / 3));
  check("radius at 105 is a little past width/6", close(C.radius(105),
    C.radius(100) + 0.05 * (C.radius(100) - C.radius(0)), 1e-9));
  const s = C.start();
  equal("start percent is 50", s.percent, 50);
  equal("start A matches the applet's GetPoint/P1+r", s.A, { x: 100 + C.radius(50), y: 270 - C.radius(50) });
  equal("start C matches the applet's P2-r", s.C, { x: 300 - C.radius(50), y: 270 - C.radius(50) });
  check("start B is midway plus r/6", close(s.B.x, 200 + C.radius(50) / 6));
  check("all three bottom centres are on one line", s.A.y === s.B.y && s.B.y === s.C.y);
  check("bottom bottles are at least 2r apart", s.B.x - s.A.x >= 2 * s.r - 1e-12 && s.C.x - s.B.x >= 2 * s.r - 1e-12);
  check("withPercent leaves the old position alone", (() => {
    const next = C.withPercent(s, 0);
    return s.percent === 50 && s.r === C.radius(50) && next.percent === 0 && next.r === C.radius(0);
  })());
  check("withB leaves the old position alone", (() => {
    const next = C.withB(s, s.A.x + 1);
    return s.B.x !== next.B.x && next.B.x === s.A.x + 2 * s.r;
  })());
  check("B pushed from both sides stays inside the rack", (() => {
    const left = C.withB(s, 0), right = C.withB(s, 400);
    return left.B.x - left.A.x >= 2 * left.r - 1e-9 && right.C.x - right.B.x >= 2 * right.r - 1e-9;
  })());
  check("percentOfRadius inverts radius over the scroll bar", (() => {
    for (let p = 0; p <= 105; p += 5) if (!close(C.percentOfRadius(C.radius(p)), p, 1e-9)) return false;
    return true;
  })());
}

/* --------------------------- 2. the core against the applet, exhaustively */

{
  let compared = 0;
  let worst = 0;
  for (let p = C.PERCENT_MIN; p <= C.PERCENT_MAX; p++) {
    const state = C.bottom(p, undefined);
    let ok = true;
    let firstBadHere = "";
    for (let k = 0; k <= 20; k++) {
      const bX = state.A.x + 2 * state.r + ((state.C.x - 2 * state.r) - (state.A.x + 2 * state.r)) * k / 20;
      const coreState = C.bottom(p, bX);
      const a = appletStack(coreState), b = C.stack(coreState);
      compared++;
      if (!sameFigure(a, b)) {
        ok = false;
        if (!firstBadHere) firstBadHere = `B x ${bX.toFixed(4)}`;
      }
      if (a && b) for (const n of NAMES) {
        worst = Math.max(worst, Math.abs(a.circles[n].x - b.circles[n].x), Math.abs(a.circles[n].y - b.circles[n].y));
      }
    }
    check(`percent ${p}: all 21 positions match the applet's Compute`, ok, firstBadHere);
  }
  check(`core matches the applet on ${compared} configurations`, compared === 106 * 21);
  check(`largest centre difference is below 1e-9 (${worst.toExponential(2)})`, worst < 1e-9);
}

/* -------------------------------------- 3. random B positions and sizes */

{
  const rand = rng(2482);
  let compared = 0, bad = 0;
  for (let trial = 0; trial < 500; trial++) {
    const p = rand() * 105;
    const state = C.bottom(p, -200 + rand() * 800); // includes out-of-range B
    const a = appletStack(state), b = C.stack(state);
    compared++;
    if (!sameFigure(a, b)) {
      bad++;
      if (bad === 1) check(`random ${trial} matches the applet`, false, `percent ${p}, B ${state.B.x}`);
    }
  }
  check(`core matches the applet on ${compared} random configurations`, bad === 0);
}

/* ------------------------------------------- 4. the claims on the article */

{
  let allLevel = 0, notAllLevel = 0, pairLevel = 0, noPairLevel = 0;
  let maxBestGap = 0, worst = null, gOff = 0, examples = 0;
  for (let p = 0; p <= 105; p += 1) {
    const s = C.bottom(p, undefined);
    const lo = s.A.x + 2 * s.r, hi = s.C.x - 2 * s.r;
    for (let k = 0; k <= 20; k++) {
      const f = C.stack(C.bottom(p, lo + (hi - lo) * k / 20));
      if (!f) continue;
      if (f.showAll) allLevel++; else { notAllLevel++; if (examples < 5) examples++; }
      const best = Math.min(f.dKL, f.dML);
      if (best < 1e-7) pairLevel++; else noPairLevel++;
      if (best > maxBestGap) { maxBestGap = best; worst = { p, k, dKL: f.dKL, dML: f.dML }; }
      if (Math.abs(f.circles.G.x - (C.P1.x + C.P2.x) / 2) > 1e-9) gOff++;
    }
  }
  check("the applet draws all thirteen bottles", Object.keys(C.stack(C.start()).circles).length === 13);
  check("every bottle has the common radius", (() => {
    const f = C.stack(C.start());
    return NAMES.every((n) => close(f.circles[n].r, C.start().r));
  })());
  check("G sits on the rack's vertical axis in every configuration", gOff === 0);
  check(`all three top bottles are level in ${allLevel} of ${allLevel + notAllLevel} configurations`, allLevel > 2000);
  check("the page's 'always perfectly horizontal' claim is false in the applet", notAllLevel > 0);
  check(`at least one pair is exactly level in ${pairLevel} configurations`, pairLevel > 2000);
  check("the page's 'either pair is horizontal' claim is also false at the smallest radius", noPairLevel > 0);
  check(`the best pair is never off by more than ${maxBestGap.toFixed(4)} units`, maxBestGap < 6.65,
    JSON.stringify(worst));
  check("the worst case is the smallest radius with B hard against A", worst.p === 0 && worst.k === 0);

  const corner = C.bottom(0, C.bottom(0, 0).A.x + 2 * C.radius(0));
  const f = C.stack(corner);
  check("at percent 0 with B against A neither pair is level", f.dKL > 1 && f.dML > f.dKL);
  check("the applet then flags K and L as the closer pair", f.dML > f.dKL + 1 && f.showIL && !f.showJL);
  const mirrored = C.bottom(0, C.bottom(0, 400).C.x - 2 * C.radius(0));
  const g = C.stack(mirrored);
  check("pushing B against C instead flags L and M", g.dKL > g.dML + 1 && g.showJL && !g.showIL);
  check("hint circles lie below their pairs", (() => {
    const fig = C.stack(C.start());
    return fig.hints.IL.y > fig.circles.I.y && fig.hints.IL.y > fig.circles.L.y &&
      fig.hints.JL.y > fig.circles.J.y && fig.hints.JL.y > fig.circles.L.y;
  })());
}

/* ------------------------- 5. tangencies and the repair rules of the applet */

{
  const s = C.start();
  const f = C.stack(s);
  const pairs = [["D", "A", "B"], ["E", "B", "C"], ["G", "D", "E"], ["I", "F", "G"],
    ["J", "G", "H"], ["L", "I", "J"]];
  for (const [newName, p1, p2] of pairs) {
    check(`${newName} touches ${p1} and ${p2}`, close(dist(f.circles[newName], f.circles[p1]), 2 * s.r, 1e-9) &&
      close(dist(f.circles[newName], f.circles[p2]), 2 * s.r, 1e-9));
  }
  check("F and K touch the left wall", close(f.circles.F.x, C.P1.x + s.r, 1e-9) &&
    close(f.circles.K.x, C.P1.x + s.r, 1e-9));
  check("H and M touch the right wall", close(f.circles.H.x, C.P2.x - s.r, 1e-9) &&
    close(f.circles.M.x, C.P2.x - s.r, 1e-9));
  check("the top row is level in the symmetric start", f.showAll && f.dKL < 1e-8 && f.dML < 1e-8);

  // The applet's draggable A/C use ChangeRadius: 6d < width and 8d > width.
  const changeRadius = (r) => 6 * r < C.P2.x - C.P1.x && 8 * r > C.P2.x - C.P1.x;
  check("dragging a side accepts the middle of the range", changeRadius(C.radius(50)));
  check("dragging a side accepts the smallest radius (the 0.05 margin)", changeRadius(C.radius(0)));
  check("dragging a side refuses the largest radius", !changeRadius(C.radius(100)));
  check("the slider still reaches past the draggable range", C.PERCENT_MAX > 100 && !changeRadius(C.radius(105)));

  // Reflection symmetry holds in the middle; the H repair breaks it at the bottom.
  const sym = (p) => {
    const s0 = C.bottom(p, undefined);
    const lo = s0.A.x + 2 * s0.r, hi = s0.C.x - 2 * s0.r;
    let worstDiff = 0;
    for (let k = 0; k <= 20; k++) {
      const a = C.stack(C.bottom(p, lo + (hi - lo) * k / 20));
      const b = C.stack(C.bottom(p, hi - (hi - lo) * k / 20));
      worstDiff = Math.max(worstDiff, Math.abs(a.dKL - b.dML), Math.abs(a.dML - b.dKL));
    }
    return worstDiff;
  };
  check("the middle range is mirror symmetric", sym(50) < 1e-7);
  check("the smallest radius is not, because only H is lifted onto C", sym(0) > 5);
  check("report names the level top row in the start position", /level/.test(C.report(C.stack(C.start()))));
  check("report names a pair when the top row tilts", /nearly level pair|nearly/.test(
    C.report(C.stack(C.bottom(0, C.bottom(0, 400).C.x - 2 * C.radius(0))))));
}

done("balls-in-jar");
