/*
 * run_game_logic actions and saved-position reader for Birds on a Wire.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["birds-on-wire"].BirdsOnWireCore;

function seeded(seed: number) {
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function actions(): GameActions {
  return {
    mark_gaps: {
      describe:
        "For one drop of birds at given positions on the wire, show which gaps get marked and the total marked length.",
      args: '{ "positions": [0.1, 0.35, 0.8] }',
      run: (args) => {
        const C = core();
        const positions = Array.isArray(args.positions)
          ? args.positions.map((x) => Math.max(0, Math.min(1, Number(x)))).sort((a, b) => a - b)
          : [0.1, 0.35, 0.8];
        const marked = C.perform(positions);
        return {
          positions,
          gaps: marked.map((m: boolean, i: number) => ({ from: positions[i], to: positions[i + 1], marked: m })),
          markedLength: C.markedLength(positions),
          note: "A gap is marked when either end bird has it as its nearer gap; the two end gaps are always marked.",
        };
      },
    },
    expected_lengths: {
      describe:
        "Give the exactly known average marked lengths for two and three birds and the long-run limit, then optionally check them with a seeded simulation.",
      args: '{ "min": 2, "max": 3, "trials": 50, "seed": 7 }',
      run: (args) => {
        const C = core();
        const trials = num(args, "trials", 50);
        const min = num(args, "min", 2);
        const max = num(args, "max", 3);
        let state = C.create(trials, min, max);
        const rng = seeded(num(args, "seed", 7));
        let guard = 0;
        while (!C.isFinished(state) && guard++ < 100000) state = C.newTrial(state, rng);
        return {
          exact: { twoBirds: 1 / 3, threeBirds: 1 / 2, limit: 7 / 18 },
          simulation: {
            min: state.min, max: state.max, trials: state.trials, runs: state.runs,
            averages: C.accumulation(state),
            overall: C.totalAccumulation(state),
          },
          note: "For many birds the average marked length tends to 7/18, about 0.389.",
        };
      },
    },
  };
}

/** What the core says about the running average chart on screen. */
export function position(state: Json): unknown {
  const C = core();
  const values = Array.isArray(state.values) ? state.values.map((v) => Number(v) || 0) : [];
  const here = {
    ...C.create(num(state, "trials", C.TRIALS_DEFAULT), num(state, "min", C.BIRDS_DEFAULT), num(state, "max", C.BIRDS_DEFAULT)),
    values,
    birds: num(state, "birds", C.BIRDS_DEFAULT),
    count: num(state, "count", 0),
    runs: num(state, "runs", 0),
  };
  return {
    trials: here.trials,
    min: here.min,
    max: here.max,
    birds: here.birds,
    count: here.count,
    runs: here.runs,
    finished: C.isFinished(here),
    averages: C.accumulation(here),
    overall: C.totalAccumulation(here),
    note: `After ${here.runs} drops the running average is ${C.totalAccumulation(here).toFixed(4)}; the long-run limit is 7/18.`,
  };
}
