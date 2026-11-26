"use strict";

/*
 * Bevan Point — the geometry behind Bogomolny's applet BevanPoint.
 *
 * Drag the three corners of a triangle. The excentres form a second triangle;
 * its circumcentre V is the Bevan point. The page claims that the incenter I,
 * the circumcentre O and V are collinear with O midway between I and V, that
 * the excentral circumcircle has twice the radius of ABC's circumcircle, that
 * VIa, VIb, VIc are perpendicular to BC, CA, AB, that I and V are equally far
 * from the Euler line, and that ABC's circumcircle is the nine-point circle
 * of the excentral triangle.
 *
 * The code relies on one idea: ABC is the orthic triangle of its excentral
 * triangle, so I is the orthocentre of IaIbIc. Hence the nine-point circle of
 * IaIbIc is the circumcircle of ABC, whose centre O is the midpoint of IV and
 * whose radius is half the excentral circumradius.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BevanPointCore, so the page loads it with a plain
 * <script> and porting/check-bevan-point.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BevanPointCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });

  /** The starting triangle, placed exactly as BevanPointCanvas.init places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const w = o.width === undefined ? 400 : o.width;
    const h = o.height === undefined ? 300 : o.height;
    return {
      A: { x: (w * 2) / 5, y: (h * 2) / 3 },
      B: { x: (w * 3) / 5, y: (h * 2) / 3 },
      C: { x: w / 2 - 20, y: h / 2 },
    };
  }

  /** a = |BC|, b = |CA|, c = |AB|, in the applet's notation. */
  function sides(s) {
    return {
      a: distance(s.B, s.C),
      b: distance(s.C, s.A),
      c: distance(s.A, s.B),
    };
  }

  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  /** The applet stops computing when any side is shorter than two units. */
  function isDegenerate(s) {
    const { a, b, c } = sides(s);
    return Math.min(a, b, c) < 2 || doubleArea(s) < 1e-6;
  }

  /** Circumcentre from the perpendicular bisectors of two sides. */
  function circumcenter(p, q, r) {
    const d = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (Math.abs(d) < EPS) return null;
    const pq = p.x * p.x + p.y * p.y;
    const qq = q.x * q.x + q.y * q.y;
    const rq = r.x * r.x + r.y * r.y;
    return {
      x: (pq * (q.y - r.y) + qq * (r.y - p.y) + rq * (p.y - q.y)) / d,
      y: (pq * (r.x - q.x) + qq * (p.x - r.x) + rq * (q.x - p.x)) / d,
    };
  }

  /** Side lengths as barycentric weights: I is inside, each excentre outside. */
  function incenter(s) {
    const { a, b, c } = sides(s);
    const t = a + b + c;
    if (t < EPS) return null;
    return scale(add(add(scale(s.A, a), scale(s.B, b)), scale(s.C, c)), 1 / t);
  }

  function excenters(s) {
    const { a, b, c } = sides(s);
    const da = -a + b + c;
    const db = a - b + c;
    const dc = a + b - c;
    if (Math.min(Math.abs(da), Math.abs(db), Math.abs(dc)) < EPS) return null;
    return {
      Ia: scale(add(add(scale(s.A, -a), scale(s.B, b)), scale(s.C, c)), 1 / da),
      Ib: scale(add(add(scale(s.A, a), scale(s.B, -b)), scale(s.C, c)), 1 / db),
      Ic: scale(add(add(scale(s.A, a), scale(s.B, b)), scale(s.C, -c)), 1 / dc),
    };
  }

  /** Foot of the perpendicular from p to the infinite line through x and y. */
  function nearestPoint(p, x, y) {
    // GeoSDoub.NearestPoint returns p itself when p is within sqrt(0.1) of
    // the line's first endpoint; keep that harmless quirk.
    if (distance(p, x) * distance(p, x) < 0.1) return { x: p.x, y: p.y };
    const d = sub(y, x);
    const len2 = dot(d, d);
    if (len2 < EPS) return { x: p.x, y: p.y };
    return add(x, scale(d, dot(sub(p, x), d) / len2));
  }

  function distToLine(p, x, y) {
    return distance(p, nearestPoint(p, x, y));
  }

  /**
   * GeoSDoub.GetCircle calls FindCircumcenter and then averages the three
   * distances from that centre. The average equals the radius up to rounding,
   * and keeping it reproduces the applet's numbers exactly.
   */
  function circleFrom3(p, q, r) {
    const center = circumcenter(p, q, r);
    if (!center) return null;
    const radius =
      (distance(center, p) + distance(center, q) + distance(center, r)) / 3;
    return { center, radius };
  }

  /** GeoSDoub.GetInTouchFrom: radius is the mean distance to the three side lines. */
  function touchCircle(center, s) {
    const radius =
      (distance(center, nearestPoint(center, s.B, s.C)) +
        distance(center, nearestPoint(center, s.C, s.A)) +
        distance(center, nearestPoint(center, s.A, s.B))) /
      3;
    return { center, radius };
  }

  /** Intersection of two lines, or null if they are parallel. */
  function lineIntersection(a, b, c, d) {
    const u = sub(b, a), v = sub(d, c);
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) < 1e-10) return null;
    const t = ((c.x - a.x) * v.y - (c.y - a.y) * v.x) / det;
    return add(a, scale(u, t));
  }

  /** Where the lines V-Ia, V-Ib, V-Ic cross the three sides of ABC. */
  function feet(s, V, ex) {
    if (!V || !ex) return null;
    return {
      Ea: lineIntersection(s.B, s.C, ex.Ia, V),
      Eb: lineIntersection(s.C, s.A, ex.Ib, V),
      Ec: lineIntersection(s.A, s.B, ex.Ic, V),
    };
  }

  /** The Euler line of ABC, through its circumcentre and centroid. */
  function eulerLine(s, O) {
    const G = {
      x: (s.A.x + s.B.x + s.C.x) / 3,
      y: (s.A.y + s.B.y + s.C.y) / 3,
    };
    if (!O || distance(O, G) < 1e-7) {
      // An equilateral ABC has no unique Euler line; I and V coincide with O
      // there, so any line through O gives the same two distances.
      return { O: G || O, G: { x: G.x + 1, y: G.y } };
    }
    return { O, G };
  }

  /** Everything needed to draw and describe the current diagram. */
  function measurements(s) {
    const lens = sides(s);
    const m = {
      A: s.A, B: s.B, C: s.C,
      sides: lens,
      doubleArea: doubleArea(s),
      degenerate: isDegenerate(s),
    };
    if (m.degenerate) return m;

    m.I = incenter(s);
    m.ex = excenters(s);
    if (!m.I || !m.ex) { m.degenerate = true; return m; }
    const { Ia, Ib, Ic } = m.ex;

    m.incircle = touchCircle(m.I, s);
    m.excircles = {
      Ia: touchCircle(Ia, s),
      Ib: touchCircle(Ib, s),
      Ic: touchCircle(Ic, s),
    };
    m.circumcircle = circleFrom3(s.A, s.B, s.C);
    m.O = m.circumcircle && m.circumcircle.center;
    m.R = m.circumcircle && m.circumcircle.radius;
    m.bevanCircle = circleFrom3(Ia, Ib, Ic);
    m.V = m.bevanCircle && m.bevanCircle.center;
    m.Re = m.bevanCircle && m.bevanCircle.radius;
    m.feet = feet(s, m.V, m.ex);
    m.euler = eulerLine(s, m.O);
    return m;
  }

  /** Each numbered claim on the applet's page, checked at this triangle. */
  function claims(s) {
    const m = measurements(s);
    const all = {
      midpoint: false, collinear: false, doubleRadius: false,
      perpendicular: false, eulerEquidistant: false, ninePoint: false,
    };
    if (m.degenerate || !m.V || !m.O || !m.I || !m.feet) return all;

    const scaleLen = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 2e-6 * scaleLen;
    const near = (x, y) => Math.abs(x - y) <= tol;
    const closePoint = (p, q) => p && q && distance(p, q) <= tol;
    const { Ia, Ib, Ic } = m.ex;

    all.midpoint = closePoint(scale(add(m.I, m.V), 0.5), m.O);
    all.collinear = cross(m.I, m.O, m.V) <= tol;
    all.doubleRadius = near(m.Re, 2 * m.R);

    const perpendicularTo = (from, to, x, y) =>
      Math.abs(dot(sub(from, to), sub(y, x))) <= tol * distance(x, y);
    all.perpendicular =
      m.feet.Ea !== null && m.feet.Eb !== null && m.feet.Ec !== null &&
      perpendicularTo(m.V, Ia, s.B, s.C) &&
      perpendicularTo(m.V, Ib, s.C, s.A) &&
      perpendicularTo(m.V, Ic, s.A, s.B);

    const { O, G } = m.euler;
    all.eulerEquidistant = near(distToLine(m.I, O, G), distToLine(m.V, O, G));

    // ABC is the orthic triangle of its excentral triangle: each original
    // corner is an altitude foot, and all three lie on the same circle.
    const orthicFoot = (from, x, y, foot) =>
      closePoint(nearestPoint(from, x, y), foot) &&
      Math.abs(dot(sub(from, foot), sub(y, x))) <= tol * distance(x, y);
    all.ninePoint =
      orthicFoot(Ia, Ib, Ic, s.A) &&
      orthicFoot(Ib, Ic, Ia, s.B) &&
      orthicFoot(Ic, Ia, Ib, s.C) &&
      near(distance(m.O, s.A), m.R) &&
      near(distance(m.O, s.B), m.R) &&
      near(distance(m.O, s.C), m.R);
    return all;
  }

  /** A new position with one named corner moved; input is never changed. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, distance, dot, cross, add, sub, scale,
    start, sides, doubleArea, isDegenerate, circumcenter,
    incenter, excenters, nearestPoint, distToLine, circleFrom3, touchCircle,
    lineIntersection, feet, eulerLine, measurements, claims, withPoint, result,
  };
})();
