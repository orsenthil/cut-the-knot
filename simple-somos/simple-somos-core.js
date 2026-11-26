"use strict";

/*
 * Simple Somos Sequence, from Alexander Bogomolny's applet SimpleSomos.
 *
 * Start with a_1 = a and a_2 = b, and continue with
 *   a_n = (a_{n-1}^2 + m) / a_{n-2}.
 * An old Russian olympiad problem: with a = b = 1 and m = 2 every term is a
 * whole number (1, 1, 3, 11, 41, 153, ...), and the same holds for any m.
 * For other starts a division may fail; the applet then shows
 * "Alarm: numerator/denominator" and stops.
 *
 * The idea: for three terms in a row, x, y, z with xz = y^2 + m, the number
 * k = (x^2 + y^2 + m)/(xy) does not change along the sequence, and
 * z = k y - x. So the terms are whole numbers for ever exactly when k is a
 * whole number (and the first division is exact): with a = b = 1,
 * k = m + 2.
 *
 * Transcribed from SimpleSomosCanvas.Draw, which works in BigInteger: the
 * next numerator is b*b + m, it is divided by a, and the term is accepted
 * only if quotient * a gives the numerator back. m, a and b each run
 * 1..100 (the panel's spinners; m starts at 2, a and b at 1). The applet
 * printed as many terms as fitted its window; here a fixed number.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SimpleSomosCore. The position is plain data (terms as decimal strings).
 */
const SimpleSomosCore = (() => {
  const RANGE = { min: 1, max: 100 };
  const DEFAULTS = { m: 2, a: 1, b: 1 };
  const TERMS = 30;

  const clamp = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(RANGE.min, Math.min(RANGE.max, n)) : d; };

  function start(options = {}) {
    return {
      m: clamp(options.m ?? DEFAULTS.m, DEFAULTS.m),
      a: clamp(options.a ?? DEFAULTS.a, DEFAULTS.a),
      b: clamp(options.b ?? DEFAULTS.b, DEFAULTS.b),
    };
  }

  /**
   * Draw's loop: the terms (as strings) up to `count`, and the alarm if a
   * division is not exact: { terms, alarm: { num, den } | null }.
   */
  function sequence(s, count = TERMS) {
    let x = BigInt(s.a), y = BigInt(s.b);
    const M = BigInt(s.m);
    const terms = [x.toString(), y.toString()];
    while (terms.length < count) {
      const num = y * y + M;
      const q = num / x;
      if (q * x !== num) return { terms, alarm: { num: num.toString(), den: x.toString() } };
      terms.push(q.toString());
      x = y; y = q;
    }
    return { terms, alarm: null };
  }

  /** The invariant k = (a^2 + b^2 + m)/(ab), as a reduced fraction [p, q]. */
  function invariant(s) {
    let p = BigInt(s.a * s.a + s.b * s.b + s.m), q = BigInt(s.a * s.b);
    let x = p, y = q;
    while (y) [x, y] = [y, x % y];
    return [p / x, q / x];
  }

  return { RANGE, DEFAULTS, TERMS, start, sequence, invariant };
})();
