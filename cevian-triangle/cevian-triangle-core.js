"use strict";

/*
 * CevianTriangle — the illustration behind Bogomolny's "Cevian Triangle".
 *
 * Move the corners A, B, C or the point P. The lines AP, BP, CP meet the far
 * sides at Pa, Pb, Pc: those three feet form the cevian triangle of P. The
 * matching sides of ABC and PaPbPc meet at L = AB∩PaPb, M = BC∩PbPc and
 * N = CA∩PcPa. The page's claim is that L, M and N always lie on one line:
 * the two triangles are perspective from P, so by Desargues they are also
 * perspective from a line. When P is the orthocenter, that line is the orthic
 * axis, and the sides of ABC are external bisectors of the orthic triangle.
 *
 * The one idea the code relies on is the applet's own one: every point is the
 * intersection of two lines, computed the way GeoSDoub.Intersect does. A
 * weighted midpoint (15A+5B+2C)/22 places the starting P, exactly as
 * CevianTriangleCanvas.MidpointW does.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CevianTriangleCore, so the page loads it with a plain
 * <script> and porting/check-cevian-triangle.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const CevianTriangleCore = (() => {
  const EPS = 1e-9;
  const SIZE = { width: 400, height: 250 }; // the applet's "optimal" parameters

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /**
   * GeoSDoub.Intersect, transcribed literally: lines ax+by+c=0 in applet order,
   * with its |determinant| < 1 test returning NaN. We use null for NaN so the
   * position stays plain data.
   */
  function intersect(p1, p2, p3, p4) {
    if (!p1 || !p2 || !p3 || !p4) return null;
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (c1 * a2 - c2 * a1) / det;
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x, y: y } : null;
  }

  /** Foot of the perpendicular from p to the infinite line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return null;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Shortest distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const len = distance(a, b);
    if (len < EPS) return Infinity;
    return Math.abs(cross(a, b, p)) / len;
  }

  /** The starting four points, placed as CevianTriangleCanvas.init places them. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B },
        C: { ...o.points.C }, P: { ...o.points.P },
      };
    }
    const width = o.width === undefined ? SIZE.width : o.width;
    const height = o.height === undefined ? SIZE.height : o.height;
    // The applet uses int arithmetic for these three positions.
    const A = { x: Math.trunc((width * 2) / 3), y: Math.trunc((height * 7) / 10) };
    const B = { x: Math.trunc((width * 4) / 7), y: Math.trunc((height * 2) / 5) };
    const C = { x: Math.trunc(width / 6), y: Math.trunc((height * 3) / 4) };
    return { A: A, B: B, C: C, P: weighted(A, B, C) };
  }

  /** MidpointW: the weights 15, 5, 2 from the applet's own method. */
  function weighted(A, B, C) {
    return {
      x: (15 * A.x + 5 * B.x + 2 * C.x) / 22,
      y: (15 * A.y + 5 * B.y + 2 * C.y) / 22,
    };
  }

  /** Where the cevians through P cut the opposite sides. */
  function cevianTriangle(s) {
    return {
      A: s.A, B: s.B, C: s.C, P: s.P,
      Pa: intersect(s.A, s.P, s.B, s.C),
      Pb: intersect(s.B, s.P, s.C, s.A),
      Pc: intersect(s.C, s.P, s.A, s.B),
    };
  }

  /**
   * The three intersections of corresponding sides. These are the applet's
   * locals L, M, N (its Draw calls Intersect in exactly this order).
   */
  function axisPoints(c) {
    return {
      L: intersect(c.A, c.B, c.Pa, c.Pb),
      M: intersect(c.B, c.C, c.Pb, c.Pc),
      N: intersect(c.C, c.A, c.Pc, c.Pa),
    };
  }

  /** sin of the angle at q: a scale-free test of whether p, q, r line up. */
  function collinearity(p, q, r) {
    if (!p || !q || !r) return Infinity;
    const len = distance(p, q) * distance(q, r);
    if (len < EPS) return Infinity;
    return Math.abs(cross(p, q, r)) / len;
  }

  /** sin of the angle between two directions: 0 when they are parallel. */
  function parallelity(p, q, x, y) {
    if (!p || !q) return Infinity;
    const u = { x: q.x - p.x, y: q.y - p.y };
    const v = { x: y.x - x.x, y: y.y - x.y };
    const len = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (len < EPS) return Infinity;
    return Math.abs(u.x * v.y - u.y * v.x) / len;
  }

  /**
   * Desargues says L, M, N line up. One of them can run off to infinity when
   * two corresponding sides are parallel (the applet prints NaN there); the
   * axis is then the line through the other two, parallel to that pair.
   */
  function axisIsCollinear(axis, s) {
    const { L, M, N } = axis;
    if (L && M && N) return collinearity(L, M, N) < 1e-8;
    if (!L && M && N) return parallelity(M, N, s.A, s.B) < 1e-8;
    if (!M && N && L) return parallelity(N, L, s.B, s.C) < 1e-8;
    if (!N && L && M) return parallelity(L, M, s.C, s.A) < 1e-8;
    return false;
  }

  /** Orthocenter: the intersection of the altitudes from A and from B. */
  function orthocenter(s) {
    const dA = { x: -(s.C.y - s.B.y), y: s.C.x - s.B.x };
    const dB = { x: -(s.A.y - s.C.y), y: s.A.x - s.C.x };
    if (Math.hypot(dA.x, dA.y) < EPS || Math.hypot(dB.x, dB.y) < EPS) return null;
    return intersect(
      s.A, { x: s.A.x + dA.x, y: s.A.y + dA.y },
      s.B, { x: s.B.x + dB.x, y: s.B.y + dB.y },
    );
  }

  /** Feet of the three altitudes, with the same names as the cevian feet. */
  function orthicTriangle(s) {
    return {
      Pa: foot(s.A, s.B, s.C),
      Pb: foot(s.B, s.C, s.A),
      Pc: foot(s.C, s.A, s.B),
    };
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function diagram(s) {
    const c = cevianTriangle(s);
    const axis = axisPoints(c);
    const feet = [c.Pa, c.Pb, c.Pc];
    const scale = Math.max(
      1, distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A),
    );
    const tol = 1e-8 * scale;
    const onLine = (p, a, b) => p !== null && distToLine(p, a, b) <= tol;
    return {
      A: s.A, B: s.B, C: s.C, P: s.P,
      feet: c, axis: axis,
      feetOnSides:
        onLine(c.Pa, s.B, s.C) && onLine(c.Pb, s.C, s.A) && onLine(c.Pc, s.A, s.B),
      perspectiveFromP:
        onLine(c.Pa, s.A, s.P) && onLine(c.Pb, s.B, s.P) && onLine(c.Pc, s.C, s.P),
      desarguesAxis: axisIsCollinear(axis, s),
    };
  }

  /** Two board points for drawing the axis, even when one end ran off. */
  function axisLine(axis) {
    const chosen = axisSegment(axis);
    if (chosen) return chosen;
    const pts = [axis.L, axis.M, axis.N].filter(Boolean);
    return pts.length === 2 ? pts : null;
  }

  /** The applet's Between(p, m, q): is m the point in the middle? */
  function between(p, m, q) {
    if (Math.abs(p.x - q.x) < 1) return (q.y - m.y) * (p.y - m.y) < 0;
    return (q.x - m.x) * (p.x - m.x) < 0;
  }

  /** Draw's choice of the outer two of L, M, N for the green axis segment. */
  function axisSegment(axis) {
    if (!axis.L || !axis.M || !axis.N) return null;
    if (between(axis.L, axis.M, axis.N)) return [axis.L, axis.N];
    if (between(axis.M, axis.L, axis.N)) return [axis.M, axis.N];
    return [axis.L, axis.M];
  }

  /** The angle at v between the rays to p and q, as a cosine. */
  function angleCos(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const nu = Math.hypot(u.x, u.y), nw = Math.hypot(w.x, w.y);
    if (nu < EPS || nw < EPS) return NaN;
    return dot(u, w) / (nu * nw);
  }

  /** True only when every angle of the triangle is less than 90°. */
  function isAcute(s) {
    return angleCos(s.A, s.B, s.C) > 0 && angleCos(s.B, s.A, s.C) > 0 &&
      angleCos(s.C, s.A, s.B) > 0;
  }

  /* How the side line through x,y sits relative to the orthic angle at v:
   * |c| ≈ 0 means it is an external bisector, |c| ≈ 1 an internal one. */
  function bisectorCos(v, p, q, x, y) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const nu = Math.hypot(u.x, u.y), nw = Math.hypot(w.x, w.y);
    const side = { x: y.x - x.x, y: y.y - x.y };
    const ns = Math.hypot(side.x, side.y);
    if (nu < EPS || nw < EPS || ns < EPS) return NaN;
    // The internal bisector is u/|u| + w/|w|; the external one is at 90°.
    const inner = { x: u.x / nu + w.x / nw, y: u.y / nu + w.y / nw };
    const ni = Math.hypot(inner.x, inner.y);
    if (ni < EPS) return NaN;
    return dot(inner, side) / (ni * ns);
  }

  /** The side line bisects one of the two angles made by the orthic sides. */
  function isAngleBisector(v, p, q, x, y) {
    const c = Math.abs(bisectorCos(v, p, q, x, y));
    return Number.isFinite(c) && (c < 1e-7 || Math.abs(c - 1) < 1e-7);
  }

  /** The page's stronger wording: the side line is an external bisector. */
  function isExternalBisector(v, p, q, x, y) {
    const c = Math.abs(bisectorCos(v, p, q, x, y));
    return Number.isFinite(c) && c < 1e-7;
  }

  /** Each claim on the applet's page, checked at this one configuration. */
  function claims(s) {
    const d = diagram(s);
    const H = orthocenter(s);
    const out = {
      feetOnSides: d.feetOnSides,
      perspectiveFromP: d.perspectiveFromP,
      desarguesAxis: d.desarguesAxis,
      orthicIsCevian: false,
      orthicAxis: false,
      sideLinesBisectOrthicAngles: false,
      externalBisectors: false,
    };
    if (!H) return out;
    const orthic = orthicTriangle(s);
    if (!orthic.Pa || !orthic.Pb || !orthic.Pc) return out;
    const cevianH = cevianTriangle({ A: s.A, B: s.B, C: s.C, P: H });
    const scale = Math.max(1, distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A));
    const close = (p, q) => p && q && distance(p, q) <= 1e-7 * scale;
    out.orthicIsCevian = close(orthic.Pa, cevianH.Pa) &&
      close(orthic.Pb, cevianH.Pb) && close(orthic.Pc, cevianH.Pc);
    const axisH = axisPoints(cevianH);
    out.orthicAxis = axisIsCollinear(axisH, s);
    out.sideLinesBisectOrthicAngles = out.orthicAxis &&
      isAngleBisector(orthic.Pa, orthic.Pb, orthic.Pc, s.B, s.C) &&
      isAngleBisector(orthic.Pb, orthic.Pc, orthic.Pa, s.C, s.A) &&
      isAngleBisector(orthic.Pc, orthic.Pa, orthic.Pb, s.A, s.B);
    // The page says "external"; that is literally right for an acute triangle.
    // In an obtuse one the same side line is an internal bisector at two feet.
    out.externalBisectors = isAcute(s) && out.sideLinesBisectOrthicAngles &&
      isExternalBisector(orthic.Pa, orthic.Pb, orthic.Pc, s.B, s.C) &&
      isExternalBisector(orthic.Pb, orthic.Pc, orthic.Pa, s.C, s.A) &&
      isExternalBisector(orthic.Pc, orthic.Pa, orthic.Pb, s.A, s.B);
    return out;
  }

  /** A new position with one named point moved. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, P: { ...s.P } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    SIZE, EPS, distance, cross, dot, intersect, foot, distToLine,
    start, weighted, cevianTriangle, axisPoints, collinearity, parallelity,
    axisIsCollinear, between, axisSegment, axisLine, orthocenter, orthicTriangle, diagram,
    angleCos, isAcute,
    bisectorCos, isAngleBisector, isExternalBisector, claims, withPoint, result,
  };
})();
