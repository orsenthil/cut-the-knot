"use strict";

/*
 * EAN-13 encoding, from Alexander Bogomolny's applet EAN13.
 *
 * A code has 13 digits d1..d13. The first twelve can be chosen; the last is a
 * check digit that makes   d1 + 3 d2 + d3 + 3 d4 + ... + d11 + 3 d12 + d13   a
 * multiple of 10 (the applet's FixCheckDigit: from d12 leftwards the weights are
 * 3, 1, 3, 1, ...). In the bars, d1 has none of its own: it selects which of the
 * left six digits are written in odd or even parity, and the other twelve digits
 * are written as seven-module patterns between guard bars.
 *
 * The applet opens on the digits 0 1 2 3 4 5 6 7 8 9 0 1 with the check digit
 * computed (0123456789012 from Nums[i] = i % 10, then FixCheckDigit), and a click
 * on one of the first twelve digits raises it by 1 (mod 10). The tables are the
 * ones the Barcode Encoding applet uses. The position is plain data; functions
 * return new objects.
 */
const Ean13Core = (() => {
  // 1 = black module. Odd parity (L code) for the left digits when the system digit says so.
  const ODDS = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"].map((s) => s.split("").map(Number));
  const EVENS = ODDS.map((r) => r.map((b) => 1 - b)); // right-hand digits (R code)
  const MIRRORS = EVENS.map((r) => r.slice().reverse()); // left digits in even parity (G code)
  // For each first digit, which of the six left digits are odd (1) or even (0).
  const LEFT_PARITY = ["111111", "110100", "110010", "110001", "101100", "100110", "100011", "101010", "101001", "100101"].map((s) => s.split("").map(Number));
  const GUARD = [1, 0, 1], MIDDLE = [0, 1, 0, 1, 0];

  /** The check digit for the first twelve digits: weights 3, 1, 3, ... from the twelfth leftwards. */
  function checkDigit(first12) {
    let sum = 0, three = true;
    for (let i = 11; i >= 0; i--) { sum += three ? 3 * first12[i] : first12[i]; three = !three; }
    return (10 - (sum % 10)) % 10;
  }

  /** A position; options.digits is the first twelve digits (the applet opens on 0 1 2 ... 9 0 1). */
  function start(options) {
    const o = options || {};
    const first = Array.from({ length: 12 }, (_, i) => (Array.isArray(o.digits) && Number.isInteger(o.digits[i]) ? ((o.digits[i] % 10) + 10) % 10 : i % 10));
    return { digits: first.concat(checkDigit(first)), moves: 0, explored: false };
  }

  const valid = (digits) => digits.length === 13 && digits.reduce((s, d, i) => s + (i % 2 === 0 ? d : 3 * d), 0) % 10 === 0;

  /** The 95 modules of the barcode, with a label for each part: [{kind, digit, bits}]. */
  function parts(s) {
    const d = s.digits, par = LEFT_PARITY[d[0]];
    const out = [{ kind: "guard", bits: GUARD }];
    for (let k = 0; k < 6; k++) out.push({ kind: "left", digit: d[1 + k], odd: par[k] === 1, bits: par[k] ? ODDS[d[1 + k]] : MIRRORS[d[1 + k]] });
    out.push({ kind: "middle", bits: MIDDLE });
    for (let k = 0; k < 6; k++) out.push({ kind: "right", digit: d[7 + k], bits: EVENS[d[7 + k]] });
    out.push({ kind: "guard", bits: GUARD });
    return out;
  }
  const modules = (s) => parts(s).flatMap((p) => p.bits);

  /** Read a barcode back from its 95 modules: the 13 digits, or null if it is not a valid pattern. */
  function decode(bits) {
    if (bits.length !== 95) return null;
    const seq = (a, b) => a.every((x, i) => x === b[i]);
    if (!seq(bits.slice(0, 3), GUARD) || !seq(bits.slice(45, 50), MIDDLE) || !seq(bits.slice(92), GUARD)) return null;
    const left = [], parity = [];
    for (let k = 0; k < 6; k++) {
      const g = bits.slice(3 + 7 * k, 10 + 7 * k);
      let d = ODDS.findIndex((r) => seq(r, g)), odd = 1;
      if (d < 0) { d = MIRRORS.findIndex((r) => seq(r, g)); odd = 0; }
      if (d < 0) return null;
      left.push(d); parity.push(odd);
    }
    const first = LEFT_PARITY.findIndex((p) => seq(p, parity));
    if (first < 0) return null;
    const right = [];
    for (let k = 0; k < 6; k++) {
      const d = EVENS.findIndex((r) => seq(r, bits.slice(50 + 7 * k, 57 + 7 * k)));
      if (d < 0) return null;
      right.push(d);
    }
    return [first, ...left, ...right];
  }

  /** The ISBN-10's EAN-13: 978 and the first nine digits, with the new check digit. */
  function fromIsbn10(isbn) {
    const nine = String(isbn).replace(/[^0-9Xx]/g, "").slice(0, 9).split("").map(Number);
    const first12 = [9, 7, 8, ...nine];
    return first12.concat(checkDigit(first12));
  }

  /** Moves: {type:"step", i} (+1 mod 10), {type:"set", i, value}, {type:"reset"}. Only the first twelve digits can be changed. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "reset") return start({});
    if (m.type !== "step" && m.type !== "set") return null;
    if (!Number.isInteger(m.i) || m.i < 0 || m.i > 11) return null;
    const v = m.type === "step" ? (s.digits[m.i] + 1) % 10 : Math.trunc(Number(m.value));
    if (!(v >= 0 && v <= 9)) return null;
    const first = s.digits.slice(0, 12);
    first[m.i] = v;
    return { digits: first.concat(checkDigit(first)), moves: s.moves + 1, explored: true };
  }

  const legalMoves = () => Array.from({ length: 12 }, (_, i) => ({ type: "step", i }));
  const result = (s) => (s.explored ? "done" : null);

  return { start, checkDigit, valid, parts, modules, decode, fromIsbn10, move, legalMoves, result, tables: { ODDS, EVENS, MIRRORS, LEFT_PARITY } };
})();
