#!/usr/bin/env node
"use strict";

/*
 * Logic test for flipping-pancakes/pancakes-core.js.
 *
 * The puzzle: a stack of differently sized pancakes. Slide a flipper under one
 * and everything from there up turns over. Sort the stack, biggest at the
 * bottom. The applet adds two knobs to the move -- a fixed flip width, and a
 * "Scarce" mode where only the two ends of the run change places.
 *
 * What is checked here:
 *  - the three move modes against the bytecode (FullFlip, Transpose, and the
 *    min(i + m_Dist, n - 1) clamp at the top of the stack);
 *  - that every stack the scrambler deals really is solvable, by sorting it;
 *  - the page's own strategy, which must sort any stack in at most 2n - 3
 *    flips -- run over every one of the n! stacks for n up to 8;
 *  - the pancake numbers, the worst case over all stacks, rebuilt by
 *    breadth-first search over the whole permutation space.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const P = loadCore("flipping-pancakes/pancakes-core.js", "PancakeCore");
const ALL = P.SPAN_ALL;

/* -------------------------------------------------------- 1. the move modes */

{
  equal("the applet's range of n", [P.N_MIN, P.N_MAX, P.N_DEFAULT], [3, 40, 5]);
  equal("a sorted stack", P.sorted(4), [0, 1, 2, 3]);
  check("and it knows it is sorted", P.isSorted([0, 1, 2, 3]));
  check("an unsorted one is not", !P.isSorted([0, 2, 1, 3]));

  // FullFlip with m_Dist = -1: everything from i upwards turns over.
  equal("a full flip turns the whole run over", P.flip([0, 1, 2, 3, 4], 1, ALL, false), [0, 4, 3, 2, 1]);
  equal("flipping at the bottom reverses the lot", P.flip([0, 1, 2, 3], 0, ALL, false), [3, 2, 1, 0]);
  equal("flipping the top pancake changes nothing", P.flip([0, 1, 2, 3], 3, ALL, false), [0, 1, 2, 3]);
  check("and that is the no-op the page asks about", P.isNoop(4, 3, ALL));

  // Transpose with m_Dist = -1: the ends of the run swap, the middle stays.
  equal("Scarce swaps the ends only", P.flip([0, 1, 2, 3, 4], 1, ALL, true), [0, 4, 2, 3, 1]);

  // A fixed span: the run is [i, min(i + span - 1, n - 1)].
  equal("span 2 is an adjacent swap", P.flip([0, 1, 2, 3, 4], 1, 2, false), [0, 2, 1, 3, 4]);
  equal("span 3 reverses three", P.flip([0, 1, 2, 3, 4], 1, 3, false), [0, 3, 2, 1, 4]);
  equal("span 3 in Scarce mode swaps across one", P.flip([0, 1, 2, 3, 4], 1, 3, true), [0, 3, 2, 1, 4]);
  equal("span 4 in Scarce mode leaves the middle alone", P.flip([0, 1, 2, 3, 4], 1, 4, true), [0, 4, 2, 3, 1]);
  // min(i + m_Dist, n - 1): a run that would overshoot is cut off at the top.
  equal("a span that overshoots is clamped", P.flip([0, 1, 2, 3, 4], 3, 4, false), [0, 1, 2, 4, 3]);
  equal("and at the very top it is a no-op", P.flip([0, 1, 2, 3, 4], 4, 4, false), [0, 1, 2, 3, 4]);
  equal("the clamped range", P.range(5, 3, 4), [3, 4]);

  equal("a flip off the stack is refused", P.flip([0, 1, 2], 5, ALL, false), null);
  const before = [0, 1, 2, 3];
  P.flip(before, 1, ALL, false);
  equal("flip does not mutate its argument", before, [0, 1, 2, 3]);

  equal("the top pancake is never a legal flip when the run reaches the top",
    P.legalFlips(5, ALL), [0, 1, 2, 3]);
  equal("with span 2 the top is still the only no-op", P.legalFlips(5, 2), [0, 1, 2, 3]);
}

/* ----------------------------- 2. a flip is its own undo, and nothing is lost */

{
  const rand = rng(515);
  let pairs = 0;
  for (let t = 0; t < 3000; t++) {
    const n = 3 + Math.floor(rand() * 10);
    const span = rand() < 0.5 ? ALL : 2 + Math.floor(rand() * (n - 1));
    const scarce = rand() < 0.5;
    let stack = P.sorted(n);
    for (let k = 0; k < 6; k++) stack = P.flip(stack, Math.floor(rand() * n), span, scarce);
    const i = Math.floor(rand() * n);
    const once = P.flip(stack, i, span, scarce);
    equal(`the same flip twice is no flip at all (n=${n}, i=${i}, span=${span}, scarce=${scarce})`,
      P.flip(once, i, span, scarce), stack);
    equal(`a flip is a rearrangement, nothing appears or vanishes (n=${n})`,
      once.slice().sort((a, b) => a - b), P.sorted(n));
    pairs++;
  }
  check(`checked ${pairs} flips`, pairs === 3000);
}

/* ------------------------- 3. the scrambler always deals a solvable stack */

{
  const rand = rng(8191);
  let deals = 0;
  for (let t = 0; t < 400; t++) {
    const n = 3 + Math.floor(rand() * 8);
    const { stack, scrambleFlips } = P.scramble(n, ALL, false, 0, rand);
    check(`n=${n}: the deal is never already sorted`, !P.isSorted(stack));
    equal(`n=${n}: the deal is a real stack`, stack.slice().sort((a, b) => a - b), P.sorted(n));
    check(`n=${n}: it says how many flips it used (${scrambleFlips})`, scrambleFlips >= 1);
    // Solvable, and the page's strategy proves it by sorting it.
    let s = stack;
    for (const i of P.pageStrategy(stack)) s = P.flip(s, i, ALL, false);
    check(`n=${n}: the dealt stack sorts`, P.isSorted(s), JSON.stringify(stack));
    deals++;
  }
  check(`checked ${deals} deals`, deals === 400);

  // Reset() zeroes m_Num only after Shuffle(), so a longer previous game makes
  // a longer scramble. Kept on purpose; checked here so it cannot drift away.
  const a = P.scramble(6, ALL, false, 0, rng(5));
  const b = P.scramble(6, ALL, false, 40, rng(5));
  check(`the carried move count lengthens the scramble (${a.scrambleFlips} then ${b.scrambleFlips})`,
    b.scrambleFlips > a.scrambleFlips);
}

/* --------------- 4. the page's strategy sorts everything in at most 2n-3 */

/** Every permutation of 0..n-1. */
function permutations(n) {
  if (n === 0) return [[]];
  const out = [];
  const walk = (left, acc) => {
    if (!left.length) { out.push(acc); return; }
    for (let i = 0; i < left.length; i++) {
      walk(left.slice(0, i).concat(left.slice(i + 1)), acc.concat(left[i]));
    }
  };
  walk(P.sorted(n), []);
  return out;
}

{
  for (let n = 3; n <= 8; n++) {
    let worst = 0;
    let bad = 0;
    for (const start of permutations(n)) {
      const flips = P.pageStrategy(start);
      let s = start;
      for (const i of flips) s = P.flip(s, i, ALL, false);
      if (!P.isSorted(s)) bad++;
      if (flips.length > worst) worst = flips.length;
    }
    equal(`n=${n}: the strategy sorts every one of the ${permutations(n).length} stacks`, bad, 0);
    check(`n=${n}: and never needs more than 2n-3 = ${2 * n - 3} flips (worst was ${worst})`,
      worst <= 2 * n - 3);
  }
}

/* -------------------------------- 5. the pancake numbers, by exhaustive search */

/** The worst case over all stacks of n: a breadth-first search from sorted. */
function pancakeNumber(n) {
  const key = (a) => a.join(",");
  const seen = new Map([[key(P.sorted(n)), 0]]);
  let frontier = [P.sorted(n)];
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const i of P.legalFlips(n, ALL)) {
        const t = P.flip(s, i, ALL, false);
        const k = key(t);
        if (seen.has(k)) continue;
        seen.set(k, d + 1);
        next.push(t);
      }
    }
    frontier = next;
    if (next.length) d++;
  }
  // Every stack must be reachable, since a flip is its own undo.
  if (seen.size !== permutations(n).length) return `only ${seen.size} stacks reached`;
  return d;
}

{
  const rebuilt = [0, 0];
  for (let n = 2; n <= 8; n++) rebuilt.push(pancakeNumber(n));
  equal("the pancake numbers, rebuilt by breadth-first search", rebuilt, P.PANCAKE_NUMBERS);

  // They sit inside the bounds the page quotes: n <= f(n) <= 2n - 3 for n >= 4.
  for (let n = 4; n <= 8; n++) {
    const f = P.PANCAKE_NUMBERS[n];
    check(`n=${n}: ${f} is at least n`, f >= n);
    check(`n=${n}: ${f} is at most 2n-3 = ${2 * n - 3}`, f <= 2 * n - 3);
  }
  equal("f(6) = 7, the value the page singles out", P.PANCAKE_NUMBERS[6], 7);
}

done("flipping-pancakes");
