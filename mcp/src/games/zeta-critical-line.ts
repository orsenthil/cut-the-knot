/*
 * run_game_logic actions and saved-position reader for the zeta function on
 * the critical line. The core lives in zeta-critical-line/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["zeta-critical-line"].ZetaCriticalLineCore;

export function actions(): GameActions {
  return {
    evaluate: {
      describe: "zeta(sigma + i t) as a complex number and its size, for sigma 0.05..0.95 and t 0..100. sigma 0.5 is the critical line.",
      args: '{ "sigma": 0.5, "t": 14.1347 }',
      run: (args) => core().at(num(args, "sigma", 0.5), num(args, "t", 0)),
    },
    zeros: {
      describe: "The t values of the zeros 1/2 + it of zeta below a limit (default 100, at most 100): 29 of them below 100.",
      args: '{ "max": 50 }',
      run: (args) => {
        const max = Math.min(100, num(args, "max", 100));
        const zs = core().zeros(max);
        return { max, count: zs.length, zeros: zs, note: "All of these lie on sigma = 1/2, as the Riemann Hypothesis predicts for every zero." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const a = core().at(state.sigma, state.t);
  const zs = core().zeros(100);
  let nearest = zs[0];
  for (const z of zs) if (Math.abs(z - a.t) < Math.abs(nearest - a.t)) nearest = z;
  return {
    sigma: a.sigma, t: a.t, re: a.re, im: a.im, distanceFromOrigin: a.abs,
    onCriticalLine: a.sigma === 0.5, nearestZeroOnLine: nearest,
    zerosBelowT: zs.filter((z) => z <= a.t).length,
    note: a.sigma === 0.5 ? (a.abs < 0.05 ? "At a zero: the curve is passing through the origin." : "On the critical line.") : "Off the line, where no zero is known.",
  };
}
