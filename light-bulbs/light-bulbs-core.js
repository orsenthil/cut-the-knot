"use strict";

/*
 * Light Bulbs — the simulation in Alexander Bogomolny's LightBulbs applet.
 *
 * The applet puts n bulbs on a ring, all lit, and moves a pointer around them.
 * At a step the visitor standing at the green pointer flips the bulb d places
 * ahead (the blue pointer) if and only if the bulb at his own place is lit;
 * then the pointer jumps k + 1 places, where k is the "Skip" control. All
 * indices wrap modulo n. There is no winning move: it is a deterministic
 * machine, so the key idea is that its future is fixed by (on[], position)
 * and must eventually repeat.
 *
 * The page linked to this applet is the article "100 Prisoners and a Light
 * Bulb"; its actuarial claims are also exposed here as pure functions so the
 * logic test can check them. The article does not embed the applet.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, LightBulbsCore, so the page loads it with
 * a plain <script> and porting/check-light-bulbs.mjs loads it in Node. The
 * position is plain data, and every function returns a new position.
 */
const LightBulbsCore = (() => {
  // The applet's spin controls: (minimum, maximum, displayed starting value).
  const LIMITS = Object.freeze({
    bulbs: [2, 100, 15],       // "#Bulbs": PVSpinPlus(2, 100, 15)
    lookAhead: [1, 1000, 1],   // "Look ahead": PVSpinPlus(1, 1000, 1)
    skip: [0, 50, 0],          // "Skip" ... " bulbs": PVSpinPlus(0, 50, 0)
    steps: [1, 30000, 15],     // "Perform ... steps": PVSpinPlus(1, 30000, 15)
  });
  const R = 50;                // the canvas's circle radius, in its own units

  /** Clamp to an integer in [lo, hi], with the applet's default as fallback. */
  function clampInt(v, lo, hi, fallback) {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.max(lo, Math.min(hi, Math.trunc(x)));
  }

  /** Applet Reset(): Ro = min((int)(pi*R/(n+2)), R/10). */
  function bulbRadius(n, radius) {
    const r = radius === undefined ? R : radius;
    return Math.min(Math.trunc((Math.PI * r) / (n + 2)), Math.trunc(r / 10));
  }

  /** The Fast checkbox sets the thread's sleep time to 100 or 1000 ms. */
  function interval(fast) {
    return fast ? 100 : 1000;
  }

  function options(input) {
    const o = input || {};
    return {
      bulbs: clampInt(o.bulbs, LIMITS.bulbs[0], LIMITS.bulbs[1], LIMITS.bulbs[2]),
      lookAhead: clampInt(o.lookAhead, LIMITS.lookAhead[0], LIMITS.lookAhead[1], LIMITS.lookAhead[2]),
      skip: clampInt(o.skip, LIMITS.skip[0], LIMITS.skip[1], LIMITS.skip[2]),
      steps: clampInt(o.steps, LIMITS.steps[0], LIMITS.steps[1], LIMITS.steps[2]),
    };
  }

  /** The position a new game starts from: every bulb lit, pointer at bulb 0. */
  function start(input) {
    const p = options(input);
    return {
      bulbs: p.bulbs,
      lookAhead: p.lookAhead,
      skip: p.skip,
      steps: p.steps,
      position: 0,
      on: new Array(p.bulbs).fill(true),
      stepsDone: 0,
      remaining: p.steps,
    };
  }

  /** Any change to an option calls Reset() in LightBulbsPanel.actionPerformed. */
  function reset(state) {
    return start(state);
  }

  function withOptions(state, changes) {
    return start(Object.assign({}, state, changes));
  }

  function wrap(i, n) {
    return ((i % n) + n) % n;
  }

  /** Inspection-only helpers for the two draggable pointers. */
  function setPosition(state, index) {
    return Object.assign({}, state, { position: wrap(index, state.bulbs) });
  }

  function setLookAhead(state, distance) {
    return Object.assign({}, state, {
      lookAhead: clampInt(distance, LIMITS.lookAhead[0], LIMITS.lookAhead[1], LIMITS.lookAhead[2]),
    });
  }

  /** The blue arrow: (CurrentPosition + NDiff) % NBulbs. */
  function nextIndex(state) {
    return wrap(state.position + state.lookAhead, state.bulbs);
  }

  /** The pointer jump: NCheck is the Skip control plus one. */
  function nCheck(state) {
    return state.skip + 1;
  }

  /*
   * OneStep(), transcribed literally:
   *   StepsToGo--;
   *   tmp = (CurrentPosition + NDiff) % NBulbs;
   *   if (OnOff[CurrentPosition] != 0) OnOff[tmp] = !OnOff[tmp];
   *   CurrentPosition = (CurrentPosition + NCheck) % NBulbs;
   *   NSteps++;
   * StepsToGo is allowed to go below zero here; the UI simply stops calling.
   */
  function oneStep(state) {
    const n = state.bulbs;
    const tmp = wrap(state.position + state.lookAhead, n);
    const on = state.on.slice();
    if (on[state.position]) on[tmp] = !on[tmp];
    return Object.assign({}, state, {
      on: on,
      position: wrap(state.position + nCheck(state), n),
      stepsDone: state.stepsDone + 1,
      remaining: state.remaining - 1,
    });
  }

  /** The only move the applet offers is another step of the machine. */
  function legalMoves() {
    return ["step"];
  }

  function move(state, m) {
    return m === "step" ? oneStep(state) : null;
  }

  /** Exactly k steps: used to fast-forward a large "Perform" batch. */
  function run(state, count) {
    let s = state;
    const k = clampInt(count, 0, LIMITS.steps[1], 0);
    for (let i = 0; i < k; i++) s = oneStep(s);
    return s;
  }

  /** Nothing is won or lost; the batch of steps simply finishes. */
  function result(state) {
    return state.remaining <= 0 ? "done" : null;
  }

  /* ------------------------- the claims on the linked article (pure maths) */

  /** a(n) = sum_{c=2}^n 1/c^2; E(T) = n^2 - n/(n-1) - a(n), as printed. */
  function expectedTime(n) {
    let a = 0;
    for (let c = 2; c <= n; c++) a += 1 / (c * c);
    return n * n - n / (n - 1) - a;
  }

  /** The value printed for n=100 is obtained if that sum is multiplied by n. */
  function expectedTimeScaled(n) {
    let a = 0;
    for (let c = 2; c <= n; c++) a += 1 / (c * c);
    return n * n - n / (n - 1) - n * a;
  }

  /*
   * P(c,d) = P(c-1,d-1)(1-(c-1)/n) + P(c,d-1)(c/n), with P(1,1)=1 and
   * P(1,0)=0. This is the article's recursion for the chance that the
   * counter has reached c by day d.
   */
  function completionProbability(n, days) {
    if (days < 1) return 0;
    const p = new Array(n + 1).fill(0);
    p[1] = 1;
    for (let d = 2; d <= days; d++) {
      const q = new Array(n + 1).fill(0);
      for (let c = 1; c <= n; c++) {
        q[c] = p[c - 1] * (1 - (c - 1) / n) + p[c] * (c / n);
      }
      for (let c = 1; c <= n; c++) p[c] = q[c];
    }
    return p[n];
  }

  return {
    LIMITS, R, clampInt, bulbRadius, interval,
    options, start, reset, withOptions, wrap,
    setPosition, setLookAhead, nextIndex, nCheck,
    oneStep, legalMoves, move, run, result,
    expectedTime, expectedTimeScaled, completionProbability,
  };
})();
