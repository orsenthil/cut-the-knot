/*
 * run_game_logic actions and saved-position reader for Langman's Paradox.
 * The core lives in langman-paradox/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["langman-paradox"].LangmanParadoxCore;
function read(args: Json) {
  return { n: Number.isFinite(args.n) ? num(args, "n") : 6, cheat: args.cheat === true };
}

export function actions(): GameActions {
  return {
    areas: {
      describe: "Report the square, rectangle and piece areas for a Fibonacci Langman dissection.",
      args: '{ "n": 6, "cheat": false }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          n: r.n, side: r.f, rectangle: `${r.a} by ${r.f + r.a}`,
          squareArea: r.squareArea, rectangleArea: r.rectangleArea,
          pieceTotal: r.pieceTotal, discrepancy: r.discrepancy,
          cassini: r.cassini,
          pieces: r.square.map((p: { name: string; area: number }) => ({ name: p.name, area: p.area })),
          note: "The pieces conserve area; Cassini's identity gives the outline's one-unit error.",
        };
      },
    },
    sliver: {
      describe: "Return the false-diagonal strip, widened when Cheat is enabled.",
      args: '{ "n": 6, "cheat": true }',
      run: (args) => {
        const C = core();
        const state = read(args);
        return { n: state.n, cheat: state.cheat, strip: C.sliver(state.n, state.cheat), note: "Cheat changes only the drawing, never the piece areas." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    n: r.n, cheat: r.cheat, side: r.f,
    squareArea: r.squareArea, rectangleArea: r.rectangleArea,
    cassini: r.cassini, discrepancy: r.discrepancy,
    note: `A ${r.f} by ${r.f} square becomes ${r.a} by ${r.f + r.a}.`,
  };
}
