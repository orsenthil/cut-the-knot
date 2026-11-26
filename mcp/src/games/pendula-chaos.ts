/*
 * run_game_logic actions and saved-position reader for Order and Chaos in Multiple Pendulums. The core lives in
 * pendula-chaos/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["pendula-chaos"].PendulaCore;

export function actions(): GameActions {
  return {
    levels: {
      describe: "How many different heights the dots have at the fraction p/q of a full cycle (40 pi), for n dots whose periods start at t. At 0 and every whole cycle all dots are in line; at 40 pi p/q there are at most floor(q/2)+1 levels.",
      args: '{ "n": 20, "t": 1, "p": 1, "q": 5 }',
      run: (args) => {
        const n = Math.min(100, Math.max(5, Math.floor(num(args, "n", 20)))), t = Math.min(100, Math.max(1, Math.floor(num(args, "t", 1))));
        const p = Math.floor(num(args, "p", 1)), q = Math.max(1, Math.floor(num(args, "q", 1)));
        const step = (core().CYCLE * p) / q;
        return { n, t, atStep: step, levels: core().levels(n, t, step, 1e-9), mostLevelsPossible: Math.floor(q / 2) + 1, cycleLengthInTicks: core().CYCLE / core().speed(n) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Number(state.n), t = Number(state.t), step = Number(state.step);
  const cycles = step / core().CYCLE;
  return { dots: n, startWith: t, direction: state.dir === 1 ? "forwards" : state.dir === -1 ? "backwards" : "stopped", cyclesCompleted: Math.round(cycles * 1000) / 1000, levelsNow: core().levels(n, t, step, 0.02), note: "All the dots line up again after each whole cycle (40 pi), because the periods are whole numbers; at a fraction p/q of a cycle they sit on at most q/2 + 1 levels." };
}
