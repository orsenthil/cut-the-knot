#!/usr/bin/env node
"use strict";

/*
 * Logic test for stock-price-paths/stock-price-paths-core.js.
 *
 *   node porting/check-stock-price-paths.mjs
 *
 * 1. The normal distribution function agrees with a numerical integral of
 *    the bell curve to 1e-12, and the seeded normals have mean 0, variance 1.
 * 2. 20,000 simulated paths: the average end price is S0 e^(mu T), the
 *    median S0 e^((mu - sigma^2/2) T), and log returns have variance
 *    sigma^2 T, within sampling error.
 * 3. The -sigma^2/2: a coin-toss walk (up or down by the same fraction)
 *    loses about sigma^2/2 a year in log terms, more exactly as steps shrink.
 * 4. The lognormal density integrates to 1 with mean S0 e^(mu T).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("stock-price-paths/stock-price-paths-core.js", "StockPricePathsCore");

{
  const pdf = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const simpson = (a, b, n) => { const h = (b - a) / n; let s = pdf(a) + pdf(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * pdf(a + i * h); return (s * h) / 3; };
  let worst = 0;
  for (const x of [-8, -5, -3, -2, -1, -0.5, 0, 0.3, 1, 1.96, 3, 6]) worst = Math.max(worst, Math.abs(C.N(x) - (x < 0 ? simpson(-40, x, 20000) : 1 - simpson(x, 40, 20000))));
  check(`N(x) matches the integral of the bell curve (worst error ${worst.toExponential(1)})`, worst < 1e-12);
  const z = C.normals(5), xs = Array.from({ length: 200000 }, z);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length, v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  check(`seeded normals: mean ${m.toFixed(4)}, variance ${v.toFixed(4)}`, Math.abs(m) < 0.01 && Math.abs(v - 1) < 0.01);
}
{
  const mu = 0.1, sigma = 0.4, ps = C.paths(mu, sigma, 20000, 7, 20);
  const st = C.sampleStats(ps);
  const logs = st.ends.map((s) => Math.log(s / C.S0)), lm = logs.reduce((a, b) => a + b, 0) / logs.length;
  const lv = logs.reduce((a, b) => a + (b - lm) ** 2, 0) / logs.length;
  check(`average end price ${st.mean.toFixed(2)} is S0 e^(mu T) = ${C.mean(mu).toFixed(2)}`, Math.abs(st.mean / C.mean(mu) - 1) < 0.015);
  check(`median end price ${st.median.toFixed(2)} is S0 e^((mu - sigma^2/2) T) = ${C.median(mu, sigma).toFixed(2)}`, Math.abs(st.median / C.median(mu, sigma) - 1) < 0.015);
  check(`log returns have variance ${lv.toFixed(4)} = sigma^2 T`, Math.abs(lv - sigma * sigma) < 0.005);
  check("with sigma = 40% the median sits 8% below the mean: the -sigma^2/2", Math.abs(C.median(mu, sigma) / C.mean(mu) - Math.exp(-0.08)) < 1e-12);
  const frac = st.ends.filter((s) => s > 120).length / st.ends.length;
  check(`chance of ending above 120: simulated ${frac.toFixed(3)}, formula ${C.above(120, mu, sigma).toFixed(3)}`, Math.abs(frac - C.above(120, mu, sigma)) < 0.012);
}
{
  const sigma = 0.3;
  const d = [10, 100, 10000].map((n) => C.coinLogDrift(sigma, n));
  check(`coin-toss walk: log drift ${d.map((x) => x.toFixed(5)).join(", ")} per year, approaching -sigma^2/2 = -0.045`, Math.abs(d[2] + 0.045) < 1e-5 && Math.abs(d[2] + 0.045) < Math.abs(d[0] + 0.045));
  equal("+10% then -10% leaves 99%", Math.round(1.1 * 0.9 * 100), 99);
}
{
  const mu = 0.15, sigma = 0.5;
  let area = 0, first = 0;
  const h = 0.01;
  for (let x = h / 2; x < 3000; x += h) { const f = C.density(x, mu, sigma); area += f * h; first += x * f * h; }
  check(`the lognormal density has area ${area.toFixed(5)} and mean ${first.toFixed(3)} = ${C.mean(mu).toFixed(3)}`, Math.abs(area - 1) < 1e-4 && Math.abs(first - C.mean(mu)) < 0.01);
  const s = C.start();
  check("a demo: done once paths are drawn", C.result(s) === null && C.result(C.again(s)) === "done");
  const before = JSON.stringify(s);
  C.set(s, "mu", 0.3);
  equal("a change leaves the old position alone", JSON.stringify(s), before);
}
done("stock-price-paths");
