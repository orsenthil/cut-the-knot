/*
 * run_game_logic actions and saved-position reader for Stock Price Paths (Black-Scholes path).
 * The core lives in stock-price-paths/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["stock-price-paths"].StockPricePathsCore;
const r2 = (v: number) => Math.round(v * 100) / 100;

function summary(mu: number, sigma: number, count: number, seed: number) {
  const C = core();
  const st = C.sampleStats(C.paths(mu, sigma, count, seed));
  return {
    start: C.S0, years: C.T, growth: mu, volatility: sigma,
    theory: { average: r2(C.mean(mu)), median: r2(C.median(mu, sigma)), medianGrowthRate: r2(mu - sigma * sigma / 2) },
    simulated: { paths: count, average: r2(st.mean), median: r2(st.median) },
    note: "The median grows at mu - sigma^2/2: Ito's correction.",
  };
}

export function actions(): GameActions {
  return {
    simulate: {
      describe: "Geometric Brownian motion from 100 over one year: the theoretical average and median end price, and those of a seeded simulation of up to 5000 paths. mu and sigma are yearly rates (0.1 = 10%).",
      args: '{ "mu": 0.1, "sigma": 0.3, "paths": 1000, "seed": 1 }',
      run: (args) => {
        const mu = num(args, "mu", 0.1), sigma = num(args, "sigma", 0.3), n = Math.round(num(args, "paths", 1000));
        if (sigma <= 0 || sigma > 2 || Math.abs(mu) > 2 || n < 1 || n > 5000) throw new Error("need 0 < sigma <= 2, |mu| <= 2 and 1..5000 paths");
        return summary(mu, sigma, n, Math.round(num(args, "seed", 1)));
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = core().start({ mu: state.mu, sigma: state.sigma, count: state.count, seed: state.seed, runs: state.runs });
  return { ...summary(s.mu, s.sigma, s.count, s.seed), runs: s.runs };
}
