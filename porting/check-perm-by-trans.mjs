#!/usr/bin/env node
"use strict";

/*
 * Logic test for perm-by-trans/perm-by-trans-core.js.
 *
 *   node porting/check-perm-by-trans.mjs
 *
 * Sliding down the poles (the applet's itinerary) is compared with swapping
 * entries at the ends of every shuttle, for every placement of up to 4
 * shuttles on 4 poles (all heights, all pole pairs). The page's claims: the
 * result is always a permutation; the parity of the number of shuttles is the
 * parity of the permutation; every permutation of up to 6 poles can be made,
 * and with n minus (number of cycles) shuttles and no fewer.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const T = loadCore("perm-by-trans/perm-by-trans-core.js", "PermTransCore");

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* rec(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  }
  yield* rec(0);
}
const stateOf = (n, bars) => {
  let s = T.start({ n });
  for (const [h, a, b] of bars) { const r = T.add(s, h, a, b); if (!r.state) return null; s = r.state; }
  return s;
};

// refusals
const s0 = T.start({ n: 5 });
equal("no shuttle: the identity", T.permutation(s0), [1, 2, 3, 4, 5]);
equal("the same pole twice is refused", T.add(s0, 1, 3, 3).error, "A shuttle needs two different poles.");
const s1 = T.add(s0, 2, 1, 4).state;
equal("a height holds one shuttle", T.add(s1, 2, 2, 3).error, "This height is occupied! Select another.");
equal("a shuttle from 1 to 4 sends 1 to 4 and 4 to 1", T.permutation(s1), [4, 2, 3, 1, 5]);
equal("its transposition is written (1,4)", T.transpositions(s1), ["(1,4)"]);
equal("two shuttles: the second one acts after the first", T.permutation(stateOf(3, [[1, 1, 2], [2, 2, 3]])), [3, 1, 2]);
equal("... and in the other order the other way round", T.permutation(stateOf(3, [[1, 2, 3], [2, 1, 2]])), [2, 3, 1]);
equal("removing the last one added", T.permutation(T.removeLast(stateOf(3, [[5, 1, 2], [2, 2, 3]]))), [2, 1, 3]);

// every placement of up to 4 shuttles on 4 poles at heights 1..4
const pairs = [];
for (let a = 1; a <= 4; a++) for (let b = a + 1; b <= 4; b++) pairs.push([a, b]);
let cases = 0, mismatch = 0, notPerm = 0, parity = 0;
(function rec(heightFrom, bars) {
  const s = stateOf(4, bars);
  cases++;
  const f = T.permutation(s);
  if (f.join() !== T.permutationBySwaps(s).join()) mismatch++;
  if (new Set(f).size !== 4) notPerm++;
  if (T.isEven(f) !== (bars.length % 2 === 0)) parity++;
  if (bars.length === 4) return;
  for (let h = heightFrom; h <= 4; h++) for (const [a, b] of pairs) rec(h + 1, bars.concat([[h, a, b]]));
})(1, []);
equal(`${cases} placements: sliding down equals swapping entries`, mismatch, 0);
equal("the result is always a permutation", notPerm, 0);
equal("the parity of the shuttles is the parity of the permutation", parity, 0);

// every permutation, with the fewest shuttles
for (let n = 2; n <= 6; n++) {
  let bad = 0, most = 0, count = 0;
  for (const f of perms(n)) {
    count++;
    const bars = T.build(f);
    let s = T.start({ n });
    for (const x of bars) s = T.add(s, x.h, x.a, x.b).state;
    if (T.permutation(s).join() !== f.join()) bad++;
    if (bars.length !== T.fewest(f)) bad++;
    most = Math.max(most, bars.length);
  }
  equal(`n=${n}: all ${count} permutations are made, each with n - cycles shuttles`, bad, 0);
  equal(`n=${n}: never more than n-1 shuttles`, most, n - 1);
}
// fewer shuttles cannot do it: any placement of k shuttles reaches only permutations with n - cycles <= k (checked on 4 poles)
let tooGood = 0;
(function rec(heightFrom, bars) {
  const f = T.permutation(stateOf(4, bars));
  if (T.fewest(f) > bars.length) tooGood++;
  if (bars.length === 4) return;
  for (let h = heightFrom; h <= 4; h++) for (const [a, b] of pairs) rec(h + 1, bars.concat([[h, a, b]]));
})(1, []);
equal("k shuttles never make a permutation that needs more than k", tooGood, 0);
equal("options are kept in range", [T.clampN(0), T.clampN(99), T.clampN("5")], [2, 20, 5]);
check("there are 12 heights", T.LEVELS === 12);
done("perm-by-trans");
