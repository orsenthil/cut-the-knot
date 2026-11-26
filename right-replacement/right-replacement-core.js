"use strict";

/*
 * Right Replacement, from Alexander Bogomolny's cut-the-knot applet.
 *
 * Start with a row of whole numbers. Replace each number (except the last)
 * by how many numbers to its right satisfy a comparison: smaller (LT),
 * smaller or equal (LE), greater (GT) or greater or equal (GE). Repeat.
 * LT settles at a fixed row, LE at (n-1, ..., 0), GT at all zeroes, and GE
 * usually loops between two rows.
 *
 * The row-at-a-time rule, the four comparisons, the stopping test (including
 * the applet's special GE test against the row two back) and the 100-row cap
 * are transcribed from the bytecode. This file is pure logic: no DOM, no
 * storage, one global, and positions that are plain JSON.
 */
const RightReplacementCore = (() => {
  const MIN_LENGTH = 2;
  const MAX_LENGTH = 40; // PVNumeric's range in RightReplacementPanel
  const MIN_VALUE = 1;
  const MAX_VALUE = 10000; // CTKNumberLim's range for each entry
  const MAX_ROWS = 100;
  const TYPES = ["LT", "LE", "GT", "GE"];

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  /** The applet's FillRow<Type>: count how many entries to the right compare. */
  function step(row, type) {
    const next = new Array(row.length).fill(0);
    for (let i = 0; i < row.length - 1; i++) {
      let count = 0;
      for (let j = i + 1; j < row.length; j++) {
        const a = row[i];
        const b = row[j];
        if (type === "LT" ? a > b : type === "LE" ? a >= b
          : type === "GT" ? a < b : a <= b) count++;
      }
      next[i] = count;
    }
    return next;
  }

  /** The applet's IsOver: GE looks two rows back, the others one row back. */
  function isOver(rows, type) {
    const size = rows.length;
    if (size < 2) return false;
    if (type === "GE") {
      if (size < 3) return false;
      return rows[size - 1].every((v, i) => v === rows[size - 3][i]);
    }
    return rows[size - 1].every((v, i) => v === rows[size - 2][i]);
  }

  /** All the rows the applet would draw, and why it stopped. */
  function iterate(values, type, maxRows = MAX_ROWS) {
    const rows = [];
    let current = values.slice();
    while (true) {
      const next = step(current, type);
      rows.push(next);
      if (isOver(rows, type)) return { rows, reason: type === "GE" ? "period-2" : "stable" };
      if (rows.length >= maxRows) return { rows, reason: "cap" };
      current = next;
    }
  }

  /** The applet starts each entry at floor(random() * 50) + 1, i.e. 1..50. */
  function randomValues(length, random = Math.random) {
    return Array.from({ length }, () => Math.floor(random() * 50) + 1);
  }

  /** The position a new demo starts from. */
  function start(options = {}) {
    const type = TYPES.includes(options.type) ? options.type : "LT";
    const wanted = Array.isArray(options.values) ? options.values.length : 10;
    const length = clamp(options.length ?? wanted, MIN_LENGTH, MAX_LENGTH);
    const values = Array.isArray(options.values)
      ? options.values.slice(0, length).map((v) => clamp(v, MIN_VALUE, MAX_VALUE))
      : randomValues(length, options.random ?? Math.random);
    while (values.length < length) values.push(MIN_VALUE);
    return {
      length,
      type,
      values,
      computed: !!options.computed,
      rows: [],
      message: "Press Compute to follow the replacements, or click a number to change the row.",
    };
  }

  function finish(state, rows, reason, message) {
    return {
      ...state,
      computed: true,
      rows,
      message,
      reason,
    };
  }

  /** The Compute button (and Reset, and a change of comparison). */
  function compute(state) {
    const { rows, reason } = iterate(state.values, state.type);
    const message = reason === "stable"
      ? `Settled after ${rows.length} ${rows.length === 1 ? "step" : "steps"}: the row no longer changes.`
      : reason === "period-2"
        ? `After ${rows.length} steps the row repeats every two steps, as GE often does.`
        : `Still changing after ${MAX_ROWS} steps, so the display stops at ${MAX_ROWS} rows.`;
    return finish(state, rows, reason, message);
  }

  /** Clicking a number stops the display, as in the applet. */
  function setValue(state, index, value) {
    if (index < 0 || index >= state.values.length) return state;
    const values = state.values.slice();
    values[index] = clamp(value, MIN_VALUE, MAX_VALUE);
    return {
      ...state,
      values,
      computed: false,
      rows: [],
      reason: null,
      message: `Number ${index + 1} is now ${values[index]}. Press Compute to follow it again.`,
    };
  }

  /** A change of comparison recomputes; a change of length does not. */
  function setType(state, type) {
    if (!TYPES.includes(type)) return state;
    return compute({ ...state, type });
  }

  function setLength(state, length, random = Math.random) {
    const next = clamp(length, MIN_LENGTH, MAX_LENGTH);
    return {
      ...state,
      length: next,
      values: randomValues(next, random),
      computed: false,
      rows: [],
      reason: null,
      message: `${next} numbers to start with. Press Compute to follow them.`,
    };
  }

  /** Reset picks a new random row and shows its replacements. */
  function reset(state, random = Math.random) {
    return compute({ ...state, values: randomValues(state.length, random) });
  }

  /** "done" once the player has run a computation. */
  function result(state) {
    return state.computed ? "done" : null;
  }

  return {
    MIN_LENGTH, MAX_LENGTH, MIN_VALUE, MAX_VALUE, MAX_ROWS, TYPES,
    start, step, isOver, iterate, compute, setValue, setType, setLength,
    reset, result, randomValues,
  };
})();
