#!/usr/bin/env node
"use strict";

/*
 * Logic test for steinhaus-problem/steinhaus-problem-core.js.
 *
 *   node porting/check-steinhaus-problem.mjs
 *
 * 1. The page's examples: both of Steinhaus's tens, the two fourteens and
 *    Guy's seventeen all pass the applet's check for every k.
 * 2. Warmus's theorem, by an exact search: the pieces each number falls in
 *    are all that matter, so a backtracking search over pieces, with every
 *    fraction over lcm(1..18), finds sequences of every length up to 17
 *    and proves that none of length 18 exists. (Schinzel's 75 is then far
 *    beyond.)
 * 3. The applet's drops (.xx0 or .xx5), TheFirstOK, the check, Remove last.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("steinhaus-problem/steinhaus-problem-core.js", "SteinhausProblemCore");

for (const [name, seq] of Object.entries(C.EXAMPLES)) {
  const s = C.start({ places: seq });
  check(`${name} passes for every k up to ${seq.length}`, C.ok(s) && C.goodPrefix(s) === seq.length);
}

{
  let L = 1;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let k = 1; k <= 18; k++) L = (L / gcd(L, k)) * k;
  let nodes = 0;
  function level(k, ivs, N, out) {
    nodes++;
    if (k > N) { out.push(ivs.map(([lo, hi]) => (lo + hi) / 2 / L)); return true; }
    const pts = ivs.concat([[0, L]]), used = new Array(k).fill(false), next = new Array(k), W = L / k;
    const assign = (i) => {
      if (i === k) return level(k + 1, next.slice(), N, out);
      const [lo, hi] = pts[i];
      for (let b = Math.floor(lo / W); b * W < hi && b < k; b++) {
        if (used[b]) continue;
        const nlo = Math.max(lo, b * W), nhi = Math.min(hi, (b + 1) * W);
        if (nlo >= nhi) continue;
        used[b] = true; next[i] = [nlo, nhi];
        if (assign(i + 1)) return true;
        used[b] = false;
      }
      return false;
    };
    return assign(0);
  }
  let upTo17 = true, witnessOK = true;
  for (let n = 1; n <= 17; n++) {
    const out = [];
    if (!level(1, [], n, out)) upTo17 = false;
    else {
      // the witness, as exact fractions' midpoints, passes the same check
      const x = out[0];
      for (let k = 1; k <= n; k++) {
        const hits = new Array(k).fill(0);
        for (let i = 0; i < k; i++) hits[Math.floor(x[i] * k)]++;
        if (hits.some((h) => h !== 1)) witnessOK = false;
      }
    }
  }
  check("exact search: sequences exist for every length up to 17", upTo17 && witnessOK);
  nodes = 0;
  check("and none of length 18 (Warmus's theorem)", !level(1, [], 18, []));
  check("the search for 18 is complete, not cut short", nodes > 1000, String(nodes));
}

{
  equal("a drop 3 thousandths past .12 lands on .12", C.format(C.snap(123)), ".12");
  equal("5 past lands on .125", C.format(C.snap(125)), ".125");
  equal("7 past rounds up to .13", C.format(C.snap(127)), ".13");
  equal("the ends: 0 and 1.00", `${C.format(C.snap(-40))} ${C.format(C.snap(1004))}`, ".00 1.00");
  check("1.00 lies outside every piece: one number at 1 fails", !C.ok(C.start({ places: [1000] })) && C.ok(C.start({ places: [995] })));
  let s = C.start();
  s = C.place(s, 0, 300); s = C.place(s, 1, 800);
  check("0.3, 0.8: different halves", C.ok(s));
  s = C.place(s, 2, 200);
  equal("0.2 shares the first third with 0.3: only the first two pass", C.goodPrefix(s), 2);
  equal("trouble: piece 1 of 3 crowded by tiles 1 and 3", JSON.stringify(C.trouble(s).crowded), JSON.stringify([{ piece: 1, tiles: [1, 3] }]));
  s = C.place(s, 2, 550);
  check("moving tile 3 to 0.55 fixes it", C.ok(s));
  equal("Remove last", C.removeLast(s).places.length, 2);
  check("tiles go on in order, at most 18", C.place(s, 5, 100) === null && C.removeLast(C.start()) === null);
  const before = JSON.stringify(s);
  C.place(s, 0, 10);
  equal("a drop leaves the old position alone", JSON.stringify(s), before);
}

done("steinhaus-problem");
