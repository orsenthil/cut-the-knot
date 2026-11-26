"use strict";

/*
 * Universal Coloring, from Alexander Bogomolny's applet UniversalColoring.
 *
 * There are n^2 dots on a circle, each painted with one of n colours. A click
 * cycles a dot to the next colour (modulo n). Reading successive dots round
 * the circle gives n^2 ordered pairs of colours; the puzzle asks for all n^2
 * possible pairs to appear. That is exactly a de Bruijn cycle of order 2:
 * an Euler tour of the complete digraph on n vertices (loops included), where
 * every vertex has n arcs in and n arcs out. Hierholzer's stack construction
 * makes one from any starting colour without ever getting stuck.
 *
 * No document, no window, no storage: the position is plain data and this
 * file defines one global, UniversalColoringCore.
 */
const UniversalColoringCore = (() => {
  const MIN_N = 2;
  const MAX_N = 6;
  const DEFAULT_N = 4;   // the applet's NEdit starts at 4
  const PALETTE = 6;    // the applet's palette holds six colours

  /** The applet's spinner: whole numbers 2 through 6. */
  function clampN(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  /** The position a new game starts from: n^2 dots, all colour 0. */
  function start(options = {}) {
    const n = clampN(options && options.n !== undefined ? options.n : DEFAULT_N);
    return { n, dots: new Array(n * n).fill(0), clicks: 0 };
  }

  /** Changing the number of colours runs the applet's Reset: every dot goes to 0. */
  function setN(state, value) {
    return start({ n: value });
  }

  /** Any dot may be clicked. */
  function legalMoves(state) {
    return state.dots.map((_, i) => i);
  }

  /** Bob.CycleColor(): Which = (Which + 1) % N, on a copy of the position. */
  function move(state, m) {
    if (!Number.isInteger(m) || m < 0 || m >= state.dots.length) return null;
    const dots = state.dots.slice();
    dots[m] = (dots[m] + 1) % state.n;
    return { n: state.n, dots, clicks: state.clicks + 1 };
  }

  /**
   * CompleteGraph.ProcessBobs(): clear every arc, then light the arc from
   * each dot to the next one round the circle (the last wraps to the first).
   * The result is an n by n table of booleans, row = from, column = to.
   */
  function edges(state) {
    const { n, dots } = state;
    const lit = Array.from({ length: n }, () => new Array(n).fill(false));
    const m = dots.length;
    for (let i = 0; i < m; i++) {
      lit[dots[i]][dots[(i + 1) % m]] = true;
    }
    return lit;
  }

  /** How many of the n^2 ordered pairs are present, and which are missing. */
  function check(state) {
    const lit = edges(state);
    const missing = [];
    let found = 0;
    for (let a = 0; a < state.n; a++) {
      for (let b = 0; b < state.n; b++) {
        if (lit[a][b]) found++;
        else missing.push([a, b]);
      }
    }
    const total = state.n * state.n;
    return { total, found, missing, complete: found === total };
  }

  /** A demo: finished exactly when all ordered pairs are on the circle. */
  function result(state) {
    return check(state).complete ? "done" : null;
  }

  /**
   * Hierholzer's algorithm on the complete digraph with loops: from each
   * colour take its next unused outgoing arc (to 0, 1, ..., n - 1), and when
   * a colour has none left, backtrack, adding it to the circuit. Reversing
   * the backtrack order stitches the small loops into one Euler cycle.
   * Returns n^2 colours; the pair from the last back to the first is included.
   */
  function eulerTour(n, first = 0) {
    const size = clampN(n);
    const s = ((Math.round(Number(first)) % size) + size) % size;
    const next = new Array(size).fill(0);
    const stack = [s];
    const back = [];
    while (stack.length) {
      const v = stack[stack.length - 1];
      if (next[v] < size) {
        stack.push(next[v]++);
      } else {
        back.push(stack.pop());
      }
    }
    back.reverse();
    return back.slice(0, -1);
  }

  /** A correct colouring, starting the Euler cycle at any colour. */
  function solution(n, first = 0) {
    return eulerTour(n, first);
  }

  /** Read the same circle the other way round. */
  function reverseCycle(dots) {
    return dots.slice().reverse();
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, PALETTE,
    clampN, start, setN, legalMoves, move, edges, check, result,
    eulerTour, solution, reverseCycle,
  };
})();
