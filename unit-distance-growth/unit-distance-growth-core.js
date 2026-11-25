"use strict";

/*
 * How Fast Do Unit Distances Grow?: the numbers behind the chart, no DOM.
 *
 * For each k, the best k by k grid: the most unit pairs over every spacing
 * 1/sqrt(c2). The count for one spacing is (1/2) sum (k - |a|)(k - |b|) over
 * the (a, b) with a^2 + b^2 = c2. Reference curves: the ceiling from counting
 * cherries, n (1 + sqrt(8n - 7)) / 4, a proved upper bound for every n; and
 * straight lines of slope 1, 4/3 and 1.014 on a log-log chart, drawn from the
 * first point (they show slopes only, not values).
 */

const UnitGrowthCore = (function () {
  const MAX_K = 64;
  const SLOPES = [
    { name: "slope 1", s: 1 },
    { name: "slope 4/3 (best proved ceiling)", s: 4 / 3 },
    { name: "slope 1.014 (new construction, huge n)", s: 1.014 },
  ];

  /** Unit pairs of the k by k grid at spacing 1/sqrt(c2). */
  function countFor(k, c2) {
    let t = 0;
    for (let a = -(k - 1); a <= k - 1; a++) {
      const rest = c2 - a * a;
      if (rest < 0) continue;
      const b = Math.round(Math.sqrt(rest));
      if (b * b !== rest || b > k - 1) continue;
      t += (k - Math.abs(a)) * (k - b) * (b === 0 ? 1 : 2);
    }
    return t / 2;
  }

  /** The best spacing for a k by k grid: {k, n, c2, count}. */
  function bestFor(k) {
    let c2 = 1, count = -1;
    for (let c = 1; c <= 2 * (k - 1) * (k - 1); c++) { const t = countFor(k, c); if (t > count) { count = t; c2 = c; } }
    return { k, n: k * k, c2, count };
  }

  /** bestFor for k = 2..kmax. */
  function table(kmax) {
    const out = [];
    for (let k = 2; k <= Math.min(MAX_K, kmax); k++) out.push(bestFor(k));
    return out;
  }

  /** A proved ceiling on the unit pairs of any n points in the plane. */
  const ceiling = (n) => (n * (1 + Math.sqrt(8 * n - 7))) / 4;

  /** log(count) / log(n): the exponent a count corresponds to. */
  const exponent = (count, n) => Math.log(count) / Math.log(n);

  const clampK = (k) => Math.min(MAX_K, Math.max(2, Math.round(Number(k)) || 2));

  return { MAX_K, SLOPES, countFor, bestFor, table, ceiling, exponent, clampK };
})();
