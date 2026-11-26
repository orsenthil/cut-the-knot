#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm-on-circle/perm-on-circle-core.js.
 *
 *   node porting/check-perm-on-circle.mjs
 *
 * The page's claim: multiplying by a transposition changes the number of
 * disjoint cycles by exactly 1, splitting a cycle when both elements lie in
 * it and joining two cycles otherwise. Checked for every permutation of up to
 * 8 elements and every pair, against a second count of cycles and against
 * multiplying by the transposition as a function composition.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const P = loadCore("perm-on-circle/perm-on-circle-core.js", "PermCircleCore");

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* rec(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  }
  yield* rec(0);
}
// a second cycle count: n minus the size of a spanning count via union-find
function cyclesUF(f) {
  const p = f.map((_, i) => i);
  const find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
  f.forEach((v, i) => { p[find(i)] = find(v - 1); });
  return new Set(f.map((_, i) => find(i))).size;
}

equal("the page's circle of a swap: (1 2 3) times (1 3)", P.cycleText(P.swap([2, 3, 1], 1, 3)), "(1)(2 3)");
equal("the arrows leave out fixed points", P.arrows([1, 3, 2, 4]), [[2, 3], [3, 2]]);

for (let n = 2; n <= 8; n++) {
  let bad = 0, wrongKind = 0, wrongComp = 0, parity = 0, total = 0, splits = 0, joins = 0;
  for (const f of perms(n)) {
    const c0 = P.cycles(f).length;
    if (c0 !== cyclesUF(f)) bad++;
    for (let a = 1; a <= n; a++) for (let b = a + 1; b <= n; b++) {
      total++;
      const g = P.swap(f, a, b);
      const c1 = P.cycles(g).length;
      const eff = P.effect(f, a, b);
      if (eff === "split") { splits++; if (c1 !== c0 + 1) wrongKind++; } else { joins++; if (c1 !== c0 - 1) wrongKind++; }
      // composition: g(k) = f(t(k)) with t swapping a and b
      for (let k = 1; k <= n; k++) {
        const t = k === a ? b : k === b ? a : k;
        if (g[k - 1] !== f[t - 1]) wrongComp++;
      }
      if (P.isEven(f) === P.isEven(g)) parity++;
    }
  }
  equal(`n=${n}: cycle counts agree`, bad, 0);
  equal(`n=${n}: ${total} swaps all change the cycle count by 1 as the page says`, wrongKind, 0);
  equal(`n=${n}: the swap is composition with the transposition`, wrongComp, 0);
  equal(`n=${n}: a swap always changes the parity`, parity, 0);
  check(`n=${n}: both splits and joins occur`, splits > 0 && joins > 0);
}
// pressing
let s = P.start({ n: 3, f: [2, 3, 1] });
s = P.press(s, 1);
equal("first press selects", s.first, 1);
s = P.press(s, 1);
equal("the same one deselects", s.first, null);
s = P.press(P.press(s, 1), 3);
equal("second press swaps, and says what happened", [s.f, s.last.effect, s.moves, s.first], [[1, 3, 2], "split", 1, null]);
equal("options are kept in range", [P.clampN(0), P.clampN(99), P.clampN("5")], [2, 20, 5]);
check("a fresh game is a permutation", new Set(P.start({ n: 12 }).f).size === 12);
done("perm-on-circle");
