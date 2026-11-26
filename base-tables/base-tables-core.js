"use strict";

/*
 * Addition and Multiplication Tables in Various Bases, from Alexander
 * Bogomolny's applet SysTable ("Tribute to Invariance").
 *
 * The + or x table of the digits 0 .. r-1 in base r (2..36, 10 to start),
 * every entry written in base r with the digits 0-9 then A-Z (BaseSys). The
 * same patterns show up in every base: the tables are symmetric about the
 * diagonal (commutativity); in the + table each row is the one above moved
 * one place, and the carry appears exactly below the anti-diagonal
 * a + b = r - 1; in the x table the last column, k x (r - 1), always has
 * digits adding up to r - 1, just as 9 x k does in base 10.
 *
 * Transcribed from SysTableCanvas.DrawTable: a header row and column with
 * the digits, and the entry for row a, column b is ConvertNum(a + b) or
 * ConvertNum(a * b).
 *
 * This file is the game's logic and nothing else. It defines one global,
 * BaseTablesCore. The position is plain data.
 */
const BaseTablesCore = (() => {
  const RADIX = { min: 2, max: 36, def: 10 };
  const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function start(options = {}) {
    const r = Math.round(Number(options.radix ?? RADIX.def));
    return { radix: Number.isFinite(r) ? Math.max(RADIX.min, Math.min(RADIX.max, r)) : RADIX.def, op: options.op === "x" ? "x" : "+" };
  }

  /** BaseSys.ConvertNum: n written in base r. */
  function convert(n, r) {
    if (n === 0) return "0";
    let s = "";
    while (n > 0) { s = DIGITS[n % r] + s; n = Math.floor(n / r); }
    return s;
  }

  const value = (s, a, b) => (s.op === "+" ? a + b : a * b);
  const entry = (s, a, b) => convert(value(s, a, b), s.radix);

  /** The whole table: rows a = 0 .. r-1, columns b = 0 .. r-1. */
  function table(s) {
    return Array.from({ length: s.radix }, (_, a) => Array.from({ length: s.radix }, (_, b) => entry(s, a, b)));
  }

  const digitSum = (str) => [...str].reduce((t, c) => t + DIGITS.indexOf(c), 0);

  return { RADIX, DIGITS, start, convert, value, entry, table, digitSum };
})();
