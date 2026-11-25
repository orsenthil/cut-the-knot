/*
 * run_game_logic actions and saved-position reader for Newton's Method. The core
 * lives in newtons-method/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["newtons-method"].NewtonCore;

export function actions(): GameActions {
  return {
    heron: {
      describe: "Newton's method for the square root of N: x -> (x + N/x)/2, from a start, for a number of steps. Returns each iterate in double precision.",
      args: '{ "N": 2, "start": 1, "steps": 6 }',
      run: (args) => {
        const N = num(args, "N"), start = num(args, "start", 1), steps = Math.min(60, Math.max(1, Math.floor(num(args, "steps", 6))));
        const xs = core().heron(N, start, steps) as number[];
        return { N, iterates: xs, squareRoot: Math.sqrt(N), lastError: Math.abs(xs[xs.length - 1] - Math.sqrt(N)) };
      },
    },
    from_start: {
      describe: "Newton steps on the page's starting curve (a natural spline through 11 points on -x^3 - 4x^2 + 5x + 95.83) from a chosen x0 between -5 and 5: each step's x, f(x), slope and where the tangent meets the axis, and why it stopped.",
      args: '{ "x0": 4.5, "steps": 5 }',
      run: (args) => {
        const s = core().start() as Json;
        const x0 = num(args, "x0"), steps = Math.min(10, Math.max(1, Math.floor(num(args, "steps", 5))));
        const c = core().curve(s) as { f: (x: number) => number; df: (x: number) => number };
        return { x0, steps: core().orbit(c.f, c.df, x0, steps, core().XMIN, core().XMAX) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const x0 = state.x0 === null || state.x0 === undefined ? null : Number(state.x0);
  const steps = x0 === null ? [] : (core().steps(state) as { x: number; fx: number; next: number | null; status: string }[]);
  const last = steps[steps.length - 1];
  return {
    startX: x0, stepsRequested: Number(state.n),
    stepsDrawn: steps.map((s) => ({ x: s.x, fx: s.fx, next: s.next, status: s.status })),
    reachedARoot: last ? last.status === "ok" && Math.abs(last.fx) < 1e-9 : false,
    leftThePicture: last ? last.status !== "ok" : false,
    note: "Near a simple root each step roughly squares the error. Near a flat part of the curve the tangent throws the next point far away.",
  };
}
