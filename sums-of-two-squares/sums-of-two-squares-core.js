"use strict";

/*
 * Sums of Two Squares: the arithmetic, with no DOM.
 *
 * r2(n) is the number of integer points (a, b) with a^2 + b^2 = n, counting
 * signs and order. Jacobi's two-square theorem says r2(n) = 4 (d1(n) - d3(n)),
 * where d1 and d3 count the divisors of n that are 1 and 3 mod 4. Scale the
 * integer grid by 1/sqrt(n): each grid point then has exactly r2(n) grid
 * neighbours at distance 1, which is Erdos's construction for many unit
 * distances.
 */

const TwoSquaresCore = (function () {
  const MAX_N = 1200;

  /** All (a, b) with a^2 + b^2 = n, both signs and orders: brute force. */
  function points(n) {
    const out = [];
    const r = Math.floor(Math.sqrt(n));
    for (let a = -r; a <= r; a++) {
      const rest = n - a * a, b = Math.round(Math.sqrt(rest));
      if (b * b === rest) { out.push([a, b]); if (b !== 0) out.push([a, -b]); }
    }
    return out;
  }
  const r2Brute = (n) => points(n).length;

  /** The same count by Jacobi's theorem. */
  function r2Formula(n) {
    let d1 = 0, d3 = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0) { if (d % 4 === 1) d1++; else if (d % 4 === 3) d3++; }
    return 4 * (d1 - d3);
  }

  /** The essentially different ways: a >= b >= 0. */
  function ways(n) {
    const out = [];
    for (let b = 0; 2 * b * b <= n; b++) {
      const a = Math.round(Math.sqrt(n - b * b));
      if (a * a + b * b === n) out.push([a, b]);
    }
    return out.sort((p, q) => q[0] - p[0]);
  }

  /** Prime factorisation as [[p, e], ...]. */
  function factor(n) {
    const f = [];
    for (let p = 2; p * p <= n; p++) {
      let e = 0; while (n % p === 0) { n /= p; e++; }
      if (e) f.push([p, e]);
    }
    if (n > 1) f.push([n, 1]);
    return f;
  }

  /** The n up to `limit` whose r2 is a new record, with its value: [[1,4],[5,8],[25,12],...]. */
  function records(limit) {
    const out = []; let best = 0;
    for (let n = 1; n <= limit; n++) { const r = r2Brute(n); if (r > best) { best = r; out.push([n, r]); } }
    return out;
  }

  const clampN = (n) => Math.min(MAX_N, Math.max(1, Math.round(Number(n)) || 1));

  return { MAX_N, points, r2Brute, r2Formula, ways, factor, records, clampN };
})();
