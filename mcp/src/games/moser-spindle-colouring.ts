/*
 * run_game_logic actions and saved-position reader for Colour the Moser Spindle.
 * The core lives in moser-spindle-colouring/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["moser-spindle-colouring"].MoserCore;

export function actions(): GameActions {
  return {
    colourings: {
      describe: "The number of proper colourings of the Moser spindle (7 points, 11 unit pairs) with k colours, by exhaustive search; and one if it exists. k = 3 gives none, 4 gives some.",
      args: '{ "k": 3 }',
      run: (args) => {
        const k = Math.floor(num(args, "k", 4));
        if (k < 1 || k > 6) throw new Error("k must be 1..6");
        return { k, count: core().countColourings(k), example: core().solve(k) };
      },
    },
    chromatic_number: {
      describe: "The fewest colours that paint the spindle with no two unit-apart points alike: 4.",
      args: "{}",
      run: () => ({ chromaticNumber: core().chromaticNumber(), edges: core().EDGES }),
    },
  };
}

export function position(state: Json): unknown {
  const colours = (state.colours as number[]) ?? [];
  const k = Number(state.k);
  const clashes = core().conflicts(colours);
  return {
    colours: k, painted: colours.filter((c) => c >= 0).length, clashes: clashes.length, clashingPairs: clashes,
    solved: core().isProper(colours, k),
    possibleWithThisManyColours: core().solve(k) !== null,
    note: "Three colours cannot work; four can. That is the plane needing at least 4 colours.",
  };
}
