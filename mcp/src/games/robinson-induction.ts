/*
 * run_game_logic actions and saved-position reader for Integer Rectangles:
 * A Proof by Induction. The core lives in robinson-induction/ and is copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["robinson-induction"].RobinsonInductionCore;
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
    tiles, path: [], gap: null, history: [], message: "",
  };
}

export function actions(): GameActions {
  return {
    split: {
      describe: "Split each H-tile into unit-width strips and each V-tile into unit-height strips.",
      args: '{}',
      run: (args) => {
        const C = core();
        const state = C.split(read(args));
        return {
          tiles: state.tiles, count: state.tiles.length, message: state.message,
          note: "Unit strips let the column be removed one unit at a time.",
        };
      },
    },
    induction: {
      describe: "Apply Robinson's column-removal induction until no H-tiles remain, reporting each reduced rectangle.",
      args: '{}',
      run: (args) => {
        const C = core();
        const result = C.induct(read(args));
        const base = C.baseCase(result.state);
        return {
          steps: result.steps, complete: result.complete,
          finalAmbient: result.state.ambient,
          finalHCount: C.hTiles(result.state).length,
          validTiling: C.validate(result.state).valid,
          baseCase: base,
          note: "Fewer H-tiles at each step; with none left, unit V-tiles force an integer height.",
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
    ambient: input.ambient, hCount: r.hCount, vCount: r.vCount,
    valid: r.tiling.valid, ambientSpecial: r.ambientSpecial,
    note: r.tiling.valid ? "A valid tiling." : "The rectangles do not tile the ambient rectangle.",
  };
}
