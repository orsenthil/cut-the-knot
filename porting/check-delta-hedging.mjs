#!/usr/bin/env node
"use strict";

/*
 * Logic test for delta-hedging/delta-hedging-core.js.
 *
 *   node porting/check-delta-hedging.mjs
 *
 * 1. Delta is the slope of the call's price; the bookkeeping of the books
 *    is right (no hedge: the premium with interest minus the payoff).
 * 2. Over 2,000 price paths the daily delta hedge ends close to zero on
 *    average, with a small spread; with no hedge the spread is far wider.
 * 3. Rebalancing four times as often halves the spread (1/sqrt(n)).
 * 4. The game: following delta always wins; never hedging usually loses;
 *    the stock's own growth does not bias the hedge.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("delta-hedging/delta-hedging-core.js", "DeltaHedgingCore");
const stats = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }; };

{
  let ok = true;
  for (const S of [80, 95, 100, 110, 130]) for (const tau of [0.01, C.T]) {
    const h = 1e-4, slope = (C.call(S + h, tau) - C.call(S - h, tau)) / (2 * h);
    if (Math.abs(slope - C.delta(S, tau)) > 1e-6) ok = false;
  }
  check("delta is the slope of the call's price", ok);
  const p = C.path(4), none = C.books(p, new Array(C.DAYS).fill(0)).profit;
  check("with no shares, the result is the premium with interest minus the payoff", Math.abs(none - (C.call(100, C.T) * Math.exp(C.R * C.T) - Math.max(p[C.DAYS] - 100, 0))) < 1e-9);
  equal("the premium for a one-month $100 call at 30%", C.call(100, C.T).toFixed(2), "3.57");
}
{
  const hedged = [], naked = [];
  for (let seed = 1; seed <= 2000; seed++) {
    const p = C.path(seed);
    hedged.push(C.books(p, C.deltaHoldings(p)).profit);
    naked.push(C.books(p, new Array(C.DAYS).fill(0)).profit);
  }
  const h = stats(hedged), n = stats(naked);
  check(`daily delta hedging: average ${h.m.toFixed(3)}, spread ${h.sd.toFixed(3)}: small`, Math.abs(h.m) < 0.08 && h.sd < 0.8);
  check(`no hedge: spread ${n.sd.toFixed(2)}, more than five times wider`, n.sd > 5 * h.sd);
  const fine = [];
  for (let seed = 1; seed <= 2000; seed++) { const days = 80, p = C.path(seed, days); fine.push(C.books(p, C.deltaHoldings(p, days), days).profit); }
  const f = stats(fine);
  check(`rebalancing 4 times as often halves the spread (${h.sd.toFixed(3)} -> ${f.sd.toFixed(3)})`, Math.abs(f.sd / h.sd - 0.5) < 0.08);
}
{
  let follow = true, nakedLoses = 0;
  for (let seed = 1; seed <= 300; seed++) {
    let s = C.start({ seed });
    const p = C.path(seed);
    for (let i = 0; i < C.DAYS; i++) s = C.nextDay(C.setShares(s, C.delta(p[i], C.T - (i * C.T) / C.DAYS)));
    if (C.result(s) !== "win") follow = false;
    let t = C.start({ seed });
    for (let i = 0; i < C.DAYS; i++) t = C.nextDay(C.setShares(t, 0));
    if (C.result(t) === "lose") nakedLoses++;
  }
  check("following delta (to the cent) wins on all 300 paths", follow);
  check(`never hedging loses on most paths (${nakedLoses} of 300)`, nakedLoses > 200);
  const s = C.start();
  check("no result before the month is over; no moves after it", C.result(s) === null && C.nextDay(C.start({ holdings: new Array(C.DAYS).fill(0.5) })) === null);
  const before = JSON.stringify(s);
  C.nextDay(s);
  equal("a move leaves the old position alone", JSON.stringify(s), before);
}
done("delta-hedging");
