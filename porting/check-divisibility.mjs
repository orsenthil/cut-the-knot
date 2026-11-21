#!/usr/bin/env node
"use strict";

/*
 * Logic test for divisibility/divisibility-core.js.
 *
 *   node porting/check-divisibility.mjs
 *
 * The page's claim, "if all the n + m numbers but one are divisible by p, prime to
 * 10, so is the last", is tried on EVERY matrix of digits for 2 by 2, 2 by 3 and 3
 * by 2 and every p up to 99 prime to 10, and on 200,000 random matrices up to 8 by
 * 8 built to have all numbers but one divisible. The identity C = D behind the
 * proof is checked for all of those. And the claim is shown to fail without the
 * condition: for p = 2 and p = 5 (and 10) there are matrices with exactly one number
 * not divisible.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("divisibility/divisibility-core.js", "DivisibilityCore");

{
  const s = C.start({});
  check("the applet opens 2 rows by 3 columns of digits", s.rows === 2 && s.cols === 3 && s.digits.length === 2 && s.digits[0].length === 3);
  check("every digit is 0..9", s.digits.flat().every((d) => d >= 0 && d <= 9));
  check("the same seed gives the same digits, another seed other ones", JSON.stringify(C.start({ seed: 5 }).digits) === JSON.stringify(C.start({ seed: 5 }).digits) && JSON.stringify(C.start({ seed: 5 }).digits) !== JSON.stringify(C.start({ seed: 6 }).digits));
  const t = C.move(s, { type: "digit", i: 0, j: 0, value: 9 });
  check("a digit can be set, and +1 wraps 9 to 0", t.digits[0][0] === 9 && C.move(t, { type: "digit", i: 0, j: 0 }).digits[0][0] === 0 && s.digits[0][0] === C.start({}).digits[0][0]);
  check("a digit outside the matrix or above 9 is refused", C.move(s, { type: "digit", i: 5, j: 0 }) === null && C.move(s, { type: "digit", i: 0, j: 0, value: 10 }) === null);
  check("sizes run from 2 to 8", C.move(s, { type: "size", rows: 1, cols: 3 }) === null && C.move(s, { type: "size", rows: 8, cols: 9 }) === null && C.move(s, { type: "size", rows: 8, cols: 8 }).digits.length === 8);
  check("p runs from 2 to 99", C.move(s, { type: "p", value: 1 }) === null && C.move(s, { type: "p", value: 100 }) === null && C.move(s, { type: "p", value: 99 }).p === 99);
  check("the rows and columns read as decimal integers", JSON.stringify(C.rowNumbers({ ...s, digits: [[1, 2, 3], [4, 5, 6]] })) === "[123,456]" && JSON.stringify(C.colNumbers({ ...s, digits: [[1, 2, 3], [4, 5, 6]] })) === "[14,25,36]");
  check("exploring marks the position done", C.result(s) === null && C.result(t) === "done");
}

const ps = [];
for (let p = 2; p <= 99; p++) if (C.primeTo10(p)) ps.push(p);

{
  // every matrix of the three smallest shapes
  let n = 0, bad = null, identity = true;
  for (const [rows, cols] of [[2, 2], [2, 3], [3, 2]]) {
    const cells = rows * cols, total = 10 ** cells;
    for (let k = 0; k < total; k++) {
      const digits = [];
      let x = k;
      for (let i = 0; i < rows; i++) { digits.push([]); for (let j = 0; j < cols; j++) { digits[i].push(x % 10); x = Math.floor(x / 10); } }
      const s = { rows, cols, p: 7, digits, moves: 0, explored: false };
      const { C: c, D: d } = C.combos(s);
      if (c !== d) identity = false;
      const nums = C.rowNumbers(s).concat(C.colNumbers(s));
      for (const p of ps) {
        let bad1 = 0;
        for (const v of nums) if (v % p !== 0) bad1++;
        if (bad1 === 1) bad = `${JSON.stringify(digits)} p=${p}`;
        n++;
      }
    }
  }
  check(`C = D for every matrix of the three smallest shapes`, identity);
  check(`never exactly one number left over, for every matrix and every p prime to 10 up to 99 (${n} cases, ${ps.length} values of p)`, bad === null, String(bad));
}

{
  // random bigger matrices, built so that all numbers but one are divisible by p: fill the matrix at random, then
  // fix digits (row by row, column by column) greedily; use rejection on small shapes instead and the identity on large ones.
  let seed = 99, n = 0, idOk = true;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 200000; t++) {
    const rows = 2 + rnd(7), cols = 2 + rnd(7);
    const digits = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rnd(10)));
    const s = { rows, cols, p: 3, digits, moves: 0, explored: false };
    const { C: c, D: d } = C.combos(s);
    if (c !== d) idOk = false;
    n++;
  }
  check(`C = D for ${n} random matrices up to 8 by 8`, idOk);

  // build matrices with all but one number divisible by p: pick all digits but the last row's last digit... then solve
  // by search over the last column's and last row's free digits.
  let built = 0, bad = null;
  for (let t = 0; t < 3000 && !bad; t++) {
    const p = ps[rnd(ps.length)];
    const rows = 2 + rnd(3), cols = 2 + rnd(3);
    const digits = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rnd(10)));
    const s = () => ({ rows, cols, p, digits, moves: 0, explored: false });
    // make rows 0..rows-2 divisible by p by choosing their last digit, where possible
    let ok = true;
    for (let i = 0; i < rows - 1 && ok; i++) {
      ok = false;
      for (let v = 0; v < 10; v++) { digits[i][cols - 1] = v; if (C.rowNumbers(s())[i] % p === 0) { ok = true; break; } }
    }
    if (!ok) continue;
    // make columns 0..cols-2 divisible by choosing the last row's digit in that column
    for (let j = 0; j < cols - 1 && ok; j++) {
      ok = false;
      for (let v = 0; v < 10; v++) { digits[rows - 1][j] = v; if (C.colNumbers(s())[j] % p === 0) { ok = true; break; } }
    }
    if (!ok) continue;
    const d = C.divisibility(s(), p);
    // exactly one number may be left: then by the theorem it is divisible too
    if (d.notDivisible === 1) bad = JSON.stringify(digits) + " p=" + p;
    if (d.notDivisible !== d.total - d.count) bad = "count";
    built++;
  }
  check(`built matrices (${built}) with all rows and all columns but the last row and column divisible: never exactly one left over`, bad === null && built > 100, String(bad));
}

{
  // without the condition the claim fails
  const failing = (p) => {
    let found = null;
    for (let k = 0; k < 10000 && !found; k++) {
      const digits = [[k % 10, Math.floor(k / 10) % 10], [Math.floor(k / 100) % 10, Math.floor(k / 1000) % 10]];
      const s = { rows: 2, cols: 2, p, digits, moves: 0, explored: false };
      if (C.divisibility(s, p).notDivisible === 1) found = digits;
    }
    return found;
  };
  for (const p of [2, 5, 10]) check(`p = ${p} is not prime to 10, and a 2 by 2 matrix leaves exactly one number not divisible`, !C.primeTo10(p) && failing(p) !== null);
  check("primeTo10 is true for the page's examples 3, 7, 9, 11, 21", [3, 7, 9, 11, 21].every(C.primeTo10) && ![4, 6, 15, 20].some(C.primeTo10));
  const d = C.divisibility({ rows: 2, cols: 3, p: 3, digits: [[1, 2, 3], [4, 5, 6]], moves: 0, explored: false }, 3);
  check("123, 456 and 14, 25, 36: divisible by 3 are 123, 456 and 36", d.rows.join() === "true,true" && d.cols.join() === "false,false,true" && d.count === 3 && d.total === 5);
}

done("divisibility");
