"use strict";

/*
 * Two Circles, Two Points: the rules, with no DOM.
 *
 * Two different points A and B have at most two points that are 1 from both,
 * because two different circles of radius 1 cross in at most two places. If
 * n points have e unit pairs, count the "cherries" (a point with two unit
 * neighbours): each pair of points is the far end of at most 2 cherries, so
 * the sum over points of C(degree, 2) is at most 2 C(n, 2). Convexity then
 * bounds e by n (1 + sqrt(8n - 7)) / 4, about n^(3/2) / sqrt(2).
 */

const TwoCirclesCore = (function () {
  const EPS = 1e-9;
  const MIN_GAP = 0.05;

  /** The points at distance 1 from both a and b: [] when a, b are too far or the same. */
  function commonNeighbours(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < EPS || d > 2 + EPS) return [];
    const h = Math.sqrt(Math.max(0, 1 - (d * d) / 4));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    if (h < 1e-7) return [{ x: mx, y: my }];
    return [{ x: mx - uy * h, y: my + ux * h }, { x: mx + uy * h, y: my - ux * h }];
  }

  /** The most unit pairs n points can have, by the counting argument (real number). */
  const edgeBound = (n) => (n * (1 + Math.sqrt(8 * n - 7))) / 4;

  /** The same bound as the whole number of pairs allowed. */
  const edgeLimit = (n) => Math.floor(edgeBound(n) + 1e-9);

  const clampN = (n) => Math.min(200, Math.max(2, Math.round(Number(n)) || 2));

  /** Keep two centres from sitting on top of each other (then the circles would coincide). */
  function separate(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d >= MIN_GAP) return b;
    return { x: a.x + MIN_GAP, y: a.y };
  }

  return { EPS, MIN_GAP, commonNeighbours, edgeBound, edgeLimit, clampN, separate };
})();
