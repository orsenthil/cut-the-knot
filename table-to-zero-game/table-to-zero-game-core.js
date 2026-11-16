"use strict";

/*
 * Make It All Zeros (TableToZeroGame), from Alexander Bogomolny after Engel.
 *
 * An Ny×Nx table of positive integers. A move either doubles every entry in a
 * chosen row, or subtracts the same positive amount from every entry in a
 * chosen column (normally 1; with Speed up, subtract enough so the column’s
 * minimum becomes 1, unless it was already ≤ 1). Undo restores the previous
 * table. The puzzle is finished when every cell is 0.
 *
 * Engel’s theorem: from any positive starting table the zeros are reachable.
 */
const TableToZeroGameCore = (() => {
  const MIN_N = 1, MAX_N = 10, DEFAULT_NX = 5, DEFAULT_NY = 3;

  function clamp(n, lo, hi, fallback) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function copyGrid(grid) {
    return grid.map((row) => row.slice());
  }

  /** Applet Reset fill: round(random*9+1) → integers 1…10. */
  function deal(ny, nx, rnd) {
    const grid = [];
    for (let r = 0; r < ny; r++) {
      const row = [];
      for (let c = 0; c < nx; c++) {
        row.push(Math.round(rnd() * 9 + 1));
      }
      grid.push(row);
    }
    return grid;
  }

  function start(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const nx = clamp(options.nx ?? DEFAULT_NX, MIN_N, MAX_N, DEFAULT_NX);
    const ny = clamp(options.ny ?? DEFAULT_NY, MIN_N, MAX_N, DEFAULT_NY);
    const grid = options.grid ? copyGrid(options.grid) : deal(ny, nx, rnd);
    return {
      nx: grid[0].length,
      ny: grid.length,
      grid,
      speedUp: Boolean(options.speedUp),
      history: [],
      over: finishedGrid(grid),
    };
  }

  function restore(partial) {
    return start({
      grid: partial.grid,
      speedUp: partial.speedUp,
      nx: partial.nx,
      ny: partial.ny,
    });
  }

  function finishedGrid(grid) {
    for (const row of grid) for (const v of row) if (v !== 0) return false;
    return true;
  }

  function finished(state) {
    return finishedGrid(state.grid);
  }

  function result(state) {
    return finished(state) ? "win" : null;
  }

  function doubleRow(state, row) {
    if (row < 0 || row >= state.ny) return null;
    const grid = copyGrid(state.grid);
    for (let c = 0; c < state.nx; c++) grid[row][c] *= 2;
    return afterMove(state, grid);
  }

  function subtractColumn(state, col) {
    if (col < 0 || col >= state.nx) return null;
    let amount = 1;
    if (state.speedUp) {
      let min = Infinity;
      for (let r = 0; r < state.ny; r++) min = Math.min(min, state.grid[r][col]);
      if (min > 1) amount = min - 1;
    }
    const grid = copyGrid(state.grid);
    for (let r = 0; r < state.ny; r++) grid[r][col] -= amount;
    return afterMove(state, grid);
  }

  function afterMove(state, grid) {
    return {
      ...state,
      grid,
      history: state.history.concat([copyGrid(state.grid)]),
      over: finishedGrid(grid),
    };
  }

  function undo(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    const grid = history.pop();
    return { ...state, grid, history, over: finishedGrid(grid) };
  }

  function legalMoves(state) {
    if (finished(state)) return [];
    const moves = [];
    for (let r = 0; r < state.ny; r++) moves.push({ type: "row", index: r });
    for (let c = 0; c < state.nx; c++) moves.push({ type: "col", index: c });
    return moves;
  }

  function move(state, m) {
    if (!m) return null;
    if (m.type === "row") return doubleRow(state, m.index);
    if (m.type === "col") return subtractColumn(state, m.index);
    return null;
  }

  /**
   * Reverse search from the zeros: add 1 to a column, or (when a row is all
   * even) halve that row. If the starting grid appears, Engel’s claim holds
   * for that instance.
   */
  function canReachZero(grid, maxSteps = 60) {
    if (finishedGrid(grid)) return true;
    const ny = grid.length;
    const nx = grid[0].length;
    const target = keyOf(grid);
    const zero = Array.from({ length: ny }, () => Array(nx).fill(0));
    const seen = new Set([keyOf(zero)]);
    let frontier = [zero];
    for (let step = 0; step < maxSteps && frontier.length; step++) {
      const next = [];
      for (const g of frontier) {
        for (let c = 0; c < nx; c++) {
          const h = copyGrid(g);
          for (let r = 0; r < ny; r++) h[r][c] += 1;
          const k = keyOf(h);
          if (k === target) return true;
          if (!seen.has(k) && maxEntry(h) <= 64) {
            seen.add(k);
            next.push(h);
          }
        }
        for (let r = 0; r < ny; r++) {
          if (!g[r].every((v) => v % 2 === 0)) continue;
          const h = copyGrid(g);
          for (let c = 0; c < nx; c++) h[r][c] /= 2;
          const k = keyOf(h);
          if (k === target) return true;
          if (!seen.has(k)) {
            seen.add(k);
            next.push(h);
          }
        }
      }
      frontier = next;
      if (seen.size > 30000) break;
    }
    return seen.has(target);
  }

  function keyOf(grid) {
    return grid.map((r) => r.join(",")).join(";");
  }

  function maxEntry(grid) {
    let m = 0;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }

  return {
    MIN_N,
    MAX_N,
    DEFAULT_NX,
    DEFAULT_NY,
    start,
    restore,
    finished,
    result,
    doubleRow,
    subtractColumn,
    undo,
    legalMoves,
    move,
    canReachZero,
    deal,
    copyGrid,
  };
})();
