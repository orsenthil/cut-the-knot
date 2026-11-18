"use strict";

/*
 * The Affirmative Action Problem, from Bogomolny's applet AffirmativeAction.
 *
 * Nodes of a loopless graph are coloured black or white. A node is integrated
 * when at least as many of its neighbours have the other colour as its own:
 * a white node needs at least as many black neighbours as white ones, and a
 * black node needs at least as many white neighbours as black ones. A colouring
 * is integrated when every node is. The applet starts with a grid of twenty
 * randomly coloured nodes; clicking a node flips it.
 *
 * The key idea is Jim Propp's proof: an edge is balanced when its ends have
 * different colours, and a colouring with the most balanced edges must be
 * integrated — flipping a non-integrated node would create more balanced edges.
 * The logic test checks that statement on every small graph and colouring.
 *
 * No document, no window, no storage: one global, AffirmativeActionCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const AffirmativeActionCore = (() => {
  const BLACK = 1;
  const WHITE = 0;

  function start(options) {
    const opts = options || {};
    const rows = opts.rows === undefined ? 4 : Math.max(1, Math.trunc(Number(opts.rows)) || 4);
    const cols = opts.cols === undefined ? 5 : Math.max(1, Math.trunc(Number(opts.cols)) || 5);
    const random = opts.random || Math.random;
    const nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({ x: c, y: r, color: random() < 0.5 ? BLACK : WHITE });
      }
    }
    const edges = [];
    const at = (r, c) => r * cols + c;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) edges.push([at(r, c), at(r, c + 1)]);
        if (r + 1 < rows) edges.push([at(r, c), at(r + 1, c)]);
      }
    }
    return { nodes, edges, rows, cols };
  }

  function empty() {
    return { nodes: [], edges: [], rows: 4, cols: 5 };
  }

  /** Neighbour colour counts for a node, counting parallel edges once per edge. */
  function neighbourCounts(graph, index) {
    let same = 0;
    let other = 0;
    for (const [u, v] of graph.edges) {
      const neighbour = u === index ? v : v === index ? u : null;
      if (neighbour === null) continue;
      if (graph.nodes[neighbour].color === graph.nodes[index].color) same++;
      else other++;
    }
    return { same, other };
  }

  function isIntegratedNode(graph, index) {
    const { same, other } = neighbourCounts(graph, index);
    return other >= same;
  }

  function nonIntegrated(graph) {
    const out = [];
    for (let i = 0; i < graph.nodes.length; i++) if (!isIntegratedNode(graph, i)) out.push(i);
    return out;
  }

  function isIntegrated(graph) {
    return nonIntegrated(graph).length === 0;
  }

  function balancedEdges(graph) {
    let count = 0;
    for (const [u, v] of graph.edges) if (graph.nodes[u].color !== graph.nodes[v].color) count++;
    return count;
  }

  /** Flip one node's colour, as a click does. */
  function flip(graph, index) {
    if (index < 0 || index >= graph.nodes.length) return graph;
    const nodes = graph.nodes.slice();
    nodes[index] = { ...nodes[index], color: nodes[index].color === BLACK ? WHITE : BLACK };
    return { ...graph, nodes };
  }

  /** A colouring with the most balanced edges, found by hill-climbing flips. */
  function maximize(graph, random) {
    const rnd = random || Math.random;
    let best = graph;
    let bestScore = balancedEdges(best);
    for (let pass = 0; pass < 40; pass++) {
      let improved = false;
      const order = best.nodes.map((_, i) => i).sort(() => rnd() - 0.5);
      for (const i of order) {
        const next = flip(best, i);
        const score = balancedEdges(next);
        if (score > bestScore) {
          best = next;
          bestScore = score;
          improved = true;
        }
      }
      if (!improved) break;
    }
    return { graph: best, balanced: bestScore, integrated: isIntegrated(best) };
  }

  /** Add a link between two nodes; loops are refused. */
  function addEdge(graph, u, v) {
    if (u < 0 || v < 0 || u >= graph.nodes.length || v >= graph.nodes.length || u === v) return graph;
    return { ...graph, edges: graph.edges.concat([[Math.min(u, v), Math.max(u, v)]]) };
  }

  /** Add a node at the given coordinates with a given colour. */
  function addNode(graph, x, y, color) {
    return { ...graph, nodes: graph.nodes.concat([{ x, y, color: color === BLACK ? BLACK : WHITE }]) };
  }

  /** Remove the most recently added edge or node, with its incident edges. */
  function removeLast(graph) {
    if (graph.edges.length) return { ...graph, edges: graph.edges.slice(0, -1) };
    if (!graph.nodes.length) return graph;
    const last = graph.nodes.length - 1;
    return {
      ...graph,
      nodes: graph.nodes.slice(0, -1),
      edges: graph.edges.filter(([u, v]) => u !== last && v !== last),
    };
  }

  return {
    BLACK, WHITE, start, empty, neighbourCounts, isIntegratedNode, nonIntegrated,
    isIntegrated, balancedEdges, flip, maximize, addEdge, addNode, removeLast,
  };
})();
