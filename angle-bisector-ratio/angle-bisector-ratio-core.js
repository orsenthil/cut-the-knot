"use strict";

/*
 * Angle Bisector Ratio — the illustration behind Alexander Bogomolny's applet
 * AngleBisectorRatio (cut-the-knot.org/Curriculum/Geometry/AngleBisectorRatio).
 *
 * Drag the corners of a triangle: the line from A that cuts angle A in half
 * lands on BC at D. The page's claim is that AB/AC = DB/DC, and that the very
 * same holds for the external bisector. The proof draws the line through C
 * parallel to AD, meeting line AB at E; triangle AEC is isosceles (AE = AC)
 * and triangles BEC and BAD are similar, which gives the proportion.
 *
 * The one idea the code relies on is that side lengths are weights: with
 * a = |BC|, b = |CA|, c = |AB|, the foot of the internal bisector from A is
 * D = (b*B + c*C)/(b+c), and the external foot is (c*C - b*B)/(c-b). The point
 * E comes from an honest line intersection, exactly as the applet's
 * GeoSDoub.GetParallelTo / Intersect do. Both formulas hold for acute, right
 * and obtuse triangles, and the logic test compares them with a literal
 * transcription of the applet's rotate-and-intersect construction.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, AngleBisectorRatioCore, so the page loads
 * it with a plain <script> and porting/check-angle-bisector-ratio.mjs loads
 * it in Node. Functions take plain data and return new objects; nothing
 * passed in is changed.
 */
const AngleBisectorRatioCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const vecCross = (u, v) => u.x * v.y - u.y * v.x;

  /** Intersect the infinite lines P1P2 and P3P4 (GeoSDoub.Intersect). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < EPS) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** The starting triangle, placed as AngleBisectorRatioCanvas.init places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
        showNames: true, hint: false, extra: false,
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    // init(): half the width, three fifths of the height, an eighth of the
    // width, and a fixed offset of 50. C is one third of a turn from B.
    const halfW = width / 2;
    const highY = (height * 3) / 5;
    const step = width / 8;
    const off = 50;
    const A = { x: halfW, y: highY + off };
    const B = { x: halfW + 2 * step, y: highY + off };
    const C = {
      x: halfW + step * Math.cos(Math.PI / 3),
      y: highY - step * Math.sin(Math.PI / 3) - (off * 3) / 2,
    };
    return { A, B, C, showNames: true, hint: false, extra: false };
  }

  /** a = |BC|, b = |CA|, c = |AB|, in the applet's notation. */
  function sides(s) {
    return {
      a: distance(s.B, s.C),
      b: distance(s.C, s.A),
      c: distance(s.A, s.B),
    };
  }

  /** Twice the unsigned area, handy as a scale for tolerances. */
  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  function isDegenerate(s) {
    const len = sides(s);
    return doubleArea(s) < 1e-7 || Math.min(len.a, len.b, len.c) < EPS;
  }

  /** Foot of the internal bisector from A on the opposite side BC. */
  function bisectorFoot(s) {
    if (isDegenerate(s)) return null;
    const { b, c } = sides(s);
    return {
      x: (b * s.B.x + c * s.C.x) / (b + c),
      y: (b * s.B.y + c * s.C.y) / (b + c),
    };
  }

  /**
   * Foot of the external bisector from A on the line BC. It divides BC
   * externally in the ratio AB/AC. When b = c the external bisector is
   * parallel to BC and there is no foot, so return null.
   */
  function externalFoot(s) {
    if (isDegenerate(s)) return null;
    const { b, c } = sides(s);
    if (Math.abs(c - b) < EPS) return null;
    return {
      x: (c * s.C.x - b * s.B.x) / (c - b),
      y: (c * s.C.y - b * s.B.y) / (c - b),
    };
  }

  /** GeoSDoub.GetParallelTo(C, A, D): a point on the line through C parallel to AD. */
  function parallelPoint(s, D) {
    return { x: s.C.x + 100 * (s.A.x - D.x), y: s.C.y + 100 * (s.A.y - D.y) };
  }

  /** The applet's Compute(): D, the parallel through C, and E on line AB. */
  function auxiliary(s) {
    const D = bisectorFoot(s);
    if (!D) return { D: null, parallel: null, E: null };
    const parallel = parallelPoint(s, D);
    const E = intersect(s.B, s.A, s.C, parallel);
    return { D, parallel, E };
  }

  /** The smaller angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (norm < EPS) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / norm)));
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(s) {
    const lens = sides(s);
    const { D, parallel, E } = auxiliary(s);
    const ext = externalFoot(s);
    const t = D && lens.a ? distance(s.B, D) / lens.a : null;
    return {
      A: s.A, B: s.B, C: s.C,
      sides: lens,
      degenerate: isDegenerate(s),
      doubleArea: doubleArea(s),
      D, parallel, E,
      externalFoot: ext,
      t,
      angles: D ? {
        BAD: angleAt(s.A, s.B, D),
        DAC: angleAt(s.A, D, s.C),
      } : { BAD: null, DAC: null },
      ratios: {
        AB_AC: lens.b ? lens.c / lens.b : null,
        DB_DC: D && distance(D, s.C) ? distance(s.B, D) / distance(D, s.C) : null,
        AE_AC: E ? distance(s.A, E) / lens.b : null,
        BE_BA: E ? distance(s.B, E) / lens.c : null,
        BC_BD: D && distance(s.B, D) ? lens.a / distance(s.B, D) : null,
        CE_AD: D && E ? distance(s.C, E) / distance(s.A, D) : null,
        externalDB_DC: ext ? distance(s.B, ext) / distance(ext, s.C) : null,
      },
      showNames: s.showNames !== false,
      hint: Boolean(s.hint),
      extra: Boolean(s.extra),
    };
  }

  /**
   * Each claim on the applet's page, checked numerically at this triangle.
   * bisectorRatio is the page's exact statement AB/AC = DB/DC.
   */
  function claims(s) {
    const m = measurements(s);
    const off = {
      footOnSide: false, bisectsAngle: false, bisectorRatio: false,
      isosceles: false, parallel: false, similarTriangles: false,
      converseUnique: false, externalRatio: false,
    };
    if (m.degenerate) return off;

    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-7 * scale;
    const close = (x, y, eps = 1e-8) =>
      Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= eps;
    const onLine = (p, x, y) => Math.abs(cross(x, y, p)) <= tol;
    const between = (p, x, y) =>
      Math.abs(distance(x, p) + distance(p, y) - distance(x, y)) <= tol;

    const { D, E, externalFoot: X } = m;
    if (!D || !E) return off;

    // The unique point on BC with a given ratio is the ratio AB/AC at D.
    const ratioAt = (u) => {
      const P = {
        x: s.B.x + u * (s.C.x - s.B.x),
        y: s.B.y + u * (s.C.y - s.B.y),
      };
      return distance(s.B, P) / distance(P, s.C);
    };
    const samples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const converseUnique =
      m.t !== null && close(ratioAt(m.t), m.ratios.AB_AC) &&
      samples.every((u) => Math.abs(u - m.t) < 1e-6 || !close(ratioAt(u), m.ratios.AB_AC));

    // For an isosceles triangle the external bisector is parallel to BC, so
    // it has no foot; the claim then is that AD is perpendicular to BC.
    const abIsAc = Math.abs(m.sides.c - m.sides.b) < 1e-7;
    const externalRatio = X
      ? close(m.ratios.externalDB_DC, m.ratios.AB_AC) &&
        Math.abs(dot({ x: D.x - s.A.x, y: D.y - s.A.y },
                     { x: X.x - s.A.x, y: X.y - s.A.y })) <= tol * scale
      : abIsAc && Math.abs(dot(
          { x: D.x - s.A.x, y: D.y - s.A.y },
          { x: s.C.x - s.B.x, y: s.C.y - s.B.y },
        )) <= tol * scale;

    return {
      footOnSide: onLine(D, s.B, s.C) && between(D, s.B, s.C),
      bisectsAngle: close(m.angles.BAD, m.angles.DAC, 1e-6),
      bisectorRatio: close(m.ratios.AB_AC, m.ratios.DB_DC),
      isosceles: close(m.ratios.AE_AC, 1),
      parallel: Math.abs(vecCross(
        { x: D.x - s.A.x, y: D.y - s.A.y },
        { x: E.x - s.C.x, y: E.y - s.C.y },
      )) <= tol,
      similarTriangles: close(m.ratios.BE_BA, m.ratios.BC_BD),
      converseUnique,
      externalRatio,
    };
  }

  /** A new position with one named point moved, or one option changed. */
  function withPoint(s, name, p) {
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
      showNames: s.showNames, hint: s.hint, extra: s.extra,
    };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  function withOption(s, name, value) {
    const next = withPoint(s, "", s.A);
    if (name === "showNames" || name === "hint" || name === "extra") next[name] = Boolean(value);
    return next;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, distance, dot, cross, vecCross, intersect,
    start, sides, doubleArea, isDegenerate, bisectorFoot, externalFoot,
    parallelPoint, auxiliary, angleAt, measurements, claims,
    withPoint, withOption, result,
  };
})();
