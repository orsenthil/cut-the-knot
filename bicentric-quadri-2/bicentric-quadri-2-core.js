"use strict";

/*
 * Easy Construction of Bicentric Quadrilateral II, from Alexander
 * Bogomolny's applet BicentricQuadri2.
 *
 * Four points A, B, C, D sit on one circle w. P is the crossing of the
 * diagonals AC and BD; K, L, M, N are the feet of the perpendiculars from P
 * to the four sides. The article makes two claims about this inner
 * quadrilateral. The first is that KLMN always has an incircle (centred at P)
 * when ABCD is cyclic. This port is about the *second* claim, which is a
 * different statement: KLMN has a circumcircle exactly when the diagonals AC
 * and BD are perpendicular, i.e. when ABCD is orthodiagonal. The two combine
 * into a bicentric quadrilateral. The page's converse does not need ABCD to
 * be cyclic; the core's compute() therefore accepts any four points.
 *
 * The code follows the applet's own construction: Intersect and NearestPoint
 * from GeoSDoub, and a circumcircle for KLMN found as the intersection of the
 * perpendicular bisectors of its diagonals KM and LN. Everything here is a
 * pure function over plain data: no document, no window, no storage. It
 * defines one global, BicentricQuadri2Core, so the page loads it with a plain
 * <script> and porting/check-bicentric-quadri-2.mjs loads it in Node.
 */
const BicentricQuadri2Core = (() => {
  "use strict";

  // The applet's suggested canvas is 400x250. Its init puts the centre at
  // (width/2, height/2 + min(width,height)/12) and the radius at min/3.
  const VIEW = { width: 400, height: 250 };
  const DEFAULT_CENTER = { x: 200, y: 250 / 2 + 250 / 12 };
  const DEFAULT_RADIUS = 250 / 3;
  // init: A at 0, D at ~99 deg, C at 240 deg, B at 300 deg.
  const DEFAULT_ANGLES = [0, 5.235987755982989, 4.1887902047863905, 1.727875959474386];
  const MIN_RADIUS = 10;
  const MAX_RADIUS = 120;
  const PAD = 10;
  const TAU = 2 * Math.PI;
  // The applet's AreOrtho() calls |dot(A-C, B-D)| < 200 "Finished".
  const APPLET_ORTHO_TOL = 200;
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
  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  /** GeoSDoub.Intersect: two lines through point pairs; null when parallel. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular from p to ab. */
  function foot(p, a, b) {
    const ab = sub(b, a);
    const sq = dot(ab, ab);
    if (sq < 0.1) return null;
    return add(a, mul(ab, dot(sub(p, a), ab) / sq));
  }

  /** The canvas's GetPerp(m, p): m moved at right angles to m->p. */
  function perpPoint(m, p) {
    return pt(m.x + p.y - m.y, m.y - p.x + m.x);
  }

  function collinear(p, q, r, tol = 1e-7) {
    if (!r) return false;
    const a = sub(q, p);
    const b = sub(r, p);
    const scale = Math.max(1, length(a) * length(b));
    return Math.abs(cross(a, b)) <= tol * scale;
  }

  /** A point of the circle w at an angle (screen y grows downwards). */
  function at(center, radius, angle) {
    return pt(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
  }

  /** The angle of a point on w, used when a vertex is dragged. */
  function angleOf(center, p) {
    const a = Math.atan2(p.y - center.y, p.x - center.x);
    return a < 0 ? a + TAU : a;
  }

  function normalise(a) {
    return ((a % TAU) + TAU) % TAU;
  }

  /* --------------------------------------------------------------- position */

  /** The position a new drawing starts from; options override the defaults. */
  function start(options) {
    const o = options || {};
    const center = o.center ? { x: o.center.x, y: o.center.y } : { ...DEFAULT_CENTER };
    const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS,
      Number.isFinite(o.radius) ? o.radius : DEFAULT_RADIUS));
    const angles = (o.angles || DEFAULT_ANGLES).slice().map(normalise);
    const o0 = o.options || {};
    return {
      center,
      radius,
      angles,
      options: {
        names: Boolean(o0.names),
        incircle: Boolean(o0.incircle),
        diagonals: Boolean(o0.diagonals),
        extend: Boolean(o0.extend),
      },
      selected: Number.isInteger(o.selected) ? o.selected : 0,
      explored: false,
    };
  }

  /** The four vertices on w and the two centre/size handles, in board units. */
  function handles(state) {
    if (!state || !state.center || !state.angles) return null;
    const c = state.center;
    return {
      O: c,
      R: pt(c.x - state.radius, c.y),
      A: at(c, state.radius, state.angles[0]),
      B: at(c, state.radius, state.angles[1]),
      C: at(c, state.radius, state.angles[2]),
      D: at(c, state.radius, state.angles[3]),
    };
  }

  /* -------------------------------------------------------------- geometry */

  /**
   * The applet's whole construction for four points, whether or not they lie
   * on a circle. Null means a line pair was parallel, so nothing can be drawn.
   *
   * The claim tested here is: radii from the newly found circumcentre to K,
   * L, M, N are all equal exactly when dot(AC, BD) is zero.
   */
  function compute(A, B, C, D) {
    const P = intersect(A, C, B, D);
    if (!P) return null;
    const K = foot(P, A, B);
    const L = foot(P, B, C);
    const M = foot(P, C, D);
    const N = foot(P, D, A);
    if (!K || !L || !M || !N) return null;

    // DrawCircumCircle: perpendicular bisectors of KM and LN meet at O.
    const mKM = midpoint(K, M);
    const mLN = midpoint(L, N);
    const O = intersect(mKM, perpPoint(mKM, K), mLN, perpPoint(mLN, L));
    if (!O) return null;
    const radii = [distance(O, K), distance(O, L), distance(O, M), distance(O, N)];
    const circumradius = mean(radii);

    // DrawKLMN: P is the incenter, with the mean distance to the sides.
    const sideFeet = [foot(P, K, L), foot(P, L, M), foot(P, M, N), foot(P, N, K)];
    if (sideFeet.some((f) => !f)) return null;
    const inradii = sideFeet.map((f) => distance(P, f));
    const inradius = mean(inradii);

    // ShowDiagonals draws KM, LN and the point E where they cross.
    const E = intersect(K, M, L, N);
    const product = dot(sub(C, A), sub(D, B));
    const scale = Math.max(1, distance(A, C) * distance(B, D));
    const rTol = 1e-6 * Math.max(1, circumradius);
    const iTol = 1e-6 * Math.max(1, inradius);

    return {
      A, B, C, D,
      P, K, L, M, N, O, E,
      mKM, mLN,
      radii, circumradius,
      sideFeet, inradii, inradius,
      radiusSpread: spread(radii),
      inradiusSpread: spread(inradii),
      diagonalProduct: product,
      // The mathematical claim, with a relative numerical tolerance.
      orthodiagonal: Math.abs(product) <= 1e-7 * scale,
      // What the applet calls Finished and uses to draw the circumcircle.
      appletFinished: Math.abs(product) < APPLET_ORTHO_TOL,
      // KLMN is cyclic iff the four radii agree; inscriptible iff P is
      // equally far from all four sides.
      cyclic: spread(radii) <= rTol,
      inscriptible: spread(inradii) <= iTol,
      collinear: collinear(P, E, O),
    };
  }

  /** The same construction, from the player's position. */
  function geometry(state) {
    const h = handles(state);
    return h ? compute(h.A, h.B, h.C, h.D) : null;
  }

  /* ------------------------------------------------------------------ moves */

  /** Apply a move. Every move returns a fresh position; the old one is kept. */
  function move(state, m) {
    if (!m) return state;
    switch (m.type) {
      case "rotate": {
        const i = m.index;
        if (!Number.isInteger(i) || i < 0 || i > 3 || !Number.isFinite(m.delta)) return state;
        const angles = state.angles.slice();
        angles[i] = normalise(angles[i] + m.delta);
        return { ...state, angles, selected: i, explored: true };
      }
      case "rotateTo": {
        const i = m.index;
        if (!Number.isInteger(i) || i < 0 || i > 3 || !Number.isFinite(m.angle)) return state;
        const angles = state.angles.slice();
        angles[i] = normalise(m.angle);
        return { ...state, angles, selected: i, explored: true };
      }
      case "center": {
        if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return state;
        const x = Math.max(PAD, Math.min(VIEW.width - PAD, m.x));
        const y = Math.max(PAD, Math.min(VIEW.height - PAD, m.y));
        return { ...state, center: { x, y }, explored: true };
      }
      case "radius": {
        if (!Number.isFinite(m.value)) return state;
        const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, m.value));
        return { ...state, radius, explored: true };
      }
      case "option": {
        if (!(m.key in state.options)) return state;
        return { ...state, options: { ...state.options, [m.key]: Boolean(m.value) } };
      }
      case "select": {
        return Number.isInteger(m.index) && m.index >= 0 && m.index <= 3
          ? { ...state, selected: m.index }
          : state;
      }
      case "bicentric": {
        // For points at angles a, b, c, d on a circle, AC is perpendicular
        // to BD exactly when a + c - b - d is a right angle (mod pi). Change
        // C by the smallest amount that makes this true.
        const [a, b, c, d] = state.angles;
        const need = Math.PI - (a + c - b - d);
        let delta = normalise(need + Math.PI) - Math.PI;
        if (delta === -Math.PI) delta = Math.PI;
        const angles = state.angles.slice();
        angles[2] = normalise(c + delta);
        return { ...state, angles, selected: 2, explored: true };
      }
      case "reset":
        return start({ options: state.options });
      default:
        return state;
    }
  }

  /** The moves a player may make here; a demo has no win or loss. */
  function legalMoves(state) {
    return [
      { type: "rotate", index: state.selected, delta: 0.03 },
      { type: "rotate", index: state.selected, delta: -0.03 },
      { type: "center", x: state.center.x, y: state.center.y },
      { type: "radius", value: state.radius },
      { type: "bicentric" },
      { type: "reset" },
      { type: "option", key: "names", value: !state.options.names },
      { type: "option", key: "incircle", value: !state.options.incircle },
      { type: "option", key: "diagonals", value: !state.options.diagonals },
      { type: "option", key: "extend", value: !state.options.extend },
    ];
  }

  /** An illustration is explored, never won or lost. */
  function result(state) {
    return null;
  }

  /** A sentence for the status line, in words a player can act on. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Two of the lines are parallel, so there is no picture just now; move a point.";
    if (g.orthodiagonal) {
      return "AC and BD now cross at right angles. K, L, M and N lie on one circle as well as having P as their incenter, so this inner quadrilateral is bicentric.";
    }
    return "K, L, M and N have P as their incenter. They have no circle around them yet: make AC and BD cross at right angles, by dragging a point or pressing the button.";
  }

  return {
    VIEW, DEFAULT_CENTER, DEFAULT_RADIUS, DEFAULT_ANGLES,
    MIN_RADIUS, MAX_RADIUS, PAD, TAU, APPLET_ORTHO_TOL,
    pt, add, sub, mul, dot, cross, length, distance, midpoint, spread, mean,
    intersect, foot, perpPoint, collinear, at, angleOf, normalise,
    start, handles, compute, geometry, move, legalMoves, result, describe,
  };
})();
