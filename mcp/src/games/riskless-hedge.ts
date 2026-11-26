/*
 * run_game_logic actions and saved-position reader for The Riskless Hedge (Black-Scholes path).
 * The core lives in riskless-hedge/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["riskless-hedge"].RisklessHedgeCore;
type P = { id: string; name: string; S: number; up: number; down: number; K: number; type: string; r: number };
const r2 = (v: number) => Math.round(v * 10000) / 10000;

function solve(P: P) {
  const C = core();
  const d = C.hedge(P), t = C.tomorrow(P, d);
  return {
    stock: { today: P.S, up: P.up, down: P.down }, option: `${P.type} at ${P.K}`, interestPerStep: P.r,
    payoffs: { up: C.payoff(P, P.up), down: C.payoff(P, P.down) },
    hedgeShares: r2(d), heldEitherWay: r2(t.up), price: r2(C.price(P)), riskNeutralChanceUp: r2(C.riskNeutral(P)),
  };
}

export function actions(): GameActions {
  return {
    hedge: {
      describe: "One-step option pricing: a stock at S that goes to up or down, a call or put with strike K, interest r for the step. Returns the hedge (shares per option sold), the sure value of the hedged portfolio, the price, and the risk-neutral chance of going up.",
      args: '{ "S": 100, "up": 110, "down": 90, "K": 100, "type": "call", "r": 0 }',
      run: (args) => {
        const P = { id: "x", name: "x", S: num(args, "S", 100), up: num(args, "up", 110), down: num(args, "down", 90), K: num(args, "K", 100), type: args.type === "put" ? "put" : "call", r: num(args, "r", 0) };
        if (!(P.down < P.S * (1 + P.r) && P.S * (1 + P.r) < P.up) || P.S <= 0 || P.down <= 0) throw new Error("need 0 < down < S(1 + r) < up, or there is an arbitrage in the stock itself");
        return solve(P);
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ puzzle: state.puzzle, delta: state.delta, p: state.p, guess: state.guess });
  const P = C.puzzle(s.puzzle) as P, t = C.tomorrow(P, s.delta);
  return {
    puzzle: P.name, sharesHeld: s.delta, portfolioTomorrow: { up: r2(t.up), down: r2(t.down) },
    riskless: C.riskless(s), priceGuess: s.guess, priceRight: C.priced(s), chanceUpSlider: s.p,
    note: "The answer is in the hedge action; let the learner find the shares first.",
  };
}
