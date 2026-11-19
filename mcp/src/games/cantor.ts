/*
 * run_game_logic actions and saved-position reader for the tent-map / Cantor
 * demo. Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cantor"].CantorCore;

function readState(args: Json) {
  const C = core();
  return C.start({ a: num(args, "a", C.DEFAULT_A) });
}

export function actions(): GameActions {
  return {
    tent_orbit: {
      describe:
        "For a slope a, list a backward orbit of the tent map and show the last marks the page would draw.",
      args: '{ "a": 3, "steps": 8, "seed": 1 }',
      run: (args) => {
        const C = core();
        let state = C.setRunning(readState(args), true);
        const steps = Math.max(1, Math.min(60, Math.trunc(num(args, "steps", 8))));
        let s = (Math.trunc(num(args, "seed", 1)) >>> 0) || 1;
        for (let i = 0; i < steps; i++) {
          s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
          state = C.tick(state, s / 4294967296 < 0.5);
        }
        return {
          a: state.a,
          steps: state.step,
          x: state.x,
          y: state.y,
          orbit: state.orbit.slice(-10),
          marks: state.marks.slice(-5),
          note: `After ${steps} backward steps the orbit is at ${state.y.toFixed(4)}; marks appear after the warm-up repaints.`,
        };
      },
    },
    middle_thirds: {
      describe:
        "Give the two intervals that remain after p steps of removing middle thirds, their count and their total length.",
      args: '{ "p": 3 }',
      run: (args) => {
        const C = core();
        const p = Math.max(0, Math.min(10, Math.trunc(num(args, "p", 3))));
        const intervals = C.remainingIntervals(p);
        const fraction = C.remainingLength(p);
        const length = fraction.n / fraction.d;
        return {
          p,
          intervalCount: intervals.length,
          intervals,
          length,
          expectedCount: 2 ** p,
          expectedLength: (2 / 3) ** p,
          note: `After ${p} rounds there are 2^${p} intervals of total length (2/3)^${p} = ${length.toFixed(6)}.`,
        };
      },
    },
  };
}

/** What the core says about the plot currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const step = Number(state.step) || 0;
  return {
    a: here.a,
    running: state.running === true,
    step,
    x: Number(state.x) || here.x,
    y: Number(state.y) || here.y,
    markCount: Array.isArray(state.marks) ? state.marks.length : 0,
    note: `The tent has slope ${here.a}; the backward orbit is at step ${step} with value ${(Number(state.y) || 0).toFixed(3)}.`,
  };
}
