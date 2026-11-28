"use strict";

/*
 * In Ex Circum — the geometry behind Bogomolny's applet InExCircum.
 *
 * Drag the three corners of a triangle. The incenter I and the three excenters
 * Ia, Ib, Ic form four centres; the halfway points Ma, Mb, Mc of IIa, IIb, IIc
 * are claimed to lie on the circumcircle of ABC, and to be the midpoints of
 * the arcs they cross.
 *
 * The code relies on one idea: ABC is the orthic triangle of its excentral
 * triangle IaIbIc, and I is that triangle's orthocentre. Its nine-point circle
 * is therefore the circumcircle of ABC. The nine points are A, B, C (feet of
 * the altitudes), the midpoints of IaIbIc, and the Euler points (I+Ia)/2 etc.,
 * which are exactly Ma, Mb, Mc.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, InExCircumCore, so the page loads it with a plain
 * <script> and porting/check-in-ex-circum.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const InExCircumCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });

  /** The starting triangle, placed exactly as InExCircumCanvas.init places it. */
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
    return { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) };
  }

  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  /** The canvas stops computing when any side is shorter than two units. */
  function isDegenerate(s) {
    const { a, b, c } = sides(s);
    return Math.min(a, b, c) < 2 || doubleArea(s) < 1e-6;
  }

  /** Circumcentre from the perpendicular bisectors of two sides. */
  function circumcenter(p, q, r) {
    const d = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (Math.abs(d) < EPS) return null;
    const pp = p.x * p.x + p.y * p.y;
    const qq = q.x * q.x + q.y * q.y;
    const rr = r.x * r.x + r.y * r.y;
    return {
      x: (pp * (q.y - r.y) + qq * (r.y - p.y) + rr * (p.y - q.y)) / d,
      y: (pp * (r.x - q.x) + qq * (p.x - r.x) + rr * (q.x - p.x)) / d,
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
    // GeoSDoub.NearestPoint returns p itself within sqrt(0.1) of the first
    // endpoint; keep that harmless quirk from the bytecode.
    if (distance(p, x) * distance(p, x) < 0.1) return { x: p.x, y: p.y };
    const d = sub(y, x);
    const len2 = dot(d, d);
    if (len2 < EPS) return { x: p.x, y: p.y };
    return add(x, scale(d, dot(sub(p, x), d) / len2));
  }

  /** InExCircumCanvas.GetCircle: centre from three points, radius their mean distance. */
  function circleFrom3(p, q, r) {
    const center = circumcenter(p, q, r);
    if (!center) return null;
    const radius = (distance(center, p) + distance(center, q) + distance(center, r)) / 3;
    return { center, radius };
  }

  /** InExCircumCanvas.GetInTouchFrom: radius is the mean distance to the sides. */
  function touchCircle(center, s) {
    const radius =
      (distance(center, nearestPoint(center, s.B, s.C)) +
        distance(center, nearestPoint(center, s.C, s.A)) +
        distance(center, nearestPoint(center, s.A, s.B))) /
      3;
    return { center, radius };
  }

  /** The applet's Midpoint(DoubPoint, DoubPoint). */
  function midpoint(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  function midpoints(I, ex) {
    if (!I || !ex) return null;
    return { Ma: midpoint(I, ex.Ia), Mb: midpoint(I, ex.Ib), Mc: midpoint(I, ex.Ic) };
  }

  /** The two crossings of the line through p and q with a circle. */
  function circleLineIntersections(center, radius, p, q) {
    const d = sub(q, p);
    const f = sub(p, center);
    const A = dot(d, d);
    if (A < EPS) return [];
    const B = 2 * dot(f, d);
    const Cv = dot(f, f) - radius * radius;
    const disc = B * B - 4 * A * Cv;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    return [
      add(p, scale(d, (-B + root) / (2 * A))),
      add(p, scale(d, (-B - root) / (2 * A))),
    ];
  }

  /**
   * The midpoint of arc BC not containing A: the internal bisector AI leaves
   * the circle again at the point equidistant from B and C. Computed here from
   * the circle and the angle bisector, independently of the midpoint claim.
   */
  function arcMidpoints(s, m) {
    if (!m || !m.I || !m.circumcircle || !m.ex) return null;
    const pairs = [
      [s.A, s.B, s.C],
      [s.B, s.C, s.A],
      [s.C, s.A, s.B],
    ];
    const out = {};
    const names = ["Ma", "Mb", "Mc"];
    for (let i = 0; i < 3; i++) {
      const [vertex, p, q] = pairs[i];
      const hits = circleLineIntersections(m.circumcircle.center, m.circumcircle.radius, vertex, m.I);
      if (!hits.length) return null;
      // The far crossing lies on the arc cut off by the opposite side.
      hits.sort((u, v) => distance(vertex, v) - distance(vertex, u));
      out[names[i]] = hits.find((h) => Math.abs(distance(h, p) - distance(h, q)) < 1e-6 * (1 + distance(p, q))) || hits[0];
    }
    return out;
  }

  /** Everything needed to draw and describe the current diagram. */
  function measurements(s) {
    const lens = sides(s);
    const m = { A: s.A, B: s.B, C: s.C, sides: lens, doubleArea: doubleArea(s), degenerate: isDegenerate(s) };
    if (m.degenerate) return m;
    m.I = incenter(s);
    m.ex = excenters(s);
    if (!m.I || !m.ex || !Number.isFinite(m.I.x)) { m.degenerate = true; return m; }
    m.mid = midpoints(m.I, m.ex);
    m.incircle = touchCircle(m.I, s);
    m.excircles = {
      Ia: touchCircle(m.ex.Ia, s),
      Ib: touchCircle(m.ex.Ib, s),
      Ic: touchCircle(m.ex.Ic, s),
    };
    m.circumcircle = circleFrom3(s.A, s.B, s.C);
    if (!m.circumcircle) { m.degenerate = true; return m; }
    m.O = m.circumcircle.center;
    m.R = m.circumcircle.radius;
    m.arc = arcMidpoints(s, m);
    return m;
  }

  /** A generous but relative tolerance: excentres fly far away on thin triangles. */
  function tolerance(s, m) {
    const { a, b, c } = sides(s);
    let scaleLen = Math.max(a, b, c, 1);
    if (m && m.ex) {
      for (const ex of [m.ex.Ia, m.ex.Ib, m.ex.Ic]) {
        if (Number.isFinite(ex.x)) scaleLen = Math.max(scaleLen, distance(m.I, ex));
      }
    }
    return 4e-6 * scaleLen;
  }

  /** Each claim on the cut-the-knot page, checked at this triangle. */
  function claims(s) {
    const m = measurements(s);
    const all = { onCircle: false, arcMidpoint: false, orthic: false, orthocenter: false, ninePoint: false };
    if (m.degenerate || !m.mid || !m.arc || !m.O) return all;
    const tol = tolerance(s, m);
    const near = (x, y) => Math.abs(x - y) <= tol;
    const closePoint = (p, q) => Boolean(p && q && distance(p, q) <= tol);
    const { Ma, Mb, Mc } = m.mid;
    const { Ia, Ib, Ic } = m.ex;

    all.onCircle =
      near(distance(m.O, Ma), m.R) &&
      near(distance(m.O, Mb), m.R) &&
      near(distance(m.O, Mc), m.R);

    all.arcMidpoint =
      closePoint(Ma, m.arc.Ma) && closePoint(Mb, m.arc.Mb) && closePoint(Mc, m.arc.Mc);

    const footIs = (from, x, y, foot) =>
      closePoint(nearestPoint(from, x, y), foot) &&
      Math.abs(dot(sub(from, foot), sub(y, x))) <= tol * Math.max(distance(x, y), EPS);
    all.orthic =
      footIs(Ia, Ib, Ic, s.A) && footIs(Ib, Ic, Ia, s.B) && footIs(Ic, Ia, Ib, s.C);

    // The altitudes of IaIbIc meet at its orthocentre, which the claim says is I.
    all.orthocenter =
      Math.abs(dot(sub(Ia, m.I), sub(Ib, Ic))) <= tol * Math.max(distance(Ib, Ic), EPS) &&
      Math.abs(dot(sub(Ib, m.I), sub(Ic, Ia))) <= tol * Math.max(distance(Ic, Ia), EPS) &&
      Math.abs(dot(sub(Ic, m.I), sub(Ia, Ib))) <= tol * Math.max(distance(Ia, Ib), EPS);

    const nine = [s.A, s.B, s.C, midpoint(Ia, Ib), midpoint(Ib, Ic), midpoint(Ic, Ia), Ma, Mb, Mc];
    all.ninePoint = nine.every((p) => p && near(distance(m.O, p), m.R));
    return all;
  }

  /** A new position with one named corner moved; the input is never changed. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  function legalMoves(/* state */) {
    return ["A", "B", "C"];
  }

  function move(state, m) {
    if (!m || !state) return null;
    if (!Object.prototype.hasOwnProperty.call(state, m.name)) return null;
    return withPoint(state, m.name, m.point);
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, distance, dot, cross, add, sub, scale,
    start, sides, doubleArea, isDegenerate, circumcenter,
    incenter, excenters, nearestPoint, circleFrom3, touchCircle,
    midpoint, midpoints, circleLineIntersections, arcMidpoints,
    measurements, tolerance, claims, withPoint, legalMoves, move, result,
  };
})();
