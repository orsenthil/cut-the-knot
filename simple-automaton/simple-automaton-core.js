"use strict";

/*
 * The simple cellular automaton from Bogomolny's SimpleAutomaton applet.
 *
 * A cell survives to the next generation when enough of the cells in its
 * little diagram are alive: itself and some of its neighbours. The five
 * rules are 2n (itself, north, east; need two), 3n (add south; need three),
 * 3d (itself and three cells to the east; need three), 4n (itself and all
 * four orthogonal neighbours; need four) and 4d (itself and the four
 * diagonal neighbours; need four). The grid has no wrap-around.
 *
 * Every finite population dies out under every rule, and for the 2n rule it
 * dies out in at most as many steps as there were live cells. Pure logic:
 * one global, plain JSON positions, no DOM and no storage.
 */
const SimpleAutomatonCore = (() => {
  const MIN_SIDE = 3;
  const MAX_SIDE = 20; // a readable grid on a page; the applet allows 400
  const RULES = ["2n", "3n", "3d", "4n", "4d"];
  const LABELS = {
    "2n": "self, above, right — at least 2",
    "3n": "self, above, right, below — at least 3",
    "3d": "self and three cells to the right — at least 3",
    "4n": "self and four side neighbours — at least 4",
    "4d": "self and four diagonal neighbours — at least 4",
  };
  // Offsets [di, dj] from the cell, transcribed from Automaton.Compute.
  const NEIGHBOURS = {
    "2n": [[0, 0], [-1, 0], [0, 1]],
    "3n": [[0, 0], [-1, 0], [0, 1], [1, 0]],
    "3d": [[0, 0], [-1, 1], [0, 1], [1, 1]],
    "4n": [[0, 0], [-1, 0], [0, 1], [1, 0], [0, -1]],
    "4d": [[0, 0], [-1, 1], [1, -1], [-1, -1], [1, 1]],
  };
  const THRESHOLD = { "2n": 1, "3n": 2, "3d": 2, "4n": 3, "4d": 3 };

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  function empty(side) {
    return Array.from({ length: side }, () => new Array(side).fill(0));
  }

  function population(grid) {
    return grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  /** One generation, with the same neighbour count the applet computes. */
  function step(grid, rule) {
    const offsets = NEIGHBOURS[rule] ?? NEIGHBOURS["2n"];
    const need = THRESHOLD[rule] ?? THRESHOLD["2n"];
    const n = grid.length;
    const next = empty(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let live = 0;
        for (const [di, dj] of offsets) {
          const x = i + di;
          const y = j + dj;
          if (x >= 0 && x < n && y >= 0 && y < n && grid[x][y]) live++;
        }
        next[i][j] = live > need ? 1 : 0;
      }
    }
    return next;
  }

  /** Iterate until nothing is alive, or until the guard is reached. */
  function extinguish(grid, rule, guard = 500) {
    let current = grid.map((row) => row.slice());
    let steps = 0;
    while (population(current) > 0 && steps < guard) {
      current = step(current, rule);
      steps++;
    }
    return { steps, alive: population(current), grid: current };
  }

  function randomGrid(side, density, random = Math.random) {
    return Array.from({ length: side }, () =>
      Array.from({ length: side }, () => (random() < density ? 1 : 0)));
  }

  function start(options = {}) {
    const side = clamp(options.side ?? 10, MIN_SIDE, MAX_SIDE);
    const rule = RULES.includes(options.rule) ? options.rule : "2n";
    const grid = options.grid
      ? options.grid.slice(0, side).map((row) => row.slice(0, side))
      : randomGrid(side, options.density ?? 0.35, options.random ?? Math.random);
    while (grid.length < side) grid.push(new Array(side).fill(0));
    grid.forEach((row) => { while (row.length < side) row.push(0); });
    return {
      side,
      rule,
      grid,
      steps: 0,
      running: false,
      message: "Step the automaton, or run it, and watch the live cells disappear.",
    };
  }

  function toggleCell(state, i, j) {
    if (i < 0 || i >= state.side || j < 0 || j >= state.side) return state;
    const grid = state.grid.map((row) => row.slice());
    grid[i][j] = grid[i][j] ? 0 : 1;
    return {
      ...state,
      grid,
      steps: 0,
      message: `Cell ${i + 1}, ${j + 1} is now ${grid[i][j] ? "alive" : "dead"}.`,
    };
  }

  function advance(state) {
    const grid = step(state.grid, state.rule);
    const alive = population(grid);
    return {
      ...state,
      grid,
      steps: state.steps + 1,
      message: alive === 0
        ? `All cells died out after ${state.steps + 1} ${state.steps === 0 ? "step" : "steps"}.`
        : `Step ${state.steps + 1}: ${alive} ${alive === 1 ? "cell is" : "cells are"} alive.`,
    };
  }

  function setRule(state, rule) {
    if (!RULES.includes(rule)) return state;
    return { ...state, rule, steps: 0, message: `Rule ${rule}: ${LABELS[rule]}.` };
  }

  function setSide(state, side) {
    const next = clamp(side, MIN_SIDE, MAX_SIDE);
    return {
      ...state,
      side: next,
      grid: randomGrid(next, 0.35),
      steps: 0,
      message: `A ${next} by ${next} grid with a fresh population.`,
    };
  }

  function randomize(state, random = Math.random) {
    return {
      ...state,
      grid: randomGrid(state.side, 0.35, random),
      steps: 0,
      message: "A fresh random population.",
    };
  }

  function clear(state) {
    return {
      ...state,
      grid: empty(state.side),
      steps: 0,
      message: "All cells are dead. Click cells to draw a population.",
    };
  }

  /** "done" when the population has died out. */
  function result(state) {
    return population(state.grid) === 0 && state.steps > 0 ? "done" : null;
  }

  return {
    MIN_SIDE, MAX_SIDE, RULES, LABELS, NEIGHBOURS, THRESHOLD,
    start, step, extinguish, population, randomGrid, toggleCell, advance,
    setRule, setSide, randomize, clear, result, empty,
  };
})();
