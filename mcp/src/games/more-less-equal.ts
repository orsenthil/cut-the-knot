/*
 * run_game_logic actions and saved-position reader for More, Less or Equal. The core lives in
 * more-less-equal/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["more-less-equal"].MoreLessEqualCore;

function read(s: { a: number; b: number; c: number; op: string }) {
  const C = core();
  const rel = C.relation(s);
  return { equation: C.text(s), relation: rel === "<>" ? "no value (division by 0)" : rel, leftSide: C.leftValue(s), rightSide: s.c, true: rel === "=" };
}

function state(args: Json) {
  const op = String(args.op ?? "+");
  if (!core().OPS.includes(op)) throw new Error('op must be "+", "-", "x" or "/"');
  return { a: Math.round(num(args, "a")), b: Math.round(num(args, "b")), c: Math.round(num(args, "c")), op };
}

export function actions(): GameActions {
  return {
    compare: {
      describe: "The sign between a op b and c the page shows (>, <, =, or no value when dividing by 0), with the left side's exact value; op is +, -, x or /.",
      args: '{ "a": 7, "b": 2, "c": 3, "op": "/" }',
      run: (args) => read(state(args)),
    },
  };
}

export function position(st: Json): unknown {
  const s = state({ a: st.a ?? 1, b: st.b ?? 1, c: st.c ?? 2, op: st.op ?? "+" });
  return { ...read(s), note: "Adding one to a number on the left keeps an equation true only if one is also added on the right." };
}
