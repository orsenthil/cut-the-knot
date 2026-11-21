/*
 * run_game_logic actions and saved-position reader for Euler & Hamilton Paths.
 * The core lives in euler-hamilton-paths/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["euler-hamilton-paths"].EulerHamiltonPathsCore;

export function actions(): GameActions {
  return {
    check_path: {
      describe: "Validate a clicked vertex sequence as an Euler path (every edge once) or a Hamilton path (every vertex once), and say whether such a path exists.",
      args: '{ "graph": 0, "mode": "euler", "sequence": [0,1,2,0] }',
      run: (args) => {
        const C = core();
        const graphIndex = num(args, "graph", 0);
        if (!Number.isInteger(graphIndex) || graphIndex < 0 || graphIndex >= C.GRAPHS.length) throw new Error("graph is out of range");
        const graph = C.GRAPHS[graphIndex];
        const mode = args.mode === "hamilton" ? "hamilton" : "euler";
        const seq = Array.isArray(args.sequence) ? args.sequence.map((v) => num({ v }, "v")) : [];
        const verdict = mode === "euler" ? C.checkEuler(graph, seq) : C.checkHamilton(graph, seq);
        return {
          graph: graph.name, mode, sequence: seq,
          ...verdict,
          exists: mode === "euler" ? C.hasEulerPath(graph) : C.hasHamiltonPath(graph),
          note: "Euler uses each edge once; Hamilton visits each vertex once.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const graphIndex = Number.isFinite(state.graph) ? num(state, "graph") : 0;
  const graph = C.GRAPHS[graphIndex];
  if (!graph) throw new Error("graph is out of range");
  const seq = Array.isArray(state.sequence) ? state.sequence.map((v) => Number(v)) : [];
  return { graph: graph.name, mode: state.mode, sequence: seq, vertices: graph.vertices.length, edges: graph.edges.length, note: `The ${graph.name} has ${graph.vertices.length} vertices and ${graph.edges.length} edges.` };
}
