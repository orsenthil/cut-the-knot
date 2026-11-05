"use strict";

/*
 * Hanoing - the DOM-free core.
 *
 * Port of Bogomolny's Hanoing applet (classes/Hanoing.zip: Hanoing,
 * HanoingPanel, HanoingCanvas, HanoingCanvas$ring).
 *
 * The puzzle is the Tower of Hanoi wearing a disguise. A row of n squares is
 * painted red, blue or white; clicking a square repaints it. A repaint is legal
 * only when the square is the leftmost of the colour it is losing and will be
 * the leftmost of the colour it gains. The goal is one colour everywhere.
 *
 * The key idea the code relies on: square i (counting from the left, 0 first)
 * is disk i, and its colour is the peg that disk sits on. Then
 *
 *   "leftmost of its colour"  =  "smallest disk on that peg"  =  "on top"
 *
 * so the first condition says you may only lift the top disk of a peg, and the
 * second says you may only drop it on a bigger one. The whole state is just
 * `peg[i]`, the peg of disk i, because the disks on a peg are always stacked
 * smallest first - there is nothing else to remember.
 *
 * `move` follows HanoingCanvas.CanMoveFrom: a click tries the next colour round
 * the cycle, (peg + 1) % 3, and then the one after, taking the first that is
 * legal. `suggest` follows HanoingCanvas.Help, which walks the disks from the
 * largest down and is deliberately biased towards white, as the original page
 * warns.
 */

const HanoingCore = (function () {
  /* HanoingPanel's N spinner: minimum 3, maximum 20, starting at 4. */
  const MIN_N = 3;
  const MAX_N = 20;
  const DEFAULT_N = 4;

  /* Peg 0 is red, 1 blue, 2 white, and Solve() runs 0 -> 2 via 1. */
  const PEGS = ["red", "blue", "white"];
  const WHITE = 2;

  /* HanoingCanvas.Announcement, assembled in Approve(). */
  const MESSAGES = {
    illegal: "Move is not allowed",
    won: "Congratulations!",
    optimal: "Hope you enjoyed it.",
    long: "Try using fewer moves.",
  };

  /** A fresh puzzle: every disk on peg 0, so every square red. */
  function newGame(n) {
    return { n, peg: new Array(n).fill(0), moves: 0, randomized: false };
  }

  /** The third peg, given two different ones. */
  const other = (a, b) => 3 - a - b;

  /** The smallest disk on `peg`, or -1 when it is empty. */
  function top(state, peg) {
    for (let i = 0; i < state.n; i++) if (state.peg[i] === peg) return i;
    return -1;
  }

  /** True when disk i is the top of its peg, i.e. leftmost of its colour. */
  function isTop(state, i) {
    return top(state, state.peg[i]) === i;
  }

  /**
   * Where clicking square i would send it, or -1 for no legal colour.
   *
   * HanoingCanvas.CanMoveFrom tries (from + 1) % 3 and then (from + 2) % 3 and
   * takes the first peg that is empty or whose top disk is bigger - which is
   * why the page says the colours "rotate through the sequence red-blue-white,
   * with illegal colors omitted".
   */
  function destination(state, i) {
    if (!isTop(state, i)) return -1;
    const from = state.peg[i];
    for (let step = 1; step <= 2; step++) {
      const to = (from + step) % 3;
      const t = top(state, to);
      if (t === -1 || i < t) return to;
    }
    return -1;
  }

  /** True when disk i may be moved to peg `to` at all (used by solve/suggest). */
  function legal(state, i, to) {
    if (to === state.peg[i] || !isTop(state, i)) return false;
    const t = top(state, to);
    return t === -1 || i < t;
  }

  /**
   * Click square i. Mutates `state` and returns
   * { ok, from, to, message, won }.
   */
  function click(state, i) {
    const to = destination(state, i);
    if (to < 0) {
      return { ok: false, from: state.peg[i], to: -1, message: MESSAGES.illegal, won: false };
    }
    return apply(state, i, to);
  }

  /** Make the move disk i -> peg `to`, which the caller has checked. */
  function apply(state, i, to) {
    const from = state.peg[i];
    state.peg[i] = to;
    state.moves++;
    return { ok: true, from, to, message: "", won: isWon(state) };
  }

  /** Every square the same colour `c`: HanoingCanvas.AllOneColor(int). */
  function allOne(state, c) {
    return state.peg.every((p) => p === c);
  }

  /**
   * Which colours count as finished: HanoingCanvas.AllOneColor().
   *
   *   if (AllOneColor(2)) return true;              // white always wins
   *   return !Randomize && AllOneColor(1);          // blue only from the start
   *
   * So red never wins - it is where the standard puzzle begins - and after
   * Randomize only white does. That is stricter than the original page, which
   * says any colour may be the target after a randomize; the applet's own code
   * is what is ported here.
   */
  function targets(state) {
    return state.randomized ? [WHITE] : [1, WHITE];
  }

  function isWon(state) {
    return targets(state).some((c) => allOne(state, c));
  }

  /**
   * The fewest moves that can take disks 0..n-1 to `target` from here.
   *
   * Look at the largest disk. If it is already on the target, forget it and ask
   * the same question of the rest. If it is not, every smaller disk has to get
   * out of the way onto the one remaining peg first, which is the same question
   * again, then the big disk moves once, and then the tower of n-1 above it has
   * to be rebuilt on the target, which always costs 2^(n-1) - 1.
   */
  function minMovesTo(state, target) {
    let total = 0;
    let goal = target;
    for (let i = state.n - 1; i >= 0; i--) {
      if (state.peg[i] === goal) continue;
      total += 1 + (2 ** i - 1);
      goal = other(state.peg[i], goal);
    }
    return total;
  }

  /** The fewest moves to finish at all, over the colours that count. */
  function minMoves(state) {
    return Math.min(...targets(state).map((c) => minMovesTo(state, c)));
  }

  /**
   * The move HanoingCanvas.Help suggests: largest disk first, aiming at white,
   * flipping the aim to the third peg each time a disk is already settled
   * somewhere else or is buried. Returns { disk, to } or null.
   */
  function suggest(state) {
    let target = WHITE;
    for (let i = state.n - 1; i >= 0; i--) {
      const here = state.peg[i];
      if (target === here) continue;
      if (isTop(state, i)) {
        const t = top(state, target);
        if (t === -1 || t > i) return { disk: i, to: target };
      }
      target = other(here, target);
    }
    return null;
  }

  /**
   * HanoingCanvas.Solve: the textbook recursion, peg 0 to peg 2 via peg 1.
   * Returns the 2^n - 1 moves as { disk, to } pairs. Only meaningful from the
   * all-on-peg-0 start, which is why the applet falls back to repeated Help()
   * after Randomize.
   */
  function solveSequence(n) {
    const out = [];
    (function rec(k, from, aux, to) {
      if (k === 0) return;
      rec(k - 1, from, to, aux);
      out.push({ disk: k - 1, to });
      rec(k - 1, aux, from, to);
    })(n, 0, 1, 2);
    return out;
  }

  /**
   * A random position. Every assignment of disks to pegs is a legal Tower of
   * Hanoi position - the order on a peg is forced by the disk sizes - so this
   * only has to avoid handing back a puzzle that is already solved.
   */
  function randomize(n, rnd = Math.random) {
    const state = newGame(n);
    state.randomized = true;
    do {
      for (let i = 0; i < n; i++) state.peg[i] = Math.floor(rnd() * 3) % 3;
    } while (isWon(state));
    return state;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, PEGS, WHITE, MESSAGES,
    newGame, top, isTop, destination, legal, click, apply, allOne, targets, isWon,
    minMovesTo, minMoves, suggest, solveSequence, randomize, other,
  };
})();
