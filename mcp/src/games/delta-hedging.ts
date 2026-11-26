/*
 * run_game_logic actions and saved-position reader for Delta Hedging (Black-Scholes path). The
 * core lives in delta-hedging/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["delta-hedging"].DeltaHedgingCore;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function actions(): GameActions {
  return {
    hedge: {
      describe: "The page's month (a one-month $100 call at 30% volatility, 5% interest, 20 trading days) on the price path for a seed: the call's premium, each day's stock price and delta, and the final profit of the daily delta hedge and of no hedge.",
      args: '{ "seed": 1 }',
      run: (args) => {
        const C = core();
        const p = C.path(Math.max(1, Math.round(num(args, "seed", 1)))) as number[];
        const d = C.deltaHoldings(p) as number[];
        return {
          premium: r2(C.call(p[0], C.T)),
          days: d.map((x, i) => ({ day: i, stock: r2(p[i]), delta: r2(x) })),
          finalStock: r2(p[C.DAYS]),
          deltaHedgeProfit: r2(C.books(p, d).profit!), noHedgeProfit: r2(C.books(p, new Array(C.DAYS).fill(0)).profit!),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ ...state });
  const p = C.path(s.seed) as number[], k = s.holdings.length;
  const tau = C.T - (k * C.T) / C.DAYS;
  const sc = C.scores(s);
  return {
    day: `${k} of ${C.DAYS}`, stock: r2(p[k]), callWorthNow: r2(C.call(p[k], tau)),
    sharesHeld: k ? s.holdings[k - 1] : 0, deltaNow: k < C.DAYS ? r2(C.delta(p[k], tau)) : null,
    finished: sc ? { you: r2(sc.you!), computerDeltaHedge: r2(sc.computer!), noHedge: r2(sc.none!), result: C.result(s) } : null,
    note: "Holding delta shares each day keeps shares + cash close to the call's value.",
  };
}
