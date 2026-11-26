/*
 * run_game_logic actions and saved-position reader for Simple Graphs.
 *
 * The core lives in simple-graphs/ and is copied into src/generated/cores/ at
 * build time. The page saves the whole board with Track.state: nodes, edges,
 * history and the three option flags, so position() rebuilds the same graph
 * through the core and recomputes what the core says about degrees. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["simple-graphs"].SimpleGraphsCore;

/** Build a graph through the core, numbering the vertices 1..vertexCount. */
function build(vertexCount: number, edgesArg: unknown, allowLoops: boolean) {
  const C = core();
  if (!Number.isInteger(vertexCount) || vertexCount < 0 || vertexCount > 60) {
    throw new Error("vertexCount must be a whole number from 0 to 60");
  }
  if (!Array.isArray(edgesArg)) {
    throw new Error("edges must be an array of [a, b] or [a, b, copies], with vertices numbered from 1");
  }
  let g: any = C.start({ allowLoops, showDegrees: true });
  for (let id = 1; id <= vertexCount; id++) g = C.addNode(g, id * 20, 0);
  let copies = 0;
  for (const item of edgesArg) {
    if (!Array.isArray(item) || (item.length !== 2 && item.length !== 3)) {
      throw new Error("each edge must be [a, b] or [a, b, copies]");
    }
    const pair = item as unknown as Json;
    const a = Math.round(num(pair, "0"));
    const b = Math.round(num(pair, "1"));
    const n = item.length === 3 ? Math.round(num(pair, "2")) : 1;
    if (a < 1 || a > vertexCount || b < 1 || b > vertexCount) {
      throw new Error(`edge ${JSON.stringify(item)} names a vertex outside 1..${vertexCount}`);
    }
    if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error("copies must be a whole number from 1 to 20");
    if (a === b && !allowLoops) throw new Error("a loop needs allowLoops: true");
    copies += n;
    if (copies > 200) throw new Error("at most 200 edge copies may be added at once");
    for (let i = 0; i < n; i++) g = C.addEdge(g, a, b);
  }
  return g;
}

/** What the core's stats say, with the two invariants spelled out. */
function analyse(g: any) {
  const C = core();
  const s = C.stats(g);
  const degrees = Object.fromEntries(s.degrees.map((d: { id: number; degree: number }) => [d.id, d.degree]));
  const degreeSequence: number[] = s.degrees.map((d: { degree: number }) => d.degree).sort((a: number, b: number) => b - a);
  return {
    nodes: s.nodes,
    edges: s.links,
    totalDegree: s.totalDegree,
    even: s.even,
    odd: s.odd,
    degrees,
    degreeSequence,
    handshakingHolds: s.totalDegree === 2 * s.links,
    oddCountIsEven: s.odd % 2 === 0,
    note: `Each edge adds 1 to the degree at both ends (a loop adds 2), so the total degree must be twice the number of edges; that also forces an even number of odd-degree vertices.`,
  };
}

export function actions(): GameActions {
  return {
    analyse: {
      describe:
        "Builds a graph on vertexCount vertices (numbered from 1) from edges written as [a, b] or [a, b, copies]; a loop [a, a] needs allowLoops: true. Gives every vertex's degree and the degree sequence, and checks the two facts every graph satisfies: total degree is twice the number of edges, and the number of odd-degree vertices is even.",
      args: '{ "vertexCount": 3, "edges": [[1, 2], [1, 2], [2, 3], [3, 3]], "allowLoops": true }',
      run: (args) => {
        const allowLoops = args.allowLoops === true;
        return analyse(build(
          Math.round(num(args, "vertexCount")),
          args.edges,
          allowLoops,
        ));
      },
    },
  };
}

/**
 * Rebuild the board the page saved with Track.state. The page gives vertices
 * their original ids, which can skip numbers after Pop, so the rebuilt ids are
 * mapped back to the saved ones before the degrees are reported.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Simple Graphs state version ${stateVersion}`);
  const C = core();
  const savedNodes: Json[] = Array.isArray(state.nodes) ? state.nodes as Json[] : [];
  const savedEdges: Json[] = Array.isArray(state.edges) ? state.edges as Json[] : [];
  const savedHistory: Json[] = Array.isArray(state.history) ? state.history as Json[] : [];
  const showDegrees = state.showDegrees !== false;
  const allowLoops = state.allowLoops === true;
  const moving = state.moving === true;

  let g: any = C.start({ showDegrees, allowLoops, moving });
  const rebuiltOf = new Map<number, number>();
  const savedOf = new Map<number, number>();
  const nodes = savedNodes.map((raw) => {
    const oldId = Math.round(num(raw, "id"));
    const before = g.nodes.length;
    g = C.addNode(g, num(raw, "x", 0), num(raw, "y", 0));
    const newId = g.nodes[before].id;
    rebuiltOf.set(oldId, newId);
    savedOf.set(newId, oldId);
    return { id: oldId, x: num(raw, "x", 0), y: num(raw, "y", 0) };
  });
  const edges = savedEdges.map((raw) => {
    const a = Math.round(num(raw, "a"));
    const b = Math.round(num(raw, "b"));
    const count = Math.max(0, Math.round(num(raw, "count", 1)));
    const ra = rebuiltOf.get(a);
    const rb = rebuiltOf.get(b);
    if (ra !== undefined && rb !== undefined) {
      for (let i = 0; i < count; i++) g = C.addEdge(g, ra, rb);
    }
    return { a, b, count };
  });

  const s = C.stats(g);
  const stats = {
    ...s,
    degrees: s.degrees.map((d: { id: number; degree: number }) => ({
      id: savedOf.get(d.id) ?? d.id,
      degree: d.degree,
    })),
  };
  const savedStats = state.stats && typeof state.stats === "object" ? state.stats as Json : null;
  const savedStatsAgree = savedStats !== null &&
    ["nodes", "links", "totalDegree", "even", "odd"].every((k) => Number(savedStats[k]) === Number((stats as Json)[k]));

  return {
    nodes,
    edges,
    history: savedHistory.map((h) => ({ a: Math.round(num(h, "a", 0)), b: Math.round(num(h, "b", 0)) })),
    showDegrees,
    allowLoops,
    moving,
    stats,
    savedStatsAgree,
    result: C.result(g),
    note: `${stats.nodes} vertices and ${stats.links} edges give total degree ${stats.totalDegree} = 2 x ${stats.links}; ${stats.odd} vertices have odd degree, always an even number. Draw another edge and both totals rise together.`,
  };
}
