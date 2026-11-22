"use strict";

/*
 * Square Sieve, from Alexander Bogomolny's applet SquareSieve.
 *
 * Write 1 to N, all blue. On step k, flip the colour of every multiple of k
 * (k itself included): blue to red, red to blue. After N steps, which
 * numbers are red? The factors of m come in pairs m = a * b, and steps a and
 * b flip m once each, so they cancel, unless a = b: then only one flip is
 * left. So m ends red exactly when it is a perfect square.
 *
 * The position is plain data: { n, next, red } where red[m-1] is true when
 * m is red, and next is the step to perform (n + 1 when all are done).
 * N runs from 5 to 250 in the applet, 50 by default. DOM-free; one global.
 */
const SquareSieveCore = (() => {
  const MIN_N = 5, MAX_N = 250, DEFAULT_N = 50;

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!Number.isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(MIN_N, n));
  }

  /** A fresh sieve: everything blue, step 1 next. */
  function start(options) {
    const n = clampN(options && options.n !== undefined ? options.n : DEFAULT_N);
    return { n, next: 1, red: new Array(n).fill(false) };
  }

  /** Whether another step can be done. */
  function canStep(state) {
    return state.next <= state.n;
  }

  /** Does step k flip m? (k divides m) */
  function flips(k, m) {
    return m % k === 0;
  }

  /** The position after the next step (the same position if all are done). */
  function step(state) {
    if (!canStep(state)) return state;
    const k = state.next;
    const red = state.red.slice();
    for (let m = k; m <= state.n; m += k) red[m - 1] = !red[m - 1];
    return { n: state.n, next: k + 1, red };
  }

  /** All the steps that are left. */
  function finish(state) {
    let s = state;
    while (canStep(s)) s = step(s);
    return s;
  }

  /** "done" once every step has been performed, else null. */
  function result(state) {
    return canStep(state) ? null : "done";
  }

  /** The red numbers, in order. */
  function redNumbers(state) {
    const out = [];
    state.red.forEach((r, i) => { if (r) out.push(i + 1); });
    return out;
  }

  return { MIN_N, MAX_N, DEFAULT_N, clampN, start, canStep, flips, step, finish, result, redNumbers };
})();
