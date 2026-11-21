"use strict";

/*
 * Kaprekar's Iterations and Constants, from Bogomolny's applet Kaprekar.
 *
 * Write a number with a fixed number of digits in some base, sort its digits
 * descending and ascending, and subtract. Repeating this reaches Kaprekar's
 * constant: 6174 in base ten with four digits, 495 with three. With natural
 * digit lengths instead of padding, a number such as 1121 can fall to 0.
 *
 * The key idea is that sorting the digits gives the largest and smallest
 * numbers made from the same digits, so the difference strictly shrinks the
 * space of possibilities until a fixed point is reached. The logic test checks
 * the 6174 and 495 constants, the unpadded zero case, repdigits and exhaustive
 * convergence in both bases and widths.
 *
 * No document, no window, no storage: one global, KaprekarRoutineCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const KaprekarRoutineCore = (() => {
  const MIN_BASE = 2;
  const MAX_BASE = 16;
  const MIN_WIDTH = 2;
  const MAX_WIDTH = 6;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function digits(n, base, width) {
    const out = Array(width).fill(0);
    let rest = n;
    for (let i = width - 1; i >= 0; i--) {
      out[i] = rest % base;
      rest = Math.floor(rest / base);
    }
    return out;
  }

  function value(digitsIn, base) {
    return digitsIn.reduce((v, d) => v * base + d, 0);
  }

  /** Sort a number's digits; pad to width when requested. */
  function sorted(n, base, width, padded, ascending) {
    const ds = digits(n, base, padded ? width : String(n).length, base);
    const source = padded ? ds : digitsUnpadded(n, base);
    source.sort((a, b) => ascending ? a - b : b - a);
    return value(source, base);
  }

  function digitsUnpadded(n, base) {
    if (n === 0) return [0];
    const out = [];
    let rest = n;
    while (rest > 0) { out.push(rest % base); rest = Math.floor(rest / base); }
    return out;
  }

  function step(n, base, width, padded) {
    const desc = sorted(n, base, width, padded, false);
    const asc = sorted(n, base, width, padded, true);
    const diff = desc - asc;
    return { n, desc, asc, diff, fixed: diff === n, zero: diff === 0 };
  }

  function iterate(start, base, width, padded, limit = 100) {
    const steps = [];
    let at = start;
    for (let i = 0; i < limit; i++) {
      const s = step(at, base, width, padded);
      steps.push(s);
      if (s.fixed || s.zero) break;
      at = s.diff;
    }
    const last = steps[steps.length - 1];
    return { start, steps, result: last.diff, fixed: last.fixed, zero: last.zero, count: steps.length };
  }

  function isRepdigit(n, base, width, padded) {
    const ds = padded ? digits(n, base, width) : digitsUnpadded(n, base);
    return ds.every((d) => d === ds[0]);
  }

  /** The unique fixed point reached from all non-repdigit starts, or null. */
  function constant(base, width, padded = true) {
    const total = base ** width;
    const results = new Map();
    for (let n = 0; n < total; n++) {
      if (isRepdigit(n, base, width, padded)) continue;
      const r = iterate(n, base, width, padded);
      if (!r.fixed) return null;
      results.set(r.result, (results.get(r.result) || 0) + 1);
    }
    if (results.size !== 1) return null;
    return [...results.keys()][0];
  }

  function start() {
    return { start: 3524, base: 10, width: 4, padded: true };
  }

  function setStart(state, value) {
    const max = state.base ** state.width - 1;
    return { ...state, start: clamp(value, 0, max, state.start) };
  }
  function setBase(state, value) {
    const base = clamp(value, MIN_BASE, MAX_BASE, state.base);
    return { ...state, base, start: Math.min(state.start, base ** state.width - 1) };
  }
  function setWidth(state, value) {
    const width = clamp(value, MIN_WIDTH, MAX_WIDTH, state.width);
    return { ...state, width, start: Math.min(state.start, state.base ** width - 1) };
  }

  function analyze(state) {
    const result = iterate(state.start, state.base, state.width, state.padded);
    return {
      ...state,
      result,
      sortedDesc: sorted(state.start, state.base, state.width, state.padded, false),
      sortedAsc: sorted(state.start, state.base, state.width, state.padded, true),
      repdigit: isRepdigit(state.start, state.base, state.width, state.padded),
    };
  }

  return {
    MIN_BASE, MAX_BASE, MIN_WIDTH, MAX_WIDTH, clamp, digits, value, sorted, step,
    iterate, isRepdigit, constant, start, setStart, setBase, setWidth, analyze,
  };
})();
