#!/usr/bin/env node
"use strict";

/*
 * Logic test for any-quadri/any-quadri-core.js.
 *
 *   node porting/check-any-quadri.mjs
 *
 * Checks the applet's Reset() quadrilateral (decoded from the bytecode), the
 * four corner moves and the Hint option, and then the page's exact claim over
 * fixed quadrilaterals and thousands of random ones:
 *
 *   the segments EF (diagonal midpoints), KM and LN (opposite-side midpoints)
 *   are concurrent, and each is bisected at the common point (ratio 1:1);
 *   the common point is the barycenter of four equal corner weights; ENFL and
 *   EKFM are parallelograms.
 *
 * The whole drawing is then transcribed a second time, literally from the
 * applet's MidPoint()/Draw()/Reset() bytecode, and compared with the core over
 * every fixed case and a thousand random quadrilaterals.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("any-quadri/any-quadri-core.js", "AnyQuadriCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const scaleOf = (a, b, c, d) => Math.max(1,
  dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));
function distToLine(p, a, b) {
  const n = dist(a, b);
  return n > 0 ? Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / n : dist(p, a);
}

/* ----------------------------------------- the applet's arithmetic, bytecode */

/* DoubPoint DoubPoint.MidPoint(DoubPoint, DoubPoint):
 *   new DoubPoint((p.x + q.x)/2.0, (p.y + q.y)/2.0)  — no clamping, no tricks. */
function appletMidPoint(p, q) {
  return P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
}

/* AnyQuadriCanvas.Reset(): A = new MoveablePoint[4]; with W,H and the four
 * local constants 4=40, 5=60, 7=30, 8=30 from the bytecode.  Note the quirk
 * in A[3].y: it uses H, not H/2 (there is no idiv before the imul). */
function appletReset(W = 400, H = 300) {
  const c4 = 40, c5 = 60, c7 = 30, c8 = 30;
  return [
    P(W / 2 - 4 * c4 + c7, H / 2 - c5 + c8),
    P(W / 2 + c7, H / 2 - 2 * c4 - c5 + c8),
    P(W / 2 + 2 * c4 + c7, H / 2 + 2 * c4 - c5 + c8),
    P(W / 2 + c7 + 25, H - 2 * c5 + c8),
  ];
}

/* AnyQuadriCanvas.Draw(): the six midpoints in their local slots L2..L7,
 * then the lines it actually draws. */
function appletDraw(A, B, Cc, D, hint) {
  const m01 = appletMidPoint(A, B);  // L2: midpoint of side AB  (K)
  const m12 = appletMidPoint(B, Cc); // L3: midpoint of side BC  (L)
  const m23 = appletMidPoint(Cc, D); // L4: midpoint of side CD  (M)
  const m30 = appletMidPoint(D, A);  // L5: midpoint of side DA  (N)
  const m02 = appletMidPoint(A, Cc); // L6: midpoint of diag AC  (F)
  const m13 = appletMidPoint(B, D);  // L7: midpoint of diag BD  (E)
  const lines = {
    diag1: [A, Cc], diag2: [B, D],       // lightGray
    bimedian1: [m01, m23], bimedian2: [m12, m30], // red: KM and LN
    newton: [m02, m13],                  // blue: EF
  };
  if (hint) {
    lines.green1 = [m30, m13]; // L5-L7 = N-E
    lines.green2 = [m12, m02]; // L3-L6 = L-F
    lines.orange = [m30, m12]; // L5-L3 = N-L (the diagonal of ENFL)
  }
  return { mid: { K: m01, L: m12, M: m23, N: m30, F: m02, E: m13 }, lines };
}

/* An independent, direct check of the page's claim — not using the core. */
function pageClaim(A, B, Cc, D) {
  const K = mid(A, B), L = mid(B, Cc), M = mid(Cc, D), N = mid(D, A);
  const E = mid(B, D), F = mid(A, Cc);
  const G = P((A.x + B.x + Cc.x + D.x) / 4, (A.y + B.y + Cc.y + D.y) / 4);
  const kmMid = mid(K, M), lnMid = mid(L, N), efMid = mid(E, F);
  const tol = 1e-8 * scaleOf(A, B, Cc, D);
  const eq = (p, q) => dist(p, q) <= tol;
  const ratio = (p, q) =>
    close(dist(p, G), dist(G, q), tol) && distToLine(G, p, q) <= tol;
  return {
    concurrent: eq(kmMid, lnMid) && eq(lnMid, efMid) && eq(efMid, kmMid),
    bisected: eq(kmMid, G) && eq(lnMid, G) && eq(efMid, G),
    ratio1to1: ratio(K, M) && ratio(L, N) && ratio(E, F),
    enfl: eq(sub(N, E), sub(F, L)) && eq(sub(F, N), sub(L, E)),
    ekfm: eq(sub(K, E), sub(F, M)) && eq(sub(F, K), sub(M, E)),
    barycenter: eq(G, P((A.x + B.x + Cc.x + D.x) / 4, (A.y + B.y + Cc.y + D.y) / 4)),
  };
}

/* -------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  const reset = appletReset();
  equal("Reset puts corner A at the applet's (70,120)", s.A, reset[0]);
  equal("Reset puts corner B at the applet's (230,40)", s.B, reset[1]);
  equal("Reset puts corner C at the applet's (310,200)", s.C, reset[2]);
  equal("Reset puts corner D at the applet's (255,210)", s.D, reset[3]);
  check("Hint starts unchecked", !s.options.hint);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const g = C.geometry(s);
  check("the start quadrilateral has a construction", !!g);
  check("the start diagram satisfies the page's claim", pageClaim(s.A, s.B, s.C, s.D).concurrent);
}

{
  const s = C.start();
  const moved = C.move(s, "C", P(10, 10));
  check("moving a corner leaves the old position alone", s.C.x === 310 && moved.C.x === C.PAD);
  check("moving a corner marks it explored", moved.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const far = C.move(s, "B", P(9999, -9999));
  check("corners are clamped inside the board",
    far.B.x === C.VIEW.width - C.PAD && far.B.y === C.PAD);
  const h = C.setOption(s, "hint", true);
  check("Hint toggles on and marks it explored", h.options.hint && h.explored && !s.options.hint);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(h);
  check("Reset restores the four corners", r.A.x === 70 && r.D.y === 210);
  check("Reset keeps the Hint box", r.options.hint && r.explored);
  check("status tells the player the lines meet at one dot", /meet at one dot/.test(C.describe(s)));
  check("with Hint on the status mentions the parallelogram",
    /parallelogram/.test(C.describe(C.setOption(s, "hint", true))));
}

/* ---------------------------- 2. fixed quadrilaterals and the page's claim */

const square = [P(80, 80), P(320, 80), P(320, 320), P(80, 320)];
const rectangle = [P(60, 110), P(340, 110), P(340, 250), P(60, 250)];
const tilted = [P(70, 180), P(250, 250), P(340, 110), P(140, 60)];
const bowtie = [P(80, 80), P(320, 240), P(80, 240), P(320, 80)]; // self-intersecting
const dart = [P(90, 90), P(320, 150), P(200, 160), P(90, 260)];  // non-convex
const startQ = appletReset();
const fixed = [
  ["the applet's start", startQ],
  ["a square", square],
  ["a rectangle", rectangle],
  ["a tilted quadrilateral", tilted],
  ["a bow-tie quadrilateral", bowtie],
  ["a dart quadrilateral", dart],
];

for (const [name, q] of fixed) {
  const [a, b, c, d] = q;
  const g = C.compute(a, b, c, d);
  const claim = pageClaim(a, b, c, d);
  const tol = 1e-8 * scaleOf(a, b, c, d);
  check(`${name}: the core builds a construction`, !!g);
  if (!g) continue;
  check(`${name}: the core's three midpoints meet at one point`, g.claims.concurrent,
    `error ${g.measures.concurrencyError}`);
  check(`${name}: each of the three lines is bisected`,
    g.claims.kmBisected && g.claims.lnBisected && g.claims.efBisected);
  check(`${name}: the common point is the barycenter`, g.claims.barycenter);
  check(`${name}: ENFL and EKFM are parallelograms`,
    g.claims.parallelogramENFL && g.claims.parallelogramEKFM);
  check(`${name}: the page's claim holds independently`,
    claim.concurrent && claim.bisected && claim.ratio1to1 && claim.enfl && claim.ekfm && claim.barycenter);
  check(`${name}: the core agrees with the independent claim`,
    g.claims.concurrent === claim.concurrent && g.claims.barycenter === claim.barycenter);
  check(`${name}: G is exactly the mean of the corners`,
    closePoint(g.G, P((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4), tol));
}

/* ----------------------------------- 3. thousands of generated quadrilaterals */

{
  const rand = rng(4821);
  let tested = 0, claimFailures = 0, coreFailures = 0;
  for (let trial = 0; trial < 3000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 360, 20 + rand() * 260));
    if (scaleOf(...q) < 30) continue;
    const g = C.compute(...q);
    const claim = pageClaim(...q);
    if (!g || !claim.concurrent || !claim.bisected || !claim.ratio1to1
      || !claim.enfl || !claim.ekfm || !claim.barycenter) {
      claimFailures++;
      check(`random ${trial}: the page's claim holds`, false, JSON.stringify(claim));
      continue;
    }
    tested++;
    if (!(g.claims.concurrent && g.claims.kmBisected && g.claims.lnBisected
      && g.claims.efBisected && g.claims.parallelogramENFL
      && g.claims.parallelogramEKFM && g.claims.barycenter)) {
      coreFailures++;
      check(`random ${trial}: the core agrees with the claim`, false, JSON.stringify(g.claims));
    }
  }
  check(`the page's claim holds on ${tested} random quadrilaterals`,
    tested > 2500 && claimFailures === 0);
  check(`the core agrees on all ${tested} random quadrilaterals`, coreFailures === 0);
  // The statement is affine, so it must survive a scale and a translation.
  const t = (p) => P(2 * p.x + 17, 2 * p.y - 9);
  const movedQ = tilted.map(t);
  const movedClaim = pageClaim(...movedQ);
  const movedG = C.compute(...movedQ).G;
  check("the claim survives a scale and a translation",
    movedClaim.concurrent && movedClaim.bisected && movedClaim.ratio1to1
      && closePoint(movedG, t(C.compute(...tilted).G), 1e-8));
}

/* --------------- 4. the same points from the applet's own (bytecode) method */

{
  const rand = rng(1994);
  let compared = 0, mismatches = 0;
  const compare = (label, q, hint) => {
    const [a, b, c, d] = q;
    const g = C.compute(a, b, c, d);
    const ap = appletDraw(a, b, c, d, hint);
    if (!g) return;
    const tol = 1e-9 * scaleOf(a, b, c, d);
    for (const key of ["K", "L", "M", "N", "E", "F"]) {
      if (!closePoint(g[key], ap.mid[key], tol)) {
        mismatches++;
        check(`${label}: core ${key} is the applet's MidPoint`, false,
          `applet ${JSON.stringify(ap.mid[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    const linePairs = [
      ["diag AC", g.A, g.C, ap.lines.diag1],
      ["diag BD", g.B, g.D, ap.lines.diag2],
      ["bimedian KM", g.K, g.M, ap.lines.bimedian1],
      ["bimedian LN", g.L, g.N, ap.lines.bimedian2],
      // Draw() joins its L6 (mid AC = F) to L7 (mid BD = E), in that order.
      ["Newton EF", g.F, g.E, ap.lines.newton],
    ];
    if (hint) {
      linePairs.push(
        ["hint N-E", g.hintLines[0][0], g.hintLines[0][1], ap.lines.green1],
        ["hint L-F", g.hintLines[1][0], g.hintLines[1][1], ap.lines.green2],
        ["hint N-L", g.hintLines[2][0], g.hintLines[2][1], ap.lines.orange],
      );
    }
    for (const [what, p, q1, apLine] of linePairs) {
      if (!closePoint(p, apLine[0], tol) || !closePoint(q1, apLine[1], tol)) {
        mismatches++;
        check(`${label}: core draws the same ${what}`, false);
      }
    }
    compared++;
  };
  for (const [name, q] of fixed) compare(name, q, false);
  compare("start with Hint", startQ, true);
  for (let trial = 0; trial < 1200; trial++) {
    const q = [0, 1, 2, 3].map(() => P(25 + rand() * 350, 25 + rand() * 250));
    compare(`random ${trial}`, q, trial % 2 === 0);
  }
  check(`core and applet agree on ${compared} quadrilaterals`, compared > 1000 && mismatches === 0);

  // The applet's drawn midpoints satisfy the claim too (no core involved).
  const ap = appletDraw(square[0], square[1], square[2], square[3], false);
  const G = P((square[0].x + square[1].x + square[2].x + square[3].x) / 4,
    (square[0].y + square[1].y + square[2].y + square[3].y) / 4);
  check("the applet's own bimedian midpoints are the square's centre",
    closePoint(mid(ap.mid.K, ap.mid.M), G, 1e-9)
      && closePoint(mid(ap.mid.L, ap.mid.N), G, 1e-9)
      && closePoint(mid(ap.mid.E, ap.mid.F), G, 1e-9));
  check("the applet's hint lines N-E and L-F are equal and parallel",
    closePoint(sub(ap.mid.N, ap.mid.E), sub(ap.mid.F, ap.mid.L), 1e-9));
  check("the applet's Reset quirk in A[3].y is reproduced",
    appletReset(400, 300)[3].y === 210 && C.start().D.y === 210);
}

/* ----------------------------------------------- 5. degenerate input is safe */

{
  const flat = [P(10, 10), P(50, 10), P(90, 10), P(130, 10)];
  check("four distinct corners still give a construction on a line", !!C.compute(...flat));
  check("a repeated corner gives no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  check("a non-finite corner gives no construction",
    C.compute(P(NaN, 10), P(50, 10), P(90, 20), P(40, 80)) === null);
  const degenerateState = C.move(C.start(), "A", P(230, 40));
  check("a degenerate position has a helpful status",
    /quadrilateral/.test(C.describe(degenerateState)));
  check("a degenerate position still has no result", C.result(degenerateState) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("any-quadri");
