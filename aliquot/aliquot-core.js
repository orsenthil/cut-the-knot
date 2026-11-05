"use strict";

/*
 * Aliquot - the subtraction game from Alexander Bogomolny's applet
 * (classes/Aliquot.zip: Aliquot, AliquotCanvas, AliquotPanel).
 *
 * An *aliquot part* of n is a proper divisor: any divisor of n other than n
 * itself. Players alternate subtracting an aliquot part of the number their
 * opponent left them. 1 has no aliquot parts, so whoever is handed 1 has no
 * move and loses.
 *
 * The idea the whole game turns on: every divisor of an odd number is odd, so
 * "odd minus one of its aliquot parts" is always even. You can never hand an
 * odd number to your opponent from an odd one. Meanwhile 1 is an aliquot part
 * of every number above 1, so from an even number you can always hand over an
 * odd one. The game ends at 1, which is odd, so even numbers are won and odd
 * numbers are lost.
 *
 * findFactor is the applet's own opponent (AliquotCanvas.FindFactor): strip the
 * factors of two off n, take the smallest divisor >= 3 of what is left, and
 * fall back to 1. On an even number that always leaves an odd one, but without
 * subtracting 1 every single turn and giving the trick away.
 */
const AliquotCore = (() => {
  // The applet's starting number is Math.random() * 80 + 20, shown modulo 100.
  const START_MIN = 20;
  const START_MAX = 99;
  // The display is two digits, and 0 and 1 are degenerate, so a chosen start
  // runs over the rest of that range.
  const MIN_START = 2;
  const MAX_START = 99;

  const isEven = (n) => n % 2 === 0;

  /** The aliquot parts (proper divisors) of n, ascending. */
  function aliquotParts(n) {
    const parts = [];
    if (!Number.isInteger(n) || n < 2) return parts;
    for (let d = 1; d <= n / 2; d++) if (n % d === 0) parts.push(d);
    return parts;
  }

  /**
   * AliquotCanvas.FindFactorEq: the smallest divisor >= 3 of n's odd part, or 1
   * when that odd part is 1. The applet recurses forever on 0, so guard it.
   */
  function findFactorEq(n) {
    if (!Number.isInteger(n) || n < 1) return 1;
    if (isEven(n)) return findFactorEq(n / 2);
    for (let i = 3; i <= n; i++) if (n % i === 0) return i;
    return 1;
  }

  /**
   * How much the computer subtracts from n. FindFactorEq returns n itself when
   * n is an odd prime, which would be an illegal move (n is not an aliquot part
   * of n), so the applet falls back to 1.
   */
  function findFactor(n) {
    const f = findFactorEq(n);
    return f === n ? 1 : f;
  }

  /**
   * The applet's move test (AliquotCanvas.SetAnswer plus the bound its text
   * field enforces): d divides n and 0 < d < n. The applet lets 0 through and
   * then divides by it; that is a bug, not a rule, so 0 is rejected here.
   */
  function isLegalMove(n, d) {
    return Number.isInteger(n) && Number.isInteger(d) && d > 0 && d < n && n % d === 0;
  }

  /** A position is won by the player about to move exactly when n is even. */
  const isWinning = (n) => Number.isInteger(n) && n > 1 && isEven(n);

  /** The applet's Reset: a random integer in [20, 99]. */
  const randomStart = (rand) => Math.floor((rand || Math.random)() * 80) + 20;

  return {
    START_MIN,
    START_MAX,
    MIN_START,
    MAX_START,
    isEven,
    aliquotParts,
    findFactorEq,
    findFactor,
    isLegalMove,
    isWinning,
    randomStart,
  };
})();
