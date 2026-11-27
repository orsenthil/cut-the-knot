"use strict";

/*
 * Feuerbach Incidence, from Alexander Bogomolny's applet FeuerbachIncidence.
 * The page claims two incidences: the lines from A, B, C to the nine-point
 * circle's contact points with the three excircles meet at one point F (X12),
 * and N, F, I and Fi lie on one line (L(1, 5)).
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It transcribes the applet's own method: FindIncenter and
 * FindExcenter from two rotated angle bisectors, the nine-point circle from
 * the three side midpoints, and each contact point by scaling the line of
 * centres by (second circle's radius / centre distance). The applet averages
 * three distances for every radius; that average is kept here too. The UI
 * script only draws the results. The position is plain data, so the player's
 * record and the tutor can read it as it is.
 */
const FeuerbachIncidenceCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 12;

  const point = (x, y) => ({ x: x, y: y });
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.ComputeAngle: the angle at p, from the law of cosines. */
  function angle(p, q, r) {
    const a = sqDist(p, q), b = sqDist(p, r), c = sqDist(q, r);
    return Math.acos((a + b - c) / (2 * dist(p, q) * dist(p, r)));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise (0 -> -1). */
  function orientation(p, q, r) {
    const d = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return d > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn q about p by a radians; sign flips the direction. */
  function rotate(p, q, a, sign) {
    const c = Math.cos(a), s = Math.sin(a), dx = q.x - p.x, dy = q.y - p.y;
    return point(p.x + c * dx - sign * s * dy, p.y + sign * s * dx + c * dy);
  }

  /** GeoSDoub.Intersect of two infinite lines; Java returns NaN if |det| < 1. */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det);
  }

  /** GeoSDoub.NearestPoint: the perpendicular foot, with the applet's 0.1 guard. */
  function foot(p, a, b) {
    const len2 = sqDist(a, b);
    if (len2 < 0.1) return point(p.x, p.y);
    const t = ((b.x - a.x) * (p.x - a.x) + (b.y - a.y) * (p.y - a.y)) / len2;
    return point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }

  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.FindIncenter: two internal half-angle bisectors, oriented. */
  function findIncenter(a, b, c) {
    const turn = orientation(a, b, c);
    const p = rotate(a, b, angle(a, b, c) / 2, turn);
    const q = rotate(b, c, angle(b, c, a) / 2, turn);
    return intersect(a, p, b, q);
  }

  /** GeoSDoub.FindExcenter: two external half-angle bisectors, oriented. */
  function findExcenter(a, b, c) {
    const turn = orientation(b, a, c);
    const p = rotate(b, c, (Math.PI - angle(b, a, c)) / 2, turn);
    const q = rotate(c, b, (Math.PI - angle(c, a, b)) / 2, -turn);
    return intersect(b, p, c, q);
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const p = point(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const q = point(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return intersect(m1, p, m2, q);
  }

  /** GetCircle / ComputeExcircle: centre and the mean of three distances. */
  function circle(center, pts) {
    const radius = (dist(center, pts[0]) + dist(center, pts[1]) + dist(center, pts[2])) / 3;
    return { center: center, radius: radius };
  }

  function excircle(a, b, c) {
    const center = findExcenter(a, b, c);
    return circle(center, [foot(center, a, b), foot(center, b, c), foot(center, c, a)]);
  }

  /**
   * ComputePoint: start at the second circle's centre and move towards the
   * first one by radius/distance. `away` uses the applet's boolean overload,
   * which subtracts instead of adding (the internal incircle tangency).
   */
  function contact(first, second, away) {
    const d = dist(first.center, second.center);
    const t = (away ? -1 : 1) * second.radius / d;
    return point(second.center.x + t * (first.center.x - second.center.x),
      second.center.y + t * (first.center.y - second.center.y));
  }

  /** The whole construction, straight from FeuerbachIncidenceCanvas.Compute. */
  function compute(a, b, c) {
    const A = point(a.x, a.y), B = point(b.x, b.y), C = point(c.x, c.y);
    const I = findIncenter(A, B, C);
    const incircle = circle(I, [foot(I, A, B), foot(I, B, C), foot(I, C, A)]);
    const midBC = midpoint(B, C), midCA = midpoint(C, A), midAB = midpoint(A, B);
    const nine = circle(circumcenter(midBC, midCA, midAB), [midBC, midCA, midAB]);
    const ca = excircle(A, B, C), cb = excircle(B, C, A), cc = excircle(C, A, B);
    const Pa = contact(nine, ca, false), Pb = contact(nine, cb, false), Pc = contact(nine, cc, false);
    const Pi = contact(nine, incircle, true);
    const F = intersect(A, Pa, B, Pb);
    const circles = [incircle, nine, ca, cb, cc];
    const points = [I, Pa, Pb, Pc, Pi, F];
    // In an equilateral triangle the incircle and the nine-point circle
    // coincide, so there is no single tangency point; the applet divides by
    // zero there. Treat that (and a zero-size triangle) as no picture.
    const centresApart = [incircle, ca, cb, cc].every((k) => dist(nine.center, k.center) > 1e-6);
    const valid = centresApart && circles.every((k) => Number.isFinite(k.radius) && k.radius > 0 &&
      finite(k.center)) && points.every(finite);
    return {
      A: A, B: B, C: C, I: I, N: nine.center,
      incircle: incircle, nine: nine, ca: ca, cb: cb, cc: cc,
      Pa: Pa, Pb: Pb, Pc: Pc, Pi: Pi, F: F, valid: valid,
    };
  }

  /** The applet's canvas opening triangle, for a WIDTH x HEIGHT drawing. */
  function initialPoints(width, height) {
    const w = width || WIDTH, h = height || HEIGHT;
    const r = Math.floor(Math.min(w, h) / 4); // Java's int division, then i2d
    return {
      A: point(w / 2 + r * Math.cos(-1.6), h / 2 + r * Math.sin(-1.6)),
      B: point(40, h - 40),
      C: point(w / 2 + r * Math.cos(-0.2), h / 2 + r * Math.sin(-0.2)),
    };
  }

  function start(options) {
    const o = options || {};
    const width = o.width || WIDTH, height = o.height || HEIGHT;
    return Object.assign({
      width: width, height: height,
      showNames: false, showCircles: false, showLines: false, showLine: false,
    }, initialPoints(width, height));
  }

  function reset(state) {
    return Object.assign({}, state, initialPoints(state.width, state.height));
  }

  /** The checkbox gating in FeuerbachIncidencePanel.itemStateChanged. */
  function flags(state) {
    return {
      showNames: !!state.showNames,
      showCircles: !!state.showCircles,
      showLines: !!state.showLines && !!state.showCircles,
      showLine: !!state.showLine && !!state.showCircles,
    };
  }

  function movePoint(state, name, q) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    const p = point(
      Math.max(MARGIN, Math.min(state.width - MARGIN, q.x)),
      Math.max(MARGIN, Math.min(state.height - MARGIN, q.y)));
    return Object.assign({}, state, { [name]: p });
  }

  /** Distance of p from the infinite line through a and b, for the claims. */
  function lineError(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (!len) return Infinity;
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  }

  /** Sine of the angle between the lines (p,q) and (p,r): 0 when collinear. */
  function collinearError(p, q, r) {
    const u = dist(p, q), v = dist(p, r);
    if (!u || !v || !finite(q) || !finite(r)) return Infinity;
    return Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / (u * v);
  }

  /** Plain, serialisable position for the player's record and the tutor. */
  function position(state) {
    return {
      A: point(state.A.x, state.A.y), B: point(state.B.x, state.B.y),
      C: point(state.C.x, state.C.y), width: state.width, height: state.height,
      flags: flags(state),
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT,
    start: start, reset: reset, compute: compute, flags: flags,
    movePoint: movePoint, position: position, initialPoints: initialPoints,
    dist: dist, sqDist: sqDist, foot: foot, intersect: intersect,
    lineError: lineError, collinearError: collinearError,
  };
})();
