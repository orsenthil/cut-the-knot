/*
 * run_game_logic actions and saved-position reader for the Affirmative Action
 * problem. The core (affirmative-action/ in the site, copied into
 * src/generated/cores/ at build time) knows the integrated test and the
 * maximize-by-balanced-edges search. See _shared.ts for the shape of a module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["affirmative-action"].AffirmativeActionCore;

type NodeIn = { color: number; x?: number; y?: number };

function readGraph(args: Json): { nodes: NodeIn[]; edges: number[][] } {
  const rawNodes = args.nodes;
  const rawEdges = args.edges;
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
    throw new Error("nodes and edges must be arrays");
  }
  const nodes = rawNodes.map((n, i) => {
    const node = n as Json;
    const color = Number(node.color);
    if (color !== 0 && color !== 1) throw new Error(`node ${i} must have colour 0 or 1`);
    return { color, x: Number(node.x) || 0, y: Number(node.y) || 0 };
  });
  const edges = rawEdges.map((e, i) => {
    if (!Array.isArray(e) || e.length !== 2) throw new Error(`edge ${i} must be a pair of node indices`);
    const u = Number(e[0]);
    const v = Number(e[1]);
    if (!Number.isInteger(u) || !Number.isInteger(v) || u < 0 || v < 0 || u >= nodes.length || v >= nodes.length || u === v) {
      throw new Error(`edge ${i} must join two distinct existing nodes (no loops)`);
    }
    return [Math.min(u, v), Math.max(u, v)];
  });
  return { nodes, edges };
}

export function actions(): GameActions {
  return {
    check_coloring: {
      describe:
        "For a coloured graph, list the non-integrated nodes, the balanced-edge count and whether every node is integrated.",
      args: '{ "nodes": [{"color":0},{"color":1},{"color":0}], "edges": [[0,1],[0,2]] }',
      run: (args) => {
        const C = core();
        const graph = readGraph(args);
        const bad = C.nonIntegrated(graph);
        return {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          balancedEdges: C.balancedEdges(graph),
          nonIntegrated: bad,
          integrated: bad.length === 0,
          detail: graph.nodes.map((_, i) => {
            const counts = C.neighbourCounts(graph, i);
            return { node: i, otherColourNeighbours: counts.other, sameColourNeighbours: counts.same, integrated: counts.other >= counts.same };
          }),
          note: "A node is integrated when at least as many incident edges are balanced as unbalanced.",
        };
      },
    },
    find_coloring: {
      describe:
        "Search for an integrated colouring by repeatedly flipping nodes that gain balanced edges, as in Propp's proof.",
      args: '{ "nodes": [{"color":0},{"color":0},{"color":0}], "edges": [[0,1],[1,2]] }',
      run: (args) => {
        const C = core();
        const result = C.maximize(readGraph(args));
        return {
          nodes: result.graph.nodes.map((n: NodeIn) => n.color),
          balancedEdges: result.balanced,
          nonIntegrated: C.nonIntegrated(result.graph),
          integrated: result.integrated,
          note: result.integrated
            ? "A colouring with the most balanced edges is always integrated."
            : "Hill climbing did not find an integrated colouring.",
        };
      },
    },
  };
}

/** What the core says about a saved board. */
export function position(state: Json): unknown {
  const C = core();
  const graph = readGraph(state);
  const bad = C.nonIntegrated(graph);
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    colours: graph.nodes.map((n) => n.color),
    balancedEdges: C.balancedEdges(graph),
    nonIntegrated: bad,
    integrated: bad.length === 0,
    note: bad.length === 0
      ? "Every node is integrated."
      : `${bad.length} node${bad.length === 1 ? " is" : "s are"} still outnumbered by their own colour.`,
  };
}
