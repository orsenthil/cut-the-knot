#!/usr/bin/env node
"use strict";

/*
 * Logic test for black-scholes-formula/black-scholes-formula-core.js.
 *
 *   node porting/check-black-scholes-formula.mjs
 *
 * 1. Textbook values: S = K = 100, r = 5%, sigma = 20%, T = 1 gives a call
 *    of 10.4506 and a put of 5.5735; put-call parity holds everywhere.
 * 2. Every Greek equals a finite-difference slope of the price.
 * 3. Limits: with tiny volatility the call is max(S - K e^(-rT), 0); with
 *    huge volatility it tends to S; d1 and d2 as the article writes them.
 * 4. Monte Carlo: 400,000 end prices grown at r land on the formula within
 *    the 95% band; grown at mu = 15% they miss it by far more.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("black-scholes-formula/black-scholes-formula-core.js", "BlackScholesFormulaCore");
const o = { S: 100, K: 100, r: 0.05, sigma: 0.2, T: 1 };

{
  const p = C.price(o);
  equal("the textbook call and put", `${p.call.toFixed(4)} ${p.put.toFixed(4)}`, "10.4506 5.5735");
  let parity = true;
  for (const S of [60, 100, 140]) for (const K of [80, 100, 120]) for (const T of [0.1, 1, 3]) for (const sigma of [0.1, 0.5]) {
    const q = C.price({ S, K, r: 0.04, sigma, T });
    if (Math.abs(q.call - q.put - (S - K * Math.exp(-0.04 * T))) > 1e-9) parity = false;
  }
  check("put-call parity C - P = S - K e^(-rT) on 54 cases", parity);
  check("d2 = d1 - sigma sqrt T, and N(d1) is the call's delta", Math.abs(p.d2 - (p.d1 - 0.2)) < 1e-12 && p.Nd1 === p.greeks.callDelta);
}
{
  const p = C.price(o), g = p.greeks, h = 1e-4;
  const at = (k, d) => C.price({ ...o, [k]: o[k] + d });
  const slope = (k, f) => (f(at(k, h)) - f(at(k, -h))) / (2 * h);
  const checks = [
    ["delta", slope("S", (q) => q.call), g.callDelta], ["put delta", slope("S", (q) => q.put), g.putDelta],
    ["gamma", slope("S", (q) => q.greeks.callDelta), g.gamma], ["vega", slope("sigma", (q) => q.call), g.vega],
    ["theta (as time passes, T falls)", -slope("T", (q) => q.call), g.callTheta], ["put theta", -slope("T", (q) => q.put), g.putTheta],
    ["rho", slope("r", (q) => q.call), g.callRho], ["put rho", slope("r", (q) => q.put), g.putRho],
  ];
  const bad = checks.filter(([, a, b]) => Math.abs(a - b) > 1e-5 * Math.max(1, Math.abs(b)));
  check("every Greek equals the price's slope: " + checks.map((c) => c[0]).join(", "), bad.length === 0, bad.map((b) => b[0]).join());
}
{
  const tiny = C.price({ ...o, sigma: 1e-4 }), huge = C.price({ ...o, sigma: 8, T: 3 });
  check("tiny volatility: the call is S - K e^(-rT)", Math.abs(tiny.call - (100 - 100 * Math.exp(-0.05))) < 1e-6);
  check("huge volatility: the call is almost the stock itself", huge.call > 99 && huge.call < 100);
  const deep = C.price({ ...o, S: 150 });
  check("deep in the money: delta near 1, chance of exercise near 1", deep.Nd1 > 0.99 && deep.Nd2 > 0.98);
}
{
  const p = C.price(o).call;
  const rn = C.monteCarlo(o, o.r, 400000, 3), real = C.monteCarlo(o, 0.15, 400000, 3);
  check(`Monte Carlo at the bank's rate: ${rn.mean.toFixed(3)} ± ${rn.band.toFixed(3)}, formula ${p.toFixed(3)}`, Math.abs(rn.mean - p) < rn.band);
  check(`at the stock's own growth of 15%: ${real.mean.toFixed(3)}, far from the price`, Math.abs(real.mean - p) > 10 * real.band);
  const s = C.start();
  check("running the simulation marks the demo done", C.result(s) === null && C.result(C.simulate(s)) === "done");
  const before = JSON.stringify(s);
  C.set(s, "K", 120);
  equal("a change leaves the old position alone", JSON.stringify(s), before);
}
done("black-scholes-formula");
