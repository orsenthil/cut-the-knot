#!/usr/bin/env node
"use strict";

/*
 * Logic test for riskless-hedge/riskless-hedge-core.js.
 *
 *   node porting/check-riskless-hedge.mjs
 *
 * 1. The article's example: half a share, $45 either way, the call is $5.
 * 2. For every puzzle the hedge makes both outcomes equal, it is a multiple
 *    of 0.05 (so the page's slider can hit it), and the price equals the
 *    discounted risk-neutral average; the listed prices are as stated.
 * 3. No arbitrage: selling the option for more (or less) than the price
 *    gives a riskless profit; the real chance of an up move changes the
 *    expected payoff but never the price.
 * 4. The game: a win needs the riskless hedge and the price to the cent.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("riskless-hedge/riskless-hedge-core.js", "RisklessHedgeCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

{
  const P = C.puzzle("article");
  const t = C.tomorrow(P, 0.5);
  equal("the article: half a share, sell one call: worth this much either way", `${t.up} ${t.down}`, "45 45");
  equal("so the call is $50 - $45", C.price(P), 5);
}
{
  let ok = true, grid = true, rn = true;
  for (const P of C.PUZZLES) {
    const d = C.hedge(P), t = C.tomorrow(P, d);
    if (!near(t.up, t.down)) ok = false;
    if (!near(Math.round(d * 20) / 20, d)) grid = false;
    if (!near(C.price(P), C.byRiskNeutral(P))) rn = false;
  }
  check("every puzzle's hedge makes both outcomes equal", ok);
  check("every hedge is a multiple of 0.05, reachable on the slider", grid);
  check("the price equals the discounted risk-neutral average payoff", rn);
  equal("the five prices", C.PUZZLES.map((P) => C.price(P).toFixed(3)).join(" "), "5.000 7.143 7.500 10.000 5.294");
  check("the risk-neutral chance is a real probability in every puzzle", C.PUZZLES.every((P) => C.riskNeutral(P) > 0 && C.riskNeutral(P) < 1));
}
{
  let arb = true, indep = true;
  for (const P of C.PUZZLES) {
    const d = C.hedge(P), fair = C.price(P);
    for (const sell of [fair + 1, fair - 1]) {
      // Sell the option for `sell` (or buy it, if it is cheap), hedge, bank the rest: profit in every state?
      const sign = sell > fair ? 1 : -1;
      const cash = sign * (sell - d * P.S);
      const t = C.tomorrow(P, d);
      const profit = cash * (1 + P.r) + sign * t.up; // t.up = t.down
      if (!(profit > 0)) arb = false;
    }
    const e1 = C.expected(P, 0.2), e2 = C.expected(P, 0.9);
    if (near(e1, e2) || !near(C.price(P), C.byRiskNeutral(P))) indep = false;
  }
  check("selling for $1 more or $1 less than the price leaves a riskless profit for someone", arb);
  check("the real chance of going up changes the expected payoff, never the price", indep);
}
{
  let s = C.start();
  s = C.setGuess(C.setDelta(s, 0.5), 5);
  check("the hedge and the price: a win", C.result(s) === "win");
  check("the price alone, without the hedge, is not yet a win", C.result(C.setDelta(s, 0.4)) === null);
  const before = JSON.stringify(s);
  C.setDelta(s, 0.1);
  equal("a move leaves the old position alone", JSON.stringify(s), before);
}
done("riskless-hedge");
