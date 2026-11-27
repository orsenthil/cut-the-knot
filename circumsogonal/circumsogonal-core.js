"use strict";

/*
 * CircumsogonalCore — Bogomolny's "Isogonal image of the circumcircle".
 *
 * Triangle ABC and a point P. Reflect each of the lines PA, PB, PC in the
 * bisector of the angle at its vertex. The three reflected lines meet at the
 * isogonal conjugate Q of P — unless P lies on the circumcircle of ABC, when
 * they are parallel and "meet at infinity".
 *
 * The code follows CircumsogonalCanvas from the bytecode. DrawMatchingArcs
 * does not reflect in the bisector directly: it measures the signed angle at
 * the vertex V from VP to VX (one side) and rotates the other side VY by that
 * same angle, which lands on the reflection of VP. A and B use their sides in
 * a fixed order; at C, DrawMatchingArcsWithComparison starts from whichever
 * side makes the smaller angle with CP (the same line either way). Q is the
 * applet's GeoSDoub.Intersect of the lines at A and B. When P is within 2
 * pixels of the circumcircle (the circle's radius being the applet's average
 * of the three centre-to-vertex distances) the applet draws no Q and marks
 * the two angles at C instead.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const CircumsogonalCore = (() => {
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
    const cos = Math.max(-1, Math.min(1, (sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / (2 * op * oq)));
    return orientation(o, p, q) * Math.acos(cos);
  }

  /** GeoSDoub.Rotate: rotate q about p by angle * handedness. */
  function rotate(p, q, angle, handedness) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: p.x + cs * (q.x - p.x) - handedness * sn * (q.y - p.y),
      y: p.y + handedness * sn * (q.x - p.x) + cs * (q.y - p.y),
    };
  }

  /** GeoSDoub.Intersect: two infinite lines; NaN when the determinant is < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const off1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const off2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersect(m1, off1, m2, off2);
  }

  /** Canvas.DrawCircle: centre, and the average of the three distances. */
  function circle(s) {
    const center = circumcenter(s.A, s.B, s.C);
    const r = (distance(center, s.A) + distance(center, s.B) + distance(center, s.C)) / 3;
    return { center, r };
  }

  /**
   * DrawMatchingArcs(P, V, X, Y): the angle from VP to VX, and the point R
   * with VR making that same angle with VY. Returns both angles too.
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

  /** The canvas's init(): four points on one circle about the centre. */
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
    return { A: at(-1.6), B: at(-4.0), C: at(-0.2), P: at(-3.0) };
  }

  /** A new position with one named point moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, P: { ...s.P } };
    if (next[name]) next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Every point moved by (dx, dy) — the applet's MoveablePoly drags A, B, C. */
  function shiftTriangle(s, dx, dy) {
    const mv = (p) => ({ x: p.x + dx, y: p.y + dy });
    return { A: mv(s.A), B: mv(s.B), C: mv(s.C), P: { ...s.P } };
  }

  function isDegenerate(s) {
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7;
  }

  /** Everything the page draws, in the applet's order. */
  function measurements(s) {
    const lineA = matching(s.P, s.A, s.B, s.C);
    const lineB = matching(s.P, s.B, s.A, s.C);
    const lineC = matchingAtC(s.P, s.C, s.B, s.A);
    const circ = circle(s);
    const gap = Math.abs(distance(s.P, circ.center) - circ.r);
    const onCircle = gap < NEAR_CIRCLE;
    const Q = onCircle ? null : intersect(s.A, lineA.R, s.B, lineB.R);
    return {
      lines: { A: lineA, B: lineB, C: lineC },
      circle: circ,
      gap,
      onCircle,
      // The two angles the applet marks at C when P is on the circle.
      parallelArcs: onCircle ? [
        { vertex: s.C, from: s.B, to: s.P, angle: signedAngle(s.C, s.B, s.P) },
        { vertex: s.C, from: s.A, to: s.P, angle: signedAngle(s.C, s.A, s.P) },
      ] : [],
      Q: Q && finite(Q) ? Q : null,
      degenerate: isDegenerate(s) || !finite(circ.center),
    };
  }

  /** Distance from p to the infinite line through x and y. */
  function distToLine(p, x, y) {
    const len = distance(x, y);
    return len ? Math.abs(cross(x, y, p)) / len : Infinity;
  }

  /** The angle (0..PI/2) between two line directions. */
  function lineAngle(p1, p2, q1, q2) {
    const ux = p2.x - p1.x, uy = p2.y - p1.y, vx = q2.x - q1.x, vy = q2.y - q1.y;
    const c = Math.abs(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return Math.acos(Math.min(1, c));
  }

  /** Isogonal conjugate from barycentrics a^2/alpha : b^2/beta : c^2/gamma. */
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

  /** The page's claims, measured at this position. */
  function claims(s) {
    const m = measurements(s);
    const L = m.lines;
    const scale = Math.max(distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A));
    const tol = 1e-6 * scale;
    // Each line is the reflection of VP in the bisector: same angle, other side.
    const reflected = [L.A, L.B, L.C].every((l) => Math.abs(l.angle - l.matched) < 1e-7);
    const exact = conjugate(s, s.P);
    const meet = m.Q || (exact && finite(exact) ? exact : null);
    const concurrent = !m.onCircle && meet !== null &&
      [L.A, L.B, L.C].every((l) => distToLine(meet, l.vertex, l.R) <= tol * Math.max(1, distance(meet, s.A) / scale));
    const parallel = m.onCircle &&
      Math.max(lineAngle(s.A, L.A.R, s.B, L.B.R), lineAngle(s.A, L.A.R, s.C, L.C.R)) < 0.05;
    return { reflected, concurrent, parallel, onCircle: m.onCircle, Q: m.Q, exact };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    NEAR_CIRCLE, WIDTH, HEIGHT,
    start, withPoint, shiftTriangle, isDegenerate, distance, cross,
    orientation, signedAngle, rotate, intersect, circumcenter, circle,
    matching, matchingAtC, measurements, distToLine, lineAngle, conjugate,
    claims, result,
  };
})();
