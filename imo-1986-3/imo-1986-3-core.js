"use strict";

/*
 * Integer Iterations on a Circle III, from Bogomolny's applet IMO1986_3
 * (IMO 1986 problem 3).
 *
 * Five integers on a pentagon have positive total. If a number y is negative,
 * replace its neighbours x and z by x+y and z+y, and y by -y. The claim is
 * that this must stop. The page's solution uses the potential
 * f = sum (x_k - x_{k+2})²: one step changes it by 2*y*(total sum) < 0, so f
 * strictly decreases and cannot do so forever (it is a sum of squares).
 *
 * The key idea is that the positive total makes f decrease by at least 2 each
 * step. The logic test checks this identity and that random starts terminate.
 *
 * No document, no window, no storage: one global, Imo1986_3Core. The position
 * is plain data, so it can be saved and handed to the tutor.
 */
const Imo1986_3Core = (() => {
  function start() {
    return { values: [4, -3, 2, -1, 5], steps: 0, history: [] };
  }

  function isValid(values) {
    return values.length === 5 && values.every(Number.isInteger) && values.reduce((a, b) => a + b, 0) > 0;
  }

  /** f = sum of (x_k - x_{k+2})² over the five cyclic pairs. */
  function potential(values) {
    let sum = 0;
    for (let k = 0; k < 5; k++) sum += (values[k] - values[(k + 2) % 5]) ** 2;
    return sum;
  }

  /** Apply one step at a negative index, or return null if it is not allowed. */
  function step(state, index) {
    if (index < 0 || index >= 5 || state.values[index] >= 0) return null;
    const values = state.values.slice();
    const y = values[index];
    values[index] = -y;
    values[(index - 1 + 5) % 5] += y;
    values[(index + 1) % 5] += y;
    return {
      values,
      steps: state.steps + 1,
      history: state.history.concat([{ index, before: state.values.slice(), after: values.slice() }]),
    };
  }

  function negativeIndices(values) {
    const out = [];
    for (let i = 0; i < 5; i++) if (values[i] < 0) out.push(i);
    return out;
  }

  function finished(state) {
    return negativeIndices(state.values).length === 0;
  }

  /** Run the algorithm to completion, choosing the first negative each time. */
  function solve(initial, limit = 2000) {
    let state = { values: initial.slice(), steps: 0, history: [] };
    while (!finished(state) && state.steps < limit) {
      const index = negativeIndices(state.values)[0];
      const next = step(state, index);
      if (!next) break;
      state = next;
    }
    return state;
  }

  return { start, isValid, potential, step, negativeIndices, finished, solve };
})();
