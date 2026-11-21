"use strict";

/*
 * Euler & Hamilton Paths, from Bogomolny's applet GraphPractice.
 *
 * An Euler path uses every edge of a graph exactly once. A Hamilton path
 * visits every vertex exactly once. The applet lets the player click vertices
 * in sequence; used edges disappear, then reappear coloured when finished.
 *
 * The key idea is Euler's criterion: an Euler path exists exactly when the
 * graph is connected and has 0 or 2 odd-degree vertices (0 gives a cycle).
 * Hamilton paths have no such simple criterion and must be searched. The
 * logic test checks the criteria, the path validators and the examples.
 *
 * No document, no window, no storage: one global, EulerHamiltonPathsCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const EulerHamiltonPathsCore = (() => {
  /** Example graphs: vertices with coordinates and undirected edges. */
  const GRAPHS = [
    {
      name: "Triangle",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }],
      edges: [[0, 1], [1, 2], [2, 0]],
    },
    {
      name: "Square with a diagonal",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
    },
    {
      name: "House",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0.5, y: 1.6 }],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 3]],
    },
    {
      name: "Star",
      vertices: [{ x: 0.5, y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      edges: [[0, 1], [0, 2], [0, 3], [0, 4]],
    },
  ];

  function degrees(graph) {
    const d = graph.vertices.map(() => 0);
    for (const [u, v] of graph.edges) { d[u]++; d[v]++; }
    return d;
  }

  function connected(graph) {
    if (!graph.vertices.length) return true;
    const adj = graph.vertices.map(() => []);
    for (const [u, v] of graph.edges) { adj[u].push(v); adj[v].push(u); }
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const at = stack.pop();
      for (const n of adj[at]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    }
    return seen.size === graph.vertices.length;
  }

  function hasEulerPath(graph) {
    const odd = degrees(graph).filter((d) => d % 2 === 1).length;
    return connected(graph) && (odd === 0 || odd === 2);
  }

  function hasEulerCycle(graph) {
    return connected(graph) && degrees(graph).every((d) => d % 2 === 0);
  }

  /** Search for any Hamilton path by backtracking. */
  function hasHamiltonPath(graph) {
    const n = graph.vertices.length;
    if (!n) return false;
    const adj = graph.vertices.map(() => []);
    for (const [u, v] of graph.edges) { adj[u].push(v); adj[v].push(u); }
    const walk = (at, seen) => {
      if (seen.size === n) return true;
      for (const next of adj[at]) {
        if (seen.has(next)) continue;
        seen.add(next);
        if (walk(next, seen)) return true;
        seen.delete(next);
      }
      return false;
    };
    for (let start = 0; start < n; start++) if (walk(start, new Set([start]))) return true;
    return false;
  }

  /** Validate a clicked sequence as an Euler path. */
  function checkEuler(graph, sequence) {
    if (!sequence.length) return { valid: false, why: "No vertices were chosen." };
    if (sequence.some((v) => v < 0 || v >= graph.vertices.length)) return { valid: false, why: "Unknown vertex." };
    const used = new Set();
    for (let i = 0; i + 1 < sequence.length; i++) {
      const key = `${Math.min(sequence[i], sequence[i + 1])}-${Math.max(sequence[i], sequence[i + 1])}`;
      if (!graph.edges.some(([u, v]) => `${Math.min(u, v)}-${Math.max(u, v)}` === key)) return { valid: false, why: "Those two vertices are not joined." };
      if (used.has(key)) return { valid: false, why: "That edge was already used." };
      used.add(key);
    }
    return used.size === graph.edges.length
      ? { valid: true, why: `You used all ${graph.edges.length} edges exactly once.` }
      : { valid: false, why: `${graph.edges.length - used.size} edges left to cross.` };
  }

  /** Validate a clicked sequence as a Hamilton path. */
  function checkHamilton(graph, sequence) {
    if (!sequence.length) return { valid: false, why: "No vertices were chosen." };
    const seen = new Set();
    for (const v of sequence) {
      if (v < 0 || v >= graph.vertices.length) return { valid: false, why: "Unknown vertex." };
      if (seen.has(v)) return { valid: false, why: "That vertex was already visited." };
      seen.add(v);
    }
    for (let i = 0; i + 1 < sequence.length; i++) {
      if (!graph.edges.some(([u, v]) => (u === sequence[i] && v === sequence[i + 1]) || (v === sequence[i] && u === sequence[i + 1]))) {
        return { valid: false, why: "Those two vertices are not joined." };
      }
    }
    return seen.size === graph.vertices.length
      ? { valid: true, why: `You visited all ${graph.vertices.length} vertices once.` }
      : { valid: false, why: `${graph.vertices.length - seen.size} vertices left to visit.` };
  }

  function start() {
    return { graph: 1, mode: "euler", sequence: [] };
  }

  function click(state, vertex) {
    const last = state.sequence[state.sequence.length - 1];
    if (last === undefined) return { ...state, sequence: [vertex] };
    return { ...state, sequence: [...state.sequence, vertex] };
  }

  return { GRAPHS, degrees, connected, hasEulerPath, hasEulerCycle, hasHamiltonPath, checkEuler, checkHamilton, start, click };
})();
