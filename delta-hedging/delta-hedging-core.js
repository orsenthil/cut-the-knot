"use strict";

/*
 * Delta Hedging: an original game for the Black-Scholes path.
 *
 * You sell a one-month call on a $100 stock for its Black-Scholes price
 * and must pay out max(S - 100, 0) at the end. To stay safe, hold shares
 * and adjust them every trading day; cash earns (or pays) the bank's rate.
 * The Black-Scholes argument says that holding delta = N(d1) shares, and
 * rebalancing continuously, leaves you with exactly nothing at the end,
 * whatever the stock does. Rebalancing once a day leaves a small error
 * that shrinks like 1 / sqrt(number of rebalances).
 *
 * The game: 20 trading days. Each day choose your shares, then move on.
 * At the end your profit or loss is compared with the computer's, which
 * holds exactly delta every day on the same price path. You win if yours
 * is within $0.50 of zero, or no further from zero than the computer's
 * plus $0.50. Without any hedge, the swing is many dollars.
 *
 * This file defines one global, DeltaHedgingCore. The position is plain data.
 */
const DeltaHedgingCore = (() => {
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

  const S0 = 100, K = 100, SIGMA = 0.3, R = 0.05, DAYS = 20, T = DAYS / 252, MU = 0.08, TOL = 0.5;

  function call(S, tau) {
    if (tau <= 1e-12) return Math.max(S - K, 0);
    const v = SIGMA * Math.sqrt(tau), d1 = (Math.log(S / K) + (R + SIGMA * SIGMA / 2) * tau) / v;
    return S * N(d1) - K * Math.exp(-R * tau) * N(d1 - v);
  }
  function delta(S, tau) {
    if (tau <= 1e-12) return S > K ? 1 : 0;
    const v = SIGMA * Math.sqrt(tau);
    return N((Math.log(S / K) + (R + SIGMA * SIGMA / 2) * tau) / v);
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
  /** The stock's path over the days, from a seed (it grows at the stock's own rate MU: the hedge does not care). */
  function path(seed, days = DAYS) {
    const r = rng(seed), dt = T / days, out = [S0];
    let s = S0;
    for (let i = 0; i < days; i++) {
      let u = 0; while (u === 0) u = r();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
      s *= Math.exp((MU - SIGMA * SIGMA / 2) * dt + SIGMA * Math.sqrt(dt) * z);
      out.push(s);
    }
    return out;
  }

  /**
   * The books for holdings h[0..k-1] (shares held from day i to day i + 1)
   * on a path: sell the call for its price, buy and sell shares, cash grows
   * at R. Returns cash and value after each day, and the final profit.
   */
  function books(p, h, days = DAYS) {
    const dt = T / days, g = Math.exp(R * dt);
    let cash = call(p[0], T), held = 0;
    const rows = [];
    for (let i = 0; i < h.length; i++) {
      cash -= (h[i] - held) * p[i];
      held = h[i];
      cash *= g;
      const tau = T - (i + 1) * dt;
      rows.push({ day: i + 1, stock: p[i + 1], shares: held, cash, portfolio: cash + held * p[i + 1], option: call(p[i + 1], tau) });
    }
    const last = rows[rows.length - 1];
    return { rows, profit: h.length === days ? last.portfolio - Math.max(p[days] - K, 0) : null };
  }
  const deltaHoldings = (p, days = DAYS) => Array.from({ length: days }, (_, i) => delta(p[i], T - (i * T) / days));

  function start(options = {}) {
    const seed = Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1;
    const h = Array.isArray(options.holdings) ? options.holdings.slice(0, DAYS).map(Number).filter(Number.isFinite) : [];
    const next = Number.isFinite(Number(options.shares)) ? Number(options.shares) : 0.5;
    return { seed, holdings: h, shares: Math.max(-1, Math.min(2, Math.round(next * 100) / 100)) };
  }
  const setShares = (s, x) => (Number.isFinite(Number(x)) && s.holdings.length < DAYS ? { ...s, shares: Math.max(-1, Math.min(2, Math.round(Number(x) * 100) / 100)) } : null);
  const nextDay = (s) => (s.holdings.length < DAYS ? { ...s, holdings: s.holdings.concat([s.shares]) } : null);
  const newGame = (s) => start({ seed: s.seed + 1 });

  /** The scores once the month is over: yours, the computer's, and no hedge at all. */
  function scores(s) {
    if (s.holdings.length < DAYS) return null;
    const p = path(s.seed);
    return {
      you: books(p, s.holdings).profit,
      computer: books(p, deltaHoldings(p)).profit,
      none: books(p, new Array(DAYS).fill(0)).profit,
    };
  }
  function result(s) {
    const sc = scores(s);
    if (!sc) return null;
    return Math.abs(sc.you) <= TOL || Math.abs(sc.you) <= Math.abs(sc.computer) + TOL ? "win" : "lose";
  }

  return { S0, K, SIGMA, R, DAYS, T, MU, TOL, N, call, delta, path, books, deltaHoldings, start, setShares, nextDay, newGame, scores, result };
})();
