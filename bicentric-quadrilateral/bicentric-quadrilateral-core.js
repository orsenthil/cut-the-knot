"use strict";

/*
 * Bicentric Quadrilateral, from Alexander Bogomolny's applet BicentricQuadri.
 *
 * Start with four points A, B, C, D on a circle. The tangents to the circle at
 * those points meet in four corners P, Q, R, S; that outer quadrilateral always
 * has the circle as its incircle. Its diagonals meet at the same point as the
 * diagonals AC and BD of the four contact points (pole and polar for a circle).
 * The outer quadrilateral gains a circumcircle exactly when AC is perpendicular
 * to BD; then it is bicentric, and its incenter I (the circle's centre), the
 * diagonal crossing E and the circumcenter O lie on one straight line.
 *
 * The applet also shows the feet of the perpendiculars from E to the sides of
 * ABCD. Those feet form a quadrilateral with E as incenter for every cyclic
 * ABCD, and it is cyclic exactly in the same orthodiagonal case.
 *
 * The key idea behind the code is one identity: for points at angles a, b, c, d
 * on a circle, the vectors AC and BD are perpendicular exactly when
 * a + c - b - d is a right angle (mod pi). Everything here is a pure function
 * over a plain-data position; no document, no window, no storage.
 */
const BicentricQuadrilateralCore = (() => {
  "use strict";

  // The applet's start picture: A at 0, D at ~99 deg, C at 240 deg, B at 300 deg.
  // Stored here in A, B, C, D order.
  const DEFAULT_ANGLES = [0, 5.235987755982989, 4.1887902047863905, 1.727875959474386];
  const DEFAULT_CENTER = { x: 200, y: 130 };
  const DEFAULT_RADIUS = 42; // the applet suggests min(width, height) / 6
  const ORTHO_TOL = 100; // applet's AreOrtho: |dot(AC, BD)| < 100 (pixel^2)
  const MIN_RADIUS = 10;
  const MAX_RADIUS = 400;
  const EPS = 1e-9;

  /* ------------------------------------------------------------- small vectors */

  const pt = (x, y) => ({ x, y });
  const add = (a, b) => pt(a.x + b.x, a.y + b.y);
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const mul = (a, k) => pt(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const length = (a) => Math.hypot(a.x, a.y);
  const distance = (a, b) => length(sub(a, b));
  const midpoint = (a, b) => mul(add(a, b), 0.5);

  /** A line as a point and a direction vector. */
  const line = (p, d) => ({ p, d });

  /** The line through two points. */
  const lineThrough = (a, b) => line(a, sub(b, a));

  /** Where two lines cross, or null when they are parallel. */
  function intersect(l1, l2) {
    const den = cross(l1.d, l2.d);
    if (!Number.isFinite(den) || Math.abs(den) < EPS) return null;
    const t = cross(sub(l2.p, l1.p), l2.d) / den;
    const u = cross(sub(l2.p, l1.p), l1.d) / den;
    if (!Number.isFinite(t) || !Number.isFinite(u)) return null;
    return add(l1.p, mul(l1.d, t));
  }

  /** The foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const ab = sub(b, a);
    const d = dot(ab, ab);
    if (d < EPS) return null;
    const t = dot(sub(p, a), ab) / d;
    return add(a, mul(ab, t));
  }

  /** The tangent to a circle at a point on it: radius rotated a quarter turn. */
  function tangent(center, p) {
    const r = sub(p, center);
    return line(p, pt(-r.y, r.x));
  }

  /** The centre of the circle through three points, or null if collinear. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b);
    const m2 = midpoint(b, c);
    const n1 = pt(-(b.y - a.y), b.x - a.x);
    const n2 = pt(-(c.y - b.y), c.x - b.x);
    return intersect(line(m1, n1), line(m2, n2));
  }

  /** A point of the circle at a given angle (screen y grows downwards). */
  function at(center, radius, angle) {
    return pt(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
  }

  /** True when the two chords are perpendicular to within the applet's tolerance. */
  function orthodiagonal(A, B, C, D, tol = ORTHO_TOL) {
    const v = dot(sub(C, A), sub(D, B));
    return Number.isFinite(v) && Math.abs(v) <= tol;
  }

  /** True when three points lie on one line (cross product small relative to scale). */
  function collinear(p, q, r, tol = EPS) {
    const a = sub(q, p);
    const b = sub(r, p);
    const scale = Math.max(1, length(a) * length(b));
    return Math.abs(cross(a, b)) <= tol * scale;
  }

  /** The largest spread of a list of numbers, used to test "all four equal". */
  function spread(values) {
    return Math.max(...values) - Math.min(...values);
  }

  /* ------------------------------------------------------------------ position */

  /** The position a new drawing starts from. Options override the defaults. */
  function start(options) {
    const o = options || {};
    const angles = (o.angles || DEFAULT_ANGLES).slice();
    const center = o.center ? { x: o.center.x, y: o.center.y } : { ...DEFAULT_CENTER };
    const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, o.radius || DEFAULT_RADIUS));
    return {
      center,
      radius,
      angles,
      showNames: o.showNames !== undefined ? Boolean(o.showNames) : false,
      selected: o.selected !== undefined ? o.selected : 0,
    };
  }

  /** The four contact points and the radius handle, in plain coordinates. */
  function handles(state) {
    const c = state.center;
    const A = at(c, state.radius, state.angles[0]);
    const B = at(c, state.radius, state.angles[1]);
    const C = at(c, state.radius, state.angles[2]);
    const D = at(c, state.radius, state.angles[3]);
    // The radius handle sits above the circle, away from A at angle 0.
    return { center: c, A, B, C, D, radiusHandle: pt(c.x, c.y - state.radius) };
  }

  /**
   * Everything the page draws, derived from the position. `drawable` is false
   * for a degenerate configuration (coincident points or parallel tangents).
   */
  function geometry(state) {
    const { center, A, B, C, D } = handles(state);
    const r = state.radius;

    // The tangents at A, B, C, D meet in the four corners of the outer quad.
    const P = intersect(tangent(center, A), tangent(center, B));
    const Q = intersect(tangent(center, B), tangent(center, C));
    const R = intersect(tangent(center, C), tangent(center, D));
    const S = intersect(tangent(center, D), tangent(center, A));
    if (!P || !Q || !R || !S) {
      return { drawable: false, center, radius: r, A, B, C, D };
    }

    // E is the crossing of AC and BD. For a circle it is also the crossing of
    // the diagonals PR and QS of the outer quadrilateral.
    const E = intersect(lineThrough(A, C), lineThrough(B, D));
    if (!E) return { drawable: false, center, radius: r, A, B, C, D, P, Q, R, S };

    // O2 is the circumcenter of the outer quadrilateral P Q R S.
    const O2 = circumcenter(P, Q, R);
    if (!O2) return { drawable: false, center, radius: r, A, B, C, D, P, Q, R, S, E };

    // The feet of the perpendiculars from E to the four sides of ABCD.
    const feet = [
      foot(E, A, B), foot(E, B, C), foot(E, C, D), foot(E, D, A),
    ];
    const feetOk = feet.every(Boolean) && feet.every((f) =>
      Number.isFinite(f.x) && Number.isFinite(f.y));
    const feetSides = feetOk
      ? feet.map((f, i) => foot(E, f, feet[(i + 1) % 4]))
      : [];
    const feetCentre = feetOk ? circumcenter(feet[0], feet[1], feet[2]) : null;
    const footE = feetOk
      ? intersect(lineThrough(feet[0], feet[2]), lineThrough(feet[1], feet[3]))
      : null;

    const tangentRadii = [P, Q, R, S].map((v) => distance(O2, v));
    const footRadii = feetOk ? feet.map((f) => distance(feetCentre, f)) : [];
    const incircleRadii = feetSides.map((f) => distance(E, f));
    const orthodiagonalNow = orthodiagonal(A, B, C, D);
    const tol = r * r * 1e-7;

    return {
      drawable: true,
      center,
      radius: r,
      A, B, C, D,
      P, Q, R, S,
      E,
      O: O2,
      feet,
      feetCentre,
      footE,
      incircleRadius: r,
      circumradius: tangentRadii.reduce((a, b) => a + b, 0) / 4,
      tangentRadii,
      footRadii,
      incircleRadii,
      // The circle touches every side of P Q R S, always.
      tangential: [P, Q, R, S].every((v) =>
        Math.abs(distance(center, foot(center, lineThrough(P, Q).p, Q)) - r) < 1e-6),
      // P Q R S has a circumcircle exactly when AC is perpendicular to BD.
      cyclic: spread(tangentRadii) <= tol,
      // The feet quadrilateral has E as its incenter, always.
      feetInscriptible: feetOk && spread(incircleRadii) <= tol,
      // It is cyclic in exactly the same orthodiagonal case.
      feetCyclic: feetOk && spread(footRadii) <= tol,
      orthodiagonal: orthodiagonalNow,
      // I = centre, E = diagonal crossing, O = circumcenter of P Q R S.
      collinear: collinear(center, E, O2, 1e-7),
      feetCollinear: Boolean(footE && feetCentre && collinear(E, footE, feetCentre, 1e-7)),
    };
  }

  /* --------------------------------------------------------------------- moves */

  /**
   * Apply a move. Every move returns a fresh position; the old one is untouched.
   * type: "rotate" (index, delta), "center" (x, y), "radius" (value),
   *       "names" (value), "select" (index), "bicentric".
   */
  function move(state, m) {
    if (!m) return state;
    switch (m.type) {
      case "rotate": {
        const i = m.index;
        if (!Number.isInteger(i) || i < 0 || i > 3 || !Number.isFinite(m.delta)) return state;
        const angles = state.angles.slice();
        angles[i] = (angles[i] + m.delta) % (2 * Math.PI);
        if (angles[i] < 0) angles[i] += 2 * Math.PI;
        return { ...state, angles, selected: i };
      }
      case "center": {
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return state;
        return { ...state, center: { x: m.x, y: m.y } };
      }
      case "radius": {
        if (!Number.isFinite(m.value)) return state;
        const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, m.value));
        return { ...state, radius };
      }
      case "names":
        return { ...state, showNames: Boolean(m.value) };
      case "select":
        return Number.isInteger(m.index) && m.index >= 0 && m.index <= 3
          ? { ...state, selected: m.index }
          : state;
      case "bicentric": {
        // Pick the angle of C that makes a + c - b - d a right angle, taking
        // the smallest change from the current picture.
        const [a, b, c, d] = state.angles;
        const need = Math.PI - (a + c - b - d);
        let delta = ((need + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const angles = state.angles.slice();
        angles[2] = (c + delta + 2 * Math.PI) % (2 * Math.PI);
        return { ...state, angles };
      }
      default:
        return state;
    }
  }

  /** The moves a player may make here (a demo has no win or loss). */
  function legalMoves(state) {
    return [
      { type: "rotate", index: state.selected, delta: 0.02 },
      { type: "rotate", index: state.selected, delta: -0.02 },
      { type: "center", x: state.center.x, y: state.center.y },
      { type: "radius", value: state.radius },
      { type: "names", value: !state.showNames },
      { type: "select", index: (state.selected + 1) % 4 },
      { type: "bicentric" },
    ];
  }

  /** A demo is explored, never won or lost: "done" when it is bicentric. */
  function result(state) {
    const g = geometry(state);
    return g.drawable && g.orthodiagonal ? "done" : null;
  }

  /** A sentence for the status line, in words a player can act on. */
  function describe(state) {
    const g = geometry(state);
    if (!g.drawable) return "Two points line up, so the drawing cannot be made just now; move one of the four dots.";
    const letters = ["A", "B", "C", "D"];
    if (g.orthodiagonal) {
      return "The diagonals of " + letters.map((L, i) => L + " at " + Math.round(state.angles[i] * 180 / Math.PI) + "°").join(", ") +
        " now cross at right angles: the outer quadrilateral has an incircle and a circumcircle, and I, E and O lie on one line.";
    }
    return "The four dots lie on the circle and the outer corners touch it. The diagonals are not at right angles, so there is no circumcircle yet — drag a dot or press Make it bicentric.";
  }

  return {
    DEFAULT_ANGLES, DEFAULT_CENTER, DEFAULT_RADIUS, ORTHO_TOL, MIN_RADIUS, MAX_RADIUS,
    pt, add, sub, mul, dot, cross, length, distance, midpoint,
    line, lineThrough, intersect, foot, tangent, circumcenter, at,
    orthodiagonal, collinear, spread,
    start, handles, geometry, move, legalMoves, result, describe,
  };
})();
