/*
 * run_game_logic actions and saved-position reader for WGraphs.
 *
 * The core lives in wgraphs/ and is copied into src/generated/cores/ at build
 * time. It holds the applet's two weighted sample graphs and the two greedy
 * edge-marking rules: Kruskal (stop at a spanning tree) and Cheapest Link
 * (stop at a round trip through every dot). Every answer below is computed by
 * that core, never by a second set of rules. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["wgraphs"].WgraphsCore;

/** Pick one of the core's two sample graphs, by name or by 0-based index. */
function graphChoice(args: Json): { graph: string; g: any } {
  const C = core();
  const keys: string[] = Object.keys(C.GRAPHS);
  let key: string;
  if (typeof args.graph === "string") {
    key = args.graph;
  } else {
    const idx = Math.round(num(args, "graphIndex", 0));
    if (!Number.isInteger(idx) || idx < 0 || idx >= keys.length) {
      throw new Error(`graphIndex must be a whole number from 0 to ${keys.length - 1}`);
    }
    key = keys[idx];
  }
  if (!Object.prototype.hasOwnProperty.call(C.GRAPHS, key)) {
    throw new Error(`unknown graph "${key}": choose ${keys.join(" or ")}`);
  }
  return { graph: key, g: C.GRAPHS[key] };
}

/** A compact description of an edge, numbering the dots the way the page does. */
function edgeRow(e: any) {
  return { id: e.id, from: e.u + 1, to: e.v + 1, weight: e.w };
}

/** Rebuild the exact core position the page saved with Track.state. */
function readPosition(state: Json) {
  const C = core();
  const graph = typeof state.graph === "string" && Object.prototype.hasOwnProperty.call(C.GRAPHS, state.graph)
    ? state.graph as string
    : "small";
  const mode = state.mode === "kruskal" ? "kruskal" : "cheapest";
  const rawEdges: Json[] = Array.isArray(state.edges) ? state.edges as Json[] : [];
  const edges = rawEdges.map((e) => ({
    id: Math.round(num(e, "id")),
    u: Math.round(num(e, "u")),
    v: Math.round(num(e, "v")),
    w: num(e, "w"),
    status: Math.round(num(e, "status", C.ACTIVE)),
  }));
  const circuit = Array.isArray(state.circuit) ? numArray({ circuit: state.circuit }, "circuit") : null;
  const position = {
    graph,
    mode,
    n: C.GRAPHS[graph].nodes.length,
    edges,
    announcement: typeof state.announcement === "string" ? state.announcement : "",
    done: state.done === true,
    circuit,
  };
  return { C, graph, g: C.GRAPHS[graph], mode, position };
}

export function actions(): GameActions {
  return {
    minimum_spanning_tree: {
      describe:
        "Run Kruskal's rule on one of the applet's sample graphs ('small' or 'large', or graphIndex 0/1): take the cheapest edge that closes no circuit until every dot is joined. Gives the marked edges and their total weight, the edges refused for closing a circuit, and confirms the weight is the minimum with an independent Prim calculation.",
      args: '{ "graph": "small" }',
      run: (args) => {
        const C = core();
        const { graph, g } = graphChoice(args);
        const finished: any = C.kruskal(C.start({ graph, mode: "kruskal" }));
        const marked = finished.edges.filter((e: any) => e.status === C.SELECTED);
        const refused = finished.edges.filter((e: any) => e.status === C.DISQUALIFIED);
        const weight = C.totalWeight(finished);
        const minimum = C.mstWeight(g);
        const tree = C.isSpanningTree(finished);
        return {
          graph: g.label,
          dots: g.nodes.length,
          availableEdges: g.edges.length,
          markedEdges: marked.map(edgeRow),
          refusedEdges: refused.map(edgeRow),
          totalWeight: weight,
          minimumPossibleWeight: minimum,
          isSpanningTree: tree,
          isMinimum: tree && weight === minimum,
          finished: C.result(finished) === "done",
          note: `Kruskal's rule marks the cheapest edge that does not close a circuit. It chose ${marked.length} of ${g.edges.length} edges for a total weight of ${weight}; Prim's algorithm independently gives the same minimum ${minimum}, so ${tree && weight === minimum ? "this is a minimum spanning tree" : "this is not a minimum spanning tree"}. ${refused.length} edge(s) were refused for closing a circuit.`,
        };
      },
    },

    cheapest_link: {
      describe:
        "Run Cheapest Link on one of the applet's sample graphs ('small' or 'large', or graphIndex 0/1): repeatedly take the cheapest edge that gives no dot three edges and does not close a circuit early. Reports the marked and refused edges, the total weight and, if it succeeded, the Hamilton circuit (every dot once, in page numbering).",
      args: '{ "graph": "small" }',
      run: (args) => {
        const C = core();
        const { graph, g } = graphChoice(args);
        const finished: any = C.cheapestLink(C.start({ graph, mode: "cheapest" }));
        const marked = finished.edges.filter((e: any) => e.status === C.SELECTED);
        const refused = finished.edges.filter((e: any) => e.status === C.DISQUALIFIED);
        const circuit: number[] | null = finished.circuit;
        const hamilton = circuit !== null && circuit.length === g.nodes.length;
        return {
          graph: g.label,
          dots: g.nodes.length,
          markedEdges: marked.map(edgeRow),
          refusedEdges: refused.map(edgeRow),
          totalWeight: C.totalWeight(finished),
          circuit: circuit === null ? null : circuit.map((v) => v + 1),
          closesHamiltonCircuit: hamilton,
          finished: C.result(finished) === "done",
          note: `Cheapest Link may only close a circuit with the very last edge, when the circuit visits every dot. ${hamilton ? `It succeeded: the round trip goes through dots ${circuit!.map((v) => v + 1).join(" -> ")} -> ${circuit![0] + 1} with total weight ${C.totalWeight(finished)}.` : `It did not close a Hamilton circuit; it stopped after ${marked.length} marked edge(s), with ${refused.length} edge(s) refused for closing a small circuit or giving a dot three edges.`}`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported WGraphs state version ${stateVersion}`);
  const { C, graph, g, mode, position: current } = readPosition(state);
  const marked = current.edges.filter((e) => e.status === C.SELECTED);
  const rejected = current.edges.filter((e) => e.status === C.DISQUALIFIED);
  const total = C.totalWeight(current);
  const minimum = C.mstWeight(g);
  const circuit = current.circuit;
  const hamilton = circuit !== null && circuit.length === current.n;
  return {
    // The fields the page saved, with the same names.
    graph,
    mode,
    edges: current.edges,
    announcement: current.announcement,
    done: current.done,
    circuit,
    // What the core adds.
    markedEdges: marked.map(edgeRow),
    rejectedEdges: rejected.map(edgeRow),
    markedCount: C.selectedCount(current),
    totalWeight: total,
    cheapestAvailable: C.cheapestWeight(current),
    legalMoves: C.legalMoves(current),
    isSpanningTree: C.isSpanningTree(current),
    minimumSpanningTreeWeight: minimum,
    closesHamiltonCircuit: hamilton,
    result: C.result(current),
    note: `${g.label}, ${mode === "kruskal" ? "Kruskal" : "Cheapest Link"}: ${marked.length} edge(s) marked for a total weight of ${total}, ${rejected.length} edge(s) refused. ${circuit !== null ? (hamilton ? "The marked edges close a round trip through every dot." : "The marked edges close a circuit that does not visit every dot.") : C.isSpanningTree(current) ? "The marked edges are a spanning tree." : `The cheapest edge still available weighs ${C.cheapestWeight(current)}; the minimum spanning tree weighs ${minimum}.`}${current.done ? " The play is finished." : ""}`,
  };
}
