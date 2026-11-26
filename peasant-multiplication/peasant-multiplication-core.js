"use strict";

/*
 * Peasant multiplication. Halve the first number (dropping remainders) down to
 * 1 and double the second as many times; add up the doubles that sit beside an
 * odd half. The odd halves are the binary digits of the first number, so the
 * sum is the product. Same columns as the applet's Compute: the number of rows
 * is floor(log2 a) + 1.
 *
 * No DOM. The global is PeasantCore.
 */
var PeasantCore = (function () {
  const MAX_DIGITS = 4;

  function clampNumber(n, digits) {
    const top = Math.pow(10, digits) - 1;
    n = Math.floor(Number(n));
    if (!(n >= 1)) n = 1;
    return Math.min(top, n);
  }

  /** The rows: the half, the double, the binary digit (odd half = 1) and the power of 2. */
  function table(a, b) {
    const rows = [];
    for (let k = 0, half = a, dbl = b; ; k++) {
      rows.push({ power: k, half, dbl, odd: half % 2 === 1 });
      if (half === 1) break;
      half = Math.floor(half / 2);
      dbl *= 2;
    }
    return rows;
  }

  /** The doubles beside the odd halves, and their sum, which is the product. */
  function multiply(a, b) {
    const rows = table(a, b);
    const parts = rows.filter((r) => r.odd).map((r) => r.dbl);
    return { rows, parts, product: parts.reduce((s, x) => s + x, 0) };
  }

  /** a in binary, written the way the page does: the digits of the rows from the bottom up. */
  function binary(a) {
    return table(a, 1).map((r) => (r.odd ? "1" : "0")).reverse().join("");
  }

  /** Digits of n, padded to `digits` places, most significant first. */
  function digitsOf(n, digits) {
    return String(n).padStart(digits, "0").split("").map(Number);
  }

  /**
   * Changes one digit (place 0 = leftmost). Autonomous: that digit alone, going
   * round 0..9. Connected: the whole number goes up or down by that place's
   * value, kept in 1..10^digits - 1.
   */
  function bump(n, digits, place, delta, autonomous) {
    const unit = Math.pow(10, digits - 1 - place);
    if (!autonomous) return clampNumber(n + delta * unit, digits);
    const ds = digitsOf(n, digits);
    ds[place] = (ds[place] + delta + 10) % 10;
    return clampNumber(Number(ds.join("")), digits);
  }

  function start(opts) {
    opts = opts || {};
    const digits = Math.min(MAX_DIGITS, Math.max(1, Math.floor(Number(opts.digits)) || 2));
    return {
      digits,
      a: clampNumber(opts.a == null ? 85 : opts.a, digits),
      b: clampNumber(opts.b == null ? 18 : opts.b, digits),
      binary: !!opts.binary,
      autonomous: !!opts.autonomous,
    };
  }

  return { MAX_DIGITS, clampNumber, table, multiply, binary, digitsOf, bump, start };
})();
