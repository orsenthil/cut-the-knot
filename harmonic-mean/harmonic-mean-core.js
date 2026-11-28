"use strict";

/*
 * Harmonic Mean — the average-speed demonstration in Alexander Bogomolny's
 * applet HarmonicMean (arithmetic/HarmonicMean.shtml on cut-the-knot.org).
 *
 * A relay team runs one leg of equal length at each chosen speed. A second
 * team of identical twins runs the whole way at one steady speed. The twins
 * tie the relay exactly when their speed is the harmonic mean of the leg
 * speeds: equal distances make the *times* add, so
 *
 *     S = N / (1/v1 + 1/v2 + ... + 1/vN).
 *
 * This is why 20 mph over the first half and 30 mph over the second half
 * average 24 mph, not 25 mph. The applet's DistanceGraph.Evaluate is
 * transcribed in evaluate(): one unit of distance per leg, totalTime as the
 * sum of the reciprocals, leg times as running sums, and mean = N/totalTime.
 * VSlider's pixel <-> speed conversion is transcribed in valueAtPixel and
 * pixelForValue, including the float arithmetic and Java's Math.round.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, HarmonicMeanCore, so the page loads it with
 * a plain <script> and porting/check-harmonic-mean.mjs loads it in Node.
 * Functions take plain data and return new objects; they never mutate input.
 */
const HarmonicMeanCore = (() => {
  const MIN_N = 2;                 // HarmonicMeanPanel: NEdit.setMinValue(2)
  const MAX_N = 40;                // HarmonicMeanPanel: NEdit.setMaxValue(40)
  const DEFAULT_N = 10;            // HarmonicMeanCanvas.init: parameter default
  const MIN_SPEED = 1;             // CreateElements: "rangeMin" default
  const MAX_SPEED = 10;            // CreateElements: "rangeMax" default
  const SLIDER_HEIGHT = 100;       // only the ratio matters in VSlider
  const EPS = 1e-12;

  const f = Math.fround;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** Java's Math.round for the non-negative values the sliders produce. */
  const javaRound = (v) => Math.floor(v + 0.5);
  const int = (v, fallback) => (Number.isFinite(v) ? Math.trunc(v) : fallback);

  /** VSlider.DoubleValue, from the handle's L coordinate (y grows downwards). */
  function valueAtPixel(L, y, height, min, max) {
    const h = f(height);
    return f(f(min) + f(f(max - min) * f(y + height - L) / h));
  }

  /** VSlider.SetValue, the inverse: where the handle sits for a given value. */
  function pixelForValue(value, y, height, min, max) {
    if (max === min) return y + height;
    return javaRound(y + height - height * (value - min) / (max - min));
  }

  /** VSlider.SetRandomValue -> IntValue: a random integer in [min, max]. */
  function randomSpeed(min, max, random) {
    const y = 0;
    const L = javaRound(y + (random || Math.random)() * SLIDER_HEIGHT);
    return clamp(javaRound(valueAtPixel(L, y, SLIDER_HEIGHT, min, max)), min, max);
  }

  /** SnapToNearest: the released slider value is rounded to an integer. */
  function snap(v, min, max) {
    return clamp(javaRound(v), min, max);
  }

  /** The position a new demonstration starts from. */
  function start(options) {
    const o = options || {};
    const min = clamp(int(o.min, MIN_SPEED), 0, 100);
    const max = clamp(int(o.max, MAX_SPEED), min + 1, 101);
    const n = clamp(int(o.n, Array.isArray(o.speeds) ? o.speeds.length : DEFAULT_N), MIN_N, MAX_N);
    const mode = o.mode === "distance" ? "distance" : "time";
    const random = o.random || Math.random;
    let speeds;
    if (Array.isArray(o.speeds)) {
      speeds = Array.from({ length: n }, (_, i) => {
        const given = Number(o.speeds[i]);
        return Number.isFinite(given) ? clamp(javaRound(given), min, max) : min;
      });
    } else {
      speeds = Array.from({ length: n }, () => randomSpeed(min, max, random));
    }
    return {
      n: n,
      min: min,
      max: max,
      speeds: speeds,
      mode: mode,
      selected: clamp(int(o.selected, 0), 0, n - 1),
      race: { running: false, time: 0 },
    };
  }

  /** Reset(true): a new leg count rebuilds the sliders with random values. */
  function setCount(s, n, random) {
    const next = clamp(int(n, s.n), MIN_N, MAX_N);
    const fresh = start({
      n: next, min: s.min, max: s.max, mode: s.mode,
      selected: Math.min(s.selected, next - 1), random: random || Math.random,
    });
    return fresh;
  }

  /** A dragged slider keeps a floating value; a released one snaps. */
  function setSpeed(s, i, v, snapped) {
    if (!Number.isInteger(i) || i < 0 || i >= s.speeds.length) return s;
    const k = i;
    const value = snapped === false
      ? clamp(Number(v), s.min, s.max)
      : snap(Number(v), s.min, s.max);
    if (!Number.isFinite(value) || s.speeds[k] === value) return s;
    const speeds = s.speeds.slice();
    speeds[k] = value;
    return Object.assign({}, s, { speeds: speeds });
  }

  /** The applet's "T vs V" / "Dist vs V" checkbox pair. */
  function setMode(s, mode) {
    const next = mode === "distance" ? "distance" : "time";
    return next === s.mode ? s : Object.assign({}, s, { mode: next });
  }

  function select(s, i) {
    const k = clamp(int(i, 0), 0, s.speeds.length - 1);
    return k === s.selected ? s : Object.assign({}, s, { selected: k });
  }

  /*
   * DistanceGraph.Evaluate, with one unit of distance per leg. Each speed
   * contributes 1/v to totalTime; a zero speed is skipped exactly as the
   * bytecode skips it (though the UI's range never allows one).
   */
  function evaluate(s) {
    const n = s.speeds.length;
    let totalTime = 0;
    const legTimes = [];
    for (let i = 0; i < n; i++) {
      const v = s.speeds[i];
      if (v === 0) continue;
      totalTime += 1 / v;
      legTimes.push(totalTime);
    }
    const mean = totalTime === 0 ? 0 : n / totalTime;
    let sum = 0, inv = 0;
    for (const v of s.speeds) { sum += v; if (v !== 0) inv += 1 / v; }
    const arithmetic = sum / n;
    const harmonic = inv === 0 ? 0 : n / inv;
    const allEqual = s.speeds.every((v) => v === s.speeds[0]);
    return {
      n: n,
      legTimes: legTimes,
      totalTime: totalTime,
      mean: mean,
      arithmetic: arithmetic,
      harmonic: harmonic,
      allEqual: allEqual,
    };
  }

  /** Widths of the speed bars: V vs T uses leg times, V vs D equal pieces. */
  function barWidths(s) {
    const e = evaluate(s);
    const total = s.mode === "time" ? e.totalTime : s.speeds.length;
    if (!(total > 0)) return s.speeds.map(() => 1 / s.speeds.length);
    if (s.mode === "distance") return s.speeds.map(() => 1 / s.speeds.length);
    let before = 0;
    return s.speeds.map((v) => {
      const width = v === 0 ? 0 : (1 / v) / total;
      before += width;
      return width;
    });
  }

  /** Where the two teams are at model time t (distance 1 per leg). */
  function teamsAt(s, t) {
    const e = evaluate(s);
    const time = clamp(Number(t), 0, e.totalTime);
    let leg = s.speeds.findIndex((v, i) => time < e.legTimes[i] - EPS);
    if (leg < 0) leg = s.speeds.length - 1;
    let bug;
    if (time >= e.totalTime) bug = s.speeds.length;
    else if (s.speeds[leg] === 0) bug = leg;
    else {
      const from = leg === 0 ? 0 : e.legTimes[leg - 1];
      bug = leg + (time - from) * s.speeds[leg];
    }
    const twin = time * e.mean;
    return { bug: bug, twin: twin, leg: leg, finished: time >= e.totalTime - EPS };
  }

  /** Advance a running race; the applet counts a tick every 100 ms. */
  function advance(s, dt) {
    if (!s.race.running || !(dt > 0)) return s;
    const e = evaluate(s);
    const time = Math.min(e.totalTime, s.race.time + dt);
    return Object.assign({}, s, { race: { running: time < e.totalTime - EPS, time: time } });
  }

  function startRace(s) {
    const e = evaluate(s);
    return Object.assign({}, s, { race: { running: e.totalTime > 0, time: 0 } });
  }

  function stopRace(s) {
    return Object.assign({}, s, { race: { running: false, time: s.race.time } });
  }

  /** "done" ends a demonstration run; there is no win or loss. */
  function result(s) {
    const e = evaluate(s);
    return e.totalTime > 0 && s.race.time >= e.totalTime - EPS ? "done" : null;
  }

  /** Plain, small data for Track.state and the tutor. */
  function position(s) {
    const e = evaluate(s);
    return {
      n: s.n,
      speeds: s.speeds.slice(),
      mode: s.mode,
      selected: s.selected,
      raceTime: s.race.time,
      mean: e.mean,
    };
  }

  return {
    MIN_N: MIN_N, MAX_N: MAX_N, DEFAULT_N: DEFAULT_N,
    MIN_SPEED: MIN_SPEED, MAX_SPEED: MAX_SPEED,
    valueAtPixel: valueAtPixel, pixelForValue: pixelForValue,
    randomSpeed: randomSpeed, snap: snap,
    start: start, setCount: setCount, setSpeed: setSpeed,
    setMode: setMode, select: select,
    evaluate: evaluate, barWidths: barWidths, teamsAt: teamsAt,
    advance: advance, startRace: startRace, stopRace: stopRace,
    result: result, position: position,
  };
})();
