"use strict";

/*
 * The Riskless Hedge: an original game for the Black-Scholes path.
 *
 * A stock is at $100 and will be either $110 or $90 tomorrow. A call with
 * strike $100 pays $10 or $0. Sell the call and buy half a share: tomorrow
 * you hold $45 either way. A portfolio with no risk must be worth what the
 * bank would give for it, so the call is worth what makes the books balance:
 * $50 - $45 = $5 (with no interest). This is the example in David Alvarez
 * Rosa's "Deriving Black-Scholes".
 *
 * The idea: hold Delta = (Cu - Cd) / (Su - Sd) shares per option sold. Then
 * the price is Delta S0 - (Delta Su - Cu) / (1 + r), the same as the average
 * payoff under the "risk-neutral" chance q = ((1 + r) S0 - Sd) / (Su - Sd),
 * discounted. The real chance of going up never enters.
 *
 * Puzzles: each gives the stock, its two next prices, the option and the
 * interest for the step. Find the shares that make the portfolio riskless,
 * then the price. This file defines one global, RisklessHedgeCore.
 */
const RisklessHedgeCore = (() => {
  const PUZZLES = [
    { id: "article", name: "The article's call", S: 100, up: 110, down: 90, K: 100, type: "call", r: 0 },
    { id: "interest", name: "The same call, 5% interest", S: 100, up: 110, down: 90, K: 100, type: "call", r: 0.05 },
    { id: "wide", name: "A $45 call on a $50 stock", S: 50, up: 60, down: 40, K: 45, type: "call", r: 0 },
    { id: "put", name: "A put", S: 100, up: 120, down: 80, K: 100, type: "put", r: 0 },
    { id: "far", name: "A call far above the price, 2% interest", S: 80, up: 100, down: 60, K: 90, type: "call", r: 0.02 },
  ];
  const puzzle = (id) => PUZZLES.find((p) => p.id === id) || PUZZLES[0];

  const payoff = (P, s) => (P.type === "call" ? Math.max(s - P.K, 0) : Math.max(P.K - s, 0));
  /** Tomorrow's value of (delta shares, one option sold) in each state. */
  function tomorrow(P, delta) {
    return { up: delta * P.up - payoff(P, P.up), down: delta * P.down - payoff(P, P.down) };
  }
  const hedge = (P) => (payoff(P, P.up) - payoff(P, P.down)) / (P.up - P.down);
  /** The price: shares cost delta S today, and the riskless remainder is worth its value discounted. */
  function price(P) {
    const d = hedge(P);
    return d * P.S - tomorrow(P, d).up / (1 + P.r);
  }
  const riskNeutral = (P) => ((1 + P.r) * P.S - P.down) / (P.up - P.down);
  const byRiskNeutral = (P) => { const q = riskNeutral(P); return (q * payoff(P, P.up) + (1 - q) * payoff(P, P.down)) / (1 + P.r); };
  /** What a gambler would expect to get, discounted, if the stock goes up with chance p: not the price. */
  const expected = (P, p) => (p * payoff(P, P.up) + (1 - p) * payoff(P, P.down)) / (1 + P.r);

  const round2 = (v) => Math.round(v * 100) / 100;

  function start(options = {}) {
    const P = puzzle(options.puzzle);
    const delta = Number.isFinite(Number(options.delta)) ? Math.max(-1, Math.min(1, Number(options.delta))) : 0;
    return { puzzle: P.id, delta: round2(delta), p: Number.isFinite(Number(options.p)) ? Math.max(0, Math.min(1, Number(options.p))) : 0.5, guess: Number.isFinite(Number(options.guess)) ? Number(options.guess) : null };
  }
  const setDelta = (s, d) => (Number.isFinite(Number(d)) ? { ...s, delta: round2(Math.max(-1, Math.min(1, Number(d)))) } : null);
  const setChance = (s, p) => (Number.isFinite(Number(p)) ? { ...s, p: Math.max(0, Math.min(1, Number(p))) } : null);
  const setGuess = (s, g) => (Number.isFinite(Number(g)) ? { ...s, guess: Number(g) } : null);

  const riskless = (s) => { const t = tomorrow(puzzle(s.puzzle), s.delta); return Math.abs(t.up - t.down) < 1e-9; };
  const priced = (s) => s.guess !== null && Math.abs(s.guess - price(puzzle(s.puzzle))) < 0.01;
  const result = (s) => (riskless(s) && priced(s) ? "win" : null);

  return { PUZZLES, puzzle, payoff, tomorrow, hedge, price, riskNeutral, byRiskNeutral, expected, start, setDelta, setChance, setGuess, riskless, priced, result };
})();
