#!/usr/bin/env node
"use strict";

/*
 * Logic test for bad-limit/bad-limit-core.js.
 *
 *   node porting/check-bad-limit.mjs
 *
 * The option space is tiny (n = 1..105), so every value is checked, not a
 * sample. Sections:
 *   1. the start position, option range and end-of-demo marker;
 *   2. the geometry (big square and its midpoint square);
 *   3. every claim the cut-the-knot page makes, checked honestly:
 *        - s = S/2            -> FALSE; the midpoint square gives s = S/sqrt(2)
 *        - s_n = S for n > 0  -> true, for every n from 1 to 105
 *        - lim s_n = S != s   -> true
 *        - the curves converge to the diamond while their lengths do not;
 *   4. a second, literal transcription of BadLimitCanvas.Reset/CollectPoints
 *      compared point-for-point with the core for all 105 values of n.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("bad-limit/bad-limit-core.js", "BadLimitCore");
const TOL = 1e-8;

function near(label, actual, expected, tol = TOL) {
  check(label, Math.abs(actual - expected) <= tol, `expected ${expected}, got ${actual}`);
}

/* ------------------------------------------------ 1. start, options, result */

{
  equal("default N is the applet's 5", C.start({}).n, 5);
  equal("default canvas is 400x300", [C.start({}).width, C.start({}).height], [400, 300]);
  equal("N below the range clamps to 1", C.start({ n: 0 }).n, 1);
  equal("N above the range clamps to 105", C.start({ n: 1000 }).n, 105);
  equal("a non-number N falls back to the default", C.start({ n: "abc" }).n, 5);
  equal("a valid N is kept", C.withN(C.start({}), 37).n, 37);
  equal("withN also clamps", C.withN(C.start({}), -4).n, 1);
  equal("a demo has no win: it ends as done", C.result(C.start({})), "done");
  check("no position means no result yet", C.result(null) === null);

  for (const n of [1, 2, 5, 50, 104, 105]) {
    const s = C.start({ n });
    check(`N=${n} stays in range`, s.n >= C.MIN_N && s.n <= C.MAX_N);
  }
}

/* --------------------------------------------- 2. geometry of the two squares */

{
  const s = C.start({ width: 400, height: 300 });
  const g = C.geometry(s);
  near("r = min(400-40, 300-40)/2 = 130", g.r, 130);
  equal("centre of the canvas", [g.cx, g.cy], [200, 150]);

  const big = C.bigSquare(s);
  const small = C.smallSquare(s);
  equal("four corners on the big square", big.length, 4);
  equal("four vertices on the small square", small.length, 4);
  // The applet's Rhomb[0..3] are exactly these coordinates.
  equal("Rhomb[0] = (cx, cy-r)", small[0], { x: 200, y: 20 });
  equal("Rhomb[1] = (cx-r, cy)", small[1], { x: 70, y: 150 });
  equal("Rhomb[2] = (cx, cy+r)", small[2], { x: 200, y: 280 });
  equal("Rhomb[3] = (cx+r, cy)", small[3], { x: 330, y: 150 });

  for (let i = 0; i < 4; i++) {
    const a = big[i];
    const b = big[(i + 3) % 4];
    near(`small vertex ${i} is the midpoint of a big side (x)`, small[i].x, (a.x + b.x) / 2);
    near(`small vertex ${i} is the midpoint of a big side (y)`, small[i].y, (a.y + b.y) / 2);
  }
}

/* ------------------------------------- 3. every page claim, over the whole range */

{
  const s0 = C.start({ width: 400, height: 300 });
  const r = C.geometry(s0).r;
  const S = C.bigPerimeter(s0);
  const s = C.smallPerimeter(s0);

  near("S = 8r", S, 8 * r);
  near("the small square really has s = 4r*sqrt(2)", s, 4 * r * Math.SQRT2);

  // The page says s = S/2. For the midpoint square the factor is 1/sqrt(2).
  near("TRUE claim: s = S/sqrt(2)", s, S / Math.SQRT2);
  near("ratio s/S is 1/sqrt(2)", s / S, 1 / Math.SQRT2);
  check("the page's s = S/2 is wrong: the ratio is not 0.5", Math.abs(s / S - 0.5) > 0.2);
  check("the page's s = S/2 is wrong: s != S/2", Math.abs(s - S / 2) > r);

  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const st = C.withN(s0, n);
    const sn = C.brokenPerimeter(st);
    near(`page claim s_${n} = S`, sn, S, TOL * S);
    check(`s_${n} is greater than s`, sn > s);
    equal(`the staircase has 8*${n} points`, C.brokenLine(st).length, 8 * n);
  }

  const first = C.brokenPerimeter(C.withN(s0, C.MIN_N));
  let allConstant = true;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    if (Math.abs(C.brokenPerimeter(C.withN(s0, n)) - first) > TOL * S) allConstant = false;
  }
  check("the length never changes as n goes from 1 to 105", allConstant);

  const d5 = C.deviation(C.withN(s0, 5));
  const d50 = C.deviation(C.withN(s0, 50));
  const d105 = C.deviation(C.withN(s0, 105));
  check("the curves do converge: deviation(105) < deviation(50)", d105 < d50);
  check("the curves do converge: deviation(50) < deviation(5)", d50 < d5);
  check("at 105 break points the curve is within 1% of r of the diamond", d105 < 0.01 * r);
  near("deviation(n) is about r/(sqrt(2)*n)", d105, r / (Math.SQRT2 * 105), r / (Math.SQRT2 * 105) * 0.15);

  const sum = C.summary(C.withN(s0, 105));
  near("summary.S", sum.S, S);
  near("summary.s", sum.s, s);
  near("summary.sn", sum.sn, S);
  near("summary.ratio", sum.ratio, 1 / Math.SQRT2);
  equal("summary.n", sum.n, 105);

  // The geometry scales with the canvas, but the 20px margin is fixed, so
  // doubling the canvas does not quite double r (130 -> 280, not 260).
  const s1 = C.start({ width: 800, height: 600 });
  const g1 = C.geometry(s1);
  near("r of an 800x600 canvas is min(760,560)/2 = 280", g1.r, 280);
  near("bigger canvas perimeter is 8r", C.bigPerimeter(s1), 8 * g1.r);
  near("bigger canvas staircase length is still 8r", C.brokenPerimeter(C.withN(s1, 73)), 8 * g1.r);
}

/* ------------- 4. the same points as the applet's own Reset/CollectPoints */

// A second transcription, straight from BadLimitCanvas.init/Reset/
// CollectPoints in javap output. Arrays are [x, y] like the Java DoubPoint.
function appletPicture(n, width, height) {
  const margin = 20;
  const g = Math.min(width - 2 * margin, height - 2 * margin) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const Rhomb = [
    [cx, cy - g],
    [cx - g, cy],
    [cx, cy + g],
    [cx + g, cy],
  ];
  const BLine = [];
  function CollectPoints(P, A, B, flag) {
    for (let k = 0; k < n; k++) {
      P.push([A[0] + (k * (B[0] - A[0])) / n, A[1] + (k * (B[1] - A[1])) / n]);
      if (flag) {
        P.push([A[0] + (k * (B[0] - A[0])) / n, A[1] + ((k + 1) * (B[1] - A[1])) / n]);
      } else {
        P.push([A[0] + ((k + 1) * (B[0] - A[0])) / n, A[1] + (k * (B[1] - A[1])) / n]);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    CollectPoints(BLine, Rhomb[i], Rhomb[j], i % 2 === 1 ? true : false);
  }
  let length = 0;
  for (let i = 0; i < BLine.length; i++) {
    const a = BLine[i];
    const b = BLine[(i + 1) % BLine.length];
    length += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { BLine, length };
}

{
  const round = (p) => [Number(p.x.toFixed(9)), Number(p.y.toFixed(9))];
  const shapes = C.brokenLine;
  for (const [width, height] of [[400, 300], [800, 600], [320, 480]]) {
    for (let n = C.MIN_N; n <= C.MAX_N; n++) {
      const st = C.start({ n, width, height });
      const ours = shapes(st).map(round);
      const theirs = appletPicture(n, width, height).BLine.map((p) => p.map((v) => Number(v.toFixed(9))));
      equal(`exact staircase points, ${width}x${height}, N=${n}`, ours, theirs);
      near(`exact staircase length, ${width}x${height}, N=${n}`, C.brokenPerimeter(st), appletPicture(n, width, height).length, TOL * Math.max(1, width, height));
    }
  }
}

done("bad-limit");
