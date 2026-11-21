"use strict";

/*
 * Estimating Circumference, from Bogomolny's applet GoodLimit.
 *
 * A regular n-gon inscribed in a circle of radius R has perimeter
 * P_n = 2 n R sin(pi/n); the circumscribed n-gon has perimeter
 * C_n = 2 n R tan(pi/n). Archimedes used these to squeeze the circumference
 * 2 pi R between them, with 3, 6, 12, 24, 48 and 96 sides.
 *
 * The key idea is that P_n increases, C_n decreases, both converge to 2 pi R,
 * and the gap C_n - P_n shrinks. The logic test checks these claims, the
 * trigonometric values for the classic n, and the squeeze inequality.
 *
 * No document, no window, no storage: one global, ArchimedesCircumferenceCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const ArchimedesCircumferenceCore = (() => {
  const MIN_N = 3;
  const MAX_N = 96;

  function clamp(n, fallback) {
    const v = Math.trunc(Number(n));
    return Number.isFinite(v) ? Math.max(MIN_N, Math.min(MAX_N, v)) : fallback;
  }

  function start(options) {
    const opts = options || {};
    return { n: clamp(opts.n === undefined ? 6 : opts.n, 6), radius: 1 };
  }

  function inscribed(n, radius) {
    return 2 * n * radius * Math.sin(Math.PI / n);
  }

  function circumscribed(n, radius) {
    return 2 * n * radius * Math.tan(Math.PI / n);
  }

  function polygonPoints(n, radius) {
    return Array.from({ length: n }, (_, i) => ({
      x: radius * Math.cos(Math.PI / 2 + 2 * Math.PI * i / n),
      y: radius * Math.sin(Math.PI / 2 + 2 * Math.PI * i / n),
    }));
  }

  function analyze(n, radius) {
    const size = clamp(n, 6);
    const r = radius || 1;
    const p = inscribed(size, r);
    const c = circumscribed(size, r);
    const circle = 2 * Math.PI * r;
    return {
      n: size, radius: r,
      inscribed: p, circumscribed: c, circumference: circle,
      gap: c - p,
      squeeze: p < circle && circle < c,
    };
  }

  function setN(state, n) {
    return { ...state, n: clamp(n, state.n) };
  }

  return { MIN_N, MAX_N, clamp, start, inscribed, circumscribed, polygonPoints, analyze, setN };
})();
