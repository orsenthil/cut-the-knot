"use strict";

/*
 * Merlin's Magic Squares, from Alexander Bogomolny's applet Merlin.
 *
 * A 3 by 3 board of buttons, each with N states 0 .. N-1 (N = 2, 3 or 4)
 * that cycle round when pressed. Pressing a button also advances some other
 * buttons: which ones is the "geometry".
 *
 *   Plane   a corner advances itself, its two neighbours along the edges and
 *           the centre; a side button advances the three in its line along the
 *           edge; the centre advances itself and the four side buttons.
 *   Torus   every press advances the button, and all the others in its row and
 *           its column (the board wrapped round). Played with N = 3 only.
 *   Don't touch / Unknown   the hidden third set of rules.
 *
 * The aim is to make the board equal a target pattern (the ring of eight 1s
 * round a 0 to begin with, which can be edited). Numbering the buttons 0..8 row
 * by row, pressing button k adds column k of a matrix A to the board, so
 * target = board + A * s (all mod N) for the vector s of presses; A is
 * invertible mod N for the right N, so every board can be solved, and the hint
 * shows the unique s.
 *
 * The position is plain data:
 *   { n, geometry, values, target, hint, hintOn, stack }
 * with values, target and hint arrays of 9 and stack the presses made, most
 * recent last, each { cell, hint }.
 */
const MerlinCore = (() => {
  const NUM = 9;
  const PLANE = 0, TORUS = 1, MYSTERY = 2;

  /* The applet's three matrices: MATRIX[g][cell][pressed] is 1 when pressing `pressed` advances `cell`. */
  const MATRIX = [
    [[1,1,0,1,0,0,0,0,0],[1,1,1,0,1,0,0,0,0],[0,1,1,0,0,1,0,0,0],[1,0,0,1,1,0,1,0,0],[1,0,1,0,1,0,1,0,1],[0,0,1,0,1,1,0,0,1],[0,0,0,1,0,0,1,1,0],[0,0,0,0,1,0,1,1,1],[0,0,0,0,0,1,0,1,1]],
    [[1,1,1,1,0,0,1,0,0],[1,1,1,0,1,0,0,1,0],[1,1,1,0,0,1,0,0,1],[1,0,0,1,1,1,1,0,0],[0,1,0,1,1,1,0,1,0],[0,0,1,1,1,1,0,0,1],[1,0,0,1,0,0,1,1,1],[0,1,0,0,1,0,1,1,1],[0,0,1,0,0,1,1,1,1]],
    [[1,1,0,1,0,0,0,0,0],[1,1,1,0,1,0,0,0,0],[0,1,1,0,0,1,0,0,0],[1,0,0,1,1,0,1,0,0],[0,1,0,1,1,1,0,1,0],[0,0,1,0,1,1,0,0,1],[0,0,0,1,0,0,1,1,0],[0,0,0,0,1,0,1,1,1],[0,0,0,0,0,1,0,1,1]],
  ];
  /* The applet's integer inverses: INVERSE[g] times MATRIX[g] is det * the identity (det 5, 80 and -7). */
  const INVERSE = [
    [[-1,2,-1,2,2,-3,-1,-3,4],[3,-1,3,-1,-1,-1,-2,4,-2],[-1,2,-1,-3,2,2,4,-3,-1],[3,-1,-2,-1,-1,4,3,-1,-2],[-1,2,-1,2,-3,2,-1,2,-1],[-2,-1,3,4,-1,-1,-2,-1,3],[-1,-3,4,2,2,-3,-1,2,-1],[-2,4,-2,-1,-1,-1,3,-1,3],[4,-3,-1,-3,2,2,-1,2,-1]],
    [[-16,24,24,24,-16,-16,24,-16,-16],[24,-16,24,-16,24,-16,-16,24,-16],[24,24,-16,-16,-16,24,-16,-16,24],[24,-16,-16,-16,24,24,24,-16,-16],[-16,24,-16,24,-16,24,-16,24,-16],[-16,-16,24,24,24,-16,-16,-16,24],[24,-16,-16,24,-16,-16,-16,24,24],[-16,24,-16,-16,24,-16,24,-16,24],[-16,-16,24,-16,-16,24,24,24,-16]],
    [[1,-4,1,-4,2,3,1,3,-6],[-4,2,-4,2,-1,2,3,-5,3],[1,-4,1,3,2,-4,-6,3,1],[-4,2,3,2,-1,-5,-4,2,3],[2,-1,2,-1,-3,-1,2,-1,2],[3,2,-4,-5,-1,2,3,2,-4],[1,3,-6,-4,2,3,1,-4,1],[3,-5,3,2,-1,2,-4,2,-4],[-6,3,1,3,2,-4,1,-4,1]],
  ];
  /* The inverse of the determinant mod N, for N = 2, 3, 4 (the applet's InverseDet). */
  const INVERSE_DET = [1, 2, 1];
  const RING = [1, 1, 1, 1, 0, 1, 1, 1, 1];
  const NAMES = ["Plane", "Torus", "Don't touch"];

  const mod = (v, n) => ((v % n) + n) % n;
  const clampN = (n) => (n === 2 || n === 3 || n === 4 ? n : 3);

  /** A new random board in the same geometry and modulus: stack cleared, hint off, target the ring. */
  function reset(state, random = Math.random) {
    const n = state.n;
    return { n, geometry: state.geometry, values: Array.from({ length: NUM }, () => Math.floor(random() * n)), target: RING.map((v) => v % n), hint: Array(NUM).fill(0), hintOn: false, stack: [] };
  }

  /** The first position: plane, 3 states. */
  function start(options) {
    const o = options || {};
    return reset({ n: clampN(o.n === undefined ? 3 : o.n), geometry: PLANE }, o.random || Math.random);
  }

  /** A to be added to a board when `cell` is pressed: the column of the matrix, as a list of 9. */
  const pressVector = (geometry, cell) => MATRIX[geometry].map((row) => row[cell]);

  /** The board that goes with a hint: target - A * hint, mod N. */
  function valuesFromHint(state, hint = state.hint) {
    const M = MATRIX[state.geometry];
    return Array.from({ length: NUM }, (_, c) => mod(state.target[c] - hint.reduce((t, h, k) => t + M[c][k] * h, 0), state.n));
  }

  /** The presses that solve the board, by the applet's method: invDet * Inverse * (target - values), mod N. */
  function solve(state) {
    const { n, geometry } = state, I = INVERSE[geometry];
    const t = state.target.map((v, i) => mod(v - state.values[i], n));
    return Array.from({ length: NUM }, (_, r) => mod(INVERSE_DET[n - 2] * t.reduce((s, v, k) => s + I[r][k] * v, 0), n));
  }

  /** Press a button. With the hint on, the press changes the hint (and the board follows); else the board. */
  function press(state, cell) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= NUM) return null;
    const n = state.n, stack = state.stack.concat([{ cell, hint: state.hintOn }]);
    if (!state.hintOn) {
      const v = pressVector(state.geometry, cell);
      return { ...state, values: state.values.map((x, i) => mod(x + v[i], n)), stack };
    }
    const hint = state.hint.map((h, i) => (i === cell ? mod(h + 1, n) : h));
    return { ...state, hint, values: valuesFromHint(state, hint), stack };
  }

  /** Take back the last press (the applet's Undo). null when there is nothing to undo. */
  function undo(state) {
    if (state.stack.length === 0) return null;
    const last = state.stack[state.stack.length - 1], stack = state.stack.slice(0, -1), n = state.n;
    // the hint setting the press was made with comes back, without recomputing anything
    const s = { ...state, hintOn: last.hint, stack };
    if (!last.hint) {
      const v = pressVector(state.geometry, last.cell);
      return { ...s, values: state.values.map((x, i) => mod(x - v[i], n)) };
    }
    const hint = state.hint.map((h, i) => (i === last.cell ? mod(h - 1, n) : h));
    return { ...s, hint, values: valuesFromHint(s, hint) };
  }

  /** The Hint box ticked or cleared. */
  function setHint(state, on) {
    if (on) return { ...state, hintOn: true, hint: solve(state) };
    return { ...state, hintOn: false, values: valuesFromHint(state) };
  }

  /** Click a square of the target: its state goes up by one. Keeps the board and brings the hint up to date. */
  function editTarget(state, cell) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= NUM) return null;
    const target = state.target.map((v, i) => (i === cell ? mod(v + 1, state.n) : v));
    const s = { ...state, target };
    return state.hintOn ? { ...s, hint: solve(s) } : s;
  }

  /** Change the number of states (a new board). Refused (null) for the torus, which is played with 3. */
  function setModulus(state, n, random) {
    if (!(n === 2 || n === 3 || n === 4)) return null;
    if (state.geometry === TORUS && n !== 3) return null;
    return reset({ n, geometry: state.geometry }, random);
  }

  /** Change the geometry (a new board). The torus goes to 3 states, as in the applet. */
  function setGeometry(state, g, random) {
    if (!(g === PLANE || g === TORUS || g === MYSTERY)) return null;
    return reset({ n: g === TORUS ? 3 : state.n, geometry: g }, random);
  }

  const solved = (state) => state.values.every((v, i) => v === state.target[i]);
  const result = (state) => (solved(state) ? "win" : null);

  return { NUM, PLANE, TORUS, MYSTERY, MATRIX, INVERSE, INVERSE_DET, RING, NAMES, clampN, start, reset, pressVector, valuesFromHint, solve, press, undo, setHint, editTarget, setModulus, setGeometry, solved, result };
})();
