#!/usr/bin/env node
"use strict";

/*
 * Logic test for up-and-down-game/up-and-down-game-core.js.
 *
 *   1. The rules: start, moves, swaps, loose numbers, when a play ends.
 *   2. The page's claim, exhaustively: of all 9! = 362,880 ways to fill nine
 *      boxes, exactly 1,764 avoid a monotone four-chain; of all 10! = 3,628,800
 *      ways to fill ten boxes, none does. (These are the Erdos-Szekeres / RSK
 *      counts: for 9 the shape must be 3x3, giving 42 squared tableaux pairs.)
 *   3. The applet's own chain search, transcribed from the bytecode as a depth
 *      first search from every start, agrees with the core on every permutation;
 *      a plain four-subset scan agrees too.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("up-and-down-game/up-and-down-game-core.js", "UpAndDownGameCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("default length is 9", s.n, 9);
  equal("all boxes start empty", s.boxes, Array(9).fill(null));
  equal("no moves yet", s.moves, 0);
  check("a new game is not over", C.result(s) === null);

  const ten = C.start({ n: 10 });
  equal("the 10 option is honoured", ten.n, 10);
  equal("ten empty boxes", ten.boxes.length, 10);
  check("an unknown length falls back to 9", C.start({ n: 8 }).n === 9);
  check("a missing option falls back to 9", C.start().n === 9);

  equal("nine empty boxes offer 81 placements", C.legalMoves(s).length, 81);
  equal("ten empty boxes offer 100 placements", C.legalMoves(ten).length, 100);

  const placed = C.move(s, { value: 4, box: 2 });
  check("a number already in a box is not offered there again",
    !C.legalMoves(placed).some((m) => m.value === 4 && m.box === 2));
  equal("a move puts the number in the box", placed.boxes[2], 4);
  equal("a move counts", placed.moves, 1);
  equal("the old position is untouched", s.boxes[2], null);
  equal("the moved number is no longer loose", C.looseNumbers(placed).includes(4), false);
  equal("nine numbers are still loose", C.looseNumbers(placed).length, 8);

  const again = C.move(placed, { value: 4, box: 6 });
  equal("moving a placed number empties its old box", again.boxes[2], null);
  equal("moving a placed number fills the new box", again.boxes[6], 4);
  equal("each placement counts", again.moves, 2);

  const swapped = C.move(again, { value: 1, box: 6 });
  equal("the displaced number becomes loose again", swapped.boxes[6], 1);
  equal("the old number went back to the bottom", C.looseNumbers(swapped).includes(4), true);

  check("a bad value is refused", C.move(s, { value: 10, box: 0 }) === null);
  check("a bad box is refused", C.move(s, { value: 1, box: 9 }) === null);
  check("a negative box is refused", C.move(s, { value: 1, box: -1 }) === null);
  check("a fractional value is refused", C.move(s, { value: 1.5, box: 0 }) === null);
  check("a missing move is refused", C.move(s, null) === null);
  check("putting a number in the box it is in is a no-op", C.move(placed, { value: 4, box: 2 }) === null);
}

/* ----------------------------------------------------- 2. an unfinished board */

{
  const s = C.start({});
  const step = (value, box, state) => C.move(state, { value, box });
  // Four increasing numbers already placed: faulty, but still fixable.
  let b = step(1, 0, s);
  b = step(2, 1, b);
  b = step(3, 2, b);
  b = step(4, 3, b);
  check("four increasing numbers are a fault", C.faulty(b) !== null);
  check("the fault is reported as going up", C.faulty(b).direction === "up");
  equal("the fault names four boxes", C.faulty(b).indices.length, 4);
  check("a partly filled board never ends the play", C.result(b) === null);
  // Moving the first number away breaks the chain.
  const fixed = step(1, 8, b);
  check("rearranging can remove a fault", C.faulty(fixed) === null);
  check("a board that is still partly empty is not a win", C.result(fixed) === null);
}

/* ------------------------------------------- 3. permutations and the claim */

/** Calls fn with every permutation of 1..n, one array per call. */
function eachPermutation(n, fn) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const c = Array(n).fill(0);
  fn(a.slice());
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
      fn(a.slice());
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

/**
 * The applet's FindMonotoneSubsequence, as a depth-first search: start at every
 * box and extend by strictly bigger (or smaller) values until the chain is
 * (int) sqrt(N) + 1 boxes long, backtracking when it cannot be extended.
 */
function appletChain(boxes, up) {
  const target = Math.floor(Math.sqrt(boxes.length)) + 1;
  function extend(start, path) {
    if (path.length >= target) return path.slice();
    const at = boxes[path[path.length - 1]];
    for (let j = start; j < boxes.length; j++) {
      if (boxes[j] === null) continue;
      if (!(up ? boxes[j] > at : boxes[j] < at)) continue;
      path.push(j);
      const found = extend(j + 1, path);
      if (found) return found;
      path.pop();
    }
    return null;
  }
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i] === null) continue;
    const found = extend(i + 1, [i]);
    if (found) return found;
  }
  return null;
}

/** The simplest possible ground truth: scan every set of four boxes. */
function subsetChain(boxes, up) {
  const n = boxes.length;
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          const w = [boxes[a], boxes[b], boxes[c], boxes[d]];
          if (up ? w[0] < w[1] && w[1] < w[2] && w[2] < w[3] : w[0] > w[1] && w[1] > w[2] && w[2] > w[3]) {
            return [a, b, c, d];
          }
        }
      }
    }
  }
  return null;
}

const full = (perm) => ({ n: perm.length, boxes: perm.slice(), moves: perm.length });

for (const n of [9, 10]) {
  let valid = 0;
  let appletAgrees = 0;
  let subsetAgrees = 0;
  let resultAgrees = 0;
  let total = 0;
  eachPermutation(n, (perm) => {
    const state = full(perm);
    const fault = C.faulty(state);
    if (!fault) valid++;
    // The applet's own search is transcribed independently of the core's DP.
    if (Boolean(fault) === Boolean(appletChain(perm, true) || appletChain(perm, false))) appletAgrees++;
    // The four-subset scan is checked on a deterministic sample for length 10.
    if (n === 9 || total % 29 === 0) {
      if (Boolean(fault) === Boolean(subsetChain(perm, true) || subsetChain(perm, false))) subsetAgrees++;
    }
    const outcome = fault ? "lose" : "win";
    if (C.result(state) === outcome) resultAgrees++;
    total++;
  });

  equal(`${n}: every permutation was visited`, total, n === 9 ? 362880 : 3628800);
  check(`${n}: the applet's chain search agrees on every permutation`, appletAgrees === total);
  check(`${n}: the four-subset scan agrees on the sample`, subsetAgrees === (n === 9 ? total : Math.ceil(total / 29)));
  check(`${n}: the win/loss test agrees on every permutation`, resultAgrees === total);

  if (n === 9) {
    equal("nine: 1764 = 42 squared valid arrangements", valid, 1764);
    check("nine: at least one arrangement can win", valid > 0);
  } else {
    equal("ten: no arrangement avoids a four-chain", valid, 0);
  }
}

// A concrete winning board, built from three decreasing blocks of three.
{
  const win = full([3, 2, 1, 6, 5, 4, 9, 8, 7]);
  check("the block arrangement has no fault", C.faulty(win) === null);
  equal("the block arrangement is a win", C.result(win), "win");
  const lose = full([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  equal("ten in order is a loss", C.result(lose), "lose");
  equal("the fault found is an increasing one", C.faulty(lose).direction, "up");
  check("the four highlighted boxes are in order", (() => {
    const ix = C.faulty(lose).indices;
    return ix.every((v, i) => i === 0 || v > ix[i - 1]);
  })());
}

done("up-and-down-game");
