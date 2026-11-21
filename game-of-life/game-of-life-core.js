"use strict";

/*
 * The Game of Life, from Bogomolny's applet Life.
 *
 * A live cell with two or three live neighbours survives; an empty cell with
 * exactly three live neighbours is born. All other cells die or stay empty.
 * The applet adds a finite board, random populations, known patterns and a
 * reverse step. This port keeps the same rules with dead cells beyond the
 * board edge.
 *
 * The key idea is that each generation depends only on the previous one. The
 * logic test checks the classic still lifes, oscillators and the glider's
 * four-generation translation, plus the birth/survival rules themselves.
 *
 * No document, no window, no storage: one global, GameOfLifeCore. The position
 * is plain data, so it can be saved and handed to the tutor.
 */
const GameOfLifeCore = (() => {
  const MIN_SIDE = 8;
  const MAX_SIDE = 40;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function empty(size) {
    return Array.from({ length: size }, () => Array(size).fill(false));
  }

  function start(options) {
    const opts = options || {};
    const size = clamp(opts.size === undefined ? 20 : opts.size, MIN_SIDE, MAX_SIDE, 20);
    const cells = opts.cells ? opts.cells.map((row) => row.map(Boolean)) : empty(size);
    return { size, cells, generation: 0, history: [] };
  }

  function alive(cells, x, y) {
    return y >= 0 && y < cells.length && x >= 0 && x < cells[0].length && cells[y][x];
  }

  function neighbours(cells, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (alive(cells, x + dx, y + dy)) count++;
      }
    }
    return count;
  }

  function step(state) {
    const next = state.cells.map((row, y) => row.map((cell, x) => {
      const n = neighbours(state.cells, x, y);
      return cell ? (n === 2 || n === 3) : n === 3;
    }));
    return {
      size: state.size,
      cells: next,
      generation: state.generation + 1,
      history: state.history.concat([state.cells.map((row) => row.slice())]),
    };
  }

  function reverse(state) {
    if (!state.history.length) return state;
    const history = state.history.slice();
    const cells = history.pop();
    return { size: state.size, cells, generation: Math.max(0, state.generation - 1), history };
  }

  function toggle(state, x, y) {
    if (x < 0 || y < 0 || y >= state.size || x >= state.size) return state;
    const cells = state.cells.map((row) => row.slice());
    cells[y][x] = !cells[y][x];
    return { ...state, cells };
  }

  function randomize(state, count, random) {
    const rnd = random || Math.random;
    const cells = empty(state.size);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = Math.floor(rnd() * state.size);
      const y = Math.floor(rnd() * state.size);
      if (!cells[y][x]) { cells[y][x] = true; placed++; }
    }
    return { ...state, cells, generation: 0, history: [] };
  }

  /** Patterns as (x,y) offsets from the upper-left corner. */
  const PATTERNS = {
    block: [[0, 0], [1, 0], [0, 1], [1, 1]],
    blinker: [[0, 0], [1, 0], [2, 0]],
    toad: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
    beacon: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 2], [2, 3], [3, 3]],
    glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  };

  function place(state, name, x, y) {
    const pattern = PATTERNS[name];
    if (!pattern) return state;
    const cells = state.cells.map((row) => row.slice());
    pattern.forEach(([dx, dy]) => {
      if (y + dy < state.size && x + dx < state.size) cells[y + dy][x + dx] = true;
    });
    return { ...state, cells, generation: 0, history: [] };
  }

  function population(state) {
    return state.cells.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  function encode(state) {
    return state.cells.map((row) => row.map((v) => v ? "1" : "0").join("")).join("/");
  }

  function analyze(state) {
    return {
      size: state.size,
      generation: state.generation,
      population: population(state),
      historyLength: state.history.length,
      encoded: encode(state),
    };
  }

  return {
    MIN_SIDE, MAX_SIDE, clamp, empty, start, alive, neighbours, step, reverse,
    toggle, randomize, PATTERNS, place, population, encode, analyze,
  };
})();
