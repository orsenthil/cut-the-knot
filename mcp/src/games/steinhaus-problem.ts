/*
 * run_game_logic actions and saved-position reader for Steinhaus' Problem. The core lives in
 * steinhaus-problem/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["steinhaus-problem"].SteinhausProblemCore;

function read(places: number[]) {
  const C = core();
  if (places.length > C.TILES || places.some((t) => !(t >= 0 && t <= 1000))) throw new Error("up to 18 places, each in thousandths 0..1000 (0.425 is 425)");
  const s = C.start({ places });
  const k = C.goodPrefix(s), tr = C.trouble(s);
  return {
    numbers: s.places.map((t: number) => C.format(t)),
    allPass: C.ok(s), passesUpTo: k,
    firstFailure: tr ? { k: tr.k, sharedPieces: tr.crowded, emptyPieces: tr.empty } : null,
    note: "The most that can pass is 17 (Warmus); no list of 18 exists.",
  };
}

export function actions(): GameActions {
  return {
    check: {
      describe: "Checks a list of numbers in [0, 1], given in thousandths (0.06 is 60) and snapped as the page does to .xx0 or .xx5: for which k the first k lie in k different k-ths, and where it first fails (which pieces hold two numbers).",
      args: '{ "places": [60, 550, 770, 390, 960] }',
      run: (args) => read(numArray(args, "places").map((t) => core().start({ places: [t] }).places[0])),
    },
  };
}

export function position(state: Json): unknown {
  return read(numArray(state, "places"));
}
