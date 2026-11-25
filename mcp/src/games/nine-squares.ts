/*
 * run_game_logic actions and saved-position reader for Nine Squares. The core
 * lives in nine-squares/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["nine-squares"].NineSquaresCore;

export function actions(): GameActions {
  return {
    squares: {
      describe: "The nine squares for a (3 to 15): their sides, whether they overlap or leave gaps, and the bounding rectangle. The black square is always 1 and the red ones 4 and 15; only a = 9 tiles a 33 by 32 rectangle exactly.",
      args: '{ "a": 9 }',
      run: (args) => {
        const a = Math.floor(num(args, "a"));
        const s = core().setA(core().start(), a) as { a: number };
        return { a: s.a, sides: core().sides(s), ...(core().describe(s) as Json), squares: core().squares(s) };
      },
    },
    which_a_tiles: {
      describe: "Every a from 3 up to a limit for which the nine squares fit together exactly (no overlap, no gap). Only a = 9.",
      args: '{ "upTo": 200 }',
      run: (args) => {
        const upTo = Math.min(2000, Math.max(3, Math.floor(num(args, "upTo", 200))));
        const found: number[] = [];
        for (let a = 3; a <= upTo; a++) if (core().tiles({ a })) found.push(a);
        return { checkedUpTo: upTo, tilingValuesOfA: found };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { a: Number(state.a) };
  const d = core().describe(s) as Json;
  return { a: s.a, sides: core().sides(s), tilesExactly: d.tiles, overlappingPairs: d.overlaps, emptyUnitSquares: d.gap, rectangle: `${d.width} by ${d.height}`, note: "The sides 1, 4 and 15 never change; at a = 9 the squares make a 33 by 32 rectangle." };
}
