"use strict";

/*
 * 3-Term Arithmetic Progression, ported from Alexander Bogomolny's
 * ArithmeticSequence applet.
 *
 * The player switches each displayed number between two groups, On and Off.
 * Three numbers that are evenly spaced — 1, 5, 9 or 3, 6, 9 — form a
 * three-term arithmetic progression. The original applet lights up the first
 * such triple whose three numbers all ended up in the same group; this core
 * does exactly that.
 *
 * The key idea is that inside {1, ..., 9} there are only sixteen evenly spaced
 * triples. Splitting nine numbers into two groups must always make one of
 * those sixteen one-coloured (this is van der Waerden's W(2, 3) = 9). With
 * only eight numbers it is possible to avoid all of them. Checking a split is
 * therefore just comparing three bits for each entry of a fixed table.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global so the page loads it with a plain <script>
 * and porting/check-arithmetic-sequence.mjs loads it in Node. The position is
 * plain JSON; every function returns a new position instead of changing the
 * one it is given.
 */
const ArithmeticSequenceCore = (() => {
  "use strict";

  const MAX = 9;          // the canvas always allocates nine boxes
  const N_VALUES = [8, 9];
  const DEFAULT_N = 8;    // the applet's "8" checkbox is checked at startup

  /*
   * The applet's Seqs table, in the exact order FindSpecial walks it. Entries
   * are zero-based indices (the displayed number is index + 1). These are all
   * the i < j < k in 0..8 with j - i === k - j.
   */
  const TRIPLES = [
    [0, 1, 2], [0, 2, 4], [0, 3, 6], [0, 4, 8],
    [1, 2, 3], [1, 3, 5], [1, 4, 7],
    [2, 3, 4], [2, 4, 6], [2, 5, 8],
    [3, 4, 5], [3, 5, 7],
    [4, 5, 6], [4, 6, 8],
    [5, 6, 7],
    [6, 7, 8],
  ];

  /** The applet only ever uses 8 or 9; anything else falls back to 8. */
  function clampN(n) {
    return n === 9 ? 9 : DEFAULT_N;
  }

  /** A fresh board: all boxes off, nothing toggled. */
  function start(options) {
    return {
      n: clampN(options && options.n),
      colors: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      toggles: 0,
    };
  }

  /** Change how many numbers are in play. Colours and toggle count survive. */
  function setN(pos, n) {
    const next = clampN(n);
    if (next === pos.n) return pos;
    return { n: next, colors: pos.colors.slice(), toggles: pos.toggles };
  }

  /** Switch the box under one number. Out-of-play or unknown indices do nothing. */
  function toggle(pos, index) {
    if (!Number.isInteger(index) || index < 0 || index >= pos.n || index >= MAX) {
      return pos;
    }
    const colors = pos.colors.slice();
    colors[index] = colors[index] ? 0 : 1;
    return { n: pos.n, colors, toggles: pos.toggles + 1 };
  }

  /*
   * The applet's `if (N == 8 && S[2] == 8) return false` guard: when playing
   * with eight numbers, do not look at a triple that uses number 9. Because
   * triples are sorted, S[2] === 8 is exactly "contains index 8".
   */
  function onBoard(pos, triple) {
    return triple[2] < pos.n;
  }

  /** All three boxes in a triple hold the same colour. */
  function isMonochromatic(pos, triple) {
    const c = pos.colors;
    return c[triple[0]] === c[triple[1]] && c[triple[1]] === c[triple[2]];
  }

  /** FindSpecial: the first in-play triple that is one-coloured, or null. */
  function findSpecial(pos) {
    for (const t of TRIPLES) {
      if (!onBoard(pos, t)) continue;
      if (isMonochromatic(pos, t)) return t.slice();
    }
    return null;
  }

  /** Every in-play one-coloured triple (used by the logic test). */
  function allSpecials(pos) {
    return TRIPLES.filter((t) => onBoard(pos, t) && isMonochromatic(pos, t))
      .map((t) => t.slice());
  }

  /*
   * This is a demonstration, not a game with an opponent. It counts as
   * explored once the player has switched a box: with nine numbers a
   * one-coloured triple is then guaranteed; with eight numbers either outcome
   * (a pattern, or an AP-free colouring) is the point of the experiment.
   */
  function result(pos) {
    if (!pos.toggles) return null;
    if (pos.n === DEFAULT_N || findSpecial(pos)) return "done";
    return null;
  }

  /** Display numbers (1-based) for a triple of indices. */
  function numbers(triple) {
    return triple.map((i) => i + 1);
  }

  return {
    MAX, N_VALUES, DEFAULT_N, TRIPLES,
    start, setN, toggle, onBoard, isMonochromatic, findSpecial, allSpecials,
    result, numbers,
  };
})();
