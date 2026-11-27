"use strict";

/*
 * Four Feet On Bisectors — the geometry behind Bogomolny's applet of the same
 * name (FourFeetOnBisectors, classes/FourFeetOnBisectors.zip).
 *
 * At B and C draw both angle bisectors of triangle ABC. The internal and the
 * external bisector at one vertex are perpendicular. Drop perpendiculars from
 * the other vertex A onto all four lines: M and N land on the internal
 * bisectors at B and C, P and Q on the external ones. The page's claim is that
 * M, N, P and Q are collinear.
 *
 * The one idea the code relies on: the applet's own Compute() (declared in
 * FourFeetOnBisectorsCanvas) makes the four bisectors with GeoSDoub helpers and
 * takes the four nearest points to A on them. Those helpers are transcribed
 * here: FindAngleBisector (a rotation through half an angle), SetPerpLine,
 * NearestPoint (the projection onto a line) and Intersect (two lines), in the
 * same order as the bytecode. The excenters and the circle tests used for the
 * page's other claims are plain side-length formulas.
 *
 * This is the logic and nothing else: no document, no window, no storage. It
 * defines one global, FourFeetOnBisectorsCore, so the page loads it with a
 * plain <script> and porting/check-four-feet-on-bisectors.mjs loads it in Node.
 * Positions are plain data; no function changes what it is given.
 */
const FourFeetOnBisectorsCore = (() => {
  const EPS = 1e-9;
  const WIDTH = 500;   // the applet's WIDTH parameter (500 will do)
  const HEIGHT = 450;  // the applet's HEIGHT parameter (450)

  /* ------------------------------------------------------------ point maths */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  function unit(p) {
    const n = Math.hypot(p.x, p.y);
    return n < EPS ? { x: 1, y: 0 } : { x: p.x / n, y: p.y / n };
  }

  /** GeoSDoub.FindOrientation, straight from its bytecode. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn q around p through theta, signed by orientation. */
  function rotate(p, q, theta, sign) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return {
      x: p.x + c * (q.x - p.x) - sign * s * (q.y - p.y),
      y: p.y + sign * s * (q.x - p.x) + c * (q.y - p.y),
    };
  }

  /** GeoSDoub.ComputeAngle(A, B, C): the angle at the first point. */
  function computeAngle(p, q, r) {
    const den = 2 * dist(p, q) * dist(p, r);
    if (den < EPS) return NaN;
    const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / den;
    return Math.acos(clamp(c, -1, 1));
  }

  /** GeoSDoub.Intersect of two lines through pairs of points; NaN if parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - b.x * a.y;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - d.x * c.y;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // the applet's test
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /**
   * GeoSDoub.FindAngleBisector(p, q, r): turn q around p by half the angle at
   * p, then cut the line qr. The point returned lies on qr; the bisector is
   * the line through p and this point.
   */
  function angleBisectorOn(p, q, r) {
    const theta = computeAngle(p, q, r) / 2;
    const turned = rotate(p, q, theta, orientation(p, q, r));
    return intersect(p, turned, q, r);
  }

  /** The line through p and q, as a pair of points (as in the applet's DoubLine). */
  function line(p, q) {
    return { p: { x: p.x, y: p.y }, q: { x: q.x, y: q.y } };
  }

  /** FourFeetOnBisectorsCanvas.SetPerpLine: perpendicular to pq through p. */
  function perpLine(p, q) {
    return line(p, { x: p.x + q.y - p.y, y: p.y - (q.x - p.x) });
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular from p. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, b) < 0.1) return { x: p.x, y: p.y }; // applet's short-line guard
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function foot(p, l) {
    return nearestPoint(p, l.p, l.q);
  }

  /** Perpendicular distance from a point to an infinite line. */
  function distToLine(p, l) {
    const d = sub(l.q, l.p);
    if (Math.hypot(d.x, d.y) < EPS) return dist(p, l.p);
    return Math.abs(cross(d, sub(p, l.p))) / Math.hypot(d.x, d.y);
  }

  /** The angle at v, between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    const n = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (n < EPS) return NaN;
    return Math.acos(clamp(dot(u, w) / n, -1, 1));
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors meet. */
  function circumcenter(p, q, r) {
    const pq = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const qr = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const d1 = line(pq, { x: pq.x + q.y - p.y, y: pq.y - (q.x - p.x) });
    const d2 = line(qr, { x: qr.x + r.y - q.y, y: qr.y - (r.x - q.x) });
    return intersect(d1.p, d1.q, d2.p, d2.q);
  }

  /** GetCircle in the applet: circumcenter, radius the mean of the three distances. */
  function circleThrough(p, q, r) {
    const O = circumcenter(p, q, r);
    if (!finite(O)) return null;
    return { center: O, radius: (dist(O, p) + dist(O, q) + dist(O, r)) / 3 };
  }

  /** The incenter and the three excenters, weighted by the side lengths. */
  function centers(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const sum = a + b + c;
    if (sum < EPS) return null;
    const at = (sa, sb, sc) => ({
      x: (sa * a * A.x + sb * b * B.x + sc * c * C.x) / (sa * a + sb * b + sc * c),
      y: (sa * a * A.y + sb * b * B.y + sc * c * C.y) / (sa * a + sb * b + sc * c),
    });
    return { I: at(1, 1, 1), IA: at(-1, 1, 1), IB: at(1, -1, 1), IC: at(1, 1, -1) };
  }

  /* ------------------------------------------------------------- the position */

  /** A new position: the same three points the applet places in its canvas. */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    return {
      A: { x: (2 * w) / 5, y: h / 3 },
      B: { x: w / 3, y: (4 * h) / 5 },
      C: { x: (2 * w) / 3, y: (4 * h) / 5 },
    };
  }

  /** A new position with one named corner moved; the old one is untouched. */
  function withPoint(s, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return s;
    const next = {
      A: { x: s.A.x, y: s.A.y },
      B: { x: s.B.x, y: s.B.y },
      C: { x: s.C.x, y: s.C.y },
    };
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /* ---------------------------------------------------- the applet's Compute */

  /**
   * FourFeetOnBisectorsCanvas.Compute(), in the bytecode's order:
   *   footB = FindAngleBisector(B, A, C); Bi = B -- footB; Be = perp at B;
   *   footC = FindAngleBisector(C, A, B); Ci = C -- footC; Ce = perp at C;
   *   M = NearestPoint(A, Bi); N = NearestPoint(A, Ci);
   *   P = NearestPoint(A, Be); Q = NearestPoint(A, Ce);
   *   I = Intersect(Bi, Ci);    Line = P -- Q.
   */
  function construction(s) {
    const A = s.A, B = s.B, C = s.C;
    const bad = { ok: false, degenerate: true, footB: null, footC: null,
      Bi: null, Be: null, Ci: null, Ce: null,
      M: null, N: null, P: null, Q: null, I: null, line: null };
    if (!finite(A) || !finite(B) || !finite(C)) return bad;
    if (dist(A, B) < 1 || dist(A, C) < 1 || dist(B, C) < 1) return bad;

    const footB = angleBisectorOn(B, A, C);
    const footC = angleBisectorOn(C, A, B);
    if (!finite(footB) || !finite(footC)) return bad;
    const Bi = line(B, footB);
    const Be = perpLine(B, footB);
    const Ci = line(C, footC);
    const Ce = perpLine(C, footC);
    const M = foot(A, Bi);
    const N = foot(A, Ci);
    const P = foot(A, Be);
    const Q = foot(A, Ce);
    const I = intersect(Bi.p, Bi.q, Ci.p, Ci.q);
    if (![M, N, P, Q].every(finite)) return bad;
    const degenerate = Math.abs(cross(sub(B, A), sub(C, A))) < 1e-6 * dist(B, A) * dist(C, A);
    return {
      ok: true, degenerate: degenerate,
      footB: footB, footC: footC,
      Bi: Bi, Be: Be, Ci: Ci, Ce: Ce,
      M: M, N: N, P: P, Q: Q,
      I: finite(I) ? I : null,
      line: line(P, Q),
    };
  }

  /* ------------------------------------------------------------ the claims */

  /** Numbers behind the page's angles, rectangle, circle and line claims. */
  function measurements(s) {
    const c = construction(s);
    const base = {
      construction: c, ok: c.ok, angleA: NaN, angleB: NaN, angleC: NaN,
      amp: NaN, abp: NaN, amn: NaN, ain: NaN, pageAIN: NaN,
      rectangle: [], cyclicGap: NaN, collinearGap: NaN,
      simsonGap: NaN, incenterGap: NaN, maxGap: NaN,
    };
    if (!c.ok || c.degenerate || !c.I) return base;
    const { A, B, C } = s;
    const { M, N, P, Q, I } = c;
    const angleA = angleAt(A, B, C);
    const angleB = angleAt(B, A, C);
    const angleC = angleAt(C, A, B);
    const scale = Math.max(dist(B, C), dist(C, A), dist(A, B), 1);
    const centersABC = centers(A, B, C);

    /* AMBP is a rectangle; its four corner angles are right angles. */
    const rectangle = [
      angleAt(A, M, P), angleAt(M, A, B),
      angleAt(B, M, P), angleAt(P, B, A),
    ].map((v) => Math.abs(v - Math.PI / 2));

    /* ANIM is cyclic: the circle through A, N and M must also pass through I. */
    const O = circumcenter(A, N, M);
    const cyclicGap = finite(O) ? Math.abs(dist(O, I) - dist(O, A)) : NaN;

    /* The page's headline: the four feet lie on one line. */
    const collinearGap = Math.max(
      distToLine(M, c.line), distToLine(N, c.line),
      distToLine(P, c.line), distToLine(Q, c.line),
    );

    /* Nathan Bowler's observation: A is on the circumcircle of B, I and I_C,
       so M, N, P are the Simson feet of A for that triangle. */
    let simsonGap = NaN;
    if (centersABC) {
      const O2 = circumcenter(B, I, centersABC.IC);
      if (finite(O2)) simsonGap = Math.abs(dist(O2, A) - dist(O2, B));
    }

    const incenterDistances = [
      distToLine(I, line(A, B)), distToLine(I, line(B, C)),
      distToLine(I, line(C, A)),
    ];
    const incenterGap = Math.max(...incenterDistances) - Math.min(...incenterDistances);

    return {
      construction: c, ok: true,
      angleA: angleA * 180 / Math.PI,
      angleB: angleB * 180 / Math.PI,
      angleC: angleC * 180 / Math.PI,
      amp: angleAt(M, A, P) * 180 / Math.PI,
      abp: angleAt(B, A, P) * 180 / Math.PI,
      amn: angleAt(M, A, N) * 180 / Math.PI,
      ain: angleAt(I, A, N) * 180 / Math.PI,
      pageAIN: (angleA + angleB) * 90 / Math.PI, // the page says A/2 + B/2
      rectangle: rectangle,
      cyclicGap: cyclicGap,
      collinearGap: collinearGap,
      simsonGap: simsonGap,
      incenterGap: incenterGap,
      maxGap: Math.max(rectangle[0], rectangle[1], rectangle[2], rectangle[3],
        cyclicGap, collinearGap, simsonGap, incenterGap) / scale,
    };
  }

  /** Every stated relationship, checked at this triangle with a scaled tolerance. */
  function claims(s) {
    const m = measurements(s);
    if (!m.ok) return {
      valid: false, rectangle: false, feetOnBisectors: false, pageAngles: false,
      colEqualAngles: false, cyclic: false, collinear: false, simson: false,
      pageAINValue: false,
    };
    const { A, B, C } = s;
    const c = m.construction;
    const scale = Math.max(dist(B, C), dist(C, A), dist(A, B), 1);
    const tol = 1e-6 * scale;
    const halfSumAC = (m.angleA + m.angleC) / 2;
    return {
      valid: true,
      rectangle: m.rectangle.every((v) => v <= 1e-7),
      feetOnBisectors:
        distToLine(c.M, c.Bi) <= tol && distToLine(c.P, c.Be) <= tol &&
        distToLine(c.N, c.Ci) <= tol && distToLine(c.Q, c.Ce) <= tol,
      pageAngles: Math.abs(m.abp - (180 - m.angleB) / 2) <= 1e-6 &&
        Math.abs(m.amp - m.abp) <= 1e-6,
      colEqualAngles: Math.abs(m.amn - m.ain) <= 1e-6 &&
        Math.abs(m.amn - halfSumAC) <= 1e-6,
      cyclic: m.cyclicGap <= tol,
      collinear: m.collinearGap <= tol,
      simson: m.simsonGap <= tol,
      // The page's A/2 + B/2 is generally wrong (it can only hold when B=C).
      pageAINValue: Math.abs(m.pageAIN - m.ain) <= 1e-6,
    };
  }

  /** A pure picture has no win, loss or finish. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, WIDTH, HEIGHT, add, sub, mul, dot, cross, dist, sqDist, clamp, unit,
    orientation, rotate, computeAngle, intersect, angleBisectorOn, line,
    perpLine, nearestPoint, foot, distToLine, angleAt, circumcenter, circleThrough, centers,
    start, withPoint, construction, measurements, claims, result,
  };
})();
