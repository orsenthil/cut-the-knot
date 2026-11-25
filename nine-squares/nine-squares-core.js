"use strict";

/*
 * Nine Squares, from Alexander Bogomolny's applet NineSquares.
 *
 * Nine squares are laid out edge to edge, their sides given by one number a:
 *   1 (black), a (blue), a + 1, a + 5, a + 9, a - 1, 4 (red), a - 2, 15 (red).
 * Changing a changes seven of them, but the black square (1) and the two red
 * ones (4 and 15) never change. Why? Add the widths of the top row and of the
 * bottom row of the picture and equate them: 3a + 2 + c = 3a - 2 + 2c, so
 * c = 4 whatever a is. For a = 9 the squares have no gaps and no overlaps:
 * they fill a 33 by 32 rectangle exactly (Zbigniew Moron, 1925), nine squares
 * all of different sizes.
 *
 * The applet counts a one smaller: its spinner value is a (0..15) and the
 * canvas works with A = a + 1. This file keeps the page's a. The squares are
 * placed in the applet's own order (its Compute method), with y pointing down.
 *
 * Position (plain data): { a }. One global, NineSquaresCore, no DOM.
 */
const NineSquaresCore = (() => {
  const MIN_A = 3, MAX_A = 15, DEFAULT_A = 4;   // sides a - 2 stay positive from a = 3

  function start() { return { a: DEFAULT_A }; }

  function setA(state, a) {
    a = Math.round(Number(a));
    if (!Number.isFinite(a)) return null;
    return { ...state, a: Math.max(MIN_A, Math.min(MAX_A, a)) };
  }

  /**
   * The nine squares, in the applet's drawing order, each { id, label, x, y,
   * side } with (x, y) the upper-left corner and the black square at (0, 0).
   * Positions follow Compute(): the black unit square; the blue square above
   * it; to its left a + 1 and a + 5 along the top row; a + 9 below the last of
   * those; a - 1 to the right of the black square; red 4 below a + 1; a - 2
   * beside it; and the red 15 below that.
   */
  function squares(state) {
    const A = state.a + 1;            // the applet's A
    const sq = [];
    const add = (id, label, x, y, side) => { sq.push({ id, label, x, y, side }); return sq[sq.length - 1]; };
    let x1 = 0, y3 = 0;
    const black = add("black", "1", x1, y3, 1);
    y3 -= A - 1;
    const blue = add("blue", "a", x1, y3, A - 1);
    x1 -= A;
    const s3 = add("a1", "a + 1", x1, y3, A);
    x1 -= A + 4;
    const s4 = add("a5", "a + 5", x1, y3, A + 4);
    y3 += A + 4;
    const s5 = add("a9", "a + 9", x1, y3, A + 8);
    x1 = blue.x + blue.side - (A - 2);
    y3 = blue.y + blue.side;
    add("am1", "a − 1", x1, y3, A - 2);
    x1 = s3.x;
    y3 = s3.y + s3.side;
    add("red4", "4", x1, y3, 4);
    x1 += 4;
    add("am2", "a − 2", x1, y3, A - 3);
    y3 += A - 3;
    add("red15", "15", x1, y3, 15);
    return sq;
  }

  /** The sides, in drawing order. */
  const sides = (state) => squares(state).map((s) => s.side);

  /** The smallest rectangle around the squares: { left, top, right, bottom, width, height }. */
  function bounds(state) {
    const sq = squares(state);
    const left = Math.min(...sq.map((s) => s.x)), top = Math.min(...sq.map((s) => s.y));
    const right = Math.max(...sq.map((s) => s.x + s.side)), bottom = Math.max(...sq.map((s) => s.y + s.side));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  /** The total area of the nine squares. */
  const totalArea = (state) => squares(state).reduce((t, s) => t + s.side * s.side, 0);

  /** Pairs of squares whose insides overlap (by id). */
  function overlaps(state) {
    const sq = squares(state), out = [];
    for (let i = 0; i < sq.length; i++) for (let j = i + 1; j < sq.length; j++) {
      const a = sq[i], b = sq[j];
      if (a.x < b.x + b.side && b.x < a.x + a.side && a.y < b.y + b.side && b.y < a.y + a.side) out.push([a.id, b.id]);
    }
    return out;
  }

  /** Whether the squares fill their bounding rectangle exactly: no overlap, no gap. */
  function tiles(state) {
    const b = bounds(state);
    return overlaps(state).length === 0 && totalArea(state) === b.width * b.height;
  }

  /** What to say about this a. */
  function describe(state) {
    const b = bounds(state), ov = overlaps(state).length;
    const gap = b.width * b.height - totalArea(state);
    return { width: b.width, height: b.height, overlaps: ov, gap, tiles: tiles(state), distinct: new Set(sides(state)).size === 9 };
  }

  return { MIN_A, MAX_A, DEFAULT_A, start, setA, squares, sides, bounds, totalArea, overlaps, tiles, describe };
})();
