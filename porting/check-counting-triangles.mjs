#!/usr/bin/env node
"use strict";

/*
 * Logic test for counting-triangles/counting-triangles-core.js.
 *
 *   node porting/check-counting-triangles.mjs
 *
 * The rules (N 1..15, the slider 0..256), the three groups of triangles against
 * a second, cell-by-cell transcription of the applet's Draw, and every claim of
 * the page, for N = 1 to 15 and then for much larger N: the first picture has N^2
 * triangles (no overlaps, filling the right isosceles triangle exactly, area N^2/2),
 * the second has N^2 as well (one half of each of the N^2 small squares); the
 * strips parallel to the long side have 1, 3, 5, ..., 2N - 1 triangles; the triangular
 * numbers N(N+1)/2 and (N-1)N/2 add to N^2; and the induction step (k+1)^2 - k^2 = 2k + 1.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("counting-triangles/counting-triangles-core.js", "TrianglesCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("starts at N = 5 with the slider at the right end (256)", C.start(), { n: 5, alpha: 256 });
  equal("N is kept in 1..15", [C.setN(C.start(), 0).n, C.setN(C.start(), 7).n, C.setN(C.start(), 99).n, C.setN(C.start(), 6.6).n, C.setN(C.start(), "x")], [1, 7, 15, 7, null]);
  equal("the slider is kept in 0..256", [C.setAlpha(C.start(), -4).alpha, C.setAlpha(C.start(), 100).alpha, C.setAlpha(C.start(), 999).alpha, C.setAlpha(C.start(), NaN)], [0, 100, 256, null]);
  equal("at the right end the low triangles are solid and the high ones invisible; at the left end the reverse; at the middle half each", [C.strengths({ n: 3, alpha: 256 }), C.strengths({ n: 3, alpha: 0 }), C.strengths({ n: 3, alpha: 128 })], [{ low: 1, high: 0 }, { low: 0, high: 1 }, { low: 0.5, high: 0.5 }]);
  equal("the old position is untouched", (() => { const s = C.start(); C.setN(s, 9); C.setAlpha(s, 3); return s; })(), { n: 5, alpha: 256 });
  equal("N = 2 gives 3 full, 1 low and 1 high triangle", Object.values(C.counts(2)), [3, 1, 1]);
  equal("N = 1 gives one full triangle and nothing else", [C.triangles(1).full.length, C.triangles(1).low.length, C.triangles(1).high.length], [1, 0, 0]);
}

/* ------ 2. the triangles against a cell-by-cell transcription of Draw */
{
  // transcription of the four fill loops: (loop variables i, j exactly as in the bytecode)
  function applet(N) {
    const full = [], low = [], high = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < i + 1; j++) full.push([[j, i], [j, i + 1], [j + 1, i + 1]]);
    for (let i = 1; i < N; i++) for (let j = 0; j < i; j++) low.push([[j, i], [j + 1, i], [j + 1, i + 1]]);
    for (let i = 1; i < N; i++) for (let j = 0; j < i; j++) high.push([[i, j], [i, j + 1], [i + 1, j + 1]]);
    return { full, low, high };
  }
  let ok = true;
  for (let n = 1; n <= 15; n++) if (JSON.stringify(C.triangles(n)) !== JSON.stringify(applet(n))) ok = false;
  check("the three groups agree with the applet's loops for N = 1..15", ok);
}

/* ------------------------------------------- 3. the page's claims, exhaustively */
{
  let a = true, b = true, c = true, strips = true, tri = true, odd = true, area = true, split = true;
  for (let n = 1; n <= 60; n++) {
    const t = C.triangles(n), tot = C.totals(n);
    if (tot.triangle !== n * n) a = false;                        // first picture: N^2
    if (tot.square !== n * n) b = false;                           // second picture: N^2
    if (t.full.length + t.low.length !== n * n || t.full.length + t.high.length !== n * n) a = false;
    if (C.counts(n).full !== (n * (n + 1)) / 2) tri = false;       // (2): N(N+1)/2 under the diagonal
    if (C.counts(n).high !== ((n - 1) * n) / 2) tri = false;       // (2'): (N-1)N/2 above it
    if (C.triangularSum(n) !== n * n) tri = false;
    if (C.oddSum(n) !== n * n) odd = false;
    const sizes = C.stripSizes(n);
    if (JSON.stringify(sizes) !== JSON.stringify(Array.from({ length: n }, (_, k) => 2 * k + 1))) strips = false;
    if (sizes.reduce((s, x) => s + x, 0) !== n * n) strips = false;
    // the first picture fills the triangle (0,0), (0,N), (N,N) exactly: total area N^2/2, no overlaps
    let sum = 0;
    for (const g of [t.full, t.low]) for (const tr of g) sum += C.triangleArea(tr);
    if (sum !== (n * n) / 2) area = false;
    if (n <= 15) {
      const seen = new Set();
      for (const g of [t.full, t.low]) for (const tr of g) {
        const cx = tr.reduce((s, p) => s + p[0], 0) / 3, cy = tr.reduce((s, p) => s + p[1], 0) / 3;
        const key = `${(cx * 3) | 0},${(cy * 3) | 0}`;
        if (seen.has(key)) a = false;
        seen.add(key);
        if (!(cy > cx && cx > 0 && cy < n)) a = false;             // inside the triangle below the diagonal
      }
      // the second picture: exactly one triangle in each small square
      const cells = new Set();
      for (const g of [t.full, t.high]) for (const tr of g) {
        const xs = tr.map((p) => p[0]), ys = tr.map((p) => p[1]);
        cells.add(`${Math.min(...xs)},${Math.min(...ys)}`);
      }
      if (cells.size !== n * n) split = false;
    }
  }
  check("the first picture has exactly N^2 triangles for N = 1..60, with the triangles' centres all inside and distinct", a);
  check("the second picture has N^2 triangles too: one in each of the N^2 small squares (N = 1..15)", b && split);
  check("the triangles of the first picture have total area N^2/2: they fill the right isosceles triangle exactly", area);
  check("the strips parallel to the long side hold 1, 3, 5, ..., 2N - 1 triangles", strips);
  check("N(N+1)/2 under the diagonal, (N-1)N/2 above, and they add to N^2", tri);
  check("1 + 3 + 5 + ... + (2N - 1) = N^2", odd);
  let step = true;
  for (let k = 1; k <= 100000; k++) if ((k + 1) * (k + 1) - k * k !== 2 * k + 1) step = false;
  check("the induction step (k+1)^2 - k^2 = 2k + 1 holds for k up to 100,000", step);
  // large N: the same identities without drawing
  let big = true;
  for (let n = 1; n <= 4000; n++) { if (C.counts(n).full + C.counts(n).low !== n * n || C.counts(n).full + C.counts(n).high !== n * n || C.oddSum(n) !== n * n) big = false; }
  check("the counts agree with N^2 for every N up to 4000", big);
  // the lower-left halves are all full, and every full triangle lies on or under the diagonal
  let under = true;
  for (let n = 1; n <= 15; n++) for (const tr of C.triangles(n).full) { const cx = tr.reduce((s, p) => s + p[0], 0) / 3, cy = tr.reduce((s, p) => s + p[1], 0) / 3; if (!(cy > cx)) under = false; }
  check("every always-solid triangle lies under the main diagonal", under);
  for (const tr of [].concat(...[1, 2, 3, 4, 5].map((n) => C.triangles(n).high))) { const cx = tr.reduce((s, p) => s + p[0], 0) / 3, cy = tr.reduce((s, p) => s + p[1], 0) / 3; if (!(cy < cx)) under = false; }
  check("and every triangle that appears lies above it", under);
}

done("counting-triangles");
