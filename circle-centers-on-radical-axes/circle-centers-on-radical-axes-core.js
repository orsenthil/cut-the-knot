"use strict";

/*
 * Circle Centers On Radical Axes, from Alexander Bogomolny's applet
 * CircleCentersOnRadicalAxes. Three circles can be moved and resized. The
 * applet draws the three pairwise radical axes, marks their common point O,
 * and puts a dot on a centre when it lies on the radical axis of the other
 * two circles. The page's claim is that if P and Q are so marked, R is too.
 *
 * The one idea the code relies on is the applet's own computation, transcribed
 * from CircleCentersOnRadicalAxesCanvas.Compute: RadicalAxis is the common
 * chord when two circles meet and otherwise a line perpendicular to the
 * centreline through the point where the powers are equal; O is the average
 * of the three pairwise axis intersections; a centre counts as "on" an axis
 * when its distance to that line is under one pixel.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CircleCentersOnRadicalAxesCore, so the page
 * loads it with a plain <script> and porting/check-circle-centers-on-radical-axes.mjs
 * loads it in Node. Positions are plain data and functions never change what
 * they are given.
 */
const CircleCentersOnRadicalAxesCore = (() => {
  /** The applet's suggested applet size (WIDTH/HEIGHT parameters). */
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 300;
  /** GeoSDoub.Intersect and IsOn work in integer pixels; the guide circle. */
  const ON_EPS = 1;
  const DEGENERATE_EPS = 1;
  const PRORATE_EPS = 0.1;
  const PERP_SCALE = 10;
  /** Kept for the check: the angles and rim offsets of the applet's init. */
  const START_ANGLES = [-2.5132741228718345, -0.7853981633974483, Math.PI / 2];
  const START_RADII = [100, 120, 80];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);

  function midpoint(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  /** CTKGeometryPlus.Perp: a point ten units off the line pq, through c. */
  function perp(p, q, c) {
    const at = c || midpoint(p, q);
    return { x: at.x + (p.y - q.y) * PERP_SCALE, y: at.y - (p.x - q.x) * PERP_SCALE };
  }

  /** CTKGeometryPlus.Prorate: distance t from p towards q. */
  function prorate(p, q, t) {
    const d = dist(p, q);
    if (d < PRORATE_EPS) return p;
    const f = t / d;
    return { x: p.x + f * (q.x - p.x), y: p.y + f * (q.y - p.y) };
  }

  function barycenter(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  /** radius of a circle held by a centre and a rim point. */
  function radius(circle) {
    return dist(circle.center, circle.rim);
  }

  function asCircle(circle) {
    return { center: { x: circle.center.x, y: circle.center.y }, radius: radius(circle) };
  }

  /**
   * The applet's Reset, in board units. The guide circle has radius
   * min(width, height)/4, the three centres sit on it at the applet's three
   * angles, and the rim points are 100, 120 and 80 units to their right.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const guide = Math.min(width, height) / 4;
    const guideCenter = { x: width / 2, y: height / 2 };
    const circles = START_ANGLES.map((angle, i) => {
      const center = {
        x: guideCenter.x + guide * Math.cos(angle),
        y: guideCenter.y + guide * Math.sin(angle),
      };
      return { center, rim: { x: center.x + START_RADII[i], y: center.y } };
    });
    return { width, height, circles, center: guideCenter };
  }

  /** Reset restores the same diagram but keeps the board's size. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /**
   * Drag one of the six applet points: "P", "Q", "R" are centres (the rim
   * travels with them), "Pp", "Qp", "Rp" are rim points (the radius changes).
   */
  function movePoint(state, name, point) {
    const i = ["P", "Q", "R", "Pp", "Qp", "Rp"].indexOf(name);
    if (i < 0) return state;
    const circles = state.circles.map((c) => ({ center: { ...c.center }, rim: { ...c.rim } }));
    const c = circles[i % 3];
    if (i < 3) {
      const dx = point.x - c.center.x, dy = point.y - c.center.y;
      c.center = { x: point.x, y: point.y };
      c.rim = { x: c.rim.x + dx, y: c.rim.y + dy };
    } else {
      c.rim = { x: point.x, y: point.y };
    }
    return { width: state.width, height: state.height, circles, center: state.center };
  }

  /* ---- GeoSDoub.Intersect(DoubCircle, DoubCircle), from the bytecode ---- */

  /** The two intersections when the centres differ mainly in x. */
  function intersectCirclesX(a, b) {
    const slope = -(a.center.y - b.center.y) / (a.center.x - b.center.x);
    const B = ((a.center.x * a.center.x - b.center.x * b.center.x +
      a.center.y * a.center.y - b.center.y * b.center.y -
      a.radius * a.radius + b.radius * b.radius) / 2) / (a.center.x - b.center.x);
    const h = B - a.center.x;
    const qa = slope * slope + 1;
    const qb = slope * h - a.center.y;
    const qc = h * h + a.center.y * a.center.y - a.radius * a.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
    return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
  }

  /** The same calculation with the roles of x and y exchanged. */
  function intersectCirclesY(a, b) {
    const slope = -(a.center.x - b.center.x) / (a.center.y - b.center.y);
    const B = ((a.center.y * a.center.y - b.center.y * b.center.y +
      a.center.x * a.center.x - b.center.x * b.center.x -
      a.radius * a.radius + b.radius * b.radius) / 2) / (a.center.y - b.center.y);
    const h = B - a.center.y;
    const qa = slope * slope + 1;
    const qb = slope * h - a.center.x;
    const qc = h * h + a.center.x * a.center.x - a.radius * a.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
    return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
  }

  function circleIntersections(a, b) {
    if (Math.abs(a.center.x - b.center.x) > ON_EPS) return intersectCirclesX(a, b);
    if (Math.abs(a.center.y - b.center.y) > ON_EPS) return intersectCirclesY(a, b);
    return [{ x: a.center.x, y: a.center.y }, { x: a.center.x, y: a.center.y }];
  }

  /**
   * CTKGeometryPlus.RadicalAxis: the common chord if the circles meet,
   * otherwise the perpendicular to the centreline at the point where the two
   * powers agree. A line is stored as two points on it.
   */
  function radicalAxis(a, b) {
    const pts = circleIntersections(a, b);
    if (pts && pts[0] && pts[1]) {
      if (dist(pts[0], pts[1]) < ON_EPS) {
        const m = midpoint(pts[0], pts[1]);
        return { p: m, r: perp(pts[0], pts[1], m) };
      }
      return { p: pts[0], r: pts[1] };
    }
    const d = dist(a.center, b.center);
    if (d < DEGENERATE_EPS) return null;
    const t = (a.radius * a.radius - b.radius * b.radius) / d;
    const m = prorate(a.center, b.center, (t + d) / 2);
    return { p: perp(a.center, b.center, m), r: m };
  }

  /** GeoSDoub.Intersect(DoubPoint x4): NaN coordinates when nearly parallel. */
  function lineIntersection(p, q, u, v) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = u.y - v.y, e = v.x - u.x, f = u.x * v.y - u.y * v.x;
    const den = a * e - d * b;
    if (Math.abs(den) < ON_EPS) return { x: NaN, y: NaN };
    return { x: (b * f - e * c) / den, y: (c * d - f * a) / den };
  }

  /** GeoSDoub.Dist(DoubPoint, DoubLine): distance to the whole line. */
  function distPointLine(p, line) {
    if (sqDist(line.p, p) < PRORATE_EPS) return 0;
    const dx = line.r.x - line.p.x, dy = line.r.y - line.p.y;
    const t = (dx * (p.x - line.p.x) + dy * (p.y - line.p.y)) / (dx * dx + dy * dy);
    return Math.hypot(line.p.x - p.x + dx * t, line.p.y - p.y + dy * t);
  }

  /** CircleCentersOnRadicalAxesCanvas.IsOn: within one pixel of the line. */
  function isOn(p, line) {
    return !!line && distPointLine(p, line) < ON_EPS;
  }

  /**
   * CircleCentersOnRadicalAxesCanvas.Compute. The guard uses the O left by
   * the previous draw and refuses to update when O is within a pixel of a
   * centre. `previous` may be omitted; it then defaults to the state's O.
   */
  function compute(state, previous) {
    const prev = previous || state.center;
    const centers = state.circles.map((c) => c.center);
    if (centers.some((c) => dist(prev, c) < ON_EPS)) {
      return { skipped: true, center: prev, axes: null, on: { P: false, Q: false, R: false }, all: false };
    }
    const gs = state.circles.map(asCircle);
    const axes = {
      PQ: radicalAxis(gs[0], gs[1]),
      QR: radicalAxis(gs[1], gs[2]),
      RP: radicalAxis(gs[2], gs[0]),
    };
    let center = { x: NaN, y: NaN };
    if (axes.PQ && axes.QR && axes.RP) {
      const i1 = lineIntersection(axes.PQ.p, axes.PQ.r, axes.QR.p, axes.QR.r);
      const i2 = lineIntersection(axes.QR.p, axes.QR.r, axes.RP.p, axes.RP.r);
      const i3 = lineIntersection(axes.RP.p, axes.RP.r, axes.PQ.p, axes.PQ.r);
      center = barycenter(i1, i2, i3);
    }
    const on = {
      P: isOn(centers[0], axes.QR),
      Q: isOn(centers[1], axes.RP),
      R: isOn(centers[2], axes.PQ),
    };
    return {
      skipped: false, center, axes, on,
      all: on.P && on.Q && on.R,
    };
  }

  /** The power of X with respect to a circle, used by the maths section. */
  function power(circle, x) {
    return sqDist(circle.center, x) - radius(circle) * radius(circle);
  }

  /** The plain position saved for the player's record and the tutor. */
  function position(state, result) {
    const info = result || compute(state);
    return {
      width: state.width, height: state.height,
      center: info.center,
      circles: state.circles.map((c) => ({
        center: { x: c.center.x, y: c.center.y }, radius: radius(c),
      })),
      on: info.on, all: info.all,
    };
  }

  return {
    DEFAULT_WIDTH: DEFAULT_WIDTH, DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    ON_EPS: ON_EPS, START_ANGLES: START_ANGLES, START_RADII: START_RADII,
    dist: dist, sqDist: sqDist, midpoint: midpoint, perp: perp, prorate: prorate,
    barycenter: barycenter, radius: radius, asCircle: asCircle,
    start: start, reset: reset, movePoint: movePoint,
    intersectCirclesX: intersectCirclesX, intersectCirclesY: intersectCirclesY,
    circleIntersections: circleIntersections, radicalAxis: radicalAxis,
    lineIntersection: lineIntersection, distPointLine: distPointLine, isOn: isOn,
    compute: compute, power: power, position: position,
  };
})();
