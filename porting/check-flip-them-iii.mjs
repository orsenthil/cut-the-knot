#!/usr/bin/env node
"use strict";

/*
 * Logic test for flip-them-iii/flip-them-iii-core.js.
 *
 *   node porting/check-flip-them-iii.mjs
 *
 * The page's answer (with g = gcd(M, N), M1 = M/g, N1 = N/g: solvable exactly when M1 is odd, then N1 clicks
 * are the fewest; click every g-th circle) is tested against brute force: for EVERY N from 5 to 20 and EVERY M from 2
 * to min(12, N - 1), all 2^N sets of circles to click once (a circle never needs two clicks, as the page says:
 * two clicks cancel) are tried, and the fewest that turn every circle blue is compared with the page. Then
 * for every N up to 60 and M below N the linear algebra (fewest clicks over the two-element field) agrees, the
 * page's algorithm works when replayed through the game (N up to 24), the order of the clicks does not matter, and
 * when M divides N the answer is N/M.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("flip-them-iii/flip-them-iii-core.js", "FlipThemIIICore");

{
  const s = C.start({});
  check("the applet opens with 12 circles, M = 3, all red", s.n === 12 && s.m === 3 && s.blue.every((b) => b === false) && s.blue.length === 12 && C.result(s) === null);
  check("N runs from 5 to 24 and M from 2 to 12, M below N", C.start({ n: 3 }).n === 5 && C.start({ n: 99 }).n === 24 && C.start({ m: 1 }).m === 2 && C.start({ n: 5, m: 12 }).m === 4 && C.move(s, { type: "n", value: 25 }) === null && C.move(s, { type: "m", value: 13 }) === null);
  check("raising M past N - 1 drags N along", C.move(C.start({ n: 5, m: 3 }), { type: "m", value: 7 }).n === 8);
  const t = C.move(s, { type: "click", i: 10 });
  check("a click flips M successive circles clockwise from the one clicked, wrapping round (10, 11, 0)", t.blue.map((b, i) => (b ? i : -1)).filter((i) => i >= 0).join() === "0,10,11" && t.clicks[10] === 1);
  check("clicking the same circle twice undoes it, and the old position is untouched", C.move(t, { type: "click", i: 10 }).blue.every((b) => !b) && s.moves === 0);
  check("a click outside the ring is refused", C.move(s, { type: "click", i: 12 }) === null);
  let w = C.start({ n: 12, m: 3 });
  for (const i of [0, 3, 6, 9]) w = C.move(w, { type: "click", i });
  check("12 circles, 3 at a time: four clicks (every third circle) turn everything blue, and that is a win", C.allBlue(w) && C.result(w) === "win" && w.moves === 4);
}

{
  // brute force over all sets of clicks
  let pairs = 0, bad = null, solvableCount = 0;
  for (let n = 5; n <= 20; n++) for (let m = 2; m <= Math.min(12, n - 1); m++) {
    const masks = Array.from({ length: n }, (_, i) => { let v = 0; for (let k = 0; k < m; k++) v |= 1 << ((i + k) % n); return v; });
    const full = (1 << n) - 1;
    let best = Infinity;
    // Gray code over all subsets of circles to click
    let cur = 0, count = 0;
    for (let g = 1; g < 1 << n; g++) {
      const bit = 31 - Math.clz32(g & -g);
      cur ^= masks[bit];
      count += ((g ^ (g >> 1)) >> bit) & 1 ? 1 : -1;
      if (cur === full && count < best) best = count;
    }
    const a = C.answer(n, m), f = C.fewest(n, m);
    const brute = best === Infinity ? null : best;
    if (brute !== a.fewest) bad = `N=${n} M=${m}: brute force ${brute}, page ${a.fewest}`;
    if ((f === null ? null : f.clicks.length) !== brute) bad = `N=${n} M=${m}: linear algebra ${f === null ? null : f.clicks.length}, brute force ${brute}`;
    if (f && !f.exact) bad = `kernel too big for N=${n} M=${m}`;
    if (brute !== null) solvableCount++;
    pairs++;
  }
  check(`brute force over every set of clicks agrees with the page (solvable exactly when M1 = M/gcd is odd, N1 = N/gcd clicks) and with the linear algebra, for all ${pairs} pairs with N from 5 to 20 (${solvableCount} solvable)`, bad === null, String(bad));
}

{
  let pairs = 0, bad = null, odd = 0, inexact = 0;
  for (let n = 5; n <= 60; n++) for (let m = 2; m <= n - 1; m++) {
    const a = C.answer(n, m), f = C.fewest(n, m);
    pairs++;
    if ((f === null) !== !a.solvable) { bad = `N=${n} M=${m}: solvable ${f !== null}, page ${a.solvable}`; break; }
    if (f !== null && f.exact && f.clicks.length !== a.fewest) { bad = `N=${n} M=${m}: fewest ${f.clicks.length}, page ${a.fewest}`; break; }
    if (f !== null && !f.exact) { inexact++; if (f.clicks.length < a.fewest) { bad = `a solution shorter than the page's minimum N=${n} M=${m}`; break; } }
    if (n % m === 0 && f !== null && f.exact && f.clicks.length !== n / m) { bad = `M divides N: ${n},${m}`; break; }
    if (n % m === 0 && f === null) { bad = `M divides N but unsolvable ${n},${m}`; break; }
    if (a.solvable) {
      odd++;
      const alg = C.pageAlgorithm(n, m);
      const blue = new Array(n).fill(false);
      for (const i of alg) for (let k = 0; k < m; k++) blue[(i + k) % n] = !blue[(i + k) % n];
      if (!blue.every(Boolean) || alg.length !== a.n1) { bad = `page algorithm ${n},${m}`; break; }
      // the minimal solution of the linear algebra also works
      const b2 = new Array(n).fill(false);
      for (const i of f.clicks) for (let k = 0; k < m; k++) b2[(i + k) % n] = !b2[(i + k) % n];
      if (!b2.every(Boolean)) { bad = `fewest solution ${n},${m}`; break; }
    } else if (C.pageAlgorithm(n, m) !== null) { bad = `algorithm for an unsolvable pair ${n},${m}`; break; }
  }
  check(`for every N from 5 to 60 and M from 2 to N - 1 (${pairs} pairs, ${odd} solvable): solvable exactly when M/gcd(M, N) is odd, then N/gcd(M, N) clicks (N/M when M divides N), the page's every-g-th-circle algorithm works, the fewest solution works (${pairs - inexact} compared exactly with the fewest by trying every combination of the kernel, the rest having a kernel too big to search)`, bad === null, String(bad));
  // order does not matter: random orders of the same clicks give the same colours through the game
  let seed = 9, ordOk = true;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 2000; t++) {
    const n = 5 + rnd(20), m = 2 + rnd(Math.min(11, n - 2));
    const clicks = Array.from({ length: 1 + rnd(2 * n) }, () => rnd(n));
    const play = (order) => { let g = C.start({ n, m }); for (const i of order) g = C.move(g, { type: "click", i }); return g.blue.join(); };
    const shuffled = clicks.slice().sort(() => rnd(3) - 1);
    if (play(clicks) !== play(shuffled)) ordOk = false;
  }
  check("the order of the clicks does not matter (2,000 random click lists, shuffled)", ordOk);
  check("Levitin's puzzle (M = 3, a switch toggles three lights): n lights need n/3 switches when 3 divides n and n switches otherwise (M1 = 3 is odd); M = 4 with N = 10 (M1 = 2) and N = 12, M = 8 (M1 = 2) cannot be solved", C.answer(6, 3).fewest === 2 && C.answer(5, 3).fewest === 5 && C.answer(7, 3).fewest === 7 && C.answer(9, 3).fewest === 3 && C.answer(10, 4).solvable === false && C.answer(12, 8).solvable === false && C.answer(8, 4).fewest === 2);
}

done("flip-them-iii");
