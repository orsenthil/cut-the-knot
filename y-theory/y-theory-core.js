"use strict";

/*
 * The game of Y, as illustrated by Bogomolny's YTheory applet.
 *
 * The board is a triangle of hexagonal cells with n cells on a side. Two
 * colours fill every cell; a player wins when cells of one colour form a
 * connected chain reaching all three sides. The applet does not play a game —
 * it demonstrates the reduction that proves Y cannot end in a draw: each
 * upward-pointing triangle of three cells becomes one cell of a board of size
 * n-1, coloured by the majority of the three.
 *
 * The key idea here is the cell model. Give a cell barycentric coordinates
 * (i, j, k) with i + j + k = n - 1; the three sides are i = 0, j = 0, k = 0,
 * and neighbouring cells differ by one in two of the coordinates. Reducing
 * replaces the triple (i,j,k), (i+1,j,k-1), (i,j+1,k-1) by one cell. The logic
 * test checks, over every colouring of the small boards, that every board has
 * exactly one winner and that reduction preserves it.
 *
 * No document, no window, no storage: one global, YTheoryCore. The position is
 * plain data so it can be saved and handed to the tutor.
 */
const YTheoryCore = (() => {
  const MIN_N = 1;
  const MAX_N = 12;
  const BLUE = "blue";
  const RED = "red";
  const COLORS = [BLUE, RED];
  const DELTAS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

  const index = (n, i, j) => i * n + j;

  function clampN(value) {
    const v = Math.trunc(Number(value));
    if (!Number.isFinite(v)) return 7;
    return Math.max(MIN_N, Math.min(MAX_N, v));
  }

  /** A random colouring of Y_n; cells outside the triangle stay null. */
  function start(options) {
    const opts = options || {};
    const n = opts.n === undefined ? 7 : clampN(opts.n);
    const random = opts.random || Math.random;
    const cells = Array(n * n).fill(null);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        cells[index(n, i, j)] = random() < 0.5 ? BLUE : RED;
      }
    }
    return { n, cells };
  }

  function coords(n, id) {
    const i = Math.floor(id / n);
    const j = id % n;
    return { i, j, k: n - 1 - i - j };
  }

  /** The six neighbours of a cell (those inside the triangle). */
  function neighbours(n, id) {
    const { i, j } = coords(n, id);
    const out = [];
    for (const [di, dj] of DELTAS) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii + jj >= n) continue;
      out.push(index(n, ii, jj));
    }
    return out;
  }

  /** The upward triangles of Y_n: (i,j), (i+1,j), (i,j+1). */
  function triples(n) {
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1 - i; j++) {
        out.push([index(n, i, j), index(n, i + 1, j), index(n, i, j + 1)]);
      }
    }
    return out;
  }

  /** The applet's MakeHit: the colour held by at least two of the three cells. */
  function majority(a, b, c) {
    return COLORS.find((color) => [a, b, c].filter((x) => x === color).length >= 2) || null;
  }

  /** The reduced board Y_(n-1), its cell (i,j) taking the majority of a triple. */
  function reduce(state) {
    if (state.n <= 1) return null;
    const n = state.n;
    const smaller = n - 1;
    const cells = Array(smaller * smaller).fill(null);
    for (const [a, b, c] of triples(n)) {
      const { i, j } = coords(n, a);
      cells[index(smaller, i, j)] = majority(state.cells[a], state.cells[b], state.cells[c]);
    }
    return { n: smaller, cells };
  }

  /** The component of `color` reaching all three sides, or null. */
  function winningChain(state, color) {
    const n = state.n;
    const ids = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const id = index(n, i, j);
        if (state.cells[id] === color) ids.push(id);
      }
    }
    const at = new Map(ids.map((id, k) => [id, k]));
    const parent = ids.map((_, k) => k);
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    for (const id of ids) {
      for (const other of neighbours(n, id)) {
        if (state.cells[other] === color) {
          const a = find(at.get(id));
          const b = find(at.get(other));
          if (a !== b) parent[b] = a;
        }
      }
    }
    const groups = new Map();
    for (const id of ids) {
      const root = find(at.get(id));
      if (!groups.has(root)) groups.set(root, { cells: [], sides: new Set() });
      const group = groups.get(root);
      group.cells.push(id);
      const { i, j, k } = coords(n, id);
      if (i === 0) group.sides.add(0);
      if (j === 0) group.sides.add(1);
      if (k === 0) group.sides.add(2);
    }
    for (const group of groups.values()) {
      if (group.sides.size === 3) return group.cells;
    }
    return null;
  }

  function winner(state, color) {
    return winningChain(state, color) !== null;
  }

  function winners(state) {
    return { blue: winner(state, BLUE), red: winner(state, RED) };
  }

  /** The three (n-1)-boards obtained by deleting one side of Y_n. */
  function subgame(state, side) {
    if (state.n <= 1) return null;
    const n = state.n;
    const smaller = n - 1;
    const cells = Array(smaller * smaller).fill(null);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const keep = side === 0 ? i > 0 : side === 1 ? j > 0 : i + j < n - 1;
        if (!keep) continue;
        const ni = side === 0 ? i - 1 : i;
        const nj = side === 1 ? j - 1 : j;
        cells[index(smaller, ni, nj)] = state.cells[index(n, i, j)];
      }
    }
    return { n: smaller, cells };
  }

  /** Meyers' criterion: a win here means at least two of the three subgames win. */
  function meyersWins(state, color) {
    if (state.n <= 1) return winner(state, color);
    const wins = [0, 1, 2].map((side) => winner(subgame(state, side), color));
    return wins.filter(Boolean).length >= 2;
  }

  /** Toggle one cell, as a click on the applet does. */
  function toggle(state, id) {
    if (!Number.isInteger(id) || id < 0 || id >= state.cells.length) return state;
    const color = state.cells[id];
    if (color !== BLUE && color !== RED) return state;
    const cells = state.cells.slice();
    cells[id] = color === BLUE ? RED : BLUE;
    return { n: state.n, cells };
  }

  return {
    MIN_N, MAX_N, BLUE, RED, COLORS, index, coords, clampN, start, neighbours,
    triples, majority, reduce, winningChain, winner, winners, subgame,
    meyersWins, toggle,
  };
})();
