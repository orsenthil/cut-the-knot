#!/usr/bin/env node
"use strict";

/*
 * Logic test for determinant-elimination/determinant-elimination-core.js.
 *
 *   node porting/check-determinant-elimination.mjs
 *
 * 1. Elimination's determinant equals the n!-term expansion exactly, on
 *    every page matrix (sizes 3..6, seeds 1..40) and on singular ones.
 * 2. Every row operation keeps the determinant (computed by expansion) and
 *    a swap flips it; the permanent of the matrix changes along the way.
 * 3. The operation count matches the formula, n^3/3 + O(n^2), against n!(n-1)
 *    for the expansion: already 23 vs 72 at n = 4, and 2,679 vs about 4.6
 *    x 10^19 at n = 20.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("determinant-elimination/determinant-elimination-core.js", "DeterminantEliminationCore");

{
  let same = true, keep = true, permMoves = 0, tried = 0;
  for (const n of C.SIZES) for (let seed = 1; seed <= 40; seed++) {
    const m = C.matrix(n, seed), st = C.steps(m), last = st[st.length - 1];
    const e = C.expand(m);
    if ((last.det ?? "0") !== e.det) same = false;
    const d0 = C.expand(m).det, p0 = C.expand(m).perm;
    let moved = false;
    for (const s of st) {
      const ex = C.expand(s.m);
      const want = C.show(C.frac(BigInt(s.sign) * C.parse(d0)[0], C.parse(d0)[1]));
      if (ex.det !== want) keep = false;
      if (ex.perm !== p0) moved = true;
    }
    tried++; if (moved) permMoves++;
  }
  check("elimination gives the same determinant as the n! terms, on 160 matrices", same);
  check("every row operation keeps the determinant, every swap flips its sign", keep);
  check(`the permanent changes during elimination (${permMoves} of ${tried} matrices)`, permMoves > tried * 0.9);
}
{
  const sing = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]];
  const st = C.steps(sing);
  check("the article's 1..9 matrix: elimination finds a zero pivot, determinant 0", st[st.length - 1].zero === true && C.expand(sing).det === "0");
  const z = [["0", "2", "1"], ["3", "1", "4"], ["1", "5", "9"]];
  check("a zero in the corner: a swap, then the right determinant", C.steps(z).some((s) => s.rows && s.what.startsWith("swap")) && C.steps(z).at(-1).det === C.expand(z).det);
}
{
  const full = [["2", "1", "1", "3"], ["1", "3", "2", "1"], ["4", "1", "3", "2"], ["1", "2", "1", "5"]];
  const st = C.steps(full);
  equal("a 4 x 4 with no zero pivots uses exactly the formula's count", st.at(-1).ops, C.eliminationOps(4));
  equal("elimination vs expansion multiplications at n = 4", `${C.eliminationOps(4)} vs ${C.expansionOps(4)}`, "23 vs 72");
  equal("and at n = 20", `${C.eliminationOps(20)} vs ${C.expansionOps(20)}`, "2679 vs 46225138155356160000");
  check("the count grows like n^3/3", Math.abs(C.eliminationOps(200) / (200 ** 3 / 3) - 1) < 0.02);
}
{
  const s = C.start({ n: 5, seed: 3 });
  check("stepping to the end is done", C.result(s) === null && C.result(C.finish(s)) === "done" && C.next(C.finish(s)) === null);
  const before = JSON.stringify(s);
  C.next(s);
  equal("a step leaves the old position alone", JSON.stringify(s), before);
}
done("determinant-elimination");
