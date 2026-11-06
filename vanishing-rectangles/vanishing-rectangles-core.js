"use strict";

/*
 * Disappearing Rectangles (Bogomolny's Leprechaun applet), after Sam Loyd's
 * "Get Off the Earth" and the Vanishing Leprechaun.
 *
 * A strip of paper has N rectangles drawn across its midline (N from 3 to 20,
 * 4 to start). It is cut along the midline, and the top and bottom halves can
 * each slide sideways, wrapping round, so a rectangle's top part can end up on
 * a different bottom part. Lined up one way there are N rectangles; slide by
 * the right amount and there are only N - 1. Where did one go?
 *
 * Read off the bytecode (MoveableLep): the heights come from a random
 * permutation Heights of 0 .. N-1; in slot i the top part is Heights[i] units
 * tall and the bottom part N - 1 - Heights[i] units, so lined up every
 * rectangle is N - 1 units tall. One top part is empty (Heights = 0, slot
 * Upper0) and one bottom part is empty (Heights = N - 1, slot Lower0). Slide
 * the top strip so that its empty piece sits over the empty bottom piece, and
 * that column shows nothing: N - 1 rectangles, each of them a little taller on
 * average, because the area of N rectangles of height N - 1 is shared among
 * N - 1. Nothing vanished; the missing rectangle was spread over the others.
 *
 * The strips are measured in slots: shift s means the top piece of slot i
 * sits over the bottom piece of slot i + s (mod N).
 */

var VanishingRectanglesCore = (function () {
  const MIN_N = 3;
  const MAX_N = 20;
  const DEFAULT_N = 4;

  /** Permutation.CreateRandom(): a random ordering of 0 .. n-1 (Fisher-Yates). */
  function randomPermutation(n, rnd) {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }

  function start(n, rnd = Math.random) {
    const heights = randomPermutation(n, rnd);
    return { n, heights, upper0: heights.indexOf(0), lower0: heights.indexOf(n - 1) };
  }

  const top = (s, i) => s.heights[i];
  const bottom = (s, i) => s.n - 1 - s.heights[i];

  /** The columns seen with the top strip shifted by `shift` slots: [{ top, bottom }] per bottom slot. */
  function columns(s, shift) {
    const out = [];
    for (let j = 0; j < s.n; j++) {
      const i = (((j - shift) % s.n) + s.n) % s.n;
      out.push({ top: top(s, i), bottom: bottom(s, j) });
    }
    return out;
  }

  /** How many rectangles can be seen: the columns that are not empty. */
  const visible = (s, shift) => columns(s, shift).filter((c) => c.top + c.bottom > 0).length;

  /** The shift that puts the empty top piece over the empty bottom piece. */
  const vanishingShift = (s) => (((s.lower0 - s.upper0) % s.n) + s.n) % s.n;

  return { MIN_N, MAX_N, DEFAULT_N, randomPermutation, start, top, bottom, columns, visible, vanishingShift };
})();
