/*
 * run_game_logic actions and saved-position reader for Hooper's Paradox.
 * The core lives in hooper-paradox/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hooper-paradox"].HooperParadoxCore;
function read(args: Json) {
  return { w: num(args, "w", 10), h: num(args, "h", 3), a: num(args, "a", 4) };
}

export function actions(): GameActions {
  return {
    area: {
      describe: "Cut a rectangle into its four dissection pieces and verify the pieces keep the original area.",
      args: '{ "w": 10, "h": 3, "a": 4 }',
      run: (args) => {
        const r = core().analyze(read(args).w, read(args).h, read(args).a);
        return {
          original: r.originalArea,
          pieces: r.pieces.map((p) => ({ name: p.name, area: p.area })),
          pieceTotal: r.pieceTotal,
          conserved: r.conserved,
          note: "Cutting and rearranging never changes total area; the paradox is a hidden gap.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state).w, read(state).h, read(state).a);
  return { w: r.w, h: r.h, cut: r.cut, originalArea: r.originalArea, pieceTotal: r.pieceTotal, conserved: r.conserved, note: `The pieces still cover ${r.pieceTotal} square units.` };
}
