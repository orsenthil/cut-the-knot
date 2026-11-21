"use strict";

/*
 * Coin Change, from Alexander Bogomolny's applet CoinChange.
 *
 * The applet asks a question, not a game: in how many ways can an amount of
 * money be changed into a given set of denominations? You tick which coin
 * values may be used (from 1, 2, 5, 10, 20, 25, 50, 100), choose an amount and
 * press Compute. It fills a table with the number of ways to make every amount
 * from 1 up to the amount you chose. There is no winner; the demo counts as
 * explored once Compute has been pressed.
 *
 * The one idea the code relies on is the generating function. One coin of
 * value d can be used 0, 1, 2, ... times, which contributes the factor
 *     1 + x^d + x^(2d) + ...
 * and multiplying the factors for all the chosen coins gives a polynomial in
 * which the coefficient of x^n is exactly the number of ways to change n
 * (order of the coins does not matter). The applet builds those factors as
 * long[] arrays and convolves them (its GeoPoly.Times). This core computes the
 * same coefficients with the equivalent running sum
 *     ways[0] = 1;  ways[n] += ways[n - d]   for each chosen coin d.
 *
 * The applet kept its counts in Java's 64-bit long, which silently overflows
 * for large amounts with many denominations. This port keeps exact integers
 * (BigInt) instead, so the numbers are always right; the maths note says so.
 *
 * No DOM, no storage: everything here is a pure function over plain data. The
 * position { denoms, amount, explored } is plain JSON, so it can be saved for
 * the tutor as it is. This file defines one global, CoinChangeCore.
 */
const CoinChangeCore = (() => {
  // The applet's static Powers[] table and the eight AWT checkboxes in order.
  const POWERS = [1, 2, 5, 10, 20, 25, 50, 100];
  // B1, B5, B10, B25, B50 start checked; B2, B20, B100 start unchecked.
  const DEFAULT_DENOMS = [1, 5, 10, 25, 50];
  // The PVNumeric object in the spinner: min 1, max 30000, step 1, default 100.
  const AMOUNT = { min: 1, max: 30000, step: 1, initial: 100 };

  /** Keep an amount inside the spinner's range, on its step. */
  function clampAmount(value) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = AMOUNT.initial;
    n = Math.round(n / AMOUNT.step) * AMOUNT.step;
    if (n < AMOUNT.min) n = AMOUNT.min;
    if (n > AMOUNT.max) n = AMOUNT.max;
    return n;
  }

  /** Keep only real denominations, once each, in the applet's ascending order. */
  function normalizeDenoms(list) {
    if (!Array.isArray(list)) return DEFAULT_DENOMS.slice();
    const chosen = new Set();
    for (const v of list) {
      const d = Number(v);
      if (POWERS.indexOf(d) !== -1) chosen.add(d);
    }
    return POWERS.filter((d) => chosen.has(d));
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const o = options || {};
    const denoms = Object.prototype.hasOwnProperty.call(o, "denoms")
      ? normalizeDenoms(o.denoms)
      : DEFAULT_DENOMS.slice();
    return { denoms, amount: clampAmount(o.amount), explored: false };
  }

  /** Tick or untick one coin. An unknown value is ignored. */
  function toggleDenom(state, value) {
    const d = Number(value);
    if (POWERS.indexOf(d) === -1) return state;
    const denoms = state.denoms.indexOf(d) === -1
      ? normalizeDenoms(state.denoms.concat([d]))
      : state.denoms.filter((x) => x !== d);
    return { denoms, amount: state.amount, explored: false };
  }

  /** Replace the whole selection (used by the checkbox group). */
  function setDenoms(state, list) {
    return { denoms: normalizeDenoms(list), amount: state.amount, explored: false };
  }

  /** Move the spinner; out-of-range values clamp to the applet's limits. */
  function setAmount(state, value) {
    return { denoms: state.denoms.slice(), amount: clampAmount(value), explored: false };
  }

  /** Press Compute: the demo is now explored. */
  function explore(state) {
    return { denoms: state.denoms.slice(), amount: state.amount, explored: true };
  }

  /** "done" once Compute has been pressed — a demo has no win or loss. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /**
   * ways[n] for n = 0 .. amount, as exact BigInts. ways[0] = 1 (there is one
   * way to make nothing: take no coins). Processing each coin once, from low
   * to high, counts combinations rather than orderings, which is what the
   * generating-function product in the applet counts.
   */
  function ways(amount, denoms) {
    const a = clampAmount(amount);
    const ds = normalizeDenoms(denoms);
    const w = new Array(a + 1);
    w.fill(0n);
    w[0] = 1n;
    for (const d of ds) {
      for (let n = d; n <= a; n++) w[n] += w[n - d];
    }
    return w;
  }

  /** The exact number of ways to change one amount, as a decimal string. */
  function countWays(amount, denoms) {
    const a = clampAmount(amount);
    return ways(a, denoms)[a].toString();
  }

  /** The applet's table rows, amounts 1 .. amount, as JSON-friendly strings. */
  function table(state) {
    const w = ways(state.amount, state.denoms);
    const rows = new Array(state.amount);
    for (let n = 1; n <= state.amount; n++) {
      rows[n - 1] = { amount: n, ways: w[n].toString() };
    }
    return rows;
  }

  return {
    POWERS, DEFAULT_DENOMS, AMOUNT,
    clampAmount, normalizeDenoms, start, toggleDenom, setDenoms, setAmount,
    explore, result, ways, countWays, table,
  };
})();
