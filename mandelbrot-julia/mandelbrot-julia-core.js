"use strict";

/*
 * Mandelbrot Indexing Julia Sets, from Bogomolny's applet julia.
 *
 * For the family f_c(z) = z² + c, the Mandelbrot set indexes the Julia sets:
 * start the orbit at z = 0 and vary c; the iteration count at which |z|
 * exceeds 2 colours the Mandelbrot picture. Fix a c from that picture, then
 * vary the starting point z₀ over a rectangle: the same iteration count
 * colours the Julia set for that c.
 *
 * The key idea is that the escape radius 2 is safe because |z| > 2 forces the
 * orbit to diverge. The logic test checks known bounded and escaping values,
 * the symmetry of the sets, the escape-time recurrence and a few Julia
 * special cases (c = 0 gives the unit circle boundary).
 *
 * No document, no window, no storage: one global, MandelbrotJuliaCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const MandelbrotJuliaCore = (() => {
  const MIN_ITER = 8;
  const MAX_ITER = 128;

  const clamp = (v, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(MIN_ITER, Math.min(MAX_ITER, n)) : fb;
  };

  function start() {
    return { c: { re: -0.4, im: 0.2 }, maxIter: 48 };
  }

  /** Escape iteration for z0 under z -> z*z + c; maxIter means bounded. */
  function escape(z0, c, maxIter) {
    let x = z0.re;
    let y = z0.im;
    for (let k = 0; k < maxIter; k++) {
      const x2 = x * x;
      const y2 = y * y;
      if (x2 + y2 > 4) return k;
      const nx = x2 - y2 + c.re;
      y = 2 * x * y + c.im;
      x = nx;
    }
    return maxIter;
  }

  function mandelbrot(c, maxIter) {
    return escape({ re: 0, im: 0 }, c, maxIter);
  }

  function julia(z0, c, maxIter) {
    return escape(z0, c, maxIter);
  }

  function bounded(c, maxIter) {
    return mandelbrot(c, maxIter) >= maxIter;
  }

  /** A grid of escape times for a complex rectangle. */
  function render(width, height, bounds, c, maxIter, kind) {
    const out = [];
    for (let py = 0; py < height; py++) {
      const im = bounds.minIm + (py + 0.5) * (bounds.maxIm - bounds.minIm) / height;
      for (let px = 0; px < width; px++) {
        const re = bounds.minRe + (px + 0.5) * (bounds.maxRe - bounds.minRe) / width;
        const z = { re, im };
        out.push(kind === "mandelbrot" ? mandelbrot(z, maxIter) : julia(z, c, maxIter));
      }
    }
    return out;
  }

  const MANDELBROT_BOUNDS = { minRe: -2.2, maxRe: 0.8, minIm: -1.4, maxIm: 1.4 };
  const JULIA_BOUNDS = { minRe: -1.6, maxRe: 1.6, minIm: -1.2, maxIm: 1.2 };

  function fromMandelbrotPixel(px, py, width, height) {
    const b = MANDELBROT_BOUNDS;
    return {
      re: b.minRe + (px + 0.5) * (b.maxRe - b.minRe) / width,
      im: b.maxIm - (py + 0.5) * (b.maxIm - b.minIm) / height,
    };
  }

  function setC(state, c) {
    return { ...state, c: { re: Number(c.re) || 0, im: Number(c.im) || 0 } };
  }

  function setIterations(state, value) {
    return { ...state, maxIter: clamp(value, state.maxIter) };
  }

  function analyze(state) {
    return {
      c: state.c,
      maxIter: state.maxIter,
      mandelbrotEscape: mandelbrot(state.c, state.maxIter),
      inMandelbrotSet: bounded(state.c, state.maxIter),
      orbit: orbit(state.c, state.maxIter),
    };
  }

  /** The first few iterates of 0, for display. */
  function orbit(c, maxIter, count = 8) {
    const out = [{ re: 0, im: 0 }];
    let z = { re: 0, im: 0 };
    for (let i = 0; i < Math.min(count, maxIter); i++) {
      const nx = z.re * z.re - z.im * z.im + c.re;
      z = { re: nx, im: 2 * z.re * z.im + c.im };
      out.push(z);
    }
    return out;
  }

  return {
    MIN_ITER, MAX_ITER, clamp, start, escape, mandelbrot, julia, bounded,
    render, MANDELBROT_BOUNDS, JULIA_BOUNDS, fromMandelbrotPixel,
    setC, setIterations, analyze, orbit,
  };
})();
