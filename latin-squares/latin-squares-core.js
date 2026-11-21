"use strict";

/*
 * Latin Squares, from Bogomolny's applet Latin.
 *
 * Fill an n by n grid with the numbers 1..n so every row and column contains
 * each number once. A harder variant also requires symmetry about the main
 * diagonal. Rows can be cycled left or right, and two cells in a row can be
 * swapped; the challenge is to repair a grid that has been disturbed.
 *
 * The key idea is that a cyclic square (row i shifted by i) is both Latin and
 * symmetric, so it provides a solution for every size. The logic test checks
 * the validity predicates, the effects of cycling and swapping, and that the
 * generated square solves both problems.
 *
 * No document, no window, no storage: one global, LatinSquaresCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LatinSquaresCore = (() => {
  const MIN_SIZE = 2;
  const MAX_SIZE = 9;

  const clamp = (v, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(MIN_SIZE, Math.min(MAX_SIZE, n)) : fb;
  };

  function cyclic(size) {
    return Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => (i + j) % size + 1));
  }

  function start(options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 5 : opts.size, 5);
    return {
      size,
      symmetric: opts.symmetric !== false,
      grid: opts.grid ? opts.grid.map((r) => r.slice()) : cyclic(size),
      moves: 0,
    };
  }

  function isLatin(grid) {
    const n = grid.length;
    if (!n || grid.some((row) => row.length !== n)) return false;
    for (let i = 0; i < n; i++) {
      if (new Set(grid[i]).size !== n) return false;
      const column = grid.map((row) => row[i]);
      if (new Set(column).size !== n) return false;
      if (grid[i].some((v) => !Number.isInteger(v) || v < 1 || v > n)) return false;
    }
    return true;
  }

  function isSymmetric(grid) {
    return grid.every((row, i) => row.every((v, j) => v === grid[j][i]));
  }

  function check(state) {
    const latin = isLatin(state.grid);
    const symmetric = isSymmetric(state.grid);
    return {
      latin, symmetric,
      solved: latin && (!state.symmetric || symmetric),
    };
  }

  function cycleRow(state, row, direction) {
    if (row < 0 || row >= state.size) return state;
    const grid = state.grid.map((r) => r.slice());
    const shift = (direction + state.size) % state.size;
    grid[row] = grid[row].map((_, j) => grid[row][(j - shift + state.size) % state.size]);
    return { ...state, grid, moves: state.moves + 1 };
  }

  function swapCells(state, row, a, b) {
    if (row < 0 || row >= state.size || a < 0 || b < 0 || a >= state.size || b >= state.size || a === b) return state;
    const grid = state.grid.map((r) => r.slice());
    [grid[row][a], grid[row][b]] = [grid[row][b], grid[row][a]];
    return { ...state, grid, moves: state.moves + 1 };
  }

  function setSize(state, value) {
    const size = clamp(value, state.size);
    return { ...state, size, grid: cyclic(size), moves: 0 };
  }

  function setSymmetric(state, value) {
    return { ...state, symmetric: !!value };
  }

  function restore(state) {
    return { ...state, grid: cyclic(state.size), moves: 0 };
  }

  function analyze(state) {
    return {
      size: state.size,
      symmetric: state.symmetric,
      grid: state.grid.map((r) => r.slice()),
      ...check(state),
      moves: state.moves,
    };
  }

  return {
    MIN_SIZE, MAX_SIZE, clamp, cyclic, start, isLatin, isSymmetric, check,
    cycleRow, swapCells, setSize, setSymmetric, restore, analyze,
  };
})();
