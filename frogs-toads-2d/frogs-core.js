"use strict";

/*
 * Toads and Frogs in two dimensions (Bogomolny's FrogsAndToads2D applet).
 *
 * A grid with one empty square in the middle. Frogs fill the part of the
 * board before it, toads the part after it, and the two sides have to swap.
 *
 * The move rule is the applet's CanMoveTo(), read straight off the bytecode:
 * a frog may step down or right into the empty square, or jump over exactly
 * one TOAD into it; a toad may step up or left, or jump over exactly one
 * FROG. Nothing jumps over its own kind, and nothing moves backwards. You
 * click the piece, not the square: with one hole, a piece has at most one
 * legal destination.
 *
 * The opening position is the applet's InitValues(): with the hole at
 * (hx, hy) = ((cols-1)/2, (rows-1)/2), the squares left of column hx are
 * frogs, those right of it toads, and column hx itself is frogs above the
 * hole and toads below it. Winning is the same position with the two kinds
 * exchanged and the hole back in the middle, which is what the applet's
 * Finished() tests region by region.
 *
 * MINIMUM holds the fewest moves for the boards small enough to search
 * exhaustively; porting/check-frogs-toads-2d.mjs re-derives every entry.
 * A single column or row is the classic one-dimensional puzzle, where the
 * cut-the-knot page proves the answer is M*N + M + N for M toads and N frogs.
 */

var FrogsCore = (function () {
  const EMPTY = 0;
  const FROG = 1;
  const TOAD = 2;

  const SIDES = [1, 3, 5, 7, 9]; // the applet's limits: odd, 1 to 9

  /** Fewest moves, keyed "cols x rows". Only the searchable boards are here. */
  const MINIMUM = {
    "1x1": 0,
    "1x3": 3,
    "3x1": 3,
    "1x5": 8,
    "5x1": 8,
    "1x7": 15,
    "7x1": 15,
    "1x9": 24,
    "9x1": 24,
    "3x3": 12,
    "3x5": 22,
    "5x3": 27,
    "3x7": 34,
    "7x3": 48,
  };

  const hole = (cols, rows) => ({ x: (cols - 1) >> 1, y: (rows - 1) >> 1 });

  /** The applet's InitValues(). */
  function start(cols, rows) {
    const h = hole(cols, rows);
    const cells = new Array(cols * rows).fill(FROG);
    for (let y = 0; y < rows; y++) {
      const from = y < h.y ? h.x + 1 : h.x;
      for (let x = from; x < cols; x++) cells[y * cols + x] = TOAD;
    }
    cells[h.y * cols + h.x] = EMPTY;
    return { cols: cols, rows: rows, cells: cells, moves: 0, history: [] };
  }

  /** The finished position: the same board with frogs and toads exchanged. */
  function goal(cols, rows) {
    const s = start(cols, rows);
    return s.cells.map((v) => (v === FROG ? TOAD : v === TOAD ? FROG : EMPTY));
  }

  const at = (s, x, y) =>
    x < 0 || y < 0 || x >= s.cols || y >= s.rows ? -1 : s.cells[y * s.cols + x];

  /**
   * Where the piece on (x, y) may go, or null. This is CanMoveTo(): a step
   * into the hole, or a jump over one piece of the other kind into the hole.
   */
  function target(s, x, y) {
    const v = at(s, x, y);
    if (v === TOAD) {
      if (at(s, x, y - 1) === EMPTY) return { x: x, y: y - 1 };
      if (at(s, x - 1, y) === EMPTY) return { x: x - 1, y: y };
      if (at(s, x, y - 2) === EMPTY && at(s, x, y - 1) === FROG) return { x: x, y: y - 2 };
      if (at(s, x - 2, y) === EMPTY && at(s, x - 1, y) === FROG) return { x: x - 2, y: y };
    } else if (v === FROG) {
      if (at(s, x, y + 1) === EMPTY) return { x: x, y: y + 1 };
      if (at(s, x + 1, y) === EMPTY) return { x: x + 1, y: y };
      if (at(s, x, y + 2) === EMPTY && at(s, x, y + 1) === TOAD) return { x: x, y: y + 2 };
      if (at(s, x + 2, y) === EMPTY && at(s, x + 1, y) === TOAD) return { x: x + 2, y: y };
    }
    return null;
  }

  function move(s, x, y) {
    const to = target(s, x, y);
    if (!to) return false;
    s.cells[to.y * s.cols + to.x] = s.cells[y * s.cols + x];
    s.cells[y * s.cols + x] = EMPTY;
    s.history.push([x, y, to.x, to.y]);
    s.moves++;
    return true;
  }

  function undo(s) {
    const last = s.history.pop();
    if (!last) return false;
    s.cells[last[1] * s.cols + last[0]] = s.cells[last[3] * s.cols + last[2]];
    s.cells[last[3] * s.cols + last[2]] = EMPTY;
    s.moves--;
    return true;
  }

  /** Every piece that can move right now. */
  function movable(s) {
    const out = [];
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) if (target(s, x, y)) out.push({ x: x, y: y });
    }
    return out;
  }

  const stuck = (s) => movable(s).length === 0;

  function won(s) {
    const want = goal(s.cols, s.rows);
    for (let i = 0; i < want.length; i++) if (want[i] !== s.cells[i]) return false;
    return true;
  }

  const minimum = (cols, rows) => {
    const key = cols + "x" + rows;
    return Object.prototype.hasOwnProperty.call(MINIMUM, key) ? MINIMUM[key] : null;
  };

  /** How many of each kind, which is what the 1-D formula needs. */
  function census(cols, rows) {
    const s = start(cols, rows);
    let frogs = 0;
    let toads = 0;
    for (const v of s.cells) {
      if (v === FROG) frogs++;
      else if (v === TOAD) toads++;
    }
    return { frogs: frogs, toads: toads };
  }

  const clone = (s) => ({
    cols: s.cols,
    rows: s.rows,
    cells: s.cells.slice(),
    moves: s.moves,
    history: s.history.map((m) => m.slice()),
  });

  return {
    EMPTY: EMPTY,
    FROG: FROG,
    TOAD: TOAD,
    SIDES: SIDES,
    MINIMUM: MINIMUM,
    hole: hole,
    start: start,
    goal: goal,
    at: at,
    target: target,
    move: move,
    undo: undo,
    movable: movable,
    stuck: stuck,
    won: won,
    minimum: minimum,
    census: census,
    clone: clone,
  };
})();
