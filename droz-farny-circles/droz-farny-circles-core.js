"use strict";

/*
 * DrozFarnyCirclesCore — Alexander Bogomolny's "Droz-Farny Circles".
 *
 * A triangle ABC, a point P and its isogonal conjugate Q. Drop perpendiculars
 * from P to the three side *lines*, giving Pa, Pb, Pc. The circles centred at
 * those feet and passing through Q cut the side lines in six points; all six
 * lie on one circle centred at P. Swapping P and Q gives another circle, and
 * the two have the same radius. The key fact behind both is that the pedal
 * circle of two isogonal conjugates has diameter PQ, so PaM = PQ/2 for the
 * midpoint M of PQ; then the median formula gives PY = PQ.
 *
 * The geometry follows the applet's bytecode: DrawArcs builds Q by rotating
 * the far side at each corner by the signed angle VP makes with the near side,
 * then intersecting the lines at A and B; GeoSDoub.NearestPoint gives the feet,
 * GeoSDoub.Intersect(circle, line) gives the cut points, and GetCircle takes
 * the circumcentre of three of them with the mean of the three radii. The
 * applet's two tolerances are kept: within 2 pixels of the circumcircle there
 * is no Q, and two lines with determinant under 1 "meet" at NaN.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const DrozFarnyCirclesCore = (() => {
  const NEAR_CIRCLE = 2;            // pixels: the applet's "P is on the circle"
  const WIDTH = 400, HEIGHT = 250;  // the applet's suggested size

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** GeoSDoub.FindOrientation: +1 for a positive signed area, else -1. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(o, p, q): orientation * law-of-cosines angle. */
  function signedAngle(o, p, q) {
    const op = distance(o, p), oq = distance(o, q);
    if (!op || !oq) return 0;
    const cs = (sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / (2 * op * oq);
    return orientation(o, p, q) * Math.acos(Math.max(-1, Math.min(1, cs)));
  }

  /** GeoSDoub.Rotate: rotate q about p by angle * handedness (radians). */
  function rotate(p, q, angle, handedness) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: p.x + cs * (q.x - p.x) - handedness * sn * (q.y - p.y),
      y: p.y + handedness * sn * (q.x - p.x) + cs * (q.y - p.y),
    };
  }

  /** GeoSDoub.Intersect of two lines; NaN point when |det| < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter: the intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const o1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const o2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersect(m1, o1, m2, o2);
  }

  /** The applet's GetCircle: centre from three points, mean of three radii. */
  function circle(p, q, r) {
    const center = circumcenter(p, q, r);
    const rad = (distance(center, p) + distance(center, q) + distance(center, r)) / 3;
    return { center, r: rad };
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot on the infinite line ab. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /**
   * GeoSDoub.Intersect(DoubCircle(c,r), DoubLine(a,b)): two cut points in the
   * applet's order, or null when the line misses. It solves for y when the
   * line is steep and for x when it is nearly horizontal, exactly as the
   * bytecode's IntersectX / IntersectY do.
   */
  function circleLinePoints(c, r, a, b) {
    if (Math.abs(a.y - b.y) > 1) {
      const k = (a.x - b.x) / (a.y - b.y);   // x = k*y + d
      const d = b.x - k * b.y;
      const A = k * k + 1;
      const B = k * (d - c.x) - c.y;
      const C = c.y * c.y + (d - c.x) ** 2 - r * r;
      const disc = B * B - A * C;
      if (disc < 0) return null;
      const root = Math.sqrt(disc), t1 = (-B + root) / A, t2 = (-B - root) / A;
      return [{ x: k * t1 + d, y: t1 }, { x: k * t2 + d, y: t2 }];
    }
    if (Math.abs(a.x - b.x) > 1) {
      const k = (a.y - b.y) / (a.x - b.x);   // y = k*x + d
      const d = b.y - k * b.x;
      const A = k * k + 1;
      const B = k * (d - c.y) - c.x;
      const C = c.x * c.x + (d - c.y) ** 2 - r * r;
      const disc = B * B - A * C;
      if (disc < 0) return null;
      const root = Math.sqrt(disc), t1 = (-B + root) / A, t2 = (-B - root) / A;
      return [{ x: t1, y: k * t1 + d }, { x: t2, y: k * t2 + d }];
    }
    return null;
  }

  /**
   * DrawMatchingArcs(P, V, X, Y): the signed angle at V from VP to VX, and the
   * point R with VR making that same angle with VY. Returns both angles too.
   */
  function matching(P, V, X, Y) {
    const first = signedAngle(V, P, X);
    const R = rotate(V, Y, first, 1);
    return { vertex: V, from: X, to: Y, R, angle: first, matched: signedAngle(V, Y, R) };
  }

  /** DrawMatchingArcsWithComparison(P, C, B, A): start from the nearer side. */
  function matchingAtC(P, C, B, A) {
    const toB = signedAngle(C, P, B), toA = signedAngle(C, P, A);
    return Math.abs(toB) < Math.abs(toA) ? matching(P, C, B, A) : matching(P, C, A, B);
  }

  /** The canvas's init(): A, B, C on a circle, P at (A + 3B + 5C)/9. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      const p = o.points;
      return { A: { ...p.A }, B: { ...p.B }, C: { ...p.C }, P: { ...p.P } };
    }
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const cx = w / 2, cy = h / 2, r = Math.floor(Math.min(w, h) / 3);
    const at = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    const A = at(-1.6), B = at(-4.0), C = at(0.5);
    const mix = (a, b, c) => (a + 3 * b + 5 * c) / 9;
    return {
      A, B, C,
      P: { x: mix(A.x, B.x, C.x), y: mix(A.y, B.y, C.y) },
    };
  }

  /** A new position with one named point moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, P: { ...s.P } };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Every corner moved by (dx, dy) — the applet's MoveablePoly drags ABC. */
  function shiftTriangle(s, dx, dy) {
    const mv = (p) => ({ x: p.x + dx, y: p.y + dy });
    return { A: mv(s.A), B: mv(s.B), C: mv(s.C), P: { ...s.P } };
  }

  function isDegenerate(s) {
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7;
  }

  /** Three cut points for a foot group, in the applet's side order BC, CA, AB. */
  function cutGroup(feet, through, s) {
    const pairs = [
      [feet.a, s.B, s.C],
      [feet.b, s.C, s.A],
      [feet.c, s.A, s.B],
    ];
    return pairs.map(([f, x, y]) => circleLinePoints(f, distance(f, through), x, y));
  }

  /** The isogonal conjugate from barycentrics a²/α : b²/β : c²/γ. */
  function conjugate(s, P) {
    const a2 = sqDist(s.B, s.C), b2 = sqDist(s.C, s.A), c2 = sqDist(s.A, s.B);
    const al = cross(P, s.B, s.C), be = cross(s.A, P, s.C), ga = cross(s.A, s.B, P);
    const u = a2 * be * ga, v = b2 * al * ga, w = c2 * al * be;
    const sum = u + v + w;
    if (Math.abs(sum) < 1e-12 * (Math.abs(u) + Math.abs(v) + Math.abs(w))) return null;
    return {
      x: (u * s.A.x + v * s.B.x + w * s.C.x) / sum,
      y: (u * s.A.y + v * s.B.y + w * s.C.y) / sum,
    };
  }

  /** Everything the applet draws, in its own order. */
  function measurements(s) {
    const lines = {
      A: matching(s.P, s.A, s.B, s.C),
      B: matching(s.P, s.B, s.A, s.C),
      C: matchingAtC(s.P, s.C, s.B, s.A),
    };
    const circum = circle(s.A, s.B, s.C);
    const gap = Math.abs(distance(s.P, circum.center) - circum.r);
    const onCircle = gap < NEAR_CIRCLE;
    const rawQ = onCircle ? null : intersect(s.A, lines.A.R, s.B, lines.B.R);
    const Q = finite(rawQ) ? rawQ : null;

    const Pfeet = { a: foot(s.P, s.B, s.C), b: foot(s.P, s.C, s.A), c: foot(s.P, s.A, s.B) };
    const Qfeet = Q ? { a: foot(Q, s.B, s.C), b: foot(Q, s.C, s.A), c: foot(Q, s.A, s.B) } : null;
    const Pcuts = Q ? cutGroup(Pfeet, Q, s) : [null, null, null];
    const Qcuts = Q ? cutGroup(Qfeet, s.P, s) : [null, null, null];

    const first = (cuts) => cuts.map((c) => c && c[0]);
    const Pbig = first(Pcuts).every(Boolean) ? circle(...first(Pcuts)) : null;
    const Qbig = first(Qcuts).every(Boolean) ? circle(...first(Qcuts)) : null;
    const M = Q ? midpoint(s.P, Q) : null;
    const pedalR = Q ? distance(M, Pfeet.a) : null;
    const PQ = Q ? distance(s.P, Q) : null;
    const formulaR = Q ? Math.sqrt(2 * pedalR ** 2 + PQ ** 2 / 2) : null;

    return {
      lines, circum, gap, onCircle, Q,
      feet: { P: Pfeet, Q: Qfeet },
      cuts: { P: Pcuts, Q: Qcuts },
      big: { P: Pbig, Q: Qbig },
      M, pedalR, PQ, formulaR,
      allCuts: {
        P: Pcuts.filter(Boolean).flat(),
        Q: Qcuts.filter(Boolean).flat(),
      },
      degenerate: isDegenerate(s) || !finite(circum.center),
    };
  }

  /** The page's claims, measured at one position (with room for rounding). */
  function claims(s) {
    const m = measurements(s);
    if (m.degenerate || !m.Q) return { applicable: false };
    const scale = Math.max(distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A));
    const tol = 1e-6 * Math.max(scale, m.PQ);
    const near = (a, b) => Math.abs(a - b) <= tol;

    // Every cut point of a circle centred at a P-foot is the same distance
    // R from P; the Q-foot cut points are that same distance R from Q.
    const onP = m.allCuts.P.length === 6 && m.allCuts.P.every((y) => near(distance(s.P, y), m.formulaR));
    const onQ = m.allCuts.Q.length === 6 && m.allCuts.Q.every((y) => near(distance(m.Q, y), m.formulaR));
    // The applet's own reconstructed circles: centres P, Q and equal radii.
    const centerP = m.big.P && distance(m.big.P.center, s.P) <= tol;
    const centerQ = m.big.Q && distance(m.big.Q.center, m.Q) <= tol;
    const equalR = Boolean(m.big.P && m.big.Q && near(m.big.P.r, m.big.Q.r));
    // The page's formula (1), with PaM the radius of the common pedal circle.
    const pedalRadii = [m.feet.P.a, m.feet.P.b, m.feet.P.c].map((f) => distance(f, m.M));
    const pedalQ = [m.feet.Q.a, m.feet.Q.b, m.feet.Q.c].map((f) => distance(f, m.M));
    const pedal = pedalRadii.every((r) => near(r, m.pedalR)) && pedalQ.every((r) => near(r, m.pedalR));
    const formula = near(m.formulaR ** 2, 2 * m.pedalR ** 2 + m.PQ ** 2 / 2);
    return {
      applicable: true, onP, onQ, centerP, centerQ, equalR, pedal, formula,
      cutsP: m.allCuts.P.length, cutsQ: m.allCuts.Q.length,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    NEAR_CIRCLE, WIDTH, HEIGHT,
    start, withPoint, shiftTriangle, isDegenerate, result,
    distance, sqDist, cross, orientation, signedAngle, rotate, intersect,
    circumcenter, circle, foot, circleLinePoints, matching, matchingAtC,
    conjugate, cutGroup, measurements, claims, finite, midpoint,
  };
})();
