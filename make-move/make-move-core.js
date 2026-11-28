"use strict";

/*
 * Make Your Move, Kid! — a 4x4 sliding-letter puzzle, from Bogomolny's
 * MakeMove applet. The sixteen squares hold the letters of MAKE / YOUR /
 * MOVE, / KID! read down the four columns, plus one empty square. Pressing
 * Reset restores that board and then swaps the two last counters (R and E,),
 * exactly as the applet's Cheat() does.
 *
 * The key idea is the parity of inversions in the tile order: a slide is a
 * sequence of swaps of the empty square with a neighbour, so it never changes
 * that parity. The two O counters are interchangeable, and putting them in
 * the other order changes the parity, so the swapped board can still spell
 * the message. (The applet's own finished test is broken — see the math text;
 * this core uses the test the page describes.)
 *
 * DOM-free logic only: no document, no window, no storage. One global,
 * MakeMoveCore. Positions are plain data and every function returns a new
 * position rather than changing the one it is given.
 */
const MakeMoveCore = (() => {
  const N = 4;
  const SQUARE = N * N;
  const LETTERS = ["M", "A", "K", "E", "Y", "O", "U", "R", "M", "O", "V", "E,", "K", "I", "D!"];

  /** ToString(v) in the applet: v = 1..15 are the counters, 16 is the gap. */
  function label(value) {
    return LETTERS[value - 1] || "";
  }

  /** The grid the applet's ResetArray() builds: values[column][row]. */
  function solvedGrid(n) {
    const size = n || N;
    const a = [];
    for (let c = 0; c < size; c++) {
      a[c] = [];
      for (let r = 0; r < size; r++) a[c][r] = c * size + r + 1;
    }
    return a;
  }

  /** The applet's Cheat(): swap the two last counters of the board. */
  function cheat(a, n) {
    const size = n || N;
    const sq = size * size;
    let k = size - 1;
    if (a[size - 3][size - 1] === sq || a[size - 2][size - 1] === sq) k = size - 2;
    const tmp = a[size - 3][k];
    a[size - 3][k] = a[size - 2][k];
    a[size - 2][k] = tmp;
    return a;
  }

  function position(a, n, moves, last) {
    return { n: n || N, values: a, moves: moves || 0, last: last || null };
  }

  /** The board when the page opens: the message is already spelled out. */
  function start(options) {
    const n = (options && options.n) || N;
    return position(solvedGrid(n), n, 0, null);
  }

  /** The Reset button: ResetArray() followed by Cheat(). */
  function reset(options) {
    const n = (options && options.n) || N;
    return position(cheat(solvedGrid(n), n), n, 0, null);
  }

  /** The empty square, as { x: column, y: row }. */
  function emptyCell(state) {
    const n = state.n, sq = n * n;
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) if (state.values[c][r] === sq) return { x: c, y: r };
    }
    return null;
  }

  /** The cells that can be pressed: same row or column as the gap. */
  function legalMoves(state) {
    const gap = emptyCell(state), out = [];
    if (!gap) return out;
    for (let c = 0; c < state.n; c++) {
      for (let r = 0; r < state.n; r++) {
        if ((c === gap.x || r === gap.y) && !(c === gap.x && r === gap.y)) out.push({ x: c, y: r });
      }
    }
    return out;
  }

  /*
   * Shift() from the applet. Clicking (x,y) in the gap's column slides the
   * whole run of counters between them one square towards the gap; clicking
   * in its row does the same horizontally. A click off the row and column,
   * or on the gap itself, does nothing.
   */
  function move(state, cell) {
    if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) return null;
    const n = state.n, sq = n * n;
    if (cell.x < 0 || cell.x >= n || cell.y < 0 || cell.y >= n) return null;
    const a = state.values.map((row) => row.slice());
    const gap = emptyCell(state);
    if (!gap) return null;
    const bx = gap.x, by = gap.y, cx = cell.x, cy = cell.y;
    if (cx === bx && cy === by) return null;

    if (cx === bx) {
      if (cy > by) {
        for (let t = by; t < cy; t++) a[bx][t] = a[bx][t + 1]; // ShiftTop
      } else {
        for (let t = by; t > cy; t--) a[bx][t] = a[bx][t - 1]; // ShiftBottom
      }
      a[bx][cy] = sq;
    } else if (cy === by) {
      if (cx > bx) {
        for (let t = bx; t < cx; t++) a[t][by] = a[t + 1][by]; // ShiftLeft
      } else {
        for (let t = bx; t > cx; t--) a[t][by] = a[t - 1][by]; // ShiftRight
      }
      a[cx][by] = sq;
    } else {
      return null;
    }
    return position(a, n, state.moves + 1, { x: cx, y: cy });
  }

  /*
   * The intended finished test: the message in order, or the same message
   * with the two identical O counters traded. The second alternative is the
   * one the page says makes the swapped board solvable. Swapping the two M's
   * does NOT count, even though the letters then look identical.
   */
  function isSolved(values, n) {
    const size = n || N;
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (size === N && c === 1 && r === 1 && values[c][r] === 10) continue;
        if (size === N && c === 2 && r === 1 && values[c][r] === 6) continue;
        if (values[c][r] !== c * size + r + 1) return false;
      }
    }
    return true;
  }

  /** "done" when the message has been put back; there is no win or loss. */
  function result(state) {
    return state.moves > 0 && isSolved(state.values, state.n) ? "done" : null;
  }

  /** Inversions in tile order (column by column, as in the Java array). */
  function inversions(values, n) {
    const size = n || N, sq = size * size, seq = [];
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) if (values[c][r] !== sq) seq.push(values[c][r]);
    }
    let count = 0;
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) count++;
    }
    return count;
  }

  /** Letters of the counters that changed in a slide, for the status line. */
  function changed(before, after, n) {
    const size = n || N, sq = size * size, out = [];
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) {
        if (before[c][r] !== after[c][r] && after[c][r] !== sq) out.push(label(after[c][r]));
      }
    }
    return out;
  }

  return {
    N: N,
    SQUARE: SQUARE,
    label: label,
    solvedGrid: solvedGrid,
    cheat: cheat,
    start: start,
    reset: reset,
    emptyCell: emptyCell,
    legalMoves: legalMoves,
    move: move,
    isSolved: isSolved,
    result: result,
    inversions: inversions,
    changed: changed,
  };
})();
