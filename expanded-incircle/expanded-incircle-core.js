"use strict";

/*
 * Expanded incircle, from Alexander Bogomolny's applet ExpandedIncircle
 * (cut-the-knot.org/Curriculum/Geometry/ExpandedIncircle.shtml).
 *
 * Start with a point P on side BC of triangle ABC. Rotate the side lines
 * around the triangle: Q is on AB with BQ = BP, R is on AC with AR = AQ,
 * P' is on BC with CP' = CR, then Q', R'. The construction closes, the six
 * points lie on one circle, and its centre is the incenter I. If P is pushed
 * far enough out, the three arcs through each pair of points trace a curve
 * of constant width.
 *
 * This module follows the applet's own code, in order. GeoSDoub.FindIncenter
 * intersects the two internal angle bisectors; D, E, F are the feet of the
 * perpendiculars from I onto BC, CA, AB; Incircle is GetCircle(D,E,F) (its
 * circumcenter with the average of the three radii); Circle is centred at I
 * with radius IP. Each of Q, R, P', Q', R' comes from the applet's Rotate(),
 * which uses GeoSDoub.ComputeSignedAngle() and GeoSDoub.Rotate(...,1).
 * P stays on the line BC: the applet stores the parameter coefP (0.7 at
 * start) and recomputes it from the pointer position whenever P is dragged.
 *
 * No DOM, no storage: the position is plain data, so it can be saved for the
 * player's record and handed to the tutor unchanged.
 */
const ExpandedIncircleCore = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 400, height: 300 };
  const MARGIN = 10;

  /** The applet's init() at its suggested 400 by 300 pixels. */
  const START = {
    A: { x: 80, y: 60 },
    B: { x: 240, y: 240 },
    C: { x: 320, y: 60 },
    coefP: 0.7,
  };

  const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const dot = (p, q) => p.x * q.x + p.y * q.y;

  function clampToBoard(p) {
    return {
      x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    };
  }

  /* ------------------- the GeoSDoub helpers, in the applet's order ------- */

  /** GeoSDoub.ComputeAngle(p,q,r): the angle at p, in radians. */
  function computeAngle(p, q, r) {
    const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * dist(p, q) * dist(p, r));
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  /** GeoSDoub.FindOrientation: +1 for one winding, -1 for the other. */
  function findOrientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(centre, point, angle, direction). */
  function rotate(centre, point, angle, direction) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: centre.x + c * (point.x - centre.x) - direction * s * (point.y - centre.y),
      y: centre.y + direction * s * (point.x - centre.x) + c * (point.y - centre.y),
    };
  }

  /** GeoSDoub.ComputeSignedAngle(p,q,r), including its near-straight guard. */
  function signedAngle(p, q, r) {
    const angle = computeAngle(p, q, r);
    const dir = findOrientation(p, q, r);
    let value = angle;
    if (angle > 0.99) {
      const dx = q.x - p.x, dy = q.y - p.y;
      if (dx * dx + dy * dy < 0) value = Math.PI; // the applet's dead guard
    }
    return dir === 1 ? value : -value;
  }

  /** GeoSDoub.Intersect of two infinite lines; NaN when they are parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // GeoSDoub's threshold
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.FindIncenter: intersection of the two internal bisectors. */
  function findIncenter(A, B, C) {
    const dir = findOrientation(A, B, C);
    return intersect(
      rotate(A, B, computeAngle(A, B, C) / 2, dir),
      A,
      rotate(B, C, computeAngle(B, C, A) / 2, dir),
      B,
    );
  }

  /** GeoSDoub.NearestPoint(p,a,b): the foot on the infinite line a->b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter, as two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    return intersect(
      m1, { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) },
      m2, { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) },
    );
  }

  /** ExpandedIncircleCanvas.GetCircle: mean of the three distances. */
  function getCircle(p, q, r) {
    const center = circumcenter(p, q, r);
    return {
      center,
      radius: (dist(center, p) + dist(center, q) + dist(center, r)) / 3,
    };
  }

  /* ----------------------------------------------------------- the state */

  function defaultOptions() {
    // The applet's constructor: incircle on, everything else off. Conway's
    // spokes have no checkbox; they are drawn with the incircle.
    return {
      names: false,
      rotations: false,
      circle: false,
      incircle: true,
      gergonne: false,
    };
  }

  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k in opts) if (k in options) opts[k] = Boolean(options[k]);
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      coefP: START.coefP, options: opts, touches: 0,
    };
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  /** Move a vertex. Moving B or C carries P with the side line (UpgradePoints). */
  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(point)) return state;
    return { ...state, [name]: clampToBoard(point), touches: state.touches + 1 };
  }

  /** Drag P: the applet projects the pointer onto BC and stores coefP. */
  function moveP(state, point) {
    if (!finitePoint(point)) return state;
    const { B, C } = state;
    const dx = B.x - C.x, dy = B.y - C.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return state;
    const t = ((point.x - C.x) * dx + (point.y - C.y) * dy) / len2;
    if (!Number.isFinite(t)) return state;
    return { ...state, coefP: t, touches: state.touches + 1 };
  }

  /**
   * Every point of the drawing from the current position. `valid` is false
   * for a flat triangle or a degenerate construction, so no caller receives
   * NaN coordinates in that case.
   */
  function geometry(state) {
    const invalid = { valid: false };
    const { A, B, C } = state;
    if (!finitePoint(A) || !finitePoint(B) || !finitePoint(C)) return invalid;
    const twiceArea = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x));
    if (twiceArea < 1e-6) return invalid;

    const I = findIncenter(A, B, C);
    const D = foot(I, B, C), E = foot(I, C, A), F = foot(I, A, B);
    const incircle = getCircle(D, E, F);
    const P = {
      x: state.coefP * B.x + (1 - state.coefP) * C.x,
      y: state.coefP * B.y + (1 - state.coefP) * C.y,
    };
    const circle = { center: I, radius: dist(I, P) };

    // The applet's five successive Rotate() calls, in its exact order.
    const Q = rotate(B, P, signedAngle(B, C, A), 1);
    const R = rotate(A, Q, signedAngle(A, B, C), 1);
    const Pp = rotate(C, R, signedAngle(C, A, B), 1);
    const Qp = rotate(B, Pp, signedAngle(B, C, A), 1);
    const Rp = rotate(A, Qp, signedAngle(A, B, C), 1);
    const six = [P, Q, R, Pp, Qp, Rp];
    if (![I, D, E, F, P, Q, R, Pp, Qp, Rp].every(finitePoint)) return invalid;

    return {
      valid: true, A, B, C, I, D, E, F, P, Q, R, Pp, Qp, Rp,
      incircle, circle, sixPoints: six,
      // [centre, from, to] of the six arcs, as in ShowRotations().
      arcs: [
        [B, C, A, P], [A, B, C, Q], [C, A, B, R],
        [B, C, A, Pp], [A, B, C, Qp], [C, A, B, Rp],
      ],
      labels: { A, B, C, D, E, F, I, P, Q, R, Pp, Qp, Rp },
    };
  }

  /* ---------------------------------------------------- the page's claims */

  /** Distances from I to the six points; their spread tests concyclicity. */
  function radii(g) {
    return g.sixPoints.map((p) => dist(g.I, p));
  }

  function radiusSpread(g) {
    if (!g.valid) return Infinity;
    const rs = radii(g);
    return Math.max(...rs) - Math.min(...rs);
  }

  /** FQ = ER = DP' = FQ' = ER' = DP (ordinary, unsigned lengths). */
  function tangentLengths(g) {
    if (!g.valid) return [];
    return [
      dist(g.D, g.P), dist(g.F, g.Q), dist(g.E, g.R),
      dist(g.D, g.Pp), dist(g.F, g.Qp), dist(g.E, g.Rp),
    ];
  }

  function tangentSpread(g) {
    const l = tangentLengths(g);
    return l.length ? Math.max(...l) - Math.min(...l) : Infinity;
  }

  /** Midpoint claims: D is mid of PP', E mid of RR', F mid of QQ'. */
  function midpointErrors(g) {
    if (!g.valid) return [Infinity, Infinity, Infinity];
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return [dist(mid(g.P, g.Pp), g.D), dist(mid(g.R, g.Rp), g.E), dist(mid(g.Q, g.Qp), g.F)];
  }

  /** The closing claim CP = CR'. */
  function closingError(g) {
    return g.valid ? dist(g.C, g.P) - dist(g.C, g.Rp) : Infinity;
  }

  /** The three equal arcs segments PP', QQ', RR'. */
  function chordLengths(g) {
    if (!g.valid) return [];
    return [dist(g.P, g.Pp), dist(g.Q, g.Qp), dist(g.R, g.Rp)];
  }

  /**
   * Conway's construction: the point produced on line BC by going `side + x`
   * beyond B, away from C. The page's proof makes DP = s + x here.
   */
  function conwayPoint(state, vertex, x) {
    const { A, B, C } = state;
    // At A the sides are produced by a+x, at B by b+x, at C by c+x.
    const from = { A, B, C }[vertex];
    const other = { A: B, B: C, C: A }[vertex];
    const extension = { A: dist(B, C), B: dist(C, A), C: dist(A, B) }[vertex] + x;
    const len = dist(other, from);
    if (!from || len < 1e-9) return null;
    return {
      x: from.x + extension * (from.x - other.x) / len,
      y: from.y + extension * (from.y - other.y) / len,
    };
  }

  /** The six Conway points: each side produced beyond each of its corners. */
  function conwaySix(state, x) {
    const { A, B, C } = state;
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const beyond = (from, other, length) => {
      const len = dist(other, from);
      return len < 1e-9 ? null : {
        x: from.x + length * (from.x - other.x) / len,
        y: from.y + length * (from.y - other.y) / len,
      };
    };
    return [
      beyond(A, B, a + x), beyond(A, C, a + x),
      beyond(B, A, b + x), beyond(B, C, b + x),
      beyond(C, A, c + x), beyond(C, B, c + x),
    ].filter(Boolean);
  }

  /** An illustration has nothing to win or lose: Track marks it explored. */
  function result() {
    return null;
  }

  return {
    VIEW, START, start, defaultOptions, setOption, moveVertex, moveP, geometry,
    radii, radiusSpread, tangentLengths, tangentSpread, midpointErrors,
    closingError, chordLengths, conwayPoint, conwaySix, result,
    dist, sqDist, dot, foot, intersect, rotate, signedAngle, computeAngle,
    findOrientation, findIncenter, circumcenter, getCircle, clampToBoard,
  };
})();
