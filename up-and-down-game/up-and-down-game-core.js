"use strict";

/*
 * Monotone Number Sequences, from Alexander Bogomolny's applet UpAndDownGame.
 *
 * The numbers 1..N are placed one per box, in any order. A win is a full board
 * with no four numbers that go steadily up or steadily down when read from left
 * to right (a subsequence: the four boxes need not touch). The key idea is that
 * such a four-chain exists as soon as four increasing (or decreasing) values can
 * be picked out in order, so the test below searches for one chain and reports
 * the boxes it uses, which the page highlights.
 *
 * With N = 9 an arrangement without a four-chain exists; with N = 10 none does
 * (the pigeonhole principle behind Erdos and Szekeres's theorem). The logic
 * test checks both claims by looking at every permutation.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, UpAndDownGameCore. The position is plain
 * data, so it can be saved and handed to the tutor as it is.
 */
const UpAndDownGameCore = (() => {
  /** The applet's "Length of sequence" option: 9 or 10. */
  const SIZES = [9, 10];
  /** The forbidden chain length: four numbers going up or going down. */
  const CHAIN = 4;

  /** The position a new game starts from: N empty boxes, numbers 1..N loose. */
  function start(options) {
    const n = SIZES.includes(options && options.n) ? options.n : 9;
    return { n, boxes: Array(n).fill(null), moves: 0 };
  }

  /** All ways to put one of the numbers into one of the boxes. */
  function legalMoves(state) {
    const out = [];
    for (let value = 1; value <= state.n; value++) {
      for (let box = 0; box < state.n; box++) {
        if (state.boxes[box] !== value) out.push({ value, box });
      }
    }
    return out;
  }

  /**
   * Put `value` in `box`. If it was in another box that box empties; if `box`
   * held a number that number becomes loose again. This is how the player can
   * rearrange a board that already has a four-chain in it.
   */
  function move(state, m) {
    if (!m || !Number.isInteger(m.value) || !Number.isInteger(m.box)) return null;
    if (m.value < 1 || m.value > state.n || m.box < 0 || m.box >= state.n) return null;
    if (state.boxes[m.box] === m.value) return null; // already there: no move
    const boxes = state.boxes.slice();
    const from = boxes.indexOf(m.value);
    if (from !== -1) boxes[from] = null;
    boxes[m.box] = m.value;
    return { n: state.n, boxes, moves: state.moves + 1 };
  }

  /** The numbers that are not in any box yet. */
  function looseNumbers(state) {
    const loose = [];
    for (let value = 1; value <= state.n; value++) {
      if (!state.boxes.includes(value)) loose.push(value);
    }
    return loose;
  }

  /**
   * The longest chain of boxes going strictly up (`up = true`) or strictly down
   * in value, read left to right. Empty boxes are skipped. Returns the box
   * indices in order (so the page can highlight them).
   */
  function longestChain(boxes, up) {
    const lengths = Array(boxes.length).fill(1);
    const previous = Array(boxes.length).fill(-1);
    let last = -1;
    for (let box = 0; box < boxes.length; box++) {
      const value = boxes[box];
      if (value === null) continue;
      for (let earlier = 0; earlier < box; earlier++) {
        const other = boxes[earlier];
        if (other === null) continue;
        if (!(up ? value > other : value < other)) continue;
        if (lengths[earlier] + 1 > lengths[box]) {
          lengths[box] = lengths[earlier] + 1;
          previous[box] = earlier;
        }
      }
      if (last === -1 || lengths[box] > lengths[last]) last = box;
    }
    const chain = [];
    for (let box = last; box !== -1; box = previous[box]) chain.push(box);
    return chain.reverse();
  }

  /**
   * A forbidden four-chain in the current board, or null. The applet checks
   * both directions (in an order chosen at random, which cannot change the
   * answer). We check up first and report the boxes to highlight.
   */
  function faulty(state) {
    const up = longestChain(state.boxes, true);
    if (up.length >= CHAIN) return { direction: "up", indices: up.slice(0, CHAIN) };
    const down = longestChain(state.boxes, false);
    if (down.length >= CHAIN) return { direction: "down", indices: down.slice(0, CHAIN) };
    return null;
  }

  /** "win", "lose", or null while the board is still being filled. */
  function result(state) {
    if (state.boxes.some((value) => value === null)) return null;
    return faulty(state) ? "lose" : "win";
  }

  return { SIZES, CHAIN, start, legalMoves, move, looseNumbers, longestChain, faulty, result };
})();
