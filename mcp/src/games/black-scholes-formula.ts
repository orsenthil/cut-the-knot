/*
 * run_game_logic actions and saved-position reader for The Black-Scholes Formula (Black-Scholes
 * path). The core lives in black-scholes-formula/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["black-scholes-formula"].BlackScholesFormulaCore;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
type O = { S: number; K: number; r: number; sigma: number; T: number };

function priced(o: O) {
  const p = core().price(o);
  const g = p.greeks as Record<string, number>;
  return {
    inputs: o, call: r4(p.call), put: r4(p.put), d1: r4(p.d1), d2: r4(p.d2),
    hedgeNd1: r4(p.Nd1), chanceOfExerciseNd2: r4(p.Nd2),
    parity: { callMinusPut: r4(p.call - p.put), stockMinusDiscountedStrike: r4(o.S - o.K * Math.exp(-o.r * o.T)) },
    greeks: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, r4(v)])),
  };
}
function parse(args: Json): O {
  const o = { S: num(args, "S", 100), K: num(args, "K", 100), r: num(args, "r", 0.05), sigma: num(args, "sigma", 0.2), T: num(args, "T", 1) };
  if (o.S <= 0 || o.K <= 0 || o.sigma <= 0 || o.sigma > 3 || o.T <= 0 || o.T > 30 || o.r < 0 || o.r > 1) throw new Error("need S, K > 0, 0 < sigma <= 3, 0 < T <= 30, 0 <= r <= 1");
  return o;
}

export function actions(): GameActions {
  return {
    price: {
      describe: "Black-Scholes call and put with d1, d2, N(d1) (the hedge), N(d2) (risk-neutral chance of exercise), put-call parity and the Greeks (theta per year, vega and rho per unit). r and sigma are yearly rates (0.05 = 5%), T in years.",
      args: '{ "S": 100, "K": 100, "r": 0.05, "sigma": 0.2, "T": 1 }',
      run: (args) => priced(parse(args)),
    },
    simulate: {
      describe: "Monte Carlo price of the call: n end prices (up to 200000) grown at a chosen rate g (use r for the risk-neutral price; the stock's own growth gives a different number), payoffs averaged and discounted at r, with a 95% band.",
      args: '{ "S": 100, "K": 100, "r": 0.05, "sigma": 0.2, "T": 1, "g": 0.05, "n": 50000, "seed": 1 }',
      run: (args) => {
        const o = parse(args), n = Math.round(num(args, "n", 50000));
        if (n < 2 || n > 200000) throw new Error("n must be 2..200000");
        const m = core().monteCarlo(o, num(args, "g", o.r), n, Math.round(num(args, "seed", 1)));
        return { mean: r4(m.mean), band95: r4(m.band), paths: m.n, formula: r4(core().price(o).call) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = core().start({ ...state });
  return { ...priced({ S: s.S, K: s.K, r: s.r, sigma: s.sigma, T: s.T }), stocksOwnGrowth: s.mu, simulationsRun: s.runs };
}
