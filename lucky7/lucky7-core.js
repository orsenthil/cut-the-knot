"use strict";

/*
 * Lucky 7, from Alexander Bogomolny's applet lucky7.
 *
 * Seven numbered counters sit on two overlapping rings.  The empty place at
 * the top never moves; the six other control places spin one ring, the other
 * ring, or the whole chain of counters.  A position is just the array of
 * counter numbers in the places, so every move is a permutation of 1..n.
 * The key fact is that with seven counters these few spins generate every
 * permutation: a short word swaps two neighbouring counters, and conjugating
 * that word swaps any two counters at all.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, Lucky7Core. Every function takes a
 * position and returns a new one; nothing passed in is changed.
 */
const Lucky7Core = (() => {
  const MIN_N = 3;
  const MAX_N = 13;

  // The six shifts of the applet, named after its private Java methods.
  // M and P are the applet's "minus" and "plus" directions.
  const MOVE_IDS = ["leftM", "rightM", "circP", "leftP", "rightP", "circM"];

  // The order used by the applet's Reshuffle(): floor(random() * 6).
  const SHUFFLE_ORDER = ["leftP", "rightP", "circM", "rightM", "circP", "leftM"];

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /** The applet only offers odd sizes 3, 5, ... 13, two apart. */
  function normalizeN(n) {
    let value = clamp(Math.round(Number(n) || MIN_N), MIN_N, MAX_N);
    if (value % 2 === 0) value -= 1;
    return value;
  }

  /** The applet's m_M: the index of the lower crossing of the two rings. */
  function middle(n) {
    return Math.floor((n + 1) / 2) + 1;
  }

  /** The place index a click tests for each of the applet's six shifts. */
  function controlIndex(n, id) {
    const m = middle(n);
    switch (id) {
      case "leftM": return 1;
      case "rightM": return n;
      case "circP": return 0;
      case "leftP": return m - 2;
      case "rightP": return m;
      case "circM": return m - 1;
      default: return -1;
    }
  }

  /**
   * Which shift a click on a place makes. This is the order of the tests in
   * the applet's Shift(Point): earlier tests win when two places coincide
   * (they do at the smallest size, n = 3).
   */
  function hitMove(n, index) {
    for (let k = 0; k < MOVE_IDS.length; k++) {
      const id = MOVE_IDS[k];
      if (controlIndex(n, id) === index) return id;
    }
    return null;
  }

  /** The place names used on the page, in the same order as hitMove(). */
  function placeName(n, index) {
    const m = middle(n);
    if (index === 0) return "top crossing";
    if (index === m - 1) return "bottom crossing";
    if (index <= m - 2) return index === 1 ? "upper left" : "lower left";
    return index === n ? "upper right" : "lower right";
  }

  /**
   * A literal transcription of the applet's six rotate loops. `down` copies
   * values towards smaller indices (new[i] = old[i+1]); `up` copies them
   * towards larger ones (new[i] = old[i-1]). Place 0 is never involved.
   */
  function rotate(values, lo, hi, down) {
    const out = values.slice();
    if (down) {
      const held = out[lo];
      for (let k = lo; k < hi; k++) out[k] = out[k + 1];
      out[hi] = held;
    } else {
      const held = out[hi];
      for (let k = hi; k > lo; k--) out[k] = out[k - 1];
      out[lo] = held;
    }
    return out;
  }

  function isHome(values) {
    for (let k = 0; k < values.length; k++) {
      if (values[k] !== k) return false;
    }
    return true;
  }

  /** The position a fresh board (the applet's reset()) starts from. */
  function start(options) {
    const opts = options || {};
    const n = normalizeN(opts.n === undefined ? 7 : opts.n);
    return { n: n, values: Array.from({ length: n + 1 }, (_, i) => i), solved: false, moves: 0 };
  }

  /** Reset, or move between the applet's sizes; every size starts at home. */
  function resize(state, delta) {
    return start({ n: normalizeN(state.n + delta) });
  }

  function legalMoves(state) {
    return MOVE_IDS.slice();
  }

  /** The position after one shift, or null for an unknown shift. */
  function move(state, id) {
    const n = state.n;
    const m = middle(n);
    let values = null;
    switch (id) {
      case "leftM": values = rotate(state.values, 1, m - 1, true); break;
      case "leftP": values = rotate(state.values, 1, m - 1, false); break;
      case "rightM": values = rotate(state.values, m - 1, n, true); break;
      case "rightP": values = rotate(state.values, m - 1, n, false); break;
      case "circP": values = rotate(state.values, 1, n, true); break;
      case "circM": values = rotate(state.values, 1, n, false); break;
      default: return null;
    }
    return {
      n: n,
      values: values,
      solved: isHome(values),
      moves: state.moves + 1,
    };
  }

  /**
   * The applet's Shuffle: 2n random shifts, each chosen uniformly from its
   * six shift methods, in the order leftP, rightP, circM, rightM, circP,
   * leftM. `random` returns a number in [0, 1).
   */
  function shuffle(state, random) {
    const nextRandom = random || Math.random;
    let out = { n: state.n, values: state.values.slice(), solved: false, moves: 0 };
    for (let k = 0; k < 2 * state.n; k++) {
      const choice = Math.min(5, Math.floor(nextRandom() * 6));
      out = move(out, SHUFFLE_ORDER[choice]);
    }
    out.solved = false;
    return out;
  }

  /** The applet's Cheat button swaps the first two numbered counters. */
  function cheat(state) {
    const values = state.values.slice();
    const held = values[1];
    values[1] = values[2];
    values[2] = held;
    return {
      n: state.n,
      values: values,
      solved: state.solved, // Cheat does not run the applet's finish test
      moves: state.moves,
    };
  }

  /** "done" when the counters are home; this illustration has no win/loss. */
  function result(state) {
    return state.solved ? "done" : null;
  }

  /**
   * The applet's Permutation.toCycles() in mode IgnoreZero. Place 0 is the
   * empty place and is ignored; the highest counter stands in for it, so a
   * cycle closes as soon as it reaches that counter.
   */
  function cycles(state) {
    const n = state.n;
    const values = state.values;
    const seen = new Array(n + 1).fill(false);
    seen[0] = true;
    let out = "";
    const fromI = (i) => (i === 0 ? n : i);
    const fromV = (v) => (v === n ? 0 : v);
    let i;
    const findUnchecked = () => {
      for (let k = 1; k <= n; k++) if (!seen[k]) return k;
      return -1;
    };
    while ((i = findUnchecked()) !== -1) {
      out += "(";
      let first = true;
      do {
        out += (first ? "" : " ") + fromI(i);
        first = false;
        seen[i] = true;
        i = fromV(values[i]);
      } while (!seen[i]);
      out += ")";
    }
    return out;
  }

  /** ViewBox coordinates of the places, as in the applet's DrawBoard(). */
  function layout(n) {
    const m = middle(n);
    const alpha = (2 * Math.PI) / m;
    const radius = 80;
    const left = { x: 180 - radius * Math.cos(alpha / 2), y: 120 };
    const right = { x: 360 - left.x, y: 120 };
    const points = [];
    for (let i = 0; i < m - 1; i++) {
      const angle = alpha / 2 + i * alpha;
      points.push({ x: left.x + radius * Math.cos(angle), y: left.y - radius * Math.sin(angle) });
    }
    for (let i = m - 1; i <= n; i++) {
      const angle = alpha / 2 + (i - m + 1) * alpha + Math.PI;
      points.push({ x: right.x + radius * Math.cos(angle), y: right.y - radius * Math.sin(angle) });
    }
    return { left: left, right: right, radius: radius, points: points };
  }

  return {
    MIN_N: MIN_N,
    MAX_N: MAX_N,
    MOVE_IDS: MOVE_IDS,
    normalizeN: normalizeN,
    middle: middle,
    controlIndex: controlIndex,
    hitMove: hitMove,
    placeName: placeName,
    start: start,
    resize: resize,
    legalMoves: legalMoves,
    move: move,
    shuffle: shuffle,
    cheat: cheat,
    result: result,
    cycles: cycles,
    layout: layout,
    isHome: isHome,
  };
})();
