"use strict";

/*
 * Four AB, from Alexander Bogomolny's applet FourAB.
 *
 * P = (a, b) sits in the first quadrant and a circle of radius r is drawn
 * about it. S1, S2, S3, S4 are the areas of the circle inside the four
 * quadrants. The puzzle asks for S1 - S2 + S3 - S4; the answer is 4ab when
 * r >= sqrt(a*a + b*b). The code relies on two facts: the alternating sum
 * is the integral of sign(x)sign(y) over the disk, and integrating across
 * each horizontal chord turns that into 4 times the integral of
 * min(a, sqrt(r*r - t*t)) from t = 0 to t = b.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, FourAbCore, so the page loads it with a
 * plain <script> and porting/check-four-ab.mjs loads it in Node. Every
 * function takes plain data and returns new plain data.
 */
const FourAbCore = (() => {
  // FourABCanvas.init: a = w/6, b = h/8, step = sqrt(a*a+b*b) + min(a,b)/10
  // with Java integer division in the two quotients. m_R = 2*step.
  const SLIDER_START = 50;
  // FourABPanel's JScrollBar is (horizontal, 50, 5, 0, 105): its value can
  // only reach maximum - extent = 100, so the slider is 0..100 in practice.
  const SLIDER_MAX = 100;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** The position the Java canvas starts from, for a canvas of width x height. */
  function initial(width, height) {
    const w = Number(width) || 640;
    const h = Number(height) || 412;
    const a = Math.floor(w / 6);
    const b = Math.floor(h / 8);
    const step = Math.sqrt(a * a + b * b) + Math.floor(Math.min(a, b) / 10);
    const full = 2 * step;
    return {
      width: w,
      height: h,
      a: a,
      b: b,
      step: step,
      full: full,
      slider: SLIDER_START,
      radius: (full * SLIDER_START) / 100,
      showExtra: false,
    };
  }

  /** FourABCanvas.AdjustRadius: radius = m_R * value / 100. */
  function withSlider(state, value) {
    const slider = clamp(Math.round(Number(value)), 0, SLIDER_MAX);
    return Object.assign({}, state, {
      slider: slider,
      radius: (state.full * slider) / 100,
    });
  }

  /** Dragging the circle moves its centre; keep P in the first quadrant. */
  function withCenter(state, a, b) {
    return Object.assign({}, state, {
      a: clamp(Number(a), 0, state.width),
      b: clamp(Number(b), 0, state.height),
    });
  }

  /** FourABPanel.itemStateChanged: the "Show extra" check box. */
  function withExtra(state, on) {
    return Object.assign({}, state, { showExtra: !!on });
  }

  /** FourABCanvas.Compute: the two extra lines are x = 2a and y = 2b. */
  function extraLines(state) {
    return { x: 2 * state.a, y: 2 * state.b };
  }

  /** The hypothesis of the problem: r >= sqrt(a*a + b*b). */
  function threshold(state) {
    return Math.hypot(state.a, state.b);
  }

  /** An antiderivative of sqrt(r*r - (x-a)*(x-a)) on the disk. */
  function chordPrimitive(x, a, r) {
    const u = clamp((x - a) / r, -1, 1);
    return 0.5 * ((x - a) * Math.sqrt(Math.max(0, r * r - (x - a) * (x - a))) +
      r * r * Math.asin(u));
  }

  /*
   * Integrate the length of the part of a vertical chord above (upper=true)
   * or below (upper=false) the x-axis, from x0 to x1. For b >= 0 a chord of
   * half-height h contributes 2h above the axis when h <= b; where h > b it
   * contributes b+h above and h-b below. The chord switches at |x-a| = tb.
   */
  function band(x0, x1, a, b, r, upper) {
    const lo = Math.max(x0, a - r);
    const hi = Math.min(x1, a + r);
    if (hi <= lo) return 0;
    const tb = r > b ? Math.sqrt(r * r - b * b) : 0;
    const cuts = [lo, hi];
    for (const c of [a - tb, a + tb]) {
      if (c > lo && c < hi) cuts.push(c);
    }
    cuts.sort((p, q) => p - q);
    let total = 0;
    for (let i = 1; i < cuts.length; i++) {
      const left = cuts[i - 1];
      const right = cuts[i];
      const half = chordPrimitive(right, a, r) - chordPrimitive(left, a, r);
      if (Math.abs((left + right) / 2 - a) < tb) {
        const flat = b * (right - left);
        total += upper ? flat + half : half - flat;
      } else {
        total += upper ? 2 * half : 0;
      }
    }
    return total;
  }

  /** The four quadrant areas S1, S2, S3, S4 (quadrant numbers as on the page). */
  function quadrantAreas(a, b, r) {
    if (!(r > 0)) return [0, 0, 0, 0];
    const a0 = Number(a);
    const b0 = Math.max(0, Number(b));
    const left = a0 - r;
    const right = a0 + r;
    return [
      band(Math.max(0, left), Math.max(0, right), a0, b0, r, true),
      band(left, Math.min(0, right), a0, b0, r, true),
      band(left, Math.min(0, right), a0, b0, r, false),
      band(Math.max(0, left), Math.max(0, right), a0, b0, r, false),
    ];
  }

  /*
   * S1 - S2 + S3 - S4 in closed form. Writing u = x-a and v = y-b, each
   * horizontal chord of the disk contributes
   *   2 * min(a, sqrt(r*r - v*v)) * sign(v+b),
   * so the sum is 4 times the integral of min(a, sqrt(r*r-t*t)) from 0 to b.
   * Put t0 = sqrt(r*r-a*a): the integrand is a below t0 and the circle's
   * half-height above it, which gives the antiderivative used below.
   */
  function signedArea(a, b, r) {
    if (!(r > 0)) return 0;
    const a0 = Number(a);
    const t = r > a0 ? Math.sqrt(r * r - a0 * a0) : 0;
    const bb = clamp(Number(b), 0, r);
    if (bb <= t) return 4 * a0 * bb;
    return 2 * a0 * t + 2 * bb * Math.sqrt(Math.max(0, r * r - bb * bb)) +
      2 * r * r * (Math.asin(bb / r) - Math.asin(t / r));
  }

  /** Plain, storable data for the player's record and the tutor. */
  function position(state) {
    return {
      a: state.a,
      b: state.b,
      radius: state.radius,
      slider: state.slider,
      showExtra: state.showExtra,
      signedArea: signedArea(state.a, state.b, state.radius),
    };
  }

  return {
    initial: initial,
    withSlider: withSlider,
    withCenter: withCenter,
    withExtra: withExtra,
    extraLines: extraLines,
    threshold: threshold,
    quadrantAreas: quadrantAreas,
    signedArea: signedArea,
    position: position,
    SLIDER_MAX: SLIDER_MAX,
    SLIDER_START: SLIDER_START,
  };
})();
