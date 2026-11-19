"use strict";

/*
 * Barcode Encoding, from Alexander Bogomolny's applet BarCodeEncoding.
 *
 * The applet is not a game: it is the set of lookup tables that turn a digit
 * into the seven black/white bars used by UPC-A and EAN-13 barcodes. A scanner
 * reads the widths of alternating black and white runs; the trick is that the
 * ten digits can be written so that every one of them is exactly four runs of
 * bars, and a leading "system" digit can flip whole runs without changing that
 * shape. EAN-13 uses the first digit only as a key into a parity table; the
 * digit itself has no bars of its own.
 *
 * The four tables and the three Get* methods below are transcribed straight
 * from the applet's bytecode. On top of them sit pure helpers that lay out a
 * complete UPC-A or EAN-13 barcode (guard bars included) so the page can draw
 * it. No document, no window, no storage: one global, BarcodeEncodingCore.
 * A position is plain JSON: { mode, digits: number[], cursor: number }.
 */

const BarcodeEncodingCore = (() => {
  /* ------------------------------------------------ the applet's own tables */

  // "Left side (odd parity)": one 7-bit row per digit. 1 = black, 0 = white.
  const ODDS = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011",
  ].map((s) => s.split("").map(Number));

  // The applet builds Evens by exchanging colours: Evens[d][j] = !Odds[d][j].
  const EVENS = ODDS.map((row) => row.map((b) => 1 - b));

  // Mirrors[d][j] = Evens[d][6 - j]: the mirror image of the right-side code.
  const MIRRORS = EVENS.map((row) => row.slice().reverse());

  // 1 = odd parity (Odds), 0 = even parity (Mirrors), for left positions 1..6.
  const LEFT_PARITY = [
    "111111", "110100", "110010", "110001", "101100",
    "100110", "100011", "101010", "101001", "100101",
  ].map((s) => s.split("").map(Number));

  const START_GUARD = [1, 0, 1];
  const MIDDLE_GUARD = [0, 1, 0, 1, 0];
  const END_GUARD = [1, 0, 1];

  /* -------------------------------------------- the applet's three methods */

  /** GetOdd(int): the applet returns its row directly. */
  function getOdd(d) {
    return ODDS[d].slice();
  }

  /** GetEven(int): the colour-exchanged row. */
  function getEven(d) {
    return EVENS[d].slice();
  }

  /** GetEven's mirror, used for even-parity left digits in EAN-13. */
  function getMirror(d) {
    return MIRRORS[d].slice();
  }

  /** Row of LeftSideParity for a system digit; position counts from 1. */
  function getLeftParity(system, position) {
    return LEFT_PARITY[system][position - 1];
  }

  /*
   * GetOdd(int system, int position, int digit), transcribed literally:
   *   LeftSideParity[system][position - 1] ? Odds[digit] : Mirrors[digit]
   */
  function getBar(system, position, digit) {
    return (LEFT_PARITY[system][position - 1] ? ODDS[digit] : MIRRORS[digit]).slice();
  }

  /* -------------------------------------------------------- pure helpers */

  function clampDigit(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(9, Math.floor(n))) : 0;
  }

  function digitAt(digits, i) {
    return clampDigit(digits && digits[i]);
  }

  /** A pattern's generalized bars: runs of equal colour, in order. */
  function runs(pattern) {
    const out = [];
    for (const bit of pattern) {
      const last = out[out.length - 1];
      if (last && last.color === bit) last.length++;
      else out.push({ color: bit, length: 1 });
    }
    return out;
  }

  function segment(kind, extra, bits) {
    return Object.assign({ kind, bits: bits.slice() }, extra);
  }

  function flatten(segments) {
    const bits = [];
    for (const s of segments) bits.push(...s.bits);
    return bits;
  }

  /*
   * UPC-A: twelve digits, six on the left in odd parity and six on the right
   * in the colour-exchanged ("right side") representation, between three guard
   * bars at each end and one in the middle.
   */
  function encodeUPC(digits) {
    const segments = [segment("guard", { which: "start" }, START_GUARD)];
    for (let i = 0; i < 6; i++) {
      segments.push(segment("digit", {
        position: i + 1, digit: digitAt(digits, i), parity: "odd", side: "left",
      }, ODDS[digitAt(digits, i)]));
    }
    segments.push(segment("guard", { which: "middle" }, MIDDLE_GUARD));
    for (let i = 6; i < 12; i++) {
      segments.push(segment("digit", {
        position: i + 1, digit: digitAt(digits, i), parity: "right", side: "right",
      }, EVENS[digitAt(digits, i)]));
    }
    segments.push(segment("guard", { which: "end" }, END_GUARD));
    return { bits: flatten(segments), segments };
  }

  /*
   * EAN-13: thirteen digits, but the first has no bars. It only chooses the
   * parity of the next six through LeftSideParity; the last six are right-side
   * codes, and the guards are the same as UPC-A's.
   */
  function encodeEAN13(digits) {
    const system = digitAt(digits, 0);
    const segments = [segment("guard", { which: "start" }, START_GUARD)];
    for (let i = 0; i < 6; i++) {
      const digit = digitAt(digits, i + 1);
      const parity = LEFT_PARITY[system][i] ? "odd" : "even";
      segments.push(segment("digit", {
        position: i + 1, digit, parity, side: "left", system,
      }, getBar(system, i + 1, digit)));
    }
    segments.push(segment("guard", { which: "middle" }, MIDDLE_GUARD));
    for (let i = 6; i < 12; i++) {
      segments.push(segment("digit", {
        position: i + 1, digit: digitAt(digits, i + 1), parity: "right", side: "right",
      }, EVENS[digitAt(digits, i + 1)]));
    }
    segments.push(segment("guard", { which: "end" }, END_GUARD));
    return { bits: flatten(segments), segments };
  }

  /** Lay out whatever mode the position is in. */
  function encode(state) {
    return state.mode === "EAN-13"
      ? encodeEAN13(state.digits)
      : encodeUPC(state.digits);
  }

  /* Check digits are not on the cut-the-knot page; they are here so the demo
     can offer valid example codes. UPC-A checks 11 digits (weights 3,1,...);
     EAN-13 checks 12 (weights 1,3,...). */
  function checkDigit(digits, mode) {
    const n = mode === "EAN-13" ? 12 : 11;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const weight = mode === "EAN-13" ? (i % 2 === 0 ? 1 : 3) : (i % 2 === 0 ? 3 : 1);
      sum += weight * digitAt(digits, i);
    }
    return (10 - (sum % 10)) % 10;
  }

  function validCode(digits, mode) {
    const len = mode === "EAN-13" ? 13 : 12;
    if (!Array.isArray(digits) || digits.length !== len) return false;
    for (const d of digits) if (!Number.isInteger(d) || d < 0 || d > 9) return false;
    return digitAt(digits, len - 1) === checkDigit(digits, mode);
  }

  /* ------------------------------------------------------------ positions */

  const DEFAULTS = {
    "UPC-A": [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2],
    "EAN-13": [4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3, 1],
  };

  function start(options) {
    const opts = options || {};
    const mode = opts.mode === "EAN-13" ? "EAN-13" : "UPC-A";
    const digits = DEFAULTS[mode].slice();
    return { mode, digits, cursor: 0 };
  }

  function withDigits(state, digits) {
    const len = state.mode === "EAN-13" ? 13 : 12;
    const out = [];
    for (let i = 0; i < len; i++) out.push(clampDigit(digits && digits[i]));
    return { mode: state.mode, digits: out, cursor: Math.min(state.cursor, len - 1) };
  }

  function setDigit(state, index, value) {
    const digits = state.digits.slice();
    digits[index] = clampDigit(value);
    return { mode: state.mode, digits, cursor: state.cursor };
  }

  /** Step a digit 0..9, stopping at the ends rather than wrapping. */
  function stepDigit(state, delta) {
    const i = state.cursor;
    const old = state.digits[i];
    const next = Math.max(0, Math.min(9, old + delta));
    return { mode: state.mode, digits: setDigit(state, i, next).digits, cursor: i };
  }

  /** Move the highlighted digit, stopping at the ends. */
  function moveCursor(state, delta) {
    const len = state.digits.length;
    return {
      mode: state.mode,
      digits: state.digits.slice(),
      cursor: Math.max(0, Math.min(len - 1, state.cursor + delta)),
    };
  }

  /*
   * Switching modes keeps the encoded digits. Prepending a 0 to a UPC-A code
   * reproduces its bars exactly in EAN-13 (the page's "embedded" remark);
   * going back drops that leading digit and restores odd left parity.
   */
  function setMode(state, mode) {
    const next = mode === "EAN-13" ? "EAN-13" : "UPC-A";
    if (next === state.mode) return { mode: next, digits: state.digits.slice(), cursor: state.cursor };
    const digits = next === "EAN-13"
      ? [0].concat(state.digits.slice(0, 12))
      : state.digits.slice(1);
    return { mode: next, digits, cursor: Math.min(state.cursor, digits.length - 1) };
  }

  /** This is a demonstration: it is "explored" as soon as it is shown. */
  function result() {
    return "done";
  }

  return {
    ODDS, EVENS, MIRRORS, LEFT_PARITY,
    getOdd, getEven, getMirror, getLeftParity, getBar,
    runs, encodeUPC, encodeEAN13, encode,
    checkDigit, validCode,
    start, withDigits, setDigit, stepDigit, moveCursor, setMode, result,
  };
})();
