"use strict";

/*
 * Golomb's Tromino Theorem - the logic, transcribed from the applet Tromino.
 *
 * The applet shows Golomb's induction proof that a 2^n by 2^n board with one
 * square removed can always be tiled with L-trominoes (an L of three unit
 * squares). Each press of "One step" performs one level of the induction on
 * every unfinished square board: it drops one L-tromino round the centre of
 * the board and splits the board into four smaller ones. The key idea is the
 * centre L: it sits in the three quarters that do NOT hold the missing
 * square, so each of the four quarters is again a deficient board one size
 * smaller, and the same argument can be applied to it.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, TrominoCore, so the page loads it with a
 * plain <script> and porting/check-tromino.mjs loads it in Node. The position
 * is plain data, so it can be saved and handed to the tutor as it is.
 *
 * Coordinates are in unit cells of the whole board: { col, row }, with col
 * across (x) and row down (y), matching I and J in TrominoBoard.
 */
const TrominoCore = (() => {
  // The exponent spin control in the applet: PVNumeric min 1, max 7, default 4.
  const MIN_EXP = 1;
  const MAX_EXP = 7;
  const DEFAULT_EXP = 4;
  const NUM_COLORS = 6; // applet: ColorN = (ColorN + 1) % 6, over 6 colours

  // The quadrant of the missing square, as TrominoBoard.GetType() returns it:
  //   0 = upper left, 1 = upper right, 2 = lower right, 3 = lower left.
  // GetType tests I (the column) first, then J (the row).
  const UL = 0, UR = 1, LR = 2, LL = 3;

  // The three cells of a 2x2 centre block that an L-tromino covers, indexed
  // by the quadrant it is MISSING (which is the quadrant of the hole). Offsets
  // are [col, row] from the block's upper-left cell.
  const PIECE_CELLS = [
    [[1, 0], [1, 1], [0, 1]], // missing UL -> covers UR, LR, LL
    [[0, 0], [0, 1], [1, 1]], // missing UR -> covers UL, LL, LR
    [[0, 0], [1, 0], [0, 1]], // missing LR -> covers UL, UR, LL
    [[0, 0], [1, 0], [1, 1]], // missing LL -> covers UL, UR, LR
  ];

  function clampExp(exp) {
    const e = Math.trunc(Number(exp));
    if (!Number.isFinite(e)) return DEFAULT_EXP;
    return Math.max(MIN_EXP, Math.min(MAX_EXP, e));
  }

  /** Which quarter of an n x n board holds the cell (col, row). */
  function quadrant(col, row, n) {
    const h = n / 2;
    if (col < h) return row < h ? UL : LL;
    return row < h ? UR : LR;
  }

  /** The three unit cells covered by a placed tromino. */
  function pieceCells(piece) {
    return PIECE_CELLS[piece.type].map(([dc, dr]) => ({ col: piece.bx + dc, row: piece.by + dr }));
  }

  /**
   * The position a proof starts from. `col` and `row` place the missing
   * square; they default to the upper-left cell so tests are deterministic.
   */
  function start(options) {
    const o = options || {};
    const exp = clampExp(o.exp == null ? DEFAULT_EXP : o.exp);
    const n = 2 ** exp;
    let col = o.col == null ? 0 : Math.trunc(Number(o.col));
    let row = o.row == null ? 0 : Math.trunc(Number(o.row));
    col = Math.max(0, Math.min(n - 1, col));
    row = Math.max(0, Math.min(n - 1, row));
    return {
      exp,
      n,
      hole: { col, row },
      level: 0, // how many levels of the induction have been revealed
      // The frontier: square boards still waiting to be split, in whole-board
      // cell coordinates. Each is { ox, oy, n, hole: { col, row } }.
      boards: [{ ox: 0, oy: 0, n, hole: { col, row } }],
      // The L-trominoes placed so far: { bx, by, type, color }, where (bx, by)
      // is the upper-left cell of its 2x2 centre block.
      trominoes: [],
    };
  }

  /**
   * Split one board into four, literally as TrominoBoard.Split does:
   * the quarter holding the hole keeps that hole; the other three quarters
   * get the centre square of the L round the middle (cases of the bytecode's
   * tableswitch).
   */
  function split(board) {
    const h = board.n / 2;
    const { col, row } = board.hole;
    const type = quadrant(col, row, board.n);

    // The four children, in the applet's push order UL, UR, LR, LL.
    const subs = [
      { ox: board.ox, oy: board.oy, n: h, hole: null },
      { ox: board.ox + h, oy: board.oy, n: h, hole: null },
      { ox: board.ox + h, oy: board.oy + h, n: h, hole: null },
      { ox: board.ox, oy: board.oy + h, n: h, hole: null },
    ];

    // A child's new hole is either the original (made local to that child) or
    // that child's inner corner, which is where the centre L covers a cell.
    const innerCorner = [
      { col: h - 1, row: h - 1 }, // UL's lower-right cell
      { col: 0, row: h - 1 }, // UR's lower-left cell
      { col: 0, row: 0 }, // LR's upper-left cell
      { col: h - 1, row: 0 }, // LL's upper-right cell
    ];
    const origin = [
      { dc: 0, dr: 0 }, // UL
      { dc: h, dr: 0 }, // UR
      { dc: h, dr: h }, // LR
      { dc: 0, dr: h }, // LL
    ];

    for (let q = 0; q < 4; q++) {
      subs[q].hole = q === type
        ? { col: col - origin[q].dc, row: row - origin[q].dr }
        : { col: innerCorner[q].col, row: innerCorner[q].row };
    }
    return subs;
  }

  /**
   * Advance one level of the induction, as TrominoCanvas.Go does. The applet
   * keeps the frontier in a java.util.Stack: it pops the last board pushed and
   * pushes each board's four children in UL, UR, LR, LL order. `boards` is
   * that stack, so its last element is the next one processed.
   */
  function step(state) {
    if (state.level >= state.exp) {
      // At the end the applet's Step has shrunk past a cell and Go calls
      // Reset(false): start again at the same missing square.
      return start({ exp: state.exp, col: state.hole.col, row: state.hole.row });
    }
    const color = state.level % NUM_COLORS; // ColorN = (ColorN + 1) % 6
    const trominoes = state.trominoes.slice();
    // Go empties the old Squares stack onto a fresh S1; children go to S1 and
    // are not processed again until the next step.
    const stack = state.boards.slice();
    const boards = [];
    while (stack.length) {
      const board = stack.pop();
      const h = board.n / 2;
      const type = quadrant(board.hole.col, board.hole.row, board.n);
      trominoes.push({ bx: board.ox + h - 1, by: board.oy + h - 1, type, color });
      for (const sub of split(board)) boards.push(sub);
    }
    return { ...state, level: state.level + 1, boards, trominoes };
  }

  /** The actions a proof allows. */
  function legalMoves(state) {
    if (state.level >= state.exp) return [{ type: "reset" }];
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
        return start({ exp: state.exp, col, row });
      }
      case "exp":
        return start({ exp: m.exp, col: state.hole.col, row: state.hole.row });
      case "reset":
        return start({ exp: state.exp, col: state.hole.col, row: state.hole.row });
      default:
        return null;
    }
  }

  /** "done" when the board is fully tiled, else null. */
  function result(state) {
    return state.level >= state.exp ? "done" : null;
  }

  return {
    MIN_EXP, MAX_EXP, DEFAULT_EXP, NUM_COLORS,
    UL, UR, LR, LL, PIECE_CELLS,
    clampExp, quadrant, pieceCells,
    start, split, step, legalMoves, move, result,
  };
})();
