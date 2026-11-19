/*
 * run_game_logic actions and saved-position reader for Auto Flipper.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["auto-flipper"].AutoFlipperCore;

function readStack(args: Json) {
  const C = core();
  const stack = Array.isArray(args.stack)
    ? args.stack.map((x) => Math.trunc(Number(x)))
    : C.start({ n: num(args, "n", C.DEFAULT_N) }).stack;
  return C.makePosition(stack);
}

export function actions(): GameActions {
  return {
    flip_once: {
      describe:
        "Read the top pancake, flip that many pancakes, and say in words where the flipped pancake landed.",
      args: '{ "stack": [3,1,4,2] }',
      run: (args) => {
        const C = core();
        const before = readStack(args);
        const after = C.autoFlip(before);
        return {
          before: before.stack,
          top: before.stack[0],
          after: after.stack,
          flips: after.flips,
          finished: after.finished,
          whatHappened: C.describe(after),
        };
      },
    },
    run_to_end: {
      describe:
        "Follow the auto-flip rule until pancake 1 is on top, listing every stack on the way.",
      args: '{ "stack": [3,1,4,2] }',
      run: (args) => {
        const C = core();
        let state = readStack(args);
        const steps = [state.stack.slice()];
        const words: string[] = [];
        let guard = 0;
        while (!state.finished && guard++ < 100) {
          state = C.autoFlip(state);
          steps.push(state.stack.slice());
          words.push(C.describe(state));
        }
        return {
          steps,
          words,
          flips: state.flips,
          finished: state.finished,
          note: state.finished
            ? `Pancake 1 reached the top after ${state.flips} flips.`
            : "The run did not settle within 100 flips.",
        };
      },
    },
  };
}

/** What the core says about the stack currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readStack(state);
  return {
    n: here.n,
    stack: here.stack,
    top: here.stack[0] ?? null,
    flips: Number(state.flips) || 0,
    finished: here.finished,
    lastFlip: C.describe(here),
    note: here.finished
      ? "Pancake 1 is on top, so the flipping has stopped."
      : `The top pancake is ${here.stack[0]}; the next press turns the top ${here.stack[0]}.`,
  };
}
