"use strict";

/*
 * An Anticomplementary Triangle Surprise, from Alexander Bogomolny's applet
 * AnticomplementaryTriangle (the theorem and its proof are on the cut-the-knot
 * page "An Anticomplementary Triangle Surprise", Honsberger, In Polya's
 * Footsteps, pp. 276-278).
 *
 * Build equilateral triangles ABZ, BCX and CAY on the sides of ABC, all with
 * the same turn. Then build XYR, YZP and ZXQ on the sides of XYZ with the
 * opposite turn. The surprise is that PQR is the anticomplementary triangle
 * of ABC: A, B and C are exactly the midpoints of its sides. In coordinates
 * that means P = B + C - A, Q = C + A - B, R = A + B - C, whatever triangle
 * you start with.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, AnticomplementaryTriangleCore, so the page
 * loads it with a plain <script> and porting/check-anticomplementary-triangle.mjs
 * loads it in Node. Every point is a plain {x, y} in board units.
 */
const AnticomplementaryTriangleCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 420, height: 300 };
  const MARGIN = 20;

  /** A well-spread starting triangle; every constructed point fits the view. */
  const START = {
    A: { x: 250, y: 115 },
    B: { x: 175, y: 185 },
    C: { x: 275, y: 180 },
  };

  /** One third of a half turn: the equilateral-triangle angle in the applet. */
  const SIXTY = Math.PI / 3;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /**
   * GeoSDoub.Rotate(center, point, angle, dir), transcribed from the applet's
   * bytecode. `dir` is -1 for the first Napoleon step and +1 for the second,
   * which is why the two steps turn in opposite directions on screen.
   */
  function rotate(center, point, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - center.x, dy = point.y - center.y;
    return {
      x: center.x + c * dx - dir * s * dy,
      y: center.y + dir * s * dx + c * dy,
    };
  }

  /**
   * The two Napoleon steps, in the applet's own order:
   *   X = Rotate(B, C, 60, -1)   Y = Rotate(C, A, 60, -1)   Z = Rotate(A, B, 60, -1)
   *   P = Rotate(Y, Z, 60, +1)   Q = Rotate(Z, X, 60, +1)   R = Rotate(X, Y, 60, +1)
   * `spokes` are the six segments the applet draws from the corners of ABC to
   * the points of XYZ; the two triangle lists are its highlighted step pieces.
   */
  function construct(A, B, C) {
    const X = rotate(B, C, SIXTY, -1);
    const Y = rotate(C, A, SIXTY, -1);
    const Z = rotate(A, B, SIXTY, -1);
    const P = rotate(Y, Z, SIXTY, 1);
    const Q = rotate(Z, X, SIXTY, 1);
    const R = rotate(X, Y, SIXTY, 1);
    return {
      A, B, C, X, Y, Z, P, Q, R,
      spokes: [[X, B], [X, C], [Y, C], [Y, A], [Z, A], [Z, B]],
      firstStep: [[Z, A, B], [X, B, C], [Y, C, A]],
      secondStep: [[R, X, Y], [P, Y, Z], [Q, Z, X]],
      medians: [[P, Q, C], [Q, R, A], [R, P, B]],
    };
  }

  /** The closed form given on the article: P = B + C - A, and cyclically. */
  function anticomplementary(A, B, C) {
    return {
      P: { x: B.x + C.x - A.x, y: B.y + C.y - A.y },
      Q: { x: C.x + A.x - B.x, y: C.y + A.y - B.y },
      R: { x: A.x + B.x - C.x, y: A.y + B.y - C.y },
    };
  }

  /** Twice the signed area of a triangle (positive when A,B,C turn left). */
  function twiceArea(A, B, C) {
    return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
  }

  /** The midpoints of the outer triangle's sides. */
  function midpoints(g) {
    return {
      A: { x: (g.Q.x + g.R.x) / 2, y: (g.Q.y + g.R.y) / 2 },
      B: { x: (g.R.x + g.P.x) / 2, y: (g.R.y + g.P.y) / 2 },
      C: { x: (g.P.x + g.Q.x) / 2, y: (g.P.y + g.Q.y) / 2 },
    };
  }

  /**
   * Every point of the drawing, computed from a position. A missing or
   * non-finite corner gives valid: false, so no caller sees NaN coordinates.
   */
  function geometry(state) {
    const { A, B, C } = state;
    if (![A, B, C].every(finitePoint)) return { valid: false };
    return { valid: true, ...construct(A, B, C) };
  }

  function defaultOptions() {
    return { names: true, firstStep: false, secondStep: false };
  }

  /** A fresh position; the applet's "show" parameter is 1 by default. */
  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** The applet's init() put its corners at different angles around the centre. */
  function randomStart(rand = Math.random) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = 0.3 * Math.min(VIEW.width, VIEW.height);
    const angle = () => rand() * Math.PI / 3 - Math.PI / 6;
    const a0 = angle();
    const at = (a) => clampToBoard({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    return {
      A: at(a0),
      B: at(a0 + angle() + Math.PI / 2),
      C: at(a0 + angle() + Math.PI),
      options: defaultOptions(),
      touches: 0,
    };
  }

  /** Move one corner; the old position is not changed. */
  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  /** The panel's three "Show ..." checkboxes. */
  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** An illustration has no win or loss: it is explored, which Track handles. */
  function result(state) {
    return null;
  }

  /** A short status line reporting the invariant the player can watch. */
  function label(g) {
    if (!g.valid) return "Move A, B and C so they form a triangle.";
    const areaRatio = Math.abs(twiceArea(g.P, g.Q, g.R) / twiceArea(g.A, g.B, g.C));
    return `A, B, C are the midpoints of QR, RP and PQ. The green triangle has ` +
      `${areaRatio.toFixed(0)} times the area of the starting one. Drag a corner and it stays true.`;
  }

  return {
    VIEW, START, SIXTY, start, randomStart, moveVertex, setOption, result,
    geometry, construct, anticomplementary, rotate, twiceArea, midpoints,
    dist, finitePoint, clampToBoard, label,
  };
})();
