"use strict";

/*
 * Hex Can't End in a Draw (Bogomolny's HexTheory applet) - the boards.
 *
 * An N by N board (2 to 10, starting at 7) filled at random with red and blue.
 * Click a cell to swap its colour. Red wants a chain joining the top and
 * bottom rows, blue one joining the left and right columns. On the hexagonal
 * board exactly one of them always has it; the applet's square boards show
 * why the hexagons matter: with 4 neighbours a draw is possible, with 8 both
 * colours can win at once, and with 6 (four sides and one diagonal) it is
 * Hex again.
 *
 * Read off the bytecode of the CellCell classes the applet uses:
 *   - cells (I, J), I the row; Reset() colours each cell red with chance 1/2;
 *   - CellGame.SearchForOn/SearchForOff/SearchForChain: a depth-first search
 *     that tries neighbours in each table's own order and backtracks, from the
 *     blue cells of column 0 to column N-1 first, then from the red cells of
 *     row 0 to row N-1 (the names in the applet are the other way round);
 *   - the neighbour tables, in that order, below;
 *   - on the 8-neighbour board the applet throws the blue search away and only
 *     shows red; the port shows both, since both can win there.
 *
 * The search unmarks cells as it backs up, so it walks every simple path and
 * can take exponential time on a big board with no way through. Here a flood
 * fill decides first whether a chain exists, and the depth-first search, which
 * picks the same chain the applet drew, runs only then, with a step limit and a
 * shortest path as the fallback.
 *
 * galeWalk() is the "Separation edges" path the page describes (David Gale's
 * proof): start at the corner where the red top edge meets the blue left edge
 * and keep walking along cell sides with red on one side and blue on the other.
 * It can never revisit a vertex, so it must come out at another corner, and the
 * cells along it contain the winning chain.
 */

var HexDrawCore = (function () {
  const MIN_N = 2;
  const MAX_N = 10;
  const DEFAULT_N = 7;
  const RED = true; // the applet's "On"
  const BLUE = false;

  // [dI, dJ] in the applet's search order. red: CellGame On, blue: Off.
  const GRIDS = {
    hex: {
      label: "Hexagonal grid",
      red: [[1, -1], [1, 0], [0, 1], [0, -1], [-1, 1], [-1, 0]],
      blue: [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]],
    },
    sq4: {
      label: "4-grid",
      red: [[1, 0], [0, 1], [0, -1], [-1, 0]],
      blue: [[0, 1], [1, 0], [0, -1], [-1, 0]],
    },
    sq6: {
      label: "6-grid",
      red: [[1, 0], [0, 1], [1, 1], [0, -1], [-1, 0], [-1, -1]],
      blue: [[0, 1], [1, 0], [1, 1], [-1, 0], [0, -1], [-1, -1]],
    },
    sq8: {
      label: "8-grid",
      red: [[1, 0], [0, 1], [0, -1], [-1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
      blue: [[1, 0], [0, 1], [0, -1], [-1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    },
  };
  const STEP_LIMIT = 200000;

  /** Reset(): every cell red with probability 1/2. cells[i][j] is true for red. */
  function start(n, grid = "hex", rnd = Math.random) {
    const cells = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) row.push(rnd() < 0.5);
      cells.push(row);
    }
    return { n, grid, cells };
  }

  function toggle(s, i, j) {
    s.cells[i][j] = !s.cells[i][j];
  }

  const startsOf = (n, colour) => {
    const out = [];
    for (let k = 0; k < n; k++) out.push(colour === RED ? [0, k] : [k, 0]);
    return out;
  };
  const isGoal = (n, colour, i, j) => (colour === RED ? i === n - 1 : j === n - 1);

  /** Is there any chain of this colour? Flood fill. */
  function connects(s, colour) {
    const { n, cells } = s;
    const dirs = GRIDS[s.grid][colour === RED ? "red" : "blue"];
    const seen = cells.map((r) => r.map(() => false));
    const stack = [];
    for (const [i, j] of startsOf(n, colour)) if (cells[i][j] === colour) { seen[i][j] = true; stack.push([i, j]); }
    while (stack.length) {
      const [i, j] = stack.pop();
      if (isGoal(n, colour, i, j)) return true;
      for (const [di, dj] of dirs) {
        const a = i + di;
        const b = j + dj;
        if (a >= 0 && a < n && b >= 0 && b < n && !seen[a][b] && cells[a][b] === colour) {
          seen[a][b] = true;
          stack.push([a, b]);
        }
      }
    }
    return false;
  }

  /** The applet's SearchForChain: the first chain its depth-first search finds, as [i, j] cells. */
  function appletChain(s, colour) {
    const { n, cells } = s;
    const dirs = GRIDS[s.grid][colour === RED ? "red" : "blue"];
    const inChain = cells.map((r) => r.map(() => false));
    const path = [];
    let steps = 0;
    function search(i, j) {
      if (++steps > STEP_LIMIT) throw new Error("step limit");
      if (isGoal(n, colour, i, j)) return true;
      for (const [di, dj] of dirs) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || a >= n || b < 0 || b >= n) continue;
        if (cells[a][b] !== colour || inChain[a][b]) continue;
        path.push([a, b]);
        inChain[a][b] = true;
        if (search(a, b)) return true;
        inChain[a][b] = false;
        path.pop();
      }
      return false;
    }
    for (const [i, j] of startsOf(n, colour)) {
      if (cells[i][j] !== colour) continue;
      inChain[i][j] = true;
      path.push([i, j]);
      if (search(i, j)) return path;
      inChain[i][j] = false;
      path.pop();
    }
    return null;
  }

  /** Shortest chain, for when the depth-first search would take too long. */
  function shortestChain(s, colour) {
    const { n, cells } = s;
    const dirs = GRIDS[s.grid][colour === RED ? "red" : "blue"];
    const prev = new Map();
    const queue = [];
    for (const [i, j] of startsOf(n, colour)) if (cells[i][j] === colour) { prev.set(i * n + j, -1); queue.push([i, j]); }
    for (let q = 0; q < queue.length; q++) {
      const [i, j] = queue[q];
      if (isGoal(n, colour, i, j)) {
        const path = [];
        for (let k = i * n + j; k !== -1; k = prev.get(k)) path.unshift([Math.floor(k / n), k % n]);
        return path;
      }
      for (const [di, dj] of dirs) {
        const a = i + di;
        const b = j + dj;
        if (a >= 0 && a < n && b >= 0 && b < n && cells[a][b] === colour && !prev.has(a * n + b)) {
          prev.set(a * n + b, i * n + j);
          queue.push([a, b]);
        }
      }
    }
    return null;
  }

  function chainOf(s, colour) {
    if (!connects(s, colour)) return null;
    try {
      return appletChain(s, colour);
    } catch (e) {
      return shortestChain(s, colour);
    }
  }

  /** Both colours' chains, or null where a colour has none. */
  function chains(s) {
    return { red: chainOf(s, RED), blue: chainOf(s, BLUE) };
  }

  /* -------------------------------------------- Gale's walk, hex board only */

  // Pointy-topped hexagons, radius 1: centre of (i, j), and its six corners.
  const SQ3 = Math.sqrt(3);
  const centre = (i, j) => [SQ3 * (j + i / 2), 1.5 * i];
  const key = ([x, y]) => Math.round(x * 1000) + "," + Math.round(y * 1000);
  function corners(i, j) {
    const [x, y] = centre(i, j);
    const out = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 90);
      out.push([x + Math.cos(a), y + Math.sin(a)]);
    }
    return out;
  }

  /**
   * The board surrounded by a ring of edge cells: red above and below, blue
   * left and right (the four corner cells, which belong to no edge, are left
   * out). Every cell side with red on one side and blue on the other is an edge
   * of the walk's graph. Every vertex then has degree 0 or 2, except four, where
   * a red edge meets a blue edge; the walk runs between two of those.
   */
  function galeWalk(s) {
    const { n, cells } = s;
    const colourAt = (i, j) => {
      const outI = i < 0 || i >= n;
      const outJ = j < 0 || j >= n;
      if (outI && outJ) return null;
      if (outI) return RED;
      if (outJ) return BLUE;
      return cells[i][j];
    };
    const adj = new Map(); // vertex key -> [{to, cells}]
    const point = new Map();
    const addEdge = (p, q, ci, cj) => {
      const kp = key(p);
      const kq = key(q);
      point.set(kp, p);
      point.set(kq, q);
      if (!adj.has(kp)) adj.set(kp, []);
      if (!adj.has(kq)) adj.set(kq, []);
      adj.get(kp).push({ to: kq, cells: [ci, cj] });
      adj.get(kq).push({ to: kp, cells: [ci, cj] });
    };
    for (let i = -1; i <= n; i++) {
      for (let j = -1; j <= n; j++) {
        const c = colourAt(i, j);
        if (c === null) continue;
        // each pair once: the three "forward" neighbours
        for (const [di, dj] of [[0, 1], [1, 0], [1, -1]]) {
          const a = i + di;
          const b = j + dj;
          if (a < -1 || a > n || b < -1 || b > n) continue;
          const d = colourAt(a, b);
          if (d === null || d === c) continue;
          const shared = corners(i, j).filter((p) => corners(a, b).some((q) => key(p) === key(q)));
          if (shared.length === 2) addEdge(shared[0], shared[1], [i, j], [a, b]);
        }
      }
    }
    // Start where the red top edge meets the blue left edge: the shared corner
    // of edge cells (-1, 0) and (0, -1), which has degree 1.
    const startKey = [...adj.keys()].find((k) => adj.get(k).length === 1 &&
      corners(-1, 0).some((p) => key(p) === k) && corners(0, -1).some((p) => key(p) === k));
    const walk = [point.get(startKey)];
    const touched = [];
    const visited = new Set([startKey]);
    let cur = startKey;
    let prev = null;
    for (;;) {
      const next = adj.get(cur).find((e) => e.to !== prev);
      if (!next) break;
      if (visited.has(next.to)) return { points: walk, touched, revisited: true };
      touched.push(next.cells);
      visited.add(next.to);
      prev = cur;
      cur = next.to;
      walk.push(point.get(cur));
      if (adj.get(cur).length === 1) break;
    }
    return { points: walk, touched, revisited: false, endDegree: adj.get(cur).length };
  }

  /** Which colour's cells along the walk join that colour's two edges. */
  function walkWinner(s, walk) {
    const { n, cells } = s;
    const on = (colour) => {
      const set = new Set();
      for (const pair of walk.touched) {
        for (const [i, j] of pair) if (i >= 0 && i < n && j >= 0 && j < n && cells[i][j] === colour) set.add(i * n + j);
      }
      const board = cells.map((r, i) => r.map((v, j) => v === colour && set.has(i * n + j)));
      return connects({ n, grid: "hex", cells: board.map((r) => r.map((v) => (v ? colour : !colour))) }, colour);
    };
    const r = on(RED);
    const b = on(BLUE);
    return r && !b ? "red" : b && !r ? "blue" : r && b ? "both" : "neither";
  }

  return {
    MIN_N, MAX_N, DEFAULT_N, RED, BLUE, GRIDS, STEP_LIMIT,
    start, toggle, connects, appletChain, shortestChain, chains, galeWalk, walkWinner, centre, corners,
  };
})();
