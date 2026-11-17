"use strict";

/*
 * Tromino as a Rep-tile - the logic, transcribed from the applet Tromino2.
 *
 * An L-tromino is three squares in an L. The applet shows that a 2^n by 2^n
 * board with one square missing can be tiled with L-trominoes, and that it can
 * be done by splitting: divide the board into four quarters; the hole is in
 * one of them, and one L covers the other three. That L is itself four smaller
 * Ls (the L-tromino is a rep-4 tile), and so is each smaller one, down to a
 * 2x2 block that is exactly one unit L.
 *
 * The opening picture is one L at every size, nested round the hole. Each
 * press of "One step" replaces every L larger than the new size by its four
 * half-size copies, colouring them from the parent's colour. After n-1 presses
 * every piece is a unit L; the applet's next press starts again with the same
 * hole.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, TrominoRepTileCore, so the page loads it with
 * a plain <script> and porting/check-tromino-rep-tile.mjs loads it in Node.
 * The position is plain data, so the page can save it and the tutor can read it.
 *
 * A piece is { x, y, side, which, color }: x,y are its upper-left cell in the
 * whole board, side is the side of each of its three squares, `which` is the
 * quadrant it leaves empty (UL, UR, LR or LL), and color is 0..6.
 */
const TrominoRepTileCore = (() => {
  // The panel's PVNumeric: min 1, max 7, default 4 (2x2 up to 128x128).
  const MIN_EXP = 1;
  const MAX_EXP = 7;
  const DEFAULT_EXP = 4;
  const NUM_COLORS = 7; // the applet's Colors array has seven entries

  // Which quadrant of a piece or board is missing, as GetType returns it.
  const UL = 0, UR = 1, LR = 2, LL = 3;

  /*
   * Tromino2Piece.SplitUL/UR/LR/LL, in the bytecode's order. Each child is
   * [dx, dy, which] with the offsets in halves of the parent's side: 0, 1 or 2.
   * The four children exactly cover the three squares of the parent - the
   * rep-4 property - which the logic test checks for every side and `which`.
   */
  const SPLITS = [
    [[1, 1, UL], [2, 0, LL], [0, 2, UR], [2, 2, UL]], // SplitUL
    [[1, 1, UR], [0, 0, LR], [0, 2, UR], [2, 2, UL]], // SplitUR
    [[1, 1, LR], [0, 0, LR], [0, 2, UR], [2, 0, LL]], // SplitLR
    [[1, 1, LL], [2, 0, LL], [0, 0, LR], [2, 2, UL]], // SplitLL
  ];

  function clampExp(exp) {
    const e = Math.trunc(Number(exp));
    if (!Number.isFinite(e)) return DEFAULT_EXP;
    return Math.max(MIN_EXP, Math.min(MAX_EXP, e));
  }

  /** Which quarter of an n x n board holds (col, row): Tromino2Board.GetType. */
  function quadrant(col, row, n) {
    const h = n / 2;
    if (col < h) return row < h ? UL : LL;
    return row < h ? UR : LR;
  }

  /**
   * The initial colours, one per nested L. The applet picks each at random
   * from its seven colours; the page supplies random ones, while tests and the
   * tutor get this fixed pattern.
   */
  function colorsFor(exp, colors) {
    if (Array.isArray(colors) && colors.length) {
      return colors.slice(0, exp).map((c) => {
        const i = Math.trunc(Number(c));
        return Number.isFinite(i) ? ((i % NUM_COLORS) + NUM_COLORS) % NUM_COLORS : 0;
      });
    }
    return Array.from({ length: exp }, (_, i) => i % NUM_COLORS);
  }

  /**
   * Tromino2Board.SplitInTwo: the quarter that contains the hole becomes the
   * next board, and one L of half the side covers the other three quarters,
   * leaving empty the quarter where the hole is.
   */
  function splitInTwo(board) {
    const h = board.n / 2;
    const { col, row } = board.hole;
    const which = quadrant(col, row, board.n);
    const square = { x: board.x, y: board.y, n: h, hole: null };
    switch (which) {
      case UL:
        square.hole = { col, row };
        break;
      case UR:
        square.x += h;
        square.hole = { col: col - h, row };
        break;
      case LR:
        square.x += h;
        square.y += h;
        square.hole = { col: col - h, row: row - h };
        break;
      case LL:
        square.y += h;
        square.hole = { col, row: row - h };
        break;
    }
    return { square, piece: { x: board.x, y: board.y, side: h, which } };
  }

  /**
   * The position a proof starts from: one L per size, nested round the hole,
   * as Tromino2Canvas.Trominoing builds it. `colors` may give the colour of
   * each L; otherwise they follow 0,1,2,...
   */
  function start(options) {
    const o = options || {};
    const exp = clampExp(o.exp == null ? DEFAULT_EXP : o.exp);
    const n = 2 ** exp;
    let col = o.col == null ? 0 : Math.trunc(Number(o.col));
    let row = o.row == null ? 0 : Math.trunc(Number(o.row));
    if (!Number.isFinite(col)) col = 0;
    if (!Number.isFinite(row)) row = 0;
    col = Math.max(0, Math.min(n - 1, col));
    row = Math.max(0, Math.min(n - 1, row));

    const colors = colorsFor(exp, o.colors);
    const pieces = [];
    let board = { x: 0, y: 0, n, hole: { col, row } };
    // Trominoing: split until the board is a single cell (the hole itself).
    while (board.n > 1) {
      const { square, piece } = splitInTwo(board);
      piece.color = colors[pieces.length % colors.length];
      pieces.push(piece);
      board = square;
    }

    return {
      exp,
      n,
      hole: { col, row },
      colors,
      // Step is the side of the largest L still to split, in cells. It starts
      // at half the board, as Tromino2Canvas.Reset sets it.
      step: n / 2,
      level: 0,
      pieces,
    };
  }

  /** Tromino2Piece.Split: four half-size Ls in the parent's colour family. */
  function splitPiece(piece) {
    const h = piece.side / 2;
    return SPLITS[piece.which].map(([dx, dy, which], i) => ({
      x: piece.x + dx * h,
      y: piece.y + dy * h,
      side: h,
      which,
      color: (piece.color + i) % NUM_COLORS,
    }));
  }

  /**
   * One press of "One step": Tromino2Canvas.Go. Every L bigger than the new
   * step is replaced by its four half-size copies; the ones already small
   * enough stay. When Step has shrunk below two cells the applet calls
   * Reset(false): a fresh opening picture with the same missing square.
   */
  function step(state) {
    if (state.step < 2) {
      return start({ exp: state.exp, col: state.hole.col, row: state.hole.row, colors: state.colors });
    }
    const next = state.step / 2;
    const pieces = [];
    for (const p of state.pieces) {
      if (p.side > next) pieces.push(...splitPiece(p));
      else pieces.push(p);
    }
    return { ...state, step: next, level: state.level + 1, pieces };
  }

  /** The moves the applet allows. One step also restarts once it has finished. */
  function legalMoves(state) {
    return [{ type: "step" }];
  }

  /** Apply an action, or return null when it is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    switch (m.type) {
      case "step":
        return step(state);
      case "hole": {
        const { col, row } = m;
        if (!Number.isInteger(col) || !Number.isInteger(row) ||
            col < 0 || row < 0 || col >= state.n || row >= state.n) return null;
        return start({ exp: state.exp, col, row, colors: state.colors });
      }
      case "exp": {
        const exp = Number(m.exp);
        if (!Number.isFinite(exp)) return null;
        return start({ exp: clampExp(exp), col: state.hole.col, row: state.hole.row, colors: state.colors });
      }
      case "reset":
        return start({ exp: state.exp, col: state.hole.col, row: state.hole.row, colors: state.colors });
      default:
        return null;
    }
  }

  /*
   * The unit cells of a piece. A piece of side s covers three s-by-s blocks of
   * a 2s-by-2s box; `which` names the one block it misses.
   */
  function pieceCells(p) {
    const cells = [];
    for (let by = 0; by < 2; by++) {
      for (let bx = 0; bx < 2; bx++) {
        const q = by === 0 ? (bx === 0 ? UL : UR) : (bx === 0 ? LL : LR);
        if (q === p.which) continue;
        for (let dy = 0; dy < p.side; dy++) {
          for (let dx = 0; dx < p.side; dx++) {
            cells.push({ col: p.x + bx * p.side + dx, row: p.y + by * p.side + dy });
          }
        }
      }
    }
    return cells;
  }

  /**
   * "done" once the picture is all unit L-trominoes. For the 2x2 board that is
   * true from the start (one L is the whole board), which is the applet's own
   * quirk: its first press of One step restarts.
   */
  function result(state) {
    return state.step <= 1 ? "done" : null;
  }

  return {
    MIN_EXP, MAX_EXP, DEFAULT_EXP, NUM_COLORS,
    UL, UR, LR, LL, SPLITS,
    clampExp, quadrant, colorsFor, splitInTwo, splitPiece,
    pieceCells, start, step, legalMoves, move, result,
  };
})();
