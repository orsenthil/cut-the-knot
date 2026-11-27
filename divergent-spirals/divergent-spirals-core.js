"use strict";

/*
 * Divergent Spirals — the picture, as pure data.
 *
 * Alexander Bogomolny's applet draws no spiral at all: it draws a stack of
 * circular arcs. Ring k has radius k, starts at the angle k*Opening (modulo a
 * full turn) and covers Overlap*Opening degrees. The whole stack is then
 * rotated a little after every tick. The eye joins the overlapping arcs into
 * two spirals; the direction of the turn changes which way they seem to wind.
 *
 * Every number here is transcribed from DivergentSpiralsCanvas: the fields in
 * its constructor, Reset(), DrawTop() and run(). This file has no DOM, no
 * window and no storage; it defines one global so a plain <script> loads it
 * and porting/check-divergent-spirals.mjs can load it in Node as well.
 */

const DivergentSpiralsCore = (() => {
  /* Constructor fields of DivergentSpiralsCanvas. */
  const N = 4;                 // field N: rings share one snap-together group
  const W = 1;                 // field W: concentric arcs per ring (the applet
                               // has WSpin/WEdit handlers but no such controls)
  const MARGIN = 20;           // DrawTop's local variable d
  const CANVAS = Object.freeze({ width: 640, height: 400 });

  // SetSpin(panel, OSpin, OEdit, 10, 90, 45, 5, 2) and
  // SetSpin(panel, VSpin, VEdit, 1, 11, 4, 1, 1).
  const OPENING = Object.freeze({ min: 10, max: 90, step: 5, initial: 45 });
  const OVERLAP = Object.freeze({ min: 1, max: 11, step: 1, initial: 4 });

  const truncDiv = (a, b) => Math.trunc(a / b);          // Java's int division
  const javaRound = (v) => Math.floor(v + 0.5);          // Math.round(double)

  /** PVNumeric's integer editing: snap to the spin control's min/step/max. */
  function clampOption(value, range) {
    const n = Number(value);
    if (!Number.isFinite(n)) return range.initial;
    const limited = Math.max(range.min, Math.min(range.max, Math.round(n)));
    return range.min + Math.round((limited - range.min) / range.step) * range.step;
  }

  /** The position a new applet starts from (nothing running yet). */
  function start(options) {
    const s = {
      angle: 0,          // Angle
      clockwise: true,   // Clockwise
      fast: false,       // Fast (the Slow checkbox starts selected)
      running: false,    // Running
      opening: OPENING.initial,  // Opening
      overlap: OVERLAP.initial,  // Overlap
      width: CANVAS.width,
      height: CANVAS.height,
      N: N,
      W: W,
    };
    return setOptions(s, options);
  }

  /** A new position with some fields replaced; the input is never changed. */
  function setOptions(state, options) {
    const s = Object.assign({}, state);
    if (!options) return s;
    if ("angle" in options) s.angle = Number.isFinite(Number(options.angle)) ? Number(options.angle) : 0;
    if ("clockwise" in options) s.clockwise = Boolean(options.clockwise);
    if ("fast" in options) s.fast = Boolean(options.fast);
    if ("running" in options) s.running = Boolean(options.running);
    if ("width" in options) s.width = Number.isFinite(Number(options.width)) ? Math.max(1, Number(options.width)) : CANVAS.width;
    if ("height" in options) s.height = Number.isFinite(Number(options.height)) ? Math.max(1, Number(options.height)) : CANVAS.height;
    if ("opening" in options) s.opening = clampOption(options.opening, OPENING);
    if ("overlap" in options) s.overlap = clampOption(options.overlap, OVERLAP);
    return s;
  }

  /** Reset(): round(min(width,height)/2 - 20), then snap down to 4*(N+1). */
  function snappedRadius(width, height, n) {
    const rings = n === undefined ? N : n;
    const r = javaRound(Math.min(width, height) / 2 - MARGIN);
    return truncDiv(truncDiv(r, rings + 1), 4) * (rings + 1) * 4;
  }
  const radius = (state) => snappedRadius(state.width, state.height, state.N);

  /**
   * DrawTop's increment: 360/Opening, then R/step, then /(N+1), all with Java
   * integer division. Zero means the original loop would never finish; the
   * page's applet is only used at sizes where that cannot happen.
   */
  function ringStep(r, opening, n) {
    const rings = n === undefined ? N : n;
    const step = truncDiv(360, opening);
    if (step === 0) return 0;
    return truncDiv(truncDiv(r, step), rings + 1);
  }

  /**
   * Every arc the applet draws, in the order DrawTop() draws it. Each entry
   * is { radius, start, sweep } in degrees, before the rotation by Angle.
   */
  function arcs(state) {
    const inc = ringStep(radius(state), state.opening, state.N);
    const limit = truncDiv(state.height, 2) - MARGIN;
    const sweep = state.overlap * state.opening;
    const out = [];
    if (inc <= 0) return out; // faithful for every usable size; avoids the applet's hang
    let phi = 0;
    for (let k = inc; k < limit; k += inc) {
      for (let w = 0; w < state.W; w++) {
        out.push({ radius: k + w, start: phi, sweep: sweep });
      }
      phi += state.opening;
    }
    return out;
  }

  /** run(): one tick adds (clockwise) or subtracts pi/(fast ? 9 : 17). */
  const angleStep = (fast) => Math.PI / (fast ? 9 : 17);
  const period = (fast) => (fast ? 10 : 20);            // itemStateChanged
  const angularSpeed = (fast) => angleStep(fast) / period(fast);

  function advance(state, frames) {
    const n = frames === undefined ? 1 : frames;
    const delta = angleStep(state.fast) * (state.clockwise ? 1 : -1);
    let angle = state.angle;
    for (let i = 0; i < n; i++) angle += delta;
    return Object.assign({}, state, { angle: angle });
  }

  /** Plain data for the player's record and the tutor. */
  function position(state) {
    return {
      angle: state.angle,
      clockwise: state.clockwise,
      fast: state.fast,
      running: state.running,
      opening: state.opening,
      overlap: state.overlap,
      center: { x: truncDiv(state.width, 2), y: truncDiv(state.height, 2) },
      radius: radius(state),
      rings: arcs(state).length,
    };
  }

  return {
    N: N, W: W, MARGIN: MARGIN, CANVAS: CANVAS,
    OPENING: OPENING, OVERLAP: OVERLAP,
    start: start, setOptions: setOptions, advance: advance,
    snappedRadius: snappedRadius, radius: radius, ringStep: ringStep, arcs: arcs,
    angleStep: angleStep, period: period, angularSpeed: angularSpeed,
    position: position,
  };
})();
