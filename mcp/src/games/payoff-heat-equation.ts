/*
 * run_game_logic actions and saved-position reader for From Payoff to Heat Equation
 * (Black-Scholes path). The core lives in payoff-heat-equation/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["payoff-heat-equation"].PayoffHeatEquationCore;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

function compare(S: number, K: number, r: number, sigma: number, tau: number) {
  const C = core();
  const x = Math.log(S) + (r - sigma * sigma / 2) * tau;
  const sol = C.heatSolve(K, sigma, tau);
  return {
    stock: S, strike: K, timeLeft: tau, volatility: sigma, interest: r,
    blackScholes: r4(C.call(S, K, r, sigma, tau)),
    heatEquationGrid: r4(C.valueFromHeat(sol, S, r, sigma, tau)),
    heatVariables: { x: r4(x), w: r4(C.w(x, K, sigma, tau)), discount: r4(Math.exp(-r * tau)) },
    payoffNow: Math.max(S - K, 0),
  };
}

export function actions(): GameActions {
  return {
    compare: {
      describe: "A call's value from the Black-Scholes formula and from solving the heat equation on a grid and changing variables back (x = ln S + (r - sigma^2/2) tau, V = e^(-r tau) w), with the heat-side numbers. tau is the time left in years.",
      args: '{ "S": 100, "K": 100, "r": 0.05, "sigma": 0.3, "tau": 0.5 }',
      run: (args) => {
        const S = num(args, "S", 100), K = num(args, "K", 100), r = num(args, "r", 0.05), sigma = num(args, "sigma", 0.3), tau = num(args, "tau", 0.5);
        if (S <= 0 || K <= 0 || sigma <= 0 || sigma > 2 || tau < 0 || tau > 5 || r < 0 || r > 1) throw new Error("need S, K > 0, 0 < sigma <= 2, 0 <= tau <= 5, 0 <= r <= 1");
        if (Math.abs(Math.log(S / K)) > 2) throw new Error("keep S within a factor e^2 of K (the grid's range)");
        return compare(S, K, r, sigma, tau);
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = core().start({ ...state });
  return { ...compare(100, s.K, s.r, s.sigma, s.tau), seen: s.seen };
}
