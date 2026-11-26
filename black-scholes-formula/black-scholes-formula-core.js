"use strict";

/*
 * The Black-Scholes Formula: an original demo for the Black-Scholes path.
 *
 *   C = S N(d1) - K e^(-rT) N(d2),      P = K e^(-rT) N(-d2) - S N(-d1),
 *   d1 = (ln(S/K) + (r + sigma^2/2) T) / (sigma sqrt T),   d2 = d1 - sigma sqrt T.
 *
 * Read it as two pieces: N(d1) is the hedge (the delta: shares held per call
 * sold), and N(d2) is the risk-neutral chance the call is used, so
 * K e^(-rT) N(d2) is the strike's expected cost in today's money. Puts and
 * calls are tied by parity, C - P = S - K e^(-rT). The Greeks are the
 * formula's slopes: delta, gamma, vega, theta, rho.
 *
 * A Monte Carlo check averages the discounted payoff over simulated end
 * prices. Grown at the bank's rate r, it lands on the formula; grown at the
 * stock's own rate mu, it does not: the price does not depend on mu.
 *
 * This file defines one global, BlackScholesFormulaCore. The position is plain data.
 */
const BlackScholesFormulaCore = (() => {
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

  const pdf = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

  function price(o) {
    const { S, K, r, sigma, T } = o, v = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / v, d2 = d1 - v, disc = Math.exp(-r * T);
    return {
      d1, d2, Nd1: N(d1), Nd2: N(d2),
      call: S * N(d1) - K * disc * N(d2),
      put: K * disc * N(-d2) - S * N(-d1),
      greeks: {
        callDelta: N(d1), putDelta: N(d1) - 1,
        gamma: pdf(d1) / (S * v),
        vega: S * pdf(d1) * Math.sqrt(T),
        callTheta: -(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * disc * N(d2),
        putTheta: -(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * disc * N(-d2),
        callRho: K * T * disc * N(d2), putRho: -K * T * disc * N(-d2),
      },
    };
  }

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
  /** Average discounted call payoff over n end prices grown at rate g (r for the risk-neutral world), with a 95% band. */
  function monteCarlo(o, g, n, seed) {
    const r = rng(seed), v = o.sigma * Math.sqrt(o.T), disc = Math.exp(-o.r * o.T);
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i += 2) {
      let u = 0; while (u === 0) u = r();
      const m = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * r();
      for (const z of [m * Math.cos(t), m * Math.sin(t)]) {
        const ST = o.S * Math.exp((g - o.sigma * o.sigma / 2) * o.T + v * z);
        const p = disc * Math.max(ST - o.K, 0);
        s += p; s2 += p * p;
      }
    }
    const k = 2 * Math.ceil(n / 2), mean = s / k, sd = Math.sqrt(Math.max(0, s2 / k - mean * mean));
    return { mean, band: (1.96 * sd) / Math.sqrt(k), n: k };
  }

  function start(options = {}) {
    const c = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
    return {
      S: c(options.S, 50, 150, 100), K: c(options.K, 50, 150, 100), r: c(options.r, 0, 0.1, 0.05),
      sigma: c(options.sigma, 0.05, 0.8, 0.2), T: c(options.T, 0.05, 3, 1), mu: c(options.mu, -0.2, 0.4, 0.15),
      seed: Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1, runs: Number.isInteger(options.runs) ? options.runs : 0,
    };
  }
  const set = (s, key, v) => (["S", "K", "r", "sigma", "T", "mu"].includes(key) ? start({ ...s, [key]: v }) : null);
  const simulate = (s) => ({ ...s, seed: s.seed + 1, runs: s.runs + 1 });
  const result = (s) => (s.runs > 0 ? "done" : null);

  return { N, pdf, price, monteCarlo, start, set, simulate, result };
})();
