"use strict";

/*
 * Three Points on a Parabola, from Alexander Bogomolny's applet Markowsky2.
 * Three points A, B, C sit on a parabola; AA', BB', CC' run parallel to its
 * axis. P = AB ∩ CC', Q = AC ∩ BB', R = BC ∩ AA'. If M_A is the meeting point
 * of the tangents at B and C (and likewise for M_B, M_C), the page asks us to
 * prove that M_A lies on PQ, M_B on PR, M_C on QR, and that PQ, PR, QR are
 * parallel to the tangents at A, B, C.
 *
 * The code follows the applet's own arithmetic, not the ideal parabola:
 * Parabola(t) = t²/(4a) uses Java integer division, the three slider values
 * tA, tB, tC run from -250 to 260, and a pair closer than 0.1 leaves the last
 * drawing on screen. Tangent endpoints are 50 units to the right, with the
 * exact double slope t/(2a). Intersections use GeoSDoub.Intersect's determinant
 * form with its one-unit parallel test (a parallel pair yields NaN).
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, Markowsky2Core, so the page loads it with a
 * plain <script> and porting/check-markowsky-2.mjs loads it in Node. Positions
 * are plain data; functions do not change what they are given.
 */
const Markowsky2Core = (() => {
  /** The size of the applet on the archived cut-the-knot page. */
  const DEFAULT_WIDTH = 560;
  const DEFAULT_HEIGHT = 500;
  /** Markowsky2Canvas fields: N = 5, a = 40, Dt = 2, Dh = 40. */
  const A = 40;
  const DT = 2;
  const DH = 40;
  /** The tangent endpoints are this far to the right of the point. */
  const TANGENT_STEP = 50;
  /** The three scrollbars: value, visible amount, minimum, maximum. */
  const MIN_T = -250;
  const MAX_T = 260;
  /** ComputeWhatNot stops when any pair of parameters is this close. */
  const GUARD_EPS = 0.1;
  /** GeoSDoub.Intersect calls a determinant below this parallel. */
  const PARALLEL_EPS = 1;
  /** The A', B', C' points keep the y they were given in init(). */
  const FOOT_Y = 20;
  /** The initial scrollbar values, in the order A, B, C. */
  const INITIAL_T = { A: 80, B: 180, C: 10 };
  const OPTION_NAMES = ["names", "tangents"];

  const copy = (p) => (p ? { x: p.x, y: p.y } : null);
  const clampT = (v) => Math.min(MAX_T, Math.max(MIN_T, Math.round(Number(v) || 0)));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Java int division truncates toward zero, at each of the two divisions. */
  function parabola(t) {
    return Math.trunc(Math.trunc((t * t) / 4) / A);
  }

  /** Compute(height, t) = height - a - Parabola(t) - Dh. */
  function computeY(height, t) {
    return height - A - parabola(t) - DH;
  }

  /**
   * GeoSDoub.Intersect(p1, p2, p3, p4), using the line coefficients
   * a = y1-y2, b = x2-x1, c = x1*y2-y1*x2. A determinant below one gives the
   * applet's NaN point rather than null.
   */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < PARALLEL_EPS) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /** The two checkboxes the panel actually puts on the applet. */
  function initialOptions() {
    return { names: false, tangents: false };
  }

  /** A fresh diagram at the applet's three starting slider values. */
  function start(options) {
    const o = options || {};
    return {
      width: o.width === undefined ? DEFAULT_WIDTH : o.width,
      height: o.height === undefined ? DEFAULT_HEIGHT : o.height,
      t: {
        A: o.tA === undefined ? INITIAL_T.A : clampT(o.tA),
        B: o.tB === undefined ? INITIAL_T.B : clampT(o.tB),
        C: o.tC === undefined ? INITIAL_T.C : clampT(o.tC),
      },
      options: Object.assign(initialOptions(), o.options || {}),
    };
  }

  /** Reset returns the three scrollbars to their starting positions. */
  function reset(state) {
    const fresh = start({ width: state.width, height: state.height });
    fresh.options = Object.assign({}, state.options);
    return fresh;
  }

  /** Moving a scrollbar (or a handle) keeps everything else as it was. */
  function setT(state, name, value) {
    if (!Object.prototype.hasOwnProperty.call(state.t, name)) return state;
    const t = Object.assign({}, state.t);
    t[name] = clampT(value);
    return Object.assign({}, state, { t });
  }

  /** Show names / tangents, as the two checkboxes do. */
  function setOption(state, name, on) {
    if (OPTION_NAMES.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
    });
  }

  /** An empty frame, used before a valid first draw. */
  function blank(state, blocked) {
    return {
      valid: false, blocked: !!blocked, width: state.width, height: state.height,
      t: Object.assign({}, state.t),
      points: {}, chords: [], verticals: [], tangents: [], pqr: [],
      parabolaPoints: [], axisX: centre(state.width),
      yDirectrix: state.height - DH, yVertex: state.height - A - DH,
      yFocus: state.height - 2 * A - DH,
    };
  }

  /** Java's `width / 2` here is integer division (idiv in the bytecode). */
  const centre = (width) => Math.trunc(width / 2);

  /** The point on the parabola used by the A, B and C handles. */
  function pointAt(state, t) {
    return { x: centre(state.width) + t, y: computeY(state.height, t) };
  }

  /** ComputeTangent1/2/3: a point and a second point 50 units along t/(2a). */
  function tangentAt(state, t, point) {
    return {
      p: copy(point),
      q: {
        x: centre(state.width) + t + TANGENT_STEP,
        y: point.y - TANGENT_STEP * (t / (2 * A)),
      },
    };
  }

  /**
   * ComputeWhatNot. `previous` is the last drawn frame: when two scrollbars
   * agree, Java returns before touching any field and the old picture stays.
   */
  function compute(state, previous) {
    const t = state.t;
    if (Math.abs(t.A - t.B) < GUARD_EPS ||
        Math.abs(t.B - t.C) < GUARD_EPS ||
        Math.abs(t.C - t.A) < GUARD_EPS) {
      if (!previous) return blank(state, true);
      return Object.assign({}, previous, { blocked: true });
    }

    const cx = centre(state.width);
    const aPoint = pointAt(state, t.A);
    const bPoint = pointAt(state, t.B);
    const cPoint = pointAt(state, t.C);
    // A', B', C' keep y = 20 from init(); only their x is overwritten.
    const aFoot = { x: aPoint.x, y: FOOT_Y };
    const bFoot = { x: bPoint.x, y: FOOT_Y };
    const cFoot = { x: cPoint.x, y: FOOT_Y };

    const tangentA = tangentAt(state, t.A, aPoint);
    const tangentB = tangentAt(state, t.B, bPoint);
    const tangentC = tangentAt(state, t.C, cPoint);

    // P = AB ∩ CC', Q = AC ∩ BB', R = BC ∩ AA'.
    const P = intersect(aPoint, bPoint, cPoint, cFoot);
    const Q = intersect(cPoint, aPoint, bPoint, bFoot);
    const R = intersect(bPoint, cPoint, aPoint, aFoot);
    // M_A = tangent(B) ∩ tangent(C), M_B = tangent(C) ∩ tangent(A), etc.
    const MA = intersect(bPoint, tangentB.q, cPoint, tangentC.q);
    const MB = intersect(cPoint, tangentC.q, aPoint, tangentA.q);
    const MC = intersect(aPoint, tangentA.q, bPoint, tangentB.q);

    const points = {
      A: aPoint, B: bPoint, C: cPoint,
      A1: aFoot, B1: bFoot, C1: cFoot,
      AT: tangentA.q, BT: tangentB.q, CT: tangentC.q,
      P, Q, R, MA, MB, MC,
    };

    // DrawParabola: from -limit to +limit in steps of Dt, with limit from
    // sqrt(4*a*(height-a)), capped at half the width.
    const limit = Math.min(cx, Math.round(Math.sqrt(4 * A * (state.height - A))) + 1);
    const parabolaPoints = [];
    for (let u = -limit; u <= limit; u += DT) {
      parabolaPoints.push({ x: cx + u, y: computeY(state.height, u) });
    }

    return {
      valid: true, blocked: false, width: state.width, height: state.height,
      t: Object.assign({}, t), points,
      chords: [
        { p: aPoint, q: bPoint }, { p: bPoint, q: cPoint }, { p: cPoint, q: aPoint },
      ],
      verticals: [
        { p: aPoint, q: aFoot }, { p: bPoint, q: bFoot }, { p: cPoint, q: cFoot },
      ],
      tangents: [tangentA, tangentB, tangentC],
      pqr: [{ p: P, q: Q }, { p: P, q: R }, { p: Q, q: R }],
      parabolaPoints,
      axisX: cx,
      yDirectrix: state.height - DH,
      yVertex: state.height - A - DH,
      yFocus: state.height - 2 * A - DH,
    };
  }

  /** Plain data for the player's record and the tutor, in board units. */
  function position(state, shown) {
    const points = {};
    for (const name of Object.keys(shown.points || {})) {
      points[name] = finite(shown.points[name]) ? copy(shown.points[name]) : null;
    }
    return {
      width: state.width, height: state.height, t: Object.assign({}, state.t),
      points, options: Object.assign({}, state.options),
      valid: shown.valid, blocked: shown.blocked,
      parabolaPoints: (shown.parabolaPoints || []).map(copy),
    };
  }

  /** A picture has no win or loss. */
  function result(state) {
    return null;
  }

  return {
    DEFAULT_WIDTH, DEFAULT_HEIGHT, A, DT, DH, TANGENT_STEP,
    MIN_T, MAX_T, GUARD_EPS, PARALLEL_EPS, FOOT_Y, INITIAL_T, OPTION_NAMES,
    parabola, computeY, intersect, finite,
    start, reset, setT, setOption, initialOptions, pointAt, tangentAt,
    compute, position, result,
  };
})();
