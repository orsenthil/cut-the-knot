"use strict";

/*
 * Angle Bisector — the construction behind Bogomolny's applet AngleBisector.
 *
 * Two rays AB and AC make an angle at A. Put D on AB, then put E on AC with
 * AE = AD (the red circle centred at A cuts the ray AC there). Draw two equal
 * circles centred at D and E; their common chord is the perpendicular bisector
 * of DE. Because AD = AE that chord passes through A, and because DF = EF the
 * triangles ADF and AEF have three equal sides, so AF splits the angle in half.
 * The same chord is the locus of points equally far from the two rays.
 *
 * The one idea the code relies on: equal-radius circles have a common chord
 * perpendicular to the line of their centres, and here that chord is the
 * angle bisector. The applet'own Compute() is transcribed in construction(s):
 * circle/line and circle/circle intersections, the orientation test that
 * picks E on the ray AC, the incenter bisector, and the chord fallback.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, AngleBisectorCore, so the page loads it with a plain
 * <script> and porting/check-angle-bisector.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const AngleBisectorCore = (() => {
  const EPS = 1e-9;
  const MIN_R = 4;
  const MAX_R = 260;

  /* ------------------------------------------------------------ point maths */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function unit(p) {
    const n = Math.hypot(p.x, p.y);
    return n < EPS ? { x: 1, y: 0 } : { x: p.x / n, y: p.y / n };
  }

  /** GeoSDoub.FindOrientation: +1 for one side of AB, -1 for the other. */
  function orientation(a, b, p) {
    return cross(a, b, p) >= 0 ? 1 : -1;
  }

  /** The line through p and q in ax + by + c = 0 form. */
  function line(p, q) {
    return { a: p.y - q.y, b: q.x - p.x, c: p.x * q.y - q.x * p.y };
  }

  function distToLine(p, l) {
    const n = Math.hypot(l.a, l.b);
    return n < EPS ? Infinity : Math.abs(l.a * p.x + l.b * p.y + l.c) / n;
  }

  /** Foot of the perpendicular from p to the infinite line l. */
  function nearestOnLine(p, l) {
    const den = l.a * l.a + l.b * l.b;
    if (den < EPS) return { x: p.x, y: p.y };
    const t = (l.a * p.x + l.b * p.y + l.c) / den;
    return { x: p.x - l.a * t, y: p.y - l.b * t };
  }

  function intersectLines(l, m) {
    const det = l.a * m.b - m.a * l.b;
    if (Math.abs(det) < EPS) return null;
    return {
      x: (l.b * m.c - m.b * l.c) / det,
      y: (l.c * m.a - m.c * l.a) / det,
    };
  }

  /** GeoSDoub.Intersect(circle, line): 0, 1 or 2 points on an infinite line. */
  function circleLine(center, r, l) {
    if (!(r > 0)) return [];
    const foot = nearestOnLine(center, l);
    const d2 = Math.pow(dist(center, foot), 2);
    if (d2 - r * r > EPS) return [];
    const h = Math.sqrt(Math.max(0, r * r - d2));
    const dir = unit({ x: l.b, y: -l.a });
    if (h < EPS) return [foot];
    return [add(foot, mul(dir, h)), sub(foot, mul(dir, h))];
  }

  /** GeoSDoub.Intersect(circle, circle): 0, 1 or 2 points. */
  function circleCircle(c1, r1, c2, r2) {
    const d = dist(c1, c2);
    if (d < EPS || d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < -EPS) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const dir = unit(sub(c2, c1));
    const base = add(c1, mul(dir, a));
    const perp = { x: -dir.y, y: dir.x };
    if (h < EPS) return [base];
    return [add(base, mul(perp, h)), sub(base, mul(perp, h))];
  }

  /** Between(A, B, C) in the applet: is A on (or within 2px of) segment BC? */
  function between(a, b, c) {
    if (!Number.isFinite(a.x)) return false;
    return dist(b, a) + dist(c, a) - dist(b, c) < 2;
  }

  /** GetPerp(A, B): the line through A perpendicular to AB (bytecode form). */
  function getPerp(a, b) {
    return line(a, { x: a.x + (a.y - b.y), y: a.y - (a.x - b.x) });
  }

  /** coef(B, D, A) in the applet: where D projects onto the ray AB. */
  function coef(b, d, a) {
    if (dist(b, a) < 1) return 0;
    return dot(sub(d, a), sub(b, a)) / Math.pow(dist(b, a), 2);
  }

  /** D = A + t (B - A). */
  function pointOn(a, b, t) {
    return add(a, mul(sub(b, a), t));
  }

  /** Incenter of triangle ABC: the side lengths are the weights. */
  function incenter(a, b, c) {
    const aa = dist(b, c), bb = dist(c, a), cc = dist(a, b);
    const sum = aa + bb + cc;
    if (sum < EPS) return null;
    return {
      x: (aa * a.x + bb * b.x + cc * c.x) / sum,
      y: (aa * a.y + bb * b.y + cc * c.y) / sum,
    };
  }

  /* ------------------------------------------------------------ the position */

  /**
   * The starting diagram, placed as AngleBisectorCanvas.init places it on a
   * 400x300 canvas: A = (W/3, H/2), B = (W - W/3, A.y),
   * C = (A.x + 30, A.y - H/6 - (W/3)/2), D at 0.4 along AB, R = D + (60, 60).
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const A = { x: width / 3, y: height / 2 };
    const B = { x: width - width / 3, y: height / 2 };
    const C = { x: A.x + 30, y: A.y - height / 6 - width / 6 };
    const coefD = 0.4;
    const D = pointOn(A, B, coefD);
    const radius = clamp(dist(D, add(D, { x: 60, y: 60 })), MIN_R, MAX_R);
    return { A: A, B: B, C: C, coefD: coefD, radius: radius, R: add(D, { x: 60, y: 60 }) };
  }

  /** The current D, which always lies on the line AB. */
  function pointD(s) {
    return pointOn(s.A, s.B, s.coefD);
  }

  /** Radius as a plain number (the handle R may have been dragged). */
  function radius(s) {
    return clamp(s.radius, MIN_R, MAX_R);
  }

  /** A new position with one named handle moved; never changes the old one. */
  function withPoint(s, name, p) {
    const next = {
      A: { x: s.A.x, y: s.A.y }, B: { x: s.B.x, y: s.B.y },
      C: { x: s.C.x, y: s.C.y }, coefD: s.coefD,
      radius: s.radius, R: { x: s.R.x, y: s.R.y },
    };
    const oldD = pointD(s);
    if (name === "A" || name === "B" || name === "C") {
      next[name] = { x: p.x, y: p.y };
      const d = pointD(next);
      next.R = add(next.R, sub(d, oldD)); // keep the circles' radius as the rays move
    } else if (name === "D") {
      next.coefD = clamp(coef(next.B, p, next.A), -0.2, 1.2);
      next.R = add(next.R, sub(pointD(next), oldD));
    } else if (name === "R") {
      next.radius = clamp(dist(oldD, p), MIN_R, MAX_R);
      next.R = add(oldD, mul(unit(sub(p, oldD)), next.radius));
    }
    return next;
  }

  /** Set the common radius directly, keeping R on the same ray from D. */
  function setRadius(s, r) {
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
      coefD: s.coefD, radius: clamp(r, MIN_R, MAX_R), R: { ...s.R },
    };
    next.R = add(pointD(next), mul(unit(sub(s.R, pointD(s))), next.radius));
    return next;
  }

  /** Euclid's equilateral case: the common radius DE. */
  function euclidRadius(s) {
    const c = construction(s);
    return c.ok ? dist(c.D, c.E) : dist(pointD(s), pointOn(s.A, s.C, s.coefD));
  }

  /* -------------------------------------------------------- the construction */

  /**
   * A literal transcription of AngleBisectorCanvas.Compute():
   *  AD, circle A ∩ line AC -> E (same orientation as C),
   *  circles D and E with the radius DR -> P, F the intersection farther from A,
   *  bisector = A -> incenter (or the perpendicular at A in the flat case),
   *  replaced by the common chord when F is more than 3 units off that line.
   */
  function construction(s) {
    const A = s.A, B = s.B, C = s.C;
    const D = pointD(s);
    const r = radius(s);
    const AD = dist(A, D);
    const bad = {
      ok: false, D: D, E: null, P: [], F: null, AD: AD, radius: r,
      bisector: null, initialBisector: null, incenter: null,
      fallback: false, chordExists: false, degenerate: true,
    };
    if (AD < 1) return bad; // the applet sets F = null and returns here

    const q = circleLine(A, AD, line(A, C)); // circle A meets the infinite line AC
    if (q.length < 2) return bad;
    const orient = orientation(A, B, C);
    const E = orientation(A, B, q[0]) === orient ? q[0] : q[1];

    const P = circleCircle(D, r, E, r);
    const I = incenter(A, B, C);
    const flat = between(A, B, C) || dist(B, C) < 1;
    const initialBisector = flat || !I ? getPerp(A, B) : line(A, I);
    let bisector = initialBisector;
    let F = P.length === 2 ? (dist(A, P[0]) >= dist(A, P[1]) ? P[0] : P[1]) : null;

    let fallback = false;
    if (F && distToLine(F, bisector) > 3 && P.length === 2) {
      bisector = line(P[0], P[1]); // the common chord is the true bisector
      fallback = true;
    }
    return {
      ok: true, D: D, E: E, P: P, F: F, AD: AD, radius: r,
      bisector: bisector, initialBisector: initialBisector, incenter: I,
      fallback: fallback, chordExists: P.length === 2, degenerate: flat,
    };
  }

  /** Angle at A between the rays to p and q, in radians. */
  function angleAt(a, p, q) {
    const u = sub(p, a), v = sub(q, a);
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (n < EPS) return 0;
    return Math.acos(clamp(dot(u, v) / n, -1, 1));
  }

  /** Distances, angles and the smallest radius that makes the circles meet. */
  function measurements(s) {
    const c = construction(s);
    const AB = line(s.A, s.B), AC = line(s.A, s.C);
    const scale = Math.max(dist(s.A, s.B), dist(s.A, s.C), c.radius, 1);
    const DE = c.ok ? dist(c.D, c.E) : null;
    const halfAngle = c.ok ? angleAt(s.A, s.B, s.C) / 2 : null;
    return {
      construction: c,
      AD: c.AD, AE: c.ok ? dist(s.A, c.E) : null,
      DF: c.F ? dist(c.D, c.F) : null, EF: c.F ? dist(c.E, c.F) : null,
      DE: DE, minRadius: DE === null ? null : DE / 2,
      angleBAC: c.ok ? angleAt(s.A, s.B, s.C) : null,
      halfAngle: halfAngle,
      leftAngle: c.F ? angleAt(s.A, c.D, c.F) : null,
      rightAngle: c.F ? angleAt(s.A, c.F, s.C) : null,
      distToAB: c.F ? distToLine(c.F, AB) : null,
      distToAC: c.F ? distToLine(c.F, AC) : null,
      scale: scale,
    };
  }

  /** Every claim on the applet's page, checked at this configuration. */
  function claims(s) {
    const m = measurements(s);
    const c = m.construction;
    const tol = 1e-6 * m.scale;
    const no = {
      adEqualsAe: false, dfEqualsEf: false, chordThroughA: false,
      fOnChord: false, equalAngles: false, equidistant: false,
      locus: false, fartherPoint: false, radiusSufficient: false,
      euclidEquilateral: false,
    };
    if (!c.ok || !c.F || c.P.length !== 2) return no;
    const AB = line(s.A, s.B), AC = line(s.A, s.C);
    const chord = line(c.P[0], c.P[1]);
    const locusOk = [20, 50, 100, 150].every((t) => {
      const p = add(s.A, mul(unit(sub(c.F, s.A)), t));
      return Math.abs(distToLine(p, AB) - distToLine(p, AC)) <= tol;
    });
    return {
      adEqualsAe: Math.abs(m.AD - m.AE) <= tol,
      dfEqualsEf: Math.abs(m.DF - m.EF) <= tol && Math.abs(m.DF - c.radius) <= tol,
      chordThroughA: distToLine(s.A, chord) <= tol,
      fOnChord: distToLine(c.F, chord) <= tol,
      equalAngles: Math.abs(m.leftAngle - m.rightAngle) <= 1e-7,
      equidistant: Math.abs(m.distToAB - m.distToAC) <= tol,
      locus: locusOk,
      fartherPoint: dist(s.A, c.F) >= dist(s.A, c.P[0]) - tol &&
                    dist(s.A, c.F) >= dist(s.A, c.P[1]) - tol,
      radiusSufficient: c.radius > m.minRadius + tol,
      euclidEquilateral: Math.abs(c.radius - m.DE) > tol ||
        (Math.abs(m.DF - m.DE) <= tol && Math.abs(m.EF - m.DE) <= tol),
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, MIN_R, MAX_R, add, sub, mul, dot, dist, cross, clamp, unit,
    orientation, line, distToLine, nearestOnLine, intersectLines,
    circleLine, circleCircle, between, getPerp, coef, pointOn, incenter,
    start, pointD, radius, withPoint, setRadius, euclidRadius,
    construction, angleAt, measurements, claims, result,
  };
})();
