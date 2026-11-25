"use strict";

/*
 * Grid Spacing Dial: the counting, with no DOM.
 *
 * Put a k by k grid of points at spacing 1/sqrt(c2). Two grid points are 1
 * apart exactly when their difference (a, b), in grid steps, has a^2 + b^2 =
 * c2. For each such vector there are (k - |a|)(k - |b|) pairs of grid points
 * that differ by it, and each unordered pair is counted by (a, b) and by
 * (-a, -b), so
 *
 *   unit pairs = (1/2) sum over (a, b) with a^2 + b^2 = c2 of (k - |a|)(k - |b|).
 */

const GridDialCore = (function () {
  const MIN_K = 3, MAX_K = 24;

  /** The vectors (a, b), with a^2 + b^2 = c2, a and b within the grid. */
  function vectors(k, c2) {
    const out = [];
    for (let a = -(k - 1); a <= k - 1; a++) {
      const rest = c2 - a * a;
      if (rest < 0) continue;
      const b = Math.round(Math.sqrt(rest));
      if (b * b !== rest || b > k - 1) continue;
      out.push([a, b]);
      if (b !== 0) out.push([a, -b]);
    }
    return out;
  }

  /** The number of unit pairs, by the formula. */
  function count(k, c2) {
    let t = 0;
    for (const [a, b] of vectors(k, c2)) t += (k - Math.abs(a)) * (k - Math.abs(b));
    return t / 2;
  }

  /** The same count by looking at every pair of grid points. */
  function countBrute(k, c2) {
    let t = 0;
    const n = k * k;
    for (let p = 0; p < n; p++) {
      const px = p % k, py = Math.floor(p / k);
      for (let q = p + 1; q < n; q++) {
        const dx = (q % k) - px, dy = Math.floor(q / k) - py;
        if (dx * dx + dy * dy === c2) t++;
      }
    }
    return t;
  }

  /** The c2 between 1 and 2 (k-1)^2 that gives the most pairs (the smallest if tied). */
  function best(k) {
    let bc = 1, bn = -1;
    for (let c2 = 1; c2 <= 2 * (k - 1) * (k - 1); c2++) { const n = count(k, c2); if (n > bn) { bn = n; bc = c2; } }
    return { c2: bc, count: bn };
  }

  /** The grid neighbours of a point (x, y) at the chosen spacing. */
  function neighbours(k, c2, x, y) {
    return vectors(k, c2).map(([a, b]) => [x + a, y + b]).filter(([u, v]) => u >= 0 && v >= 0 && u < k && v < k);
  }

  const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, Math.round(Number(k)) || MIN_K));
  const maxC2 = (k) => 2 * (k - 1) * (k - 1);
  const clampC2 = (k, c2) => Math.min(maxC2(k), Math.max(1, Math.round(Number(c2)) || 1));

  return { MIN_K, MAX_K, vectors, count, countBrute, best, neighbours, clampK, maxC2, clampC2 };
})();
