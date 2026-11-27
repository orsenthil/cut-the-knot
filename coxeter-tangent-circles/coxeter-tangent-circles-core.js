"use strict";

/*
 * Coxeter's tangent circles, from Alexander Bogomolny's applet
 * CoxeterTangentCircles and its cut-the-knot page "Two Quadruplets of
 * Tangent Circles". Drag the centres A, B and C: their radii are taken from
 * the distances between them, so the three circles touch pairwise. A fourth
 * circle (the small one in the gap, or the enclosing one) completes the first
 * quadruplet. The six touching points then determine another four circles,
 * and Beecroft's theorem says that those four touch each other at the very
 * same six points.
 *
 * The key idea is that the radical centre of the three circles is the
 * incenter of the triangle of their centres. Its equal powers give the
 * common tangent lengths, and the incircle through the three touching points
 * is orthogonal to all three circles. ApolloniusCircle.Compute solves the
 * linear equations for the centre of a circle tangent to the three given
 * ones (with G, I the radical centre), then a quadratic for its radius.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, CoxeterTangentCirclesCore. The position is plain data: three
 * points in board units and the choice of inner or outer family.
 */

const CoxeterTangentCirclesCore = (() => {
  // CoxeterTangentCirclesCanvas.init: the canvas centre, and a starting
  // distance of min(width, height)/5 at angles -1.6, -4.0 and -0.2 radians.
  const WIDTH = 480;
  const HEIGHT = 320;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;
  const SCALE = Math.min(WIDTH, HEIGHT) / 5;
  const EDGE = 4;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const number = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  function at(angle) {
    return { x: CX + SCALE * Math.cos(angle), y: CY + SCALE * Math.sin(angle) };
  }

  const START = { A: at(-1.6), B: at(-4.0), C: at(-0.2) };

  /** The applet's opening figure, or a caller's three points, clamped on board. */
  function start(options) {
    const o = options || {};
    const point = (v, d) => ({
      x: clamp(number(v && v.x, d.x), EDGE, WIDTH - EDGE),
      y: clamp(number(v && v.y, d.y), EDGE, HEIGHT - EDGE),
    });
    return {
      A: point(o.A, START.A),
      B: point(o.B, START.B),
      C: point(o.C, START.C),
      innerCircle: o.innerCircle !== false,
    };
  }

  /** Drag one centre; the other two and the family choice are untouched. */
  function setPoint(state, name, q) {
    const s = start(state);
    if (!q || (name !== "A" && name !== "B" && name !== "C")) return s;
    const next = pointFrom(q, name === "A" ? START.A : name === "B" ? START.B : START.C);
    return Object.assign({}, s, { [name]: next });
  }

  function pointFrom(v, d) {
    return {
      x: clamp(number(v.x, d.x), EDGE, WIDTH - EDGE),
      y: clamp(number(v.y, d.y), EDGE, HEIGHT - EDGE),
    };
  }

  /** The shared radio choice: inner circle (true) or enclosing circle (false). */
  function setFamily(state, innerCircle) {
    return Object.assign({}, start(state), { innerCircle: !!innerCircle });
  }

  /** A compact, JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const s = start(state);
    const round = (p) => ({ x: Number(p.x.toFixed(6)), y: Number(p.y.toFixed(6)) });
    return { A: round(s.A), B: round(s.B), C: round(s.C), innerCircle: s.innerCircle };
  }

  // GeoSDoub.SqDist followed by Math.sqrt, in the applet's own operation order.
  const dist = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));

  /** DoubCircle.GetRadius / CInfo from CTKGeometry. */
  const radiusOf = (c) => c.r;
  const cInfo = (c) => c.x * c.x + c.y * c.y - c.r * c.r;

  /*
   * ApolloniusCircle.SetCircles and Compute, transcribed from the bytecode.
   * SetCircles stores the three circles and solves the two linear equations
   *       A1*x + B1*y = -D1 + V1*R
   *       A2*x + B2*y = -D2 + V2*R
   * for a centre (G + X*R, I + Y*R). Compute substitutes this into the first
   * circle's tangency equation and solves the quadratic for the signed R;
   * DoubCircle stores |R| as its radius.
   */
  function apollonius(c0, c1, c2) {
    const A1 = 2 * (c1.x - c0.x);
    const A2 = 2 * (c2.x - c0.x);
    const B1 = 2 * (c1.y - c0.y);
    const B2 = 2 * (c2.y - c0.y);
    const o = cInfo(c0);
    const D1 = o - cInfo(c1);
    const D2 = o - cInfo(c2);
    const K = A1 * B2 - A2 * B1;
    const G = (B1 * D2 - B2 * D1) / K;
    const I = -(A1 * D2 - A2 * D1) / K;

    // TreatZeroDeterminant in the applet falls through to null in every case.
    if (Math.abs(K) < 0.01) {
      return { K, G, I, solutions: [null, null] };
    }

    function solutions(s0, s1, s2) {
      const V1 = 2 * (s0 * radiusOf(c0) - s1 * radiusOf(c1));
      const V2 = 2 * (s0 * radiusOf(c0) - s2 * radiusOf(c2));
      const X = (B1 * V2 - B2 * V1) / K;
      const Y = -(A1 * V2 - A2 * V1) / K;
      const T = X * X + Y * Y - 1;
      if (Math.abs(T) < 0.001) return [null, null];
      const t = 2 * (X * G + Y * I - X * c0.x - Y * c0.y + s0 * radiusOf(c0));
      const Q = G * G + I * I - 2 * G * c0.x - 2 * I * c0.y + o;
      const disc = t * t - 4 * T * Q;
      if (disc < 0) return [null, null];
      const root = Math.sqrt(disc);
      const make = (R) => ({ x: G + X * R, y: I + Y * R, r: Math.abs(R) });
      return [make((-t + root) / (2 * T)), make((-t - root) / (2 * T))];
    }

    return { K: K, G: G, I: I, solutions: solutions(1, 1, 1) };
  }

  /** GeoSDoub.FindCircumcenter: two lines through side midpoints, perpendicular to the sides. */
  function circumcenter(p, q, r) {
    const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const p1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const p2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    const rx = p1.x - m1.x, ry = p1.y - m1.y;
    const sx = p2.x - m2.x, sy = p2.y - m2.y;
    const cross = rx * sy - ry * sx;
    // GeoSDoub.Intersect returns NaN when |denominator| < 1.
    if (Math.abs(cross) < 1) return { x: NaN, y: NaN };
    const t = ((m2.x - m1.x) * sy - (m2.y - m1.y) * sx) / cross;
    return { x: m1.x + rx * t, y: m1.y + ry * t };
  }

  /** CoxeterTangentCirclesCanvas.GetCircle: circumcentre, then mean distance to the three points. */
  function getCircle(p, q, r) {
    const center = circumcenter(p, q, r);
    return {
      x: center.x,
      y: center.y,
      r: (dist(center, p) + dist(center, q) + dist(center, r)) / 3,
    };
  }

  /** Extend(P,Q,r): from P towards Q by the length r (canvas.Extend). */
  function extend(p, q, length) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!(d > 0)) return { x: NaN, y: NaN };
    return { x: p.x + (dx * length) / d, y: p.y + (dy * length) / d };
  }

  /** CommonPoint(c1,c2): the point r1 along the line from c1 towards c2. */
  function commonPoint(c1, c2) {
    return extend(c1, c2, radiusOf(c1));
  }

  const finiteCircle = (c) => !!c &&
    Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r) && c.r >= 0;
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /**
   * Everything the page draws, derived from the three centres. The three
   * radii come from the distances: ra = (AB + AC - BC)/2 and cyclically, so
   * AB = ra + rb whenever the points are not collinear.
   */
  function geometry(state) {
    const s = start(state);
    const A = s.A, B = s.B, C = s.C;
    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const circleA = { x: A.x, y: A.y, r: (-a + b + c) / 2 };
    const circleB = { x: B.x, y: B.y, r: (a - b + c) / 2 };
    const circleC = { x: C.x, y: C.y, r: (a + b - c) / 2 };

    const apo = apollonius(circleA, circleB, circleC);
    const circle = s.innerCircle ? apo.solutions[0] : apo.solutions[1];

    const original = [circleA, circleB, circleC];
    const positive = original.every((ci) => ci.r > 0);
    const valid = positive && finiteCircle(circle);

    // The six touching points the applet hands to GetCircle.
    const ABp = valid ? commonPoint(circleA, circleB) : null;
    const BCp = valid ? commonPoint(circleB, circleC) : null;
    const CAp = valid ? commonPoint(circleC, circleA) : null;
    const AKp = valid ? commonPoint(circle, circleA) : null;
    const BKp = valid ? commonPoint(circle, circleB) : null;
    const CKp = valid ? commonPoint(circle, circleC) : null;
    const six = [ABp, BCp, CAp, AKp, BKp, CKp];

    const pointsValid = six.every(finitePoint);
    const circleX = pointsValid ? getCircle(ABp, BCp, CAp) : null;
    const circleAB = pointsValid ? getCircle(AKp, BKp, ABp) : null;
    const circleBC = pointsValid ? getCircle(BKp, CKp, BCp) : null;
    const circleCA = pointsValid ? getCircle(CKp, AKp, CAp) : null;
    const second = [circleX, circleAB, circleBC, circleCA];
    const drawable = valid && pointsValid && second.every(finiteCircle);

    return {
      A: A, B: B, C: C,
      sides: { a: a, b: b, c: c },
      radii: { a: circleA.r, b: circleB.r, c: circleC.r },
      circles: original,
      circle: circle,
      radicalCenter: { x: apo.G, y: apo.I },
      determinant: apo.K,
      // Inradius of the triangle of centres: sqrt(ra*rb*rc/(ra+rb+rc)).
      inradius: positive
        ? Math.sqrt((circleA.r * circleB.r * circleC.r) /
          (circleA.r + circleB.r + circleC.r))
        : NaN,
      points: { ABp: ABp, BCp: BCp, CAp: CAp, AKp: AKp, BKp: BKp, CKp: CKp },
      second: second,
      valid: drawable,
    };
  }

  /** An illustration has no win or loss; the record sees no result class. */
  function result(state) {
    return null;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, CX: CX, CY: CY, SCALE: SCALE, EDGE: EDGE,
    START: START,
    start: start, setPoint: setPoint, setFamily: setFamily, position: position,
    apollonius: apollonius, geometry: geometry, result: result,
    dist: dist, circumcenter: circumcenter, getCircle: getCircle,
    extend: extend, commonPoint: commonPoint,
  };
})();
