"use strict";

/*
 * Binomial Option Tree: an original demo for the Black-Scholes path.
 *
 * Repeat the one-step riskless hedge many times. Split a year into n steps;
 * in each the stock moves up by u = e^(sigma sqrt(dt)) or down by d = 1/u
 * (Cox, Ross and Rubinstein, 1979). At the end the option pays its payoff;
 * stepping back, each node's value is the discounted risk-neutral average
 * of the two after it, with q = (e^(r dt) - d) / (u - d). As n grows, the
 * tree's price closes in on the Black-Scholes formula
 *
 *   C = S N(d1) - K e^(-rT) N(d2),
 *   d1 = (ln(S/K) + (r + sigma^2/2) T) / (sigma sqrt T),  d2 = d1 - sigma sqrt T.
 *
 * This file defines one global, BinomialOptionTreeCore. The position is plain data.
 */
const BinomialOptionTreeCore = (() => {
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

  /** The Black-Scholes price of a European call or put. */
  function blackScholes(o) {
    const { S, K, r, sigma, T } = o;
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T)), d2 = d1 - sigma * Math.sqrt(T);
    return o.type === "put" ? K * Math.exp(-r * T) * N(-d2) - S * N(-d1) : S * N(d1) - K * Math.exp(-r * T) * N(d2);
  }

  const payoff = (o, s) => (o.type === "put" ? Math.max(o.K - s, 0) : Math.max(s - o.K, 0));

  /** The whole tree for n steps: stock[i][j] and value[i][j] (step i, j ups), the hedge delta[i][j]. */
  function tree(o, n) {
    const dt = o.T / n, u = Math.exp(o.sigma * Math.sqrt(dt)), d = 1 / u, g = Math.exp(o.r * dt), q = (g - d) / (u - d);
    const stock = [], value = [], delta = [];
    for (let i = 0; i <= n; i++) stock.push(Array.from({ length: i + 1 }, (_, j) => o.S * u ** j * d ** (i - j)));
    value[n] = stock[n].map((s) => payoff(o, s));
    for (let i = n - 1; i >= 0; i--) {
      value[i] = []; delta[i] = [];
      for (let j = 0; j <= i; j++) {
        const hold = (q * value[i + 1][j + 1] + (1 - q) * value[i + 1][j]) / g;
        value[i][j] = o.american ? Math.max(hold, payoff(o, stock[i][j])) : hold;
        delta[i][j] = (value[i + 1][j + 1] - value[i + 1][j]) / (stock[i + 1][j + 1] - stock[i + 1][j]);
      }
    }
    return { u, d, q, dt, stock, value, delta };
  }

  /** Just the price, without keeping the tree (fast for large n). */
  function price(o, n) {
    const dt = o.T / n, u = Math.exp(o.sigma * Math.sqrt(dt)), d = 1 / u, g = Math.exp(o.r * dt), q = (g - d) / (u - d);
    let v = Array.from({ length: n + 1 }, (_, j) => payoff(o, o.S * u ** j * d ** (n - j)));
    for (let i = n - 1; i >= 0; i--) {
      const w = new Array(i + 1);
      for (let j = 0; j <= i; j++) {
        const hold = (q * v[j + 1] + (1 - q) * v[j]) / g;
        w[j] = o.american ? Math.max(hold, payoff(o, o.S * u ** j * d ** (i - j))) : hold;
      }
      v = w;
    }
    return v[0];
  }

  const STEPS = [1, 2, 3, 4, 5, 6, 8];
  function start(options = {}) {
    const c = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
    return {
      S: c(options.S, 50, 150, 100), K: c(options.K, 50, 150, 100), r: c(options.r, 0, 0.1, 0.05), sigma: c(options.sigma, 0.05, 0.6, 0.2), T: 1,
      type: options.type === "put" ? "put" : "call", american: options.american === true && options.type === "put",
      n: STEPS.includes(Number(options.n)) ? Number(options.n) : 3, explored: options.explored === true,
    };
  }
  const set = (s, key, v) => {
    if (!["S", "K", "r", "sigma", "type", "american", "n"].includes(key)) return null;
    const t = start({ ...s, [key]: v });
    return { ...t, explored: s.explored || (key === "n" && t.n >= 6) };
  };
  const result = (s) => (s.explored ? "done" : null);

  return { N, blackScholes, payoff, tree, price, STEPS, start, set, result };
})();
