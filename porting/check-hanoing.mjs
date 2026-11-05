#!/usr/bin/env node
"use strict";

/*
 * Logic test for hanoing/hanoing-core.js.
 *
 * Hanoing is the Tower of Hanoi in disguise: square i of the row is disk i, and
 * its colour is the peg that disk is on. The core's claims are checked against
 * oracles that know nothing about Hanoi:
 *
 *   - `destination` (the applet's CanMoveFrom rotation) is compared, for every
 *     one of the 3^n positions for n = 1..8 and every square in them, with a
 *     plain restatement of the page's two conditions: the square must be the
 *     leftmost of its own colour, and the leftmost of the colour it takes.
 *
 *   - `minMovesTo` is compared with a breadth-first search over the whole
 *     3^n-state graph, for n = 1..8. The closed form is never trusted; the BFS
 *     decides, from every position, for every target peg.
 *
 *   - `suggest` (the applet's Help) is required, from every position, to be a
 *     legal move that cuts the BFS distance to all-white by exactly one. That
 *     is a much stronger claim than "it is a legal move", and it is what makes
 *     the suggestion worth offering.
 *
 *   - `solveSequence` is replayed move by move through the core's own `apply`,
 *     so a sequence only counts if every move was legal when it was made.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("hanoing/hanoing-core.js", "HanoingCore");

/* ----------------------------------------------------- helpers and oracles */

/** All 3^n positions, as arrays of pegs. */
function allPositions(n) {
  const out = [];
  for (let code = 0; code < 3 ** n; code++) {
    const peg = [];
    let c = code;
    for (let i = 0; i < n; i++) { peg.push(c % 3); c = Math.floor(c / 3); }
    out.push(peg);
  }
  return out;
}

const encode = (peg) => peg.reduce((acc, p, i) => acc + p * 3 ** i, 0);
const state = (peg) => ({ n: peg.length, peg: peg.slice(), moves: 0 });

/**
 * The page's two conditions, written out directly, with no notion of a peg
 * being a stack: a square may take colour `to` when it is the leftmost square
 * of its present colour and would be the leftmost square of `to`.
 */
function allowedByThePage(peg, i, to) {
  if (peg[i] === to) return false;
  for (let j = 0; j < i; j++) {
    if (peg[j] === peg[i]) return false;   // not leftmost of the colour it loses
    if (peg[j] === to) return false;       // not leftmost of the colour it gains
  }
  return true;
}

/** Distance in moves from every position to "all on `target`", by BFS. */
function bfsDistances(n, target) {
  const size = 3 ** n;
  const dist = new Int32Array(size).fill(-1);
  const goal = encode(new Array(n).fill(target));
  dist[goal] = 0;
  let frontier = [goal];
  while (frontier.length) {
    const next = [];
    for (const code of frontier) {
      const peg = [];
      let c = code;
      for (let i = 0; i < n; i++) { peg.push(c % 3); c = Math.floor(c / 3); }
      // Moves are reversible, so walking backwards from the goal is the same
      // as walking forwards to it.
      for (let i = 0; i < n; i++) {
        for (let to = 0; to < 3; to++) {
          if (!allowedByThePage(peg, i, to)) continue;
          const was = peg[i];
          peg[i] = to;
          const code2 = encode(peg);
          peg[i] = was;
          if (dist[code2] === -1) { dist[code2] = dist[code] + 1; next.push(code2); }
        }
      }
    }
    frontier = next;
  }
  return dist;
}

/* ------------------------------------- 1. the move rule is the page's rule */

{
  let mismatches = 0;
  let checked = 0;
  for (let n = 1; n <= 8; n++) {
    for (const peg of allPositions(n)) {
      const st = state(peg);
      for (let i = 0; i < n; i++) {
        const got = H.destination(st, i);
        // CanMoveFrom's own rotation: (from+1)%3 first, then (from+2)%3.
        let want = -1;
        for (let step = 1; step <= 2 && want < 0; step++) {
          const to = (peg[i] + step) % 3;
          if (allowedByThePage(peg, i, to)) want = to;
        }
        if (got !== want) mismatches++;
        checked++;
        // And `legal` must agree with the page for every destination.
        for (let to = 0; to < 3; to++) {
          if (H.legal(st, i, to) !== allowedByThePage(peg, i, to)) mismatches++;
        }
      }
    }
  }
  check("the rotation matches the page's two conditions", mismatches === 0, `${mismatches} of ${checked} squares differ`);
  check("the sweep was real", checked > 50000, `only ${checked} squares`);

  // The two conditions, spelled out on a position by hand. Row: R B R W.
  const st = state([0, 1, 0, 2]);
  // Square 0 is the leftmost red and would be the leftmost blue, so blue - the
  // next colour round the cycle - is legal and the rotation stops there.
  equal("square 0 rotates red to blue", H.destination(st, 0), 1);
  equal("square 1 is leftmost blue and may go white", H.destination(st, 1), 2);
  equal("square 2 is red but not leftmost red", H.destination(st, 2), -1);
  equal("square 3 is leftmost white but 0 and 1 block both colours", H.destination(st, 3), -1);
}

/* ------------------------------------------ 2. minMoves against brute force */

{
  let wrong = 0;
  let positions = 0;
  for (let n = 1; n <= 8; n++) {
    const dists = [0, 1, 2].map((t) => bfsDistances(n, t));
    for (const peg of allPositions(n)) {
      const st = state(peg);
      const code = encode(peg);
      for (let t = 0; t < 3; t++) {
        if (H.minMovesTo(st, t) !== dists[t][code]) wrong++;
      }
      // Red never counts as finished, so minMoves looks at blue and white only.
      const best = Math.min(dists[1][code], dists[2][code]);
      if (H.minMoves(st) !== best) wrong++;
      positions++;
    }
  }
  check("minMovesTo agrees with breadth-first search everywhere", wrong === 0, `${wrong} disagreements`);
  check("over every position up to 8 squares", positions === [1,2,3,4,5,6,7,8].reduce((a, n) => a + 3 ** n, 0), `${positions} positions`);

  // The classic numbers, from the all-red start.
  for (const n of [3, 4, 10, 20]) {
    equal(`${n} squares, all red, needs 2^${n}-1 moves`, H.minMovesTo(H.newGame(n), 2), 2 ** n - 1);
  }
  equal("and nothing at all to stay red", H.minMovesTo(H.newGame(6), 0), 0);
  // ...but red is not a finish, so the real distance from the start is 2^n - 1.
  equal("the start is 2^6-1 moves from being finished", H.minMoves(H.newGame(6)), 2 ** 6 - 1);
}

/* ----------------------------------------- 3. the suggestion is an optimal move */

{
  let notLegal = 0;
  let notOptimal = 0;
  let missing = 0;
  let positions = 0;
  for (let n = 1; n <= 8; n++) {
    const dist = bfsDistances(n, H.WHITE);
    for (const peg of allPositions(n)) {
      const st = state(peg);
      const code = encode(peg);
      const s = H.suggest(st);
      if (dist[code] === 0) {            // already all white: nothing to suggest
        if (s !== null) missing++;
        positions++;
        continue;
      }
      if (s === null) { missing++; positions++; continue; }
      if (!H.legal(st, s.disk, s.to)) { notLegal++; positions++; continue; }
      const after = peg.slice();
      after[s.disk] = s.to;
      if (dist[encode(after)] !== dist[code] - 1) notOptimal++;
      positions++;
    }
  }
  check("Help always has a move to offer", missing === 0, `${missing} positions without one`);
  check("and it is always legal", notLegal === 0, `${notLegal} illegal suggestions`);
  check("and it always steps straight towards all-white", notOptimal === 0, `${notOptimal} suggestions were detours`);
  check("checked over every position up to 8 squares", positions > 9000, `only ${positions}`);

  // Following the suggestion from the start must solve it in exactly 2^n - 1.
  for (const n of [3, 5, 8]) {
    const st = H.newGame(n);
    let steps = 0;
    while (!H.isWon(st) && steps <= 2 ** n) {
      const s = H.suggest(st);
      H.apply(st, s.disk, s.to);
      steps++;
    }
    equal(`following Help from the start solves ${n} squares optimally`, steps, 2 ** n - 1);
    equal(`and lands on white`, st.peg.every((p) => p === H.WHITE), true);
  }
}

/* ----------------------------------------------- 4. the recursive solution */

{
  for (let n = 1; n <= 12; n++) {
    const st = H.newGame(n);
    const seq = H.solveSequence(n);
    let bad = 0;
    for (const m of seq) {
      if (!H.legal(st, m.disk, m.to)) bad++;
      else H.apply(st, m.disk, m.to);
    }
    if (n <= 4 || n === 12) {
      equal(`solveSequence(${n}) has 2^${n}-1 moves`, seq.length, 2 ** n - 1);
      equal(`and every one of them is legal`, bad, 0);
      equal(`and it ends all white`, st.peg.every((p) => p === H.WHITE), true);
    } else {
      check(`solveSequence(${n}) replays cleanly`, bad === 0 && st.peg.every((p) => p === H.WHITE));
    }
  }
}

/* ------------------------------------------------- 5. clicking and winning */

{
  const st = H.newGame(3);
  equal("a fresh row is all red", st.peg, [0, 0, 0]);
  // AllOneColor(): red never counts, so the start is not already a win.
  equal("all red is not a win", H.isWon(st), false);
  equal("all blue is, from the standard start", H.isWon({ ...st, peg: [1, 1, 1] }), true);
  equal("all white always is", H.isWon({ ...st, peg: [2, 2, 2] }), true);
  // ...but after Randomize only white does.
  equal("all blue is not a win after Randomize", H.isWon({ ...st, peg: [1, 1, 1], randomized: true }), false);
  equal("all white still is", H.isWon({ ...st, peg: [2, 2, 2], randomized: true }), true);
  equal("and the targets say so", H.targets({ ...st, randomized: true }), [2]);

  // Square 2 is the biggest disk, buried: the click is refused with the
  // applet's own wording.
  const bad = H.click(st, 2);
  equal("clicking a buried square is refused", bad.ok, false);
  equal("with the applet's message", bad.message, "Move is not allowed");
  equal("and costs no move", st.moves, 0);

  // The optimal three-square game, taken one click at a time.
  const seq = H.solveSequence(3);
  for (const m of seq) H.apply(st, m.disk, m.to);
  equal("seven moves later it is won", H.isWon(st), true);
  equal("the move counter agrees", st.moves, 7);

  equal("and it ended all white", st.peg, [2, 2, 2]);
}

/* ----------------------------------------------------------- 6. randomize */

{
  const r = rng(7);
  let won = 0;
  let outOfRange = 0;
  for (let t = 0; t < 2000; t++) {
    const n = 3 + (t % 6);
    const st = H.randomize(n, r);
    if (H.isWon(st)) won++;
    if (st.n !== n || st.peg.length !== n) outOfRange++;
    if (st.peg.some((p) => p !== 0 && p !== 1 && p !== 2)) outOfRange++;
    if (st.moves !== 0) outOfRange++;
  }
  check("randomize never hands back a solved puzzle", won === 0, `${won} were already won`);
  check("and always builds a well-formed one", outOfRange === 0, `${outOfRange} faults`);

  // Every position is reachable, so a random one is always finishable.
  const r2 = rng(99);
  let unreachable = 0;
  for (let t = 0; t < 300; t++) {
    const st = H.randomize(5, r2);
    if (!(H.minMoves(st) > 0 && H.minMoves(st) < 2 ** 5)) unreachable++;
  }
  check("a random 5-square puzzle is always solvable, and in under 2^5 moves", unreachable === 0, `${unreachable} were not`);
}

done("hanoing");
