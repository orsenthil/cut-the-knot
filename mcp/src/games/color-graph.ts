/*
 * run_game_logic actions and saved-position reader for Color Graph.
 *
 * Answers come from the game's real core (color-graph/ in the site), copied
 * into src/generated/cores/ at build time. See _shared.ts for the shape.
 *
 * The page saves a reduced summary with Track.state (graph name, node/edge
 * counts, the colour map, and the counts the core already worked out), so
 * position() rebuilds what it can and otherwise trusts the saved numbers.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["color-graph"].ColorGraphCore;

/** Turn an arbitrary JSON value into a plain { label: colourIndex } map. */
function readColors(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [label, v] of Object.entries(value as Json)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[label] = n;
  }
  return out;
}

function distinctCount(map: unknown): number {
  if (!map || typeof map !== "object") return 0;
  return new Set(Object.values(map as Record<string, unknown>)).size;
}

/** Pick one of the six sample graphs, wrapping an out-of-range index. */
function sampleGraph(C: any, raw: number): any {
  const n = C.SAMPLE_GRAPHS.length;
  const idx = ((Math.trunc(raw) % n) + n) % n;
  return C.SAMPLE_GRAPHS[idx];
}

export function actions(): GameActions {
  return {
    samples: {
      describe:
        "For each of the six sample graphs give the node and edge counts, the exact chromatic number, and whether a k-1 colouring is impossible (the minimality proof). Check the page's printed claim of which graph needs 2, 3 or 4 colours.",
      args: "{}",
      run: () => {
        const C = core();
        const claimed = [2, 3, 4, 4, 3, 4]; // the numbers printed on the page
        const rows = C.SAMPLE_GRAPHS.map((g: any, i: number) => {
          const chi = C.chromaticNumber(g);
          const greedy = C.greedyColor(g);
          return {
            index: i,
            name: g.name,
            nodes: g.nodes.length,
            edges: g.edges.length,
            chromaticNumber: chi,
            colorableWithChi: C.colorable(g, chi),
            colorableWithChiMinus1: chi > 0 ? C.colorable(g, chi - 1) : false,
            minimumProved: C.colorable(g, chi) && (chi === 0 || !C.colorable(g, chi - 1)),
            greedyNodeOrderUsed: distinctCount(greedy),
          };
        });
        const claimCheck = rows.map((r: any, i: number) => ({
          name: r.name,
          pageClaim: claimed[i],
          actual: r.chromaticNumber,
          agrees: claimed[i] === r.chromaticNumber,
        }));
        return {
          rows,
          claimCheck,
          allClaimsTrue: claimCheck.every((c: any) => c.agrees),
          note: `The chromatic number is the least k for which a proper k-colouring exists. The six samples need ${rows.map((r: any) => r.chromaticNumber).join(", ")} colours; for each one chi-1 colours are impossible and chi colours are possible. Greedy in the graph's own node order happens to be optimal on all six, but a different vertex order can waste colours (see greedy_demo).`,
        };
      },
    },

    evaluate_coloring: {
      describe:
        "Given a sample graph (graphIndex, 0-based) and a colour assignment (an object mapping each node label to a colour index 0-9), report the distinct colours used, which edges join two nodes of the same colour, whether the colouring is proper, the exact chromatic number, and whether this is a minimum colouring.",
      args: '{ "graphIndex": 2, "colors": { "A": 0, "B": 1, "C": 2, "D": 0, "E": 0, "F": 3, "G": 1 } }',
      run: (args) => {
        const C = core();
        const g = sampleGraph(C, num(args, "graphIndex", 0));
        const colors = readColors(args.colors);
        const state = { graph: g, colors };
        const used = C.colorsUsed(state);
        const conflicts = C.conflicts(state).map((e: any) => [String(e[0]), String(e[1])]);
        const proper = C.isProper(state);
        const allColored = C.allColored(state);
        const chi = C.chromaticNumber(g);
        const isMinimum = proper && allColored && used === chi;
        return {
          graph: g.name,
          nodes: g.nodes.length,
          edges: g.edges.length,
          colors,
          colorsUsed: used,
          conflicts,
          conflictCount: conflicts.length,
          proper,
          allColored,
          chromaticNumber: chi,
          isMinimum,
          result: C.result(state),
          note: `This colouring uses ${used} distinct colour(s). ${conflicts.length ? `${conflicts.length} edge(s) join two nodes of the same colour, so it is not proper.` : "No neighbours share a colour, so it is proper."} The chromatic number is ${chi}${isMinimum ? ", so this is a minimum colouring." : `; at least ${chi} colour(s) are needed${allColored ? "" : " once every node is coloured"}.`}`,
        };
      },
    },

    greedy_demo: {
      describe:
        "Colour a sample graph greedily (each vertex takes the first colour none of its already-coloured neighbours uses) in a chosen vertex order, and compare the colours used with the exact chromatic number. Graph 3 (index 2) shows greedy can use 5 colours where 4 suffice.",
      args: '{ "graphIndex": 2, "order": ["A", "E", "D", "C", "B", "F", "G"] }',
      run: (args) => {
        const C = core();
        const g = sampleGraph(C, num(args, "graphIndex", 2));
        const defaultOrder = g.nodes.map((n: any) => String(n.label));
        const order = Array.isArray(args.order) ? args.order.map(String) : defaultOrder;
        const greedy = C.greedyColor(g, order);
        const used = distinctCount(greedy);
        const chi = C.chromaticNumber(g);
        return {
          graph: g.name,
          order,
          greedy,
          colorsUsed: used,
          chromaticNumber: chi,
          usesMoreThanMinimum: used > chi,
          note: `Greedy gives each vertex the first colour none of its already-coloured neighbours uses. In this order it uses ${used} colour(s) on ${g.name}, whose chromatic number is ${chi}. ${used > chi ? `A different vertex order can do better — the minimum is still ${chi}.` : "Here greedy happens to reach the minimum."}`,
        };
      },
    },
  };
}

/** What the core says about the colouring currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const graphName = typeof state.graph === "string" ? state.graph : "";
  const nodes = num(state, "nodes", 0);
  const edges = num(state, "edges", 0);
  const colors = readColors(state.colors);
  const colorsUsed = num(state, "colorsUsed", 0);
  const chromaticNumber = num(state, "chromaticNumber", 0);
  const proper = state.proper === true;
  const mode = typeof state.mode === "string" ? state.mode : "color";
  const moves = num(state, "moves", 0);

  const coloredNodes = Object.values(colors).filter((c) => Number.isInteger(c) && (c as number) >= 0).length;
  const allColored = nodes > 0 && coloredNodes === nodes;

  // The page only saves a count of edges, not the edges themselves. If this
  // is one of the six unchanged samples we can rebuild the edge list and list
  // the conflicting edges; for a player-defined graph we cannot.
  const sample = C.SAMPLE_GRAPHS.find((g: any) => g.name === graphName);
  let conflictEdges: string[][] | null = null;
  if (sample && sample.nodes.length === nodes && sample.edges.length === edges) {
    conflictEdges = C.conflicts({ graph: sample, colors }).map((e: any) => [String(e[0]), String(e[1])]);
  }

  const optimal = proper && allColored && chromaticNumber > 0 && colorsUsed === chromaticNumber;
  const result = allColored && proper ? "done" : null;

  const conflictText = conflictEdges !== null
    ? `${conflictEdges.length} edge(s) join two nodes of the same colour.`
    : proper
      ? "No neighbours share a colour."
      : "Some neighbours share a colour.";

  return {
    graph: graphName,
    nodes,
    edges,
    colors,
    colorsUsed,
    fewestPossible: chromaticNumber,
    proper,
    optimal,
    allColored,
    coloredNodes,
    conflictEdges,
    conflictCount: conflictEdges === null ? null : conflictEdges.length,
    mode,
    moves,
    result,
    note: `${graphName || "Graph"}: ${nodes} node(s), ${edges} edge(s). You have used ${colorsUsed} colour(s); the fewest possible is ${chromaticNumber}. ${conflictText} ${optimal ? "That is a minimum, proper colouring." : colorsUsed > chromaticNumber ? "Can you do it with fewer colours?" : ""}`.trim(),
  };
}
