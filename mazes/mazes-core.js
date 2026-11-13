"use strict";

/*
 * Mazes (Bogomolny's Mazes applet) — grid graph, Prim / Kruskal spanning trees,
 * and DFS solve.
 *
 * The rectangular grid is an undirected weighted graph. Each cell gets a random
 * permutation of direction-weights (Permutation.CreateRandom in ReplaceZero
 * mode: values {1..N} with 0 written as N, then Fisher–Yates). Horizontal and
 * vertical neighbours share one edge; AddNorth / AddWest create it, AddEast /
 * AddSouth only add the reverse link so the grid does not wrap.
 *
 * SortedVectorCI inserts an edge when new.Compare(existing) is true, and
 * MazeEdge.Compare is weight_new > weight_old, so the fringe / edge list is
 * heaviest-first. Prim and Kruskal therefore grow a *maximum* spanning tree
 * (the page's write-up describes the dual minimum case; the proof is
 * symmetric). DFS on the finished tree walks forward on untraversed tree
 * edges and backtracks on edges with Traversed == 1.
 *
 * porting/check-mazes.mjs re-transcribes Prim / Kruskal / DFS and checks tree
 * invariants, the page's |V| = |E| + 1 characterisation, and that both
 * algorithms span the active cells.
 */

var MazesCore = (function () {
  const MIN = 2;
  const MAX = 50;
  const DEFAULT_NX = 25;
  const DEFAULT_NY = 20;

  const LIGHT = 1;
  const STANDARD = 2;
  const HEAVY = 3;
  const VERY_HEAVY = 10;

  function clamp(n, lo, hi) {
    n = n | 0;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  /** Permutation.CreateRandom with m_Mode = ReplaceZero (default). */
  function createRandomPerm(n, rand) {
    const values = new Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) values[i] = n;
      else values[i] = i;
    }
    let size = n;
    while (size > 1) {
      const j = Math.floor(rand() * size);
      const k = size - 1;
      const t = values[k];
      values[k] = values[j];
      values[j] = t;
      size--;
    }
    return values;
  }

  /**
   * SortedVectorCI.addElement: insert before the first existing element that
   * the new one Compare()-beats (weight_new > weight_old); else append.
   */
  function sortedInsert(list, edge) {
    for (let i = 0; i < list.length; i++) {
      if (edge.weight > list[i].weight) {
        list.splice(i, 0, edge);
        return;
      }
    }
    list.push(edge);
  }

  function makeNode(id, x, y) {
    return { id, x, y, links: [] };
  }

  function makeEdge(a, b, weight) {
    return {
      a, b, weight,
      removed: 0,
      traversed: 0,
    };
  }

  function otherEnd(edge, node) {
    if (edge.a === node) return edge.b;
    if (edge.b === node) return edge.a;
    return null;
  }

  function edgeKey(a, b) {
    const i = a.id < b.id ? a.id : b.id;
    const j = a.id < b.id ? b.id : a.id;
    return i + "," + j;
  }

  function buildGrid(nx, ny, rand) {
    const nodes = [];
    let id = 0;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        nodes.push(makeNode(id++, x, y));
      }
    }
    const edges = [];
    const byNode = new Map();
    for (const n of nodes) byNode.set(n, []);

    function addEdge(a, b, weight) {
      const e = makeEdge(a, b, weight);
      a.links.push(b);
      sortedInsert(edges, e);
      byNode.get(a).push(e);
      byNode.get(b).push(e);
    }

    function addLinkOnly(a, b) {
      a.links.push(b);
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const north = i - nx;
      const west = i - 1;
      const east = i + 1;
      const south = i + nx;
      const perm = createRandomPerm(4, rand);
      // AddNorth(node, northIdx, 1+perm.at(0))
      if (north >= 0) {
        const n = nodes[north];
        if (n) addEdge(n, node, perm[0] + 1);
      }
      // AddWest — skip if west neighbour is on the right edge (no wrap)
      if (west >= 0) {
        const w = nodes[west];
        if (w && w.x !== nx - 1) addEdge(w, node, perm[1] + 1);
      }
      // AddEast — link only; edge is created from the east cell's AddWest
      if (east < nx * ny) {
        const e = nodes[east];
        if (e && e.x !== 0) addLinkOnly(node, e);
      }
      // AddSouth — link only
      if (south < nx * ny) {
        const s = nodes[south];
        if (s) addLinkOnly(node, s);
      }
    }

    return { nx, ny, nodes, edges, byNode, removed: [], start: null, end: null };
  }

  function setStart(maze, node) {
    if (!node || node === maze.start || node === maze.end) return;
    if (maze.removed.includes(node)) return;
    maze.start = node;
    const list = maze.byNode.get(node) || [];
    for (const e of list) {
      const o = otherEnd(e, node);
      if (!o || maze.removed.includes(o) || o === maze.end) continue;
      e.weight = LIGHT;
      // re-sort whole edge list would be heavy; weights used at algorithm start
    }
  }

  function setEnd(maze, node) {
    if (!node || node === maze.start || node === maze.end) return;
    if (maze.removed.includes(node)) return;
    maze.end = node;
    const list = maze.byNode.get(node) || [];
    for (const e of list) {
      const o = otherEnd(e, node);
      if (!o || maze.removed.includes(o) || o === maze.start) continue;
      e.weight = list.length > 3 ? VERY_HEAVY : LIGHT;
    }
  }

  /** Applet Reset: random start on top row, random end on bottom row. */
  function placeDefaultEnds(maze, rand) {
    const colS = Math.floor(rand() * maze.nx);
    const colE = Math.floor(rand() * maze.nx);
    maze.start = maze.nodes[colS];
    maze.end = maze.nodes[maze.nx * (maze.ny - 1) + colE];
    // SetStartNode(int,int) / SetEndNode(int,int): lighten the vertical edge
    // into the interior only.
    function lightBetween(a, b) {
      if (!a || !b) return;
      const list = maze.byNode.get(a) || [];
      for (const e of list) {
        if (otherEnd(e, a) === b) e.weight = LIGHT;
      }
    }
    lightBetween(maze.start, maze.nodes[colS + maze.nx]);
    lightBetween(maze.end, maze.nodes[maze.nx * (maze.ny - 2) + colE]);
  }

  function activeNodes(maze) {
    return maze.nodes.filter((n) => !maze.removed.includes(n));
  }

  function removeNode(maze, node) {
    if (!node || maze.removed.includes(node)) return;
    const idx = maze.nodes.indexOf(node);
    // keep in nodes array for coordinate lookup; track in removed
    maze.removed.push(node);
    const list = maze.byNode.get(node) || [];
    for (const e of list) {
      e.removed++;
      e.weight = STANDARD;
    }
    if (maze.start === node) maze.start = null;
    if (maze.end === node) maze.end = null;
  }

  function restoreLast(maze) {
    if (!maze.removed.length) return null;
    const node = maze.removed.pop();
    const list = maze.byNode.get(node) || [];
    for (const e of list) {
      if (e.removed > 0) e.removed--;
    }
    return node;
  }

  function restoreNode(maze, node) {
    const i = maze.removed.indexOf(node);
    if (i < 0) return;
    maze.removed.splice(i, 1);
    const list = maze.byNode.get(node) || [];
    for (const e of list) {
      if (e.removed > 0) e.removed--;
    }
  }

  function isActive(maze, node) {
    return node && !maze.removed.includes(node);
  }

  /* -------------------- Prim ------------------------------------------------ */

  function primStart(maze) {
    const treeNodes = new Set();
    const treeEdges = [];
    const fringe = [];
    const start = maze.start;
    if (!start || !isActive(maze, start)) {
      return { treeNodes, treeEdges, fringe, done: true };
    }

    function addNode(node) {
      treeNodes.add(node);
      const list = maze.byNode.get(node) || [];
      for (const e of list) {
        if (e.removed) continue;
        const o = otherEnd(e, node);
        if (!isActive(maze, o)) continue;
        if (!treeNodes.has(o)) sortedInsert(fringe, e);
        else {
          const i = fringe.indexOf(e);
          if (i >= 0) fringe.splice(i, 1);
        }
      }
    }

    addNode(start);
    return { treeNodes, treeEdges, fringe, done: false, addNode };
  }

  function primStep(state, maze) {
    if (state.done) return false;
    if (state.treeNodes.size >= activeNodes(maze).length) {
      state.done = true;
      return false;
    }
    if (!state.fringe.length) {
      state.done = true;
      return false;
    }
    const e = state.fringe[0];
    let neu = null;
    if (state.treeNodes.has(e.a)) neu = e.b;
    else if (state.treeNodes.has(e.b)) neu = e.a;
    if (neu && isActive(maze, neu) && !state.treeNodes.has(neu)) {
      state.addNode(neu); // may already drop e from the fringe
      state.treeEdges.push(e);
    }
    // Applet: FringeEdges.removeElement(e) — no-op if AddNode already removed it.
    const i = state.fringe.indexOf(e);
    if (i >= 0) state.fringe.splice(i, 1);
    return true;
  }

  function primRun(maze) {
    const state = primStart(maze);
    while (primStep(state, maze)) { /* run */ }
    return state;
  }

  /* -------------------- Kruskal --------------------------------------------- */

  function kruskalStart(maze) {
    const trees = new Map();
    const treeNodes = new Set();
    const treeEdges = [];
    for (const n of activeNodes(maze)) {
      const v = [n];
      trees.set(n, v);
      treeNodes.add(n);
    }
    // PassingEdges: copy of Edges in current (heaviest-first) order, skipping
    // removed. Applet copies all then CouldBeUsed rejects; we skip removed.
    const passing = maze.edges.filter((e) => !e.removed);
    return { trees, treeNodes, treeEdges, passing, done: false };
  }

  function kruskalCouldUse(state, edge) {
    const t1 = state.trees.get(edge.a);
    const t2 = state.trees.get(edge.b);
    if (!t1 || !t2 || t1 === t2) return false;
    for (const n of t2) t1.push(n);
    for (const n of t1) state.trees.set(n, t1);
    return true;
  }

  function kruskalStep(state) {
    if (state.done) return false;
    if (!state.passing.length || state.treeEdges.length >= state.treeNodes.size - 1) {
      state.done = true;
      return false;
    }
    let chosen = null;
    while (state.passing.length) {
      const e = state.passing.shift();
      if (kruskalCouldUse(state, e)) {
        chosen = e;
        break;
      }
    }
    if (!chosen) {
      state.done = true;
      return false;
    }
    state.treeEdges.push(chosen);
    return true;
  }

  function kruskalRun(maze) {
    const state = kruskalStart(maze);
    while (kruskalStep(state)) { /* run */ }
    return state;
  }

  /* -------------------- DFS solve ------------------------------------------- */

  function dfsStart(maze, treeEdges) {
    const treeSet = new Set(treeEdges);
    for (const e of treeEdges) e.traversed = 0;
    return {
      current: maze.start,
      treeSet,
      done: false,
      pathEdges: [],
    };
  }

  function dfsStep(state, maze) {
    if (state.done) return false;
    if (!state.current || state.current === maze.end) {
      state.done = true;
      return false;
    }
    const list = maze.byNode.get(state.current) || [];
    // Forward: untraversed tree edge
    for (const e of list) {
      if (!state.treeSet.has(e)) continue;
      if (e.traversed) continue;
      state.current = otherEnd(e, state.current);
      e.traversed++;
      state.pathEdges.push(e);
      return true;
    }
    // Backtrack: traversed exactly once
    for (const e of list) {
      if (!state.treeSet.has(e)) continue;
      if (e.traversed !== 1) continue;
      state.current = otherEnd(e, state.current);
      e.traversed++;
      return true;
    }
    state.done = true;
    return false;
  }

  function dfsRun(maze, treeEdges) {
    const state = dfsStart(maze, treeEdges);
    while (dfsStep(state, maze)) { /* run */ }
    return state;
  }

  function reset(nx, ny, rand) {
    const R = rand || Math.random;
    const maze = buildGrid(
      clamp(nx == null ? DEFAULT_NX : nx, MIN, MAX),
      clamp(ny == null ? DEFAULT_NY : ny, MIN, MAX),
      R,
    );
    placeDefaultEnds(maze, R);
    return maze;
  }

  function isTreeEdge(treeEdges, a, b) {
    for (const e of treeEdges) {
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return true;
    }
    return false;
  }

  return {
    MIN, MAX, DEFAULT_NX, DEFAULT_NY,
    LIGHT, STANDARD, HEAVY, VERY_HEAVY,
    createRandomPerm, sortedInsert, buildGrid, reset,
    setStart, setEnd, removeNode, restoreLast, restoreNode,
    activeNodes, isActive, otherEnd, edgeKey, isTreeEdge,
    primStart, primStep, primRun,
    kruskalStart, kruskalStep, kruskalRun,
    dfsStart, dfsStep, dfsRun,
  };
})();
