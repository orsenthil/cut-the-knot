"use strict";

/*
 * Adams' circle, from Alexander Bogomolny's applet AdamsCircle
 * (cut-the-knot.org/Curriculum/Geometry/AdamsCircle.shtml).
 *
 * The incircle of ABC touches BC, CA and AB at D, E and F. The lines AD, BE,
 * CF meet at the Gergonne point G. Through G draw the three lines parallel to
 * EF, FD and DE; they meet the sides of ABC in six points P, Q, R, S, T, U.
 * Adams (1843) found that these six points always lie on one circle, and that
 * its centre is the incenter I -- not the circumcenter, as for an ordinary
 * circle through six points on the sides.
 *
 * This is the applet's own construction, in order: ComputePoints() takes
 * InCircle = GetInCircle(A,B,C), D/E/F = NearestPoint(I, side), G =
 * Intersect(A,D,B,E), the three GetParallelTo(G, ...) lines, their six
 * intersections with the sides, and GetCircle(S,U,Q). The hint construction
 * (X, Y on the line through A parallel to BC, then M, N) is the one in the
 * applet's Draw() method.
 *
 * The key numerical fact used by the page and checked in
 * porting/check-adams-circle.mjs: DP = DQ = ER = ES = FT = FU, so every one
 * of the six points is the same distance from I (D, E, F are the feet of the
 * perpendiculars from I). The circle through S, U and Q is therefore the
 * six-point circle, and its centre is I.
 *
 * No DOM, no storage: the position is plain data (three points and the
 * display options), so it can be saved and given to the tutor as it is.
 */
const AdamsCircleCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 360, height: 260 };
  const MARGIN = 18;

  /** A well-spread starting triangle, in board units. */
  const START = {
    A: { x: 280, y: 95 },
    B: { x: 90, y: 200 },
    C: { x: 100, y: 60 },
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /** Foot of the perpendicular from p to the infinite line through a, b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return null;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Intersection of line(a,b) with line(c,d); null for parallel lines. */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-9) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** A second point on the line through p parallel to q->r. */
  function parallelTo(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  /** Incenter by side-length weights: I = (aA + bB + cC) / (a+b+c). */
  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    return {
      x: (a * A.x + b * B.x + c * C.x) / sum,
      y: (a * A.y + b * B.y + c * C.y) / sum,
    };
  }

  /** Circumcenter from the intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const ax = q.x - p.x, ay = q.y - p.y;
    const bx = r.x - p.x, by = r.y - p.y;
    const d = 2 * (ax * by - ay * bx);
    if (!d) return null;
    return {
      x: p.x + (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / d,
      y: p.y + (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / d,
    };
  }

  /**
   * Every point of the drawing, computed from a position. `valid` is false
   * for a collapsed triangle or a pair of parallel lines, when the picture
   * cannot be drawn; no caller ever sees NaN coordinates in that case.
   */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C;
    const invalid = { valid: false };
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;

    const I = incenter(A, B, C);
    const D = foot(I, B, C), E = foot(I, C, A), F = foot(I, A, B);
    if (!D || !E || !F) return invalid;
    // GetInCircle(): the applet averages its three distances to the sides.
    const radius = (dist(I, foot(I, A, B)) + dist(I, foot(I, B, C)) + dist(I, foot(I, C, A))) / 3;

    const G = intersect(A, D, B, E);
    if (!G) return invalid;
    const ef = parallelTo(G, E, F);   // through G, parallel to EF
    const fd = parallelTo(G, F, D);   // through G, parallel to FD
    const de = parallelTo(G, D, E);   // through G, parallel to DE
    const bc = parallelTo(A, B, C);   // through A, parallel to BC

    const U = intersect(ef, G, A, B);
    const R = intersect(ef, G, A, C);
    const T = intersect(fd, G, A, B);
    const Q = intersect(fd, G, B, C);
    const S = intersect(de, G, A, C);
    const P = intersect(de, G, B, C);
    if (![U, R, T, Q, S, P].every(finitePoint)) return invalid;

    // GetCircle(S,U,Q): the applet's circle through the first three points.
    const O = circumcenter(S, U, Q);
    if (!O) return invalid;
    const circleRadius = (dist(O, S) + dist(O, U) + dist(O, Q)) / 3;

    // The hint: X, Y on the parallel through A, then M, N on the two chords.
    const X = intersect(bc, A, D, E);
    const Y = intersect(bc, A, D, F);
    const M = X && Y ? intersect(X, Y, P, S) : null;
    const N = X && Y ? intersect(X, Y, Q, T) : null;

    return {
      valid: true, A, B, C, I, radius, D, E, F, G,
      P, Q, R, S, T, U,
      circle: { center: O, radius: circleRadius },
      X, Y, M, N,
      ef, fd, de, bc,
      gergonneTriangle: [D, E, F],
      sixPoints: [P, Q, R, S, T, U],
      labels: { A, B, C, D, E, F, G, I, P, Q, R, S, T, U },
    };
  }

  /** The six distances from the incenter to the six points. */
  function radii(g) {
    return g.sixPoints.map((p) => dist(g.I, p));
  }

  /** Largest departure from a single radius: the concyclicity test. */
  function circleError(g) {
    if (!g.valid) return Infinity;
    const rs = radii(g);
    return Math.max(...rs) - Math.min(...rs);
  }

  /** How far the circle through S,U,Q has its centre from the incenter. */
  function centerError(g) {
    return g.valid ? dist(g.I, g.circle.center) : Infinity;
  }

  /** The page's six tangent lengths: DP, DQ, ER, ES, FT, FU. */
  function tangentLengths(g) {
    if (!g.valid) return [];
    return [
      dist(g.D, g.P), dist(g.D, g.Q),
      dist(g.E, g.R), dist(g.E, g.S),
      dist(g.F, g.T), dist(g.F, g.U),
    ];
  }

  /** A new position: the applet's init() puts the vertices on a circle. */
  function randomStart(rand = Math.random) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = (2 / 3) * Math.min(VIEW.width / 2, VIEW.height / 2);
    const angle = () => -Math.PI / 4 + rand() * Math.PI / 4;
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

  function defaultOptions() {
    return {
      names: true,
      incircle: true,
      gergonneLines: true,
      gergonneTriangle: true,
      adamsCircle: true,
      hint: false,
    };
  }

  /** A fresh position; no option of the applet changes the construction. */
  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in opts) opts[k] = Boolean(options[k]);
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** Move one vertex; the old position is not changed. */
  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** An illustration has no win or loss: it is explored, which Track handles. */
  function result(state) {
    return null;
  }

  return {
    VIEW, START, start, randomStart, moveVertex, setOption, geometry,
    radii, circleError, centerError, tangentLengths, result,
    dist, foot, intersect, parallelTo, incenter, circumcenter, clampToBoard,
  };
})();
