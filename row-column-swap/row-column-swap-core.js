"use strict";

/*
 * Swapping Rows and Columns, from Alexander Bogomolny's applet RowColumnSwap
 * and the LXI Moscow Mathematical Olympiad problem on its page.
 *
 * An N×N grid is filled with 0 .. N²−1 in row-major order (display 1 .. N²).
 * You may swap any two rows or any two columns. Column sets (and row sets)
 * are invariants: swaps only permute bags, they never change which numbers
 * share a column.
 *
 * For N=3 the olympiad target (middle row 6 5 4) is unreachable because its
 * column sets are not a permutation of the start's {1,4,7}, {2,5,8}, {3,6,9}.
 *
 * The applet's Reset filled column-major (Data[r][c]=c*N+r), which contradicts
 * the page's olympiad left pattern and solution; this port follows the page.
 *
 * Options: N 2–10 (default 3). Take back undoes a swap. Demo: no win/lose;
 * exploring counts as done once the player has swapped.
 */
const RowColumnSwapCore = (() => {
  const MIN_N = 2;
  const MAX_N = 10;
  const DEFAULT_N = 3;

  function clampN(n) {
    n = Math.trunc(Number(n));
    if (!Number.isFinite(n)) n = DEFAULT_N;
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  /** Page olympiad fill: Data[row][col] = row*N + col (0-based). */
  function initialGrid(n) {
    const g = [];
    for (let r = 0; r < n; r++) {
      g[r] = [];
      for (let c = 0; c < n; c++) g[r][c] = r * n + c;
    }
    return g;
  }

  function copyGrid(g) {
    return g.map((row) => row.slice());
  }

  /**
   * Unreachable olympiad target for N=3 (display +1):
   *   start  1 2 3 / 4 5 6 / 7 8 9
   *   target 1 2 3 / 6 5 4 / 7 8 9
   * Start columns {1,4,7},{2,5,8},{3,6,9}; target has {1,6,7} and {3,4,9}.
   */
  function targetGrid(n) {
    if (n !== 3) return null;
    return [
      [0, 1, 2],
      [5, 4, 3],
      [6, 7, 8],
    ];
  }

  function start(options = {}) {
    const n = clampN(options.n ?? DEFAULT_N);
    return {
      n,
      grid: options.grid ? copyGrid(options.grid) : initialGrid(n),
      history: [],
      selected: null, // { kind: "row"|"col", index }
      explored: false,
    };
  }

  function columnSet(grid, c) {
    return grid.map((row) => row[c]).slice().sort((a, b) => a - b);
  }

  function rowSet(grid, r) {
    return grid[r].slice().sort((a, b) => a - b);
  }

  function columnSets(grid) {
    const n = grid.length;
    const sets = [];
    for (let c = 0; c < n; c++) sets.push(columnSet(grid, c));
    return sets;
  }

  function sameSets(a, b) {
    if (a.length !== b.length) return false;
    const key = (s) => s.join(",");
    const A = a.map(key).sort();
    const B = b.map(key).sort();
    return A.every((v, i) => v === B[i]);
  }

  /** True iff target's column sets match some permutation of start's. */
  function reachableBySets(startGrid, target) {
    return sameSets(columnSets(startGrid), columnSets(target));
  }

  function select(state, kind, index) {
    if (kind !== "row" && kind !== "col") return state;
    if (index < 0 || index >= state.n) return state;
    if (!state.selected) {
      return Object.assign({}, state, { selected: { kind, index } });
    }
    if (state.selected.kind !== kind) {
      return Object.assign({}, state, { selected: { kind, index } });
    }
    if (state.selected.index === index) {
      return Object.assign({}, state, { selected: null });
    }
    return swap(state, state.selected.index, index, kind);
  }

  function swap(state, i, j, kind) {
    const grid = copyGrid(state.grid);
    if (kind === "row") {
      const tmp = grid[i];
      grid[i] = grid[j];
      grid[j] = tmp;
    } else {
      for (let r = 0; r < state.n; r++) {
        const tmp = grid[r][i];
        grid[r][i] = grid[r][j];
        grid[r][j] = tmp;
      }
    }
    return {
      n: state.n,
      grid,
      history: state.history.concat([copyGrid(state.grid)]),
      selected: null,
      explored: true,
    };
  }

  function undo(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    const grid = history.pop();
    return Object.assign({}, state, { grid, history, selected: null });
  }

  function result(state) {
    return state.explored ? "done" : null;
  }

  function matchesTarget(state) {
    const t = targetGrid(state.n);
    if (!t) return false;
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (state.grid[r][c] !== t[r][c]) return false;
      }
    }
    return true;
  }

  function snapshot(state) {
    return {
      n: state.n,
      grid: copyGrid(state.grid),
      historyLength: state.history.length,
      explored: state.explored,
    };
  }

  function restore(snap) {
    const n = clampN(snap.n);
    return {
      n,
      grid: snap.grid ? copyGrid(snap.grid) : initialGrid(n),
      history: [],
      selected: null,
      explored: !!snap.explored,
    };
  }

  return {
    MIN_N,
    MAX_N,
    DEFAULT_N,
    clampN,
    initialGrid,
    targetGrid,
    start,
    columnSet,
    rowSet,
    columnSets,
    sameSets,
    reachableBySets,
    select,
    swap,
    undo,
    result,
    matchesTarget,
    snapshot,
    restore,
  };
})();
