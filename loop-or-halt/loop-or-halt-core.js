"use strict";

/*
 * Loop Or Halt, from Alexander Bogomolny's applet LoopOrHalt.
 *
 * Start with a permutation of 1..N. If the first number is k, reverse the
 * order of the first k numbers; repeat until 1 is first. The claim is that
 * this always stops. The proof: look at the largest number L that ever comes
 * first. When it does, it is moved to place L and can never lead again (to
 * lead it would have to be moved by a larger leader, and none exists), so the
 * largest leader keeps getting smaller until only 1 is left.
 *
 * The applet deals a random permutation, shows every step as one row, and
 * runs until 1 leads. This is that, as plain data: a position is an array.
 */
const LoopOrHaltCore = (() => {
  const MIN_N = 3, MAX_N = 12, DEFAULT_N = 6;

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));

  /** A random permutation of 1..n (Fisher-Yates), `random` giving numbers in [0, 1). */
  function randomPermutation(n, random = Math.random) {
    const p = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }

  /** One iteration: reverse the first k numbers, k being the first number. */
  function step(perm) {
    const k = perm[0];
    return perm.slice(0, k).reverse().concat(perm.slice(k));
  }

  /** The rows the applet shows: the start, then each step, ending when 1 is first. */
  function run(perm) {
    const rows = [perm.slice()];
    let cur = perm.slice();
    while (cur[0] !== 1) { cur = step(cur); rows.push(cur); }
    return rows;
  }

  /** The numbers that come first, in order: for 362154 it is 3, 2, 6, 4, 3, 5, 2, 4, 1. */
  const leaders = (rows) => rows.map((r) => r[0]);

  /** Number of steps taken (rows minus the start). */
  const steps = (perm) => run(perm).length - 1;

  const isPermutation = (p, n) => Array.isArray(p) && p.length === n && [...p].sort((a, b) => a - b).every((v, i) => v === i + 1);

  return { MIN_N, MAX_N, DEFAULT_N, clampN, randomPermutation, step, run, leaders, steps, isPermutation };
})();
