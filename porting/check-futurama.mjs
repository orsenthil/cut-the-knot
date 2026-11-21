#!/usr/bin/env node
"use strict";

/*
 * Logic test for futurama/futurama-core.js.
 *
 *   node porting/check-futurama.mjs
 *
 * The Futurama theorem, tested: for EVERY permutation of 3 and of 4 people (with the clean X and Y), a way to
 * undo it exists using only swaps with X or Y and no pair twice, found by the game's own search and replayed
 * through the game's rules; for 120 random permutations of 5 to 7 people the search also finds one; the lemmas
 * of the page ((a b c ... f)(a b) = (a c ... f)(b); (a b c ... e f)(a x) = (a x b c ... e f); (a x y b)(x b) = (a x)(b y)) are
 * checked as products of permutations; and the rules of play follow the applet (no pair twice, a swap must involve X or Y,
 * Take back frees the pair).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("futurama/futurama-core.js", "FuturamaCore");

const perms = (n) => { const out = []; const a = Array.from({ length: n }, (_, i) => i); const rec = (k) => { if (k === n) { out.push(a.slice()); return; } for (let j = k; j < n; j++) { [a[k], a[j]] = [a[j], a[k]]; rec(k + 1); [a[k], a[j]] = [a[j], a[k]]; } }; rec(0); return out; };

{
  const s = C.start({ seed: 5 });
  check("a new game has 7 people and X, Y in the last two places, mixed up, none swapped yet", s.n === 7 && s.perm.length === 9 && s.perm[7] === 7 && s.perm[8] === 8 && !C.straight(s) && s.usedX.length === 0 && s.usedY.length === 0 && C.result(s) === null);
  check("every new game is a real permutation of the people and never already straight", Array.from({ length: 300 }, (_, k) => C.start({ seed: k + 1, n: 3 + (k % 10) })).every((g) => !C.straight(g) && new Set(g.perm).size === g.n + 2));
  check("N runs from 3 to 12", C.start({ n: 2 }).n === 3 && C.start({ n: 99 }).n === 12 && C.move(s, { type: "n", value: 13 }) === null);
  const w = C.move(s, { type: "swap", i: 0, j: 1 });
  equal("a swap involving neither X nor Y is refused with the applet's message", w.message, "Only swap with X or Y");
  check("a refused swap changes nothing", w.perm.join() === s.perm.join() && w.stack.length === 0);
  const a = C.move(s, { type: "swap", i: 0, j: 7 });
  check("a swap with X exchanges the two minds and is remembered", a.perm[0] === s.perm[7] && a.perm[7] === s.perm[0] && a.usedX.join() === "0" && a.stack.length === 1);
  equal("the same pair cannot swap again", C.move(a, { type: "swap", i: 7, j: 0 }).message, "Already swapped");
  const b = C.move(a, { type: "swap", i: 0, j: 8 });
  check("the same body may swap with Y (a different pair), and X with Y too", b.usedY.join() === "0" && C.move(b, { type: "swap", i: 7, j: 8 }).usedX.join() === "0,8" && C.move(b, { type: "swap", i: 7, j: 8 }).usedY.join() === "0,7");
  const back = C.move(C.move(b, { type: "back" }), { type: "back" });
  check("Take back undoes the swaps one by one and frees the pairs", back.perm.join() === s.perm.join() && back.usedX.length === 0 && back.usedY.length === 0 && C.move(back, { type: "back" }) === null && C.move(back, { type: "swap", i: 0, j: 7 }).message === "");
  check("a swap with itself or a body that does not exist is refused", C.move(s, { type: "swap", i: 7, j: 7 }) === null && C.move(s, { type: "swap", i: 0, j: 9 }) === null);
  check("the old position is untouched", s.stack.length === 0 && s.moves === 0);
}

{
  // every permutation of 3 and of 4 people
  let n = 0, bad = null, longest = 0;
  for (const size of [3, 4]) for (const p of perms(size)) {
    if (p.every((v, i) => v === i)) continue;
    const s = C.start({ n: size, perm: p.concat([size, size + 1]) });
    const sol = C.solve(s);
    if (!sol) { bad = `no solution for ${p} (n=${size})`; break; }
    let g = s;
    for (const [i, j] of sol) { const r = C.swap(g, i, j); if (!r || r.message === "Already swapped" || r.message === "Only swap with X or Y") { bad = `illegal swap in the solution of ${p}`; break; } g = r; }
    if (!C.straight(g) || C.result({ ...g, explored: true }) !== "win") bad = bad || `replay fails ${p}`;
    longest = Math.max(longest, sol.length); n++;
  }
  check(`every non-identity permutation of 3 and 4 people (${n}) can be undone with swaps that involve X or Y and no pair twice; the longest solution found has ${longest} swaps`, bad === null, String(bad));
  let seed = 1, bad2 = null, found = 0;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 120 && !bad2; t++) {
    const size = 5 + (t % 3), g0 = C.start({ n: size, seed: 100 + t });
    const sol = C.solve(g0, 3000000);
    if (!sol) { bad2 = `no solution found for ${g0.perm}`; break; }
    let g = g0; for (const [i, j] of sol) g = C.swap(g, i, j);
    if (!C.straight(g)) bad2 = `replay ${g0.perm}`;
    found++;
  }
  check(`120 random mix-ups of 5, 6 and 7 people were all undone (${found} found) and replayed`, bad2 === null, String(bad2));
}

{
  // the lemmas as products of permutations: t = p q means apply p first, then q (the page); cycles on the element set 0..n-1
  const cyc = (n, ...cycles) => { const p = Array.from({ length: n }, (_, i) => i); for (const c of cycles) for (let k = 0; k < c.length; k++) p[c[k]] = c[(k + 1) % c.length]; return p; };
  const prod = (p, q) => q.map((v) => p[v]); // the page's product pq of cycles, where (a b ...) sends each element to the next: q acts first on the array of minds
  const eq = (p, q) => p.join() === q.join();
  // Lemma 1: (a b c d)(a b) = (a c d)(b); elements a=0 b=1 c=2 d=3
  const l1 = eq(prod(cyc(5, [0, 1, 2, 3]), cyc(5, [0, 1])), prod(cyc(5, [0, 2, 3]), cyc(5, [1])));
  // Lemma 2: (a b c)(a x) = (a x b c); a=0 b=1 c=2 x=3
  const l2 = eq(prod(cyc(5, [0, 1, 2]), cyc(5, [0, 3])), cyc(5, [0, 3, 1, 2]));
  // Lemma 3: (a x y b)(x b) = (a x)(b y); a=0 x=1 y=2 b=3
  const l3 = eq(prod(cyc(5, [0, 1, 2, 3]), cyc(5, [1, 3])), prod(cyc(5, [0, 1]), cyc(5, [3, 2])));
  check("the page's three lemmas hold as products of permutations (one example of each, in the convention where a cycle (a b c) means each element carries the mind of the one before it)", l1 && l2 && l3);
  // and exhaustively for all cycle lengths 3..8: Lemma 1 and 2
  let ok = true;
  for (let k = 2; k <= 8; k++) {
    const c = Array.from({ length: k }, (_, i) => i);
    const lhs = prod(cyc(k + 1, c), cyc(k + 1, [0, 1])), rhs = prod(cyc(k + 1, c.slice(0, 1).concat(c.slice(2))), cyc(k + 1, [1]));
    if (!eq(lhs, rhs)) ok = false;
    const l2k = prod(cyc(k + 1, c), cyc(k + 1, [0, k])), rhs2 = cyc(k + 1, [0, k].concat(c.slice(1)));
    if (!eq(l2k, rhs2)) ok = false;
  }
  check("Lemma 1 (a transposition of two neighbours removes one from the cycle) and Lemma 2 (insert x) hold for cycles of every length from 2 to 8", ok);
}

done("futurama");
