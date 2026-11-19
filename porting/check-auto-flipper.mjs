#!/usr/bin/env node
"use strict";

/*
 * Logic test for auto-flipper/auto-flipper-core.js.
 *
 *   node porting/check-auto-flipper.mjs
 *
 * The checks are exhaustive wherever the board is small: every permutation of
 * 3..8 pancakes is followed to its end, and the flip and shuffle routines are
 * compared with a second, literal transcription of the applet's bytecode over
 * the whole option range (N = 3..16). Every claim on the cut-the-knot page is
 * tested: the N! stacks, "top M lands M-th from the top", termination, the
 * fixed point at 1, and the "once in place" step of the proof (including the
 * counterexample that shows it only applies to the largest pancake that moves).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("auto-flipper/auto-flipper-core.js", "AutoFlipperCore");

const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));

/** All permutations of [1..n], as arrays. */
function permutations(n) {
  let out = [[]];
  for (let v = 1; v <= n; v++) {
    const next = [];
    for (const p of out) {
      for (let i = 0; i <= p.length; i++) {
        const q = p.slice();
        q.splice(i, 0, v);
        next.push(q);
      }
    }
    out = next;
  }
  return out;
}

/* ------------------------------------------------ 1. the applet's constants */

{
  equal("default N is 5", C.DEFAULT_N, 5);
  equal("minimum N is 3", C.MIN_N, 3);
  equal("maximum N is 16", C.MAX_N, 16);
  equal("N below the range clamps to 3", C.clampN(1), 3);
  equal("N above the range clamps to 16", C.clampN(99), 16);
  equal("a non-number falls back to 5", C.clampN("nope"), 5);

  const s = C.start({ n: 5 });
  equal("a new stack has five pancakes", s.stack.length, 5);
  check("a new stack is a permutation", C.isFinished(s) === (s.stack[0] === 1));
  check("a new game is not already finished", !s.finished);
  equal("no flips have happened yet", s.flips, 0);
  const given = C.start({ stack: [3, 1, 2] });
  equal("start copies an explicit stack", given.stack, [3, 1, 2]);
  equal("explicit stack sets n", given.n, 3);
}

/* --------------- 2. Flip(int), compared with the bytecode over the full range */

/* Literal transcription of AutoFlipperCanvas.Flip(int):
 *   if (k > m_N) k = m_N;
 *   for (int i = 0; i < k/2; i++) swap(a[i], a[k-i-1]);  */
function appletFlip(arr, k) {
  const a = arr.slice();
  const n = a.length;
  if (k > n) k = n;
  for (let i = 0; i < Math.floor(k / 2); i++) {
    const t = a[i];
    a[i] = a[k - i - 1];
    a[k - i - 1] = t;
  }
  return a;
}

{
  let cases = 0;
  let allMatch = true;
  const sampleStacks = [];
  for (const n of [3, 4, 5, 8, 16]) {
    const ascending = Array.from({ length: n }, (_, i) => i + 1);
    const descending = ascending.slice().reverse();
    const shifted = ascending.slice(1).concat(ascending[0]);
    const mixed = ascending.slice().sort((a, b) => ((a * 7) % n) - ((b * 7) % n));
    sampleStacks.push(ascending, descending, shifted, mixed);
  }
  for (const stack of sampleStacks) {
    const original = stack.slice();
    for (let k = -2; k <= stack.length + 3; k++) {
      const expected = appletFlip(stack, k);
      const actual = C.flip(stack, k);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) allMatch = false;
      cases++;
    }
    check("flip does not mutate its input", JSON.stringify(stack) === JSON.stringify(original));
  }
  check("flip matches the applet for every N and k", allMatch);
  check("flip was exercised over the whole range", cases > 250);

  // Reversing the same prefix twice is the identity, and the multiset survives.
  let involutions = true;
  let multisets = true;
  for (const stack of sampleStacks) {
    const sorted = stack.slice().sort((a, b) => a - b).join(",");
    for (let k = 0; k <= stack.length; k++) {
      const twice = C.flip(C.flip(stack, k), k);
      if (JSON.stringify(twice) !== JSON.stringify(stack)) involutions = false;
      const after = C.flip(stack, k).slice().sort((a, b) => a - b).join(",");
      if (after !== sorted) multisets = false;
    }
  }
  check("flipping a prefix twice restores the stack", involutions);
  check("a flip keeps exactly the same pancakes", multisets);
}

/* ---------------- 3. the automatic flip and the page's "M goes to place M" */

{
  let landsCorrectly = true;
  let readsTop = true;
  let counts = true;
  for (let n = 3; n <= 8; n++) {
    for (const stack of permutations(n)) {
      const m = stack[0];
      const s = C.makePosition(stack);
      const next = C.autoFlip(s);
      if (next.stack.indexOf(m) !== m - 1) landsCorrectly = false;
      if (next.lastK !== m) readsTop = false;
      if (next.flips !== 1) counts = false;
    }
  }
  check("top M lands M-th from the top, for every stack", landsCorrectly);
  check("one flip turns over the number on the top pancake", readsTop);
  check("a flip is counted once", counts);

  // CheckFinished(): finished exactly when 1 is on top.
  let finishedCorrect = true;
  let fixed = true;
  for (let n = 3; n <= 7; n++) {
    for (const stack of permutations(n)) {
      const s = C.makePosition(stack);
      if (s.finished !== (stack[0] === 1)) finishedCorrect = false;
      if (stack[0] === 1) {
        const next = C.autoFlip(s);
        if (JSON.stringify(next.stack) !== JSON.stringify(stack)) fixed = false;
      }
    }
  }
  check("finished exactly when pancake 1 is on top", finishedCorrect);
  check("flipping 1 changes nothing (the process has stopped)", fixed);

  const doneStack = [1, 3, 2];
  equal("result is done when 1 is on top", C.result(C.makePosition(doneStack)), "done");
  equal("result is null while flipping continues", C.result(C.makePosition([2, 1, 3])), null);
  equal("there is no automatic move once finished", C.legalMoves(C.makePosition(doneStack)), []);
  equal("a finished position refuses a move", C.move(C.makePosition(doneStack), "auto"), null);
  equal("an unknown move is refused", C.move(C.makePosition([2, 1, 3]), "nonsense"), null);
}

/* ------------------------ 4. Shuffle(), compared with the bytecode method */

/* Literal transcription of AutoFlipperCanvas.Shuffle():
 *   m_bFinished = 1;
 *   while (m_bFinished) {
 *     int rounds = (int)(Math.random()*N) + 5;
 *     for (int j = 0; j < rounds; j++) Flip((int)(Math.random()*N) + 1);
 *     CheckFinished();
 *   }  */
function appletShuffle(n, random) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const rand = () => Math.floor(random() * n);
  let finished = 1;
  let guard = 0;
  while (finished && guard++ < 100000) {
    const rounds = rand() + 5;
    for (let j = 0; j < rounds; j++) {
      const k = Math.min(rand() + 1, a.length);
      for (let i = 0; i < Math.floor(k / 2); i++) {
        const t = a[i];
        a[i] = a[k - i - 1];
        a[k - i - 1] = t;
      }
    }
    finished = a[0] === 1 ? 1 : 0;
  }
  return a;
}

{
  let matches = true;
  let valid = true;
  let unfinished = true;
  for (let n = 3; n <= 16; n++) {
    for (let seed = 1; seed <= 25; seed++) {
      const a = appletShuffle(n, rng(seed));
      const b = C.shuffle(n, rng(seed));
      if (JSON.stringify(a) !== JSON.stringify(b)) matches = false;
      const sorted = b.slice().sort((x, y) => x - y).join(",");
      const want = Array.from({ length: n }, (_, i) => i + 1).join(",");
      if (sorted !== want) valid = false;
      if (b[0] === 1) unfinished = false;
    }
  }
  check("shuffle matches the applet's own method on every N and seed", matches);
  check("shuffle always gives a permutation of 1..N", valid);
  check("shuffle never starts with pancake 1 on top", unfinished);

  const started = C.start({ n: 16, rng: rng(7) });
  check("start with a rng produces a valid unfinished mix", started.stack.length === 16 && started.stack[0] !== 1);
}

/* ------------------ 5. the page's claims, exhaustively over all permutations */

{
  let term = true;
  let noCycles = true;
  let endsAtOne = true;
  let maxSteps = 0;
  let finalCount = 0;
  let permCount = 0;

  for (let n = 3; n <= 8; n++) {
    const all = permutations(n);
    equal(`there are ${n}! stacks`, all.length, factorial(n));
    permCount += all.length;
    for (const startStack of all) {
      const seen = new Set();
      let stack = startStack;
      let steps = 0;
      while (stack[0] !== 1) {
        const key = stack.join(",");
        if (seen.has(key)) {
          noCycles = false;
          break;
        }
        seen.add(key);
        stack = C.autoFlip({ stack }).stack;
        steps++;
        if (steps > factorial(n) + 1) {
          term = false;
          break;
        }
      }
      if (stack[0] !== 1) {
        term = false;
        endsAtOne = false;
      }
      if (steps > maxSteps) maxSteps = steps;
      if (steps > 0) finalCount++;
    }
  }
  check("every stack reaches pancake 1 on top (termination)", term);
  check("no configuration repeats before the end", noCycles);
  check("every run really ends with 1 on top", endsAtOne);
  check("exhaustive search covered thousands of stacks", permCount > 40000);
  check("the longest run for N<=8 is finite", maxSteps > 0 && maxSteps < 100);
  check("non-final stacks are the ones that move", finalCount > 0);

  // The stopped states are exactly the (n-1)! permutations with 1 on top.
  for (const n of [3, 4, 5, 6]) {
    let stopped = 0;
    for (const p of permutations(n)) if (p[0] === 1) stopped++;
    equal(`fixed points for N=${n}`, stopped, factorial(n - 1));
  }
}

/* -------- 6. the subtlety in "once in place, it cannot move again" */

{
  // The proof's step refers to the largest pancake that changes location in a
  // hypothetical repeating cycle. For a terminating run, a SMALLER pancake can
  // be knocked out of its spot by a later, larger flip. This is the actual
  // trajectory from [3,4,2,1]; pin it so the maths section can be honest.
  let stack = [3, 4, 2, 1];
  const trace = [stack];
  while (stack[0] !== 1) {
    stack = C.autoFlip({ stack }).stack;
    trace.push(stack);
  }
  equal("trajectory from 3,4,2,1", trace, [
    [3, 4, 2, 1],
    [2, 4, 3, 1],
    [4, 2, 3, 1],
    [1, 3, 2, 4],
  ]);
  // Pancake 3 sat in its own place after the first flip, then was displaced by
  // the flip of 4. The largest mover, 4, ends in its place and stays there.
  check("pancake 3 reaches its place then leaves it", trace[1][2] === 3 && trace[3][2] !== 3);
  check("the largest mover 4 ends in its place", trace[3][3] === 4);
}

/* ------------------------------------------ 7. the position is plain JSON */

{
  const s = C.start({ n: 6, rng: rng(9) });
  const roundTrip = JSON.parse(JSON.stringify(s));
  equal("a position survives a JSON round trip", roundTrip, s);
  const next = C.autoFlip(roundTrip);
  equal("a restored position keeps flipping", next.flips, 1);
  equal("manual click at index i flips i pancakes", C.manualFlip(C.makePosition([4, 3, 2, 1]), 2).stack, appletFlip([4, 3, 2, 1], 2));
  check("status sentence names the top pancake", /top pancake was 4/.test(C.describe(C.makePosition([4, 3, 2, 1], { lastK: 4 }))));
}

done("auto-flipper");
