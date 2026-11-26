#!/usr/bin/env node
"use strict";

/*
 * Logic test for payoff-heat-equation/payoff-heat-equation-core.js.
 *
 *   node porting/check-payoff-heat-equation.mjs
 *
 * 1. The Black-Scholes formula satisfies the Black-Scholes equation
 *    (finite-difference residual tiny on a grid of S and tau) and tends to
 *    the payoff as tau -> 0.
 * 2. The change of variables: w = e^(r tau) V at x = ln S + (r - sigma^2/2) tau
 *    is the closed form w, and w satisfies the heat equation.
 * 3. The heat kernel: spreading the payoff with a bell curve of variance
 *    sigma^2 tau gives w (Simpson's rule, to 1e-6).
 * 4. A brute-force finite-difference solution of the heat equation, turned
 *    back into V, matches the formula within 3 cents.
 * 5. No-arbitrage bounds: max(S - K e^(-r tau), 0) <= V <= S, V convex in S.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("payoff-heat-equation/payoff-heat-equation-core.js", "PayoffHeatEquationCore");
const K = 100, r = 0.05, sigma = 0.3;

{
  let worst = 0;
  for (const S of [60, 80, 100, 120, 160]) for (const tau of [0.1, 0.5, 1, 2]) {
    const h = 0.001 * S, e = 1e-5;
    const V = (s, t) => C.call(s, K, r, sigma, t);
    const Vt = -(V(S, tau + e) - V(S, tau - e)) / (2 * e); // dV/dt = -dV/dtau
    const VS = (V(S + h, tau) - V(S - h, tau)) / (2 * h), VSS = (V(S + h, tau) - 2 * V(S, tau) + V(S - h, tau)) / (h * h);
    worst = Math.max(worst, Math.abs(Vt + r * S * VS + 0.5 * sigma * sigma * S * S * VSS - r * V(S, tau)));
  }
  check(`the formula satisfies the Black-Scholes equation (largest residual ${worst.toExponential(1)})`, worst < 1e-3);
  check("with no time left, the value is the payoff", [50, 100, 150].every((S) => Math.abs(C.call(S, K, r, sigma, 1e-12) - Math.max(S - K, 0)) < 1e-4));
}
{
  let same = true, heat = true;
  for (const S of [70, 100, 140]) for (const tau of [0.25, 1]) {
    const x = Math.log(S) + (r - sigma * sigma / 2) * tau;
    if (Math.abs(Math.exp(r * tau) * C.call(S, K, r, sigma, tau) - C.w(x, K, sigma, tau)) > 1e-9) same = false;
    const e = 1e-4, h = 1e-3;
    const wt = (C.w(x, K, sigma, tau + e) - C.w(x, K, sigma, tau - e)) / (2 * e);
    const wxx = (C.w(x + h, K, sigma, tau) - 2 * C.w(x, K, sigma, tau) + C.w(x - h, K, sigma, tau)) / (h * h);
    if (Math.abs(wt - 0.5 * sigma * sigma * wxx) > 1e-3) heat = false;
  }
  check("V = e^(-r tau) w(tau, ln S + (r - sigma^2/2) tau): the change of variables", same);
  check("and w satisfies the heat equation dw/dtau = sigma^2/2 d2w/dx2", heat);
}
{
  let worst = 0;
  for (const x of [4.2, 4.6, 4.8, 5.1]) for (const tau of [0.1, 0.5, 1.5]) worst = Math.max(worst, Math.abs(C.wByKernel(x, K, sigma, tau) - C.w(x, K, sigma, tau)));
  check(`spreading the payoff with the heat kernel gives w (worst ${worst.toExponential(1)})`, worst < 1e-6);
}
{
  let worst = 0;
  for (const tau of [0.25, 1]) {
    const sol = C.heatSolve(K, sigma, tau);
    for (const S of [70, 90, 100, 110, 130]) worst = Math.max(worst, Math.abs(C.valueFromHeat(sol, S, r, sigma, tau) - C.call(S, K, r, sigma, tau)));
  }
  check(`a brute-force heat-equation solution matches the formula within 3 cents (worst ${worst.toFixed(4)})`, worst < 0.03);
  equal("the default: a 100 call, 30% volatility, 5% interest, half a year", C.call(100, K, r, sigma, 0.5).toFixed(4), "9.6349");
}
{
  let bounds = true, convex = true;
  for (let S = 40; S <= 200; S += 5) for (const tau of [0.1, 1]) {
    const v = C.call(S, K, r, sigma, tau);
    if (v < Math.max(S - K * Math.exp(-r * tau), 0) - 1e-9 || v > S) bounds = false;
    if (C.call(S - 5, K, r, sigma, tau) + C.call(S + 5, K, r, sigma, tau) < 2 * v - 1e-9) convex = false;
  }
  check("max(S - K e^(-r tau), 0) <= V <= S everywhere", bounds);
  check("and V is convex in S: the smoothed kink only bends one way", convex);
  const s = C.start();
  check("sliding to a year or more marks the demo done", C.result(s) === null && C.result(C.set(s, "tau", 1)) === "done");
  const before = JSON.stringify(s);
  C.set(s, "tau", 2);
  equal("a change leaves the old position alone", JSON.stringify(s), before);
}
done("payoff-heat-equation");
