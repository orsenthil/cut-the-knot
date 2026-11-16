"use strict";

/*
 * Jumping Isn't Everything (PigeonCheckers), from Alexander Bogomolny's applet.
 *
 * On an N×(N+1) board, counters start in a triangle on the left. A move jumps
 * a counter over an adjacent neighbour (orthogonal distance 2, or diagonal
 * (±2,±2)) onto an empty cell; the jumped counter stays. The page asks whether
 * every counter can reach the right half — and proves it cannot.
 */
const PigeonCheckersCore = (() => {
  const EMPTY = 0;
  const PEG = 1;
  const SELECTED = 2;
  const MIN_N = 2;
  const MAX_N = 20;
  const DEFAULT_N = 5;

  function clampN(n) {
    const v = Number.isInteger(n) ? n : DEFAULT_N;
    if (v < MIN_N) return MIN_N;
    if (v > MAX_N) return MAX_N;
    return v;
  }

  /** Initial triangle: column x, row y has a peg iff y < N − x. */
  function initialBoard(n) {
    const N = clampN(n);
    const cols = N + 1;
    const rows = N;
    const board = [];
    for (let x = 0; x < cols; x++) {
      board[x] = [];
      for (let y = 0; y < rows; y++) {
        board[x][y] = y < N - x ? PEG : EMPTY;
      }
    }
    return board;
  }

  function copyBoard(board) {
    return board.map((col) => col.slice());
  }

  function start(options) {
    const n = clampN(options && options.n);
    const board = initialBoard(n);
    return {
      n,
      cols: n + 1,
      rows: n,
      board,
      selected: null,
      history: [],
      showHint: false,
    };
  }

  function cell(state, x, y) {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return -1;
    return state.board[x][y];
  }

  function isPeg(v) {
    return v === PEG || v === SELECTED;
  }

  /**
   * MakeMove's distance test: sqrt(di²+dj²)==2, or |di|==2 and |dj|==2.
   * Midpoint must hold a peg. Jumped peg is not removed.
   */
  function canJump(state, fx, fy, tx, ty) {
    if (!isPeg(cell(state, fx, fy))) return false;
    if (cell(state, tx, ty) !== EMPTY) return false;
    const di = tx - fx;
    const dj = ty - fy;
    const dist2 = di * di + dj * dj;
    const ok = dist2 === 4 || (Math.abs(di) === 2 && Math.abs(dj) === 2);
    if (!ok) return false;
    const mx = (fx + tx) >> 1;
    const my = (fy + ty) >> 1;
    return cell(state, mx, my) === PEG || cell(state, mx, my) === SELECTED;
  }

  function legalMoves(state) {
    const moves = [];
    const deltas = [
      [2, 0], [-2, 0], [0, 2], [0, -2],
      [2, 2], [2, -2], [-2, 2], [-2, -2],
    ];
    for (let x = 0; x < state.cols; x++) {
      for (let y = 0; y < state.rows; y++) {
        if (!isPeg(cell(state, x, y))) continue;
        for (const [dx, dy] of deltas) {
          if (canJump(state, x, y, x + dx, y + dy)) {
            moves.push({ from: [x, y], to: [x + dx, y + dy] });
          }
        }
      }
    }
    return moves;
  }

  function click(state, x, y) {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return state;
    const next = {
      ...state,
      board: copyBoard(state.board),
      history: state.history.slice(),
      selected: state.selected ? state.selected.slice() : null,
    };

    if (!next.selected) {
      if (!isPeg(cell(next, x, y))) return state;
      next.board[x][y] = SELECTED;
      next.selected = [x, y];
      return next;
    }

    const [sx, sy] = next.selected;
    if (sx === x && sy === y) {
      next.board[sx][sy] = PEG;
      next.selected = null;
      return next;
    }

    if (canJump(next, sx, sy, x, y)) {
      next.board[sx][sy] = EMPTY;
      next.board[x][y] = PEG;
      // Midpoint stays occupied — jumps do not capture.
      next.history.push({ from: [sx, sy], to: [x, y] });
      next.selected = null;
      return next;
    }

    next.board[sx][sy] = PEG;
    next.selected = null;
    return next;
  }

  function undo(state) {
    if (!state.history.length) return state;
    const next = {
      ...state,
      board: copyBoard(state.board),
      history: state.history.slice(),
      selected: null,
    };
    if (state.selected) {
      const [sx, sy] = state.selected;
      if (next.board[sx][sy] === SELECTED) next.board[sx][sy] = PEG;
    }
    const move = next.history.pop();
    const [fx, fy] = move.from;
    const [tx, ty] = move.to;
    next.board[tx][ty] = EMPTY;
    next.board[fx][fy] = PEG;
    // Midpoint was never cleared; leave it.
    return next;
  }

  function pegCount(state) {
    let n = 0;
    for (let x = 0; x < state.cols; x++) {
      for (let y = 0; y < state.rows; y++) if (isPeg(state.board[x][y])) n++;
    }
    return n;
  }

  /** Right half: columns with index >= ceil(cols/2), matching "left vs right". */
  function rightHalfStartCol(state) {
    return Math.ceil(state.cols / 2);
  }

  function allOnRight(state) {
    const start = rightHalfStartCol(state);
    for (let x = 0; x < start; x++) {
      for (let y = 0; y < state.rows; y++) if (isPeg(state.board[x][y])) return false;
    }
    return pegCount(state) > 0;
  }

  /**
   * Page colouring for odd N: the diagram's "black spots". Matches the hint
   * drawing's every-other pattern used when N is odd — cells where
   * floor(x/2) + floor(y/2) is even (2×2 blocks).
   */
  function blockColor(x, y) {
    return (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
  }

  /** Checkerboard colour i+j mod 2 — page's argument when N is even. */
  function checkerColor(x, y) {
    return (x + y) & 1;
  }

  function countColor(board, cols, rows, colorFn, color, half) {
    const mid = Math.ceil(cols / 2);
    let n = 0;
    const x0 = half === "left" ? 0 : mid;
    const x1 = half === "left" ? mid : cols;
    for (let x = x0; x < x1; x++) {
      for (let y = 0; y < rows; y++) {
        if (board[x][y] !== PEG && board[x][y] !== SELECTED) continue;
        if (colorFn(x, y) === color) n++;
      }
    }
    return n;
  }

  /**
   * Invariant: jumps preserve each colour class. Returns whether left and
   * right halves disagree on the relevant colouring for this N.
   */
  function invariantBlocks(n) {
    const state = start({ n });
    const N = state.n;
    if (N % 2 === 1) {
      const left = countColor(state.board, state.cols, state.rows, blockColor, 0, "left");
      const right = countColor(state.board, state.cols, state.rows, blockColor, 0, "right");
      return { kind: "block", left, right, impossible: left !== right };
    }
    const left = countColor(state.board, state.cols, state.rows, checkerColor, 0, "left");
    const right = countColor(state.board, state.cols, state.rows, checkerColor, 0, "right");
    return { kind: "checker", left, right, impossible: left !== right };
  }

  function snapshot(state) {
    return {
      n: state.n,
      cols: state.cols,
      rows: state.rows,
      board: copyBoard(state.board),
      selected: state.selected ? state.selected.slice() : null,
      historyLength: state.history.length,
      pegs: pegCount(state),
      showHint: state.showHint,
      allOnRight: allOnRight(state),
    };
  }

  return {
    EMPTY, PEG, SELECTED, MIN_N, MAX_N, DEFAULT_N,
    clampN, initialBoard, start, canJump, legalMoves, click, undo,
    pegCount, allOnRight, rightHalfStartCol, blockColor, checkerColor,
    invariantBlocks, snapshot, copyBoard,
  };
})();
