"use strict";

/*
 * Signs and Sums in a Sequence, from Alexander Bogomolny's applet NegPosSum.
 *
 * A row of whole numbers in which every three neighbours add up to something
 * positive. Can the whole row add up to something negative? It depends on the
 * length N. If N is a multiple of 3 the row splits into triples, so the total
 * is positive. If N leaves 1 or 2 over, it can be negative: take a period of
 * three, a + b + c = 1, and make the leftover terms sum below zero.
 *
 * This file is the logic only. It defines one global, SignsAndSumsCore. The
 * position is plain data: { n, values }. Functions return new positions.
 */
const SignsAndSumsCore = (() => {
  const MIN_N = 4, MAX_N = 13;       // the applet's length spinner: 4..13
  const LOW = -5, HIGH = 5;          // a new row is random in -5..5

  /** The applet's own draw: int(random * 11 - 5), which is -5..5. */
  function randomValue(random) {
    return Math.trunc(random() * 11 - 5);
  }

  /** A new random row of n numbers (n is kept inside 4..13). */
  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const n = clampN(o.n === undefined ? 4 : o.n);
    const values = [];
    for (let i = 0; i < n; i++) values.push(randomValue(random));
    return { n, values };
  }

  function clampN(n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return MIN_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  /** The sums of every three neighbours: n - 2 numbers. */
  function tripleSums(values) {
    const out = [];
    for (let i = 0; i + 2 < values.length; i++) out.push(values[i] + values[i + 1] + values[i + 2]);
    return out;
  }

  function total(values) {
    let t = 0;
    for (const v of values) t += v;
    return t;
  }

  /** Every triple sum is positive. */
  function allTriplesPositive(values) {
    return tripleSums(values).every((s) => s > 0);
  }

  /** The row the puzzle asks for: every triple positive, the total negative. */
  function solved(state) {
    return allTriplesPositive(state.values) && total(state.values) < 0;
  }

  /** The position with one number changed by delta (+1 or -1 on the page). */
  function nudge(state, index, delta) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n) return null;
    if (!Number.isInteger(delta) || delta === 0) return null;
    const values = state.values.slice();
    values[index] += delta;
    return { n: state.n, values };
  }

  /** The position with the length changed: a new random row, as the applet does. */
  function resize(state, n, random) {
    return start({ n, random });
  }

  /**
   * A row of n numbers, every three positive, total negative, built by the
   * page's period-three argument, or null when n is a multiple of 3 (none
   * exists). a + b + c = 1.
   *   n = 3k + 1: (a, b, c) = (-k - 1, k, 2)
   *   n = 3k + 2: (a, b, c) = (-k, -1, k + 2)
   */
  function construct(n) {
    if (!Number.isInteger(n) || n < 3 || n % 3 === 0) return null;
    const k = Math.floor(n / 3);
    const period = n % 3 === 1 ? [-k - 1, k, 2] : [-k, -1, k + 2];
    const values = [];
    for (let i = 0; i < n; i++) values.push(period[i % 3]);
    return { n, values };
  }

  /** What to tell the player about this length. */
  function verdict(n) {
    return n % 3 === 0 ? "never" : "possible";
  }

  return { MIN_N, MAX_N, LOW, HIGH, start, clampN, tripleSums, total, allTriplesPositive, solved, nudge, resize, construct, verdict };
})();
