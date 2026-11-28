"use strict";

/*
 * Happy 8, from Alexander Bogomolny's applet happy8.
 *
 * Counters sit on two overlapping circles. Two counters lie at the crossings
 * (the "whole" positions); each circle also has a pair of counters next to
 * them. Pressing a control rotates one circle (or the whole set) one place.
 * The aim is to bring every counter Home: counter i in place i, and counter n
 * in crossing 0. The key idea is that every press is a cycle of positions, so
 * the whole puzzle is a permutation group: whether a shuffle can be undone
 * depends on the parity of those cycles.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, Happy8Core, so the page loads it with a
 * plain <script> and porting/check-happy-8.mjs loads it in Node. A position is
 * plain data, and every function returns a new position rather than changing
 * the one it was given.
 *
 * Move names follow the page: l, r, w are the counterclockwise turns of the
 * left circle, right circle and whole set; L, R, W are their clockwise
 * inverses. These are the applet's ShiftLeftP, ShiftRightP, ShiftCircularM,
 * ShiftLeftM, ShiftRightM and ShiftCircularP respectively.
 */
const Happy8Core = (() => {
  const MIN_N = 4;   // the applet's "<" button stops here
  const MAX_N = 14;  // the applet's ">" button stops here
  const MOVES = ["l", "r", "w", "L", "R", "W"];
  const NAMES = {
    l: "Left circle, counterclockwise",
    r: "Right circle, counterclockwise",
    w: "Whole set, counterclockwise",
    L: "Left circle, clockwise",
    R: "Right circle, clockwise",
    W: "Whole set, clockwise",
  };
  const CLOCKWISE = { L: true, R: true, W: true, l: false, r: false, w: false };

  /** Number of counters on each circle: M = n/2 + 1, so each circle shares 2. */
  const halfCount = (n) => Math.floor(n / 2) + 1;

  /** n as the applet's size buttons allow: even, from 4 to 14. */
  function size(n) {
    let v = Math.floor(Number(n) || 0);
    if (v % 2 !== 0) v += 1;
    return Math.max(MIN_N, Math.min(MAX_N, v));
  }

  /** Home: counter n at crossing 0, counter i at place i. */
  function home(n) {
    const values = new Array(size(n));
    values[0] = values.length;
    for (let i = 1; i < values.length; i++) values[i] = i;
    return values;
  }

  const isHome = (values, n) => {
    if (values.length !== n) return false;
    for (let i = 0; i < n; i++) if (values[i] !== (i === 0 ? n : i)) return false;
    return true;
  };

  /** The position a new game starts from. */
  function start(options) {
    const o = options || {};
    const n = size(o.n === undefined ? 8 : o.n);
    return {
      n: n,
      values: o.values ? o.values.slice() : home(n),
      moves: 0,
      solved: false,
    };
  }

  /** The six presses the applet offers. */
  function legalMoves(state) {
    return MOVES.slice();
  }

  /**
   * The cycle of positions a move turns, in counterclockwise order:
   * left = 0..M-1, right = 0, M-1, M..n-1, whole = 0..n-1.
   */
  function cycle(move, n) {
    const M = halfCount(n);
    if (move === "l" || move === "L") return Array.from({ length: M }, (_, i) => i);
    if (move === "r" || move === "R") return [0, M - 1, ...Array.from({ length: n - M }, (_, i) => M + i)];
    if (move === "w" || move === "W") return Array.from({ length: n }, (_, i) => i);
    return null;
  }

  /** Rotate the counters along a cycle by one seat; no array is changed. */
  function turn(values, seats, forward) {
    const out = values.slice();
    for (let k = 0; k < seats.length; k++) {
      const from = forward ? seats[k] : seats[(k + 1) % seats.length];
      const to = forward ? seats[(k + 1) % seats.length] : seats[k];
      out[to] = values[from];
    }
    return out;
  }

  /** The position after a move, or null if the move is not one of the six. */
  function move(state, m) {
    const seats = cycle(m, state.n);
    if (!seats || m.length !== 1 || MOVES.indexOf(m) < 0) return null;
    const values = turn(state.values, seats, !CLOCKWISE[m]);
    return {
      n: state.n,
      values: values,
      moves: state.moves + 1,
      // The applet sets its "just finished" flag on any press that leaves
      // every counter Home; pressing from Home itself does not set it.
      solved: isHome(values, state.n),
    };
  }

  /** "done" when a press has just brought the counters Home; never a win/loss. */
  function result(state) {
    return state.solved ? "done" : null;
  }

  /**
   * Which move the applet's hit test gives for a counter seat. The order is
   * the order of the comparisons in happy8game.Shift: upper-left, upper-right,
   * upper crossing, lower-left, lower-right, lower crossing.
   */
  function moveAt(index, n) {
    const M = halfCount(n);
    if (index === 1) return "L";
    if (index === n - 1) return "R";
    if (index === 0) return "W";
    if (index === M - 2) return "l";
    if (index === M) return "r";
    if (index === M - 1) return "w";
    return null;
  }

  /** The seats the six controls sit on (at n=4 two pairs share a seat). */
  function controlSeats(n) {
    const out = {};
    for (const m of MOVES) {
      for (let i = 0; i < n; i++) {
        if (moveAt(i, n) === m) { out[m] = i; break; }
      }
    }
    return out;
  }

  /** The applet's Reshuffle: 2n random presses, one of six each time. */
  function shuffle(state, rand) {
    const random = rand || Math.random;
    const table = ["l", "r", "w", "R", "W", "L"]; // the bytecode's tableswitch
    let values = state.values.slice();
    for (let i = 0; i < 2 * state.n; i++) {
      const pick = Math.min(5, Math.max(0, Math.floor(random() * 6)));
      values = turn(values, cycle(table[pick], state.n), !CLOCKWISE[table[pick]]);
    }
    return { n: state.n, values: values, moves: 0, solved: false };
  }

  /** The applet's Cheat button: swap counters 1 and 2 in place. */
  function cheat(state) {
    const values = state.values.slice();
    const t = values[1];
    values[1] = values[2];
    values[2] = t;
    return { n: state.n, values: values, moves: state.moves, solved: false };
  }

  /**
   * Permutation.toCycles with mode 0: label 0 as n, skip fixed points, and
   * print the cycles of the current arrangement with no space between them.
   * The applet prints this when "Cycles" is checked.
   */
  function cycles(state) {
    const values = state.values;
    const n = state.n;
    const fromI = (i) => (i === 0 ? n : i);
    const fromV = (v) => (v === n ? 0 : v);
    const used = new Array(n).fill(false);
    const findUnchecked = () => {
      for (let k = 1; k <= n; k++) {
        const i = k === n ? 0 : k;
        if (!used[i]) return i;
      }
      return -1;
    };
    let out = "";
    let i = findUnchecked();
    while (i !== -1) {
      out += "(";
      do {
        // The applet's separator between entries is the empty string.
        out += fromI(i);
        used[i] = true;
        i = fromV(values[i]);
      } while (!used[i]);
      out += ")";
      i = findUnchecked();
    }
    return out;
  }

  /** 0 for an even arrangement, 1 for an odd one (compared with Home). */
  function parity(values) {
    const n = values.length;
    const seen = new Array(n).fill(false);
    let flips = 0;
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      let j = i, length = 0;
      while (!seen[j]) { seen[j] = true; j = values[j] === n ? 0 : values[j]; length++; }
      flips += length - 1;
    }
    return flips % 2;
  }

  /** The three counterclockwise generators as position permutations. */
  function generators(n) {
    const l = arrayToMap(cycle("l", n), n);
    const r = arrayToMap(cycle("r", n), n);
    const w = arrayToMap(cycle("w", n), n);
    return { l: l, r: r, w: w };
  }

  function arrayToMap(seats, n) {
    const map = Array.from({ length: n }, (_, i) => i);
    for (let k = 0; k < seats.length; k++) map[seats[k]] = seats[(k + 1) % seats.length];
    return map;
  }

  return {
    MIN_N: MIN_N, MAX_N: MAX_N, MOVES: MOVES, NAMES: NAMES, CLOCKWISE: CLOCKWISE,
    size: size, home: home, isHome: isHome, start: start,
    legalMoves: legalMoves, cycle: cycle, move: move, result: result,
    moveAt: moveAt, controlSeats: controlSeats, shuffle: shuffle, cheat: cheat,
    cycles: cycles, parity: parity, halfCount: halfCount, generators: generators,
  };
})();
