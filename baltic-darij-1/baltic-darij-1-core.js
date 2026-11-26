"use strict";

/*
 * BalticDarij1 — Bogomolny's "Concyclic Points in a Triangle".
 *
 * Let AH_a be the altitude from A, AL_a the internal bisector at A, A' the
 * midpoint of BC, and P, Q the feet from B and C onto AL_a. The page claims
 * that P, Q, A', H_a lie on one circle; that A'P || AC, A'Q || AB and
 * A'P = A'Q; that P is the midpoint of BR for R on AC; and that triangle
 * QPH_a is inversely similar to ABC.
 *
 * The one idea the code relies on: every point is a projection or a line
 * intersection, so it can be computed from three corners with plain
 * coordinates. `construct` repeats BalticDarij1Canvas.Compute literally
 * (rotate a ray by half the angle, project, intersect, take circumcentres);
 * `standard` uses the side-length and perpendicular-bisector formulas, which
 * give the same points by a different route. `claims` tests the geometry, not
 * the applet's drawing, so a drawing bug cannot make a false claim look true.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BalticDarij1Core, so the page loads it with a plain
 * <script> and porting/check-baltic-darij-1.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BalticDarij1Core = (() => {
  const EPS = 1e-9;
  const MIN_SEP = 3; // BalticDarij1Canvas.Compute refuses points closer than this
  const TOL = 1e-7; // relative tolerance for a claim, scaled by the triangle

  const pt = (x, y) => ({ x: x, y: y });
  const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const norm = (a) => Math.hypot(a.x, a.y);
  const dist = (a, b) => norm(sub(a, b));
  const sqDist = (a, b) => {
    const d = sub(a, b);
    return dot(d, d);
  };
  const midpoint = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
  const parallelSin = (u, v) => {
    const nu = norm(u), nv = norm(v);
    if (nu < EPS || nv < EPS) return 0; // a zero vector cannot contradict a parallel claim
    return Math.abs(cross(u, v)) / (nu * nv);
  };

  /** Angle at v, between the rays to p and q, in radians. */
  function angle(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    const nu = norm(u), nw = norm(w);
    if (nu < EPS || nw < EPS) return NaN;
    const c = dot(u, w) / (nu * nw);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn q about p by an angle in the oriented plane. */
  function rotate(p, q, angleRad, orient) {
    const cs = Math.cos(angleRad), sn = Math.sin(angleRad);
    return pt(
      p.x + cs * (q.x - p.x) - orient * sn * (q.y - p.y),
      p.y + orient * sn * (q.x - p.x) + cs * (q.y - p.y),
    );
  }

  /** GeoSDoub.Intersect: two lines in ax+by+c=0 form; NaN when parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular onto line xy. */
  function nearestPoint(p, x, y) {
    if (sqDist(x, y) < 0.1) return pt(p.x, p.y);
    const u = sub(y, x);
    const t = dot(sub(p, x), u) / dot(u, u);
    return pt(x.x + t * u.x, x.y + t * u.y);
  }

  /** GeoSDoub.FindAngleBisector: rotate one side by half the angle, intersect. */
  function bisectorFootByRotation(a, b, c) {
    const ray = rotate(a, b, angle(a, b, c) / 2, orientation(a, b, c));
    return intersect(a, ray, b, c);
  }

  /** The same foot from the angle-bisector theorem: weights are side lengths. */
  function bisectorFoot(a, b, c) {
    const wB = dist(c, a), wC = dist(a, b);
    const sum = wB + wC;
    if (sum < EPS) return pt(a.x, a.y);
    return pt((wB * b.x + wC * c.x) / sum, (wB * b.y + wC * c.y) / sum);
  }

  /**
   * GeoSDoub.FindCircumcenter, as in the applet: intersect the perpendicular
   * bisectors of pq and qr. GetCircle then averages the three distances.
   */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const u1 = pt(m1.x + (q.y - p.y), m1.y - (q.x - p.x));
    const u2 = pt(m2.x + (r.y - q.y), m2.y - (r.x - q.x));
    return intersect(m1, u1, m2, u2);
  }

  function circleThrough(p, q, r) {
    const o = circumcenter(p, q, r);
    const radius = (dist(o, p) + dist(o, q) + dist(o, r)) / 3;
    return { center: o, radius: radius };
  }

  /** The independent circumcentre formula, used by the claim checks. */
  function circumcenterFormula(p, q, r) {
    const d = 2 * cross(sub(q, p), sub(r, p));
    if (Math.abs(d) < EPS) return pt(NaN, NaN);
    const pp = dot(p, p), qq = dot(q, q), rr = dot(r, r);
    return pt(
      (pp * (q.y - r.y) + qq * (r.y - p.y) + rr * (p.y - q.y)) / d,
      (pp * (r.x - q.x) + qq * (p.x - r.x) + rr * (q.x - p.x)) / d,
    );
  }

  /** The position a new diagram starts from, at the applet's suggested size. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    return {
      A: pt((2 * width) / 5, height / 3),
      B: pt(width / 3, (2 * height) / 3),
      C: pt((3 * width) / 4, (2 * height) / 3),
      options: {
        names: true,
        rightAngles: false,
        equalAngles: false,
        lines: false,
        bigCircle: false,
      },
    };
  }

  /** A copy of the position with one corner moved. */
  function withPoint(s, name, p) {
    const next = { A: pt(s.A.x, s.A.y), B: pt(s.B.x, s.B.y), C: pt(s.C.x, s.C.y),
      options: Object.assign({}, s.options) };
    if (next[name]) next[name] = pt(p.x, p.y);
    return next;
  }

  /** A copy with one of the five applet checkboxes changed. */
  function withOption(s, name, on) {
    const next = withPoint(s, "", s.A);
    if (name in next.options) next.options[name] = Boolean(on);
    return next;
  }

  /** The applet disables "equal angles" unless lines or the big circle is on. */
  function equalAnglesEnabled(options) {
    return Boolean(options && (options.lines || options.bigCircle));
  }

  /** What the canvas actually sees: a disabled checkbox has no effect. */
  function effectiveOptions(options) {
    const o = Object.assign({}, options);
    o.equalAngles = o.equalAngles && equalAnglesEnabled(o);
    return o;
  }

  function isComputable(s) {
    if (dist(s.A, s.B) < MIN_SEP || dist(s.A, s.C) < MIN_SEP) return false;
    return Math.abs(cross(sub(s.B, s.A), sub(s.C, s.A))) > EPS;
  }

  /**
   * The applet's BalticDarij1Canvas.Compute, including its minimum-separation
   * guard. Returns null when the applet would leave the figure unchanged.
   */
  function construct(s) {
    if (!isComputable(s)) return null;
    const A = s.A, B = s.B, C = s.C;
    const La = bisectorFootByRotation(A, B, C);
    if (!Number.isFinite(La.x) || !Number.isFinite(La.y)) return null;
    const P = nearestPoint(B, A, La);
    const Q = nearestPoint(C, A, La);
    const Ha = nearestPoint(A, B, C);
    const Ap = midpoint(B, C);
    const circleAC = circleThrough(A, C, Ha);
    const circle = circleThrough(P, Q, Ha);
    const R = intersect(A, C, B, P);
    return { La: La, P: P, Q: Q, Ha: Ha, Ap: Ap, R: R,
      circle: circle, circleAC: circleAC };
  }

  /** The same named points by the textbook formulas, for testing the claims. */
  function standard(s) {
    if (!isComputable(s)) return null;
    const A = s.A, B = s.B, C = s.C;
    const La = bisectorFoot(A, B, C);
    const P = nearestPoint(B, A, La);
    const Q = nearestPoint(C, A, La);
    const Ha = nearestPoint(A, B, C);
    const Ap = midpoint(B, C);
    const R = intersect(A, C, B, P);
    return { La: La, P: P, Q: Q, Ha: Ha, Ap: Ap, R: R };
  }

  /** Side lengths a=BC, b=CA, c=AB and the residuals of the page's claims. */
  function measurements(s) {
    const g = standard(s);
    if (!g) return null;
    const A = s.A, B = s.B, C = s.C;
    const lens = { a: dist(B, C), b: dist(C, A), c: dist(A, B) };
    const scale = Math.max(lens.a, lens.b, lens.c);
    const o = circumcenterFormula(g.P, g.Q, g.Ha);
    const residuals = {
      concyclic: Math.abs(dist(o, g.Ap) - dist(o, g.P)) / scale,
      apParallelAc: parallelSin(sub(g.P, g.Ap), sub(C, A)),
      aqParallelAb: parallelSin(sub(g.Q, g.Ap), sub(B, A)),
      equalLegs: Math.abs(dist(g.Ap, g.P) - dist(g.Ap, g.Q)) / scale,
      midpointBR: Math.abs(dist(B, g.P) - dist(g.P, g.R)) / scale,
      onAC: parallelSin(sub(g.R, A), sub(C, A)),
      diameterAC_P: Math.abs(dot(sub(g.Ha, A), sub(g.Ha, C))) / (scale * scale),
      diameterAC_Q: Math.abs(dot(sub(g.Q, A), sub(g.Q, C))) / (scale * scale),
      similarQPH: Math.max(
        Math.abs(angle(g.P, g.Q, g.Ha) - angle(B, A, C)),
        Math.abs(angle(g.Q, g.P, g.Ha) - angle(C, A, B)),
        Math.abs(angle(g.Ha, g.Q, g.P) - angle(A, B, C)),
      ),
      ratioQPH: Math.max(
        Math.abs(dist(g.Q, g.P) / lens.a - dist(g.P, g.Ha) / lens.c),
        Math.abs(dist(g.Q, g.P) / lens.a - dist(g.Ha, g.Q) / lens.b),
      ),
      reverseOrientation:
        (orientation(g.Ha, g.P, g.Q) === -orientation(A, B, C) ? 0 : 1),
    };
    return { points: g, sides: lens, scale: scale, residuals: residuals };
  }

  /** Every claim on the page, checked at this triangle. */
  function claims(s) {
    const m = measurements(s);
    if (!m) return null;
    const r = m.residuals;
    return {
      concyclic: r.concyclic < TOL,
      apParallelAc: r.apParallelAc < TOL,
      aqParallelAb: r.aqParallelAb < TOL,
      equalLegs: r.equalLegs < TOL,
      midpointBR: r.midpointBR < TOL && r.onAC < TOL,
      circleAC: r.diameterAC_P < TOL && r.diameterAC_Q < TOL,
      similarQPH: r.similarQPH < 2e-5 && r.ratioQPH < TOL && r.reverseOrientation === 0,
    };
  }

  /** An illustration has no win, loss or finish. */
  function result(/* state */) {
    return null;
  }

  return {
    MIN_SEP, TOL, pt, sub, dot, cross, norm, dist, sqDist, midpoint,
    parallelSin, angle, orientation, rotate, intersect, nearestPoint,
    bisectorFootByRotation, bisectorFoot, circumcenter, circleThrough,
    circumcenterFormula, start, withPoint, withOption, equalAnglesEnabled,
    effectiveOptions, isComputable, construct, standard, measurements, claims, result,
  };
})();
