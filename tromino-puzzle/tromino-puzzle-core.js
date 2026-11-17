"use strict";

/*
 * Tromino Puzzle - the logic, transcribed from the applet TrominoPuzzle.
 *
 * Golomb's theorem says a 2^n by 2^n board with one square removed can always
 * be tiled by L-trominoes, three squares in an L. This applet is the manual
 * version: choose the missing square, then place pieces yourself, three
 * clicks to a piece. The page notes that careless play leaves one- and
 * two-square pockets, and that is exactly the game: cover every free square
 * without trapping yourself.
 *
 * The applet's rules, from TrominoPuzzleCanvas.mouseClicked and
 * TrominoPuzzleCanvas$TroBlock:
 *
 *   - a click on the missing square, on a covered square, or outside the
 *     board does nothing;
 *   - the first free click starts a piece; the second must be edge-adjacent
 *     to it; the third must be edge-adjacent to the second and must not lie
 *     in a straight line with the other two, so the three squares form an L;
 *   - a bad second or third click throws the unfinished piece away;
 *   - "Set blank" moves the missing square and clears the board;
 *   - "Remove last" takes back the most recent piece.
 *
 * The applet has no win test and never announces one: completion is judged by
 * looking. This core adds the obvious test, so the player's record can see the
 * win: every square except the missing one is covered.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, TrominoPuzzleCore, so the page loads it with
 * a plain <script> and porting/check-tromino-puzzle.mjs loads it in Node.
 * Positions are plain data and functions never change what they are given.
 */
const TrominoPuzzleCore = (() => {
  // The panel's PVNumeric: min 1, max 5, default 3. The board is 2^exp square.
  const MIN_EXP = 1;
  const MAX_EXP = 5;
  const DEFAULT_EXP = 3;

  // The four L orientations, named by the corner of their 2x2 box they miss.
  // The applet's Types 0..3 select the four colours in the same way.
  const UL = 0, UR = 1, LR = 2, LL = 3;

  function clampExp(exp) {
    const e = Math.trunc(Number(exp));
    if (!Number.isFinite(e)) return DEFAULT_EXP;
    return Math.max(MIN_EXP, Math.min(MAX_EXP, e));
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
    const set = coveredSet(state);
    return !set.has(key(row, col));
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
    if (cells.length !== 3) return false;
    if (same(cells[0], cells[1]) || same(cells[1], cells[2])) return false;
    if (!adjacent(cells[0], cells[1]) || !adjacent(cells[1], cells[2])) return false;
    const rows = new Set(cells.map((c) => c.row));
    const cols = new Set(cells.map((c) => c.col));
    if (rows.size === 1 || cols.size === 1) return false; // a straight tromino
    return orientation(cells) !== null;
  }

  /**
   * A new position. The page supplies a random missing square, as the applet
   * does; tests and the tutor get (0,0) unless they ask for another cell.
   */
  function start(options) {
    const o = options || {};
    const exp = clampExp(o.exp == null ? DEFAULT_EXP : o.exp);
    const n = 2 ** exp;
    const blank = o.blank || {};
    let row = Number.isFinite(Number(blank.row)) ? Math.trunc(Number(blank.row)) : 0;
    let col = Number.isFinite(Number(blank.col)) ? Math.trunc(Number(blank.col)) : 0;
    row = Math.max(0, Math.min(n - 1, row));
    col = Math.max(0, Math.min(n - 1, col));
    return {
      exp,
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
   * "blank" (the missing square moved).
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

  /** Drop the unfinished piece, as a click on the gap or a bad click does. */
  function cancel(state) {
    return state.pending.length ? { ...state, pending: [] } : state;
  }

  /** Move the missing square. The applet clears the board when Set is chosen. */
  function setBlank(state, row, col) {
    if (!inBoard(state, row, col)) return null;
    return { ...state, blank: { row, col } };
  }

  /**
   * Is there room for one more L? The applet leaves you to notice a pocket;
   * the page can say so plainly. Four Ls stand on each free cell as their
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

  /** "win" once every square but the missing one is covered. */
  function result(state) {
    const needed = (state.n * state.n - 1) / 3;
    return state.pieces.length === needed && state.pending.length === 0 ? "win" : null;
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
    MIN_EXP, MAX_EXP, DEFAULT_EXP, UL, UR, LR, LL,
    clampExp, coveredSet, coveredCount, isFree, orientation, isLPath, pathOrder,
    start, click, place, removeLast, setMode, setBlank, cancel,
    canPlace, result, legalMoves, move,
  };
})();
