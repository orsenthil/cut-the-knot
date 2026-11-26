#!/usr/bin/env node
"use strict";

/*
 * Logic test for sierpinski-dihedral/sierpinski-dihedral-core.js.
 *
 *   node porting/check-sierpinski-dihedral.mjs
 *
 * 1. The page's formulas (3) and (3'), exactly: after every number of steps
 *    up to the grid's edge, on grids of 2..24 and every modulus 2..32,
 *    Add/2 prongs holds C(N-m, n) C(N, m) mod M (0 when n + m > N), and
 *    Add/3 prongs holds C(N, n) C(N, m) mod M. Replace/2 prongs is Pascal's
 *    triangle C(n+m, n), and Replace/3 the Delannoy numbers.
 * 2. The page's surprise: at every step, Add/2 has the six symmetries of a
 *    triangle (any shuffle of n, m, N-n-m) and Add/3 the eight of a square.
 * 3. The page's other claim: modulo 2 on a grid of size 2^p, Add and
 *    Replace give the same picture once run to the corner; on other sizes
 *    they do not.
 * 4. The applet's step limit, its N and M ranges and what changing them does.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sierpinski-dihedral/sierpinski-dihedral-core.js", "SierpinskiDihedralCore");

const binom = (() => {
  const memo = new Map();
  return (a, b) => {
    if (b < 0 || a < 0 || b > a) return 0n;
    const k = a + "," + b;
    if (memo.has(k)) return memo.get(k);
    let r = 1n;
    for (let i = 1; i <= b; i++) r = (r * BigInt(a - b + i)) / BigInt(i);
    memo.set(k, r);
    return r;
  };
})();
const delannoy = (() => {
  const memo = new Map();
  const D = (a, b) => {
    if (a === 0 || b === 0) return 1n;
    const k = a + "," + b;
    if (!memo.has(k)) memo.set(k, D(a - 1, b) + D(a, b - 1) + D(a - 1, b - 1));
    return memo.get(k);
  };
  return D;
})();

let f3 = true, f3p = true, pascal = true, del = true, sym3 = true, sym4 = true, runs = 0;
for (let G = 2; G <= 24; G++) {
  for (const M of [2, 3, 5, 7, 12, 32]) {
    for (const [add, prongs] of [[true, 2], [true, 3], [false, 2], [false, 3]]) {
      let s = C.start({ n: G, m: M, add, prongs });
      for (let N = 1; N < G; N++) {
        s = C.step(s);
        runs++;
        for (let n = 0; n < G; n++) for (let m = 0; m < G; m++) {
          const v = BigInt(C.at(s, n, m));
          const BM = BigInt(M);
          if (add && prongs === 2) {
            const want = n + m > N ? 0n : (binom(N - m, n) * binom(N, m)) % BM;
            if (v !== want) f3 = false;
            if (n + m <= N) {
              const k = N - n - m; // the third coordinate: any shuffle gives the same value
              for (const [a, b] of [[m, n], [k, m], [n, k], [m, k], [k, n]]) if (b < G && a < G && BigInt(C.at(s, a, b)) !== v) sym3 = false;
            }
          } else if (add && prongs === 3) {
            if (v !== (binom(N, n) * binom(N, m)) % BM) f3p = false;
            if (n <= N && m <= N) for (const [a, b] of [[m, n], [N - n, m], [n, N - m], [N - n, N - m], [N - m, N - n], [m, N - n], [N - m, n]]) if (a < G && b < G && BigInt(C.at(s, a, b)) !== v) sym4 = false;
          } else if (prongs === 2) {
            if (v !== (n + m <= N ? binom(n + m, n) % BM : 0n)) pascal = false;
          } else {
            // every path to (n, m) is at most n + m long, so all have arrived once n + m <= N
            if (n + m <= N && v !== delannoy(n, m) % BM) del = false;
            if (Math.max(n, m) > N && v !== 0n) del = false;
          }
        }
      }
    }
  }
}
check(`Add, 2 prongs: cell (n, m) after N steps is C(N-m, n) C(N, m) mod M (${runs} grids checked in all)`, f3);
check("Add, 3 prongs: C(N, n) C(N, m) mod M", f3p);
check("Replace, 2 prongs: Pascal's triangle C(n+m, n) mod M", pascal);
check("Replace, 3 prongs: the Delannoy numbers mod M once n + m <= N, and 0 beyond reach", del);
check("Add, 2 prongs: the six symmetries of a triangle at every step", sym3);
check("Add, 3 prongs: the eight symmetries of a square at every step", sym4);

{
  let same = true, differ = 0, tried = 0;
  for (let p = 1; p <= 6; p++) {
    const G = 2 ** p;
    const a = C.steps(C.start({ n: G, m: 2, add: true }), 1000);
    const r = C.steps(C.start({ n: G, m: 2, add: false }), 1000);
    if (JSON.stringify(a.S) !== JSON.stringify(r.S)) same = false;
  }
  for (const G of [3, 5, 6, 7, 9, 10, 12, 20, 24]) {
    tried++;
    const a = C.steps(C.start({ n: G, m: 2, add: true }), 1000);
    const r = C.steps(C.start({ n: G, m: 2, add: false }), 1000);
    if (JSON.stringify(a.S) !== JSON.stringify(r.S)) differ++;
  }
  check("mod 2 on grids of 2, 4, ..., 64, Add and Replace agree when run to the corner", same);
  equal("on grids of other sizes (3, 5, 6, 7, 9, 10, 12, 20, 24) they differ", differ, tried);
}

{
  const s = C.start();
  equal("defaults: N 32, modulo 2, Add, 2 prongs", [s.n, s.m, s.add, s.prongs].join(","), "32,2,true,2");
  equal("To corner stops at step N - 1", C.steps(s, 1000).steps, 31);
  equal("and then does nothing more", C.steps(C.steps(s, 1000), 8).steps, 31);
  equal("but One step still goes on", C.step(C.steps(s, 1000)).steps, 32);
  equal("N is held to 2..128 and M to 2..32", [C.start({ n: 1 }).n, C.start({ n: 999 }).n, C.start({ m: 1 }).m, C.start({ m: 99 }).m].join(","), "2,128,2,32");
  const t = C.steps(C.start({ n: 8 }), 3);
  const u = C.setN(t, 16);
  check("a bigger N keeps the numbers and pads with 0", u.n === 16 && u.S.length === 16 && u.S[3][0] === t.S[3][0] && u.steps === 3);
  const v = C.setN(t, 4);
  check("a smaller N keeps the old grid and shows its corner", v.n === 4 && v.S.length === 8);
  check("changing M, the algorithm or the prongs starts again", C.setM(t, 3).steps === 0 && C.setAdd(t, false).steps === 0 && C.setProngs(t, 3).steps === 0);
  const before = JSON.stringify(t);
  C.step(t);
  equal("a step leaves the old position alone", JSON.stringify(t), before);
}

done("sierpinski-dihedral");
