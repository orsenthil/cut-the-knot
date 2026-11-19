"use strict";

/*
 * Buffon's Needle / Buffon's Noodle, ported from Alexander Bogomolny's Java
 * applet "Buffon" (cut-the-knot.org/Curriculum/Probability/Buffon.shtml).
 *
 * A needle of length L is thrown at random onto a floor whose cracks are D
 * apart. Here L equals D. The needle crosses a crack exactly when one of the
 * two crack lines lies between the needle's lower and upper end. Put its
 * midpoint uniformly in the strip and its angle uniformly in [0, 2*pi): the
 * chance of a crossing is 2/pi, so 2 * throws / crossings estimates pi.
 *
 * The surprise the applet demonstrates is that the needle need not be straight.
 * A broken "noodle" of the same total length has the same expected number of
 * crossings: every segment has the same probability as its length warrants,
 * wherever it hangs off the first piece, so expectations simply add. The
 * applet builds the noodle by chaining the drawn segments at their original
 * turning angles and giving the whole chain one random rotation.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BuffonCore. The position is plain JSON; every
 * function takes a position (or a seeded random source) and returns new data.
 */

const BuffonCore = (() => {
  // The applet's world: cracks at 0 and 4, needle length 2R = 4, so L = D.
  const Y_MIN = 0;
  const Y_MAX = 4;
  const LENGTH = Y_MAX - Y_MIN;
  const CENTER_X = LENGTH / 2; // the applet throws about the middle of its canvas

  // BuffonPanel: scrollbars (0,5,10,0,110) and (0,0,100,0,1100).
  const TRIAL_STEP = 100; // N = slider * 100
  const TRIAL_MIN = 0;
  const TRIAL_MAX = 100 * TRIAL_STEP;
  const TRIAL_DEFAULT = 5 * TRIAL_STEP;
  const SKIP_MIN = 0;
  const SKIP_MAX = 1000;
  const SKIP_DEFAULT = 0;

  const TAU = 2 * Math.PI;

  function clampInt(value, lo, hi) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  /** BuffonNeedle.HasCrossed(y, y1, y2): y1 <= y <= y2, with the ends ordered. */
  function crosses(boundary, y1, y2) {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    return lo <= boundary && boundary <= hi;
  }

  /** True if the segment from (x1,y1) to (x2,y2) reaches either crack. */
  function segmentHits(y1, y2) {
    return crosses(Y_MIN, y1, y2) || crosses(Y_MAX, y1, y2);
  }

  /** Rescale a drawn polyline so its total length is `target`, as Reset(Vector) does. */
  function scaleShape(points, target = LENGTH) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = Number(b[0]) - Number(a[0]);
      const dy = Number(b[1]) - Number(a[1]);
      const len = Math.hypot(dx, dy);
      segments.push([dx, dy, len]);
      total += len;
    }
    if (!(total > 0) || !Number.isFinite(total)) return null;
    const factor = target / total;
    return segments.map((s) => [s[0] * factor, s[1] * factor]);
  }

  function shapeLength(shape) {
    if (!shape) return LENGTH;
    return shape.reduce((sum, s) => sum + Math.hypot(s[0], s[1]), 0);
  }

  /** Cumulative turning angles of a rescaled noodle (a rigid rotation keeps its shape). */
  function turnsOf(shape) {
    if (!shape) return [0];
    const angles = shape.map((s) => Math.atan2(s[0], s[1])); // applet uses (sin a, cos a)
    const turns = [0];
    for (let i = 1; i < angles.length; i++) turns.push(turns[i - 1] + (angles[i] - angles[i - 1]));
    return turns;
  }

  /** BuffonNeedle.Throw(): one straight needle, angle and strip position from rng. */
  function throwNeedle(rng, opts = {}) {
    const yMin = opts.yMin ?? Y_MIN;
    const yMax = opts.yMax ?? Y_MAX;
    const length = opts.length ?? LENGTH;
    const angle = rng() * TAU;
    const t = rng();
    const centerY = yMin + (yMax - yMin) * t;
    const dx = Math.sin(angle) * length;
    const dy = Math.cos(angle) * length;
    const x1 = CENTER_X - dx / 2;
    const y1 = centerY - dy / 2;
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    const hit = segmentHits(y1, y2);
    return { angle, centerY, x1, y1, x2, y2, hit, hits: hit ? 1 : 0 };
  }

  /** Noodle.Throw(): first piece thrown freely, the rest chained with rigid turns. */
  function throwNoodle(rng, shape, opts = {}) {
    if (!shape || shape.length === 0) return throwNeedle(rng, opts);
    const yMin = opts.yMin ?? Y_MIN;
    const yMax = opts.yMax ?? Y_MAX;
    const angle = rng() * TAU;
    const t = rng();
    const centerY = yMin + (yMax - yMin) * t;
    const turns = turnsOf(shape);
    const segments = [];
    let x1 = CENTER_X;
    let y1 = centerY;
    let hits = 0;
    for (let i = 0; i < shape.length; i++) {
      const length = Math.hypot(shape[i][0], shape[i][1]);
      const a = angle + turns[i];
      const dx = Math.sin(a) * length;
      const dy = Math.cos(a) * length;
      if (i === 0) {
        // The applet's first needle is placed by its midpoint.
        x1 = CENTER_X - dx / 2;
        y1 = centerY - dy / 2;
      }
      const x2 = x1 + dx;
      const y2 = y1 + dy;
      const hit = segmentHits(y1, y2);
      if (hit) hits++;
      segments.push({ x1, y1, x2, y2, angle: a, hit });
      x1 = x2;
      y1 = y2;
    }
    return { angle, centerY, segments, hit: hits > 0, hits };
  }

  /** The position a new run of the applet starts from. */
  function start(options = {}) {
    const o = options || {};
    const trials = o.trials == null ? TRIAL_DEFAULT : clampInt(o.trials, TRIAL_MIN, TRIAL_MAX);
    const shape = o.shape ? scaleShape(o.shape) : null;
    return {
      trials,
      perRun: trials,
      skip: o.skip == null ? SKIP_DEFAULT : clampInt(o.skip, SKIP_MIN, SKIP_MAX),
      showPi: !!o.showPi,
      shape,
      throws: 0,
      crossings: 0,
      last: null,
      running: false,
      completed: false,
    };
  }

  /** The # Trials scrollbar (0..100) sets N = value*100 and resets the run. */
  function setTrials(pos, slider) {
    const trials = clampInt(slider, 0, TRIAL_STEP) * TRIAL_STEP;
    return { ...pos, trials, perRun: trials, throws: 0, crossings: 0, last: null, running: false, completed: false };
  }

  /** The Skip scrollbar only controls how often the canvas is repainted. */
  function setSkip(pos, slider) {
    return { ...pos, skip: clampInt(slider, SKIP_MIN, SKIP_MAX) };
  }

  function setShowPi(pos, show) {
    return { ...pos, showPi: !!show };
  }

  /** Replace the noodle shape; saving one resets the throws like the applet's Save. */
  function setShape(pos, points) {
    return { ...pos, shape: scaleShape(points), throws: 0, crossings: 0, last: null, running: false, completed: false };
  }

  function reset(pos) {
    return { ...pos, throws: 0, crossings: 0, last: null, running: false, completed: false };
  }

  /** The Start button: clear the counters and throw until `trials` is reached. */
  function startRun(pos) {
    return { ...pos, trials: pos.perRun, throws: 0, crossings: 0, last: null, running: true, completed: false };
  }

  function stopRun(pos) {
    return { ...pos, running: false };
  }

  /** The Repeat button adds another `perRun` throws to N and carries on. */
  function repeat(pos) {
    return { ...pos, trials: pos.trials + pos.perRun, running: true, completed: false };
  }

  /** One throw, regardless of whether a batch is running (the canvas's Space key). */
  function throwOnce(pos, rng) {
    const last = pos.shape ? throwNoodle(rng, pos.shape) : throwNeedle(rng);
    const next = {
      ...pos,
      throws: pos.throws + 1,
      crossings: pos.crossings + last.hits,
      last,
    };
    if (next.throws >= next.trials) {
      next.running = false;
      next.completed = true;
    }
    return next;
  }

  /** One iteration of the applet's thread loop. With N=0 the thread just stops. */
  function tick(pos, rng) {
    if (pos.running && pos.throws < pos.trials) return throwOnce(pos, rng);
    if (pos.running) return { ...pos, running: false, completed: pos.trials > 0 };
    return pos;
  }

  /** Run to the end of a batch (or `limit` throws), for the logic test. */
  function run(pos, rng, limit = 100000) {
    let p = pos;
    for (let i = 0; i < limit && p.running && p.throws < p.trials; i++) p = tick(p, rng);
    return p;
  }

  /** Java's Double.toString keeps one decimal on whole numbers; CutDigits pads with 0. */
  function cutDigits(value, digits = 6) {
    let s = Number.isInteger(value) ? value.toFixed(1) : String(value);
    s = s.substring(0, digits);
    while (s.length < digits) s += "0";
    return s;
  }

  function estimatePi(pos) {
    return pos.crossings === 0 ? "0" : cutDigits((2 * pos.throws) / pos.crossings);
  }

  /** The lower-right reading of the applet: crossings / throws [/ pi estimate]. */
  function countText(pos) {
    return pos.crossings + " / " + pos.throws + (pos.showPi ? " / " + estimatePi(pos) : "");
  }

  return {
    Y_MIN,
    Y_MAX,
    LENGTH,
    TRIAL_MIN,
    TRIAL_MAX,
    TRIAL_DEFAULT,
    TRIAL_STEP,
    SKIP_MIN,
    SKIP_MAX,
    SKIP_DEFAULT,
    crosses,
    segmentHits,
    scaleShape,
    shapeLength,
    turnsOf,
    throwNeedle,
    throwNoodle,
    start,
    setTrials,
    setSkip,
    setShowPi,
    setShape,
    reset,
    startRun,
    stopRun,
    repeat,
    throwOnce,
    tick,
    run,
    cutDigits,
    estimatePi,
    countText,
  };
})();
