"use strict";

/*
 * Frieze, from Alexander Bogomolny's applet Frieze.
 *
 * A staggered lattice of numbers is filled in one diamond at a time. In the
 * additive mode each new number is left + right - middle + 1; in the
 * multiplicative mode it is trunc((left * right + 1) / middle), or 0 when the
 * middle is 0. Checking "Simple" drops the 1. The key idea is that the applet
 * marks yet-uncomputed nodes with the operation's own value (0 for +, 1 for
 * x), so every "Compute" pass starts by finding the first such node in each
 * row and then advances a per-row cursor across the lattice.
 *
 * This is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, FriezeCore, so the page loads it with a
 * plain <script> and porting/check-frieze.mjs loads it in Node. The position
 * is plain data (numbers, arrays, booleans, plain objects), ready for the
 * player's record and the tutor.
 */
const FriezeCore = (() => {
  const ROW_MIN = 5, ROW_MAX = 50;   // FriezePanel.m_Lower / m_Upper
  const MOD_MIN = 2, MOD_MAX = 10;   // FriezePanel.m_LowerModulo / m_UpperModulo
  const ADD = 0, MUL = 1;            // FriezeCanvas.m_Op: 0 is "+", 1 is "x"

  const cloneRows = (rows) => rows.map((row) => row.slice());

  /** Dot row i holds n+1 nodes when i is even, n nodes when i is odd. */
  function rowLength(n, i) {
    return i % 2 === 0 ? n + 1 : n;
  }

  /** CheckIfFinished from the applet: the cursor has reached the last node. */
  function finished(n, processed) {
    for (let i = 0; i < n; i++) {
      const limit = i % 2 === 0 ? n : n - 1;
      if (processed[i] !== limit) return false;
    }
    return true;
  }

  /** ComputeValue(int a, int b, int c) transcribed from the bytecode. */
  function computeValue(op, simple, a, b, c) {
    if (op === ADD) {
      // a + c - b, plus 1 unless the Simple checkbox is on.
      return a + c - b + (simple ? 0 : 1);
    }
    if (b === 0) return 0;                       // the applet's division guard
    // Java int division truncates toward zero, unlike Math.floor.
    return Math.trunc((a * c + (simple ? 0 : 1)) / b);
  }

  /** The colour slot used by Dot.Draw, including its negative-value loop. */
  function colorIndex(value, modulo) {
    let color = value;
    while (color < 0) color += modulo;
    return color % modulo;
  }

  function blankRows(n, op) {
    const blank = op === ADD ? 0 : 1;            // Reset() builds Dots with 0 or 1
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(new Array(rowLength(n, i)).fill(blank));
    return rows;
  }

  function within(value, lo, hi) {
    return Number.isInteger(value) && value >= lo && value <= hi;
  }

  /** The initial lattice: 10 rows, modulo 2, additive, not Simple. */
  function start(options) {
    const o = options || {};
    const n = within(o.rows, ROW_MIN, ROW_MAX) ? o.rows : 10;
    const modulo = within(o.modulo, MOD_MIN, MOD_MAX) ? o.modulo : 2;
    const op = o.op === MUL ? MUL : ADD;
    const simple = o.simple === true;
    return {
      n: n,
      modulo: modulo,
      op: op,
      simple: simple,
      digits: o.digits !== false,
      rows: blankRows(n, op),
      processed: new Array(n + 1).fill(0),
      stack: [],
      clicks: 0,
      computes: 0,
      done: false,
      note: "",
    };
  }

  /** Reset(): clear the dots, the cursor and the Undo stack. */
  function reset(state) {
    return {
      n: state.n, modulo: state.modulo, op: state.op, simple: state.simple,
      digits: state.digits, rows: blankRows(state.n, state.op),
      processed: new Array(state.n + 1).fill(0), stack: [],
      clicks: state.clicks, computes: state.computes, done: false,
      note: "Lattice cleared.",
    };
  }

  /** The panel ignores a typed number outside its range; the buttons stop there. */
  function setRows(state, value) {
    if (!within(value, ROW_MIN, ROW_MAX) || value === state.n) return state;
    return start({ rows: value, modulo: state.modulo, op: state.op, simple: state.simple, digits: state.digits });
  }

  function setModulo(state, value) {
    if (!within(value, MOD_MIN, MOD_MAX) || value === state.modulo) return state;
    return Object.assign({}, state, { modulo: value, note: "Colours now repeat every " + value + "." });
  }

  /** Pressing either operation sign, even the selected one, clears the lattice. */
  function setOp(state, op) {
    const next = op === MUL ? MUL : ADD;
    const switched = Object.assign({}, state, { op: next });
    const cleared = reset(switched);
    return Object.assign(cleared, {
      note: next === ADD ? "Adding numbers." : "Multiplying numbers.",
    });
  }

  /** itemStateChanged for Simple sets the flag and recomputes immediately. */
  function setSimple(state, flag) {
    const next = Object.assign({}, state, { simple: flag === true });
    return Object.assign(compute(next), { note: next.simple ? "Simple rule: leave out the 1." : "Full rule: include the 1." });
  }

  /** Numbers / Circles only change the drawing, never the arithmetic. */
  function setDigits(state, flag) {
    return Object.assign({}, state, { digits: flag !== false });
  }

  /** Dot.Hit + Dot.Update: a click on the left half subtracts 1, right adds 1. */
  function click(state, i, j, right) {
    if (!Number.isInteger(i) || i < 0 || i >= state.n) return state;
    if (!Number.isInteger(j) || j < 0 || j >= rowLength(state.n, i)) return state;
    const rows = cloneRows(state.rows);
    const old = rows[i][j];
    rows[i][j] = old + (right ? 1 : -1);
    return {
      n: state.n, modulo: state.modulo, op: state.op, simple: state.simple,
      digits: state.digits, rows: rows, processed: state.processed.slice(),
      stack: state.stack.concat([{ i: i, j: j, v: old }]),
      clicks: state.clicks + 1, computes: state.computes, done: false,
      note: "Dot " + (j + 1) + " on row " + (i + 1) + " is now " + rows[i][j] + ".",
    };
  }

  /** Undo(): restore the last click, disable Undo when empty, then Compute(). */
  function undo(state) {
    if (!state.stack.length) return state;
    const item = state.stack[state.stack.length - 1];
    const rows = cloneRows(state.rows);
    rows[item.i][item.j] = item.v;
    const restored = Object.assign({}, state, {
      rows: rows, stack: state.stack.slice(0, -1),
    });
    const after = compute(restored);
    return Object.assign(after, { note: "Undone. " + after.note });
  }

  /** Compute(): the applet's two nested scans, transcribed from its bytecode. */
  function compute(state) {
    const n = state.n, op = state.op, rows = cloneRows(state.rows);
    const processed = new Array(n + 1).fill(0);

    processed[0] = n;
    processed[n - 1] = n % 2 === 1 ? n : n - 1;

    for (let i = 1; i < n - 1; i++) {
      const limit = i % 2 === 0 ? n + 1 : n;
      processed[i] = 0;
      while (processed[i] < limit && rows[i][processed[i]] === op) processed[i]++;
      if (processed[i] === limit) processed[i] = limit - 1;
    }

    let done = false;
    let passes = 0;
    while (!done) {
      let advanced = false;
      for (let k = 1; k < n - 1; k++) {
        const p = processed[k];
        const limit = k % 2 === 0 ? n + 1 : n;
        if (p >= limit - 1) continue;
        if (k % 2 === 0) {
          if (processed[k - 1] >= p && processed[k + 1] >= p) {
            const value = computeValue(op, state.simple, rows[k - 1][p], rows[k][p], rows[k + 1][p]);
            processed[k] = p + 1;
            rows[k][processed[k]] = value;
            advanced = true;
          }
        } else if (processed[k - 1] > p && processed[k + 1] > p) {
          const value = computeValue(op, state.simple, rows[k - 1][p + 1], rows[k][p], rows[k + 1][p + 1]);
          processed[k] = p + 1;
          rows[k][processed[k]] = value;
          advanced = true;
        }
      }
      done = finished(n, processed);
      passes++;
      // The applet loops forever if no cursor can advance; a browser page
      // cannot. This guard is never reached for the seeded patterns we test.
      if (!advanced && !done) break;
      if (passes > 4 * n) break;
    }

    return {
      n: n, modulo: state.modulo, op: op, simple: state.simple,
      digits: state.digits, rows: rows, processed: processed,
      stack: state.stack.slice(), clicks: state.clicks,
      computes: state.computes + 1, done: done,
      note: done ? "Pattern computed." : "The pattern stalled; add another starting number.",
    };
  }

  return {
    ROW_MIN, ROW_MAX, MOD_MIN, MOD_MAX, ADD, MUL,
    start, reset, setRows, setModulo, setOp, setSimple, setDigits,
    click, undo, compute, computeValue, colorIndex, rowLength,
  };
})();
