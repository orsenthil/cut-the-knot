/*
 * run_game_logic actions and saved-position reader for Indy's Clock Hands.
 * The core lives in indy-clock-hands/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["indy-clock-hands"].IndyClockHandsCore;
function read(args: Json) {
  return { alpha: num(args, "alpha", Math.PI / 4), red: num(args, "red", Math.PI / 3) };
}

export function actions(): GameActions {
  return {
    probabilities: {
      describe: "For a red arc and an angle between hands, report the red fraction, each hand's hit probability and the exact joint probability.",
      args: '{ "alpha": 0.7853981633974483, "red": 1.0471975511965976 }',
      run: (args) => {
        const C = core();
        const { alpha, red } = read(args);
        const state = { ...C.start(), redArcs: [{ start: 0, length: red }], alpha };
        return {
          alpha, redArc: red,
          redFraction: C.redFraction(state.redArcs),
          firstHitProbability: C.redFraction(state.redArcs),
          secondHitProbability: C.redFraction(state.redArcs),
          jointProbability: C.joint(state),
          note: "Shifting the red set around the circle preserves its measure, so both hit rates are the red fraction.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const { alpha, red } = read(state);
  return { alpha, redArc: red, redFraction: red / C.TAU, note: `Both hands hit red with probability ${(red / C.TAU).toFixed(3)}.` };
}
