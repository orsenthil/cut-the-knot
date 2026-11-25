/*
 * run_game_logic actions and saved-position reader for Addition and Subtraction
 * of Functions. The core lives in adding-functions/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["adding-functions"].FunctionsCore;

export function actions(): GameActions {
  return {
    at: {
      describe: "The heights of the page's starting curves f (-x^2/2 + 25/3) and g (5 sin x), as splines through 11 points, and of f + g and f - g, at an x between -5 and 5.",
      args: '{ "x": 1 }',
      run: (args) => {
        const x = num(args, "x");
        const s = core().start() as Json;
        const add = core().curves(s) as { f: (x: number) => number; g: (x: number) => number; result: (x: number) => number };
        const sub = core().curves({ ...s, op: "sub" }) as { result: (x: number) => number };
        return { x, f: add.f(x), g: add.g(x), sum: add.result(x), difference: sub.result(x) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const c = core().curves(state) as { f: (x: number) => number; g: (x: number) => number; result: (x: number) => number };
  const x = state.probe === undefined ? 0 : Number(state.probe);
  return { operation: state.op === "sub" ? "f - g" : "f + g", readAt: x, f: c.f(x), g: c.g(x), result: c.result(x), shaded: !!state.shade, note: "The result curve is computed point by point; it is also the spline through the sums (or differences) of the control points." };
}
