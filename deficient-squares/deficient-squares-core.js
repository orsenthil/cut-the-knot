"use strict";

/*
 * Deficient Squares - the logic, transcribed from the applet TrominoPuzzleN.
 *
 * Golomb's theorem tiles a 2^n by 2^n board with one square removed. Chu and
 * Johnsonbaugh asked the same question for a square board of any side n: when
 * can a deficient n by n board be tiled by L-trominoes?
 *
 * The applet lets the player try any side from 2 to 24, so some of the boards
 * it offers cannot be tiled at all. This core keeps the applet's rules and
 * adds two facts the page can use without searching:
 *
 *   - a board whose area n^2 - 1 is not a multiple of 3 cannot be tiled,
 *     because every L covers 3 squares; that is every n divisible by 3;
 *   - for n = 5 the gap must lie on an even row and an even column - one of
 *     the four corners or the centre - and then the board tiles;
 *   - for every other n not divisible by 3 the theorem says every gap works.
 *
 * The applet's rules, from TrominoPuzzleNCanvas.mouseClicked and
 * TrominoPuzzleNCanvas$TroBlock, are the same as the 2^n applet's:
 *
 *   - a click on the gap, on a covered square, or outside the board does
 *     nothing;
 *   - the first free click starts a piece; the second must be edge-adjacent
 *     to it; the third must be edge-adjacent to the second and must not lie
 *     in a straight line, so the three squares form an L;
 *   - a bad second or third click throws the unfinished piece away;
 *   - "Set blank" moves the gap and clears the board;
 *   - "Remove last" takes back the most recent piece.
 *
 * The applet has no win test: completion is judged by looking. This core adds
 * the obvious test - every square except the gap is covered - so the player's
 * record can see the win.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, DeficientSquaresCore, so the page loads it
 * with a plain <script> and porting/check-deficient-squares.mjs loads it in
 * Node. Positions are plain data and functions never change what they are
 * given.
 */
const DeficientSquaresCore = (() => {
  // The panel's spinner: model 5, minimum 2, maximum 24, step 1.
  const MIN_N = 2;
  const MAX_N = 24;
  const DEFAULT_N = 5;

  // The four L orientations, named by the corner of their 2x2 box they miss.
  // The applet's Types 0..3 select the four colours in the same way.
  const UL = 0, UR = 1, LR = 2, LL = 3;

  function clampN(n) {
    const v = Math.trunc(Number(n));
    if (!Number.isFinite(v)) return DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, v));
  }

  const key = (row, col) => row + "," + col;
  const same = (a, b) => a.row === b.row && a.col === b.col;

  function inBoard(state, row, col) {
    return row >= 0 && row < state.n && col >= 0 && col < state.n;
  }

  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

  /** The set of covered cells, as "row,col" strings. */
  function coveredSet(state) {
    const set = new Set();
    for (const p of state.pieces) for (const c of p.cells) set.add(key(c.row, c.col));
    return set;
  }

  function coveredCount(state) {
    return state.pieces.length * 3;
  }

  function isFree(state, row, col) {
    if (!inBoard(state, row, col)) return false;
    if (row === state.blank.row && col === state.blank.col) return false;
    return !coveredSet(state).has(key(row, col));
  }

  /**
   * The orientation of an L, as the corner of its 2x2 box it leaves empty.
   * Returns null when the three cells are not an L.
   */
  function orientation(cells) {
    if (!Array.isArray(cells) || cells.length !== 3) return null;
    const seen = new Set();
    for (const c of cells) {
      if (!c || !Number.isInteger(c.row) || !Number.isInteger(c.col)) return null;
      const k = key(c.row, c.col);
      if (seen.has(k)) return null;
      seen.add(k);
    }
    const rows = cells.map((c) => c.row);
    const cols = cells.map((c) => c.col);
    const r0 = Math.min(...rows), r1 = Math.max(...rows);
    const c0 = Math.min(...cols), c1 = Math.max(...cols);
    // An L fits a 2x2 box: the three cells must be the box minus one corner.
    if (r1 - r0 !== 1 || c1 - c0 !== 1) return null;
    const box = [
      { row: r0, col: c0, which: UL },
      { row: r0, col: c1, which: UR },
      { row: r1, col: c1, which: LR },
      { row: r1, col: c0, which: LL },
    ];
    const missing = box.filter((b) => !seen.has(key(b.row, b.col)));
    return missing.length === 1 ? missing[0].which : null;
  }

  /** The applet's consistency test: each click adjacent to the last, and an L. */
  function isLPath(cells) {
    if (!Array.isArray(cells) || cells.length !== 3) return false;
    if (same(cells[0], cells[1]) || same(cells[1], cells[2])) return false;
    if (!adjacent(cells[0], cells[1]) || !adjacent(cells[1], cells[2])) return false;
    const rows = new Set(cells.map((c) => c.row));
    const cols = new Set(cells.map((c) => c.col));
    if (rows.size === 1 || cols.size === 1) return false; // a straight tromino
    return orientation(cells) !== null;
  }

  /** Order three L cells as a click path: arm, corner, arm. */
  function pathOrder(cells) {
    if (!cells || cells.length !== 3) return null;
    if (isLPath(cells)) return cells;
    for (let i = 0; i < 3; i++) {
      const corner = cells[i];
      const others = cells.filter((_, j) => j !== i);
      if (adjacent(corner, others[0]) && adjacent(corner, others[1])) {
        const a = others[0], b = others[1];
        // The arms must be perpendicular: one across, one down.
        if ((a.row === corner.row) !== (b.row === corner.row) &&
            (a.col === corner.col) !== (b.col === corner.col)) {
          return [a, corner, b];
        }
      }
    }
    return null;
  }

  /**
   * Can a deficient n by n board with this gap be tiled at all? This is the
   * Chu-Johnsonbaugh classification, not a search, so it works for every side
   * the panel offers. The cases below are checked exhaustively for n up to 7
   * in porting/check-deficient-squares.mjs.
   */
  function tileable(n, blank) {
    const side = clampN(n);
    if (side % 3 === 0) return false; // the area left is not a multiple of 3
    if (side === 5) {
      // Only the four corners and the centre of a 5x5 board work.
      return blank.row % 2 === 0 && blank.col % 2 === 0;
    }
    return true; // n = 2, 4 and every n >= 7 not divisible by 3
  }

  /**
   * A new position. The page supplies a random missing square, as the applet
   * does; tests and the tutor get (0,0) unless they ask for another cell.
   */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n == null ? DEFAULT_N : o.n);
    const blank = o.blank || {};
    let row = Number.isFinite(Number(blank.row)) ? Math.trunc(Number(blank.row)) : 0;
    let col = Number.isFinite(Number(blank.col)) ? Math.trunc(Number(blank.col)) : 0;
    row = Math.max(0, Math.min(n - 1, row));
    col = Math.max(0, Math.min(n - 1, col));
    return {
      n,
      blank: { row, col },
      mode: o.mode === "blank" ? "blank" : "play",
      pieces: [],
      pending: [],
    };
  }

  /**
   * One click, with the applet's effect. Returns the new position and what
   * happened: "ignored", "cancelled", "started", "extended", "placed" or
   * "blank" (the gap moved).
   */
  function click(state, row, col) {
    const nop = (effect) => ({ state, effect });
    if (!inBoard(state, row, col)) return nop("ignored");
    if (row === state.blank.row && col === state.blank.col) {
      return state.pending.length ? { state: { ...state, pending: [] }, effect: "cancelled" } : nop("ignored");
    }
    if (state.mode === "blank") {
      return { state: { ...state, blank: { row, col } }, effect: "blank" };
    }
    if (!isFree(state, row, col)) {
      return state.pending.length ? { state: { ...state, pending: [] }, effect: "cancelled" } : nop("ignored");
    }

    const cell = { row, col };
    const pending = state.pending;
    if (pending.length === 0) {
      return { state: { ...state, pending: [cell] }, effect: "started" };
    }
    if (pending.length === 1) {
      if (!adjacent(pending[0], cell)) {
        return { state: { ...state, pending: [] }, effect: "cancelled" };
      }
      return { state: { ...state, pending: [pending[0], cell] }, effect: "extended" };
    }

    // Third click: the applet drops the whole piece on any inconsistency.
    const cells = [pending[0], pending[1], cell];
    if (!isLPath(cells)) {
      return { state: { ...state, pending: [] }, effect: "cancelled" };
    }
    return {
      state: {
        ...state,
        pending: [],
        pieces: state.pieces.concat([{ cells, type: orientation(cells) }]),
      },
      effect: "placed",
    };
  }

  /** Put a piece down directly (used by the tests and the tutor). */
  function place(state, cells) {
    const list = pathOrder((cells || []).map((c) => ({ row: Math.trunc(Number(c.row)), col: Math.trunc(Number(c.col)) })));
    if (!list) return null;
    for (const c of list) if (!isFree(state, c.row, c.col)) return null;
    return {
      ...state,
      pending: [],
      pieces: state.pieces.concat([{ cells: list, type: orientation(list) }]),
    };
  }

  /** "Remove last": the applet's Pop, including its behaviour on an empty stack. */
  function removeLast(state) {
    if (!state.pieces.length) return null;
    return { ...state, pieces: state.pieces.slice(0, -1), pending: [] };
  }

  /** Enter "Set blank" (which clears the board) or go back to "Play". */
  function setMode(state, mode) {
    if (mode !== "play" && mode !== "blank") return null;
    if (mode === state.mode) return state;
    if (mode === "blank") return { ...state, mode, pieces: [], pending: [] };
    return { ...state, mode, pending: [] };
  }

  /** Move the missing square. */
  function setBlank(state, row, col) {
    if (!inBoard(state, row, col)) return null;
    return { ...state, blank: { row, col } };
  }

  /** Drop the unfinished piece, as a click on the gap or a bad click does. */
  function cancel(state) {
    return state.pending.length ? { ...state, pending: [] } : state;
  }

  /**
   * Is there room for one more L? Four Ls stand on each free cell as their
   * corner, so this is a quick scan of every free cell.
   */
  function canPlace(state) {
    const set = coveredSet(state);
    const free = (r, c) => inBoard(state, r, c) &&
      !(r === state.blank.row && c === state.blank.col) && !set.has(key(r, c));
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (!free(r, c)) continue;
        if (free(r, c + 1) && free(r + 1, c)) return true;
        if (free(r, c + 1) && free(r - 1, c)) return true;
        if (free(r, c - 1) && free(r + 1, c)) return true;
        if (free(r, c - 1) && free(r - 1, c)) return true;
      }
    }
    return false;
  }

  /** The number of pieces a full tiling needs, or null when there is none. */
  function piecesNeeded(n) {
    const side = clampN(n);
    const left = side * side - 1;
    return left % 3 === 0 ? left / 3 : null;
  }

  /** "win" once every square but the missing one is covered. */
  function result(state) {
    const needed = piecesNeeded(state.n);
    return needed !== null && state.pieces.length === needed && state.pending.length === 0 ? "win" : null;
  }

  function legalMoves(state) {
    const moves = [];
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (isFree(state, r, c)) moves.push({ type: "click", row: r, col: c });
      }
    }
    if (state.pieces.length) moves.push({ type: "remove" });
    moves.push({ type: "reset" });
    return moves;
  }

  function move(state, m) {
    if (!state || !m) return null;
    switch (m.type) {
      case "click": {
        if (!Number.isInteger(m.row) || !Number.isInteger(m.col)) return null;
        return click(state, m.row, m.col).state;
      }
      case "place":
        return place(state, m.cells);
      case "remove":
        return removeLast(state);
      case "blank":
        return setBlank(state, m.row, m.col);
      case "mode":
        return setMode(state, m.mode);
      default:
        return null;
    }
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, UL, UR, LR, LL,
    clampN, coveredSet, coveredCount, isFree, orientation, isLPath, pathOrder,
    tileable, start, click, place, removeLast, setMode, setBlank, cancel,
    canPlace, piecesNeeded, result, legalMoves, move,
  };
})();
