/*
 * run_game_logic actions and saved-position reader for Box Volume.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["box-volume"].BoxVolumeCore;

function readState(args: Json) {
  const C = core();
  return C.start({
    a: num(args, "a", 11),
    b: num(args, "b", 8.5),
    x: num(args, "x", 1),
  });
}

export function actions(): GameActions {
  return {
    best_cut: {
      describe:
        "For a sheet a by b, give the cut that maximises the folded box's volume, the exact formula, the maximum volume and the volume at any chosen cut.",
      args: '{ "a": 11, "b": 8.5, "x": 1 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const best = C.findBest(state);
        return {
          a: state.a,
          b: state.b,
          currentCut: state.x,
          currentVolume: C.volume(state.x, state.a, state.b),
          bestCut: best.x,
          bestVolume: C.volume(best.x, state.a, state.b),
          formula: "x = ((a+b) - sqrt(a*a - a*b + b*b)) / 6",
          roots: C.roots(state.a, state.b),
          note: `The volume is x(a-2x)(b-2x); its largest value for this sheet is ${C.volume(best.x, state.a, state.b).toFixed(4)} at a cut of ${best.x.toFixed(4)}.`,
        };
      },
    },
    compare_sheets: {
      describe:
        "Compare the best cuts and maximum volumes for several sheet sizes, including a square sheet where the optimum is a/6.",
      args: '{ "sheets": [[11, 8.5], [10, 10], [20, 2]] }',
      run: (args) => {
        const C = core();
        const sheets = Array.isArray(args.sheets) ? args.sheets : [[11, 8.5], [10, 10], [20, 2]];
        const rows = sheets.map((pair) => {
          const sheet = readState({ a: Number(pair[0]), b: Number(pair[1]) });
          const best = C.findBest(sheet);
          return {
            a: sheet.a, b: sheet.b,
            bestCut: best.x,
            bestVolume: C.volume(best.x, sheet.a, sheet.b),
            square: sheet.a === sheet.b,
          };
        });
        return { rows, note: "A square sheet peaks at x = a/6 with volume 2a^3/27." };
      },
    },
  };
}

/** What the core says about the current cut on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const best = C.findBest(here);
  return {
    a: here.a,
    b: here.b,
    x: here.x,
    found: state.found === true,
    volume: C.volume(here.x, here.a, here.b),
    bestCut: best.x,
    bestVolume: C.volume(best.x, here.a, here.b),
    note: `With a ${here.a} by ${here.b} sheet and a cut of ${here.x}, the box holds ${C.volume(here.x, here.a, here.b).toFixed(3)}; the best cut is ${best.x.toFixed(3)}.`,
  };
}
