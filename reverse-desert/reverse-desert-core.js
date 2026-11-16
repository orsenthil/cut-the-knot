"use strict";

/*
 * Getting a Scout out of Desert (ReverseDesert), from Alexander Bogomolny's
 * applet ReverseDesert.
 *
 * The board has a desert strip on top (Level rows) and habitable land below
 * (Y rows). Start with one scout at the top centre. A move selects a scout
 * and jumps it two steps orthogonally onto an empty cell over an empty mid:
 * the scout leaves its old cell, lands on the target, and a new scout appears
 * in the middle — the reverse of an ordinary capturing jump.
 *
 * Win when the desert (rows 0 .. Level−1) holds no scouts.
 *
 * Options: X 4–10 (default 6), Y 3–10 (default 3), Level 2–5 (default 2).
 * Set position toggles the starting layout; Take back undoes jumps.
 */
const ReverseDesertCore = (() => {
  const MIN_X = 4, MAX_X = 10, DEFAULT_X = 6;
  const MIN_Y = 3, MAX_Y = 10, DEFAULT_Y = 3;
  const MIN_LEVEL = 2, MAX_LEVEL = 5, DEFAULT_LEVEL = 2;
  const EMPTY = 0, SCOUT = 1, SELECTED = 2;

  function clamp(n, lo, hi, dflt) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = dflt;
    return Math.max(lo, Math.min(hi, n));
  }

  function emptyBoard(cols, rows) {
    const b = [];
    for (let x = 0; x < cols; x++) {
      b[x] = [];
      for (let y = 0; y < rows; y++) b[x][y] = EMPTY;
    }
    return b;
  }

  function copyBoard(b) {
    return b.map((col) => col.slice());
  }

  function defaultStarting(cols, rows, level) {
    const s = emptyBoard(cols, rows);
    s[Math.floor(cols / 2)][0] = SCOUT;
    return s;
  }

  function start(options = {}) {
    const cols = clamp(options.cols ?? DEFAULT_X, MIN_X, MAX_X, DEFAULT_X);
    const habitable = clamp(options.habitable ?? DEFAULT_Y, MIN_Y, MAX_Y, DEFAULT_Y);
    const level = clamp(options.level ?? DEFAULT_LEVEL, MIN_LEVEL, MAX_LEVEL, DEFAULT_LEVEL);
    const rows = habitable + level;
    let starting;
    if (Array.isArray(options.starting)) {
      starting = copyBoard(options.starting);
    } else {
      starting = defaultStarting(cols, rows, level);
    }
    return {
      cols,
      habitable,
      level,
      rows,
      board: copyBoard(starting),
      starting: copyBoard(starting),
      selected: null,
      history: [],
      setting: !!options.setting,
      won: false,
    };
  }

  function inBounds(state, x, y) {
    return x >= 0 && y >= 0 && x < state.cols && y < state.rows;
  }

  function desertClear(state) {
    for (let x = 0; x < state.cols; x++) {
      for (let y = 0; y < state.level; y++) {
        if (state.board[x][y] === SCOUT || state.board[x][y] === SELECTED) return false;
      }
    }
    return true;
  }

  function clearSelection(state) {
    if (!state.selected) return state;
    const board = copyBoard(state.board);
    const { x, y } = state.selected;
    if (board[x][y] === SELECTED) board[x][y] = SCOUT;
    return Object.assign({}, state, { board, selected: null });
  }

  /** Toggle a cell while Set position is on (ResetPos). */
  function toggleStart(state, x, y) {
    if (!state.setting || !inBounds(state, x, y)) return state;
    const board = copyBoard(state.board);
    const starting = copyBoard(state.starting);
    if (board[x][y] === EMPTY) {
      board[x][y] = SCOUT;
      starting[x][y] = SCOUT;
    } else if (starting[x][y] === SCOUT) {
      board[x][y] = EMPTY;
      starting[x][y] = EMPTY;
    } else {
      return state;
    }
    return Object.assign({}, state, { board, starting, selected: null, history: [], won: false });
  }

  /**
   * Click cell (x,y): select a scout, or complete a reverse-jump, or deselect.
   * Returns the new state (MakeMove).
   */
  function click(state, x, y) {
    if (state.won) return state;
    if (state.setting) return toggleStart(state, x, y);
    if (!inBounds(state, x, y)) return state;

    if (!state.selected) {
      if (state.board[x][y] !== SCOUT) return state;
      const board = copyBoard(state.board);
      board[x][y] = SELECTED;
      return Object.assign({}, state, { board, selected: { x, y } });
    }

    const { x: sx, y: sy } = state.selected;
    const mx = (sx + x) >> 1;
    const my = (sy + y) >> 1;
    const manhattan = Math.abs(sx - x) + Math.abs(sy - y);
    const board = copyBoard(state.board);

    if (
      board[x][y] === EMPTY &&
      manhattan === 2 &&
      board[mx][my] === EMPTY
    ) {
      board[sx][sy] = EMPTY;
      board[x][y] = SCOUT;
      board[mx][my] = SCOUT;
      const history = state.history.concat([{ from: { x: sx, y: sy }, to: { x, y } }]);
      const next = Object.assign({}, state, {
        board,
        selected: null,
        history,
      });
      if (desertClear(next)) next.won = true;
      return next;
    }

    // Illegal target: deselect
    board[sx][sy] = SCOUT;
    return Object.assign({}, state, { board, selected: null });
  }

  function undo(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    const last = history.pop();
    const board = copyBoard(state.board);
    const mx = (last.from.x + last.to.x) >> 1;
    const my = (last.from.y + last.to.y) >> 1;
    board[last.to.x][last.to.y] = EMPTY;
    board[last.from.x][last.from.y] = SCOUT;
    board[mx][my] = EMPTY;
    return Object.assign({}, state, {
      board,
      history,
      selected: null,
      won: false,
    });
  }

  function reset(state) {
    return Object.assign({}, state, {
      board: copyBoard(state.starting),
      selected: null,
      history: [],
      won: false,
      setting: false,
    });
  }

  function setDims(state, dims) {
    const cols = clamp(dims.cols ?? state.cols, MIN_X, MAX_X, DEFAULT_X);
    const habitable = clamp(dims.habitable ?? state.habitable, MIN_Y, MAX_Y, DEFAULT_Y);
    const level = clamp(dims.level ?? state.level, MIN_LEVEL, MAX_LEVEL, DEFAULT_LEVEL);
    return start({ cols, habitable, level });
  }

  function setSetting(state, on) {
    return Object.assign({}, clearSelection(state), { setting: !!on });
  }

  function result(state) {
    return state.won ? "win" : null;
  }

  function scoutCount(state) {
    let n = 0;
    for (let x = 0; x < state.cols; x++) {
      for (let y = 0; y < state.rows; y++) {
        if (state.board[x][y] === SCOUT || state.board[x][y] === SELECTED) n++;
      }
    }
    return n;
  }

  function legalMoves(state) {
    const out = [];
    const deltas = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ];
    for (let x = 0; x < state.cols; x++) {
      for (let y = 0; y < state.rows; y++) {
        if (state.board[x][y] !== SCOUT && state.board[x][y] !== SELECTED) continue;
        for (const [dx, dy] of deltas) {
          const tx = x + dx;
          const ty = y + dy;
          const mx = x + dx / 2;
          const my = y + dy / 2;
          if (!inBounds(state, tx, ty)) continue;
          if (state.board[tx][ty] !== EMPTY) continue;
          if (state.board[mx][my] !== EMPTY) continue;
          out.push({ from: { x, y }, to: { x: tx, y: ty } });
        }
      }
    }
    return out;
  }

  function snapshot(state) {
    return {
      cols: state.cols,
      habitable: state.habitable,
      level: state.level,
      board: copyBoard(state.board),
      starting: copyBoard(state.starting),
      historyLength: state.history.length,
      won: state.won,
    };
  }

  function restore(snap) {
    const cols = clamp(snap.cols, MIN_X, MAX_X, DEFAULT_X);
    const habitable = clamp(snap.habitable, MIN_Y, MAX_Y, DEFAULT_Y);
    const level = clamp(snap.level, MIN_LEVEL, MAX_LEVEL, DEFAULT_LEVEL);
    const rows = habitable + level;
    const board = snap.board ? copyBoard(snap.board) : defaultStarting(cols, rows, level);
    const starting = snap.starting ? copyBoard(snap.starting) : copyBoard(board);
    return {
      cols,
      habitable,
      level,
      rows,
      board,
      starting,
      selected: null,
      history: [],
      setting: false,
      won: !!snap.won,
    };
  }

  return {
    MIN_X, MAX_X, DEFAULT_X,
    MIN_Y, MAX_Y, DEFAULT_Y,
    MIN_LEVEL, MAX_LEVEL, DEFAULT_LEVEL,
    EMPTY, SCOUT, SELECTED,
    start,
    desertClear,
    click,
    undo,
    reset,
    setDims,
    setSetting,
    result,
    scoutCount,
    legalMoves,
    snapshot,
    restore,
  };
})();
