"use strict";

/*
 * Polygonal Numbers, from Alexander Bogomolny's applet PolygonalNumbers.
 *
 * The applet draws regular N-gons of side 1, 2, ..., size, all sharing one
 * corner and the two sides through it, with dots one unit apart along every
 * side (its DrawOnePolygon: start at the shared corner heading at half the
 * interior angle, put k dots on each side of the polygon of side k, and turn by
 * the exterior angle 2*pi/N after each side). The dots they cover, counted once
 * each, are the polygonal number
 *
 *     P(N, n) = (N - 2) * n * (n - 1) / 2 + n,    with n = size + 1,
 *
 * because the polygon of side k adds a "gnomon" of (N - 2) * k + 1 new dots.
 *
 * The position is plain data: { sides, size }.
 */
const PolygonalNumbersCore = (() => {
  const SIDES_MIN = 3, SIDES_MAX = 20, SIDES_START = 5;
  const SIZE_MIN = 1, SIZE_MAX = 15, SIZE_START = 2;

  const clamp = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);

  function start(options) {
    const o = options || {};
    return { sides: clamp(o.sides, SIDES_MIN, SIDES_MAX, SIDES_START), size: clamp(o.size, SIZE_MIN, SIZE_MAX, SIZE_START) };
  }

  /** The N-gonal number with n dots on a side: (N - 2) n (n - 1) / 2 + n. */
  const polygonal = (N, n) => ((N - 2) * n * (n - 1)) / 2 + n;

  /** New dots added by the polygon of side k: (N - 2) k + 1. */
  const gnomon = (N, k) => (N - 2) * k + 1;

  /**
   * Every dot drawn, in unit coordinates with the shared corner at (0, 0) and
   * y down, as the applet walks them; each with the polygon (1..size) that
   * first reaches it. Dots that coincide are kept once.
   */
  function dots(state) {
    const N = state.sides;
    const interior = (Math.PI * (N - 2)) / N;
    const seen = new Map();
    for (let k = 1; k <= state.size; k++) {
      let x = 0, y = 0, angle = interior / 2;
      for (let side = 0; side < N; side++) {
        const ex = x + k * Math.cos(angle), ey = y + k * Math.sin(angle);
        for (let t = 0; t < k; t++) {
          const px = x + (t * (ex - x)) / k, py = y + (t * (ey - y)) / k;
          const key = `${Math.round(px * 1e6)},${Math.round(py * 1e6)}`;
          if (!seen.has(key)) seen.set(key, { x: px, y: py, layer: k });
        }
        angle -= Math.PI - interior;
        x = ex; y = ey;
      }
    }
    return [...seen.values()];
  }

  /** What the picture shows, in numbers. */
  function describe(state) {
    const n = state.size + 1;
    return { sides: state.sides, n, dots: polygonal(state.sides, n), newDots: gnomon(state.sides, state.size) };
  }

  return { SIDES_MIN, SIDES_MAX, SIDES_START, SIZE_MIN, SIZE_MAX, SIZE_START, start, polygonal, gnomon, dots, describe };
})();
