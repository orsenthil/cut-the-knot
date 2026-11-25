"use strict";

/*
 * Counting Triangles, from Alexander Bogomolny's applet NSquared.
 *
 * Divide each side of a square into N equal parts and draw the lines parallel
 * to the sides: N^2 small squares. Draw the square's diagonal too, and cut each
 * small square into two triangles. Divide a right isosceles triangle in the
 * same way: it also falls into N^2 small triangles. How can both counts be N^2?
 * The applet slides one picture into the other.
 *
 * In the applet's own order (its Draw method), with the grid cell in column j
 * and row i (y downwards, the main diagonal from the top left to the bottom
 * right):
 *   FullColor  for 0 <= j <= i < N: the lower-left half of the cell
 *                 (j, i), (j, i+1), (j+1, i+1)            N(N+1)/2 triangles;
 *   LowColor   for 0 <= j < i < N:  the upper-right half
 *                 (j, i), (j+1, i), (j+1, i+1)            N(N-1)/2 triangles;
 *   HighColor  for 0 <= j < i < N:  in column i and row j, the lower-left half
 *                 (i, j), (i, j+1), (i+1, j+1)            N(N-1)/2 triangles.
 * With the slider at alpha (1 = right end, 0 = left end) the low triangles are
 * drawn at strength alpha and the high ones at 1 - alpha; the full ones never
 * change. At alpha = 1 the full and low triangles tile the triangle under the
 * diagonal, N^2 of them; at alpha = 0 the full and high triangles are the
 * lower-left half of every one of the N^2 small squares.
 *
 * Position (plain data): { n, alpha } with n 1..15 and alpha the scroll bar
 * value 0..256. One global, TrianglesCore, no DOM.
 */
const TrianglesCore = (() => {
  const MIN_N = 1, MAX_N = 15, DEFAULT_N = 5;    // the applet's N spinner
  const ALPHA_MAX = 256, DEFAULT_ALPHA = 256;     // the applet's scroll bar: value / 256

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function start() { return { n: DEFAULT_N, alpha: DEFAULT_ALPHA }; }

  function setN(state, n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return null;
    return { ...state, n: clamp(n, MIN_N, MAX_N) };
  }

  function setAlpha(state, a) {
    a = Math.round(Number(a));
    if (!Number.isFinite(a)) return null;
    return { ...state, alpha: clamp(a, 0, ALPHA_MAX) };
  }

  /** The strength of the low and the high triangles at this position (0..1). */
  function strengths(state) {
    const a = state.alpha / ALPHA_MAX;
    return { low: a, high: 1 - a };
  }

  /** The three groups of triangles for N, each a list of [[x, y], [x, y], [x, y]] in grid units. */
  function triangles(n) {
    const full = [], low = [], high = [];
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) full.push([[j, i], [j, i + 1], [j + 1, i + 1]]);
    for (let i = 1; i < n; i++) for (let j = 0; j < i; j++) low.push([[j, i], [j + 1, i], [j + 1, i + 1]]);
    for (let i = 1; i < n; i++) for (let j = 0; j < i; j++) high.push([[i, j], [i, j + 1], [i + 1, j + 1]]);
    return { full, low, high };
  }

  /** How many triangles each group has. */
  function counts(n) {
    return { full: (n * (n + 1)) / 2, low: (n * (n - 1)) / 2, high: (n * (n - 1)) / 2 };
  }

  /** The number of triangles in the first picture (slider at the right) and in the second (at the left). */
  function totals(n) {
    const c = counts(n);
    return { triangle: c.full + c.low, square: c.full + c.high, squares: n * n };
  }

  /**
   * The strips of the first picture that run parallel to the diagonal, from the
   * corner (0, N) out to the diagonal: strip m lies between the lines y - x = m
   * and y - x = m + 1. How many triangles are in each (the page: 1, 3, 5, ..., 2N - 1).
   */
  function stripSizes(n) {
    const t = triangles(n), sizes = new Array(n).fill(0);
    for (const group of [t.full, t.low]) for (const tri of group) {
      const d = tri.map(([x, y]) => y - x), m = Math.min(...d);
      sizes[m] += 1;
    }
    return sizes.reverse();   // from the corner: the smallest strip first
  }

  /** The area of one triangle in grid units, and so of the whole triangle under the diagonal. */
  const triangleArea = ([[x1, y1], [x2, y2], [x3, y3]]) => Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2;

  /** The page's second proof: N(N+1)/2 + N(N-1)/2 = N^2. */
  const triangularSum = (n) => (n * (n + 1)) / 2 + ((n - 1) * n) / 2;

  /** The sum of the first n odd numbers. */
  const oddSum = (n) => { let s = 0; for (let k = 1; k <= n; k++) s += 2 * k - 1; return s; };

  return { MIN_N, MAX_N, DEFAULT_N, ALPHA_MAX, DEFAULT_ALPHA, start, setN, setAlpha, strengths, triangles, counts, totals, stripSizes, triangleArea, triangularSum, oddSum };
})();
