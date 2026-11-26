"use strict";

/*
 * WGraphs, from Alexander Bogomolny's applet WGraphs: Cheapest Link and
 * Kruskal's algorithms on a weighted graph. The player marks the cheapest
 * unmarked edge; an edge is refused if it closes a circuit (except for the
 * very last edge of a Hamilton circuit) or, in Cheapest Link, would give a
 * dot three marked edges. Kruskal stops with a spanning tree; Cheapest Link
 * stops with a round trip through every dot.
 *
 * The key idea is that both algorithms only ever need the sorted edge list
 * and the components of the edges already marked. This file is the game's
 * logic and nothing else: no document, no window, no storage. It defines one
 * global, WgraphsCore, so a page loads it with a plain <script> and
 * porting/check-wgraphs.mjs loads it in Node. The position is plain data
 * (numbers, strings, arrays, plain objects), so it can be saved and handed
 * to the tutor as it is. Functions take a position and return a new one.
 *
 * The two graphs are the applet's own examples, with its node coordinates
 * (fractions of the canvas) and edge weights taken from the page's APPLET
 * parameters. Edge ids are the original edge[0], edge[1], ... numbers.
 */

const WgraphsCore = (() => {
  const SMALL = {
    key: "small",
    label: "Six dots",
    nodes: [[0.2, 0.25], [0.8, 0.25], [0.4, 0.5], [0.7, 0.5], [0.2, 0.75], [0.8, 0.75]],
    edges: [
      [0, 1, 12], [0, 2, 4], [0, 3, 2], [0, 4, 6], [1, 3, 3], [1, 5, 3],
      [2, 3, 11], [2, 4, 8], [2, 5, 9], [3, 5, 11], [4, 5, 4],
    ],
  };
  const LARGE = {
    key: "large",
    label: "Eighteen dots",
    nodes: [
      [0.3, 0.4], [0.7, 0.4], [0.35, 0.5], [0.65, 0.5], [0.2, 0.6], [0.3, 0.6],
      [0.7, 0.6], [0.8, 0.6], [0.3, 0.8], [0.7, 0.8], [0.3, 0.3], [0.7, 0.3],
      [0.15, 0.62], [0.25, 0.82], [0.85, 0.62], [0.75, 0.82], [0.35, 0.7], [0.65, 0.7],
    ],
    edges: [
      [0, 1, 25], [0, 2, 22], [0, 4, 4], [0, 10, 11], [1, 3, 4], [1, 7, 8],
      [1, 11, 6], [2, 3, 8], [2, 5, 5], [2, 17, 9], [3, 6, 16], [4, 5, 13],
      [4, 8, 12], [4, 12, 8], [5, 16, 6], [6, 7, 17], [6, 17, 7], [7, 9, 14],
      [7, 14, 9], [8, 9, 9], [8, 13, 13], [8, 16, 16], [9, 15, 7], [10, 11, 7],
      [12, 13, 5], [14, 15, 18], [16, 17, 13],
    ],
  };
  const GRAPHS = { small: SMALL, large: LARGE };
  const ACTIVE = 0, SELECTED = 1, DISQUALIFIED = -1;

  /** The position a new game starts from. */
  function start(options = {}) {
    const graph = Object.prototype.hasOwnProperty.call(GRAPHS, options.graph) ? options.graph : "small";
    const mode = options.mode === "kruskal" ? "kruskal" : "cheapest";
    const g = GRAPHS[graph];
    // PriorityPicker.InsertWeighted: insertion before the first edge with a
    // strictly greater weight, so equal weights keep their original order.
    const edges = g.edges
      .map(([u, v, w], id) => ({ id, u, v, w, status: ACTIVE }))
      .sort((a, b) => a.w - b.w || a.id - b.id);
    return { graph, mode, edges, announcement: "", done: false, circuit: null };
  }

  const size = (s) => s.n || GRAPHS[s.graph].nodes.length;
  const withStatus = (s, status) => s.edges.filter((e) => e.status === status);
  const totalWeight = (s) => withStatus(s, SELECTED).reduce((sum, e) => sum + e.w, 0);
  const selectedCount = (s) => withStatus(s, SELECTED).length;

  /** The cheapest weight still available to mark. */
  function cheapestWeight(s) {
    const active = withStatus(s, ACTIVE);
    return active.length ? Math.min(...active.map((e) => e.w)) : null;
  }

  /** Edge ids the applet would accept if clicked now (marked edges can be unmarked). */
  function legalMoves(s) {
    const min = cheapestWeight(s);
    return s.edges.filter((e) => e.status === SELECTED || (e.status === ACTIVE && e.w === min)).map((e) => e.id);
  }

  /** The vertices of a circuit made by the marked edges plus one candidate edge. */
  function findCycle(s, candidateId) {
    const adj = Array.from({ length: size(s) }, () => []);
    for (const e of s.edges) {
      if (e.status === SELECTED || e.id === candidateId) {
        adj[e.u].push(e.v);
        adj[e.v].push(e.u);
      }
    }
    const seen = new Array(size(s)).fill(false);
    const path = [];
    let cycle = null;
    function walk(v, parent) {
      seen[v] = true;
      path.push(v);
      for (const next of adj[v]) {
        if (next === parent) continue;
        if (seen[next]) {
          cycle = path.slice(path.indexOf(next));
          return true;
        }
        if (walk(next, v)) return true;
      }
      path.pop();
      seen[v] = false;
      return false;
    }
    for (let v = 0; v < size(s) && !cycle; v++) if (!seen[v]) walk(v, -1);
    return cycle;
  }

  function degree(s, v) {
    return s.edges.filter((e) => e.status === SELECTED && (e.u === v || e.v === v)).length;
  }

  /** Are the marked edges a tree touching every dot? */
  function isSpanningTree(s) {
    const chosen = withStatus(s, SELECTED);
    if (chosen.length !== size(s) - 1 || findCycle(s, -1)) return false;
    const adj = Array.from({ length: size(s) }, () => []);
    for (const e of chosen) { adj[e.u].push(e.v); adj[e.v].push(e.u); }
    const seen = new Array(size(s)).fill(false);
    const stack = [0];
    seen[0] = true;
    while (stack.length) {
      const v = stack.pop();
      for (const next of adj[v]) if (!seen[next]) { seen[next] = true; stack.push(next); }
    }
    return seen.every(Boolean);
  }

  /** "done" when the algorithm has finished, else null. */
  function result(s) {
    return s.done ? "done" : null;
  }

  /**
   * Click edge `id`. The messages are the applet's own Announcement strings.
   * A refused click returns a new position with the message; a click on a
   * marked edge unmarks it, as in the applet's IsHit selected branch.
   */
  function move(s, id) {
    const at = s.edges.findIndex((e) => e.id === id);
    if (at < 0) return null;
    const clicked = s.edges[at];
    const edges = s.edges.map((e) => ({ ...e }));
    const next = { graph: s.graph, mode: s.mode, ...(s.n === undefined ? {} : { n: s.n }), edges, announcement: "", done: s.done, circuit: s.circuit };

    if (clicked.status === DISQUALIFIED) {
      next.announcement = "You tried this one before.";
      return next;
    }
    if (clicked.status === SELECTED) {
      edges[at].status = ACTIVE;
      next.announcement = "Edge unmarked.";
      next.done = false;
      next.circuit = null;
      return next;
    }
    if (clicked.w > cheapestWeight(s)) {
      next.announcement = "It's not the cheapest possible. Try again.";
      return next;
    }

    const cycle = findCycle(s, id);
    if (s.mode === "cheapest") {
      if (cycle) {
        // The circuit is allowed only as the very last edge, when it visits
        // every dot: that is the applet's GetCircuitLength() === node count.
        if (cycle.length === size(s)) {
          edges[at].status = SELECTED;
          next.done = true;
          next.circuit = cycle;
          next.announcement = `Good. You are done. The total weight equals ${totalWeight(next)}.`;
        } else {
          edges[at].status = DISQUALIFIED;
          next.announcement = "This would be a circuit.";
        }
      } else if (degree(s, clicked.u) >= 2 || degree(s, clicked.v) >= 2) {
        edges[at].status = DISQUALIFIED;
        next.announcement = "You'd have three incident edges at a node.";
      } else {
        edges[at].status = SELECTED;
      }
    } else {
      if (cycle) {
        edges[at].status = DISQUALIFIED;
        next.announcement = "This would be a circuit.";
      } else {
        edges[at].status = SELECTED;
        // The applet's NumSelectedEdges() counts from 1 and so says "done"
        // one edge early; here the count starts at 0, so the tree really
        // spans all dots before the announcement (see the maths section).
        if (selectedCount(next) === size(s) - 1) {
          next.done = true;
          next.announcement = `Good. You are done. The total weight equals ${totalWeight(next)}.`;
        }
      }
    }
    return next;
  }

  /** Click the cheapest available edge until the algorithm stops. */
  function autoRun(s) {
    let state = s;
    for (let guard = 0; guard < 200 && !state.done; guard++) {
      const ids = state.edges.filter((e) => e.status === ACTIVE && e.w === cheapestWeight(state)).map((e) => e.id);
      if (!ids.length) break;
      state = move(state, ids[0]);
    }
    return state;
  }

  /** The two algorithms, run to the end from any position. */
  const cheapestLink = (s) => autoRun({ ...s, mode: "cheapest" });
  const kruskal = (s) => autoRun({ ...s, mode: "kruskal" });

  /* --------------------------------------------------------- standalone checks */

  /** A minimum spanning tree's weight, by Prim's algorithm (brute force check). */
  function mstWeight(graph) {
    const n = graph.nodes.length;
    const w = Array.from({ length: n }, () => new Array(n).fill(Infinity));
    for (const [u, v, weight] of graph.edges) { w[u][v] = weight; w[v][u] = weight; }
    const used = new Array(n).fill(false), best = new Array(n).fill(Infinity);
    best[0] = 0;
    let total = 0;
    for (let k = 0; k < n; k++) {
      let v = -1;
      for (let i = 0; i < n; i++) if (!used[i] && (v < 0 || best[i] < best[v])) v = i;
      if (v < 0 || !isFinite(best[v])) return null; // disconnected
      used[v] = true;
      total += best[v];
      for (let i = 0; i < n; i++) if (!used[i] && w[v][i] < best[i]) best[i] = w[v][i];
    }
    return total;
  }

  /** Kruskal's algorithm as the page describes it, independent of the UI. */
  function kruskalWeight(graph) {
    let state = start({ graph: graph.key || "small", mode: "kruskal" });
    if (!GRAPHS[state.graph] || GRAPHS[state.graph] !== graph) {
      // An ad-hoc graph: rebuild the state with its own edges.
      state = {
        graph: null, mode: "kruskal",
        edges: graph.edges.map(([u, v, weight], id) => ({ id, u, v, w: weight, status: ACTIVE }))
          .sort((a, b) => a.w - b.w || a.id - b.id),
        announcement: "", done: false, circuit: null,
      };
      // findCycle() needs a node count; supply it on the position.
      state.n = graph.nodes.length;
    }
    state = autoRun(state);
    return totalWeight(state);
  }

  return {
    GRAPHS, SMALL, LARGE, ACTIVE, SELECTED, DISQUALIFIED,
    start, legalMoves, move, result, autoRun, cheapestLink, kruskal,
    totalWeight, selectedCount, cheapestWeight, findCycle, degree, isSpanningTree,
    mstWeight, kruskalWeight, size,
  };
})();
