#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm/perm-core.js.
 *
 *   node porting/check-perm.mjs
 *
 * Every permutation of up to 8 elements is run through its table of
 * inversions and back (Marshall Hall's theorem), through its cycles and its
 * inverse. The page's example 5 9 1 8 2 6 4 7 3 gives (2,3,6,4,0,2,2,1,0). The
 * backwards shuffle is run over every possible sequence of random choices for
 * n <= 7: each permutation comes out exactly once, so the shuffle is fair.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const P = loadCore("perm/perm-core.js", "PermCore");

const ex = [5, 9, 1, 8, 2, 6, 4, 7, 3];
equal("the page's list of inversions", P.inversions(ex), [2, 3, 6, 4, 0, 2, 2, 1, 0]);
equal("and back again", P.fromInversions([2, 3, 6, 4, 0, 2, 2, 1, 0]), ex);
equal("its cycles", P.cycleText(ex), "(1 5 2 9 3)(4 8 7)(6)");
equal("its inverse", P.inverse(ex), [3, 5, 9, 7, 1, 6, 8, 4, 2]);

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* rec(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      yield* rec(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  }
  yield* rec(0);
}

for (let n = 2; n <= 8; n++) {
  let count = 0, bad = 0, badInv = 0, badCyc = 0, lastZero = 0;
  const tables = new Set();
  for (const f of perms(n)) {
    count++;
    const a = P.inversions(f);
    tables.add(a.join(","));
    if (a[n - 1] !== 0) lastZero++;
    if (!P.validInversions(a)) badInv++;
    if (P.fromInversions(a).join() !== f.join()) bad++;
    if (P.inverse(P.inverse(f)).join() !== f.join()) bad++;
    // the cycles cover every element once and follow f
    const cs = P.cycles(f);
    if (cs.reduce((s, c) => s + c.length, 0) !== n) badCyc++;
    for (const c of cs) for (let i = 0; i < c.length; i++) if (f[c[i] - 1] !== c[(i + 1) % c.length]) badCyc++;
  }
  const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320][n];
  equal(`n=${n}: ${fact} permutations`, count, fact);
  equal(`n=${n}: every table of inversions is different, so there are n! of them`, tables.size, fact);
  equal(`n=${n}: the table gives the permutation back`, bad, 0);
  equal(`n=${n}: a_n is always 0 and a_i <= n-i`, [lastZero, badInv], [0, 0]);
  equal(`n=${n}: cycles follow f`, badCyc, 0);
}
// a_{n-1} is 0 or 1, a_{n-2} is 0..2 and each value really occurs
const seen = [new Set(), new Set(), new Set()];
for (const f of perms(6)) { const a = P.inversions(f); seen[0].add(a[4]); seen[1].add(a[3]); seen[2].add(a[2]); }
equal("a_{n-1}, a_{n-2}, a_{n-3} take 2, 3 and 4 values", seen.map((s) => s.size), [2, 3, 4]);

// the shuffle, over every sequence of random choices (r = 0..i for i = n-1 down to 1)
for (let n = 2; n <= 7; n++) {
  const all = new Set();
  const choices = [];
  let total = 0;
  (function rec(i) {
    if (i === 0) {
      const seq = choices.slice();
      let k = 0;
      // choices[k] is the pick for i = n-1-k; feed it through `random` as (r + 0.5) / (i + 1)
      const f = P.shuffle(n, () => { const idx = n - 1 - k; const r = seq[k++]; return (r + 0.5) / (idx + 1); });
      all.add(f.join());
      total++;
      return;
    }
    for (let r = 0; r <= i; r++) { choices.push(r); rec(i - 1); choices.pop(); }
  })(n - 1);
  const fact = [1, 1, 2, 6, 24, 120, 720, 5040][n];
  equal(`shuffle n=${n}: ${fact} choice sequences give ${fact} different permutations`, [total, all.size], [fact, fact]);
}
equal("options are kept in range", [P.clampN(1), P.clampN(99), P.clampN("12"), P.clampN(NaN)], [2, 20, 12, 9]);
const s = P.start({ n: 5, f: [2, 1, 4, 3, 5], view: "lines" });
equal("a given permutation is kept", [s.f, s.view], [[2, 1, 4, 3, 5], "lines"]);
check("a bad one is replaced by a real permutation", P.isPermutation(P.start({ n: 5, f: [1, 1, 2, 3, 4] }).f));
done("perm");
