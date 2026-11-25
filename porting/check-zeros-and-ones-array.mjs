#!/usr/bin/env node
"use strict";

/*
 * Logic test for zeros-and-ones-array/zeros-and-ones-array-core.js.
 *
 *   node porting/check-zeros-and-ones-array.mjs
 *
 * The rules (flip a square, complement, resize keeping what fits, the sums and
 * the set of different sums), then every claim of the page:
 *  - swapping two rows or two columns changes no sum, so only the pattern matters;
 *  - there are never more than max(N, M) + 1 different sums (every array up to
 *    20 squares, and every pair of row and column sums allowed by the
 *    Gale-Ryser theorem for boards up to 7 by 7);
 *  - max(N, M) + 1 is reached exactly where the page says (N = M; N = M + 1 with
 *    M > 2; N even with M >= N/2 + 1; N odd with M > (N + 1)/2), and not elsewhere
 *    for boards up to 7 by 7: the page only claims "attainable", the search
 *    shows "only there";
 *  - the construction built here reaches it for every size from 2 to 20 where
 *    the page says it can, and the complement of an optimal square array is optimal.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("zeros-and-ones-array/zeros-and-ones-array-core.js", "ZeroOneCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("starts empty, 3 by 3", [s.n, s.m, s.cells], [3, 3, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]]);
  equal("the size is kept in 2..20", [C.start({ n: 1, m: 99 }).n, C.start({ n: 1, m: 99 }).m], [2, 20]);
  const t = C.toggle(s, 1, 2);
  equal("a click flips one square", [t.cells[1][2], s.cells[1][2]], [1, 0]);
  equal("a second click flips it back", C.toggle(t, 1, 2).cells[1][2], 0);
  equal("clicks outside the board are ignored", [C.toggle(s, 3, 0), C.toggle(s, 0, -1), C.toggle(s, 0.5, 0)], [null, null, null]);
  const u = C.complement(t);
  equal("the complement flips every square", [u.cells[1][2], u.cells[0][0], t.cells[0][0]], [0, 1, 0]);
  const full = C.toggle(C.toggle(C.toggle(s, 0, 0), 2, 2), 1, 1);
  const grown = C.resize(full, 5, 4);
  equal("growing keeps the squares and adds zeros", [grown.n, grown.m, grown.cells[0][0], grown.cells[2][2], grown.cells[4][3], grown.cells.length, grown.cells[0].length], [5, 4, 1, 1, 0, 5, 4]);
  equal("shrinking keeps what still fits", C.resize(full, 2, 2).cells, [[1, 0], [0, 1]]);
  equal("the resized size is kept in 2..20", [C.resize(s, 1, 50).n, C.resize(s, 1, 50).m, C.resize(s, "x", 3)], [2, 20, null]);
  const q = { n: 3, m: 4, cells: [[1, 1, 0, 0], [0, 1, 1, 1], [0, 0, 0, 0]] };
  equal("sums: rows 2, 3, 0; columns 1, 2, 1, 1; the set {0, 1, 2, 3}", [C.sums(q).rows, C.sums(q).cols, C.sums(q).distinct, C.sums(q).count, C.sums(q).most], [[2, 3, 0], [1, 2, 1, 1], [0, 1, 2, 3], 4, 5]);
  equal("the empty board has the single sum 0", [C.sums(s).distinct, C.sums(s).count], [[0], 1]);
}

/* ------ 2. swapping rows or columns changes no sum; the sums are unchanged as a set */
{
  const r = rng(3);
  let ok = true;
  for (let t = 0; t < 5000; t++) {
    const n = 2 + Math.floor(r() * 8), m = 2 + Math.floor(r() * 8);
    let s = C.start({ n, m });
    for (let k = 0; k < n * m; k++) if (r() < 0.5) s = C.toggle(s, Math.floor(r() * n), Math.floor(r() * m));
    const rows = s.cells.slice(), a = Math.floor(r() * n), b = Math.floor(r() * n);
    [rows[a], rows[b]] = [rows[b], rows[a]];
    const cols = rows.map((row) => row.slice());
    const c1 = Math.floor(r() * m), c2 = Math.floor(r() * m);
    cols.forEach((row) => { [row[c1], row[c2]] = [row[c2], row[c1]]; });
    const s2 = { n, m, cells: cols };
    if (JSON.stringify(C.sums(s).distinct) !== JSON.stringify(C.sums(s2).distinct)) ok = false;
    if (C.sums(s).rows.slice().sort().join() !== C.sums(s2).rows.slice().sort().join()) ok = false;
  }
  check("exchanging a pair of rows and a pair of columns never changes the set of sums (5000 random arrays)", ok);
}

/* ---- 3. at most max(N, M) + 1 different sums; exactly where the page says */
{
  // every array with at most 20 squares
  let ok = true, count = 0, bound = true;
  const table = {};
  for (let n = 2; n <= 7; n++) for (let m = 2; m <= 7; m++) {
    if (n * m > 20) continue;
    let best = 0;
    const total = 1 << (n * m);
    for (let mask = 0; mask < total; mask++) {
      const rows = new Array(n).fill(0), cols = new Array(m).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((mask >> (i * m + j)) & 1) { rows[i]++; cols[j]++; }
      const k = new Set([...rows, ...cols]).size;
      if (k > best) best = k;
      count++;
    }
    table[`${n}x${m}`] = best;
    if (best > Math.max(n, m) + 1) bound = false;
  }
  check(`no array has more than max(N, M) + 1 different sums (all ${count} arrays on boards of up to 20 squares)`, bound);
  let agree = true;
  for (const [k, best] of Object.entries(table)) { const [n, m] = k.split("x").map(Number); if ((best === Math.max(n, m) + 1) !== C.attainable(n, m)) agree = false; }
  check("on those boards the most is reached exactly where the page says (and nowhere else)", agree);

  // Gale-Ryser: every board up to 7 by 7, from the row and column sums that some array has
  function parts(n, maxv) { const out = []; (function go(i, max, cur) { if (i === n) { out.push(cur.slice()); return; } for (let x = max; x >= 0; x--) { cur.push(x); go(i + 1, x, cur); cur.pop(); } })(0, maxv, []); return out; }
  function best(N, M) {
    const R = parts(N, M), Cs = parts(M, N).map((c) => ({ c, sum: c.reduce((a, b) => a + b, 0), set: new Set(c) }));
    let top = 0;
    for (const r of R) {
      const rs = r.reduce((a, b) => a + b, 0), conj = new Array(M).fill(0);
      for (const x of r) for (let j = 0; j < x; j++) conj[j]++;
      const rset = new Set(r);
      for (const ci of Cs) {
        if (ci.sum !== rs) continue;
        let ps = 0, qs = 0, good = true;
        for (let j = 0; j < M; j++) { ps += ci.c[j]; qs += conj[j]; if (ps > qs) { good = false; break; } }
        if (!good) continue;
        const k = new Set([...rset, ...ci.set]).size;
        if (k > top) top = k;
      }
    }
    return top;
  }
  let exact = true, reached = [], notReached = [];
  for (let N = 2; N <= 7; N++) for (let M = 2; M <= N; M++) {
    const b = best(N, M);
    if (b > N + 1) exact = false;
    if ((b === N + 1) !== C.attainable(N, M)) exact = false;
    (b === N + 1 ? reached : notReached).push(`${N}x${M}`);
  }
  check(`by the Gale-Ryser theorem, for every board up to 7 by 7 the most (N+1, the longer side + 1) is reached exactly where the page says: ${reached.length} sizes reach it, ${notReached.length} do not (${notReached.join(", ")})`, exact);
  // the page's specific remarks
  check("N = M + 1 with M = 2 (3 by 2) does not reach the bound: the claim needs M > 2", !C.attainable(3, 2) && best(3, 2) === 3);
}

/* ----------------- 4. the construction reaches the most, and the complement */
{
  let ok = true, nulls = [], wrong = [], square = true, count = 0;
  for (let n = 2; n <= 20; n++) for (let m = 2; m <= 20; m++) {
    const o = C.optimal(n, m);
    if (C.attainable(n, m)) {
      if (!o) { ok = false; nulls.push(`${n}x${m}`); continue; }
      const s = C.sums(o);
      count++;
      if (o.n !== n || o.m !== m || o.cells.length !== n || o.cells.some((r) => r.length !== m) || s.count !== s.most || s.most !== Math.max(n, m) + 1) { ok = false; wrong.push(`${n}x${m}`); }
      if (n === m) { const c = C.sums(C.complement(o)); if (c.count !== c.most) square = false; }
    }
  }
  check(`the construction reaches max(N, M) + 1 different sums for all ${count} sizes from 2 by 2 to 20 by 20 where the page says it is possible`, ok, `missing ${nulls.join(" ")} wrong ${wrong.join(" ")}`);
  check("for square arrays the complement of an optimal array is optimal too", square);
  equal("the page's own small cases: 2 by 2 gives 3 sums, 3 by 3 gives 4, 4 by 3 gives 5", [C.sums(C.optimal(2, 2)).count, C.sums(C.optimal(3, 3)).count, C.sums(C.optimal(4, 3)).count], [3, 4, 5]);
  equal("where it is not claimed possible there is nothing to show (3 by 2, 6 by 3)", [C.optimal(3, 2), C.optimal(6, 3)], [null, null]);
  // the tall boards are the wide ones turned on their side
  const wide = C.optimal(6, 9), tall = C.optimal(9, 6);
  check("a tall board is a wide one turned on its side", C.sums(tall).count === 10 && C.sums(wide).count === 10 && JSON.stringify(tall.cells) === JSON.stringify(wide.cells[0].map((_, j) => wide.cells.map((row) => row[j]))));
}

done("zeros-and-ones-array");
