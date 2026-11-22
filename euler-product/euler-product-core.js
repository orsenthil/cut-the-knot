"use strict";

/*
 * Euler's Product, an original demo for the Riemann Hypothesis path.
 *
 * The zeta function for real s > 1 is the sum of 1/n^s over all whole numbers
 * n. Euler noticed that it is also a product over the primes only:
 *
 *   zeta(s) = 1/1^s + 1/2^s + 1/3^s + ...  =  prod over primes p of 1 / (1 - p^-s)
 *
 * Expand each factor as a geometric series 1 + p^-s + p^-2s + ... and multiply
 * them out: every whole number is a product of primes in exactly one way, so
 * every term 1/n^s appears exactly once. At s = 1 the sum is the harmonic
 * series and diverges, and so must the product: there are infinitely many
 * primes, and they are not too thin.
 *
 * DOM-free; one global, EulerProductCore.
 */
const EulerProductCore = (() => {
  const MIN_S = 1, MAX_S = 4, DEFAULT_S = 2, MAX_N = 2000, DEFAULT_N = 30;

  /** The primes up to n, by the sieve of Eratosthenes. */
  function primesUpTo(n) {
    const out = [];
    if (n < 2) return out;
    const comp = new Uint8Array(n + 1);
    for (let i = 2; i <= n; i++) {
      if (comp[i]) continue;
      out.push(i);
      for (let j = i * i; j <= n; j += i) comp[j] = 1;
    }
    return out;
  }

  /** 1/1^s + ... + 1/n^s. */
  function partialSum(s, n) {
    let t = 0;
    for (let k = n; k >= 1; k--) t += Math.pow(k, -s);
    return t;
  }

  /** The product of 1/(1 - p^-s) over the primes p up to n. */
  function partialProduct(s, n) {
    let t = 1;
    for (const p of primesUpTo(n)) t *= 1 / (1 - Math.pow(p, -s));
    return t;
  }

  // Bernoulli numbers B2, B4, ..., B20 for the Euler-Maclaurin tail.
  const B2K = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330];

  /** zeta(s) for real s > 1, by Euler-Maclaurin (accurate to about 1e-13). */
  function zeta(s) {
    if (!(s > 1)) return Infinity;
    const N = 20;
    let sum = 0;
    for (let k = N - 1; k >= 1; k--) sum += Math.pow(k, -s);
    sum += Math.pow(N, 1 - s) / (s - 1) + 0.5 * Math.pow(N, -s);
    let rising = s; // s (s+1) ... (s+2k-2)
    let fact = 2;   // (2k)!
    for (let k = 1; k <= B2K.length; k++) {
      sum += (B2K[k - 1] / fact) * rising * Math.pow(N, -s - 2 * k + 1);
      rising *= (s + 2 * k - 1) * (s + 2 * k);
      fact *= (2 * k + 1) * (2 * k + 2);
    }
    return sum;
  }

  function clampS(s) {
    s = Number(s);
    if (!Number.isFinite(s)) return DEFAULT_S;
    return Math.min(MAX_S, Math.max(MIN_S, s));
  }
  function clampN(n) {
    n = Math.floor(Number(n));
    if (!Number.isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(2, n));
  }

  /**
   * Everything the page shows for a given s and n: both partial results, the
   * limit (null when s = 1, where there is none), and the series of both for
   * each n' from 1 to n, so the two can be drawn side by side.
   */
  function analyze(options) {
    const s = clampS(options && options.s !== undefined ? options.s : DEFAULT_S);
    const n = clampN(options && options.n !== undefined ? options.n : DEFAULT_N);
    const primes = primesUpTo(n);
    const sums = [], prods = [];
    let a = 0, p = 1, pi = 0;
    for (let k = 1; k <= n; k++) {
      a += Math.pow(k, -s);
      if (pi < primes.length && primes[pi] === k) { p *= 1 / (1 - Math.pow(k, -s)); pi++; }
      sums.push(a);
      prods.push(p);
    }
    return {
      s, n, primeCount: primes.length,
      sum: sums[n - 1], product: prods[n - 1],
      limit: s > 1 ? zeta(s) : null,
      sums, prods,
    };
  }

  return { MIN_S, MAX_S, MAX_N, DEFAULT_S, DEFAULT_N, primesUpTo, partialSum, partialProduct, zeta, clampS, clampN, analyze };
})();
