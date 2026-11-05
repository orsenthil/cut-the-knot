#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-solitaire/solitaire-core.js.
 *
 * The puzzle: counters in a circle, each showing red or green. Clicking a
 * green counter removes it and turns over the counters in the two positions
 * next to it. Clear the circle.
 *
 * The core claims a one-line solvability test, taken from the proof on the
 * cut-the-knot page:
 *
 *   a full circle clears  <=>  its green count is even and not zero
 *   an arc with a gap at each end clears  <=>  its green count is odd
 *
 * That claim is not taken on trust here. An independent brute-force search
 * (depth-first over every reachable position; no cycles are possible because
 * each move removes a counter) decides every position for the small boards,
 * and `solvable` is compared against it:
 *
 *   - every one of the 3^n positions for n = 3..10, which covers mid-game
 *     boards with gaps, dead ends and already-cleared boards;
 *   - every one of the 2^n opening circles for n = 3..12.
 *
 * `solve` is then replayed move by move through the core's own `move`, so a
 * sequence only counts if every click was legal at the time and the board
 * really ends up empty.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const S = loadCore("circle-solitaire/solitaire-core.js", "SolitaireCore");
const { EMPTY, RED, GREEN } = S;

/* ------------------------------------------- 1. the move rule from the bytecode */

{
  // MakeMove(i) flips the fixed positions i+1 and i-1, and Flip() leaves an
  // empty position alone. A port that instead flipped the nearest counters
  // still standing would turn position 2 green here; this is the case that
  // tells the two readings apart.
  const board = [GREEN, EMPTY, RED, RED, RED];
  equal("a gap swallows the flip, it is not passed on", S.move(board, 0), [EMPTY, EMPTY, RED, RED, GREEN]);
  equal("the move does not mutate its argument", board, [GREEN, EMPTY, RED, RED, RED]);

  equal("red and green swap", S.move([GREEN, GREEN, RED], 0), [EMPTY, RED, GREEN]);
  equal("a red counter cannot be clicked", S.move([RED, GREEN, GREEN], 0), null);
  equal("an empty position cannot be clicked", S.move([EMPTY, GREEN, GREEN], 0), null);

  equal("n = 3: both neighbours of a counter are distinct", S.move([GREEN, RED, RED], 0), [EMPTY, GREEN, GREEN]);
}

/* ------------------------------------------------------ 2. end-of-game tests */

{
  check("a cleared board is cleared", S.isCleared([EMPTY, EMPTY, EMPTY]));
  check("a cleared board is not a dead end", !S.isDeadEnd([EMPTY, EMPTY, EMPTY]));
  check("reds with no green left is a dead end", S.isDeadEnd([RED, EMPTY, RED]));
  check("a green left is not a dead end", !S.isDeadEnd([RED, EMPTY, GREEN]));
  equal("legalMoves lists exactly the greens", S.legalMoves([GREEN, RED, EMPTY, GREEN]), [0, 3]);
  equal("remaining counts the counters still standing", S.remaining([GREEN, RED, EMPTY, GREEN]), 3);
}

/* -------------------------------------------------- 3. gaps cut the circle up */

{
  equal("no gaps: one closed circle", S.arcs([GREEN, RED, GREEN]), [[0, 1, 2]]);
  equal("one gap: one arc, read from the gap", S.arcs([RED, EMPTY, GREEN, RED]), [[2, 3, 0]]);
  equal("two gaps: two independent arcs", S.arcs([RED, EMPTY, GREEN, GREEN, EMPTY, RED]), [[2, 3], [5, 0]]);
  equal("a cleared board has no arcs", S.arcs([EMPTY, EMPTY]), []);
}

/* ------------------------------------------- the position enumerators */

/** All 3^n positions: openings, mid-game boards with gaps, dead ends, cleared. */
function allStates(n) {
  const out = [];
  const total = 3 ** n;
  for (let k = 0; k < total; k++) {
    const board = new Array(n);
    let v = k;
    for (let i = n - 1; i >= 0; i--) {
      board[i] = v % 3;
      v = Math.floor(v / 3);
    }
    out.push(board);
  }
  return out;
}

/** All 2^n opening circles: no gaps, every counter red or green. */
function allOpenings(n) {
  const out = [];
  for (let k = 0; k < 2 ** n; k++) {
    out.push(Array.from({ length: n }, (_, i) => ((k >> i) & 1 ? GREEN : RED)));
  }
  return out;
}

/* ----------------------------------------------- 4. what a move does to parity */

{
  // A move removes one green and turns over the two neighbouring *positions*.
  // So the green count changes by -1, plus +/-1 for each neighbour that holds a
  // counter: the parity flips exactly when an even number of those two
  // positions is empty. (The cut-the-knot page states this for the opening
  // circle, where both neighbours are always occupied.)
  const rand = rng(20261105);
  let cases = 0;
  let firstMoves = 0;
  for (let t = 0; t < 4000; t++) {
    const n = 3 + Math.floor(rand() * 10);
    const board = Array.from({ length: n }, () => Math.floor(rand() * 3));
    for (const i of S.legalMoves(board)) {
      cases++;
      const gaps = [(i + 1) % n, (i - 1 + n) % n].filter((j) => board[j] === EMPTY).length;
      const flipped = (S.greens(board) - S.greens(S.move(board, i))) % 2 !== 0;
      check(
        `parity flips iff an even number of neighbours is empty (${board} at ${i})`,
        flipped === (gaps % 2 === 0),
      );
      if (S.isFullCircle(board)) {
        firstMoves++;
        check(`the opening circle's first move always flips the parity (${board} at ${i})`, flipped);
      }
    }
  }
  check(`parity checked on ${cases} moves`, cases > 5000, `only ${cases} moves`);
  check(`including ${firstMoves} opening moves`, firstMoves > 100, `only ${firstMoves}`);
}

/* ------------------------- 4b. "some arc has an even green count" is forever */

{
  // The reason an even arc can never be cleared: every move out of a position
  // that has an even arc leaves a position that still has one, and a cleared
  // board has no arcs at all. Checked here over every position of the small
  // boards, directly rather than through the solver.
  const hasEvenArc = (b) => S.arcs(b).some((arc) => arc.filter((i) => b[i] === GREEN).length % 2 === 0);
  let moves = 0;
  for (let n = S.N_MIN; n <= 9; n++) {
    for (const board of allStates(n)) {
      if (S.isFullCircle(board) || !hasEvenArc(board)) continue;
      for (const i of S.legalMoves(board)) {
        moves++;
        check(`an even arc survives every move (n=${n}, ${board} at ${i})`, hasEvenArc(S.move(board, i)));
      }
    }
  }
  check(`the invariant held across ${moves} moves`, moves > 10000, `only ${moves} moves`);
}

/* ------------------------------------- 5. solvable() against a brute-force search */

/** Decides a position by searching it. Memoised; every move removes a counter,
 *  so the search graph has no cycles. */
function bruteForcer(n) {
  const memo = new Map();
  const encode = (s) => s.reduce((k, c) => k * 3 + c, 0);
  const flip = (s, j) => {
    if (s[j] === RED) s[j] = GREEN;
    else if (s[j] === GREEN) s[j] = RED;
  };
  return function canClear(s) {
    if (s.every((c) => c === EMPTY)) return true;
    const key = encode(s);
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;
    for (let i = 0; i < n && !ok; i++) {
      if (s[i] !== GREEN) continue;
      const t = s.slice();
      t[i] = EMPTY;
      flip(t, (i + 1) % n);
      flip(t, (i - 1 + n) % n);
      ok = canClear(t);
    }
    memo.set(key, ok);
    return ok;
  };
}

/** Walks `solve`'s answer through `move` and reports whether it really clears. */
function replay(board, moves) {
  let s = board.slice();
  for (const i of moves) {
    const next = S.move(s, i);
    if (!next) return `illegal click at ${i} on ${s}`;
    s = next;
  }
  return S.isCleared(s) ? null : `ended on ${s}, not cleared`;
}

function sweep(n, states, label) {
  const canClear = bruteForcer(n);
  let agree = 0;
  let solved = 0;
  for (const board of states) {
    const claimed = S.solvable(board);
    const truth = canClear(board.slice());
    if (claimed !== truth) {
      check(`n=${n} ${label}: solvable(${board}) says ${claimed}, the search says ${truth}`, false);
      continue;
    }
    agree++;
    const moves = S.solve(board);
    if (truth) {
      if (moves === null) {
        check(`n=${n} ${label}: solve(${board}) gave up on a solvable board`, false);
        continue;
      }
      const bad = replay(board, moves);
      if (bad) {
        check(`n=${n} ${label}: solve(${board}) -> [${moves}] ${bad}`, false);
        continue;
      }
      equal(`n=${n} ${label}: solve(${board}) clears every counter`, moves.length, S.remaining(board));
      solved++;
    } else if (moves !== null) {
      check(`n=${n} ${label}: solve(${board}) returned moves for an unsolvable board`, false);
    }
  }
  return { agree, solved };
}

for (let n = S.N_MIN; n <= 10; n++) {
  const { agree, solved } = sweep(n, allStates(n), "every position");
  check(`n=${n}: solvable() agrees with the search on all ${3 ** n} positions`, agree === 3 ** n,
    `${agree} of ${3 ** n}`);
  check(`n=${n}: solve() cleared ${solved} of them`, solved > 0);
}

for (let n = S.N_MIN; n <= 12; n++) {
  const openings = allOpenings(n);
  const { agree } = sweep(n, openings, "openings");
  check(`n=${n}: solvable() agrees on all ${openings.length} opening circles`, agree === openings.length,
    `${agree} of ${openings.length}`);
}

/* ------------------------------ 6. the theorem, stated in its own terms */

for (let n = S.N_MIN; n <= 12; n++) {
  const canClear = bruteForcer(n);
  let bad = 0;
  for (const board of allOpenings(n)) {
    const g = S.greens(board);
    const predicted = g > 0 && g % 2 === 0;
    if (canClear(board.slice()) !== predicted) bad++;
  }
  equal(`n=${n}: an opening circle clears exactly when its green count is even and not zero`, bad, 0);
}

/* ------------------------------------------------- 7. the applet's own setup */

{
  equal("the counter range is the applet's", [S.N_MIN, S.N_MAX, S.N_DEFAULT], [3, 40, 10]);

  const rand = rng(7);
  const seen = new Set();
  let evenGreens = 0;
  const trials = 3000;
  for (let t = 0; t < trials; t++) {
    const board = S.randomBoard(10, rand);
    equal("randomBoard has the right length", board.length, 10);
    for (const c of board) seen.add(c);
    const g = S.greens(board);
    if (g > 0 && g % 2 === 0) evenGreens++;
  }
  equal("a fresh board has no gaps: only red and green", [...seen].sort(), [RED, GREEN]);
  // Reset() is a plain coin flip per counter, so roughly half the openings are
  // unsolvable. That is the applet's behaviour and the point of the puzzle.
  check(
    `a coin-flip opening is solvable about half the time (${evenGreens}/${trials})`,
    evenGreens > trials * 0.35 && evenGreens < trials * 0.65,
  );
}

done("circle-solitaire");
