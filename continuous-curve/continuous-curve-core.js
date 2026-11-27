"use strict";

/*
 * Continuous Line Illusion, from Alexander Bogomolny's applet ContinuousCurve.
 *
 * The applet draws one unbroken path with a "pen" that never lifts. Its four
 * directions repeat down, right, up, left; after the first lap the side length
 * shrinks by `spread` on the second and fourth legs of every lap. What the eye
 * reads as embedded squares is therefore a single polyline whose corners creep
 * inward by exactly `spread` each lap.
 *
 * This is a strict transcription of ContinuousCurveCanvas.Draw: side =
 * min(width, height) - 15 - 2*Margin, the centre uses integer division by 2,
 * `d` is mutated before a leg is drawn, and a leg is skipped once d < 0.
 *
 * No document, no window, no storage: one global, ContinuousCurveCore. The
 * position is plain data, so the page can hand it to Track and the tutor.
 */
const ContinuousCurveCore = (() => {
  const MIN_MARGIN = 0, MAX_MARGIN = 100;      // Scrollbar(0, 20, 5, 0, 100)
  const MIN_SPREAD = 2, MAX_SPREAD = 34;       // Scrollbar(0, 5, 4, 2, 34)
  const MIN_LEGS = 4, MAX_LEGS = 100;          // Scrollbar(0, 26, 5, 4, 100)
  const WIDTH = 400, HEIGHT = 400;             // this port's SVG viewBox

  const RANGES = {
    margin: [MIN_MARGIN, MAX_MARGIN, 20],
    spread: [MIN_SPREAD, MAX_SPREAD, 5],
    legs: [MIN_LEGS, MAX_LEGS, 26],
  };

  function clampOption(name, value) {
    const range = RANGES[name];
    if (!range) return null;
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(range[0], Math.min(range[1], n)) : range[2];
  }

  /** The applet's first picture, with the three scrollbars at their initial values. */
  function start(options) {
    const o = options || {};
    return {
      margin: clampOption("margin", o.margin === undefined ? 20 : o.margin),
      spread: clampOption("spread", o.spread === undefined ? 5 : o.spread),
      legs: clampOption("legs", o.legs === undefined ? 26 : o.legs),
      width: Number.isFinite(Number(o.width)) && Number(o.width) > 0 ? Math.trunc(Number(o.width)) : WIDTH,
      height: Number.isFinite(Number(o.height)) && Number(o.height) > 0 ? Math.trunc(Number(o.height)) : HEIGHT,
      trace: 0,
    };
  }

  function setOption(state, name, value) {
    if (!(name in RANGES)) return state;
    return { ...state, [name]: clampOption(name, value), trace: 0 };
  }

  /**
   * ContinuousCurveCanvas.Draw, line for line. `sides[i]` is the mutated `d`
   * that the applet uses for leg i, and `vertices` has one more point than the
   * number of legs actually drawn.
   */
  function geometry(state) {
    const w = state.width, h = state.height;
    const side0 = Math.min(w, h) - 15 - 2 * state.margin;
    let d = side0;
    // Java's int division truncates toward zero; both operands are >= 0 here.
    const cx = Math.trunc((w - d) / 2);
    const cy = Math.trunc((h - d) / 2);
    let x = cx, y = cy;
    const vertices = [{ x: cx, y: cy }];
    const sides = [];

    for (let i = 0; i < state.legs; i++) {
      let nx = x, ny = y;
      switch (i % 4) {
        case 0:
          ny = y + d;
          break;
        case 1:
          if (i !== 1) d = d - state.spread;
          nx = x + d;
          break;
        case 2:
          ny = y - d;
          break;
        case 3:
          d = d - state.spread;
          nx = x - d;
          break;
      }
      if (d < 0) break;
      vertices.push({ x: nx, y: ny });
      sides.push(d);
      x = nx;
      y = ny;
    }
    return { side0, center: { x: cx, y: cy }, vertices, sides, drawn: sides.length, stoppedEarly: sides.length < state.legs };
  }

  /** Keep the tracing dot on a corner of the drawn line. */
  function setTrace(state, index) {
    const g = geometry(state);
    const n = Math.max(0, g.drawn);
    const i = Math.trunc(Number(index));
    return { ...state, trace: Number.isFinite(i) ? Math.max(0, Math.min(n, i)) : 0 };
  }

  function nextTrace(state) {
    return setTrace(state, state.trace + 1 > geometry(state).drawn ? 0 : state.trace + 1);
  }

  /** The status line: an illustration has no win or loss. */
  function status(state, g, trace) {
    const i = Math.max(0, Math.min(g.drawn, trace || 0));
    if (!g.drawn) return "No legs to draw at these settings.";
    if (i === g.drawn) {
      const end = g.vertices[i];
      return `One unbroken line of ${g.drawn} straight legs. At the last corner ` +
        `(${Math.round(end.x)}, ${Math.round(end.y)}).`;
    }
    const a = g.vertices[i];
    const b = g.vertices[Math.min(i + 1, g.drawn)];
    return `One unbroken line of ${g.drawn} straight legs. Following leg ${i + 1} of ${g.drawn}: ` +
      `(${Math.round(a.x)}, ${Math.round(a.y)}) to (${Math.round(b.x)}, ${Math.round(b.y)}).`;
  }

  return {
    MIN_MARGIN, MAX_MARGIN, MIN_SPREAD, MAX_SPREAD, MIN_LEGS, MAX_LEGS, WIDTH, HEIGHT, RANGES,
    clampOption, start, setOption, geometry, setTrace, nextTrace, status,
  };
})();
