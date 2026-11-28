"use strict";

/*
 * Harmonic Ratio — Alexander Bogomolny's applet HarmonicRatio.
 *
 * Three dots A, B, C lie on a line. Pick E off that line and I on AE. The
 * straightedge-only construction of the applet is:
 *   G = CE ∩ IB,  F = AG ∩ EB,  D = AB ∩ IF,  H = CE ∩ ID.
 * The surprise on the page is that D is the same however E and I are chosen:
 * D is the harmonic conjugate of C with respect to A and B, so the signed
 * cross-ratio (ABCD) is -1. In a coordinate on AB with A = 0, B = 1 and
 * C = u, the answer is D = u / (2u - 1). The applet's own GeoSDoub.Intersect
 * returns (NaN, NaN) when |determinant| < 1; that is kept here too.
 *
 * Five dots can be dragged. C glides along the segment AB and I along the
 * segment AE, as CTKMoveableDoub.RestrictToLine and DoubLine.UpdateMidPoint
 * do in the applet; moving A moves both of them, moving B just moves C and
 * moving E just moves I. The only checkbox in the applet shows point names.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, HarmonicRatioCore, so the page loads it with
 * a plain <script> and porting/check-harmonic-ratio.mjs loads it in Node.
 * Positions are plain data and every function returns new objects.
 */
const HarmonicRatioCore = (() => {
  // The archived page embeds the applet at 600 by 450; these are its units.
  const WIDTH = 600;
  const HEIGHT = 450;
  // HarmonicRatioCanvas.init(): int n = 5; double t = 2/3.
  const DIVISOR = 5;
  const T = 2 / 3;
  const NAMES = ["A", "B", "C", "E", "I"];

  const EPS = 1e-9;
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const isFinitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect: |det| < 1 gives (NaN, NaN), straight from bytecode. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(p, a, b): the nearest point of the infinite line. */
  function projectToLine(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS || !Number.isFinite(len2)) return { x: a.x, y: a.y };
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** CTKMoveableDoub.RestrictToLine plus the segment clamp of UpdateMidPoint. */
  function projectToSegment(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS || !Number.isFinite(len2)) return { x: a.x, y: a.y };
    const u = Math.max(0, Math.min(1, dot(sub(p, a), d) / len2));
    return add(a, mul(d, u));
  }

  /** DoubLine.CreateMidPoint(t): first end has weight t, second has 1 - t. */
  function along(a, b, t) {
    return add(mul(a, t), mul(b, 1 - t));
  }

  /**
   * DoubLine.UpdateMidPoint(p): recompute the stored parameter from p and
   * clamp it into the segment. When p is already on AB this leaves p alone;
   * when A or B has moved it projects p onto the new line, clamped to AB.
   * This is the applet's own order: UpdateLocation moves the endpoint first,
   * then UpdateMidPoint recomputes the parameter from the unmoved glider.
   */
  function updateMidpoint(a, b, p) {
    const d = sub(a, b);
    const len2 = dot(d, d);
    if (len2 < EPS || !Number.isFinite(len2)) return { x: a.x, y: a.y };
    let t = -dot(d, sub(b, p)) / len2;
    t = Math.max(0, Math.min(1, t));
    return along(a, b, t);
  }

  /** The position a new diagram starts from (HarmonicRatioCanvas.init). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const showNames = o.showNames === undefined ? false : Boolean(o.showNames);
    if (o.points) {
      const pts = {};
      NAMES.forEach((n) => { pts[n] = { x: o.points[n].x, y: o.points[n].y }; });
      return { width, height, showNames, points: pts };
    }
    const A = { x: width / DIVISOR, y: height * T };
    const B = { x: width / 2, y: height * T - 40 };
    // BaseLine.CreateMidPoint(1 - t) and the same x with y = h * (1 - t).
    const C = along(A, B, 1 - T);
    const E = { x: C.x, y: height * (1 - T) };
    const I = along(A, E, 0.5); // SideLine.CreateMidPoint(0.5)
    return { width, height, showNames, points: { A, B, C, E, I } };
  }

  /** HarmonicRatioCanvas.mouseDragged / mouseReleased: one handle moved. */
  function withPoint(state, name, p) {
    if (!NAMES.includes(name)) return state;
    const pts = {};
    NAMES.forEach((n) => { pts[n] = { x: state.points[n].x, y: state.points[n].y }; });
    const q = { x: p.x, y: p.y };
    if (name === "C") {
      pts.C = updateMidpoint(pts.A, pts.B, projectToLine(q, pts.A, pts.B));
    } else if (name === "I") {
      pts.I = updateMidpoint(pts.A, pts.E, projectToLine(q, pts.A, pts.E));
    } else {
      pts[name] = q;
      if (name === "A") {
        pts.C = updateMidpoint(pts.A, pts.B, pts.C);
        pts.I = updateMidpoint(pts.A, pts.E, pts.I);
      } else if (name === "B") {
        pts.C = updateMidpoint(pts.A, pts.B, pts.C);
      } else if (name === "E") {
        pts.I = updateMidpoint(pts.A, pts.E, pts.I);
      }
    }
    return { ...state, points: pts };
  }

  /** The applet's "Show names" checkbox. */
  function withOptions(state, options) {
    return {
      ...state,
      showNames: options.showNames === undefined ? state.showNames : Boolean(options.showNames),
    };
  }

  /** HarmonicRatioCanvas.ComputePoints, in the applet's own order. */
  function compute(state) {
    const { A, B, C, E, I } = state.points;
    const G = intersect(E, C, I, B);
    const F = intersect(A, G, E, B);
    const D = intersect(A, B, I, F);
    const H = intersect(E, C, I, D);
    return {
      G, F, D, H,
      finite: [G, F, D, H].every(isFinitePoint),
    };
  }

  /** Signed coordinate of p in the affine coordinate with a = 0, b = 1. */
  function fraction(a, b, p) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS || !Number.isFinite(len2)) return NaN;
    return dot(sub(p, a), d) / len2;
  }

  /** The point forced by (ABCD) = -1: u / (2u - 1) along AB. */
  function analyticD(state) {
    const { A, B, C } = state.points;
    const u = fraction(A, B, C);
    const d = u / (2 * u - 1);
    if (!Number.isFinite(d)) return { x: NaN, y: NaN };
    return add(A, mul(sub(B, A), d));
  }

  /**
   * The page's definition: (ABCD) = CA/CB : DA/DB, using signed coordinates
   * on the line through A and B.
   */
  function crossRatio(a, b, c, d) {
    const uc = fraction(a, b, c), ud = fraction(a, b, d);
    if (!Number.isFinite(uc) || !Number.isFinite(ud)) return NaN;
    if (Math.abs(uc - 1) < EPS || Math.abs(ud - 1) < EPS) return NaN;
    return (uc / (uc - 1)) / (ud / (ud - 1));
  }

  /** Shortest distance from p to the infinite line AB. */
  function distanceToLine(p, a, b) {
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < EPS) return Infinity;
    return Math.abs(d.x * (p.y - a.y) - d.y * (p.x - a.x)) / len;
  }

  /** The claims on the page, checked on this one diagram. */
  function claims(state) {
    const { A, B, C, E, I } = state.points;
    const m = compute(state);
    const tol = 1e-6 * Math.max(4 * distance(A, B), 1);
    const finite = m.finite;
    const D = analyticD(state);
    return {
      finite,
      dMatchesFormula: finite && isFinitePoint(D) && distance(m.D, D) < tol,
      dOnBaseLine: finite && distanceToLine(m.D, A, B) < tol,
      conjugates: finite && Math.abs(crossRatio(A, B, C, m.D) + 1) < 1e-6,
      hIsConjugate: finite && Math.abs(crossRatio(I, m.F, m.H, m.D) + 1) < 1e-6,
      cHConjugate: finite && Math.abs(crossRatio(E, m.G, C, m.H) + 1) < 1e-6,
      hOnEC: finite && distanceToLine(m.H, E, C) < tol,
      iOnAE: distanceToLine(I, A, E) < tol && fraction(A, E, I) >= -EPS && fraction(A, E, I) <= 1 + EPS,
      cOnAB: distanceToLine(C, A, B) < tol && fraction(A, B, C) >= -EPS && fraction(A, B, C) <= 1 + EPS,
    };
  }

  /** An illustration has no winner and no loser. */
  function result(/* state */) {
    return null;
  }

  return {
    NAMES, WIDTH, HEIGHT, DIVISOR, T, EPS,
    dot, sub, add, mul, distance, isFinitePoint,
    intersect, projectToLine, projectToSegment, along, updateMidpoint,
    start, withPoint, withOptions, compute, fraction, analyticD,
    crossRatio, distanceToLine, claims, result,
  };
})();
