/*
 * run_game_logic actions and saved-position reader for Binomial Option Tree (Black-Scholes path).
 * The core lives in binomial-option-tree/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["binomial-option-tree"].BinomialOptionTreeCore;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
type O = { S: number; K: number; r: number; sigma: number; T: number; type: string; american: boolean };

function option(args: Json): O {
  const o = { S: num(args, "S", 100), K: num(args, "K", 100), r: num(args, "r", 0.05), sigma: num(args, "sigma", 0.2), T: num(args, "T", 1), type: args.type === "put" ? "put" : "call", american: args.american === true };
  if (o.S <= 0 || o.K <= 0 || o.sigma <= 0 || o.T <= 0 || o.r < 0 || o.r > 1) throw new Error("need S, K, sigma, T > 0 and 0 <= r <= 1");
  return o;
}

export function actions(): GameActions {
  return {
    tree: {
      describe: "Cox-Ross-Rubinstein binomial price of a call or put (European, or American with \"american\": true) for n steps (1..5000), with up/down factors, the risk-neutral chance, today's hedge, and the Black-Scholes price of the European option for comparison. The tree itself is listed for n <= 4.",
      args: '{ "S": 100, "K": 100, "r": 0.05, "sigma": 0.2, "T": 1, "type": "call", "n": 3 }',
      run: (args) => {
        const C = core();
        const o = option(args), n = Math.round(num(args, "n", 3));
        if (n < 1 || n > 5000) throw new Error("n must be 1..5000");
        const small = n <= 200 ? C.tree(o, n) : null;
        return {
          steps: n, price: r4(C.price(o, n)), blackScholes: r4(C.blackScholes({ ...o, american: false })),
          up: small ? r4(small.u) : r4(Math.exp(o.sigma * Math.sqrt(o.T / n))), riskNeutralChanceUp: small ? r4(small.q) : undefined, hedgeToday: small ? r4(small.delta[0][0]) : undefined,
          nodes: small && n <= 4 ? small.stock.map((row: number[], i: number) => row.map((s, j) => ({ stock: r4(s), value: r4(small.value[i][j]) }))) : undefined,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ ...state });
  const t = C.tree(s, s.n);
  return {
    option: `${s.american ? "American" : "European"} ${s.type}, strike ${s.K}, volatility ${s.sigma}, interest ${s.r}, one year, stock 100`,
    steps: s.n, treePrice: r4(t.value[0][0]), blackScholes: r4(C.blackScholes({ ...s, american: false })), hedgeToday: r4(t.delta[0][0]), explored: s.explored,
  };
}
