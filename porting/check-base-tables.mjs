#!/usr/bin/env node
"use strict";

/*
 * Logic test for base-tables/base-tables-core.js.
 *
 *   node porting/check-base-tables.mjs
 *
 * For every base 2..36 and both tables:
 * 1. Every entry, read back in that base (parseInt), is the true sum or
 *    product; the digits are 0-9 then A-Z.
 * 2. The page's point, the patterns that do not depend on the base: both
 *    tables are symmetric about the diagonal; in the + table each row is the
 *    row above shifted by one place, and an entry has two digits (a carry)
 *    exactly when a + b >= r; in the x table the column for r - 1 has digits
 *    adding up to r - 1, because (r-1) x k is written with the two digits
 *    k-1 and r-k, as 9 x 7 = 63 in base 10.
 * 3. The range and defaults.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("base-tables/base-tables-core.js", "BaseTablesCore");

let exact = true, sym = true, shift = true, carry = true, nines = true, rminus1 = true, cells = 0;
for (let r = 2; r <= 36; r++) {
  for (const op of ["+", "x"]) {
    const s = C.start({ radix: r, op }), T = C.table(s);
    for (let a = 0; a < r; a++) for (let b = 0; b < r; b++) {
      cells++;
      const want = op === "+" ? a + b : a * b;
      if (parseInt(T[a][b], r) !== want || T[a][b] !== T[a][b].toUpperCase()) exact = false;
      if (T[a][b] !== T[b][a]) sym = false;
      if (op === "+") {
        if (a > 0 && b > 0 && T[a][b - 1] !== T[a - 1][b]) shift = false;
        if ((T[a][b].length === 2) !== (a + b >= r)) carry = false;
      }
    }
    if (op === "x") {
      for (let k = 1; k < r; k++) {
        if (C.digitSum(T[r - 1][k]) !== r - 1) nines = false;
        const want = k === 1 ? C.DIGITS[r - 1] : C.DIGITS[k - 1] + C.DIGITS[r - k];
        if (T[r - 1][k] !== want) rminus1 = false;
      }
    }
  }
}
check(`every entry is the true sum or product, written in its base (${cells} cells, bases 2..36)`, exact);
check("both tables are symmetric about the diagonal in every base", sym);
check("in the + table each row is the one above moved one place", shift);
check("a + b carries (two digits) exactly when a + b >= r", carry);
check("in the x table the digits of (r-1) x k add up to r - 1, in every base", nines);
check("(r-1) x k is written with the digits k-1 and r-k", rminus1);
equal("base 10: 9 x 7 = 63", C.entry(C.start({ op: "x" }), 9, 7), "63");
equal("base 16: F x F = E1", C.entry(C.start({ radix: 16, op: "x" }), 15, 15), "E1");
equal("base 2 + table", JSON.stringify(C.table(C.start({ radix: 2 }))), JSON.stringify([["0", "1"], ["1", "10"]]));
equal("base 36: Z + Z = 1Y", C.entry(C.start({ radix: 36 }), 35, 35), "1Y");
equal("defaults: base 10, +", `${C.start().radix} ${C.start().op}`, "10 +");
equal("base held to 2..36", `${C.start({ radix: 1 }).radix} ${C.start({ radix: 99 }).radix}`, "2 36");

done("base-tables");
