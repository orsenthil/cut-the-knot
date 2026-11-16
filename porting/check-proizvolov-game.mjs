#!/usr/bin/env node
"use strict";

/*
 * Logic test for proizvolov-game/proizvolov-game-core.js.
 *
 *   node porting/check-proizvolov-game.mjs
 *
 * Exhaustively checks Proizvolov's identity for every N-subset of {1..2N}
 * for N up to 8, and the page's "one low, one high" observation on each pair.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("proizvolov-game/proizvolov-game-core.js", "ProizvolovGameCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ n: 5 });
  check("start has 10 numbers and nothing picked", s.pool.length === 10 && s.picked.length === 0);
  check("N clamped", C.start({ n: 1 }).n === 2 && C.start({ n: 99 }).n === 15);
}

{
  let s = C.start({ n: 3 });
  s = C.pick(s, 6);
  s = C.pick(s, 1);
  s = C.pick(s, 4);
  check("after 3 picks the demo is done", C.complete(s) && C.result(s) === "done");
  equal("left is decreasing", C.left(s), [6, 4, 1]);
  equal("right is increasing remaining", C.right(s), [2, 3, 5]);
  check("sum equals N²", C.pairSum(s) === 9);

  const back = C.undo(s);
  check("Take back clears the finish", !C.complete(back) && back.showAll === false);
  equal("picked after Take back", back.picked, [6, 1]);
}

{
  let s = C.start({ n: 2 });
  check("cannot pick twice", C.pick(C.pick(s, 1), 1).picked.length === 1);
  check("cannot pick outside the pool", C.pick(s, 99).picked.length === 0);
}

/* ------------------------------------------- 2. every case, where it is small */

function* combinations(arr, k) {
  const n = arr.length;
  if (k < 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

{
  let subsets = 0;
  for (let n = 2; n <= 8; n++) {
    const pool = [];
    for (let i = 1; i <= 2 * n; i++) pool.push(i);
    for (const pick of combinations(pool, n)) {
      let s = C.start({ n });
      for (const v of pick) s = C.pick(s, v);
      check("sum is N² for n=" + n + " pick=" + pick, C.pairSum(s) === C.expected(n));
      const pairs = C.pairsSplitLowHigh(s);
      check(
        "each pair splits low/high n=" + n,
        pairs.every((p) => p.split),
      );
      subsets++;
    }
  }
  // C(4,2)+C(6,3)+…+C(16,8)
  check("checked many subsets", subsets > 1000);
}

{
  // Algebra check of the closed form on the page.
  for (let n = 2; n <= 15; n++) {
    let high = 0;
    let low = 0;
    for (let i = 1; i <= n; i++) low += i;
    for (let i = n + 1; i <= 2 * n; i++) high += i;
    check("high − low = N² for n=" + n, high - low === n * n);
  }
}

/* ----------------------------- 3. the same answers as a second method */

{
  // Direct computation without the core's left/right helpers.
  function identitySum(picked, n) {
    const a = picked.slice().sort((x, y) => y - x);
    const set = new Set(picked);
    const b = [];
    for (let i = 1; i <= 2 * n; i++) if (!set.has(i)) b.push(i);
    b.sort((x, y) => x - y);
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    return s;
  }

  let compared = 0;
  for (let n = 2; n <= 6; n++) {
    const pool = [];
    for (let i = 1; i <= 2 * n; i++) pool.push(i);
    for (const pick of combinations(pool, n)) {
      let s = C.start({ n });
      for (const v of pick) s = C.pick(s, v);
      check("core matches direct sum", C.pairSum(s) === identitySum(pick, n));
      compared++;
    }
  }
  check("compared many direct sums", compared > 100);
}

done("proizvolov-game");
