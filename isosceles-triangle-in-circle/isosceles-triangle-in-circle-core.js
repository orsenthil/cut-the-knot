"use strict";

/*
 * Isosceles Triangle In Circle — the geometry behind Alexander Bogomolny's
 * applet IsoscelesTriangleInCircle (cut-the-knot.org/Curriculum/Geometry/
 * IsoscelesTriangleInCircle.shtml).
 *
 * Triangle ABC can be dragged. D is the midpoint of AB, E is the centroid of
 * triangle ACD, and O is the circumcenter of ABC. The page asks us to prove
 * that EO is perpendicular to CD exactly when AB = AC.
 *
 * The one idea the code relies on is a dot-product identity. Put the origin at
 * O. Then |A| = |B| = |C|, D = (A + B)/2 and E = (3A + 2C + B)/6, so
 *
 *     (E - O)·(D - C) = (1/3) A·(B - C) = (AC² - AB²)/6.
 *
 * The perpendicular and the equal sides therefore stand or fall together;
 * the same identity says both are equivalent to AO ⟂ BC. IsoscelesTriangleInCircleCanvas
 * computes D, E, O, P, M, S, F, H and the line EO exactly as the `measure`
 * function below does, and CheckFinished calls the triangle isosceles when
 * |AB - AC| < 1 (one screen pixel).
 *
 * This is the logic and nothing else: no document, no window, no storage. It
 * defines one global, IsoscelesTriangleInCircleCore, so the page loads it with
 * a plain <script> and porting/check-isosceles-triangle-in-circle.mjs loads it
 * in Node. Positions are plain data and no function changes what it is given.
 */
const IsoscelesTriangleInCircleCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const average = (p, q, r) => ({
    x: (p.x + q.x + r.x) / 3,
    y: (p.y + q.y + r.y) / 3,
  });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /* GeoSDoub.Intersect: lines p->q and r->s in ax + by + c form. The applet
     treats a determinant smaller than one user unit as parallel. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x;
    const c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x;
    const c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /* GeoSDoub.FindCircumcenter: intersect the perpendicular bisectors of AB
     and BC, as in the other geometry ports of this applet's library. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b);
    const m2 = midpoint(b, c);
    const n1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const n2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, n1, m2, n2);
  }

  /* IsoscelesTriangleInCircleCanvas.GetCircumcircle: the center is the
     circumcenter and the radius is the mean of the three distances to it. */
  function circumcircle(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!finite(center)) return null;
    const radius = (distance(center, a) + distance(center, b) + distance(center, c)) / 3;
    return Number.isFinite(radius) && radius > 0 ? { center, radius } : null;
  }

  /* GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular from p to
     the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS) return { x: a.x, y: a.y };
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** Starting picture, laid out exactly as IsoscelesTriangleInCircleCanvas.init. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    return {
      A: o.A ? { ...o.A } : { x: width / 1.5, y: height / 3.5 },
      B: o.B ? { ...o.B } : { x: width / 6, y: height * 5 / 6 },
      C: o.C ? { ...o.C } : { x: width * 5 / 6, y: (height * 5) / 6 },
      showNames: o.showNames === undefined ? false : !!o.showNames,
      showPremise: o.showPremise === undefined ? false : !!o.showPremise,
      showHint: o.showHint === undefined ? false : !!o.showHint,
    };
  }

  /** Move one of the three corners, or change one of the three checkboxes. */
  function withPoint(s, name, p) {
    if (!["A", "B", "C"].includes(name) || !p ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    return { ...s, [name]: { x: p.x, y: p.y } };
  }

  function withOption(s, name, value) {
    if (!["showNames", "showPremise", "showHint"].includes(name)) return s;
    return { ...s, [name]: !!value };
  }

  /** A move is {name: "A"|"B"|"C", point: {x,y}} or an option change. */
  function move(s, m) {
    if (!m) return null;
    if (m.point) return withPoint(s, m.name, m.point);
    if (m.option) return withOption(s, m.option, m.value);
    return null;
  }

  /* Compute(): every point and line the applet draws, refreshed from A,B,C. */
  function measure(s) {
    const A = s.A, B = s.B, C = s.C;
    const D = midpoint(A, B);
    const E = average(A, D, C);
    const P = average(A, B, C);
    const circle = circumcircle(A, B, C);
    const O = circle ? circle.center : { x: NaN, y: NaN };
    const M = midpoint(B, C);
    const Am = midpoint(C, D);
    const S = midpoint(D, A);
    const F = midpoint(A, C);
    const H = foot(A, B, C);
    const AB = distance(A, B);
    const AC = distance(A, C);
    const BC = distance(B, C);
    const scale = Math.max(AB, AC, BC, 1);
    const eo = sub(E, O);
    const dc = sub(D, C);
    return {
      A, B, C, D, E, P, O, M, Am, S, F, H,
      circle, AB, AC, BC, scale,
      diff: Math.abs(AB - AC),
      eo, dc,
      dot: finite(O) ? dot(eo, dc) : NaN,
      predicted: (AC * AC - AB * AB) / 6,
      aoDotBC: finite(O) ? dot(sub(A, O), sub(B, C)) : NaN,
      twiceArea: cross(sub(B, A), sub(C, A)),
    };
  }

  /** CheckFinished(): |AB - AC| < 1, a one-pixel tolerance, strictly. */
  function finished(s) {
    const m = measure(s);
    return m.diff < 1;
  }

  /**
   * The page's statement, tested numerically at one configuration. Every
   * tolerance scales with the triangle, so dragging far away changes nothing.
   */
  function claims(s) {
    const m = measure(s);
    const tol = 1e-8 * m.scale;
    const collinear = Math.abs(m.twiceArea) <= tol;
    const perp = finite(m.O) &&
      Math.abs(m.dot - m.predicted) <= tol * m.scale &&
      Math.abs(m.dot) <= tol * m.scale;
    const equalLegs = m.diff <= tol;
    const altitude = finite(m.H) && distance(m.H, m.M) <= tol &&
      Math.abs(m.aoDotBC) <= tol * m.scale;
    const definition = distance(m.D, midpoint(m.A, m.B)) <= tol &&
      distance(m.E, average(m.A, m.D, m.C)) <= tol &&
      finite(m.O) && Math.abs(distance(m.O, m.A) - distance(m.O, m.B)) <= tol &&
      Math.abs(distance(m.O, m.A) - distance(m.O, m.C)) <= tol;
    return {
      perpendicular: perp,
      equalLegs,
      equivalent: perp === equalLegs,
      altitude,
      definition,
      collinear,
      nondegenerate: finite(m.O) && !collinear,
      all: perp === equalLegs && definition && !collinear,
      residual: Math.abs(m.dot - m.predicted),
    };
  }

  /** An illustration has no win and no loss; Check the claim marks it done. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, HEIGHT, EPS,
    add, sub, mul, dot, cross, distance, midpoint, average, finite,
    intersect, circumcenter, circumcircle, foot,
    start, withPoint, withOption, move, measure, finished, claims, result,
  };
})();
