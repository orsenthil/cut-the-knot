"use strict";

/*
 * Stock Price Paths: an original demo for the Black-Scholes path.
 *
 * Black and Scholes model a stock's returns, not its price: in each short
 * time dt the price changes by a fraction mu dt + sigma dW, where dW is a
 * small normal shock with variance dt (geometric Brownian motion,
 * dS/S = mu dt + sigma dW). The exact solution is
 *
 *   S_T = S_0 exp((mu - sigma^2/2) T + sigma W_T).
 *
 * The surprise is the -sigma^2/2. The average price grows like e^(mu T),
 * but the typical (median) price only like e^((mu - sigma^2/2) T): ups and
 * downs of the same size do not cancel, because +10% then -10% leaves
 * 99%. That correction is the (dW)^2 = dt term of Ito's lemma, the step
 * the article does as a Taylor expansion.
 *
 * Paths are simulated exactly on a grid of steps with a seeded generator.
 * This file defines one global, StockPricePathsCore. The position is plain data.
 */
const StockPricePathsCore = (() => {
  const S0 = 100, T = 1, STEPS = 100;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Standard normal numbers from a seeded generator (Box-Muller). */
  function normals(seed) {
    const r = rng(seed);
    let spare = null;
    return () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0; while (u === 0) u = r();
      const v = r(), m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    };
  }

  /** The standard normal distribution function N(x) (Hart's algorithm, double precision). */
  function N(x) {
    const a = Math.abs(x);
    let c = 0;
    if (a <= 37) {
      const e = Math.exp(-a * a / 2);
      if (a < 7.07106781186547) {
        let b = 3.52624965998911e-2 * a + 0.700383064443688;
        b = b * a + 6.37396220353165; b = b * a + 33.912866078383; b = b * a + 112.079291497871;
        b = b * a + 221.213596169931; b = b * a + 220.206867912376;
        c = e * b;
        b = 8.83883476483184e-2 * a + 1.75566716318264;
        b = b * a + 16.064177579207; b = b * a + 86.7807322029461; b = b * a + 296.564248779674;
        b = b * a + 637.333633378831; b = b * a + 793.826512519948; b = b * a + 440.413735824752;
        c /= b;
      } else {
        let b = a + 0.65;
        b = a + 4 / b; b = a + 3 / b; b = a + 2 / b; b = a + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return x > 0 ? 1 - c : c;
  }

  /** count paths of STEPS steps over time T. Each path is an array of STEPS + 1 prices. */
  function paths(mu, sigma, count, seed, steps = STEPS) {
    const z = normals(seed), dt = T / steps, drift = (mu - sigma * sigma / 2) * dt, vol = sigma * Math.sqrt(dt);
    const out = [];
    for (let k = 0; k < count; k++) {
      const p = [S0];
      let s = S0;
      for (let i = 0; i < steps; i++) { s *= Math.exp(drift + vol * z()); p.push(s); }
      out.push(p);
    }
    return out;
  }

  /** The theory for S_T: mean, median, and the lognormal density. */
  const mean = (mu) => S0 * Math.exp(mu * T);
  const median = (mu, sigma) => S0 * Math.exp((mu - sigma * sigma / 2) * T);
  function density(x, mu, sigma) {
    if (x <= 0) return 0;
    const m = Math.log(S0) + (mu - sigma * sigma / 2) * T, v = sigma * sigma * T;
    return Math.exp(-((Math.log(x) - m) ** 2) / (2 * v)) / (x * Math.sqrt(2 * Math.PI * v));
  }
  /** Chance that S_T ends above level L. */
  const above = (L, mu, sigma) => 1 - N((Math.log(L / S0) - (mu - sigma * sigma / 2) * T) / (sigma * Math.sqrt(T)));

  /** The coin-toss version: each step multiplies by 1 + sigma sqrt(dt) or 1 - sigma sqrt(dt). */
  const coinLogDrift = (sigma, steps) => { const h = sigma * Math.sqrt(T / steps); return (steps * (Math.log(1 + h) + Math.log(1 - h))) / 2; };

  function sampleStats(ps) {
    const ends = ps.map((p) => p[p.length - 1]).sort((a, b) => a - b);
    const n = ends.length;
    return { mean: ends.reduce((a, b) => a + b, 0) / n, median: n % 2 ? ends[(n - 1) / 2] : (ends[n / 2 - 1] + ends[n / 2]) / 2, ends };
  }

  const COUNTS = [1, 10, 100, 1000];
  function start(options = {}) {
    const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
    return {
      mu: clamp(options.mu, -0.2, 0.4, 0.1),
      sigma: clamp(options.sigma, 0.05, 0.8, 0.3),
      count: COUNTS.includes(Number(options.count)) ? Number(options.count) : 100,
      seed: Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1,
      runs: Number.isInteger(options.runs) ? options.runs : 0,
    };
  }
  const set = (s, key, v) => (["mu", "sigma", "count"].includes(key) ? start({ ...s, [key]: v }) : null);
  const again = (s) => ({ ...s, seed: s.seed + 1, runs: s.runs + 1 });
  const result = (s) => (s.runs > 0 ? "done" : null);

  return { S0, T, STEPS, COUNTS, rng, normals, N, paths, mean, median, density, above, coinLogDrift, sampleStats, start, set, again, result };
})();
