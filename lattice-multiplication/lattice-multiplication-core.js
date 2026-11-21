"use strict";

/*
 * Lattice Multiplication, from Bogomolny's applet LatticeMultiplication.
 *
 * Write one factor above a grid and the other beside it. Each cell holds the
 * two-digit product of its digits, split by a diagonal. Summing along the
 * diagonals gives one number per band; carrying from the right turns those
 * band sums into the final product. Fibonacci described the method in Liber
 * Abaci in 1202.
 *
 * The key idea is that a band sum is a coefficient of the convolution of the
 * two digit strings, so it equals the usual product before carries. The logic
 * test checks the band sums and carries on the page's examples and on many
 * random pairs against ordinary multiplication.
 *
 * No document, no window, no storage: one global, LatticeMultiplicationCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const LatticeMultiplicationCore = (() => {
  function digits(n) {
    return String(Math.abs(Math.trunc(n))).split("").map(Number);
  }

  function start() {
    return { a: 712, b: 23 };
  }

  /** Each cell holds the tens and units of the product of its two digits. */
  function cells(a, b) {
    const da = digits(a);
    const db = digits(b);
    return da.map((x) => db.map((y) => {
      const p = x * y;
      return { tens: Math.floor(p / 10), units: p % 10, product: p };
    }));
  }

  /** Diagonal band sums, most significant first, before carrying. */
  function bands(a, b) {
    const da = digits(a);
    const db = digits(b);
    const m = da.length;
    const n = db.length;
    const sums = Array(m + n).fill(0);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const d = (m - 1 - i) + (n - 1 - j);
        const p = da[i] * db[j];
        sums[d] += p % 10;          // units sit in this band
        sums[d + 1] += Math.floor(p / 10); // tens sit one band to the left
      }
    }
    // Keep every band; a leading zero is harmless when the digits are read.
    return sums.reverse();
  }

  /** Carry from the right, returning the final digits and the carry chain. */
  function carry(raw) {
    const result = [];
    const steps = [];
    let extra = 0;
    for (let i = raw.length - 1; i >= 0; i--) {
      const total = raw[i] + extra;
      const digit = total % 10;
      const next = Math.floor(total / 10);
      result.unshift(digit);
      steps.unshift({ band: i, sum: raw[i], carryIn: extra, total, digit, carryOut: next });
      extra = next;
    }
    if (extra > 0) result.unshift(extra);
    return { digits: result, steps };
  }

  function analyze(state) {
    const raw = bands(state.a, state.b);
    const finished = carry(raw);
    return {
      a: state.a, b: state.b,
      digitsA: digits(state.a), digitsB: digits(state.b),
      cells: cells(state.a, state.b),
      bands: raw,
      carries: finished.steps,
      product: Number(finished.digits.join("")),
      expected: state.a * state.b,
      needsCarry: finished.steps.some((s) => s.carryIn > 0 || s.carryOut > 0),
    };
  }

  function setA(state, value) {
    return { ...state, a: Math.max(0, Math.trunc(Number(value)) || 0) };
  }
  function setB(state, value) {
    return { ...state, b: Math.max(0, Math.trunc(Number(value)) || 0) };
  }

  return { digits, start, cells, bands, carry, analyze, setA, setB };
})();
