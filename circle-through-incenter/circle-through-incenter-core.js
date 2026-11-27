"use strict";

/*
 * CircleThroughIncenter — the circle through two vertices A, B of a triangle
 * and its incenter I, from Alexander Bogomolny's cut-the-knot applet.
 *
 * The applet computes I as the intersection of two rotated angle-bisector rays,
 * draws the circle through A, B, I, and marks X (its second meeting with AC)
 * and Y (its second meeting with BC). The theorem on the applet's page is
 * AX = BY: the circle cuts equal lengths off the two sides. The "hint" option
 * adds J, the second meeting of the circle with the bisector CI, and the
 * circle's centre. The summary article also lists three further properties,
 * all checked here: that centre lies on CI and on the circumcircle of ABC,
 * and a chord BE = AB is perpendicular to the line from B to the circumcenter.
 *
 * The one idea the code relies on: I is the weighted average of the corners
 * with weights equal to the opposite side lengths, and the centre of (ABI) is
 * the ordinary circumcenter of the three points A, B, I. Every straight line
 * through a circle is solved by dropping the perpendicular from its centre.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircleThroughIncenterCore, so the page loads it with a
 * plain <script> and porting/check-circle-through-incenter.mjs loads it in Node.
 * Positions are plain data and nothing passed in is changed.
 */
const CircleThroughIncenterCore = (() => {
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dotAt = (v, p, q) =>
    (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);

  function angleAt(v, p, q) {
    const len = dist(v, p) * dist(v, q);
    if (len < EPS) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dotAt(v, p, q) / len)));
  }

  function distToLine(p, a, b) {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs(cross(a, b, p)) / len;
  }

  const onLine = (p, a, b, tol) => distToLine(p, a, b) <= tol;

  /** Intersections of the infinite line pq with the circle, in either order. */
  function circleLine(c, r, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return [];
    const t = ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2;
    const f = { x: p.x + dx * t, y: p.y + dy * t };
    const h2 = r * r - ((c.x - f.x) ** 2 + (c.y - f.y) ** 2);
    if (h2 < 0) return [];
    const h = Math.sqrt(h2) / Math.sqrt(len2);
    return [
      { x: f.x - dx * h, y: f.y - dy * h },
      { x: f.x + dx * h, y: f.y + dy * h },
    ];
  }

  /** Intersections of two circles; no points when they do not meet. */
  function circleCircle(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
    if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = Math.max(0, r1 * r1 - a * a);
    const base = { x: c1.x + (dx * a) / d, y: c1.y + (dy * a) / d };
    const h = Math.sqrt(h2) / d;
    return [
      { x: base.x - dy * h, y: base.y + dx * h },
      { x: base.x + dy * h, y: base.y - dx * h },
    ];
  }

  /** The applet's Other(): the crossing farther than one pixel from ref. */
  function other(points, ref) {
    if (!points || !points.length) return null;
    if (dist(points[0], ref) < 1) return points[1] || points[0];
    return points[0];
  }

  /** The starting triangle, placed exactly as CircleThroughIncenterCanvas.init places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const width = o.width === undefined ? 600 : o.width;
    const height = o.height === undefined ? 450 : o.height;
    const radius = Math.min(width, height) / 4;
    const cx = width / 2, cy = height / 2;
    const at = (a) => ({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    return { A: at(-1.6), B: at(-4.0), C: at(-0.2) };
  }

  /** One named corner moved; the other two are untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  function sides(s) {
    return { a: dist(s.B, s.C), b: dist(s.C, s.A), c: dist(s.A, s.B) };
  }

  function isDegenerate(s) {
    const l = sides(s);
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7 ||
      Math.min(l.a, l.b, l.c) < EPS;
  }

  /** Side lengths are the barycentric weights of the incenter. */
  function incenter(s) {
    if (isDegenerate(s)) return null;
    const l = sides(s), sum = l.a + l.b + l.c;
    return {
      x: (l.a * s.A.x + l.b * s.B.x + l.c * s.C.x) / sum,
      y: (l.a * s.A.y + l.b * s.B.y + l.c * s.C.y) / sum,
    };
  }

  /** The circumcenter from the intersection of two perpendicular bisectors. */
  function circumcenter(A, B, Cc) {
    const d = 2 * (A.x * (B.y - Cc.y) + B.x * (Cc.y - A.y) + Cc.x * (A.y - B.y));
    if (Math.abs(d) < EPS) return null;
    const a2 = A.x * A.x + A.y * A.y;
    const b2 = B.x * B.x + B.y * B.y;
    const c2 = Cc.x * Cc.x + Cc.y * Cc.y;
    return {
      x: (a2 * (B.y - Cc.y) + b2 * (Cc.y - A.y) + c2 * (A.y - B.y)) / d,
      y: (a2 * (Cc.x - B.x) + b2 * (A.x - Cc.x) + c2 * (B.x - A.x)) / d,
    };
  }

  /** GetCircle(A, B, I): centre is the circumcenter, radius the mean distance. */
  function abiCircle(s) {
    if (isDegenerate(s)) return null;
    const I = incenter(s);
    const center = circumcenter(s.A, s.B, I);
    if (!center) return null;
    const radius = (dist(center, s.A) + dist(center, s.B) + dist(center, I)) / 3;
    return { center, radius };
  }

  /** A point E on (ABI), other than A, with BE = AB, if it exists. */
  function equalChordPoint(s) {
    const circle = abiCircle(s);
    if (!circle) return null;
    const hits = circleCircle({ x: s.B.x, y: s.B.y }, dist(s.A, s.B), circle.center, circle.radius);
    return other(hits.filter((p) => dist(p, circle.center) > 0), s.A);
  }

  function measure(s) {
    const bad = isDegenerate(s);
    const I = bad ? null : incenter(s);
    const circle = bad ? null : abiCircle(s);
    const Oc = circle && circle.center;
    const J = circle ? other(circleLine(circle.center, circle.radius, s.C, I), I) : null;
    const X = circle ? other(circleLine(circle.center, circle.radius, s.C, s.A), s.A) : null;
    const Y = circle ? other(circleLine(circle.center, circle.radius, s.C, s.B), s.B) : null;
    const O = bad ? null : circumcenter(s.A, s.B, s.C);
    const AX = X ? dist(s.A, X) : null;
    const BY = Y ? dist(s.B, Y) : null;
    return {
      A: s.A, B: s.B, C: s.C,
      degenerate: bad,
      sides: sides(s),
      I, J, X, Y, Oc, O,
      circle,
      circumradius: O ? dist(O, s.A) : null,
      AX, BY,
      equal: AX !== null && BY !== null,
      angleAIB: I ? angleAt(I, s.A, s.B) : null,
      angleACB: angleAt(s.C, s.A, s.B),
    };
  }

  /** Every claim made by the applet's page or its summary article. */
  function claims(s) {
    const m = measure(s);
    const empty = {
      equalChords: false, centerOnBisector: false, centerOnCircumcircle: false,
      symmetric: false, incenterEqualSides: false, JOnCircle: false,
      chordEqual: false, angleEqual: false, chordPerpendicular: false,
      redHerring: false,
    };
    if (m.degenerate) return empty;
    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-6 * scale;
    const I = m.I, Oc = m.Oc, circle = m.circle;
    const E = equalChordPoint(s);
    const close = (u, v) => Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= tol;
    const onCircle = (p) => p && close(dist(Oc, p), circle.radius);
    return {
      equalChords: close(m.AX, m.BY),
      centerOnBisector: onLine(Oc, s.C, I, tol),
      centerOnCircumcircle: m.O && close(dist(Oc, m.O), m.circumradius),
      symmetric: onCircle(s.A) && onCircle(s.B) && onCircle(I),
      incenterEqualSides:
        close(distToLine(I, s.A, s.B), distToLine(I, s.B, s.C)) &&
        close(distToLine(I, s.B, s.C), distToLine(I, s.C, s.A)),
      JOnCircle: m.J && onLine(m.J, s.C, I, tol) && onCircle(m.J),
      chordEqual: Boolean(E) && close(dist(s.B, E), dist(s.A, s.B)),
      angleEqual: Boolean(E) && close(angleAt(s.B, s.A, E), m.angleACB),
      chordPerpendicular: Boolean(E) && m.O &&
        Math.abs((E.x - s.B.x) * (m.O.x - s.B.x) + (E.y - s.B.y) * (m.O.y - s.B.y)) <= tol * scale,
      redHerring: Math.abs(m.sides.b - m.sides.a) <= tol
        ? Boolean(m.X && m.Y && dist(m.X, s.A) <= tol && dist(m.Y, s.B) <= tol)
        : true,
    };
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, sides, isDegenerate, incenter, circumcenter, abiCircle,
    circleLine, circleCircle, other, equalChordPoint, measure, claims,
    angleAt, distToLine, result,
  };
})();
