#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid-i43-extended/euclid-i43-extended-core.js.
 *
 *   node porting/check-euclid-i43-extended.mjs
 *
 * The applet has no game to win: it draws a parallelogram ABCD, an interior
 * point X, the two off-diagonal pieces XNCP and AMXQ, and a construction that
 * makes a third piece ASRQ. Its page claims (1) Area(ASRQ) = Area(XNCP) both
 * below and above the diagonal BD, (2) below BD, XNCP is larger than AMXQ and
 * MSRX is exactly the difference, (3) with "areas on the same side of BD"
 * ticked, two orange pieces are equal, and (4) the intersection of RS and UV
 * lies on AX. This test verifies all four over a grid of parallelograms and
 * point positions plus random ones, and checks the core against a second,
 * literal transcription of Compute(), GetParallelTo, Intersect, FindOrientation
 * and Polygon.contains from the applet's bytecode.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euclid-i43-extended/euclid-i43-extended-core.js", "EuclidI43ExtendedCore");
const pt = (x, y) => ({ x, y });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePoint = (a, b, eps = 1e-6) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const signedArea = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
};
const triArea = (p, q, r) => Math.abs(signedArea([p, q, r]));
const quadArea = (p, q, r, s) => Math.abs(signedArea([p, q, r, s]));
const onLine = (a, b, p, eps = 1e-5) =>
  Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) <=
    eps * Math.max(1, Math.abs(b.x - a.x) + Math.abs(b.y - a.y));

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(120, 240));
  equal("the opening B", s.B, pt(320, 240));
  equal("the opening C", s.C, pt(280, 80));
  equal("the opening D", s.D, pt(80, 80));
  check("A + C = B + D: the applet's two UpdateTwo pairs",
    near(s.A.x + s.C.x, s.B.x + s.D.x) && near(s.A.y + s.C.y, s.B.y + s.D.y));
  check("the top and bottom sides are horizontal", s.A.y === s.B.y && s.C.y === s.D.y);
  check("the opening X is the applet's (2A+B)/3, (2A+D)/3", samePoint(s.X, pt(186 + 2 / 3, 186 + 2 / 3)));
  check("the opening X is inside triangle ABD", C.compute(s).region === "ABD" && !C.compute(s).outOfBounds);
  check("names are shown by default, the other two boxes are not",
    s.showNames === true && s.sameSide === false && s.showProof === false);
  check("a demonstration has no result", C.result(s) === null);
  check("exploring marks the picture done for the player's record",
    C.setOption(s, "sameSide", true).explored === true && C.movePoint(s, "X", pt(200, 200)).explored === true);
  check("an unknown option is refused", C.setOption(s, "nope", true) === s);
  check("the status names ABD and the two areas",
    /inside triangle ABD/.test(C.describe(s)) && /Blue XNCP is 12800/.test(C.describe(s)) &&
    /Orange ASRQ is 12800/.test(C.describe(s)));
  check("the status names BCD after the second preset",
    /inside triangle BCD/.test(C.describe(C.setRegion(s, "BCD"))));
  check("the status names the diagonal case",
    /on diagonal BD/.test(C.describe(C.setRegion(s, "BD"))));
  check("the status asks for X back after it leaves the parallelogram",
    /outside the parallelogram/.test(C.describe(C.movePoint(s, "X", pt(15, 15)))));
  const bcd = C.setRegion(s, "BCD");
  check("X in BCD is above the diagonal", C.compute(bcd).region === "BCD" &&
    C.compute(bcd).xncp < C.compute(bcd).amxq);
  check("the two region presets keep the four corners",
    ["A", "B", "C", "D"].every((k) => samePoint(s[k], bcd[k])));
  check("reset restores the opening picture but keeps the boxes",
    (() => {
      const r = C.reset(C.setOption(C.movePoint(s, "B", pt(300, 220)), "showProof", true));
      return samePoint(r.A, s.A) && samePoint(r.X, s.X) && r.showProof === true && r.explored === false;
    })());
  check("a bad point name or a non-number is refused",
    C.movePoint(s, "Z", pt(1, 1)) === s && C.movePoint(s, "A", pt(NaN, 3)) === s &&
    C.movePoint(s, "A", null) === s);
  check("X is clamped to the board", samePoint(C.movePoint(s, "X", pt(-50, 999)).X, pt(C.MARGIN, C.HEIGHT - C.MARGIN)));
}

/* ------------------------- 2. a literal second transcription of the applet */

/* GeoSDoub.GetParallelTo(p,q,r) from its bytecode: p + 100*(r-q). */
function appletParallel(p, q, r) {
  return pt(p.x + 100.0 * (r.x - q.x), p.y + 100.0 * (r.y - q.y));
}

/* GeoSDoub.Intersect(p1,p2,p3,p4) from its bytecode, |d| < 1 -> NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y;
  const b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y;
  const b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (1.0 > Math.abs(d)) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* GeoSDoub.FindOrientation: 1 for cross > 0, -1 otherwise. */
function appletOrientation(p, q, r) {
  const cross = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return cross > 0 ? 1 : -1;
}

/* Canvas.Inside(): a 0.95 inset about the centre, integer-rounded corners,
   then java.awt.Polygon.contains's even-odd test. */
function appletInside(A, B, Cc, D, X) {
  const centre = pt(200, 160);
  const px = (p) => pt(Math.round((p.x - centre.x) * 0.95 + centre.x),
    Math.round((p.y - centre.y) * 0.95 + centre.y));
  const poly = [px(A), px(B), px(Cc), px(D)];
  const x = X.x, y = X.y;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/* Canvas.Compute() with helper calls spelled out, in the bytecode's order. */
function appletCompute(A, B, Cc, D, X) {
  if (!appletInside(A, B, Cc, D, X)) return { outOfBounds: true };
  const t1 = appletParallel(X, B, Cc);
  const M = appletIntersect(t1, X, A, B);
  const P = appletIntersect(t1, X, Cc, D);
  const t2 = appletParallel(X, A, B);
  const N = appletIntersect(t2, X, B, Cc);
  const Q = appletIntersect(t2, X, A, D);
  const Y = pt(B.x - (X.x - D.x), B.y - (X.y - D.y));
  const R = appletIntersect(D, Y, N, Q);
  const t3 = appletParallel(R, A, D);
  const S = appletIntersect(t3, R, A, B);
  const U = appletIntersect(B, Y, P, M);
  const t4 = appletParallel(U, A, B);
  const V = appletIntersect(t4, U, A, D);
  const T = appletIntersect(R, S, U, V);
  const W = appletIntersect(D, R, A, B);
  const t5 = appletParallel(W, B, Cc);
  const E = appletIntersect(t5, W, N, Q);
  const F = appletIntersect(t5, W, Cc, D);
  const K = appletIntersect(R, S, Cc, D);
  const amxq = quadArea(A, M, X, Q);
  const xncp = quadArea(X, N, Cc, P);
  return {
    outOfBounds: false, M, N, P, Q, Y, R, S, U, V, T, W, E, F, K,
    amxq, xncp,
    asrq: quadArea(A, S, R, Q),
    msrx: quadArea(M, S, R, X),
    orange1: quadArea(Q, X, U, V),
    orange2: quadArea(X, M, S, R),
    refk: quadArea(R, E, F, K),
    sameBranch: appletOrientation(A, B, D) === appletOrientation(X, B, D),
  };
}

/* Every shape in the test: an affine parallelogram centred at (200,160),
   with X at barycentric (alpha, beta). A fine grid covers both sides of BD. */
function makePosition(h, w, alpha, beta, options) {
  const A = pt(200 - h, 160 + h), B = pt(200 + w, 160 + h);
  const Cc = pt(200 + h, 160 - h), D = pt(200 - w, 160 - h);
  const X = pt(A.x + alpha * (B.x - A.x) + beta * (D.x - A.x),
    A.y + alpha * (B.y - A.y) + beta * (D.y - A.y));
  return { A, B, C: Cc, D, X, showNames: true, sameSide: false, showProof: false,
    explored: false, ...(options || {}) };
}

{
  let geomBad = 0, areaBad = 0, claimBad = 0, insideBad = 0, branchBad = 0;
  let cases = 0, below = 0, above = 0, onDiagonal = 0;
  const labels = ["M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "E", "F", "K", "Y"];
  const amounts = ["amxq", "xncp", "asrq", "msrx", "orange1", "orange2", "refk"];
  const positions = [];
  for (const h of [58, 70, 82]) {
    for (const w of [88, 105, 122]) {
      for (let ia = 1; ia <= 9; ia++) {
        for (let ib = 1; ib <= 9; ib++) positions.push(makePosition(h, w, ia / 10, ib / 10));
      }
    }
  }
  const rand = rng(43143);
  for (let i = 0; i < 1200; i++) {
    positions.push(makePosition(50 + rand() * 45, 80 + rand() * 60,
      0.08 + rand() * 0.84, 0.08 + rand() * 0.84));
  }
  positions.push(C.start({}), C.setRegion(C.start({}), "BCD"), C.setRegion(C.start({}), "BD"));

  for (const s of positions) {
    cases++;
    const g = C.compute(s);
    const a = appletCompute(s.A, s.B, s.C, s.D, s.X);
    if (g.outOfBounds !== a.outOfBounds) insideBad++;
    if (a.outOfBounds) continue;
    if (appletInside(s.A, s.B, s.C, s.D, s.X) !== C.insideCorners([s.A, s.B, s.C, s.D], s.X)) insideBad++;
    if (g.sameBranch !== a.sameBranch) branchBad++;
    for (const name of labels) {
      if (!samePoint(g[name], a[name])) geomBad++;
    }
    for (const name of amounts) {
      if (!near(g[name], a[name], 1e-7)) areaBad++;
    }
    /* The page's four claims, checked on this configuration. */
    if (!near(g.asrq, g.xncp) || !near(g.refk, g.xncp)) claimBad++;
    if (!near(g.msrx, Math.abs(g.diff)) ||
        !near(g.orange1, g.orange2) || !near(g.orange1, Math.abs(g.diff))) claimBad++;
    if (!onLine(s.A, s.X, g.T)) claimBad++;
    if (!samePoint(g.Y, pt(s.B.x + s.D.x - s.X.x, s.B.y + s.D.y - s.X.y))) claimBad++;
    /* Solve X = A + alpha(B-A) + beta(D-A); BD is alpha + beta = 1. */
    const beta = (s.X.y - s.A.y) / (s.D.y - s.A.y);
    const alpha = (s.X.x - s.A.x - beta * (s.D.x - s.A.x)) / (s.B.x - s.A.x);
    const sum = alpha + beta;
    if (sum < 1 - 1e-9) {
      below++;
      if (!(g.xncp > g.amxq)) claimBad++;   // page: below BD, blue is larger
    } else if (sum > 1 + 1e-9) {
      above++;
      if (!(g.xncp < g.amxq)) claimBad++;   // page: above BD, red is larger
    } else {
      onDiagonal++;
      if (!near(g.xncp, g.amxq)) claimBad++;
    }
  }
  check(`${cases} configurations agree with the applet's Compute on all 14 points`, geomBad === 0, `${geomBad} wrong`);
  check(`${cases} configurations agree on all 7 areas`, areaBad === 0, `${areaBad} wrong`);
  check("the applet's FindOrientation branch agrees in every configuration", branchBad === 0, `${branchBad} wrong`);
  check("the applet's Inside() and Polygon.contains agree with the core", insideBad === 0, `${insideBad} wrong`);
  check("the page's equal-area, gap and T-on-AX claims hold in every configuration", claimBad === 0, `${claimBad} wrong`);
  check("the grid covers both sides of BD and the diagonal itself",
    below > 300 && above > 300 && onDiagonal > 0, `${below}/${above}/${onDiagonal}`);

  /* Points outside the 0.95 inset must be reported as OutOfBounds, as the
     applet does, and then no auxiliary construction is drawn. */
  let outsideBad = 0;
  for (let i = 0; i < 400; i++) {
    const s = makePosition(60, 100, -0.4 + rand() * 1.8, -0.4 + rand() * 1.8);
    const core = C.compute(s);
    const app = appletCompute(s.A, s.B, s.C, s.D, s.X);
    if (core.outOfBounds !== app.outOfBounds) outsideBad++;
    if (core.outOfBounds && (core.M !== undefined || !/outside/.test(C.describe(s)))) outsideBad++;
  }
  check("400 points in and out follow the applet's OutOfBounds early return", outsideBad === 0, `${outsideBad} wrong`);
}

/* --------------------------- 3. dragging and the options */

{
  let bad = 0;
  const rand = rng(9091);
  const start = C.start({});
  for (let i = 0; i < 500; i++) {
    const s = C.randomize(start);
    for (const name of ["A", "B", "C", "D"]) {
      const m = C.movePoint(s, name, pt(rand() * 460 - 30, rand() * 400 - 40));
      if (m === s) continue; // an off-board or collapsed drag is refused
      const g = C.compute(m);
      if (!near(m.A.x + m.C.x, m.B.x + m.D.x) ||
          !near(m.A.y + m.C.y, m.B.y + m.D.y) ||
          !near(m.A.y, m.B.y) || !near(m.C.y, m.D.y) ||
          (!g.outOfBounds && !Number.isFinite(g.amxq)) ||
          [m.A, m.B, m.C, m.D].some((p) => p.x < C.MARGIN - 1e-9 ||
            p.x > C.WIDTH - C.MARGIN + 1e-9 || p.y < C.MARGIN - 1e-9 ||
            p.y > C.HEIGHT - C.MARGIN + 1e-9)) bad++;
    }
    const x = C.movePoint(s, "X", pt(rand() * 440 - 20, rand() * 360 - 20));
    if (x.X.x < C.MARGIN || x.X.x > C.WIDTH - C.MARGIN ||
        x.X.y < C.MARGIN || x.X.y > C.HEIGHT - C.MARGIN) bad++;
  }
  check("500 random diagrams: every accepted corner drag stays centred and horizontal", bad === 0, `${bad} wrong`);
  equal("a corner dragged off the board is clamped", C.movePoint(start, "A", pt(-99, 999)).A, pt(C.MARGIN, C.HEIGHT - C.MARGIN));
  const moved = C.movePoint(start, "A", pt(150, 220));
  check("the applet's UpdateTwo reflects C in the centre when A moves",
    samePoint(moved.C, pt(250, 100)) && moved.B.y === 220 && moved.D.y === 100);
  check("the applet's UpdateTwo reflects D in the centre when B moves",
    (() => {
      const m = C.movePoint(start, "B", pt(310, 210));
      return samePoint(m.D, pt(90, 110)) && m.A.y === 210 && m.C.y === 110;
    })());
  check("a drag collapsing the height is refused", C.movePoint(start, "A", pt(120, 150)) === start);
  for (const key of ["showNames", "sameSide", "showProof"]) {
    const s = C.setOption(C.setOption(start, key, true), key, false);
    check(`the ${key} box can be ticked and unticked`, s[key] === false && C.setOption(s, key, true)[key] === true);
  }
  check("the applet's three parameter boxes are the only ones accepted",
    Object.keys(C.setOption(start, "showProof", true)).length ===
      Object.keys(start).length);
  check("randomize keeps the boxes and puts X inside", (() => {
    const s = C.setOption(start, "sameSide", true);
    for (let i = 0; i < 100; i++) {
      const r = C.randomize(s);
      if (!r.sameSide || C.compute(r).outOfBounds) return false;
    }
    return true;
  })());
}

done("euclid-i43-extended");
