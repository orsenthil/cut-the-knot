"use strict";

/*
 * Horner's Method, from Bogomolny's applet HornerMethod.
 *
 * A polynomial with coefficients a_n ... a_0 is evaluated at x = t by the
 * nested form b_n = a_n, b_k = t*b_{k+1} + a_k. The final b_0 is P(t), and
 * b_1..b_n are the quotient coefficients when P is divided by (x - t). A
 * second Horner pass on the quotient gives P'(t), because P'(t) = Q(t).
 *
 * The key idea is that the same recurrence computes the value, the quotient
 * and the derivative. The logic test checks these against direct evaluation,
 * polynomial division and the analytic derivative over many polynomials.
 *
 * No document, no window, no storage: one global, HornerMethodCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const HornerMethodCore = (() => {
  function start() {
    // 2x^4 - 3x^3 + 0x^2 + x + 7, evaluated at 2, as on the applet's page.
    return { coefficients: [2, -3, 0, 1, 7], t: 2 };
  }

  /** Horner step: b from the highest coefficient down. */
  function table(coefficients, t) {
    const b = [];
    let acc = 0;
    for (const a of coefficients) {
      acc = t * acc + a;
      b.push(acc);
    }
    return {
      b,
      value: b.length ? b[b.length - 1] : 0,
      quotient: b.slice(0, -1),
      remainder: b.length ? b[b.length - 1] : 0,
    };
  }

  function evaluate(coefficients, t) {
    let result = 0;
    for (const a of coefficients) result = result * t + a;
    return result;
  }

  /** Direct power-sum evaluation, for the test's second transcription. */
  function direct(coefficients, t) {
    let sum = 0;
    for (let i = 0; i < coefficients.length; i++) sum += coefficients[i] * t ** (coefficients.length - 1 - i);
    return sum;
  }

  function derivativeAt(coefficients, t) {
    const first = table(coefficients, t);
    if (first.quotient.length === 0) return 0;
    return table(first.quotient, t).value;
  }

  function analyze(state) {
    const coeffs = state.coefficients;
    const r = table(coeffs, state.t);
    return {
      coefficients: coeffs.slice(), t: state.t,
      rows: r.b,
      value: r.value,
      quotient: r.quotient,
      remainder: r.remainder,
      derivative: derivativeAt(coeffs, state.t),
      degree: coeffs.length - 1,
    };
  }

  function setCoefficient(state, index, value) {
    const coefficients = state.coefficients.slice();
    if (index < 0 || index >= coefficients.length) return state;
    coefficients[index] = Math.max(-99, Math.min(99, Math.trunc(Number(value)) || 0));
    return { ...state, coefficients };
  }
  function setT(state, value) {
    return { ...state, t: Math.max(-20, Math.min(20, Math.trunc(Number(value)) || 0)) };
  }

  return { start, table, evaluate, direct, derivativeAt, analyze, setCoefficient, setT };
})();
