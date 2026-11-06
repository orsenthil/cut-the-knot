"use strict";

/*
 * Tiling Rectangles with L-Trominoes (Bogomolny's LminoRect applet).
 *
 * An N by M board (2 to 10 each; 5 by 6 to start). Cover it with L-trominoes:
 * three squares in an L. Which rectangles can be covered? The page's answer
 * (Golomb; Soifer, Theorem 2.3): with 2 <= a <= b, an a by b rectangle can be
 * tiled exactly when a = 3 and b is even, or a != 3 and ab is divisible by 3.
 *
 * Read off the bytecode (LminoRectCanvas, TroBlock): a piece takes three
 * clicks. Each square must be free and share a side with the square before it,
 * and the three may not lie in one row or column, so the second square is the
 * corner of the L. "Remove last" pops the last piece; the board is finished
 * when no square is left (CheckFinished).
 *
 * canTile() decides any board exactly by backtracking: take the first empty
 * square in reading order and try every L that covers it with that square as
 * its first, i.e. top-left-most, cell.
 */

var LTrominoCore = (function () {
  const MIN = 2;
  const MAX = 10;
  const DEFAULT_ROWS = 5;
  const DEFAULT_COLS = 6;

  function start(rows, cols) {
    return { rows, cols, owner: Array.from({ length: rows }, () => new Array(cols).fill(-1)), pieces: [], building: [] };
  }

  const free = (s, r, c) => r >= 0 && r < s.rows && c >= 0 && c < s.cols && s.owner[r][c] < 0;
  const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

  /** TroBlock.IsConsistent(): may this square be the next one of the piece being built? */
  function canAdd(s, r, c) {
    if (!free(s, r, c)) return false;
    const b = s.building;
    if (b.some(([x, y]) => x === r && y === c)) return false;
    if (b.length === 0) return true;
    if (!touch(b[b.length - 1], [r, c])) return false;
    if (b.length === 2) {
      const [p, q] = b;
      if ((p[0] === q[0] && q[0] === r) || (p[1] === q[1] && q[1] === c)) return false; // a straight line
    }
    return true;
  }

  /**
   * One click: add the square to the piece being built, or start again from it
   * if it does not fit (as the applet drops a block that is not consistent).
   * Returns "placed" when a piece is finished, "added", or "refused".
   */
  function click(s, r, c) {
    if (!free(s, r, c)) { s.building = []; return "refused"; }
    if (!canAdd(s, r, c)) s.building = [];
    if (!canAdd(s, r, c)) return "refused";
    s.building.push([r, c]);
    if (s.building.length < 3) return "added";
    const id = s.pieces.length;
    for (const [x, y] of s.building) s.owner[x][y] = id;
    s.pieces.push(s.building);
    s.building = [];
    return "placed";
  }

  function removeLast(s) {
    const p = s.pieces.pop();
    if (!p) return false;
    for (const [x, y] of p) s.owner[x][y] = -1;
    s.building = [];
    return true;
  }

  const finished = (s) => s.owner.every((row) => row.every((v) => v >= 0));

  // The four L shapes, each listed from its top-left-most cell (reading order).
  const SHAPES = [
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, -1]],
  ];

  /** Can an empty rows x cols board be tiled? Returns a tiling (list of pieces) or null. */
  function canTile(rows, cols) {
    if ((rows * cols) % 3 !== 0) return null;
    const used = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const pieces = [];
    function next() {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!used[r][c]) return [r, c];
      return null;
    }
    function go() {
      const at = next();
      if (!at) return true;
      for (const shape of SHAPES) {
        const cells = shape.map(([dr, dc]) => [at[0] + dr, at[1] + dc]);
        if (cells.every(([r, c]) => r >= 0 && r < rows && c >= 0 && c < cols && !used[r][c])) {
          for (const [r, c] of cells) used[r][c] = true;
          pieces.push(cells);
          if (go()) return true;
          pieces.pop();
          for (const [r, c] of cells) used[r][c] = false;
        }
      }
      return false;
    }
    return go() ? pieces : null;
  }

  /** The page's Theorem 2.3. */
  function theorem(rows, cols) {
    const a = Math.min(rows, cols);
    const b = Math.max(rows, cols);
    return a === 3 ? b % 2 === 0 : (a * b) % 3 === 0;
  }

  return { MIN, MAX, DEFAULT_ROWS, DEFAULT_COLS, SHAPES, start, canAdd, click, removeLast, finished, canTile, theorem };
})();
