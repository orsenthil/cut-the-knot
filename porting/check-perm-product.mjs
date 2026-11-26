#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm-product/perm-product-core.js.
 *
 *   node porting/check-perm-product.mjs
 *
 * With the page's convention (fg)(k) = g(f(k)), every pair of permutations of
 * up to 5 elements is multiplied and compared with following k through f and
 * then g; associativity, the identity, inverses (fg)^-1 = g^-1 f^-1 and the
 * sign rule sign(fg) = sign(f) sign(g) are checked on all of them, and that
 * the product is not commutative once n >= 3. Pressing two numbers is a
 * product with a transposition.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const P = loadCore("perm-product/perm-product-core.js", "PermProductCore");

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* rec(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  }
  yield* rec(0);
}
const sign = (f) => (P.isEven(f) ? 1 : -1);
const same = (a, b) => a.join() === b.join();

equal("1 -> 2 -> 3: (1 2 3) times (1 2 3) is (1 3 2)", P.product([2, 3, 1], [2, 3, 1]), [3, 1, 2]);
equal("the left one is carried out first", P.product([2, 1, 3], [1, 3, 2]), [3, 1, 2]);
equal("and not the other way round", P.product([1, 3, 2], [2, 1, 3]), [2, 3, 1]);

for (let n = 2; n <= 5; n++) {
  const all = [...perms(n)];
  const id = all[0];
  let bad = 0, assoc = 0, inv = 0, sgn = 0, noncomm = 0, pairs = 0, tr = 0;
  for (const f of all) {
    if (!same(P.product(f, id), f) || !same(P.product(id, f), f)) bad++;
    if (!same(P.product(f, P.inverse(f)), id) || !same(P.product(P.inverse(f), f), id)) inv++;
    for (const g of all) {
      pairs++;
      const fg = P.product(f, g);
      // follow each k through f, then g
      for (let k = 1; k <= n; k++) if (fg[k - 1] !== g[f[k - 1] - 1]) bad++;
      if (!same(P.inverse(fg), P.product(P.inverse(g), P.inverse(f)))) inv++;
      if (sign(fg) !== sign(f) * sign(g)) sgn++;
      if (!same(fg, P.product(g, f))) noncomm++;
    }
    if (n <= 4) for (const g of all) for (const h of all) if (!same(P.product(P.product(f, g), h), P.product(f, P.product(g, h)))) assoc++;
    // times() is the product with the transposition on the right
    for (let a = 1; a <= n; a++) for (let b = a + 1; b <= n; b++) {
      const t = id.slice(); t[a - 1] = b; t[b - 1] = a;
      if (!same(P.times(f, a, b), P.product(f, t))) tr++;
    }
  }
  equal(`n=${n}: ${pairs} products agree with following k through f then g, and the identity`, bad, 0);
  equal(`n=${n}: inverses`, inv, 0);
  equal(`n=${n}: sign(fg) = sign(f) sign(g)`, sgn, 0);
  equal(`n=${n}: pressing two numbers is the product with a transposition`, tr, 0);
  if (n <= 4) equal(`n=${n}: associative`, assoc, 0);
  if (n >= 3) check(`n=${n}: the product is not commutative`, noncomm > 0);
  else equal("n=2: it is commutative", noncomm, 0);
}
let s = P.start({ n: 4, f: [2, 3, 4, 1], g: [1, 2, 3, 4] });
s = P.press(P.press(s, "f", 1), "f", 2);
equal("two presses in f swap the values 1 and 2", s.f, [1, 3, 4, 2]);
s = P.press(P.press(s, "f", 1), "g", 2);
equal("a press in the other permutation starts over", [s.pick, s.f, s.g], [{ which: "g", x: 2 }, [1, 3, 4, 2], [1, 2, 3, 4]]);
equal("options are kept in range", [P.clampN(0), P.clampN(99), P.clampN("5")], [2, 20, 5]);
check("a fresh game has two permutations", new Set(P.start({ n: 9 }).f).size === 9 && new Set(P.start({ n: 9 }).g).size === 9);
done("perm-product");
