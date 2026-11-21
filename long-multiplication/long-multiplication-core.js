"use strict";

/*
 * Long Multiplication, from Bogomolny's applet LongMultiplication.
 *
 * The schoolbook algorithm splits the second factor into its digits and adds
 * the partial products, each shifted one place further left. Written compactly
 * the trailing zeros of each shift are omitted. The distributive law is the
 * whole idea: a(b + c) = ab + ac.
 *
 * The key idea is that each partial product is the first factor times one
 * digit of the second, at the right place value. The logic test checks the
 * page's examples and verifies the rows and their sum on many random pairs.
 *
 * No document, no window, no storage: one global, LongMultiplicationCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LongMultiplicationCore = (() => {
  function start() {
    return { a: 23, b: 761, compact: true };
  }

  function digits(n) {
    return String(n).split("").map(Number);
  }

  /** Partial products from the rightmost digit of b to the leftmost. */
  function partials(a, b, compact) {
    const ds = digits(b);
    const out = [];
    for (let j = ds.length - 1; j >= 0; j--) {
      const place = ds.length - 1 - j;
      const digit = ds[j];
      const full = a * digit * 10 ** place;
      out.push({ digit, place, value: compact ? a * digit : full, full });
    }
    return out;
  }

  function analyze(state) {
    const rows = partials(state.a, state.b, state.compact);
    const sum = rows.reduce((s, r) => s + r.full, 0);
    return {
      a: state.a,
      b: state.b,
      compact: state.compact,
      digitsA: digits(state.a),
      digitsB: digits(state.b),
      rows,
      sum,
      product: state.a * state.b,
      correct: sum === state.a * state.b,
    };
  }

  function setA(state, value) {
    return { ...state, a: Math.max(0, Math.trunc(Number(value)) || 0) };
  }
  function setB(state, value) {
    return { ...state, b: Math.max(0, Math.trunc(Number(value)) || 0) };
  }
  function setCompact(state, value) {
    return { ...state, compact: !!value };
  }

  return { start, digits, partials, analyze, setA, setB, setCompact };
})();
