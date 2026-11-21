/*
 * run_game_logic actions and saved-position reader for Winkler's path proof.
 * The core lives in winkler-path-proof/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["winkler-path-proof"].WinklerPathProofCore;
type Tile = { x: number; y: number; w: number; h: number; kind: string };
function read(args: Json) {
  if (!Array.isArray(args.tiles)) return core().start();
  const tiles = args.tiles.map((t) => {
    const v = t as Json;
    const x = Number(v.x); const y = Number(v.y);
    const w = Number(v.w); const h = Number(v.h);
    if (![x, y, w, h].every(Number.isFinite)) throw new Error("each tile needs x, y, w and h");
    return { x, y, w, h, kind: v.kind === "V" ? "V" : "H" } as Tile;
  });
  const a = (args.ambient as Json) || {};
  return {
    ambient: {
      x: Number(a.x) || 0, y: Number(a.y) || 0,
      w: Number(a.w) || 2.5, h: Number(a.h) || 2,
    },
    tiles,
    decorated: args.decorated !== false,
  };
}

export function actions(): GameActions {
  return {
    path: {
      describe: "Find the spanning green path (left to right) or red path (bottom to top) in a decorated tiling.",
      args: '{}',
      run: (args) => {
        const C = core();
        const state = read(args);
        const r = C.analyze(state);
        return {
          verdict: r.verdict.kind,
          greenPath: r.verdict.green,
          redPath: r.verdict.red,
          greenSum: r.greenSum,
          redSum: r.redSum,
          ambient: state.ambient,
          validTiling: r.tiling.valid,
          note: "A green path sums integer widths to the big width; a red path sums integer heights to the big height.",
        };
      },
    },
    decorate: {
      describe: "List the opposite-colour strips drawn along each tile's integer-length sides.",
      args: '{}',
      run: (args) => {
        const C = core();
        const state = read(args);
        return {
          strips: C.strips(state.tiles),
          note: "Green H-tiles get red strips above and below; red V-tiles get green strips left and right.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    ambient: input.ambient,
    pathKind: r.verdict.kind,
    path: r.verdict.green || r.verdict.red,
    sum: r.verdict.kind === "green" ? r.greenSum : r.redSum,
    valid: r.tiling.valid,
    note: `The spanning path is ${r.verdict.kind}.`,
  };
}
