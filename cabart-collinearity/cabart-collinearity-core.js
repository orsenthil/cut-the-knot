"use strict";

/*
 * Cabart Collinearity — the illustration behind Bogomolny's "Cabart's
 * Collinearity". Drag the corners of triangle ABC. On each side stand two
 * isosceles triangles whose base angles differ by a right angle. The three
 * cevians of each triple meet in a Kiepert point; those two points and the
 * centre of the nine-point circle always lie on one straight line. At a base
 * angle of 45 degrees they are the two Vecten points and the nine-point centre.
 *
 * The code follows CabartCollinearityCanvas.Compute and its helper Apex from
 * the applet's bytecode: rotate the ends of a side by the base angle, intersect
 * the two rays, average the three intersections (CTKGeometryPlus.Barycenter),
 * and find the nine-point centre as the circumcenter of the sides' midpoints.
 * The angle slider is the applet's Scrollbar(0, 45, 5, 0, 95): 0..95, start 45.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CabartCollinearityCore, so the page loads it with a
 * plain <script> and porting/check-cabart-collinearity.mjs loads it in Node.
 * Positions are plain data and functions never change what they are given.
 */
const CabartCollinearityCore = (() => {
  const ANGLE = { min: 0, max: 95, initial: 45, pageStep: 5 };
  const EPS = 1e-9;
  const HALF_PI = Math.PI / 2;

  const point = (x, y) => ({ x: x, y: y });
  const copy = (p) => point(p.x, p.y);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function clampAngle(value) {
    const v = Math.round(Number(value));
    return Number.isFinite(v) ? clamp(v, ANGLE.min, ANGLE.max) : ANGLE.initial;
  }

  /** The starting triangle from CabartCollinearityCanvas.init for W=400, H=300. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    if (o.points) {
      return {
        A: copy(o.points.A), B: copy(o.points.B), C: copy(o.points.C),
        angle: clampAngle(o.angle === undefined ? ANGLE.initial : o.angle),
        showOuter: Boolean(o.showOuter), showInner: Boolean(o.showInner),
        show9PC: Boolean(o.show9PC), showNames: Boolean(o.showNames),
      };
    }
    /* Java's integer division truncates toward zero; these values are positive. */
    return {
      A: point(Math.trunc(width / 5), Math.trunc((height * 3) / 5) + 40),
      B: point(Math.trunc((width * 11) / 20), Math.trunc((height * 2) / 5) + 40),
      C: point(Math.trunc(width / 2), Math.trunc((height * 2) / 11) + 40),
      angle: clampAngle(o.angle === undefined ? ANGLE.initial : o.angle),
      showOuter: Boolean(o.showOuter), showInner: Boolean(o.showInner),
      show9PC: Boolean(o.show9PC), showNames: Boolean(o.showNames),
    };
  }

  /** GeoSDoub.Rotate: rotate q about p by theta, with orientation s. */
  function rotate(p, q, theta, s) {
    const c = Math.cos(theta), n = Math.sin(theta), sign = s === undefined ? 1 : s;
    return point(
      p.x + c * (q.x - p.x) - sign * n * (q.y - p.y),
      p.y + sign * n * (q.x - p.x) + c * (q.y - p.y),
    );
  }

  /** GeoSDoub.Intersect(P1,P2,P3,P4): NaN when the determinant is under 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** CabartCollinearityCanvas.Apex: apex on side pq with base angle theta. */
  function apex(p, q, theta) {
    const r1 = rotate(p, q, theta, 1);
    const r2 = rotate(q, p, theta, -1);
    return intersect(p, r1, q, r2);
  }

  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.FindCircumcenter, as used by the applet's nine-point circle. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q);
    const m2 = midpoint(q, r);
    const v1 = point(m1.x + (q.y - p.y), m1.y - (q.x - p.x));
    const v2 = point(m2.x + (r.y - q.y), m2.y - (r.x - q.x));
    return intersect(m1, v1, m2, v2);
  }

  /** CTKGeometryPlus.Barycenter: the ordinary average of three points. */
  function average3(p, q, r) {
    return point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  }

  /** InsideTest.IsInside(p,a,b): p lies between a and b (dot product <= 0). */
  function isInside(p, a, b) {
    return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
  }

  /** CTKGeometryPlus.DefineLine: the pair of extreme points among three. */
  function extremePair(p, q, r) {
    if (isInside(q, p, r)) return [p, r];
    if (isInside(r, p, q)) return [p, q];
    return [q, r];
  }

  function measure(pos) {
    const A = pos.A, B = pos.B, C = pos.C;
    const theta = pos.angle * Math.PI / 180;
    const innerTheta = theta - HALF_PI;

    const Ap = apex(B, C, theta), Bp = apex(C, A, theta), Cp = apex(A, B, theta);
    const Am = apex(B, C, innerTheta), Bm = apex(C, A, innerTheta), Cm = apex(A, B, innerTheta);

    const Kp = average3(
      intersect(A, Ap, B, Bp), intersect(B, Bp, C, Cp), intersect(C, Cp, A, Ap),
    );
    const Km = average3(
      intersect(A, Am, B, Bm), intersect(B, Bm, C, Cm), intersect(C, Cm, A, Am),
    );

    const mBC = midpoint(B, C), mCA = midpoint(C, A), mAB = midpoint(A, B);
    const N = circumcenter(mBC, mCA, mAB);
    const radius = finite(N) ? (dist(N, mBC) + dist(N, mCA) + dist(N, mAB)) / 3 : NaN;
    const mids = { AB: mAB, BC: mBC, CA: mCA };
    const ok = finite(Kp) && finite(Km) && finite(N) && Math.abs(cross(A, B, C)) > EPS;
    const line = ok ? extremePair(Kp, Km, N) : null;
    const collinear = ok ? cross(Kp, Km, N) / Math.max(1, dist(A, B)) : NaN;

    return {
      A: A, B: B, C: C, angle: pos.angle, theta: theta,
      Ap: Ap, Bp: Bp, Cp: Cp, Am: Am, Bm: Bm, Cm: Cm,
      outer: { Ap: Ap, Bp: Bp, Cp: Cp }, inner: { Am: Am, Bm: Bm, Cm: Cm },
      Kp: Kp, Km: Km, N: N, radius: radius, midpoints: mids,
      line: line, collinearError: collinear, usable: ok,
      outerUsable: finite(Ap) && finite(Bp) && finite(Cp) && finite(Kp),
      innerUsable: finite(Am) && finite(Bm) && finite(Cm) && finite(Km),
    };
  }

  /** The page's first form of the Kiepert weights: a / sin(A + x). */
  function baryWeightsSin(A, B, C, theta) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const Aang = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1));
    const Bang = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1));
    const Cang = Math.PI - Aang - Bang;
    return [
      a / Math.sin(Aang + theta),
      b / Math.sin(Bang + theta),
      c / Math.sin(Cang + theta),
    ];
  }

  /** The page's barycentric coordinates, in the cos-normalised form it uses. */
  function baryWeights(A, B, C, theta) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const Aang = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1));
    const Bang = Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1));
    const Cang = Math.PI - Aang - Bang;
    return {
      Aang: Aang, Bang: Bang, Cang: Cang, a: a, b: b, c: c,
      k: [
        a * (Math.cos(Bang - Cang) - Math.cos(Bang + Cang + 2 * theta)),
        b * (Math.cos(Cang - Aang) - Math.cos(Cang + Aang + 2 * theta)),
        c * (Math.cos(Aang - Bang) - Math.cos(Aang + Bang + 2 * theta)),
      ],
      n: [
        a * Math.cos(Bang - Cang),
        b * Math.cos(Cang - Aang),
        c * Math.cos(Aang - Bang),
      ],
    };
  }

  function weightedPoint(weights, A, B, C) {
    const s = weights[0] + weights[1] + weights[2];
    if (!Number.isFinite(s) || Math.abs(s) < EPS) return point(NaN, NaN);
    return point(
      (weights[0] * A.x + weights[1] * B.x + weights[2] * C.x) / s,
      (weights[0] * A.y + weights[1] * B.y + weights[2] * C.y) / s,
    );
  }

  const sum = (a) => a[0] + a[1] + a[2];

  /** Every claim the page makes, evaluated on the current position. */
  function claims(pos) {
    const m = measure(pos);
    /*
     * The page writes x > 0 for triangles built outside ABC. The applet always
     * passes +1 as Apex's orientation, so which side is "outside" depends on
     * how ABC is wound: the algebraic angle flips sign when the winding does.
     */
    const winding = cross(pos.A, pos.B, pos.C) < 0 ? -1 : 1;
    const outerAngle = -winding * m.theta;
    const innerAngle = -winding * (m.theta - HALF_PI);
    const w1 = baryWeights(pos.A, pos.B, pos.C, outerAngle);
    const w2 = baryWeights(pos.A, pos.B, pos.C, innerAngle);
    const KpBary = weightedPoint(w1.k, pos.A, pos.B, pos.C);
    const KmBary = weightedPoint(w2.k, pos.A, pos.B, pos.C);
    const NBary = weightedPoint(w1.n, pos.A, pos.B, pos.C);
    const s1 = sum(w1.k), s2 = sum(w2.k), s3 = sum(w1.n);
    const scale = Math.max(
      dist(pos.A, pos.B), dist(pos.B, pos.C), dist(pos.C, pos.A),
      Math.hypot(m.Kp.x, m.Kp.y), Math.hypot(m.Km.x, m.Km.y),
    );
    const tol = 1e-7 * Math.max(1, scale);
    const closeP = (p, q) => finite(p) && finite(q) && dist(p, q) <= tol;
    const Nweighted = point(
      (s1 * m.Kp.x + s2 * m.Km.x) / (s1 + s2),
      (s1 * m.Kp.y + s2 * m.Km.y) / (s1 + s2),
    );
    const sin1 = baryWeightsSin(pos.A, pos.B, pos.C, outerAngle);
    const sinPoint = weightedPoint(sin1, pos.A, pos.B, pos.C);
    return {
      usable: m.usable,
      outerKiepert: closeP(KpBary, m.Kp),
      sinForm: closeP(sinPoint, m.Kp),
      innerKiepert: closeP(KmBary, m.Km),
      ninePointCenter: closeP(NBary, m.N),
      sumsIdentity: Math.abs(s1 + s2 - 2 * s3) <= 1e-7 * Math.max(1, Math.abs(s3)),
      weightedCenter: closeP(Nweighted, m.N),
      collinear: Math.abs(m.collinearError) <= 1e-9,
      vectenAt45: pos.angle === 45 && Math.abs(HALF_PI - 2 * m.theta) < 1e-12,
      nBary: NBary, kpBary: KpBary, kmBary: KmBary,
      sums: { s1: s1, s2: s2, s3: s3 }, m: m, tolerance: tol,
    };
  }

  /** A new position with one corner moved; the options are kept. */
  function withPoint(pos, name, p) {
    if (!pos[name] || !finite(p)) return pos;
    const next = { ...pos };
    next[name] = copy(p);
    return next;
  }

  /** A new position with options changed; the corners are kept. */
  function withOptions(pos, patch) {
    const o = patch || {};
    const next = { ...pos };
    if (o.angle !== undefined) next.angle = clampAngle(o.angle);
    for (const key of ["showOuter", "showInner", "show9PC", "showNames"]) {
      if (o[key] !== undefined) next[key] = Boolean(o[key]);
    }
    return next;
  }

  /** Nothing can be won or lost: this is an illustration. */
  function result(/* position */) {
    return null;
  }

  return {
    ANGLE, start, clampAngle, rotate, intersect, apex, midpoint, circumcenter,
    average3, isInside, extremePair, measure, baryWeights, baryWeightsSin,
    weightedPoint, claims, withPoint, withOptions, result,
  };
})();
