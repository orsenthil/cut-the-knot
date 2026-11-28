"use strict";

/*
 * Integer Sine, from Alexander Bogomolny's applet IntegerSine.
 *
 * The applet puts one dot for each integer n = 0, 1, ... N-1. With "Modulo
 * 2*Pi" ticked the dot's horizontal place is n reduced modulo 2PI and its
 * height is sin(n) (or tan(n)); with the box unticked the dots keep the order
 * of the integers. The key fact is that 2PI is irrational: no residue repeats,
 * but the near-repeats make stripes. This file is a direct transcription of
 * IntegerSineCanvas.Draw: Java's (int) casts truncate toward zero, and the two
 * branches use different clipping rules. Nothing here touches the DOM.
 */
const IntegerSineCore = (() => {
  // The applet's own constants: IntegerSinePanel's eleven radio buttons, the
  // canvas fields N=10, A=1, Modular=true, Sin=true, and its 2PI literal.
  const SCALES = [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];
  const TWO_PI = 6.283185307179586;
  const DEFAULTS = { N: 10, modular: true, sin: true, width: 400, height: 300 };

  /** Java's d2i on the (small enough) values this drawing produces. */
  const t2i = (d) => Math.trunc(d);

  /** The Java applet computes n - (int)(n / 2PI) * 2PI, not a fmod call. */
  function residue(n) {
    return n - t2i(n / TWO_PI) * TWO_PI;
  }

  function normalize(options) {
    const o = options || {};
    const n = Number(o.N);
    const w = t2i(Number(o.width));
    const h = t2i(Number(o.height));
    return {
      N: SCALES.includes(n) ? n : DEFAULTS.N,
      modular: o.modular === undefined ? DEFAULTS.modular : Boolean(o.modular),
      sin: o.sin === undefined ? DEFAULTS.sin : Boolean(o.sin),
      width: Number.isFinite(w) && w > 0 ? w : DEFAULTS.width,
      height: Number.isFinite(h) && h > 0 ? h : DEFAULTS.height,
    };
  }

  /** The position a new picture starts from; `sample` is the inspected dot. */
  function start(options) {
    return Object.assign(normalize(options), { sample: 0 });
  }

  /** Change one option, keeping the inspected dot within the picture. */
  function setOptions(state, patch) {
    const next = normalize(Object.assign({}, state, patch));
    const points = shownPoints(next);
    const wanted = Number(state.sample) || 0;
    const sample = points.length ? points[nearestShownIndex(points, wanted)].i : 0;
    return Object.assign(next, { sample: sample });
  }

  /*
   * IntegerSineCanvas.Draw, instruction by instruction. A return value of
   * shown:false is a dot the applet computes but does not draw. x and y are
   * the ints handed to drawOval(x-1, y-1, 1, 1) - the UI offsets by half a
   * pixel to put the dot's centre there. A (the loop step) is always 1: the
   * panel never offers it as an option.
   */
  function draw(state) {
    const o = normalize(state);
    const cx = t2i(o.width / 2);
    const cy = t2i(o.height / 2);
    const out = [];
    if (o.modular) {
      for (let i = 0; i < o.N; i += 1) {
        const r = i - t2i(i / TWO_PI) * TWO_PI;
        const x = t2i((r / TWO_PI) * o.width);
        const value = o.sin ? -Math.sin(r) : -Math.tan(r);
        const y = t2i(value * cy + cy);
        out.push({ i: i, x: x, y: y, shown: y >= 0 && y <= o.height });
      }
    } else {
      for (let i = 0; i < o.N; i += 1) {
        const x = t2i((i / o.N) * cx * 2.0);
        const value = o.sin ? Math.sin(i) : Math.tan(i) / 4.0;
        const y = t2i(-value * cy + cy);
        out.push({ i: i, x: x, y: y, shown: value > -2.0 && value < 2.0 });
      }
    }
    return out;
  }

  /** Only the dots that the applet actually draws, in loop order. */
  function shownPoints(state) {
    return draw(state).filter((p) => p.shown);
  }

  /** Index into shownPoints of the dot nearest a horizontal board position. */
  function nearestSample(state, x) {
    const points = shownPoints(state);
    if (!points.length) return 0;
    let best = 0;
    for (let j = 1; j < points.length; j++) {
      if (Math.abs(points[j].x - x) < Math.abs(points[best].x - x)) best = j;
    }
    return best;
  }

  /** Move the inspected dot by n integers, skipping dots that were clipped. */
  function stepSample(state, delta) {
    const points = shownPoints(state);
    if (!points.length) return Object.assign({}, state, { sample: 0 });
    const current = nearestShownIndex(points, Number(state.sample) || 0);
    const j = Math.max(0, Math.min(points.length - 1, current + delta));
    return Object.assign({}, state, { sample: points[j].i });
  }

  function nearestShownIndex(points, i) {
    let best = 0;
    for (let j = 1; j < points.length; j++) {
      if (Math.abs(points[j].i - i) < Math.abs(points[best].i - i)) best = j;
    }
    return best;
  }

  /** The status line: this is a picture with no winner and no losing move. */
  function describe(state) {
    const points = shownPoints(state);
    const picked = points.find((p) => p.i === state.sample) || points[0] || { i: 0 };
    const fn = state.sin ? "sin" : "tan";
    const arg = state.modular ? residue(picked.i) : picked.i;
    const value = state.sin ? Math.sin(arg) : Math.tan(arg) / (state.modular ? 1 : 4);
    return `${fn}(${arg.toFixed(3)}) = ${value.toFixed(3)}; dot ${picked.i} of ${state.N - 1}, ` +
      `${points.length} dots on screen, ${state.modular ? "modulo 2\u03c0" : "plain order"}.`;
  }

  return {
    SCALES: SCALES,
    TWO_PI: TWO_PI,
    DEFAULTS: DEFAULTS,
    residue: residue,
    start: start,
    setOptions: setOptions,
    draw: draw,
    shownPoints: shownPoints,
    nearestSample: nearestSample,
    stepSample: stepSample,
    describe: describe,
  };
})();
