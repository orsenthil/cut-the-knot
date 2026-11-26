"use strict";

/*
 * Counting Chips On a Circle, from Alexander Bogomolny's applet
 * TwoColorsOnCircle (a question from James Tanton).
 *
 * Place 2n red and 2n green chips evenly round a circle. Some half circle
 * (2n neighbouring chips) always holds exactly n of each.
 *
 * The idea: let r(m) be the number of reds among the 2n chips starting at
 * chip m. Moving the start by one drops a chip and takes in another, so
 * r changes by at most 1 each step. The half starting at m + 2n is the
 * other half, so r(m + 2n) = 2n - r(m): if r(m) is below n, r(m + 2n) is
 * above it. Stepping from one to the other, r must pass through n (a
 * discrete intermediate value theorem).
 *
 * From TwoColorsOnCircleCanvas: N chips (4..40 in steps of 4, 16 to
 * start), alternately green (even places) and red to start; a click flips
 * a chip. When the reds and greens are equal, FindDiameter looks for the
 * first half circle, starting at chip 0, 1, 2, ..., with equal counts and
 * draws the diameter that cuts it off. Chip 0 is at the right, going
 * clockwise on screen.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * ChipsOnCircleCore. The position is plain data.
 */
const ChipsOnCircleCore = (() => {
  const RANGE = { min: 4, max: 40, step: 4, def: 16 };

  function start(options = {}) {
    let n = Math.round(Number(options.n ?? RANGE.def));
    if (!Number.isFinite(n)) n = RANGE.def;
    n = Math.max(RANGE.min, Math.min(RANGE.max, Math.round(n / 4) * 4));
    const red = Array.isArray(options.red) && options.red.length === n ? options.red.map(Boolean) : Array.from({ length: n }, (_, i) => i % 2 === 1);
    return { n, red };
  }

  function flip(s, i) {
    if (!Number.isInteger(i) || i < 0 || i >= s.n) return null;
    const red = s.red.slice();
    red[i] = !red[i];
    return { ...s, red };
  }

  const counts = (s) => { const r = s.red.filter(Boolean).length; return { red: r, green: s.n - r }; };

  /** Reds among the n/2 chips starting at chip m (going round). */
  function redsInHalf(s, m) {
    let r = 0;
    for (let k = 0; k < s.n / 2; k++) if (s.red[(m + k) % s.n]) r++;
    return r;
  }

  /** FindDiameter: the first start m with equal counts, when the totals are equal; else null. */
  function diameter(s) {
    const c = counts(s);
    if (c.red !== c.green) return null;
    for (let m = 0; m < s.n; m++) if (redsInHalf(s, m) * 2 === s.n / 2) return m;
    return null; // never reached, by the theorem
  }

  /** Every start of a balanced half circle. */
  function balancedStarts(s) {
    const out = [];
    for (let m = 0; m < s.n; m++) if (redsInHalf(s, m) * 2 === s.n / 2) out.push(m);
    return out;
  }

  /** r(m) - g(m) for every start m: the walk that must cross 0. */
  const walk = (s) => Array.from({ length: s.n }, (_, m) => 2 * redsInHalf(s, m) - s.n / 2);

  /** A demo: explored once a diameter has been found after some flips. */
  const result = () => null;

  return { RANGE, start, flip, counts, redsInHalf, diameter, balancedStarts, walk, result };
})();
