#!/usr/bin/env node
"use strict";

/*
 * Logic test for det-and-perm/det-and-perm-core.js.
 *
 *   node porting/check-det-and-perm.mjs
 *
 * 1. The article's example: 1..9 in order has determinant 0, permanent 450.
 * 2. The game's targets, by trying all 9! arrangements: the largest
 *    permanent is 947 and the largest determinant 412.
 * 3. The expansion agrees with Gaussian elimination for the determinant on
 *    random matrices up to 6 x 6; it has n! terms with n!/2 of each sign.
 * 4. Swapping two rows flips the sign of the determinant and leaves the
 *    permanent alone; adding one row to another keeps the determinant and
 *    changes the permanent.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("det-and-perm/det-and-perm-core.js", "DetAndPermCore");

const s0 = C.start();
equal("the article's matrix 1..9: determinant and permanent", `${C.det(C.grid(s0.cells))} ${C.perm(C.grid(s0.cells))}`, "0 450");

{
  let maxD = -Infinity, maxP = 0, nD = 0, nP = 0, bestP = null, bestD = null;
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const go = (k) => {
    if (k === 9) {
      const g = C.grid(a), d = C.det(g), p = C.perm(g);
      if (d > maxD) { maxD = d; nD = 0; bestD = a.slice(); } if (d === maxD) nD++;
      if (p > maxP) { maxP = p; nP = 0; bestP = a.slice(); } if (p === maxP) nP++;
      return;
    }
    for (let i = k; i < 9; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  };
  go(0);
  equal("largest permanent over all 362,880 arrangements", maxP, C.GOALS.perm);
  equal("largest determinant", maxD, C.GOALS.det);
  check(`reached by ${nP} and ${nD} arrangements, and each is a win in the game`, nP > 0 && nD > 0 && C.result(C.start({ cells: bestP })) === "win" && C.result(C.start({ cells: bestD, goal: "det" })) === "win");
  console.log("    e.g. perm 947:", bestP.join(""), " det 412:", bestD.join(""));
}

const elim = (m) => {
  const a = m.map((r) => r.slice()), n = a.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; while (p < n && Math.abs(a[p][c]) < 1e-12) p++;
    if (p === n) return 0;
    if (p !== c) { [a[p], a[c]] = [a[c], a[p]]; d = -d; }
    d *= a[c][c];
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k < n; k++) a[r][k] -= f * a[c][k]; }
  }
  return d;
};
let seed = 5;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 11) - 5;
{
  let same = true, counts = true;
  for (let n = 1; n <= 6; n++) {
    const T = C.permutations(n), f = T.length;
    const plus = T.filter((t) => t.sign === 1).length;
    if (f !== [1, 1, 2, 6, 24, 120, 720][n] || (n > 1 && plus !== f / 2)) counts = false;
    for (let k = 0; k < 20; k++) {
      const m = Array.from({ length: n }, () => Array.from({ length: n }, rnd));
      if (Math.abs(C.det(m) - elim(m)) > 1e-6) same = false;
    }
  }
  check("n! terms, half of each sign (n = 2..6)", counts);
  check("the expansion matches elimination on 120 random matrices up to 6 x 6", same);
}
{
  const m = [[2, 7, 1], [8, 2, 8], [1, 8, 2]];
  const sw = [m[1], m[0], m[2]];
  check("swapping rows: det changes sign, perm stays", C.det(sw) === -C.det(m) && C.perm(sw) === C.perm(m));
  const add = [m[0], m[1].map((v, i) => v + m[0][i]), m[2]];
  check("adding a row to another: det stays, perm changes", C.det(add) === C.det(m) && C.perm(add) !== C.perm(m));
}
{
  let s = C.start();
  check("swaps: two different cells; a win at the target", C.swap(s, 2, 2) === null && C.result(s) === null);
  s = C.start({ cells: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
  const before = JSON.stringify(s);
  C.swap(s, 0, 8);
  equal("a swap leaves the old position alone", JSON.stringify(s), before);
}
done("det-and-perm");
