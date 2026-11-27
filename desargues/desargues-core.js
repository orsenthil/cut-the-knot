"use strict";

/*
 * Desargues — the geometry behind Alexander Bogomolny's Java applet Desargue
 * (cut-the-knot.org/Curriculum/Geometry/Desargues.shtml; the live page now
 * embeds a GeoGebra picture, and the 2006 Wayback capture embeds the Java one).
 *
 * Two triangles can be dragged corner by corner or as whole shapes. In
 * "Direct" mode the applet joins matching vertices A1A2, B1B2, C1C2 and lights
 * a yellow dot at the mean of the three pairwise crossings when they are
 * within 8 board units: the perspective centre. In "Converse" mode it draws
 * the six side lines, marks ab = A1B1 ∩ A2B2, bc = B1C1 ∩ B2C2 and
 * ca = C1A1 ∩ C2A2, then joins those crossings. Desargues' theorem is that
 * concurrency of the three vertex lines is equivalent to collinearity of the
 * three side crossings.
 *
 * This file is the logic only: no document, no window, no storage, one global.
 * Positions are plain data, so the page and the tutor can share them. The
 * intersection routine below follows GeoSDoub.Intersect from the bytecode,
 * including its |determinant| < 1 parallel test; the exact variant is used
 * only for the theorem's residuals in the logic test.
 */

const DesarguesCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 8;
  const MIN_SEP = 12;
  const NAMES = ["A1", "B1", "C1", "A2", "B2", "C2"];
  const FIRST = ["A1", "B1", "C1"];
  const SECOND = ["A2", "B2", "C2"];
  const MODES = ["direct", "converse"];
  const CROSS_NAMES = ["ab", "bc", "ca"];

  // DesargueCanvas.Reset() places the six corners at exactly these points.
  const START = {
    A1: { x: 102, y: 144 },
    B1: { x: 214, y: 90 },
    C1: { x: 142, y: 260 },
    A2: { x: 336, y: 188 },
    B2: { x: 258, y: 110 },
    C2: { x: 288, y: 242 },
  };

  // Constants read from DesargueCanvas.Draw and ConnectPoints in the bytecode.
  const DOT_TOLERANCE = 8;
  const PARALLEL_EPS = 1;
  const EXTENSION = 10;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;

  function clampPoint(p) {
    return {
      x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, round(p.x))),
      y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, round(p.y))),
    };
  }

  /** GeoSDoub.Intersect(a,b,c,d), line by line from the bytecode. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < PARALLEL_EPS) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** The same intersection without the applet's pixel-scale parallel cut-off. */
  function intersectExact(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), den = cross(r, s);
    if (Math.abs(den) < 1e-12) return null;
    const t = cross(sub(c, a), s) / den;
    return add(a, mul(r, t));
  }

  /** DesargueCanvas.Average(p,q,r): the yellow dot's position. */
  function average(p, q, r) {
    return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
  }

  function spread(points) {
    if (points.some((p) => !finite(p))) return Infinity;
    return Math.max(dist(points[0], points[1]), dist(points[0], points[2]), dist(points[1], points[2]));
  }

  /** Perpendicular distance from p to the line through a and b. */
  function distanceToLine(p, a, b) {
    const d = sub(b, a), len = Math.hypot(d.x, d.y);
    if (!len) return 0;
    return Math.abs(cross(d, sub(p, a))) / len;
  }

  /* ------------------------------------------------------------- positions */

  function start(options) {
    const o = options || {};
    const state = {};
    for (const name of NAMES) state[name] = { ...START[name] };
    state.mode = MODES.includes(o.mode) ? o.mode : "direct";
    state.moves = 0;
    state.explored = false;
    for (const name of NAMES) {
      if (finite(o[name])) state[name] = clampPoint(o[name]);
    }
    return state;
  }

  /**
   * The crossings of corresponding side lines. CrossPoint.Draw copies
   * GeoSDoub.Intersect into the object and sets IsNaN when it fails; the
   * ConnectPoints method reads that flag on the next repaint.
   */
  function crosses(state) {
    const { A1, B1, C1, A2, B2, C2 } = state;
    const side = {
      ab: [[A1, B1], [A2, B2]],
      bc: [[B1, C1], [B2, C2]],
      ca: [[C1, A1], [C2, A2]],
    };
    const out = {};
    for (const name of CROSS_NAMES) {
      const [one, two] = side[name];
      const p = intersect(one[0], one[1], two[0], two[1]);
      out[name] = { point: p, nan: !finite(p), line1: [one[0], one[1]], line2: [two[0], two[1]] };
    }
    return out;
  }

  /** DesargueCanvas.ConnectPoints(g, first, second), as segment endpoints. */
  function connect(first, second) {
    if (first.nan && second.nan) return null;
    if (first.nan) {
      // Extend the *second* crossing's own first side line, ten units either
      // way: 10*(m_1 - m_2) in the bytecode's coordinates.
      const u = second.line1[0], v = second.line1[1];
      const step = { x: EXTENSION * (u.x - v.x), y: EXTENSION * (u.y - v.y) };
      return [add(second.point, step), sub(second.point, step)];
    }
    return [first.point, second.point];
  }

  /** The whole construction at one position, in board units. */
  function compute(state) {
    const { A1, B1, C1, A2, B2, C2 } = state;
    const vertexLines = [
      { name: "AA", a: A1, b: A2 },
      { name: "BB", a: B1, b: B2 },
      { name: "CC", a: C1, b: C2 },
    ];
    const sideLines = [
      { name: "A1B1", a: A1, b: B1 }, { name: "A2B2", a: A2, b: B2 },
      { name: "B1C1", a: B1, b: C1 }, { name: "B2C2", a: B2, b: C2 },
      { name: "C1A1", a: C1, b: A1 }, { name: "C2A2", a: C2, b: A2 },
    ];
    const O = [
      intersect(A1, A2, B1, B2),
      intersect(A1, A2, C1, C2),
      intersect(B1, B2, C1, C2),
    ];
    const xp = crosses(state);
    const direct = {
      intersections: O,
      spread: spread(O),
      // Draw() shows the yellow dot only when all three are within 8 units.
      shown: spread(O) < DOT_TOLERANCE,
      point: spread(O) < DOT_TOLERANCE ? average(O[0], O[1], O[2]) : null,
    };
    const axisSegments = [
      connect(xp.ab, xp.bc),
      connect(xp.bc, xp.ca),
      connect(xp.ca, xp.ab),
    ].filter(Boolean);
    return { mode: state.mode, vertexLines, sideLines, crosses: xp, direct, axisSegments };
  }

  /**
   * Independent (non-applet) measurements of the two claims: how far the
   * vertex lines are from one centre, and how far the side crossings are from
   * one line. Used by the logic test and by the status line.
   */
  function residuals(state) {
    const { A1, B1, C1, A2, B2, C2 } = state;
    const O = [
      intersectExact(A1, A2, B1, B2),
      intersectExact(A1, A2, C1, C2),
      intersectExact(B1, B2, C1, C2),
    ];
    const P = intersectExact(A1, B1, A2, B2);
    const Q = intersectExact(B1, C1, B2, C2);
    const R = intersectExact(C1, A1, C2, A2);
    return {
      concurrency: Math.min(spread(O), Infinity),
      collinearity: P && Q && R ? distanceToLine(R, P, Q) : Infinity,
      crossings: { ab: P, bc: Q, ca: R },
    };
  }

  /** The moves a player can make: six corners, two whole triangles, mode, reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      { type: "shape", name: "one", dx: 0, dy: 0 },
      { type: "shape", name: "two", dx: 0, dy: 0 },
      ...MODES.map((mode) => ({ type: "mode", mode })),
      { type: "reset" },
    ];
  }

  /** Clamp a requested whole-triangle shift so every corner stays on the board. */
  function clampDelta(base, dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { dx: 0, dy: 0 };
    const shift = { x: dx, y: dy };
    const names = base && Array.isArray(base.names) ? base.names : FIRST;
    const points = names.map((name) => base && finite(base[name]) ? base[name] : START[name]);
    const loX = Math.min(...points.map((p) => p.x + shift.x));
    const hiX = Math.max(...points.map((p) => p.x + shift.x));
    const loY = Math.min(...points.map((p) => p.y + shift.y));
    const hiY = Math.max(...points.map((p) => p.y + shift.y));
    if (loX < MARGIN) shift.x += MARGIN - loX;
    if (hiX > WIDTH - MARGIN) shift.x -= hiX - (WIDTH - MARGIN);
    if (loY < MARGIN) shift.y += MARGIN - loY;
    if (hiY > HEIGHT - MARGIN) shift.y -= hiY - (HEIGHT - MARGIN);
    return { dx: round(shift.x), dy: round(shift.y) };
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < MIN_SEP)) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "shape") {
      if (m.name !== "one" && m.name !== "two") return null;
      const names = m.name === "one" ? FIRST : SECOND;
      const base = {};
      for (const n of NAMES) base[n] = m.base && finite(m.base[n]) ? m.base[n] : state[n];
      const d = clampDelta({ ...base, names }, m.dx, m.dy);
      const delta = { x: d.dx, y: d.dy };
      next = { ...state };
      for (const n of names) next[n] = clampPoint(add(base[n], delta));
      if (NAMES.some((n) => NAMES.some((o) => n !== o && dist(next[n], next[o]) < MIN_SEP))) return null;
    } else if (m.type === "mode") {
      if (!MODES.includes(m.mode)) return null;
      next = { ...state, mode: m.mode };
    } else if (m.type === "reset") {
      // Clicking the applet's Direct/Converse radio changes "Which" only;
      // NewGame (Reset) restores the six corners but keeps that choice.
      next = { ...start(), mode: state.mode };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has nothing to win: it counts as explored after one change. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_SEP, NAMES, FIRST, SECOND, MODES, CROSS_NAMES,
    START, DOT_TOLERANCE, PARALLEL_EPS, EXTENSION,
    start, compute, crosses, connect, residuals, legalMoves, move, result,
    intersect, intersectExact, average, spread, distanceToLine, clampPoint, clampDelta,
    add, sub, mul, dot, cross, dist, finite, round,
  };
})();
