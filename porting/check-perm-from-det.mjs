#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm-from-det/perm-from-det-core.js.
 *
 *   node porting/check-perm-from-det.mjs
 *
 * 1. Pólya's sign problem by exhaustion: for 2 x 2 one minus sign turns the
 *    determinant into the permanent; for 3 x 3, among all 512 sign
 *    patterns the number of minus products is always odd, so the best is
 *    5 of 6 (and 96 patterns reach it).
 * 2. Grenet's construction: the matrix has size 2^n - 1 (3, 7, 15) and its
 *    determinant equals the permanent for random integer matrices, n = 2,
 *    3, 4; its graph has exactly n! paths, one per rook product.
 * 3. The Bareiss determinant agrees with the n! sum.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("perm-from-det/perm-from-det-core.js", "PermFromDetCore");

{
  const s = C.toggle(C.start({ n: 2 }), 1);
  check("2 x 2: det [[a, -b], [c, d]] = ad + bc, both products positive: a win", C.positives(s) === 2 && C.result(s) === "win");
  let best = 0, count = 0, odd = true;
  for (let m = 0; m < 512; m++) {
    const t = C.start({ n: 3, signs: Array.from({ length: 9 }, (_, k) => ((m >> k) & 1 ? -1 : 1)) });
    const p = C.positives(t);
    if ((6 - p) % 2 !== 1) odd = false;
    if (p > best) { best = p; count = 0; }
    if (p === best) count++;
  }
  check("3 x 3: every one of the 512 sign patterns leaves an odd number of minus products", odd);
  equal("so at most 5 of the 6 products can be positive, by this many patterns", `${best} ${count}`, "5 96");
  equal("the game's target for 3 x 3", C.BEST[3], 5);
}

{
  let seed = 11;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 15) - 7;
  let sizes = true, same = true;
  for (const n of [2, 3, 4]) {
    const G = C.grenet(n);
    if (G.size !== 2 ** n - 1) sizes = false;
    for (let k = 0; k < 40; k++) {
      const x = Array.from({ length: n }, () => Array.from({ length: n }, r));
      if (C.det(C.fill(G, x)) !== C.perm(x)) same = false;
    }
  }
  check("Grenet's matrices are 3 x 3, 7 x 7 and 15 x 15 for n = 2, 3, 4", sizes);
  check("and their determinant equals the permanent on 120 random integer matrices", same);
  const x = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  equal("the article's 1..9: the 7 x 7 determinant gives the permanent 450", String(C.det(C.fill(C.grenet(3), x))), "450");
  // paths from the empty set to the full set in the layered graph
  const n = 4;
  const paths = (S) => (S === (1 << n) - 1 ? 1 : [...Array(n).keys()].filter((j) => !((S >> j) & 1)).reduce((s, j) => s + paths(S | (1 << j)), 0));
  equal("the set graph for n = 4 has 4! = 24 paths, one per rook product", paths(0), 24);
}
{
  let seed = 4, ok = true;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 9) - 4;
  for (let k = 0; k < 100; k++) {
    const n = 1 + (k % 6), m = Array.from({ length: n }, () => Array.from({ length: n }, r));
    const sum = C.permutations(n).reduce((s, { p, sign }) => s + BigInt(sign * p.reduce((a, j, i) => a * m[i][j], 1)), 0n);
    if (C.det(m) !== sum) ok = false;
  }
  check("the fraction-free determinant agrees with the n! sum on 100 matrices", ok);
  const s = C.start();
  const before = JSON.stringify(s);
  C.toggle(s, 4);
  equal("a toggle leaves the old position alone", JSON.stringify(s), before);
}
done("perm-from-det");
