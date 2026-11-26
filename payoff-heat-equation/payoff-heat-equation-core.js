"use strict";

/*
 * From Payoff to Heat Equation: an original demo for the Black-Scholes path.
 *
 * The riskless hedge turns into a partial differential equation for the
 * option's value V(t, S):
 *
 *   dV/dt + r S dV/dS + (1/2) sigma^2 S^2 d2V/dS2 = r V,   V(T, S) = max(S - K, 0).
 *
 * With tau = T - t (time left), x = ln S + (r - sigma^2/2) tau and
 * V = e^(-r tau) w(tau, x), it becomes the heat equation
 *
 *   dw/dtau = (1/2) sigma^2 d2w/dx2,   w(0, x) = max(e^x - K, 0),
 *
 * whose solution spreads the payoff out with a bell curve of variance
 * sigma^2 tau. The kink at the strike smooths out like a sharp temperature
 * step. Working out that spreading gives the Black-Scholes formula.
 *
 * Here the heat equation is also solved by brute force, an explicit finite
 * difference scheme, to show the change of variables really works. This
 * file defines one global, PayoffHeatEquationCore. The position is plain data.
 */
const PayoffHeatEquationCore = (() => {
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

  /** Black-Scholes call with time left tau. */
  function call(S, K, r, sigma, tau) {
    if (tau <= 0) return Math.max(S - K, 0);
    const v = sigma * Math.sqrt(tau), d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * tau) / v;
    return S * N(d1) - K * Math.exp(-r * tau) * N(d1 - v);
  }

  /** The heat-equation side: w(tau, x) for the call, in closed form. */
  function w(x, K, sigma, tau) {
    if (tau <= 0) return Math.max(Math.exp(x) - K, 0);
    const v = sigma * Math.sqrt(tau), d = (x - Math.log(K)) / v;
    return Math.exp(x + v * v / 2) * N(d + v) - K * N(d);
  }
  /** The same by spreading the payoff with the bell curve (the heat kernel), numerically. */
  function wByKernel(x, K, sigma, tau, n = 4000) {
    const v = sigma * Math.sqrt(tau), lo = Math.max(Math.log(K), x - 10 * v), hi = x + 10 * v;
    if (hi <= lo) return 0;
    const h = (hi - lo) / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const y = lo + i * h, f = (Math.exp(y) - K) * Math.exp(-((y - x) ** 2) / (2 * v * v));
      s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f;
    }
    return (s * h) / 3 / Math.sqrt(2 * Math.PI * v * v);
  }

  /**
   * Explicit finite differences for dw/dtau = sigma^2/2 d2w/dx2 on x in
   * [ln K - L, ln K + L], from the payoff; the edges follow the formula.
   * Returns { xs, ws } at time tau.
   */
  function heatSolve(K, sigma, tau, M = 240, L = 2.5) {
    const x0 = Math.log(K) - L, dx = (2 * L) / M, xs = Array.from({ length: M + 1 }, (_, i) => x0 + i * dx);
    let ws = xs.map((x) => Math.max(Math.exp(x) - K, 0));
    if (tau <= 0) return { xs, ws };
    const D = sigma * sigma / 2, steps = Math.max(1, Math.ceil((tau * D) / (0.4 * dx * dx))), dt = tau / steps, lam = (D * dt) / (dx * dx);
    for (let k = 1; k <= steps; k++) {
      const next = ws.slice();
      for (let i = 1; i < M; i++) next[i] = ws[i] + lam * (ws[i + 1] - 2 * ws[i] + ws[i - 1]);
      next[0] = w(xs[0], K, sigma, k * dt); next[M] = w(xs[M], K, sigma, k * dt);
      ws = next;
    }
    return { xs, ws };
  }
  /** V(S) from the heat solution: V = e^(-r tau) w(tau, ln S + (r - sigma^2/2) tau). */
  function valueFromHeat(sol, S, r, sigma, tau) {
    const x = Math.log(S) + (r - sigma * sigma / 2) * tau, { xs, ws } = sol;
    const dx = xs[1] - xs[0], i = Math.max(0, Math.min(xs.length - 2, Math.floor((x - xs[0]) / dx))), f = (x - xs[i]) / dx;
    return Math.exp(-r * tau) * (ws[i] * (1 - f) + ws[i + 1] * f);
  }

  function start(options = {}) {
    const c = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : d);
    return { K: 100, tau: c(options.tau, 0, 2, 0.5), sigma: c(options.sigma, 0.1, 0.6, 0.3), r: c(options.r, 0, 0.1, 0.05), seen: options.seen === true };
  }
  const set = (s, key, v) => {
    if (!["tau", "sigma", "r"].includes(key)) return null;
    const t = start({ ...s, [key]: v });
    return { ...t, seen: s.seen || (key === "tau" && t.tau >= 1) };
  };
  const result = (s) => (s.seen ? "done" : null);

  return { N, call, w, wByKernel, heatSolve, valueFromHeat, start, set, result };
})();
