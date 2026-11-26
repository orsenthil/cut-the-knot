"use strict";

/*
 * UPC-A, from Alexander Bogomolny's applet UPC.
 *
 * A UPC-A code is twelve digits. The first eleven are chosen; the twelfth is
 * a check digit chosen so that 3d1 + d2 + 3d3 + d4 + ... + 3d11 + d12 is a
 * multiple of ten — that is, 3 * S_odd + S_even = 0 (mod 10). In the applet a
 * click on the left half of one of the first eleven digits raises it by one
 * and a click on the right half lowers it by one, both wrapping from 9 to 0;
 * the last digit is then recomputed automatically. The bars use the standard
 * UPC-A patterns: odd (L) on the left, colour-exchanged (R) on the right,
 * with 101 / 01010 / 101 guard bars.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, UpcCore, so the page loads it with a plain <script> and
 * porting/check-upc.mjs loads it in Node. A position is plain data and every
 * function returns a new one.
 */
const UpcCore = (() => {
  /* The applet's own bar tables, as in BarCodeEncoding: 1 = a black module. */
  const ODDS = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011",
  ].map((s) => s.split("").map(Number));
  const EVENS = ODDS.map((row) => row.map((b) => 1 - b));
  const START_GUARD = [1, 0, 1];
  const MIDDLE_GUARD = [0, 1, 0, 1, 0];
  const END_GUARD = [1, 0, 1];

  const LENGTH = 12;      // UCC-12: eleven chosen digits and one check digit
  const CHOOSABLE = 11;   // IsHit in the applet only looks at Nums[0..10]

  function clampDigit(value) {
    const n = Number(value);
    return Number.isFinite(n) ? ((Math.trunc(n) % 10) + 10) % 10 : 0;
  }

  /*
   * FixCheckDigit, transcribed literally from the bytecode:
   *   sum = 0;
   *   for (i = 0; i < Nums.size() - 1; i++)
   *       sum += i % 2 == 0 ? 3 * Nums[i].GetIntValue() : Nums[i].GetIntValue();
   *   Nums[size - 1].SetValue((10 - sum % 10) % 10);
   */
  function fixCheckDigit(first11) {
    let sum = 0;
    for (let i = 0; i < CHOOSABLE; i++) {
      const d = clampDigit(first11 && first11[i]);
      sum += i % 2 === 0 ? 3 * d : d;
    }
    return (10 - sum % 10) % 10;
  }

  /** The two sums the page names, counted from the first digit as position 1. */
  function sums(digits) {
    let odd = 0, even = 0;
    for (let i = 0; i < CHOOSABLE; i++) {
      if (i % 2 === 0) odd += clampDigit(digits[i]);
      else even += clampDigit(digits[i]);
    }
    return { odd, even, weighted: 3 * odd + even };
  }

  /** All twelve digits, with the check digit filled in. */
  function complete(first11) {
    const digits = [];
    for (let i = 0; i < CHOOSABLE; i++) digits.push(clampDigit(first11 && first11[i]));
    digits.push(fixCheckDigit(digits));
    return digits;
  }

  /** A valid code satisfies the page's identity 3*S_odd + S_even = 0 (mod 10). */
  function valid(digits) {
    if (!Array.isArray(digits) || digits.length !== LENGTH) return false;
    for (const d of digits) if (!Number.isInteger(d) || d < 0 || d > 9) return false;
    return digits[LENGTH - 1] === fixCheckDigit(digits);
  }

  /** The opening code of the applet: Nums[i] = i % 10, then FixCheckDigit. */
  function start(options) {
    const o = options || {};
    const first11 = Array.from({ length: CHOOSABLE }, (_, i) =>
      Array.isArray(o.digits) && Number.isInteger(o.digits[i]) ? clampDigit(o.digits[i]) : i % 10);
    const digits = complete(first11);
    return { digits, cursor: 0, moves: 0, changed: false };
  }

  /**
   * Moves: {type:"step", i, delta} (delta +1 for the left half of a click,
   * -1 for the right half), {type:"set", i, value}, {type:"reset"}.
   * The check digit itself cannot be clicked in the applet.
   */
  function move(state, m) {
    if (!m) return null;
    if (m.type === "reset") return start({});
    if (m.type !== "step" && m.type !== "set") return null;
    if (!Number.isInteger(m.i) || m.i < 0 || m.i >= CHOOSABLE) return null;
    let value;
    if (m.type === "step") {
      const delta = m.delta === undefined ? 1 : m.delta;
      if (!Number.isInteger(delta) || (delta !== 1 && delta !== -1)) return null;
      value = (state.digits[m.i] + delta + 10) % 10; // CTKNumberMod.UpdateSlow
    } else {
      if (!Number.isInteger(Number(m.value)) || Number(m.value) < 0 || Number(m.value) > 9) return null;
      value = Number(m.value);
    }
    const digits = complete(state.digits.slice(0, CHOOSABLE).map((d, i) => (i === m.i ? value : d)));
    return { digits, cursor: m.i, moves: state.moves + 1, changed: true };
  }

  /** Eleven raise moves and eleven lower moves; the check digit is not a move. */
  function legalMoves() {
    const out = [];
    for (let i = 0; i < CHOOSABLE; i++) {
      out.push({ type: "step", i, delta: 1 });
      out.push({ type: "step", i, delta: -1 });
    }
    return out;
  }

  /** A demonstration: no win or loss; it counts as explored after a change. */
  function result(state) {
    return state.changed ? "done" : null;
  }

  /** The 95 modules, tagged by part, for the page's drawing. */
  function parts(state) {
    const d = state.digits;
    const out = [{ kind: "guard", bits: START_GUARD }];
    for (let i = 0; i < 6; i++) {
      out.push({ kind: "left", digit: d[i], bits: ODDS[d[i]] });
    }
    out.push({ kind: "guard", bits: MIDDLE_GUARD });
    for (let i = 6; i < LENGTH; i++) {
      out.push({ kind: "right", digit: d[i], bits: EVENS[d[i]] });
    }
    out.push({ kind: "guard", bits: END_GUARD });
    return out;
  }

  function modules(state) {
    return parts(state).reduce((bits, p) => bits.concat(p.bits), []);
  }

  /** Read the digits back from the 95 modules, or null if the pattern is wrong. */
  function decode(bits) {
    if (!Array.isArray(bits) || bits.length !== 95) return null;
    const same = (a, b) => a.every((x, i) => x === b[i]);
    if (!same(bits.slice(0, 3), START_GUARD) || !same(bits.slice(45, 50), MIDDLE_GUARD) || !same(bits.slice(92), END_GUARD)) return null;
    const digits = [];
    for (let i = 0; i < 6; i++) {
      const d = ODDS.findIndex((r) => same(r, bits.slice(3 + 7 * i, 10 + 7 * i)));
      if (d < 0) return null;
      digits.push(d);
    }
    for (let i = 0; i < 6; i++) {
      const d = EVENS.findIndex((r) => same(r, bits.slice(50 + 7 * i, 57 + 7 * i)));
      if (d < 0) return null;
      digits.push(d);
    }
    return digits;
  }

  return {
    LENGTH, CHOOSABLE, ODDS, EVENS, START_GUARD, MIDDLE_GUARD, END_GUARD,
    fixCheckDigit, checkDigit: fixCheckDigit, sums, complete, valid, start,
    move, legalMoves, result, parts, modules, decode,
  };
})();
