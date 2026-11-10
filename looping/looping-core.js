"use strict";

/*
 * Looping Chips (Bogomolny's Looping applet) - the rules and the invariant.
 *
 * Twelve squares sit in a loop. Four coloured chips start on squares 0..3.
 * A chip may jump L = 5 places clockwise or counterclockwise onto an empty
 * square (the applet's CanSettle: destination must be ±5 mod 12 and empty).
 * The stated goal is to put the four chips back on those home squares in
 * reverse order: 4, 3, 2, 1.
 *
 * The same move graph can be drawn as a single 12-cycle by reading squares
 * in the order (i * 5) mod 12 - that is the applet's right-hand board
 * (m_Board2). On that board a legal move is just a step to a neighbouring
 * empty slot, so chips can never pass each other: their cyclic order is an
 * invariant. The start order and the reverse-order goal are opposite
 * orientations of the cycle, so the goal is unreachable. The page says so
 * ("the puzzle is, in principle, insolvable"); the applet never announces a
 * win, and neither does this port.
 *
 * porting/check-looping.mjs checks the move rule against CanSettle, the
 * invariant, and an exhaustive BFS that the reverse goal is unreachable.
 */

var LoopingCore = (function () {
  const N = 12;
  const M = 4;
  const L = 5;
  const HOME = [0, 1, 2, 3];
  // Chip ids 1..4, matching MoveableChip ids / m_Loc values in the applet.
  const COLORS = { 1: "red", 2: "yellow", 3: "blue", 4: "gray" };

  /** Right-board index i shows left-board square (i * L) mod N. */
  function leftOf(right) {
    return (right * L) % N;
  }

  /** Inverse of leftOf: which right-board slot shows left-board square s. */
  function rightOf(left) {
    for (let r = 0; r < N; r++) if (leftOf(r) === left) return r;
    return -1;
  }

  /** Rectangular-loop layout of the left board, matching LoopingCanvas.Reset. */
  function leftCell(i) {
    // Top row 0..3, right column 4..6, bottom row 7..9, left column 10..11.
    if (i <= 3) return { row: 0, col: i };
    if (i <= 6) return { row: i - 3, col: 3 };
    if (i <= 9) return { row: 3, col: 9 - i };
    return { row: 12 - i, col: 0 };
  }

  function start() {
    const loc = new Array(N).fill(0);
    for (let i = 0; i < M; i++) loc[i] = i + 1;
    return { loc, moves: 0 };
  }

  /** CanSettle's destination check: empty and ±L steps on the left board. */
  function legal(state, from, to) {
    if (from === to) return false;
    if (!state.loc[from] || state.loc[to]) return false;
    const d = (to - from + N) % N;
    return d === L || d === N - L;
  }

  function legalMoves(state, from) {
    const out = [];
    for (let to = 0; to < N; to++) if (legal(state, from, to)) out.push(to);
    return out;
  }

  function move(state, from, to) {
    if (!legal(state, from, to)) return null;
    const loc = state.loc.slice();
    loc[to] = loc[from];
    loc[from] = 0;
    return { loc, moves: state.moves + 1 };
  }

  /** Chips on the home squares, reading left to right, or null if any home is empty. */
  function homeChips(state) {
    const chips = HOME.map((s) => state.loc[s]);
    return chips.every((c) => c > 0) ? chips : null;
  }

  /** The stated goal: home squares hold 4, 3, 2, 1. Unreachable; kept for the test. */
  function isReversed(state) {
    const chips = homeChips(state);
    return chips !== null && chips[0] === 4 && chips[1] === 3 && chips[2] === 2 && chips[3] === 1;
  }

  /** Cyclic order of chip ids walking the right-hand board. */
  function cyclicOrder(state) {
    const order = [];
    for (let r = 0; r < N; r++) {
      const chip = state.loc[leftOf(r)];
      if (chip) order.push(chip);
    }
    return order;
  }

  /** Same cyclic sequence up to rotation (direction matters). */
  function sameCycle(a, b) {
    if (a.length !== b.length) return false;
    const doubled = a.concat(a);
    return doubled.join(",").includes(b.join(","));
  }

  return {
    N, M, L, HOME, COLORS,
    leftOf, rightOf, leftCell,
    start, legal, legalMoves, move,
    homeChips, isReversed, cyclicOrder, sameCycle,
  };
})();
