"use strict";

/*
 * Pure logic for "Birds on a Wire" (no DOM), from Alexander Bogomolny's
 * BirdsOnWire applet. Tested in Node by porting/check-birds-on-wire.mjs.
 *
 * The puzzle: n birds land at random on a wire. Look at the gaps between
 * neighbouring birds. Each bird "claims" the smaller of the two gaps next to
 * it - the gap towards its nearest neighbour. A gap gets marked when at least
 * one of the two birds at its ends claims it, i.e. when it is smaller than at
 * least one neighbouring gap; the two end gaps are always marked. The applet
 * repeats this for many random layouts and plots the average TOTAL LENGTH of
 * the marked gaps (as a fraction of the whole wire) for each bird count.
 *
 * Key idea: a gap is unmarked exactly when it is a local maximum (it is at
 * least as big as both neighbours). The end gaps are always marked, and with
 * n = 2 or 3 every gap is an end gap, so the marked length is just the span
 * from the first to the last bird. As n grows the average settles near 7/18.
 *
 * This file defines the single global BirdsOnWireCore. All state is plain
 * JSON (numbers, arrays, objects) so it can be saved for the tutor as it is.
 */
const BirdsOnWireCore = (() => {
  // The applet's scrollbars: trials 0..110 in steps of 1, each worth 10;
  // birds 2..202. Defaults are 50 trials and 2..2 birds.
  const TRIALS_MIN = 0;
  const TRIALS_MAX = 1100;
  const TRIALS_STEP = 10;
  const TRIALS_DEFAULT = 50;
  const BIRDS_MIN = 2;
  const BIRDS_MAX = 202;
  const BIRDS_DEFAULT = 2;

  function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, Math.round(value)));
  }
  const clampTrials = (v) => clamp(v / TRIALS_STEP, 0, TRIALS_MAX / TRIALS_STEP) * TRIALS_STEP;
  const clampBirds = (v) => clamp(v, BIRDS_MIN, BIRDS_MAX);

  /* ------------------------------------------------ the applet's Perform()
   * Transcribed from BirdsOnWireAccumulator.Perform(double[]). For a sorted
   * array of n positions it returns n-1 flags, one per gap. The end gaps are
   * set first, then for each inner bird the SMALLER of its two gaps is set.
   */
  function perform(positions) {
    const n = positions.length;
    const marked = new Array(Math.max(0, n - 1)).fill(false);
    if (n < 2) return marked;
    marked[0] = true;
    marked[n - 2] = true;
    for (let i = 1; i < n - 1; i++) {
      const left = positions[i] - positions[i - 1]; // gap before bird i
      const right = positions[i + 1] - positions[i]; // gap after bird i
      // dcmpg/ifge then dcmpl/ifle in the applet: strict < or > only.
      if (left < right) marked[i - 1] = true;
      else if (left > right) marked[i] = true;
    }
    return marked;
  }

  /** Total length of the marked gaps (positions are on the unit wire [0,1]). */
  function markedLength(positions) {
    const marked = perform(positions);
    let sum = 0;
    for (let k = 0; k < marked.length; k++) {
      if (marked[k]) sum += positions[k + 1] - positions[k];
    }
    return sum;
  }

  /** A fresh accumulator, as the applet's Reset() makes a new one. */
  function create(trials, min, max) {
    trials = clampTrials(trials === undefined ? TRIALS_DEFAULT : trials);
    min = clampBirds(min === undefined ? BIRDS_DEFAULT : min);
    max = clampBirds(max === undefined ? BIRDS_DEFAULT : max);
    if (min > max) max = min; // the panel drags the other end along
    return {
      trials,
      extra: trials,
      min,
      max,
      birds: min, // NBirds
      count: 0, // NTrials for the current bird count
      startAt: 0, // NStart
      values: new Array(max - min + 1).fill(0), // Values[]
      last: null, // last trial, for drawing only
      runs: 0,
    };
  }

  /** The applet's Reset(): throw away the data, keep the options. */
  function reset(s) {
    return create(s.trials, s.min, s.max);
  }

  /** The applet's IsFinished(). */
  function isFinished(s) {
    return s.birds === s.max && s.count === s.trials;
  }

  /**
   * One trial of the applet's NewTrial(): advance the bird count when the
   * current one has had `trials` runs, drop n random birds, mark their gaps
   * and add the marked length to Values[]. Mutates s and returns the trial.
   */
  function newTrial(s, rng) {
    if (isFinished(s)) return null;
    const rand = rng || Math.random;
    if (s.count === s.trials) {
      s.birds += 1;
      s.count = s.startAt;
    } else {
      s.count += 1;
    }
    const positions = Array.from({ length: s.birds }, rand).sort((a, b) => a - b);
    const marked = perform(positions);
    let length = 0;
    for (let k = 0; k < marked.length; k++) {
      if (marked[k]) length += positions[k + 1] - positions[k];
    }
    s.values[s.birds - s.min] += length;
    s.last = { positions, marked, length };
    s.runs += 1;
    return s.last;
  }

  /** The applet's GetAccumulation(): one {x, y} point per bird count. */
  function accumulation(s) {
    const pts = [];
    for (let i = 0; i < s.values.length; i++) {
      const last = i === s.values.length - 1;
      const denom = last && s.count !== 0 ? s.count : s.trials;
      pts.push({ x: s.min + i, y: denom === 0 ? 0 : s.values[i] / denom });
    }
    return pts;
  }

  /** The applet's GetTotalAccumulation(): one overall average. */
  function totalAccumulation(s) {
    let sum = 0;
    for (const v of s.values) sum += v;
    const denom =
      s.count !== 0
        ? s.trials * (s.birds - s.min) + s.count
        : s.trials * (s.birds - s.min + 1);
    return denom === 0 ? 0 : sum / denom;
  }

  /** The applet's AddExtra(): Repeat() adds `extra` trials to each bird count. */
  function addExtra(s, extra) {
    extra = clamp(extra, TRIALS_STEP, TRIALS_MAX);
    s.startAt = s.trials;
    s.count = s.trials;
    s.trials += extra;
    s.birds = s.min;
    return s;
  }

  /**
   * Mirror one scrollbar of the panel (which also calls Reset()). Returns a
   * fresh state; changing Min past Max drags Max along, and vice versa.
   */
  function applyOption(s, which, value) {
    let trials = s.trials;
    let min = s.min;
    let max = s.max;
    if (which === "trials") {
      trials = clampTrials(value);
    } else if (which === "min") {
      min = clampBirds(value);
      if (min > max) max = min;
    } else if (which === "max") {
      max = clampBirds(value);
      if (max < min) min = max;
    }
    return create(trials, min, max);
  }

  return {
    TRIALS_MIN,
    TRIALS_MAX,
    TRIALS_STEP,
    TRIALS_DEFAULT,
    BIRDS_MIN,
    BIRDS_MAX,
    BIRDS_DEFAULT,
    clampTrials,
    clampBirds,
    perform,
    markedLength,
    create,
    reset,
    isFinished,
    newTrial,
    accumulation,
    totalAccumulation,
    addExtra,
    applyOption,
  };
})();
