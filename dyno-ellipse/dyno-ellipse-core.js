"use strict";

/*
 * Dyno Ellipse — the geometry behind Alexander Bogomolny's applet DynoEllipse.
 *
 * Two arrows start together pointing right and spin about one centre. At step n
 * the first is (r1 cos(n*Rate1/360), -r1 sin(n*Rate1/360)) and the second is
 * (r2 cos(n*Rate2/360), -r2 sin(n*Rate2/360)), in screen coordinates with y
 * down; the applet adds them component by component and draws a dot at the sum.
 * The phases are both zero and the divisor is 360 *radians*, as in the bytecode.
 * When Rate2 = -Rate1 the two arrows counter-rotate and the dot obeys
 * (X/(r1+r2))^2 + (Y/(r1-r2))^2 = 1: an ellipse. Equal rates give a circle,
 * opposite rates with equal radii give a straight segment.
 *
 * This is a faithful transcription of DynoEllipseCanvas.update and Reset: the
 * four number fields have ranges -50..50, -50..50, 0..100, 0..100 and initial
 * values 2, 5, 60, 40; changing any of them calls Reset (step count back to 0).
 * The applet keeps only the last two sum points and paints into a persistent
 * image; here the page keeps the points and redraws the same polyline.
 *
 * No document, no window, no storage: one global, DynoEllipseCore. The position
 * is plain data, so the page can hand it to Track and the tutor as it is.
 */
const DynoEllipseCore = (() => {
  const RATE_MIN = -50, RATE_MAX = 50;          // CTKNumberCanvas.SetRange(-50, 50)
  const RADIUS_MIN = 0, RADIUS_MAX = 100;       // CTKNumberCanvas.SetRange(0, 100)
  const DIVISOR = 360;                          // the applet divides n*Rate by 360
  const PHASE1 = 0, PHASE2 = 0;                 // the two phases are always zero
  const W = 400, H = 300;                       // the applet's "400 will do", "300 will do"
  const CENTER = { x: W / 2, y: H / 2 };        // init: DoubPoint(size.x/2, size.y/2)
  const PERIOD = Math.ceil(720 * Math.PI);      // 2*pi*360: one full turn at unit rate
  const TRACE = Math.ceil(720 * Math.PI * 1.1); // a little over one turn, for the drawn polyline
  const DEFAULTS = { rate1: 2, rate2: 5, r1: 60, r2: 40 };

  function clampInt(value, lo, hi, fallback) {
    if (value === null || value === undefined || typeof value === "boolean" ||
        (typeof value === "string" && !value.trim())) return fallback;
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  }

  /** A new picture: the applet's four initial values, Go unchecked, both shows on. */
  function start(options) {
    const o = options || {};
    return {
      rate1: clampInt(o.rate1 === undefined ? DEFAULTS.rate1 : o.rate1, RATE_MIN, RATE_MAX, DEFAULTS.rate1),
      rate2: clampInt(o.rate2 === undefined ? DEFAULTS.rate2 : o.rate2, RATE_MIN, RATE_MAX, DEFAULTS.rate2),
      r1: clampInt(o.r1 === undefined ? DEFAULTS.r1 : o.r1, RADIUS_MIN, RADIUS_MAX, DEFAULTS.r1),
      r2: clampInt(o.r2 === undefined ? DEFAULTS.r2 : o.r2, RADIUS_MIN, RADIUS_MAX, DEFAULTS.r2),
      n: 0, showCircles: true, showBars: true, running: false, explored: false, moves: 0,
    };
  }

  /** DynoEllipseCanvas.ProcessNumberChange: every number change calls Reset. */
  function setOption(state, name, value) {
    let next = null;
    if (name === "rate1") next = clampInt(value, RATE_MIN, RATE_MAX, DEFAULTS.rate1);
    else if (name === "rate2") next = clampInt(value, RATE_MIN, RATE_MAX, DEFAULTS.rate2);
    else if (name === "r1") next = clampInt(value, RADIUS_MIN, RADIUS_MAX, DEFAULTS.r1);
    else if (name === "r2") next = clampInt(value, RADIUS_MIN, RADIUS_MAX, DEFAULTS.r2);
    if (next === null || next === state[name]) return state;
    return { ...state, [name]: next, n: 0, explored: true, moves: state.moves + 1 };
  }

  /** The two "Show" checkboxes and Go only change flags, never the step count. */
  function setShow(state, name, value) {
    if (name !== "showCircles" && name !== "showBars") return state;
    const on = value === true;
    if (state[name] === on) return state;
    return { ...state, [name]: on, explored: true, moves: state.moves + 1 };
  }

  function setRunning(state, on) {
    const value = on === true;
    return value === state.running ? state : { ...state, running: value, explored: true, moves: state.moves + 1 };
  }

  /** Jump to a step; used by the tracing dot when it is dragged or arrowed along the curve. */
  function setN(state, at) {
    const n = Math.max(0, clampInt(at, 0, 1e7, 0));
    return n === state.n ? state : { ...state, n, explored: true, moves: state.moves + 1 };
  }

  function step(state, count) {
    const k = Number.isFinite(Number(count)) ? Math.trunc(Number(count)) : 1;
    return setN(state, state.n + (k === 0 ? 1 : k));
  }

  /**
   * One frame of DynoEllipseCanvas.update, line for line. `at` is Java's long N;
   * the local L10 (= N*Rate1) in the bytecode is computed and never used.
   */
  function frame(state, at) {
    const n = at === undefined ? state.n : Math.trunc(Number(at));
    const unusedL10 = n * state.rate1;
    const ax1 = (n * state.rate1) / DIVISOR + PHASE1;
    const ay1 = (n * state.rate1) / DIVISOR - PHASE1;
    const ax2 = (n * state.rate2) / DIVISOR + PHASE2;
    const ay2 = (n * state.rate2) / DIVISOR - PHASE2;
    const v1 = { x: state.r1 * Math.cos(ax1), y: -state.r1 * Math.sin(ay1) };
    const v2 = { x: state.r2 * Math.cos(ax2), y: -state.r2 * Math.sin(ay2) };
    return {
      v1, v2, unusedL10,
      end1: { x: CENTER.x + v1.x, y: CENTER.y + v1.y },
      end2: { x: CENTER.x + v2.x, y: CENTER.y + v2.y },
      sum: { x: CENTER.x + v1.x + v2.x, y: CENTER.y + v1.y + v2.y },
    };
  }

  /** The sum points from `from` through `to`, never more than TRACE of them. */
  function trace(state, from, to) {
    const last = Math.max(0, Math.trunc(Number(to) || 0));
    const first = Math.max(0, last - TRACE + 1, Math.trunc(Number(from) || 0));
    const out = [];
    for (let k = first; k <= last; k++) out.push(frame(state, k).sum);
    return out;
  }

  /** Which step of the drawn curve is nearest a board position (for dragging the pen). */
  function nearestStep(state, q, from, to) {
    const last = Math.max(0, Math.trunc(Number(to) || 0));
    const first = Math.max(0, last - TRACE + 1, Math.trunc(Number(from) || 0));
    let best = first, distance = Infinity;
    for (let k = first; k <= last; k++) {
      const p = frame(state, k).sum;
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      if (d < distance) { distance = d; best = k; }
    }
    return best;
  }

  /** What the curve is, for the status line. W = rate1/rate2, R = r1/r2. */
  function shapeName(state) {
    if (state.r1 === 0 && state.r2 === 0) return "a single point";
    if (state.rate1 === state.rate2) return "a circle";
    if (state.rate1 === -state.rate2) return state.r1 === state.r2 ? "a straight line" : "an ellipse";
    return "a looping curve";
  }

  function status(state, f) {
    const p = f.sum;
    return `Arms ${state.r1} and ${state.r2}, turning at ${state.rate1} and ${state.rate2}. ` +
      `Step ${state.n}: their tips meet at (${Math.round(p.x)}, ${Math.round(p.y)}), ` +
      `tracing ${shapeName(state)}. ${state.running ? "Running." : "Paused."}`;
  }

  /** A demo: nothing to win; the record sees it as finished once explored. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    RATE_MIN, RATE_MAX, RADIUS_MIN, RADIUS_MAX, DIVISOR, PHASE1, PHASE2,
    W, H, CENTER, PERIOD, TRACE, DEFAULTS,
    start, setOption, setShow, setRunning, setN, step, frame, trace, nearestStep,
    shapeName, status, result,
  };
})();
