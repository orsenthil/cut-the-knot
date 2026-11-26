"use strict";

/*
 * Blithe 12, from Alexander Bogomolny's applet blithe12.
 *
 * Twelve counters sit on three overlapping circles. Each circle holds six of
 * them; two "control" counters per circle turn that circle one step clockwise
 * or one step anticlockwise. The page's theorem is that every starting order
 * can be put back: the six turns generate the whole symmetric group on the
 * twelve counters (verified in porting/check-blithe-12.mjs).
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Blithe12Core, so the page loads it with a plain
 * <script> and porting/check-blithe-12.mjs loads it in Node. A position is
 * plain data, so it can be handed straight to the tutor.
 */

const Blithe12Core = (() => {
  const N = 12;

  /* The six counters on each circle, in the order the applet walks them. */
  const CIRCLES = [
    [0, 3, 7, 8, 5, 1],
    [1, 4, 8, 9, 6, 2],
    [4, 7, 10, 11, 9, 5],
  ];

  /*
   * The applet's six points of interaction. dir +1 is ShiftM (the counter at
   * index k moves to index k+1); dir -1 is ShiftP (it moves to index k-1).
   */
  const CONTROLLERS = [
    { counter: 0, circle: 0, dir: +1 },
    { counter: 3, circle: 0, dir: -1 },
    { counter: 2, circle: 1, dir: -1 },
    { counter: 6, circle: 1, dir: +1 },
    { counter: 10, circle: 2, dir: +1 },
    { counter: 11, circle: 2, dir: -1 },
  ];

  const MODE_NAMES = [
    "2 color puzzle",
    "4 colors puzzle (middle)",
    "4 colors puzzle (border)",
    "6 colors puzzle",
    "12 Numbers",
  ];

  /* The applet's palette, kept as indices into the UI's counter colours. */
  const PALETTE = ["red", "green", "blue", "brown", "purple", "teal", "gray"];

  /** SetValues() from the bytecode: the home arrangement for each mode. */
  function homeValues(mode) {
    const v = new Array(N).fill(0);
    const put = (indexes, value) => indexes.forEach((i) => { v[i] = value; });
    switch (mode) {
      case 0:
        put([0, 3, 2, 6, 10, 11], 0);
        put([1, 4, 5, 7, 8, 9], 1);
        break;
      case 1:
        put([0, 3], 0);
        put([2, 6], 1);
        put([10, 11], 2);
        put([1, 4, 5, 7, 8, 9], 6);
        break;
      case 2:
        put([0, 2, 3, 6, 10, 11], 2);
        put([1, 8], 3);
        put([5, 7], 4);
        put([4, 9], 5);
        break;
      case 3:
        put([0, 3], 0);
        put([2, 6], 1);
        put([10, 11], 2);
        put([1, 8], 3);
        put([5, 7], 4);
        put([4, 9], 5);
        break;
      default:
        // The 12-number game carries counter numbers 1..12, as in the applet.
        for (let i = 0; i < N; i++) v[i] = i + 1;
    }
    return v;
  }

  function clampMode(mode) {
    const n = Number(mode);
    return Number.isFinite(n) ? Math.max(0, Math.min(4, Math.trunc(n))) : 4;
  }

  /** The position a new puzzle starts from. */
  function start(options) {
    const o = options || {};
    const mode = clampMode(o.mode === undefined ? 4 : o.mode);
    const home = homeValues(mode);
    return {
      mode: mode,
      home: home,
      values: home.slice(),
      moves: 0,
      hint: mode === 4 && !!o.hint,
    };
  }

  /** The six turns allowed; a turn is { circle: 0..2, dir: +1|-1 }. */
  function legalMoves() {
    return [+1, -1].flatMap((dir) => [0, 1, 2].map((circle) => ({ circle, dir })));
  }

  /** ShiftM/ShiftP from the bytecode, applied to one circle of a copy. */
  function turn(values, circle, dir) {
    const idx = CIRCLES[circle];
    const out = values.slice();
    if (dir > 0) {
      const saved = out[idx[0]];
      for (let k = 0; k < 5; k++) out[idx[k]] = out[idx[k + 1]];
      out[idx[5]] = saved;
    } else {
      const saved = out[idx[5]];
      for (let k = 5; k > 0; k--) out[idx[k]] = out[idx[k - 1]];
      out[idx[0]] = saved;
    }
    return out;
  }

  /** The position after a turn, or null if the turn is not allowed. */
  function move(state, m) {
    if (!m || !Number.isInteger(m.circle) || m.circle < 0 || m.circle > 2) return null;
    if (m.dir !== 1 && m.dir !== -1) return null;
    return {
      mode: state.mode,
      home: state.home,
      values: turn(state.values, m.circle, m.dir),
      moves: state.moves + 1,
      hint: state.hint,
    };
  }

  /** Reset() puts the home arrangement back and clears the move count. */
  function reset(state) {
    return {
      mode: state.mode,
      home: state.home.slice(),
      values: state.home.slice(),
      moves: 0,
      hint: state.hint,
    };
  }

  /** Reshuffle(): 3*N random turns, one of six for each, from the bytecode. */
  function shuffle(state, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    let values = state.values.slice();
    for (let i = 0; i < 3 * N; i++) {
      const k = Math.floor(random() * 6);
      const circle = Math.floor(k / 2);
      values = turn(values, circle, k % 2 === 0 ? +1 : -1);
    }
    return {
      mode: state.mode,
      home: state.home,
      values: values,
      moves: state.moves + 3 * N,
      hint: state.hint,
    };
  }

  /** Cheat() from the bytecode swaps only counters 1 and 4. */
  function cheat(state) {
    const values = state.values.slice();
    const tmp = values[0];
    values[0] = values[3];
    values[3] = tmp;
    return {
      mode: state.mode,
      home: state.home,
      values: values,
      moves: state.moves,
      hint: state.hint,
    };
  }

  function isHome(state) {
    return state.values.every((v, i) => v === state.home[i]);
  }

  /*
   * Permutation.toCycles() with m_Mode 2: values are 0-based counter numbers
   * and the printed cycle members are 1-based, as on the original page.
   */
  function cycles(values) {
    const checked = new Array(N).fill(false);
    let text = "";
    for (;;) {
      let i = -1;
      for (let k = 0; k < N; k++) {
        if (!checked[k]) { i = k; break; }
      }
      if (i < 0) break;
      text += "(";
      let j = i;
      for (;;) {
        text += String(j + 1); // fromI(2)
        checked[j] = true;
        j = values[j] - 1; // fromV(2)
        if (checked[j]) break;
      }
      text += ")";
    }
    return text;
  }

  /* This is an illustration: there is no win, no loss and no ending state. */
  function result() {
    return null;
  }

  return {
    N, CIRCLES, CONTROLLERS, MODE_NAMES, PALETTE,
    homeValues, start, legalMoves, move, reset, shuffle, cheat,
    turn, isHome, cycles, result,
  };
})();
