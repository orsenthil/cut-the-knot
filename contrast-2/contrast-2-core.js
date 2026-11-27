"use strict";

/*
 * Contrast 2, from Alexander Bogomolny's applet Contrast2 (cut-the-knot.org).
 *
 * The picture is White's illusion in its original, horizontal form: six
 * alternating dark/light bands run across the canvas. Six small gray
 * rectangles sit on them — three in a left column on the dark bands, three in
 * a right column on the light bands. Every gray rectangle is painted with the
 * very same color; the eye nevertheless sees two different shades.
 *
 * Key idea: the invariant is the single gray value. One call to SetGrayColor
 * sets MinColor, MaxColor and GrayColor, and Draw fills every patch with
 * GrayColor. The page says the patches are of the same shade and that the
 * illusion survives when the bands are turned upright; both are claims about
 * what the eye does, not about different pixels. Contrast4 is that upright
 * sibling: it swaps the width and height of the six bands and of the six
 * patches. This file keeps the horizontal arrangement of Contrast2.
 *
 * Everything here is plain data: no document, no window, no storage. The only
 * global is Contrast2Core, and functions never mutate what they are given.
 */
const Contrast2Core = (() => {
  /* Contrast2Canvas: n = 6; Contrast2Panel: five horizontal scrollbars. */
  const N = 6;
  const MARGIN = 20; // Draw's local `20` inset
  const DEFAULT_WIDTH = 400; // getParameterInfo: "WIDTH (400 will do)"
  const DEFAULT_HEIGHT = 300; // getParameterInfo: "HEIGHT (300 will do)"

  /* new Scrollbar(HORIZONTAL, value, visible, minimum, maximum) in Panel.init */
  const LIMITS = Object.freeze({
    W: [0, 105],
    H: [40, 105],
    gray: [0, 105],
    min: [0, 105],
    max: [0, 105],
  });
  const DEFAULTS = Object.freeze({ W: 50, H: 50, gray: 50, min: 0, max: 100 });

  function clampSetting(key, value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULTS[key];
    const [lo, hi] = LIMITS[key];
    return Math.max(lo, Math.min(hi, Math.round(num)));
  }

  function positiveSize(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
  }

  /** The position a new picture starts from, in the applet's own units. */
  function start(options = {}) {
    const o = options || {};
    return {
      width: positiveSize(o.width, DEFAULT_WIDTH),
      height: positiveSize(o.height, DEFAULT_HEIGHT),
      W: clampSetting("W", o.W === undefined ? DEFAULTS.W : o.W),
      H: clampSetting("H", o.H === undefined ? DEFAULTS.H : o.H),
      gray: clampSetting("gray", o.gray === undefined ? DEFAULTS.gray : o.gray),
      min: clampSetting("min", o.min === undefined ? DEFAULTS.min : o.min),
      max: clampSetting("max", o.max === undefined ? DEFAULTS.max : o.max),
    };
  }

  /** One scrollbar moved; the other settings (and the canvas size) stay put. */
  function withSetting(state, key, value) {
    if (!(key in LIMITS)) return { ...state };
    return { ...state, [key]: clampSetting(key, value) };
  }

  /** Back to the scrollbar values the applet starts with. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /*
   * java.awt.Color(float, float, float) computes (int)(v * 255.0f + 0.5f)
   * in 32-bit float arithmetic. Doing the same fround at each step matters:
   * 70% and 90% come out as 179 and 230, not 178 and 229.
   *
   * Deviation, on purpose: the scrollbars reach 105, but Java's Color(float)
   * throws when a component is above 1.0, so the original stops repainting.
   * We cap the shade at 100% (white) to keep the illustration responsive, and
   * report the overflow so the status line can say what happened.
   */
  function shadeByte(value) {
    const num = Number(value);
    const level = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
    const f = Math.fround(level / 100);
    const scaled = Math.fround(f * Math.fround(255));
    return Math.floor(Math.fround(scaled + Math.fround(0.5)));
  }

  function overflow(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 100;
  }

  /** The four corners of an axis-aligned rectangle, for Geom.polygon. */
  function corners(rect) {
    const { x, y, width, height } = rect;
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  /*
   * A literal transcription of Contrast2Canvas.Draw:
   *   n = 6; h = round(size.height * 2 / 3 * H / 100 / n);
   *   top = (size.height - n*h) / 2;  span = size.width - 2*20;
   *   rw = round(span / 2.5 * W / 100 / 2);
   *   c1 = 20 + span/3;  c2 = 20 + span - span/3;   (integer division)
   * For i = 0, 2, 4 it fills a MinColor band then a MaxColor band, and then
   * fills a patch at (c1-rw, top+i*h) and one at (c2-rw, top+(i+1)*h).
   */
  function analyze(state) {
    const height = state.height;
    const width = state.width;
    const bandHeight = Math.round(((height * 2) / 3) * (state.H / 100) / N);
    const blockHeight = bandHeight * N;
    const top = Math.trunc((height - blockHeight) / 2);
    const left = MARGIN;
    const span = width - 2 * MARGIN;
    const halfPatch = Math.round((span / 2.5) * (state.W / 100) / 2);
    const columnLeft = left + Math.trunc(span / 3);
    const columnRight = left + span - Math.trunc(span / 3);

    const shades = {
      min: shadeByte(state.min),
      max: shadeByte(state.max),
      gray: shadeByte(state.gray),
    };

    const bands = [];
    for (let i = 0; i < N; i += 2) {
      for (let k = 0; k < 2; k++) {
        const row = i + k;
        bands.push({
          index: row,
          x: left,
          y: top + row * bandHeight,
          width: span,
          height: bandHeight,
          band: k === 0 ? "min" : "max",
          shadeByte: k === 0 ? shades.min : shades.max,
        });
      }
    }

    const patches = [];
    for (let i = 0; i < N; i += 2) {
      patches.push({
        index: i,
        band: i,
        column: "left",
        x: columnLeft - halfPatch,
        y: top + i * bandHeight,
        width: 2 * halfPatch,
        height: bandHeight,
        shadeByte: shades.gray,
      });
      patches.push({
        index: i + 1,
        band: i + 1,
        column: "right",
        x: columnRight - halfPatch,
        y: top + (i + 1) * bandHeight,
        width: 2 * halfPatch,
        height: bandHeight,
        shadeByte: shades.gray,
      });
    }

    return {
      settings: {
        width, height, W: state.W, H: state.H,
        gray: state.gray, min: state.min, max: state.max,
      },
      bandHeight,
      top,
      blockHeight,
      span,
      left,
      halfPatch,
      columnLeft,
      columnRight,
      shades,
      outOfRange: {
        gray: overflow(state.gray),
        min: overflow(state.min),
        max: overflow(state.max),
      },
      bands,
      patches,
    };
  }

  /** A demo has no win, loss or finishing move. */
  function result() {
    return null;
  }

  return {
    N, MARGIN, DEFAULT_WIDTH, DEFAULT_HEIGHT, LIMITS, DEFAULTS,
    start, withSetting, reset, shadeByte, analyze, corners, result,
  };
})();
