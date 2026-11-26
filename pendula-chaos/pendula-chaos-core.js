"use strict";

/*
 * Pendula chaos: N dots in harmonic motion whose periods are the consecutive
 * whole numbers T, T+1, ..., T+N-1 (in units of 1/20 of a turn per step).
 * Dot i (0-based) is at height  M - A cos(step * (i + T) / 20)  above its
 * resting line and at x = margin + DX * i, as the applet's Draw and Reset
 * compute them. The step advances by V = 2/N on every 20 ms tick, backward
 * when V is negative.
 *
 * Because i + T is a whole number, every dot is at its top when step is a
 * multiple of 40 pi, so the order returns exactly after one cycle; at
 * 40 pi p / q the dots sit on at most q/2 + 1 levels, which is what makes the
 * pretty waves.
 *
 * No DOM. The global is PendulaCore.
 */
var PendulaCore = (function () {
  const MIN_N = 5, MAX_N = 100, N_STEP = 5, DEFAULT_N = 20;
  const MIN_T = 1, MAX_T = 100, DEFAULT_T = 1;
  const CYCLE = 40 * Math.PI;

  function clamp(v, lo, hi, dflt) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return dflt;
    return Math.min(hi, Math.max(lo, v));
  }

  function start(opts) {
    opts = opts || {};
    const n = Math.round(clamp(opts.n, MIN_N, MAX_N, DEFAULT_N) / N_STEP) * N_STEP;
    return { n: Math.min(MAX_N, Math.max(MIN_N, n)), t: clamp(opts.t, MIN_T, MAX_T, DEFAULT_T), step: 0, dir: 0 };
  }

  /** The applet's speed: 2/N per tick, so a full cycle always takes 20 pi N ticks. */
  function speed(n) { return 2 / n; }

  /** Height of dot i above its lowest point, 0..2A: A - A cos(...) with A = 1. */
  function offset(step, t, i) { return 1 - Math.cos((step * (i + t)) / 20); }

  /** All N offsets at a step. */
  function offsets(n, t, step) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(offset(step, t, i));
    return out;
  }

  /** Number of distinct levels (offsets closer than tol count as one). */
  function levels(n, t, step, tol) {
    const v = offsets(n, t, step).sort((a, b) => a - b);
    let count = 0, last = -Infinity;
    for (const x of v) if (x - last > (tol == null ? 1e-6 : tol)) { count++; last = x; }
    return count;
  }

  /** The state after `ticks` ticks at the current direction. */
  function advance(s, ticks) {
    return Object.assign({}, s, { step: s.step + s.dir * speed(s.n) * ticks });
  }

  return { MIN_N, MAX_N, N_STEP, DEFAULT_N, MIN_T, MAX_T, DEFAULT_T, CYCLE, start, speed, offset, offsets, levels, advance };
})();
