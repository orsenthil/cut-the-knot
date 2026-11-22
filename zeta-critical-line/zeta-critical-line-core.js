"use strict";

/*
 * The Zeta Function on the Critical Line, an original demo for the Riemann
 * Hypothesis path.
 *
 * Riemann's zeta function extends 1 + 2^-s + 3^-s + ... to complex numbers
 * s = sigma + i t (everything except s = 1). The "critical strip" is
 * 0 < sigma < 1. Its trivial zeros are the negative even integers; every
 * other zero lies in the strip, and the Riemann Hypothesis says they all
 * lie on the line sigma = 1/2. As t grows, the point zeta(1/2 + i t) draws a
 * curve in the plane that loops around the origin; a zero is a moment when
 * the curve passes exactly through the origin.
 *
 * zeta is computed by Euler-Maclaurin summation: the first N terms, plus an
 * integral and correction terms with Bernoulli numbers. Hardy's Z function,
 * Z(t) = e^{i theta(t)} zeta(1/2 + i t), is real, and its sign changes are
 * exactly the zeros on the line: that is how the zeros are found.
 *
 * DOM-free; one global, ZetaCriticalLineCore. Complex numbers are [re, im].
 */
const ZetaCriticalLineCore = (() => {
  const MAX_T = 100, DEFAULT_SIGMA = 0.5;
  const B2K = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330];

  /** n^(-s) for the complex s = [a, b]: exp(-(a + ib) ln n). */
  function powNeg(n, a, b) {
    const m = Math.exp(-a * Math.log(n)), ph = -b * Math.log(n);
    return [m * Math.cos(ph), m * Math.sin(ph)];
  }
  const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const div = (x, y) => { const d = y[0] * y[0] + y[1] * y[1]; return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]; };

  /** zeta(sigma + i t) by Euler-Maclaurin. Not for s = 1 itself. */
  function zeta(sigma, t) {
    const N = Math.max(12, Math.ceil(Math.abs(t)) + 12);
    let re = 0, im = 0;
    for (let k = N - 1; k >= 1; k--) { const p = powNeg(k, sigma, t); re += p[0]; im += p[1]; }
    const s = [sigma, t];
    const Ns = powNeg(N, sigma, t);                 // N^-s
    const NtoOneMinusS = mul(Ns, [N, 0]);           // N^(1-s)
    const t1 = div(NtoOneMinusS, [sigma - 1, t]);   // N^(1-s) / (s-1)
    re += t1[0] + 0.5 * Ns[0]; im += t1[1] + 0.5 * Ns[1];
    let rising = s;       // s (s+1) ... (s+2k-2)
    let fact = 2;         // (2k)!
    let Npow = mul(Ns, [1 / N, 0]); // N^(-s-1)
    for (let k = 1; k <= B2K.length; k++) {
      const c = B2K[k - 1] / fact;
      const term = mul(rising, Npow);
      re += c * term[0]; im += c * term[1];
      rising = mul(rising, [sigma + 2 * k - 1, t]);
      rising = mul(rising, [sigma + 2 * k, t]);
      fact *= (2 * k + 1) * (2 * k + 2);
      Npow = mul(Npow, [1 / (N * N), 0]);
    }
    return [re, im];
  }

  /** The Riemann-Siegel theta function (Stirling form, good for t >= 7). */
  function theta(t) {
    return (t / 2) * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8 + 1 / (48 * t) + 7 / (5760 * t ** 3) + 31 / (80640 * t ** 5);
  }

  /** Hardy's Z: real, with the same absolute value as zeta(1/2 + i t). */
  function Z(t) {
    const z = zeta(0.5, t), th = theta(t), c = Math.cos(th), s = Math.sin(th);
    return z[0] * c - z[1] * s;
  }

  /** The ordinates t of the zeros 1/2 + i t with t between 10 and maxT, by sign changes of Z. */
  function zeros(maxT) {
    const out = [];
    const step = 0.05;
    let a = 10, za = Z(a);
    for (let b = a + step; b <= maxT + step; b += step) {
      const zb = Z(b);
      if (za === 0 || za * zb < 0) {
        let lo = a, hi = b, zl = za;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2, zm = Z(mid);
          if (zl * zm <= 0) hi = mid; else { lo = mid; zl = zm; }
        }
        const r = (lo + hi) / 2;
        if (r <= maxT) out.push(r);
      }
      a = b; za = zb;
    }
    return out;
  }

  function clampSigma(s) {
    s = Number(s);
    if (!Number.isFinite(s)) return DEFAULT_SIGMA;
    return Math.min(0.95, Math.max(0.05, s));
  }
  function clampT(t) {
    t = Number(t);
    if (!Number.isFinite(t)) return 0;
    return Math.min(MAX_T, Math.max(0, t));
  }

  /** The curve t -> zeta(sigma + i t) for t in [0, maxT], with `points` samples. */
  function curve(sigma, maxT, points) {
    sigma = clampSigma(sigma); maxT = clampT(maxT);
    const out = [];
    const n = points || 600;
    for (let i = 0; i <= n; i++) {
      const t = (maxT * i) / n;
      const z = zeta(sigma, t);
      out.push({ t, re: z[0], im: z[1], abs: Math.hypot(z[0], z[1]) });
    }
    return out;
  }

  /** zeta at one point, with its size. */
  function at(sigma, t) {
    sigma = clampSigma(sigma); t = clampT(t);
    const z = zeta(sigma, t);
    return { sigma, t, re: z[0], im: z[1], abs: Math.hypot(z[0], z[1]) };
  }

  return { MAX_T, DEFAULT_SIGMA, zeta, theta, Z, zeros, clampSigma, clampT, curve, at };
})();
