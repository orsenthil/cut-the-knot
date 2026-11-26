#!/usr/bin/env node
"use strict";

/*
 * Logic test for binomial-option-tree/binomial-option-tree-core.js.
 *
 *   node porting/check-binomial-option-tree.mjs
 *
 * 1. One step is the riskless hedge: the tree's delta and price match the
 *    one-step formulas, and at every node of a 6-step tree, delta shares
 *    plus cash replicate both values one step on.
 * 2. Backward induction equals the closed sum over end nodes with binomial
 *    chances q^j (1-q)^(n-j) C(n, j), discounted.
 * 3. Convergence: the tree's call tends to Black-Scholes (within 0.01 at
 *    n = 1000, 0.001 at 10000 for the page's default), alternating above
 *    and below; put-call parity holds in every tree and in the formula.
 * 4. An American put is worth at least the European one, and strictly more
 *    when interest is positive (early exercise).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("binomial-option-tree/binomial-option-tree-core.js", "BinomialOptionTreeCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const o = { S: 100, K: 100, r: 0.05, sigma: 0.2, T: 1, type: "call" };

{
  const t = C.tree(o, 1);
  const cu = Math.max(o.S * t.u - o.K, 0), cd = Math.max(o.S * t.d - o.K, 0);
  const dl = (cu - cd) / (o.S * t.u - o.S * t.d);
  check("one step: delta is (Cu - Cd)/(Su - Sd)", near(t.delta[0][0], dl));
  check("and the price is delta S minus the discounted sure value", near(t.value[0][0], dl * o.S - (dl * o.S * t.d - cd) * Math.exp(-o.r)));
  const T6 = C.tree(o, 6);
  let rep = true;
  for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) {
    const D = T6.delta[i][j], cash = T6.value[i][j] - D * T6.stock[i][j], g = Math.exp(o.r * T6.dt);
    for (const k of [j, j + 1]) if (!near(D * T6.stock[i + 1][k] + cash * g, T6.value[i + 1][k], 1e-9)) rep = false;
  }
  check("6 steps: at every node, delta shares plus cash replicate the option a step later", rep);
}
{
  let ok = true;
  for (const n of [1, 5, 20, 60]) {
    const t = C.tree(o, n);
    let s = 0, binom = 1;
    for (let j = 0; j <= n; j++) {
      if (j > 0) binom = (binom * (n - j + 1)) / j;
      s += binom * t.q ** j * (1 - t.q) ** (n - j) * C.payoff(o, o.S * t.u ** j * t.d ** (n - j));
    }
    if (!near(s * Math.exp(-o.r * o.T), t.value[0][0], 1e-9)) ok = false;
  }
  check("backward induction equals the binomial-weighted average of the payoffs, discounted", ok);
}
{
  const bs = C.blackScholes(o);
  equal("Black-Scholes call for S = K = 100, r = 5%, sigma = 20%, T = 1", bs.toFixed(4), "10.4506");
  check(`the tree at n = 1000 is within 0.01 (${C.price(o, 1000).toFixed(4)})`, Math.abs(C.price(o, 1000) - bs) < 0.01);
  check(`and at n = 10000 within 0.001 (${C.price(o, 10000).toFixed(5)})`, Math.abs(C.price(o, 10000) - bs) < 0.001);
  const errs = [50, 51, 52, 53].map((n) => C.price(o, n) - bs);
  check("the error alternates in sign between odd and even n", errs[0] * errs[1] < 0 && errs[1] * errs[2] < 0);
  let parity = true;
  for (const n of [1, 3, 10, 100]) {
    const c = C.price(o, n), p = C.price({ ...o, type: "put" }, n);
    if (!near(c - p, o.S - o.K * Math.exp(-o.r * o.T), 1e-9)) parity = false;
  }
  const pf = C.blackScholes({ ...o, type: "put" });
  check("put-call parity C - P = S - K e^(-rT) in every tree and in the formula", parity && near(bs - pf, o.S - o.K * Math.exp(-o.r)));
}
{
  const put = { ...o, type: "put" };
  const eu = C.price(put, 500), am = C.price({ ...put, american: true }, 500);
  check(`an American put is worth more than a European one (${am.toFixed(3)} > ${eu.toFixed(3)})`, am > eu + 0.1);
  check("an American call on a stock without dividends is worth the European one", near(C.price({ ...o, american: true }, 200), C.price(o, 200), 1e-9));
  const s = C.start();
  check("exploring a tree of 6 or more steps marks the demo done", C.result(s) === null && C.result(C.set(s, "n", 6)) === "done");
  const before = JSON.stringify(s);
  C.set(s, "n", 8);
  equal("a change leaves the old position alone", JSON.stringify(s), before);
}
done("binomial-option-tree");
