"use strict";

/*
 * Integer Iterations on a Circle (Bogomolny's IntIter applet) - Ducci's map.
 *
 * N integers sit on a circle (3 to 20 of them, 4 to start). One step
 * replaces them with the absolute differences of neighbours: the number
 * between a and b becomes |a - b|. For N = 4 the circle always ends up all
 * zeros; for other N it often falls into a loop.
 *
 * IntIterCanvas.Compute() does the step in place and alternates the drawing
 * between two rings of positions half a place apart (m_Shift), so each new
 * number appears between the two it came from; in index terms the new circle
 * is next[i] = |a[i] - a[i+1]|, read round the circle. Reset() fills with
 * zeros or, with "Random" ticked, (int)(random * 21), so 0 to 20. Clicking
 * the right or left half of a number adds or takes away 1 (NumDot.Update),
 * and Undo pops a stack of earlier circles. All of that is reproduced here.
 *
 * run() follows a circle until it hits all zeros or repeats, and says which.
 * Repeats are also reported "up to rotation", since the page notes that a
 * loop's length depends on whether turning the circle counts as the same.
 */

var DucciCore = (function () {
  const MIN_N = 3;
  const MAX_N = 20;
  const DEFAULT_N = 4;
  const RANDOM_MAX = 20;

  const step = (a) => a.map((x, i) => Math.abs(x - a[(i + 1) % a.length]));
  const isZero = (a) => a.every((x) => x === 0);

  function fill(n, random, rnd = Math.random) {
    return Array.from({ length: n }, () => (random ? Math.trunc(rnd() * (RANDOM_MAX + 1)) : 0));
  }

  /** Smallest rotation, so circles that are turns of each other compare equal. */
  function canonical(a) {
    let best = null;
    for (let r = 0; r < a.length; r++) {
      const s = a.slice(r).concat(a.slice(0, r)).join(",");
      if (best === null || s < best) best = s;
    }
    return best;
  }

  /**
   * Follow the circle. Returns
   *   { zeroAt: k }                     if it is all zeros after k steps, or
   *   { loopStart, period, rotPeriod }  if it repeats: the step where the loop
   *                                      begins, its length, and its length
   *                                      when rotations count as the same.
   */
  function run(a, maxSteps = 100000) {
    const seen = new Map();
    let cur = a.slice();
    for (let k = 0; k <= maxSteps; k++) {
      if (isZero(cur)) return { zeroAt: k };
      const key = cur.join(",");
      if (seen.has(key)) {
        const loopStart = seen.get(key);
        const period = k - loopStart;
        // Only now look for turned copies: the first t at which the loop's circle
        // comes back turned round is its length counting turns as the same.
        const ck = canonical(cur);
        let m = step(cur);
        let rotPeriod = period;
        for (let t = 1; t < period; t++, m = step(m)) {
          if (canonical(m) === ck) { rotPeriod = t; break; }
        }
        return { loopStart, period, rotPeriod };
      }
      seen.set(key, k);
      cur = step(cur);
    }
    return { unknown: true };
  }

  return { MIN_N, MAX_N, DEFAULT_N, RANDOM_MAX, step, isZero, fill, canonical, run };
})();
