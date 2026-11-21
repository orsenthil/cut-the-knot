#!/usr/bin/env node
"use strict";

/*
 * Logic test for flip-them-ii/flip-them-ii-core.js.
 *
 *   node porting/check-flip-them-ii.mjs
 *
 * The page's claim for M dividing N (N = 12, M = 3, 4, 6 and every other pair in the applet's range, for M >= 3;
 * for M = 2 every circle is marked and the claim fails: the target is reachable):
 * the target is unreachable, checked three ways: (1) by exploring EVERY state reachable from the start by
 * clicks (a search of the whole state graph, N up to 16), (2) by the invariant (the marked circles: every
 * M successive hold exactly two, every click changes exactly two of them, the parity of the blue marked
 * circles never changes, the start is marked and the target is not), checked over random plays, and
 * (3) by solving the equations over the two-element field. Beyond the page, for ALL pairs the applet allows
 * (N = 5..24, M = 2..min(12, N-1)) and for N up to 60: the search of the state graph (N <= 16) and the linear
 * algebra agree, the target is reachable exactly when gcd(M, N) = 1 or gcd(M, N) = 2 with M = 2 mod 4, and
 * every solution the solver finds works when replayed through the game.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("flip-them-ii/flip-them-ii-core.js", "FlipThemIICore");

{
  const s = C.start({});
  check("the applet opens with 12 circles, M = 3, the last circle blue, the helper off", s.n === 12 && s.m === 3 && s.blue.filter(Boolean).length === 1 && s.blue[11] === true && s.helper === false && C.result(s) === null);
  check("N runs from 5 to 24 and M from 2 to 12, M below N", C.start({ n: 3 }).n === 5 && C.start({ n: 99 }).n === 24 && C.start({ m: 1 }).m === 2 && C.start({ n: 5, m: 12 }).m === 4 && C.move(s, { type: "n", value: 25 }) === null && C.move(s, { type: "m", value: 13 }) === null);
  check("raising M past N - 1 drags N along, as the applet's spinners do", C.move(C.start({ n: 5, m: 3 }), { type: "m", value: 7 }).n === 8 && C.move(C.start({ n: 24, m: 3 }), { type: "m", value: 12 }).n === 24);
  const t = C.move(s, { type: "click", i: 0 });
  check("a click flips M successive circles clockwise from the one clicked (circles 0, 1, 2)", t.blue.map((b, i) => (b ? i : -1)).filter((i) => i >= 0).join() === "0,1,2,11");
  const u = C.move(s, { type: "click", i: 10 });
  check("the flips wrap round the ring: clicking 10 flips 10, 11 and 0", u.blue.map((b, i) => (b ? i : -1)).filter((i) => i >= 0).join() === "0,10" && u.blue[11] === false);
  check("clicking the same circle twice undoes it, and the old position is untouched", C.move(t, { type: "click", i: 0 }).blue.join() === s.blue.join() && s.moves === 0);
  check("a click outside the ring is refused", C.move(s, { type: "click", i: 12 }) === null && C.move(s, { type: "click", i: -1 }) === null);
  check("the helper can only be switched on when M divides N", C.move(s, { type: "helper", value: true }).helper === true && C.move(C.start({ n: 12, m: 5 }), { type: "helper", value: true }) === null);
  check("the marked circles for N = 12, M = 3: (i + 1) mod 3 is 0 or 2, so circles 1, 2, 4, 5, 7, 8, 10, 11 (0-based)", C.marked(s).map((b, i) => (b ? i : -1)).filter((i) => i >= 0).join() === "1,2,4,5,7,8,10,11");
  // winning through the game: a solvable pair
  let w = C.start({ n: 7, m: 3 });
  for (const i of C.solve(7, 3)) w = C.move(w, { type: "click", i });
  check("a solvable game (N = 7, M = 3) is won by the solver's clicks", C.result(w) === "win" && C.reached(w));
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

{
  // (1) the state graph, N up to 16, every M of the applet's range
  let pairs = 0, bad = null;
  const reachableTarget = (n, m) => {
    const full = (1 << n) - 1, win = (1 << (m)) - 1; // window mask for i = 0
    const masks = Array.from({ length: n }, (_, i) => { let v = 0; for (let k = 0; k < m; k++) v |= 1 << ((i + k) % n); return v; });
    const start = 1 << (n - 1), target = 1;
    const seen = new Uint8Array(1 << n); const queue = [start]; seen[start] = 1;
    for (let h = 0; h < queue.length; h++) { const v = queue[h]; if (v === target) return true; for (const mk of masks) { const w = v ^ mk; if (!seen[w]) { seen[w] = 1; queue.push(w); } } }
    return false;
  };
  for (let n = 5; n <= 16; n++) for (let m = 2; m <= Math.min(12, n - 1); m++) {
    pairs++;
    const bfs = reachableTarget(n, m), alg = C.solve(n, m) !== null, rule = C.rule(n, m);
    if (bfs !== alg || bfs !== rule) bad = `N=${n} M=${m}: search ${bfs}, equations ${alg}, rule ${rule}`;
    if (n % m === 0 && m >= 3 && bfs) bad = `M divides N=${n} M=${m} (M >= 3) but the target is reachable`;
  }
  check(`exploring every reachable state agrees with the equations over the two-element field and with the gcd rule, for all ${pairs} pairs with N <= 16; when M >= 3 divides N the target is never reachable`, bad === null, String(bad));
  let none = true;
  for (const m of [3, 4, 6]) if (reachableTarget(12, m)) none = false;
  check("the original puzzle: N = 12 with M = 3, 4 and 6 has no solution (every reachable state of the whole graph was examined)", none);
  check("but the page's argument needs M >= 3: for M = 2 (which divides every even N) every circle is marked, the target included, and the target IS reachable (click neighbouring pairs)", reachableTarget(12, 2) && C.solve(12, 2) !== null && C.rule(12, 2));
}

{
  // (2) the invariant for M | N
  let seed = 11, bad = null, cases = 0;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let n = 5; n <= 24; n++) for (let m = 2; m <= Math.min(12, n - 1); m++) {
    if (n % m !== 0) continue;
    cases++;
    const s0 = C.start({ n, m }), mk = C.marked(s0);
    if (m >= 3 && (mk[0] || !mk[n - 1])) bad = `start/target marks n=${n} m=${m}`;
    // among any M successive circles exactly two are marked
    for (let i = 0; i < n; i++) if (C.window(s0, i).filter((j) => mk[j]).length !== 2) bad = `window ${i} of n=${n} m=${m}`;
    let st = s0;
    const parity = (x) => x.blue.filter((b, i) => b && mk[i]).length % 2;
    for (let step = 0; step < 300; step++) {
      const i = rnd(n); const before = st; st = C.move(st, { type: "click", i });
      if (C.window(st, i).filter((j) => mk[j]).length !== 2) bad = `click flips two marked n=${n}`;
      if (parity(st) !== 1) bad = `parity changed n=${n} m=${m} step=${step}`;
      if (C.reached(st) && m >= 3) bad = `target reached with M | N: n=${n} m=${m}`;
    }
  }
  check(`when M divides N (${cases} pairs): every M successive circles hold exactly two marked ones, the start is marked and the target is not, a click changes two marked circles, the number of blue marked circles stays odd over 300 random clicks each, and the target is never reached`, bad === null, String(bad));
}

{
  // (3) all pairs up to N = 60: the rule, and every solution replayed
  let pairs = 0, solvable = 0, bad = null;
  for (let n = 5; n <= 60; n++) for (let m = 2; m <= n - 1; m++) {
    const sol = C.solve(n, m), rule = C.rule(n, m);
    pairs++;
    if ((sol !== null) !== rule) { bad = `N=${n} M=${m}: solver ${sol !== null}, rule ${rule}`; break; }
    if (sol) {
      solvable++;
      // replay by hand (the game itself stops at N = 24)
      const blue = new Array(n).fill(false); blue[n - 1] = true;
      for (const i of sol) for (let k = 0; k < m; k++) blue[(i + k) % n] = !blue[(i + k) % n];
      if (!blue.every((b, i) => b === (i === 0))) { bad = `replay N=${n} M=${m}`; break; }
      if (n <= 24 && m <= 12) { let g = C.start({ n, m }); for (const i of sol) g = C.move(g, { type: "click", i }); if (!C.reached(g)) { bad = `game replay N=${n} M=${m}`; break; } }
    }
  }
  check(`for every pair with N from 5 to 60 and M from 2 to N - 1 (${pairs} pairs, ${solvable} solvable) the target is reachable exactly when gcd(M, N) = 1, or gcd(M, N) = 2 and M = 2 (mod 4), and every solution found works when replayed`, bad === null, String(bad));
  const table = []; for (let n = 5; n <= 24; n++) { let row = ""; for (let m = 2; m <= Math.min(12, n - 1); m++) row += C.rule(n, m) ? "Y" : "."; table.push(`${n}:${row}`); }
  console.log("   (applet range, M = 2.. : " + table.slice(0, 8).join(" ") + " ...)");
  check("the necessity: if gcd(M, N) = g, circles in the same class mod g are always flipped together in equal numbers, so with g > 2 (or g = 2 and M = 0 mod 4) the target is out of reach; examples: (12, 4), (10, 4), (9, 3), (20, 8)", !C.rule(12, 4) && !C.rule(10, 4) && !C.rule(9, 3) && !C.rule(20, 8) && C.rule(10, 6) && C.rule(12, 5) && C.rule(14, 6) && C.rule(8, 2));
}

done("flip-them-ii");
