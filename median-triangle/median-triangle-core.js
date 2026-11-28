"use strict";

/*
 * Median Triangle, from Alexander Bogomolny's applet MedianTriangle. Move the
 * three corners of triangle ABC and the applet keeps three midpoints, the
 * medians, and the small blue triangle whose sides are those medians. The
 * surprising fact, proved on the cut-the-knot page, is that this median
 * triangle always has exactly 3/4 of the area of ABC.
 *
 * Every point here is a plain {x, y} in SVG board units. The midpoints M_a,
 * M_b, M_c and the points D, E, F are computed by the applet's own Compute()
 * method: M_a = (C+B)/2, M_b = (A+C)/2, M_c = (B+A)/2,
 * D = C+B-A, E = M_b+M_a-A and F = M_c+M_a-A. The starting corners come from
 * its init() method, transcribed below as initialTriangle().
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MedianTriangleCore, so the page loads it
 * with a plain <script> and porting/check-median-triangle.mjs loads it in Node.
 */
const MedianTriangleCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 480, height: 340 };
  const MARGIN = 24;
  /** The applet's fixed pixel offset in init(), kept in board units. */
  const OFFSET = 60;

  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /** MedianTriangleCanvas.init(), with the canvas size replaced by the viewBox. */
  function initialTriangle(width, height) {
    const halfW = width / 2.0;
    const halfH = height / 2.0;
    const quarter = width / 4.0;
    const A = { x: halfW - (3.0 * quarter) / 2.0, y: halfH + OFFSET };
    const B = { x: A.x + 2.0 * quarter, y: A.y };
    const C = { x: (A.x + 2.0 * B.x) / 3.0, y: halfH - 2.0 * OFFSET };
    return { A, B, C };
  }

  const START = initialTriangle(VIEW.width, VIEW.height);

  /** MedianTriangleCanvas.Midpoint(), transcribed literally. */
  function midpoint(p, q) {
    return { x: (p.x + q.x) / 2.0, y: (p.y + q.y) / 2.0 };
  }

  /** Twice the signed area: positive when A, B, C turn left. */
  function twiceArea(A, B, C) {
    return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
  }

  function area(A, B, C) {
    return Math.abs(twiceArea(A, B, C)) / 2;
  }

  /**
   * The whole drawing, in the applet's own order. `medianTriangle` is the
   * blue triangle B, M_b, E: its sides are exactly the three medians.
   * `articleD` is the point D of the article's triangle BDG, which is a
   * different point from the applet's D (see the maths section on the page).
   */
  function construct(A, B, C) {
    const Am = midpoint(C, B);
    const Bm = midpoint(A, C);
    const Cm = midpoint(B, A);
    const D = { x: C.x + B.x - A.x, y: C.y + B.y - A.y };
    const E = { x: Bm.x + Am.x - A.x, y: Bm.y + Am.y - A.y };
    const F = { x: Cm.x + Am.x - A.x, y: Cm.y + Am.y - A.y };
    const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const articleD = { x: 2.0 * Am.x - G.x, y: 2.0 * Am.y - G.y };

    return {
      A, B, C, Am, Bm, Cm, D, E, F, G, articleD,
      medians: [[A, Am], [B, Bm], [C, Cm]],
      cornerTriangles: [[Bm, Am, C], [Bm, Cm, A], [Am, Cm, B]],
      centerTriangle: [E, Am, F],
      medianTriangle: [B, Bm, E],
      parallelogramTriangle: [B, C, D],
      /* ShowHint() marks these six half-sides in three matching pairs. */
      hintPairs: [[A, Bm], [C, Bm], [C, Am], [B, Am], [B, Cm], [A, Cm]],
      sides: { a: dist(B, C), b: dist(C, A), c: dist(A, B) },
      medianLengths: { ma: dist(A, Am), mb: dist(B, Bm), mc: dist(C, Cm) },
      area: area(A, B, C),
    };
  }

  function geometry(state) {
    if (!state || ![state.A, state.B, state.C].every(finitePoint)) return { valid: false };
    return { valid: true, ...construct(state.A, state.B, state.C) };
  }

  function defaultOptions() {
    /* The applet's ShowNames parameter defaults to "1"; Hint starts off. */
    return { names: true, hint: false };
  }

  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** The "New triangle" button: three corners spread around the centre. */
  function randomStart(rand = Math.random) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = 0.3 * Math.min(VIEW.width, VIEW.height);
    const a0 = rand() * Math.PI * 2;
    const at = (a) => clampToBoard({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    return {
      A: at(a0), B: at(a0 + 2.1), C: at(a0 + 4.3),
      options: defaultOptions(), touches: 0,
    };
  }

  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** An illustration has no win or loss: Track counts it as explored. */
  function result() {
    return null;
  }

  function label(g) {
    if (!g.valid) return "Move A, B and C so they make a triangle.";
    const ratio = g.area > 1e-12 ? area(...g.medianTriangle) / g.area : 0;
    const pct = (ratio * 100).toFixed(1).replace(/\.0$/, "");
    return `The blue triangle's sides are the three medians. Its area is ${pct}% of ABC's — drag a corner and it stays 75%.`;
  }

  return {
    VIEW, MARGIN, OFFSET, START, start, randomStart, moveVertex, setOption,
    result, geometry, construct, initialTriangle, midpoint, twiceArea, area,
    dist, finitePoint, clampToBoard, label,
  };
})();
