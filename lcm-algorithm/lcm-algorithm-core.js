"use strict";

/*
 * Algorithm for Computing the LCM, from Bogomolny's applet LCM.
 *
 * Start with positive integers x_1..x_n. At each step increase the smallest
 * current value by its original number. When all values are equal, that
 * common value is their least common multiple. The applet compares this with
 * the usual gcd-based formula.
 *
 * The key idea is that every value stays a multiple of its original number,
 * and none can pass the LCM before the others catch up. The logic test checks
 * convergence and the final value against direct LCM computation on random
 * sets, plus the page's small examples.
 *
 * No document, no window, no storage: one global, LcmAlgorithmCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LcmAlgorithmCore = (() => {
  function gcd(a, b) {
    while (b !== 0) { [a, b] = [b, a % b]; }
    return Math.abs(a);
  }

  function directLcm(numbers) {
    return numbers.reduce((a, b) => a / gcd(a, b) * b, 1);
  }

  function start(numbers) {
    const values = numbers && numbers.length >= 2 ? numbers.slice() : [6, 10, 15];
    return { originals: values.slice(), values: values.slice(), steps: 0, history: [] };
  }

  function smallestIndex(values) {
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] < values[best]) best = i;
    return best;
  }

  function finished(state) {
    return state.values.every((v) => v === state.values[0]);
  }

  function step(state) {
    if (finished(state)) return state;
    const index = smallestIndex(state.values);
    const values = state.values.slice();
    const before = values[index];
    values[index] += state.originals[index];
    return {
      ...state,
      values,
      steps: state.steps + 1,
      history: state.history.concat([{ index, before, after: values[index] }]),
    };
  }

  function run(state, limit = 100000) {
    let at = state;
    while (!finished(at) && at.steps < limit) at = step(at);
    return at;
  }

  function analyze(state) {
    const target = directLcm(state.originals);
    return {
      originals: state.originals.slice(),
      values: state.values.slice(),
      steps: state.steps,
      finished: finished(state),
      current: state.values[0],
      lcm: target,
      multiples: state.values.every((v, i) => v % state.originals[i] === 0),
      belowTarget: state.values.every((v) => v <= target),
      last: state.history[state.history.length - 1] || null,
    };
  }

  function setNumber(state, index, value) {
    const n = Math.max(1, Math.trunc(Number(value)) || 1);
    if (index < 0 || index >= state.originals.length) return state;
    const originals = state.originals.slice();
    originals[index] = n;
    return start(originals);
  }

  return { gcd, directLcm, start, smallestIndex, finished, step, run, analyze, setNumber };
})();
