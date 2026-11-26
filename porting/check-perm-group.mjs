#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm-group/perm-group-core.js.
 *
 *   node porting/check-perm-group.mjs
 *
 * Lemma 1 of the page, checked on every pair of permutations of up to 5
 * elements (and 20,000 random pairs of up to 12): the cycles of f^-1 g f are
 * the cycles of g with each element a replaced by f(a). So conjugates have the
 * same cycle shape; fg and gf are conjugate and have the same shape (so
 * "fg and gf look alike" is true even when they differ); the cycles start at
 * their smallest element; the page's rotation example (1 3 8 4).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const G = loadCore("perm-group/perm-group-core.js", "PermGroupCore");

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* rec(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  }
  yield* rec(0);
}
const key = (cs) => cs.map((c) => G.normal(c).join(" ")).sort().join("|");

equal("the page's four spellings of one cycle", [[1, 3, 8, 4], [3, 8, 4, 1], [8, 4, 1, 3], [4, 1, 3, 8]].map((c) => G.normal(c)), [[1, 3, 8, 4], [1, 3, 8, 4], [1, 3, 8, 4], [1, 3, 8, 4]]);
equal("cycles are written from the smallest element", G.cycleText([3, 1, 2]), "(1 3 2)");
equal("list notation", G.listText([2, 1, 3]), "{2, 1, 3}");

function lemma(f, g) {
  const c = G.conjugate(f, g);
  let ok = key(G.cycles(c)) === key(G.relabelled(f, g));
  const e = G.everything(f, g);
  ok = ok && G.shape(e.fg).join() === G.shape(e.gf).join();
  ok = ok && G.shape(e.fgf).join() === G.shape(g).join();
  ok = ok && G.shape(e.gfg).join() === G.shape(f).join();
  ok = ok && G.cycles(e.fgf).every((cy) => cy[0] === Math.min.apply(null, cy));
  return ok;
}
for (let n = 2; n <= 5; n++) {
  const all = [...perms(n)];
  let bad = 0, total = 0, differ = 0;
  for (const f of all) for (const g of all) {
    total++;
    if (!lemma(f, g)) bad++;
    if (G.product(f, g).join() !== G.product(g, f).join()) differ++;
  }
  equal(`n=${n}: Lemma 1 and the shapes hold for all ${total} pairs`, bad, 0);
  if (n >= 3) check(`n=${n}: fg and gf can differ`, differ > 0);
}
const rand = rng(11);
let bad = 0;
for (let i = 0; i < 20000; i++) {
  const n = 2 + Math.floor(rand() * 11);
  if (!lemma(G.shuffle(n, rand), G.shuffle(n, rand))) bad++;
}
equal("20,000 random pairs up to 12 elements", bad, 0);
// the products follow the page's order
equal("fg: f first", G.product([2, 3, 1], [1, 3, 2]), [3, 2, 1]);
equal("(1 2) conjugated by f = (1 2 3) is (f(1) f(2)) = (2 3)", G.cycleText(G.conjugate([2, 3, 1], [2, 1, 3])), "(1)(2 3)");
const s = G.start({ n: 5, cycles: true });
equal("a new game has two real permutations", [new Set(s.f).size, new Set(s.g).size, s.cycles], [5, 5, true]);
equal("options are kept in range", [G.clampN(0), G.clampN(99), G.clampN("5")], [2, 20, 5]);
done("perm-group");
