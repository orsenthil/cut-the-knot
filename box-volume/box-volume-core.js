"use strict";

/*
 * Box Volume, from Alexander Bogomolny's applet BoxVolume.
 *
 * Start with a flat rectangle of card a units long and b units wide. Cut a
 * square of side x out of each corner, throw the squares away and fold up the
 * four flaps. The base is (a - 2x) by (b - 2x) and the height is x, so the box
 * holds
 *
 *     v(x) = x (a - 2x) (b - 2x) = 4x^3 - 2(a + b)x^2 + ab x.
 *
 * Only 0 <= x <= min(a, b)/2 makes a real box. The key idea is that v is a
 * cubic with roots at 0, a/2 and b/2; the local maximum in the middle of that
 * interval is where its derivative 12x^2 - 4(a + b)x + ab first reaches zero.
 * The smaller root of that quadratic is the best cut:
 *
 *     xBest = ((a + b) - sqrt(a^2 - ab + b^2)) / 6.
 *
 * No document, no window, no storage: one global, BoxVolumeCore. The position
 * is plain data (numbers and a flag), so it can be saved and handed to the
 * tutor as it is. Every function takes a position and returns a new one.
 */
const BoxVolumeCore = (() => {
  // The applet lets the three control points set the two sides and the cut.
  // Its default 400x250 canvas gives roughly 6.7 by 4.2 and a cut near 1;
  // the sliders use the same physical units with a little more room to explore.
  const MIN_SIDE = 2;
  const MAX_SIDE = 20;
  const SIDE_STEP = 0.5;
  const MAX_CUT = 10; // min(a, b)/2 is at most 10 at the largest sides
  const CUT_STEP = 0.05;
  const DEFAULT = { a: 11, b: 8.5, x: 1, found: false };

  /** Applet-style number: clamp to the range and fall back on bad input. */
  function clamp(value, low, high, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  }

  /** Round to the slider's step so the position is always a plain, tidy number. */
  function snap(value, step) {
    return Math.round(value / step) * step;
  }

  /** The largest cut that still leaves a box with a non-negative base. */
  function domainMax(a, b) {
    return Math.min(a, b) / 2;
  }

  /** Keep the cut inside the physical domain, whatever the sliders say. */
  function clampX(x, a, b) {
    return clamp(x, 0, domainMax(a, b), 0);
  }

  /** The position a new page opens with. */
  function start(options) {
    const opts = options || {};
    const a = clamp(snap(opts.a === undefined ? DEFAULT.a : opts.a, SIDE_STEP), MIN_SIDE, MAX_SIDE, DEFAULT.a);
    const b = clamp(snap(opts.b === undefined ? DEFAULT.b : opts.b, SIDE_STEP), MIN_SIDE, MAX_SIDE, DEFAULT.b);
    const x = clamp(snap(opts.x === undefined ? DEFAULT.x : opts.x, CUT_STEP), 0, Math.min(MAX_CUT, domainMax(a, b)), DEFAULT.x);
    return { a, b, x, found: false };
  }

  /** Set one side, pulling the cut back into the domain if the side shrank. */
  function setSide(state, which, value) {
    const side = clamp(snap(value, SIDE_STEP), MIN_SIDE, MAX_SIDE, state[which]);
    const next = { ...state, [which]: side };
    next.x = clampX(next.x, next.a, next.b);
    next.found = false;
    return next;
  }

  function setA(state, value) {
    return setSide(state, "a", value);
  }

  function setB(state, value) {
    return setSide(state, "b", value);
  }

  /** A player move of the cut. `found` clears, because the box is no longer best. */
  function setX(state, value) {
    const x = clamp(snap(value, CUT_STEP), 0, Math.min(MAX_CUT, domainMax(state.a, state.b)), state.x);
    return { ...state, x, found: false };
  }

  /** The volume as x(a - 2x)(b - 2x), the applet's Parabola() in real units. */
  function volume(x, a, b) {
    return x * (a - 2 * x) * (b - 2 * x);
  }

  /** The expanded cubic from the page, checked against the factored form. */
  function volumeExpanded(x, a, b) {
    return 4 * x * x * x - 2 * (a + b) * x * x + a * b * x;
  }

  /** The page's derivative and the second derivative used to tell max from min. */
  function derivative(x, a, b) {
    return 12 * x * x - 4 * (a + b) * x + a * b;
  }

  function secondDerivative(x, a, b) {
    return 24 * x - 4 * (a + b);
  }

  /** The three roots of the volume cubic, smallest first. */
  function roots(a, b) {
    return [0, Math.min(a, b) / 2, Math.max(a, b) / 2];
  }

  /** a^2 - ab + b^2: the discriminant of the derivative, after dividing by 16. */
  function discriminant(a, b) {
    return a * a - a * b + b * b;
  }

  /** The small root of the derivative: the cut that gives the biggest box. */
  function optimalX(a, b) {
    return ((a + b) - Math.sqrt(discriminant(a, b))) / 6;
  }

  /** The other root of the derivative: the local minimum of the cubic. */
  function minimumX(a, b) {
    return ((a + b) + Math.sqrt(discriminant(a, b))) / 6;
  }

  function optimalVolume(a, b) {
    return volume(optimalX(a, b), a, b);
  }

  /** Everything the page shows, recomputed from the position. */
  function evaluate(state) {
    const best = optimalX(state.a, state.b);
    return {
      a: state.a,
      b: state.b,
      x: state.x,
      baseA: state.a - 2 * state.x,
      baseB: state.b - 2 * state.x,
      volume: volume(state.x, state.a, state.b),
      domainMax: domainMax(state.a, state.b),
      bestX: best,
      bestVolume: volume(best, state.a, state.b),
      found: state.found,
    };
  }

  /** Press "Find the best cut": snap x to the true optimum, to the slider step. */
  function findBest(state) {
    const best = snap(optimalX(state.a, state.b), CUT_STEP);
    return { ...state, x: clampX(best, state.a, state.b), found: true };
  }

  /** The demo is explored once the player has found the best cut. */
  function result(state) {
    return state.found ? "done" : null;
  }

  /** A fixed number of decimals, for the readouts and the status sentence. */
  function format(value, digits) {
    const d = digits === undefined ? 2 : digits;
    return Number(value).toFixed(d);
  }

  return {
    MIN_SIDE,
    MAX_SIDE,
    SIDE_STEP,
    MAX_CUT,
    CUT_STEP,
    DEFAULT,
    clamp,
    snap,
    domainMax,
    clampX,
    start,
    setA,
    setB,
    setX,
    volume,
    volumeExpanded,
    derivative,
    secondDerivative,
    roots,
    discriminant,
    optimalX,
    minimumX,
    optimalVolume,
    evaluate,
    findBest,
    result,
    format,
  };
})();
