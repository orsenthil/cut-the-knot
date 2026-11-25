/*
 * run_game_logic actions and saved-position reader for Rolle's and the Mean Value Theorems.
 * The core lives in mean-value-theorem/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["mean-value-theorem"].MVTCore;

export function actions(): GameActions {
  return {
    mean_value_points: {
      describe: "For the starting spline (or given control heights ys, 11 numbers) and an interval [a, b] (0..10): the points c in (a, b) where the tangent's slope equals the secant's: f'(c) = (f(b) - f(a)) / (b - a). There is always at least one.",
      args: '{ "a": 1.1, "b": 8.1 }',
      run: (args) => {
        const s = core().start();
        if (Array.isArray(args.ys)) { if (args.ys.length !== 11) throw new Error("ys needs 11 numbers"); s.ys = (args.ys as unknown[]).map(Number); }
        s.a = Math.max(0, Math.min(10, num(args, "a", 1.1))); s.b = Math.max(0, Math.min(10, num(args, "b", 8.1)));
        const pts = core().meanValuePoints(s), r = core().readings(s);
        return { a: s.a, b: s.b, secantSlope: r ? r.secant : null, points: pts };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { ys: (state.ys as number[]).map(Number), a: Number(state.a), b: Number(state.b), x: Number(state.x) };
  const r = core().readings(s);
  if (!r) return { note: "A and B are at the same place: no secant." };
  return { a: r.a, b: r.b, secantSlope: r.secant, tangentSlopeAtX: r.tangent, tangentParallelToSecant: r.parallel, rollesCase: r.rolle, meanValuePoints: core().meanValuePoints(s), note: "Between a and b there is always a point where the tangent is parallel to the secant (and a horizontal tangent if f(a) = f(b))." };
}
