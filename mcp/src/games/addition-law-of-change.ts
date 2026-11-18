/*
 * run_game_logic actions and saved-position reader for the change-of-addends
 * demo. The core (addition-law-of-change/ in the site, copied into
 * src/generated/cores/ at build time) knows the sum and dot counts. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["addition-law-of-change"].AdditionLawOfChangeCore;

function readState(args: Json): { a: number; b: number; maxNum: number } {
  const C = core();
  const a = num(args, "a", 1);
  const b = num(args, "b", 1);
  if (!Number.isInteger(a) || a < C.MIN || a > C.MAX || !Number.isInteger(b) || b < C.MIN || b > C.MAX) {
    throw new Error(`a and b must be whole numbers from ${C.MIN} to ${C.MAX}`);
  }
  return { a, b, maxNum: Number.isFinite(args.maxNum) ? num(args, "maxNum") : C.DEFAULT_MAX_NUM };
}

export function actions(): GameActions {
  return {
    check_sum: {
      describe:
        "For two addends, report the sum, the three dot-row counts and what happens when either addend changes by k.",
      args: '{ "a": 1, "b": 1, "delta": 3 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const delta = Number.isFinite(args.delta) ? num(args, "delta") : 1;
        if (!Number.isInteger(delta)) throw new Error("delta must be a whole number");
        const first = C.change(state, "a", delta);
        const second = C.change(state, "b", delta);
        return {
          a: state.a,
          b: state.b,
          sum: C.sum(state),
          dots: C.dots(state),
          changeFirst: { a: first.a, sum: C.sum(first), sumMovedBy: C.sum(first) - C.sum(state) },
          changeSecond: { b: second.b, sum: C.sum(second), sumMovedBy: C.sum(second) - C.sum(state) },
          note: "Each addend change moves the sum by the same amount, unless the 0..100 limit is hit.",
        };
      },
    },
    addends_and_dots: {
      describe:
        "Count the dots in the first group, the second group and their union, and confirm they match the two addends and their sum.",
      args: '{ "a": 7, "b": 4 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const dots = C.dots(state);
        return {
          a: state.a,
          b: state.b,
          sum: C.sum(state),
          dots,
          match: dots.a === state.a && dots.b === state.b && dots.sum === C.sum(state),
          note: "Moving a dot between the first two rows leaves the union row alone; adding one grows it by one.",
        };
      },
    },
  };
}

/** What the core says about a saved board. */
export function position(state: Json): unknown {
  const C = core();
  const board = readState(state);
  return {
    a: board.a,
    b: board.b,
    sum: C.sum(board),
    dots: C.dots(board),
    maxNum: board.maxNum,
    note: `${board.a} + ${board.b} = ${C.sum(board)}. The sum is recomputed from the addends, never stored.`,
  };
}
