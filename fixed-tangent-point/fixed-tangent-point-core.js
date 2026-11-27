"use strict";

/*
 * Fixed Tangent Point, from Alexander Bogomolny's applet FixedTangentPoint.
 * A circle C has centre O and radius OR; a horizontal line m is drawn through
 * the handle X. For a point P on m outside C, the applet draws the circle
 * centred at P through the tangency point T on C. The surprise is that all
 * these circles pass through the same point Q on the line OM: the length PQ
 * never changes as P slides along m.
 *
 * The one idea the code relies on is the applet's own Compute(): M is the foot
 * of the perpendicular from O to m, z = sqrt(OM^2 - r^2), Q = (O.x, X.y - z),
 * and the tangent points from P (and from M) are found from the circle C.
 * The guard dist(P,O) <= r stops the applet redrawing; a negative z leaves Q
 * and N at their last drawn values. Both quirks are kept here.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FixedTangentPointCore, so the page loads it
 * with a plain <script> and porting/check-fixed-tangent-point.mjs loads it in
 * Node. Positions are plain data; functions never change what they are given.
 */
const FixedTangentPointCore = (() => {
  /** The applet's own suggested size (WIDTH/HEIGHT in the archived page). */
  const DEFAULT_WIDTH = 600;
  const DEFAULT_HEIGHT = 550;
  /** GeoSDoub.Intersect switches axis after a one-unit difference. */
  const AXIS_EPS = 1;
  /** GeoSDoub.NearestPoint returns the foot itself when the base is this close. */
  const FOOT_EPS = 0.1;
  /** DoubPoint.Other prefers the first endpoint unless it is within 1 of P. */
  const OTHER_EPS = 1;
  const OPTION_NAMES = ["names", "hint", "statement"];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (p) => ({ x: p.x, y: p.y });

  /**
   * GeoSDoub.NearestPoint: the foot of the perpendicular from `p` to the line
   * through `a` and `b`, with the applet's short-circuit for a tiny base.
   */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < FOOT_EPS) return copy(p);
    const ux = b.x - a.x, uy = b.y - a.y;
    const t = (ux * (p.x - a.x) + uy * (p.y - a.y)) / (ux * ux + uy * uy);
    return { x: a.x + t * ux, y: a.y + t * uy };
  }

  /**
   * The two tangency points from `p` to the circle (centre, radius). This is
   * the analytic form of Tangents.GetExternalTangents with a point circle:
   * the foot along cp is at r^2/d^2, the sideways step is r*sqrt(d^2-r^2)/d^2.
   * The returned order matches GeoSDoub.Intersect, which lists the larger y
   * first in x-mode and the larger x first near a vertical centreline.
   */
  function tangentPoints(centre, radius, p) {
    const vx = p.x - centre.x, vy = p.y - centre.y;
    const d2 = vx * vx + vy * vy;
    const gap = d2 - radius * radius;
    if (!(gap > 0)) return [];
    const sideways = (radius * Math.sqrt(gap)) / d2;
    const along = (radius * radius) / d2;
    const bx = centre.x + along * vx, by = centre.y + along * vy;
    const a = { x: bx - sideways * vy, y: by + sideways * vx };
    const b = { x: bx + sideways * vy, y: by - sideways * vx };
    if (Math.abs(centre.x - p.x) > AXIS_EPS) return a.y >= b.y ? [a, b] : [b, a];
    if (Math.abs(centre.y - p.y) > AXIS_EPS) return a.x >= b.x ? [a, b] : [b, a];
    return [a, b];
  }

  /**
   * The applet's Reset, in board units. O is first placed at 3h/8 and its y
   * is then overwritten with h/4; R keeps the old y, so the initial radius is
   * the distance between the two points rather than w/8. X keeps its x (it is
   * Fix(1)) and P keeps its y (Fix(2)).
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const cx = width / 2;
    const O = { x: cx, y: Math.floor(height / 4) };
    const R = { x: cx - width / 8, y: (3 * height) / 8 };
    const X = { x: width - 20, y: Math.floor((3 * height) / 5) };
    const P = { x: O.x + 1.3 * (width / 8), y: X.y };
    return {
      width, height, O, R, X, P,
      options: initialOptions(),
    };
  }

  /** Reset restores the diagram and keeps the board size and the options. */
  function reset(state) {
    const fresh = start({ width: state.width, height: state.height });
    fresh.options = Object.assign({}, state.options);
    return fresh;
  }

  /**
   * Drag one of the applet's four points. O moves the centre, R changes the
   * radius, X is fixed in x and slides the line m (carrying P with it), and P
   * is fixed in y and slides along m. This is CTKMoveableDoub.Fix(1)/Fix(2).
   */
  function movePoint(state, name, point) {
    const next = {
      width: state.width, height: state.height,
      O: copy(state.O), R: copy(state.R), X: copy(state.X), P: copy(state.P),
      options: Object.assign({}, state.options),
    };
    const inside = (q) => ({
      x: clamp(q.x, 0, state.width),
      y: clamp(q.y, 0, state.height),
    });
    if (name === "O") next.O = inside(point);
    else if (name === "R") next.R = inside(point);
    else if (name === "X") {
      next.X = { x: state.X.x, y: clamp(point.y, 0, state.height) };
      next.P = { x: state.P.x, y: next.X.y };
    } else if (name === "P") {
      next.P = { x: clamp(point.x, 0, state.width), y: state.X.y };
    } else return state;
    return next;
  }

  /** The three checkboxes under the applet: names, statement and hint. */
  function setOption(state, name, on) {
    if (OPTION_NAMES.indexOf(name) < 0) return state;
    const options = Object.assign({}, state.options);
    options[name] = !!on;
    return Object.assign({}, state, { options });
  }

  /** The applet's page parameter ShowNames defaults to "1". */
  function initialOptions() {
    return { names: true, hint: false, statement: false };
  }

  function blank(previous, radius, noDot) {
    const before = previous || {};
    return {
      noDraw: true, noDot: !!noDot, radius,
      M: before.M || null, T: before.T || null,
      tangentCircle: before.tangentCircle || null,
      Q: before.Q || null, mirrorQ: before.mirrorQ || null,
      N: before.N || null, z: before.z === undefined ? null : before.z,
      tangentLength: before.tangentLength === undefined ? null : before.tangentLength,
      pq: before.pq === undefined ? null : before.pq,
    };
  }

  /**
   * Compute(), transcribed from FixedTangentPointCanvas. `previous` is the
   * last drawn result: the applet leaves Q and N untouched when z is not a
   * real number, and leaves everything untouched when P is not outside C.
   */
  function compute(state, previous) {
    const O = state.O, P = state.P, X = state.X;
    const radius = dist(O, state.R);
    if (!(dist(P, O) > dist(state.R, O))) return blank(previous, radius, previous && previous.noDot);

    const M = nearestPoint(O, P, X);
    const T = tangentPoints(O, radius, P);
    if (!T.length) return blank(previous, radius, previous && previous.noDot);
    const tangentCircle = { center: copy(P), radius: dist(P, T[0]) };

    const gap = (O.y - X.y) * (O.y - X.y) - radius * radius;
    const z = Math.sqrt(gap);
    const common = {
      noDraw: false, radius, M, T, tangentCircle,
      tangentLength: tangentCircle.radius,
    };
    if (Number.isNaN(z)) {
      return Object.assign(blank(previous, radius, true), common, {
        noDot: true, M, T, tangentCircle, tangentLength: tangentCircle.radius,
      });
    }

    const Q = { x: O.x, y: X.y - z };
    const mirrorQ = { x: O.x, y: X.y + z };
    const fromM = tangentPoints(O, radius, M);
    let N = null;
    if (fromM.length) {
      // DoubPoint.Other picks the end of each tangent line away from M.
      const candidates = fromM.map((t) => (dist(t, M) < OTHER_EPS ? M : t));
      if (P.x < M.x) N = candidates[0].x <= M.x ? candidates[0] : candidates[1];
      else N = candidates[0].x <= M.x ? candidates[1] : candidates[0];
    }
    return Object.assign(common, {
      noDot: false, Q, mirrorQ, N, z, pq: dist(P, Q),
    });
  }

  /** Plain data for the player's record and the tutor, in board units. */
  function position(state, shown) {
    return {
      width: state.width, height: state.height,
      O: copy(state.O), R: copy(state.R), X: copy(state.X), P: copy(state.P),
      M: shown.M ? copy(shown.M) : null,
      Q: shown.Q ? copy(shown.Q) : null,
      mirrorQ: shown.mirrorQ ? copy(shown.mirrorQ) : null,
      N: shown.N ? copy(shown.N) : null,
      T: shown.T ? shown.T.map(copy) : [],
      radius: shown.radius,
      tangentLength: shown.tangentLength,
      pq: shown.pq,
      noDraw: shown.noDraw, noDot: shown.noDot,
      options: Object.assign({}, state.options),
    };
  }

  /** There is no win or loss in this illustration. */
  function result(state) {
    return null;
  }

  return {
    DEFAULT_WIDTH, DEFAULT_HEIGHT, OPTION_NAMES,
    dist, sqDist, nearestPoint, tangentPoints,
    start, reset, movePoint, setOption, initialOptions, compute, position, result,
  };
})();
