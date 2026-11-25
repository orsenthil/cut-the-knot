#!/usr/bin/env node
"use strict";

/*
 * Logic test for modular-tables/modular-tables-core.js.
 *
 *   node porting/check-modular-tables.mjs
 *
 * Every table for every modulus 2..30 against definitions (a + b, a b, a - b mod
 * N; division as the a with a b = r), then the page's claims, each tested for
 * every N from 2 to 30: consecutive rows of an addition table are circular
 * rotations of the first; for prime N every row and column of the multiplication
 * and division tables is a permutation of the first row, and each digit forms a
 * rook placement (once in every row and column); 1 is in both corners of the main
 * diagonal and nowhere else on it; 6/5 = 4 mod 7; both diagonals of a
 * multiplication table are palindromes; odd N: every remainder is on the main
 * diagonal of the addition table and the second diagonal of the subtraction table
 * is a permutation of the first row; even N: the addition diagonal holds half the
 * remainders, each twice; and when the table has N rows with N+1 prime (the modulus is prime) the
 * multiplication diagonal holds half the remainders, each twice. Also which rows of the multiplication table are
 * permutations of the first row (coprime to N).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("modular-tables/modular-tables-core.js", "ModularCore");
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const sorted = (a) => a.slice().sort((x, y) => x - y).join();
const perm = (row, first) => sorted(row) === sorted(first);

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("starts at N = 10 with addition", [s.n, s.op, s.mark], [10, 0, null]);
  equal("N runs from 2 to 30", [C.MIN_N, C.MAX_N, C.clampN(1), C.clampN(99), C.clampN("x")], [2, 30, 2, 30, 10]);
  equal("division only for primes", [2, 3, 7, 9, 10, 29, 30].map((n) => C.available(n, 3)), [true, true, true, false, false, true, false]);
  equal("a composite N drops division (the applet would draw nothing)", C.setModulus({ n: 7, op: 3, mark: 4 }, 9), { n: 9, op: 0, mark: null });
  equal("a prime keeps division", C.setModulus({ n: 7, op: 3, mark: null }, 11).op, 3);
  equal("division refused for 10", C.setOp({ n: 10, op: 0, mark: null }, 3), null);
  equal("marks", [C.setMark({ n: 7, op: 0, mark: null }, 6).mark, C.setMark({ n: 7, op: 0, mark: 3 }, null).mark, C.setMark({ n: 7, op: 0, mark: null }, 7)], [6, null, null]);
  equal("division table for 10 does not exist", C.table(10, 3), null);
  equal("primes up to 30", Array.from({ length: 29 }, (_, i) => i + 2).filter(C.isPrime), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  const t = C.table(5, 0), m = C.table(5, 1);
  equal("addition mod 5: 5 by 5, headers 0..4, row 3 is 3 4 0 1 2", [t.cells.length, t.headers, t.cells[3]], [5, [0, 1, 2, 3, 4], [3, 4, 0, 1, 2]]);
  equal("multiplication mod 5 leaves out 0: 4 by 4, headers 1..4, row 2 is 2 4 1 3", [m.cells.length, m.headers, m.cells[1]], [4, [1, 2, 3, 4], [2, 4, 1, 3]]);
  equal("subtraction mod 5: row 1, column 3 is 1 - 3 = 3", C.table(5, 2).cells[1][3], 3);
}

/* ------------------------- 2. every table against the definitions */
{
  let bad = 0, cells = 0;
  for (let n = 2; n <= 30; n++) for (let op = 0; op <= 3; op++) {
    const t = C.table(n, op);
    if (!C.available(n, op)) { if (t !== null) bad++; continue; }
    const h = t.headers;
    if (op !== 3) {
      for (let r = 0; r < h.length; r++) for (let c = 0; c < h.length; c++) { cells++; const a = h[r], b = h[c], want = op === 0 ? (a + b) % n : op === 1 ? (a * b) % n : (((a - b) % n) + n) % n; if (t.cells[r][c] !== want) bad++; }
    } else {
      // quotient: entry (r, b) times b is r, and it is the only such a
      for (let r = 0; r < h.length; r++) for (let c = 0; c < h.length; c++) { cells++; const e = t.cells[r][c]; if ((e * h[c]) % n !== h[r]) bad++; }
    }
  }
  equal(`all ${cells.toLocaleString()} table entries for N = 2..30 match their definitions`, bad, 0);
}

/* ------------------ 3. the page's claims, for every N from 2 to 30 */
{
  const fail = {};
  const note = (k) => { fail[k] = (fail[k] || 0) + 1; };
  for (let n = 2; n <= 30; n++) {
    const add = C.table(n, 0).cells, mul = C.table(n, 1), sub = C.table(n, 2).cells;
    // addition rows are rotations of the first row
    for (let r = 1; r < n; r++) for (let c = 0; c < n; c++) if (add[r][c] !== add[0][(c + r) % n]) note("add rotation");
    // diagonals
    const mainAdd = add.map((r, i) => r[i]), mainMul = mul.cells.map((r, i) => r[i]), antiMul = mul.cells.map((r, i) => r[mul.cells.length - 1 - i]);
    const anti2 = sub.map((r, i) => r[n - 1 - i]);
    if (n % 2 === 1) {
      if (sorted(mainAdd) !== Array.from({ length: n }, (_, i) => i).join()) note("odd add diagonal has every remainder");
      if (!perm(anti2, sub[0])) note("odd subtraction second diagonal is a permutation of the first row");
    } else {
      const cnt = {}; mainAdd.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; });
      if (!(Object.keys(cnt).length === n / 2 && Object.values(cnt).every((c) => c === 2))) note("even add diagonal: half the remainders twice each");
    }
    // multiplication diagonals palindromic
    if (mainMul.join() !== mainMul.slice().reverse().join()) note("main diagonal of multiplication is a palindrome");
    if (antiMul.join() !== antiMul.slice().reverse().join()) note("second diagonal of multiplication is a palindrome");
    if (C.isPrime(n) && n > 2) {
      // N rows (N = n - 1) with N + 1 = n prime: the diagonal holds half the remainders, twice each
      const cnt = {}; mainMul.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; });
      if (!(Object.keys(cnt).length === (n - 1) / 2 && Object.values(cnt).every((c) => c === 2))) note("N + 1 prime: multiplication diagonal holds half the remainders twice");
    }
    if (C.isPrime(n)) {
      // permutation rows and columns, rook placements, the corner ones
      const first = mul.cells[0];
      for (const M of [mul.cells, C.table(n, 3).cells]) {
        for (let r = 0; r < M.length; r++) {
          if (!perm(M[r], first)) note("prime: every row is a permutation of the first");
          if (!perm(M.map((row) => row[r]), first)) note("prime: every column is a permutation of the first");
        }
        for (let d = 1; d < n; d++) { // a digit is a rook placement: once in every row and column
          for (let r = 0; r < M.length; r++) { if (M[r].filter((v) => v === d).length !== 1) note("rooks: a digit once in every row"); if (M.map((row) => row[r]).filter((v) => v === d).length !== 1) note("rooks: a digit once in every column"); }
        }
      }
      const diag = mul.cells.map((r, i) => r[i]);
      const ones = diag.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
      if (n > 2 && !(ones.length === 2 && ones[0] === 0 && ones[1] === diag.length - 1)) note("1 in both corners and nowhere else on the main diagonal");
      if (n === 2 && !(ones.length === 1)) note("n = 2 has the single corner");
    }
    // which rows of the multiplication table are permutations of the first row?
    for (let r = 0; r < mul.cells.length; r++) {
      const a = mul.headers[r];
      const isPerm = perm(mul.cells[r], mul.cells[0]);
      if (isPerm !== (gcd(a, n) === 1)) note("a row is a permutation of the first exactly when its number is coprime to N");
    }
  }
  equal("every claim holds for every N = 2..30 (list of failed claims)", fail, {});
  // some individual statements
  const seven = C.table(7, 3);
  equal("6/5 = 4 mod 7: row 6, column 5 of the division table", seven.cells[5][4], 4);
  equal("5 x 4 = 6 mod 7 (the check)", (5 * 4) % 7, 6);
  const ten = C.table(10, 1).cells;
  equal("mod 10: 5 x (1 3 5 7 9) is 5, and 5 x (2 4 6 8) is 0: no unique division by 5", [[1, 3, 5, 7, 9].map((b) => (5 * b) % 10), [2, 4, 6, 8].map((b) => (5 * b) % 10)], [[5, 5, 5, 5, 5], [0, 0, 0, 0]]);
  equal("mod 10: the row for 5 is not a permutation, the row for 3 is", [perm(ten[4], ten[0]), perm(ten[2], ten[0])], [false, true]);
  equal("a table mod 2 is tiny: addition 0 1 / 1 0, multiplication just 1", [C.table(2, 0).cells, C.table(2, 1).cells], [[[0, 1], [1, 0]], [[1]]]);
}

done("modular-tables");
