"use strict";

/*
 * Filling a grid with good neighbours, from Alexander Bogomolny's applet FillTheBoard.
 *
 * Chips stand on some squares of an N by N grid. A chip may be added on a free square with at
 * least two occupied 4-neighbours. Place the chips at the start so that the whole grid fills up,
 * with as few chips as possible. The page: N chips on a diagonal fill the board in N - 1 steps,
 * and no configuration of fewer than N chips can ever fill it. The reason: the perimeter of
 * the occupied squares never grows. A free square with two occupied neighbours has at least two
 * of its four sides against occupied squares, so adding it removes at least two sides of the
 * outline and adds at most two. The full board has perimeter 4N and each starting chip adds at
 * most 4.
 *
 * Read off the bytecode: N from 2 to 15 (opening on 4); in "Set up" a click toggles a chip (step
 * number 0) and in "Play" "One step" adds, all together, every free square with MORE than one
 * neighbour that was occupied at an EARLIER step, numbering the new squares with the step; going
 * back to "Set up" removes the added squares and keeps the chips; Reset and a change of N start
 * again. Here the game is won when the board is full, and lost when a step adds nothing and
 * the board is not full. The position is plain data.
 */
const FillTheBoardCore = (() => {
  const MIN_N = 2;
  const MAX_N = 15;
  const START_N = 4;

  const empty = (n) => Array.from({ length: n }, () => new Array(n).fill(-1));

  /** A new position: an empty board in Set up. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(o.n)))) : START_N;
    return { n, grid: empty(n), step: 0, playing: false, moves: 0, explored: false };
  }

  const clone = (g) => g.map((r) => r.slice());
  const count = (s) => s.grid.flat().filter((v) => v !== -1).length;
  const chips = (s) => s.grid.flat().filter((v) => v === 0).length;
  const full = (s) => count(s) === s.n * s.n;

  /** The occupied 4-neighbours of (x, y) that were occupied before step `step` (the applet's Neighbors). */
  function neighbors(grid, n, x, y, step) {
    let k = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const a = x + dx, b = y + dy;
      if (a >= 0 && a < n && b >= 0 && b < n && grid[a][b] !== -1 && grid[a][b] < step) k++;
    }
    return k;
  }

  /** One step of the applet on a bare grid: the new grid and how many squares were added. */
  function expand(grid, n, step) {
    const g = clone(grid);
    let added = 0;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (grid[x][y] === -1 && neighbors(grid, n, x, y, step) > 1) { g[x][y] = step; added++; }
    return { grid: g, added };
  }

  /** The perimeter of the occupied squares: sides of an occupied square not shared with another. */
  function perimeter(grid, n) {
    let p = 0;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (grid[x][y] !== -1) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const a = x + dx, b = y + dy;
      if (!(a >= 0 && a < n && b >= 0 && b < n) || grid[a][b] === -1) p++;
    }
    return p;
  }

  /** "win" when the board is full, "lose" when a step added nothing and it is not, else null. */
  function result(s) {
    if (!s.playing) return null;
    if (full(s)) return "win";
    return s.stuck ? "lose" : null;
  }

  /** Moves: {type:"toggle", x, y} (Set up only), {type:"mode", value:"setup"|"play"}, {type:"step"} (Play only), {type:"size", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "toggle") {
      if (s.playing || !(m.x >= 0 && m.x < s.n && m.y >= 0 && m.y < s.n)) return null;
      const grid = clone(s.grid);
      grid[m.x][m.y] = grid[m.x][m.y] === -1 ? 0 : -1;
      return { ...s, grid, moves: s.moves + 1, explored: s.explored };
    }
    if (m.type === "mode") {
      if (m.value === "play") return s.playing ? s : { ...s, playing: true, stuck: false };
      if (m.value === "setup") { const grid = s.grid.map((r) => r.map((v) => (v === 0 ? 0 : -1))); return { ...s, grid, step: 0, playing: false, stuck: false }; }
      return null;
    }
    if (m.type === "step") {
      if (!s.playing || full(s)) return null;
      const step = s.step + 1;
      const e = expand(s.grid, s.n, step);
      return { ...s, grid: e.grid, step, stuck: e.added === 0 && !(count({ grid: e.grid }) === s.n * s.n), moves: s.moves + 1, explored: true };
    }
    if (m.type === "size") { const v = Math.trunc(Number(m.value)); if (!(v >= MIN_N && v <= MAX_N)) return null; return start({ n: v }); }
    if (m.type === "reset") return start({ n: s.n });
    return null;
  }

  function legalMoves(s) {
    if (!s.playing) return [{ type: "mode", value: "play" }];
    return full(s) || s.stuck ? [{ type: "mode", value: "setup" }] : [{ type: "step" }];
  }

  /** Run the applet's steps to the end from a bare 0/1 starting grid of chips: {grid, steps, full}. */
  function run(n, chipCells) {
    let grid = empty(n);
    for (const [x, y] of chipCells) grid[x][y] = 0;
    let step = 0;
    while (true) {
      step++;
      const e = expand(grid, n, step);
      if (e.added === 0) return { grid, steps: step - 1, full: grid.flat().every((v) => v !== -1) };
      grid = e.grid;
    }
  }

  return { MIN_N, MAX_N, START_N, start, expand, neighbors, perimeter, run, count, chips, full, result, move, legalMoves };
})();
