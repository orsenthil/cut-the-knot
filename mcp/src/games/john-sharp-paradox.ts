/*
 * run_game_logic actions and saved-position reader for John Sharp's Paradox.
 * The core lives in john-sharp-paradox/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["john-sharp-paradox"].JohnSharpParadoxCore;
function read(args: Json) {
  return { n: Number.isFinite(args.n) ? num(args, "n") : 7, revealed: args.revealed === true };
}

export function actions(): GameActions {
  return {
    areas: {
      describe: "Report the square, rectangle and piece areas for a Fibonacci dissection size.",
      args: '{ "n": 7 }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          n: r.n, side: r.f, rectangle: `${r.a} by ${r.f + r.a}`,
          squareArea: r.squareArea, rectangleArea: r.rectangleArea,
          pieceTotal: r.pieceTotal, discrepancy: r.discrepancy,
          pieces: r.square.map((p: { name: string; area: number }) => ({ name: p.name, area: p.area })),
          note: "Cassini's identity makes the difference exactly one square unit.",
        };
      },
    },
    sliver: {
      describe: "Give the coordinates of the thin false-diagonal strip hiding the extra unit.",
      args: '{ "n": 7 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        return { n: state.n, strip: C.sliver(state.n), note: "The sloping cut is 5/13 in the square but disguised as 8/8 in the rectangle." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    n: r.n, side: r.f, squareArea: r.squareArea, rectangleArea: r.rectangleArea,
    discrepancy: r.discrepancy, revealed: r.revealed,
    note: `A ${r.f} by ${r.f} square becomes ${r.a} by ${r.f + r.a}.`,
  };
}
