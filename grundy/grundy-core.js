"use strict";

/*
 * Grundy's Game (Bogomolny's Grundy applet) - the rules and the computer.
 *
 * A few heaps of squares in a row each. A move splits ONE heap into two
 * heaps of DIFFERENT sizes. Heaps of one or two squares can never be split,
 * so the game ends when no heap is longer than two, and whoever made the
 * last split wins. You move first; then the computer.
 *
 * The key idea is the Sprague-Grundy theorem. Every heap size has a Grundy
 * number, the mex (smallest missing value) of the Grundy numbers of the
 * positions one split away, where a split into a and b is worth
 * G(a) XOR G(b). A position of several heaps is worth the XOR of its heaps,
 * and it is a loss for the player to move exactly when that XOR is 0.
 *
 * The computer is the applet's GrundyCanvas.Play() read off the bytecode:
 * XOR the heaps' values from its hard-coded table (GrundyHeap.NimValue,
 * sizes 0 to 39); if that is not 0, MakeGoodMove() takes the first split,
 * heap by heap in the order the heaps were made and split point by split
 * point, that brings the XOR to 0; if it is 0, MakeRandomMove() splits a
 * random long heap at a random point 2 .. size-1. The applet keeps its heaps
 * in a Vector where a split removes the heap and appends its two halves, and
 * so does this, because that order decides which good move is found first.
 *
 * porting/check-grundy.mjs recomputes the table with the mex rule and checks
 * the computer against an exhaustive game search.
 */

var GrundyCore = (function () {
  // GrundyHeap.NimValue, as stored in the applet.
  const NIM_VALUE = [
    0, 0, 0, 1, 0, 2, 1, 0, 2, 1,
    0, 2, 1, 3, 2, 1, 3, 2, 4, 3,
    0, 4, 3, 0, 4, 3, 0, 4, 1, 2,
    3, 1, 2, 4, 1, 2, 4, 1, 2, 4,
  ];

  // The applet's limits: GrundyPanel's "<" and ">" buttons, and init()'s reset(15, 1).
  const MAX_SIZE = 30;
  const MAX_HEAPS = 8;
  const DEFAULT_SIZE = 15;
  const DEFAULT_HEAPS = 1;

  /** Grundy number of one heap: the applet's table. */
  const value = (size) => NIM_VALUE[size];

  /**
   * SetSquares(): heap count `heaps`, each in its own row. Without "random"
   * every heap is maxSize long. With it, the first heap is maxSize and the
   * others are 3 + (int)(random * (maxSize - 2)), as in the applet.
   */
  function start(maxSize, heaps, random, rnd = Math.random) {
    const list = [];
    for (let row = 0; row < heaps; row++) {
      let size = maxSize;
      if (row > 0 && random) size = 3 + Math.trunc(rnd() * (maxSize - 2));
      list.push({ id: row, row, at: 0, size });
    }
    return { heaps: list, nextId: heaps, turn: "you", over: false, winner: null, last: null };
  }

  /** XOR of the heaps' Grundy numbers. */
  function nimSum(s) {
    return s.heaps.reduce((x, h) => x ^ value(h.size), 0);
  }

  /** LongHeapExists() inverted: no heap can be split any more. */
  function finished(s) {
    return !s.heaps.some((h) => h.size > 2);
  }

  /** Remove the heap and append its two halves, k squares then size-k. */
  function split(s, heap, k) {
    const i = s.heaps.indexOf(heap);
    s.heaps.splice(i, 1);
    const first = { id: s.nextId++, row: heap.row, at: heap.at, size: k };
    const second = { id: s.nextId++, row: heap.row, at: heap.at + k, size: heap.size - k };
    s.heaps.push(first, second);
    s.last = { row: heap.row, at: heap.at + k };
  }

  /**
   * Your move: cut heap `id` after its k-th square. Returns "ok", "equal"
   * (the applet's "This move is not allowed!") or "none" (no such cut).
   */
  function playerMove(s, id, k) {
    if (s.over || s.turn !== "you") return "none";
    const heap = s.heaps.find((h) => h.id === id);
    if (!heap || k < 1 || k >= heap.size) return "none";
    if (k === heap.size - k) return "equal";
    split(s, heap, k);
    if (finished(s)) {
      s.over = true;
      s.winner = "you";
    } else {
      s.turn = "computer";
    }
    return "ok";
  }

  /** MakeGoodMove(x): the first split that leaves a nim-sum of 0, or null. */
  function goodMove(s) {
    const x = nimSum(s);
    if (x === 0) return null;
    for (const heap of s.heaps) {
      let rest = x;
      if (heap.size > 2) rest ^= value(heap.size);
      for (let k = 1; k < heap.size - 1; k++) {
        if (k !== heap.size - k && (value(k) ^ value(heap.size - k) ^ rest) === 0) return { heap, k };
      }
    }
    return null;
  }

  /** MakeRandomMove(): a random long heap, cut at 2 + (int)(random * (size - 2)), never in half. */
  function randomMove(s, rnd) {
    const long = s.heaps.filter((h) => h.size > 2);
    const heap = long[Math.trunc(rnd() * long.length)];
    let k = 2 + Math.trunc((heap.size - 2) * rnd());
    while (k === heap.size - k) k = 2 + Math.trunc((heap.size - 2) * rnd());
    return { heap, k };
  }

  /** Play(): the computer's reply. Returns the move it made. */
  function computerMove(s, rnd = Math.random) {
    if (s.over || s.turn !== "computer") return null;
    const move = goodMove(s) || randomMove(s, rnd);
    split(s, move.heap, move.k);
    if (finished(s)) {
      s.over = true;
      s.winner = "computer";
    } else {
      s.turn = "you";
    }
    return { row: move.heap.row, at: move.heap.at, k: move.k };
  }

  return {
    NIM_VALUE, MAX_SIZE, MAX_HEAPS, DEFAULT_SIZE, DEFAULT_HEAPS,
    value, start, nimSum, finished, playerMove, goodMove, computerMove,
  };
})();
