"use strict";

/*
 * ISBN Encoding, from Bogomolny's applet ISBN.
 *
 * The applet shows thirteen cells: the ten digits of an ISBN-10 plus three
 * hyphens. Each of the first twelve cells cycles 0..9 and '-'; the last is a
 * check digit chosen so that 10*d1 + 9*d2 + ... + d10 is a multiple of 11 (10
 * is written X). The applet's format rules are exactly three hyphens, no two
 * consecutive, and a hyphen in the penultimate cell. The nine digits before
 * the check digit are embedded in EAN-13 by prepending 978 and appending a
 * fresh EAN check digit.
 *
 * The key idea is that the two check digits are computed independently; the
 * embedding only reuses the first nine digits. The logic test checks the
 * mod-11 identity, the X case, the hyphen rules, known ISBNs and the EAN
 * check digit and bar pattern.
 *
 * No document, no window, no storage: one global, IsbnEncodingCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const IsbnEncodingCore = (() => {
  const CYCLE = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-"];
  const ODDS = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"].map((s) => s.split("").map(Number));
  const EVENS = ODDS.map((r) => r.map((b) => 1 - b));
  const MIRRORS = EVENS.map((r) => r.slice().reverse());
  const LEFT_PARITY = ["111111", "110100", "110010", "110001", "101100", "100110", "100011", "101010", "101001", "100101"].map((s) => s.split("").map(Number));
  const GUARD = [1, 0, 1];
  const MIDDLE = [0, 1, 0, 1, 0];

  function start(symbols) {
    const initial = symbols ? symbols.slice() :
      ["0", "-", "1", "2", "3", "-", "4", "5", "6", "7", "8", "-", checkDigit([0, 1, 2, 3, 4, 5, 6, 7, 8])];
    return { symbols: initial, moves: 0 };
  }

  function cycle(symbol) {
    const at = CYCLE.indexOf(symbol);
    return CYCLE[(at + 1) % CYCLE.length];
  }

  /** The nine digits in cells 0..10, skipping hyphens. */
  function digitsOf(symbols) {
    return symbols.slice(0, 11).filter((s) => s !== "-").map(Number);
  }

  /** d10 from 10*d1 + ... + 2*d9 + d10 = 0 (mod 11). */
  function checkDigit(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += (10 - i) * digits[i];
    const d = (11 - (sum % 11)) % 11;
    return d === 10 ? "X" : String(d);
  }

  function validSum(symbols) {
    const digits = digitsOf(symbols);
    if (digits.length !== 9) return false;
    const last = symbols[12] === "X" ? 10 : Number(symbols[12]);
    if (!Number.isInteger(last)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (10 - i) * digits[i];
    return (sum + last) % 11 === 0;
  }

  function hyphensValid(symbols) {
    let count = 0;
    let consecutive = false;
    for (let i = 0; i < 13; i++) {
      if (symbols[i] === "-") {
        count++;
        if (i > 0 && symbols[i - 1] === "-") consecutive = true;
      }
    }
    return count === 3 && !consecutive && symbols[11] === "-";
  }

  function eanCheckDigit(first12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? first12[i] : 3 * first12[i];
    return (10 - (sum % 10)) % 10;
  }

  function toEan13(symbols) {
    const first = [9, 7, 8].concat(digitsOf(symbols));
    return first.concat([eanCheckDigit(first)]);
  }

  function modules(ean) {
    const out = GUARD.slice();
    const push = (bits) => bits.forEach((b) => out.push(b));
    for (let k = 0; k < 6; k++) push(LEFT_PARITY[ean[0]][k] ? ODDS[ean[1 + k]] : MIRRORS[ean[1 + k]]);
    MIDDLE.forEach((b) => out.push(b));
    for (let k = 0; k < 6; k++) push(EVENS[ean[7 + k]]);
    GUARD.forEach((b) => out.push(b));
    return out;
  }

  function advance(state, index) {
    if (index < 0 || index >= 12) return state;
    const symbols = state.symbols.slice();
    symbols[index] = cycle(symbols[index]);
    return { symbols, moves: state.moves + 1 };
  }

  function analyze(state) {
    const symbols = state.symbols.slice();
    const digits = digitsOf(symbols);
    const computed = digits.length === 9 ? checkDigit(digits) : "?";
    symbols[12] = computed;
    const ean = digits.length === 9 ? toEan13(symbols) : [];
    return {
      symbols,
      digits,
      checkDigit: computed,
      formatValid: hyphensValid(state.symbols),
      sumValid: validSum(state.symbols),
      valid: digits.length === 9 && hyphensValid(state.symbols) && validSum(state.symbols),
      ean,
      modules: ean.length === 13 ? modules(ean) : [],
      moves: state.moves,
    };
  }

  /** Build a display from nine digits, with hyphens at two of cells 0..10. */
  function fromDigits(digits, hyphenCells) {
    const cells = hyphenCells || [1, 4];
    const symbols = [];
    let at = 0;
    for (let i = 0; i < 11; i++) {
      if (cells.includes(i)) symbols.push("-");
      else symbols.push(String(digits[at++]));
    }
    symbols.push("-", checkDigit(digits));
    return start(symbols);
  }

  return {
    CYCLE, start, cycle, digitsOf, checkDigit, validSum, hyphensValid,
    eanCheckDigit, toEan13, modules, advance, analyze, fromDigits,
  };
})();
