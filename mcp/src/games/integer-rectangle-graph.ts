/*
 * run_game_logic actions and saved-position reader for Integer Rectangles:
 * Two Proofs. The core lives in integer-rectangle-graph/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["integer-rectangle-graph"].IntegerRectangleGraphCore;
type Tile = { x: number; y: number; w: number; h: number; kind?: string };
function read(args: Json) {
  if (!Array.isArray(args.tiles)) throw new Error("tiles must be an array");
  const tiles = args.tiles.map((t) => {
    const v = t as Json;
    const x = Number(v.x); const y = Number(v.y);
    const w = Number(v.w); const h = Number(v.h);
    if (![x, y, w, h].every(Number.isFinite)) throw new Error("each tile needs x, y, w and h");
    return { x, y, w, h, ...(v.kind ? { kind: String(v.kind) } : {}) } as Tile;
  });
  const ambient = (args.ambient as Json) || { x: 0, y: 0, w: 2.5, h: 2 };
  const step = Number.isFinite(args.step) ? Number(args.step) : 1;
  return { tiles, ambient: {
    x: Number(ambient.x) || 0, y: Number(ambient.y) || 0,
    w: Number(ambient.w) || 2.5, h: Number(ambient.h) || 2,
  }, step };
}

export function actions(): GameActions {
  return {
    graph_proof: {
      describe: "Build the corner graph of a tiling and follow the path from the lower-left corner to see where it ends.",
      args: '{ "tiles": [{"x":0,"y":0,"w":1,"h":0.7,"kind":"H"},{"x":0,"y":0.7,"w":1,"h":1.3,"kind":"H"},{"x":1,"y":0,"w":1.5,"h":1,"kind":"V"},{"x":1,"y":1,"w":1.5,"h":1,"kind":"V"}], "ambient": {"x":0,"y":0,"w":2.5,"h":2} }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const r = C.analyze(state);
        return {
          validTiling: r.tiling.valid,
          ambientCornerDegrees: r.cornerDegrees,
          interiorDegreesEven: r.interiorEven,
          trailEnd: r.graph.nodes.get(r.trail.end),
          endsAtCorner: r.endIsCorner,
          endIsSpecial: r.endSpecial,
          note: "A trail from one special corner ends at another special ambient corner.",
        };
      },
    },
    counting_proof: {
      describe: "Count special corners tile by tile and as graph nodes, checking S = S1 + 2S2 + 4S4.",
      args: '{ "tiles": [{"x":0,"y":0,"w":1,"h":1}], "step": 1 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const c = C.counting(state.tiles, state.step);
        return { ...c, note: "S is even, so S1 is even and at least two ambient corners are special." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    step: input.step,
    tiles: input.tiles,
    nodes: r.graph.nodes.size,
    valid: r.tiling.valid,
    counting: r.counting,
    endIsCorner: r.endIsCorner,
    endSpecial: r.endSpecial,
    note: r.tiling.valid ? "A valid tiling of the ambient rectangle." : "The rectangles do not tile the ambient rectangle.",
  };
}
