"use strict";

/*
 * The Rule of Change of Addends, from Bogomolny's applet AdditionLawOfChange.
 *
 * The board starts at 1 + 1 = 2. Either addend can be increased or decreased;
 * the sum on the right is recomputed from them every time, and dot patterns
 * show the three numbers. The point is the rule: when one addend changes by
 * k, the sum changes by exactly k.
 *
 * The key idea is that the sum is never stored — it is computed from the two
 * addends, so it cannot drift. The logic test checks the rule exhaustively on
 * the applet's 0..100 range and confirms the dot counts match the numbers.
 *
 * No document, no window, no storage: one global, AdditionLawOfChangeCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const AdditionLawOfChangeCore = (() => {
  const MIN = 0;
  const MAX = 100;
  const DEFAULT_MAX_NUM = 10;

  function start(options) {
    const opts = options || {};
    return {
      a: opts.a === undefined ? 1 : clamp(opts.a),
      b: opts.b === undefined ? 1 : clamp(opts.b),
      maxNum: opts.maxNum === undefined ? DEFAULT_MAX_NUM : Math.max(1, Math.trunc(Number(opts.maxNum)) || DEFAULT_MAX_NUM),
    };
  }

  function clamp(value) {
    return Math.max(MIN, Math.min(MAX, Math.trunc(Number(value)) || 0));
  }

  function sum(state) {
    return state.a + state.b;
  }

  /** Change one addend by `delta`, clamped to the applet's 0..100 limits. */
  function change(state, which, delta) {
    if (which !== "a" && which !== "b") return state;
    const step = Math.trunc(Number(delta)) || 0;
    return { ...state, [which]: clamp(state[which] + step) };
  }

  /** The dot rows: a dots, b dots, and the combined a+b dots. */
  function dots(state) {
    return { a: state.a, b: state.b, sum: sum(state) };
  }

  /** Clicking left of a number's centre decreases it, right increases it. */
  function clickSide(state, which, side) {
    return change(state, which, side === "right" ? 1 : -1);
  }

  return { MIN, MAX, DEFAULT_MAX_NUM, start, clamp, sum, change, dots, clickSide };
})();
