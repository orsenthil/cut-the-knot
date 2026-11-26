"use strict";

/*
 * bicolor — the logic of Alexander Bogomolny's "Binary Color Device".
 *
 * The page (cut-the-knot.org/pythagoras/bicolor.shtml) explains Boolean algebra
 * and bitwise operations, then asks the player to fill a 4x4 grid with the
 * numbers 0..15, written left to right and top to bottom. A drag from a coloured
 * square onto another square replaces the target with the selected bitwise
 * operation of the two values (AND, OR, XOR) or with 15 minus the source (NOT).
 * A drop onto a blank square copies the source for AND/OR/XOR; NOT ignores the
 * target. The grid is finished when cell i holds exactly i.
 *
 * Two claims from the page are part of this logic: the worked example
 * 13 & 6 = 4, and the rubber-band identity a ^ b ^ b = a. Both are checked
 * exhaustively in porting/check-bicolor.mjs, as are all four operations and all
 * three starting patterns the applet picks from.
 *
 * This file is logic and plain data only: no document, no window, no storage.
 * It defines one global, BicolorCore, so the page loads it with a plain <script>
 * and porting/check-bicolor.mjs loads it in Node. Functions never change the
 * position they are given; state is numbers and arrays only.
 */
const BicolorCore = (() => {
  const N = 16;          // |B^4|, the applet's m_N
  const BITS = 4;
  const UNASSIGNED = -1; // an empty square, the applet's -1

  /* m_Colors and m_OtherColors, transcribed from the applet's constructor. */
  const COLORS = [
    [0, 0, 0], [96, 0, 0], [0, 96, 0], [96, 96, 0],
    [0, 0, 96], [96, 0, 96], [0, 96, 96], [96, 96, 96],
    [191, 191, 191], [255, 127, 127], [64, 191, 127], [255, 255, 127],
    [127, 127, 255], [255, 127, 255], [0, 191, 255], [255, 255, 255],
  ];
  const INK = [
    [191, 191, 191], [0, 191, 191], [191, 0, 191], [191, 191, 0],
    [191, 191, 191], [0, 191, 0], [191, 0, 0], [191, 96, 191],
    [96, 0, 96], [0, 127, 127], [127, 0, 127], [0, 0, 127],
    [0, 127, 0], [0, 127, 0], [127, 0, 0], [0, 0, 0],
  ];

  /* The four items of the applet's Choice, in index order (0..3). */
  const OPS = [
    { id: 0, label: "& (AND)", symbol: "&", apply: (a, b) => a & b },
    { id: 1, label: "V (OR)", symbol: "V", apply: (a, b) => a | b },
    { id: 2, label: "^ (XOR)", symbol: "^", apply: (a, b) => a ^ b },
    { id: 3, label: "~ (NOT)", symbol: "~", apply: (a) => N - 1 - a },
  ];

  /** (int) Math.pow(2, i), exactly as the applet computes its bit values. */
  const pow2 = (i) => Math.pow(2, i) | 0;

  /**
   * NewGame's three starting patterns, made without randomness so they can be
   * checked over their whole range. `k` is the bit position the applet leaves
   * out, `variant` picks the direction/pair of its second random choice.
   */
  function generate(mode, k, variant) {
    const values = new Array(N).fill(UNASSIGNED);

    if (mode === 0) {                       // SelectThreePure
      for (let i = 0; i < BITS; i++) if (i !== k) values[i] = pow2(i);
      return values;
    }

    if (mode === 1) {                       // SelectThree
      let t = -1;
      const upward = variant === 0;
      const downward = variant === 1;
      for (let step = 0; step < BITS; step++) {
        const i = upward ? step : downward ? BITS - 1 - step : step;
        if (i === k) continue;
        const p = pow2(i);
        if (t === -1) {
          values[p] = p;                    // the applet's dup_x2 assignment
          t = p;
        } else {
          const v = p + t;                  // distinct powers of two: p + t = p | t
          values[v] = v;
          t = variant === 2 ? v : -1;       // only the third variant accumulates
        }
      }
      return values;
    }

    if (mode === 2) {                       // SelectTwo
      const p = [-1, -1, -1];
      for (let i = 0; i < BITS; i++) {
        if (i === k) continue;
        const v = pow2(i);
        if (p[0] === -1) p[0] = v;
        else if (p[1] === -1) p[1] = v;
        else p[2] = v;
      }
      const pairs = [
        [p[0] + p[1], p[0] + p[2]],
        [p[0] + p[1], p[1] + p[2]],
        [p[2] + p[1], p[0] + p[2]],
      ];
      const chosen = pairs[variant] || pairs[0];
      values[chosen[0]] = chosen[0];
      values[chosen[1]] = chosen[1];
      return values;
    }
    return values;
  }

  /** The position a New Puzzle starts from, with the applet's random order. */
  function start(options) {
    const o = options || {};
    const rand = o.rand || Math.random;
    const mode = o.mode === undefined ? Math.floor(rand() * 3) : o.mode;
    const k = o.k === undefined ? Math.floor(rand() * 4) : o.k;
    const variant = o.variant === undefined ? Math.floor(rand() * 3) : o.variant;
    return {
      values: generate(mode, k, variant),
      op: o.op === undefined ? 0 : o.op,
      selected: -1,
      arg1: -1,
      arg2: -1,
      mode, k, variant,
    };
  }

  function copy(s) {
    return {
      values: s.values.slice(),
      op: s.op,
      selected: s.selected,
      arg1: s.arg1,
      arg2: s.arg2,
      mode: s.mode,
      k: s.k,
      variant: s.variant,
    };
  }

  function setOp(state, op) {
    if (!Number.isInteger(op) || op < 0 || op >= OPS.length) return copy(state);
    const next = copy(state);
    next.op = op;
    return next;
  }

  /** The applet's CheckMove with m_Arg still 0: a plain click selects a cell. */
  function click(state, cell) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= N) return copy(state);
    const next = copy(state);
    next.selected = cell;
    return next;
  }

  /**
   * The applet's Execute(), which mouseReleased calls after a drag.
   * `selected` is the target, `arg1` the dragged square, `arg2` the target;
   * the op's result replaces the target and leaves the source alone.
   */
  function execute(state) {
    const next = copy(state);
    if (next.selected < 0 || next.selected >= N) return next;
    const v = next.values;
    const s = next.selected, a1 = next.arg1, a2 = next.arg2;
    if (a1 < 0 || a1 >= N || v[a1] === UNASSIGNED) return next;
    const valid2 = a2 >= 0 && a2 < N && v[a2] !== UNASSIGNED;
    switch (next.op) {
      case 0: v[s] = valid2 ? v[a1] & v[a2] : v[a1]; break;
      case 1: v[s] = valid2 ? v[a1] | v[a2] : v[a1]; break;
      case 2: v[s] = valid2 ? v[a1] ^ v[a2] : v[a1]; break;
      case 3: v[s] = N - 1 - v[a1]; break;
      default: break;
    }
    return next;
  }

  /**
   * Drag square `source` onto square `target`. mousePressed only creates a
   * moving square when the source is coloured, so a blank source is just a
   * click; otherwise arg1/arg2/selected are set as in mouseReleased.
   */
  function drag(state, source, target) {
    if (!Number.isInteger(target) || target < 0 || target >= N) return copy(state);
    if (!Number.isInteger(source) || source < 0 || source >= N ||
        state.values[source] === UNASSIGNED) return click(state, target);
    const next = copy(state);
    next.arg1 = source;
    next.arg2 = target;
    next.selected = target;
    return execute(next);
  }

  /** The applet's CheckFinished: every square holds its own number. */
  function isSolved(state) {
    for (let i = 0; i < N; i++) if (state.values[i] !== i) return false;
    return true;
  }

  function filledCount(state) {
    return state.values.reduce((n, v) => n + (v !== UNASSIGNED ? 1 : 0), 0);
  }

  function correctCount(state) {
    return state.values.reduce((n, v, i) => n + (v === i ? 1 : 0), 0);
  }

  /** A demo: there is no win or loss, only a finished picture. */
  function result(state) {
    return isSolved(state) ? "done" : null;
  }

  /** The four bits of a square's number, most significant first. */
  function bits(v) {
    if (v < 0 || v >= N) return null;
    return Array.from({ length: BITS }, (_, i) => (v >> (BITS - 1 - i)) & 1);
  }

  const binary = (v) => (bits(v) ? bits(v).join("") : "----");
  const css = (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

  /**
   * Every claim the page makes, stated exactly and checked by the logic test:
   * the Boolean truth tables, the worked AND example and the XOR identity.
   */
  function claims() {
    const table = (fn) => [[0, 0, fn(0, 0)], [0, 1, fn(0, 1)],
                           [1, 0, fn(1, 0)], [1, 1, fn(1, 1)]];
    let involution = true;
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) if (((a ^ b) ^ b) !== a) involution = false;
    }
    return {
      and: table((a, b) => a & b),
      or: table((a, b) => a | b),
      xor: table((a, b) => a ^ b),
      workedExample: 13 & 6,      // the page: 1101 & 110 = 0100 = 4
      xorInvolution: involution,  // the page: a ^ b ^ b = a
      goal: Array.from({ length: N }, (_, i) => i),
    };
  }

  return {
    N, BITS, UNASSIGNED, COLORS, INK, OPS,
    generate, start, setOp, click, execute, drag,
    isSolved, filledCount, correctCount, result,
    bits, binary, css, claims,
  };
})();
