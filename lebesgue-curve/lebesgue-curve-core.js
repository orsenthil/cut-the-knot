"use strict";

/*
 * LebesgueCurve, from Alexander Bogomolny's cut-the-knot applet LebesgueCurve.
 *
 * The applet draws a chain of line segments through the centres of the
 * subsquares of a grid, "top-down, left-right". A click runs Reset(): it
 * doubles the number of cells on a side and refines the polygonal
 * approximation; after the finest grid it wraps back to the first one.
 *
 * The key idea transcribed below is the applet's own one: it never stores a
 * grid. It builds three strings -- Str (a direction per segment) and kStr /
 * mStr (one decimal digit for each long jump between four diminished copies)
 * -- and walks Str, consuming a digit of kStr on '2' and of mStr on '3'.
 * That is the whole rule; there is no game state to win or lose.
 *
 * No document, no window, no storage. One global, LebesgueCurveCore, plain
 * data in and out, so the page can render it and the Node test can check it.
 */
const LebesgueCurveCore = (() => {
  // Java's int division truncates toward zero; all our operands are positive.
  const div = (a, b) => Math.trunc(a / b);

  /** init(): the fixed geometry for a square applet of `canvas` pixels. */
  function geometry(canvas) {
    let step = div(Math.min(canvas, canvas), 2);
    let absMaxStep = 1;
    while (div(step, 2) >= 2) {
      step = div(step, 2);
      absMaxStep++;
    }
    let span = 1;
    for (let i = 0; i < absMaxStep; i++) span <<= 1;
    const x0 = div(canvas - step * span, 2);
    const y0 = div(canvas - step * span, 2);
    let maxStep = absMaxStep;
    while (maxStep > 1) {
      maxStep--;
      step <<= 1;
    }
    return {
      canvas: canvas,
      absMaxStep: absMaxStep, // also the last order before the wrap
      startStep: step,        // m_StartStep: the step at order 1
      x0: x0,
      y0: y0,
      span: span,             // 2^absMaxStep
    };
  }

  const DEFAULT_CANVAS = 512;
  const FIXED = geometry(DEFAULT_CANVAS);

  /* The applet's StringBuffer builders, verbatim in their concatenations. */

  function combine(n) {
    if (n === 1) return "010";
    const s = combine(n - 1);
    return s + "2" + s + "3" + s + "2" + s;
  }

  function combineK(n) {
    if (n <= 1) return "";
    const s = combineK(n - 1);
    const q = String(n - 1);
    return s + q + s + s + q + s;
  }

  function combineM(n) {
    if (n <= 1) return "";
    const s = combineM(n - 1);
    const q = String(n);
    return s + q + s + s + q + s;
  }

  // The applet's leftovers: rotate/reverse of a direction string. The drawing
  // never calls them, but they are kept here so the transcription is complete.
  const charToInt = (c) => c.charCodeAt(0) - 48;
  const intToChar = (v) => String.fromCharCode(48 + ((v % 10) + 10) % 10);

  function rotate(n, s) {
    let out = s;
    for (let i = 0; i < s.length; i++) {
      const d = charToInt(out[i]);
      out = out.slice(0, i) + intToChar((d + n + 4) % 4) + out.slice(i + 1);
    }
    return out;
  }

  function reverse(n, s) {
    let out = s.split("").reverse().join("");
    for (let i = 0; i < s.length; i++) {
      const d = charToInt(out[i]);
      out = out.slice(0, i) + intToChar((d + n + 2 + 4) % 4) + out.slice(i + 1);
    }
    return out;
  }

  /** The starting position: order 1, the coarsest approximation. */
  function start(options) {
    const o = options || {};
    const canvas = o.canvas || DEFAULT_CANVAS;
    const g = geometry(canvas);
    return { canvas: canvas, order: 1, step: g.startStep };
  }

  /** Reset(): one click advances an order, and the last order wraps to one. */
  function next(state) {
    const g = geometry(state.canvas);
    let order = state.order + 1;
    let step = div(state.step, 2);
    if (step === 1) {
      step = g.startStep;
      order = 1;
    }
    return { canvas: state.canvas, order: order, step: step };
  }

  /** Jump straight to an order, as repeated clicks would. 1..absMaxStep. */
  function setOrder(state, order) {
    const g = geometry(state.canvas);
    const n = Math.max(1, Math.min(g.absMaxStep, Math.trunc(order) || 1));
    return { canvas: state.canvas, order: n, step: div(g.startStep, 2 ** (n - 1)) };
  }

  /** The strings the applet's drawLebesgueCurve walks for this position. */
  function drawing(state) {
    const n = state.order;
    return {
      str: combine(n),
      kStr: combineK(n),
      mStr: combineM(n),
      step: state.step,
      x0: geometry(state.canvas).x0,
      y0: geometry(state.canvas).y0,
    };
  }

  /**
   * drawLebesgueCurve(): the exact switch on Str. '2' takes the next kStr
   * digit (left by 2^k-1 steps, then down); '3' takes the next mStr digit
   * (right one, then up by 2^m-1 steps). Returns the points it joins.
   */
  function points(state) {
    const d = drawing(state);
    const step = d.step;
    let x = d.x0 + div(step, 2);
    let y = d.y0 + div(step, 2);
    const pts = [{ x: x, y: y }];
    let ki = 0;
    let mi = 0;
    for (let i = 0; i < d.str.length; i++) {
      const c = d.str[i];
      let nx = x;
      let ny = y;
      if (c === "0") {
        ny = y + step;
      } else if (c === "1") {
        nx = x + step;
        ny = y - step;
      } else if (c === "2") {
        const k = charToInt(d.kStr[ki++]);
        const e = 2 ** k - 1;
        nx = x - e * step;
        ny = y + step;
      } else if (c === "3") {
        const m = charToInt(d.mStr[mi++]);
        const f = 2 ** m - 1;
        nx = x + step;
        ny = y - f * step;
      }
      pts.push({ x: nx, y: ny });
      x = nx;
      y = ny;
    }
    return pts;
  }

  /** A short description for the status line and the saved position. */
  function describe(state) {
    const g = geometry(state.canvas);
    return {
      canvas: state.canvas,
      order: state.order,
      step: state.step,
      cellsPerSide: 2 ** state.order,
      cells: 4 ** state.order,
      segments: 4 ** state.order - 1,
      maxOrder: g.absMaxStep,
    };
  }

  return {
    start: start,
    next: next,
    setOrder: setOrder,
    points: points,
    drawing: drawing,
    geometry: geometry,
    describe: describe,
    combine: combine,
    combineK: combineK,
    combineM: combineM,
    rotate: rotate,
    reverse: reverse,
    charToInt: charToInt,
    intToChar: intToChar,
    DEFAULT_CANVAS: DEFAULT_CANVAS,
    MAX_ORDER: FIXED.absMaxStep,
  };
})();
