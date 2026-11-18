"use strict";

/*
 * Counting and Listing All Combinations, from Bogomolny's applet
 * AllCombinations (which uses the Combination class from CTKAlgebra).
 *
 * The applet lists every way to choose M objects from N, writing each choice
 * as the numbers 1..N it contains. Its Combination class generates the choices
 * in lexicographic order: start at 0,1,...,M-1 (zero-based), then repeatedly
 * advance the rightmost position that still has room and reset the ones after
 * it. It keeps a BigInteger countdown so it knows when to stop.
 *
 * The key idea is that the countdown equals the binomial coefficient C(N, M)
 * — there are exactly that many rows, all distinct. The logic test checks the
 * order against an independent recursive generator over the whole option range.
 *
 * No document, no window, no storage: one global, AllCombinationsCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const AllCombinationsCore = (() => {
  const MIN_N = 2;
  const MAX_N = 20;
  const MIN_M = 1;
  const MAX_M = 20;

  const clamp = (value, low, high, fallback) => {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : fallback;
  };

  function factorial(n) {
    let result = 1n;
    for (let k = 2; k <= n; k++) result *= BigInt(k);
    return result;
  }

  /** C(n, m), as a BigInteger because C(20,10) is already 184,756. */
  function count(n, m) {
    if (m < 0 || m > n) return 0n;
    return factorial(n) / (factorial(m) * factorial(n - m));
  }

  function options(raw) {
    const opts = raw || {};
    const n = clamp(opts.n === undefined ? 5 : opts.n, MIN_N, MAX_N, 5);
    // The panel forces M down to N when the two steppers disagree.
    const m = Math.min(n, clamp(opts.m === undefined ? 3 : opts.m, MIN_M, MAX_M, 3));
    return { n, m };
  }

  function start(raw) {
    const { n, m } = options(raw);
    const current = Array.from({ length: m }, (_, i) => i);
    return { n, m, current, remaining: count(n, m), first: true };
  }

  function hasMore(state) {
    return state.remaining > 0n;
  }

  /** The next zero-based combination, transcribed from Combination.getNext. */
  function getNext(state) {
    if (state.remaining <= 0n) return null;
    const a = state.current.slice();
    if (state.first) return a;
    let i = a.length - 1;
    while (i >= 0 && a[i] === state.n - state.m + i) i--;
    if (i < 0) return null;
    a[i] += 1;
    for (let j = i + 1; j < a.length; j++) a[j] = a[i] + (j - i);
    return a;
  }

  /** Advance a position held by the caller, returning the new combination. */
  function nextState(state) {
    const a = getNext(state);
    if (!a) return null;
    return { ...state, current: a, first: false, remaining: state.remaining - 1n };
  }

  function display(combination) {
    return combination.map((v) => v + 1);
  }

  /** Independent lexicographic generator, used by the test as a second source. */
  function all(n, m) {
    const out = [];
    const walk = (start, chosen) => {
      if (chosen.length === m) {
        out.push(chosen.slice());
        return;
      }
      for (let v = start; v <= n - (m - chosen.length); v++) {
        chosen.push(v);
        walk(v + 1, chosen);
        chosen.pop();
      }
    };
    walk(0, []);
    return out;
  }

  return {
    MIN_N, MAX_N, MIN_M, MAX_M, clamp, factorial, count, options, start,
    hasMore, getNext, nextState, display, all,
  };
})();
