"use strict";

/*
 * Sums and Products, from Bogomolny's applet Invariant.
 *
 * Pick two numbers A and B and replace them by A*B + A + B. Since that equals
 * (A+1)(B+1) - 1, the quantity P = ∏(A_i + 1) - 1 is unchanged by every move.
 * When only one number is left it must therefore equal the P computed at the
 * start — the final answer can be predicted before a single move is made.
 *
 * The key idea is that the operation turns the product of (A+1) and (B+1)
 * into the (single) factor of the replacement. The logic test checks the
 * invariant against every possible move on small lists and confirms that all
 * reduction orders give the same final number.
 *
 * No document, no window, no storage: one global, SumsProductsInvariantCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const SumsProductsInvariantCore = (() => {
  const MIN_COUNT = 2;
  const MAX_COUNT = 12;
  const MIN_MAX = 1;
  const MAX_MAX = 20;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function start(options) {
    const opts = options || {};
    const count = clamp(opts.count === undefined ? 5 : opts.count, MIN_COUNT, MAX_COUNT, 5);
    const max = clamp(opts.max === undefined ? 8 : opts.max, MIN_MAX, MAX_MAX, 8);
    const random = opts.random || Math.random;
    const values = opts.values ? opts.values.slice(0, count) : Array.from({ length: count }, () => 1 + Math.floor(random() * max));
    return { values, count, max, original: values.slice(), steps: [] };
  }

  /** P = (A1+1)(A2+1)...(An+1) - 1. */
  function invariant(values) {
    return values.reduce((p, v) => p * (v + 1), 1) - 1;
  }

  function combineValues(a, b) {
    return a * b + a + b;
  }

  /** Replace positions i and j with their combination (i is removed). */
  function combine(state, i, j) {
    if (i === j || i < 0 || j < 0 || i >= state.values.length || j >= state.values.length) return state;
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    const a = state.values[lo];
    const b = state.values[hi];
    const result = combineValues(a, b);
    const values = state.values.filter((_, k) => k !== lo && k !== hi);
    values.splice(lo, 0, result);
    return {
      ...state,
      values,
      steps: state.steps.concat([{ a, b, result, label: `${a}×${b}+${a}+${b}=${result}` }]),
    };
  }

  /** Reduce a list by repeatedly combining the first two entries. */
  function reduce(values, order) {
    let state = { values: values.slice(), steps: [] };
    const pairs = order || Array.from({ length: values.length - 1 }, () => [0, 1]);
    for (const [i, j] of pairs) {
      const next = combine(state, i, j);
      if (next.values.length === state.values.length) break;
      state = next;
    }
    return { values: state.values, steps: state.steps, final: state.values[0] };
  }

  function repeat(state) {
    return { ...state, values: state.original.slice(), steps: [] };
  }

  function setCount(state, value) {
    const count = clamp(value, MIN_COUNT, MAX_COUNT, state.count);
    const random = Math.random;
    const values = Array.from({ length: count }, () => 1 + Math.floor(random() * state.max));
    return { ...state, count, values, original: values.slice(), steps: [] };
  }

  function setMax(state, value) {
    return { ...state, max: clamp(value, MIN_MAX, MAX_MAX, state.max) };
  }

  function analyze(state) {
    return {
      values: state.values.slice(),
      count: state.count,
      max: state.max,
      invariant: invariant(state.values),
      initialInvariant: invariant(state.original),
      remaining: state.values.length,
      finished: state.values.length === 1,
      last: state.steps[state.steps.length - 1]?.label || "",
    };
  }

  return {
    MIN_COUNT, MAX_COUNT, MIN_MAX, MAX_MAX, clamp, start, invariant, combineValues,
    combine, reduce, repeat, setCount, setMax, analyze,
  };
})();
