"use strict";

/*
 * Arith Magic, from Alexander Bogomolny's applet ArithMagic (the
 * "Arithmetic Magic Matrix" page). A square table is filled with row numbers
 * plus (or times) column numbers. Pick exactly one square in every row and
 * every column: the sum (or product) of the picked squares always equals the
 * sum (or product) of all the row and column numbers. Every chosen square
 * uses each control once, so the order of the choices cannot change the total.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, ArithMagicCore. The position is plain
 * data; functions take a position and return a new one, leaving the old alone.
 * The numbers, limits, steps and messages follow the applet's bytecode:
 * ArithMagicCanvas.SetData/GetResult/Reverse and CTKNumberLim.UpdateSlow/
 * UpdateFast.
 */
const ArithMagicCore = (() => {
  const MIN_SIZE = 2; // ArithMagicPanel.Min
  const MAX_SIZE = 10; // ArithMagicPanel.Max
  const DEFAULT_SIZE = 5; // the applet's NUM parameter defaults to 5

  // SetData(): sum rows start in 1..25, sum columns in 0..18; product rows
  // and columns start in 1..19. Slow clicks step by 1, drags by SetIncrement.
  const LIMITS = {
    sum: { row: [-100, 100], col: [-100, 100], rowStep: 10, colStep: 5 },
    product: { row: [1, 20], col: [1, 20], rowStep: 2, colStep: 2 },
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const copy = (state) => ({
    size: state.size,
    operation: state.operation,
    v: state.v.slice(),
    h: state.h.slice(),
    selected: state.selected.map((p) => p.slice()),
  });

  /** A fresh table. `rng` is injectable so tests can reproduce a board. */
  function start(options = {}) {
    const op = options.operation;
    const operation = op === "product" || op === "x" || op === 1 ? "product" : "sum";
    const wanted = Number(options.size);
    const size = Number.isFinite(wanted)
      ? clamp(Math.round(wanted), MIN_SIZE, MAX_SIZE)
      : DEFAULT_SIZE;
    const random = typeof options.rng === "function" ? options.rng : Math.random;
    const v = [];
    const h = [];
    for (let i = 0; i < size; i++) {
      v.push(operation === "sum" ? Math.floor(random() * 25) + 1 : Math.floor(random() * 19) + 1);
      h.push(operation === "sum" ? Math.floor(random() * 19) : Math.floor(random() * 19) + 1);
    }
    return { size, operation, v, h, selected: [] };
  }

  /** The number drawn in square (row r, column c): Draw()'s cell text. */
  function cellValue(state, r, c) {
    if (state.operation === "product") return state.v[r] * state.h[c];
    return state.v[r] + state.h[c];
  }

  /** True when this square has a magenta cross in the applet. */
  function isSelected(state, r, c) {
    return state.selected.some((p) => p[0] === r && p[1] === c);
  }

  /** Reverse(): click a square to add or remove its cross. */
  function toggle(state, r, c) {
    if (!Number.isInteger(r) || !Number.isInteger(c)) return state;
    if (r < 0 || c < 0 || r >= state.size || c >= state.size) return state;
    const at = state.selected.findIndex((p) => p[0] === r && p[1] === c);
    const next = copy(state);
    if (at >= 0) next.selected.splice(at, 1); // the second click takes it away
    else next.selected.push([r, c]); // the applet refuses a duplicate square
    return next;
  }

  /** The applet lights up its three little faces at exactly N squares. */
  function isFull(state) {
    return state.selected.length === state.size;
  }

  /** The page's own rule: one square in every row and every column. */
  function isTransversal(state) {
    if (!isFull(state)) return false;
    const rows = new Set();
    const cols = new Set();
    for (const [r, c] of state.selected) {
      if (rows.has(r) || cols.has(c)) return false;
      rows.add(r);
      cols.add(c);
    }
    return rows.size === state.size && cols.size === state.size;
  }

  /**
   * GetResult(): the running total of the crossed squares, or null for an
   * empty selection. The applet adds (or multiplies) the row control and
   * column control of each selected square, in click order.
   */
  function runningTotal(state) {
    if (state.selected.length === 0) return null;
    let total = state.operation === "product" ? 1 : 0;
    for (const [r, c] of state.selected) {
      if (state.operation === "product") total *= state.v[r] * state.h[c];
      else total += state.v[r] + state.h[c];
    }
    return total;
  }

  /** The fixed value the trick predicts from the controls alone. */
  function predictedTotal(state) {
    if (state.operation === "product") {
      let product = 1;
      for (const v of state.v) product *= v;
      for (const h of state.h) product *= h;
      return product;
    }
    let sum = 0;
    for (const v of state.v) sum += v;
    for (const h of state.h) sum += h;
    return sum;
  }

  /** GetResult()'s exact line, as drawn along the bottom of the applet. */
  function resultMessage(state) {
    const total = runningTotal(state);
    if (total === null) return "";
    return (state.operation === "product" ? "Product so far:" : "Sum so far:") + total;
  }

  /** The trick is revealed by one square in every row and every column. */
  function result(state) {
    return isTransversal(state) ? "done" : null;
  }

  /**
   * CTKNumberLim.UpdateSlow/UpdateFast. A click on the right half of a
   * control steps up, a click on the left half steps down; dragging is fast
   * and moves by the applet's increment. Both stop at SetLimits().
   */
  function stepControl(state, which, index, direction, fast = false) {
    if ((which !== "row" && which !== "col") || !Number.isInteger(index) ||
        index < 0 || index >= state.size || (direction !== 1 && direction !== -1)) return state;
    const key = which === "row" ? "v" : "h";
    const [min, max] = LIMITS[state.operation][which];
    const incr = LIMITS[state.operation][which === "row" ? "rowStep" : "colStep"];
    const value = state[key][index];
    let nextValue = value;
    if (fast) {
      if (direction > 0 && value < max - incr + 1) nextValue = value + incr;
      else if (direction < 0 && value > min + incr - 1) nextValue = value - incr;
    } else {
      if (direction > 0 && value < max) nextValue = value + 1;
      else if (direction < 0 && value > min) nextValue = value - 1;
    }
    if (nextValue === value) return state;
    const next = copy(state);
    next[key][index] = nextValue;
    return next;
  }

  /** Applet: Clear empties the crosses; Reset and the options rebuild. */
  function clear(state) {
    return state.selected.length === 0 ? state : { ...copy(state), selected: [] };
  }

  function setSize(state, size) {
    return start({ size, operation: state.operation });
  }

  function setOperation(state, operation) {
    return start({ size: state.size, operation });
  }

  /** Every press the page can make, as plain move objects. */
  function legalMoves(state) {
    const moves = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) moves.push({ type: "toggle", r, c });
    }
    for (const which of ["row", "col"]) {
      for (let i = 0; i < state.size; i++) {
        for (const dir of [-1, 1]) {
          moves.push({ type: "step", which, index: i, dir, fast: false });
          moves.push({ type: "step", which, index: i, dir, fast: true });
        }
      }
    }
    return moves;
  }

  function move(state, m) {
    if (!m) return null;
    if (m.type === "toggle") return toggle(state, m.r, m.c);
    if (m.type === "step") return stepControl(state, m.which, m.index, m.dir, !!m.fast);
    return null;
  }

  return {
    MIN_SIZE, MAX_SIZE, DEFAULT_SIZE, LIMITS,
    start, cellValue, isSelected, toggle, isFull, isTransversal,
    runningTotal, predictedTotal, resultMessage, result, stepControl,
    clear, setSize, setOperation, legalMoves, move,
  };
})();
