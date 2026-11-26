"use strict";

/*
 * AsiaPacificKite — Bogomolny's illustration of the 1993 Asian Pacific
 * Mathematical Olympiad kite problem, extended by Vo Duc Dien.
 *
 * ABCD is a rhombus of two equilateral triangles: AB = BC = CD = DA and the
 * angle at B is 60 degrees. A line l through D meets the lines AB and BC at E
 * and F; M is where CE and AF cross. As l turns about D, M runs around the
 * circumcircle of the equilateral triangle ABC. The circumcircles (AEM) and
 * (CFM) meet again at N, and N lies on l (so D, E, N, F are collinear).
 *
 * One idea drives the code: the construction in the applet's bytecode is just
 * line intersection and circumcircles. GeoSDoub.Intersect solves two lines in
 * ax+by+c=0 form; GeoSDoub.FindCircumcenter cuts the perpendicular bisectors;
 * GetCircle takes the mean of the three centre-to-vertex distances as radius.
 * Dragging A or C keeps the kite by mirroring the other across the canvas
 * centre and re-fixing BD to |AC|*sqrt(3); dragging B or D does the reverse.
 * Dragging E or F keeps E, D, F on one line by intersecting with the other
 * side. All of that is reproduced here on plain data, with no DOM.
 *
 * It defines one global, AsiaPacificKiteCore, so the page loads it with a
 * plain <script> and porting/check-asia-pacific-kite.mjs loads it in Node.
 */

const AsiaPacificKiteCore = (() => {
  const EPS = 1e-9;
  const SQRT3 = Math.sqrt(3);

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const copy = (p) => ({ x: p.x, y: p.y });

  /* DoubLine.CreateMidPoint(t): t at the first point, 1-t at the second. */
  function pointOnLine(p, q, t) {
    return { x: p.x * t + q.x * (1 - t), y: p.y * t + q.y * (1 - t) };
  }

  /* DoubLine.UpdateMidPoint: the parameter of m on the line p--q. */
  function lineParam(p, q, m) {
    const dx = p.x - q.x, dy = p.y - q.y;
    const den = dx * dx + dy * dy;
    if (den < EPS) return null;
    return dot({ x: dx, y: dy }, { x: m.x - q.x, y: m.y - q.y }) / den;
  }

  /* The point of the infinite line p--q nearest to m. */
  function projectOnLine(m, p, q) {
    const t = lineParam(p, q, m);
    return t === null ? copy(q) : pointOnLine(p, q, t);
  }

  /* GeoSDoub.Intersect of two lines, with the applet's |det| >= 1 test. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (!(Math.abs(det) >= 1)) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const mid1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const mid2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const perp1 = { x: mid1.x + (q.y - p.y), y: mid1.y - (q.x - p.x) };
    const perp2 = { x: mid2.x + (r.y - q.y), y: mid2.y - (r.x - q.x) };
    return intersect(mid1, perp1, mid2, perp2);
  }

  /* AsiaPacificKiteCanvas.GetCircle: radius is the mean of the three radii. */
  function circle(p, q, r) {
    const c = circumcenter(p, q, r);
    if (!finite(c)) return null;
    const radius = (dist(c, p) + dist(c, q) + dist(c, r)) / 3;
    if (!Number.isFinite(radius) || radius <= EPS) return null;
    return { x: c.x, y: c.y, r: radius };
  }

  /* GeoSDoub.IntersectCirclesX, transcribed from the applet's bytecode. */
  function circleIntersectionsX(c0, c1) {
    const m = -(c0.y - c1.y) / (c0.x - c1.x);
    const b = (
      c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.x - c1.x);
    const h = b - c0.x;
    const a = m * m + 1;
    const k = m * h - c0.y;
    const c = h * h + c0.y * c0.y - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  /* GeoSDoub.IntersectCirclesY, the symmetric branch when centres share x. */
  function circleIntersectionsY(c0, c1) {
    const m = -(c0.x - c1.x) / (c0.y - c1.y);
    const b = (
      c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.y - c1.y);
    const h = b - c0.y;
    const a = m * m + 1;
    const k = m * h - c0.x;
    const c = h * h + c0.x * c0.x - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  /* GeoSDoub.Intersect(DoubCircle, DoubCircle). */
  function circleIntersections(c0, c1) {
    if (!c0 || !c1) return [];
    if (Math.abs(c0.x - c1.x) > 1) return circleIntersectionsX(c0, c1);
    if (Math.abs(c0.y - c1.y) > 1) return circleIntersectionsY(c0, c1);
    return [copy(c0)];
  }

  /* AsiaPacificKiteCanvas.Other: the intersection that is not M. */
  function other(points, m) {
    if (!points || !points.length) return null;
    return dist(points[0], m) >= 1 ? points[0] : (points[1] || points[0]);
  }

  /* AsiaPacificKiteCanvas.init, for a canvas of the given size. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const half = Math.max(cx / 4, cy / 3) * SQRT3;
    const A = { x: cx - cx / 4, y: cy };
    const B = { x: cx, y: cy - half };
    const C = { x: cx + cx / 4, y: cy };
    const D = { x: cx, y: cy + half };
    let state = {
      width, height, A, B, C, D,
      coefE: 1.8, coefF: -0.3,
      E: pointOnLine(A, B, 1.8), F: pointOnLine(B, C, -0.3),
    };
    /* The applet's init calls ComputeF once after creating F. */
    state = computeF(state);
    return state;
  }

  function computeF(s) {
    const f = intersect(s.E, s.D, s.B, s.C);
    if (!finite(f)) return { ...s, F: { x: NaN, y: NaN }, coefF: null };
    const t = lineParam(s.B, s.C, f);
    return { ...s, F: f, coefF: t };
  }

  function computeE(s) {
    const e = intersect(s.F, s.D, s.A, s.B);
    if (!finite(e)) return { ...s, E: { x: NaN, y: NaN }, coefE: null };
    const t = lineParam(s.A, s.B, e);
    return { ...s, E: e, coefE: t };
  }

  /* FixAC / FixBD from UpgradePoints: keep the diagonals perpendicular. */
  function fixBD(s, a, c) {
    const half = (Math.abs(c.x - a.x) * SQRT3) / 2;
    return {
      ...s, A: a, C: c,
      B: { x: s.width / 2, y: s.height / 2 - half },
      D: { x: s.width / 2, y: s.height / 2 + half },
    };
  }

  function fixAC(s, b, d) {
    const half = Math.abs(d.y - b.y) / (2 * SQRT3);
    return {
      ...s, B: b, D: d,
      A: { x: s.width / 2 - half, y: s.height / 2 },
      C: { x: s.width / 2 + half, y: s.height / 2 },
    };
  }

  function improve(s, next) {
    return {
      ...next,
      E: pointOnLine(next.A, next.B, next.coefE),
      F: pointOnLine(next.B, next.C, next.coefF),
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** UpgradePoints: one named point has been dragged to p (board units). */
  function withPoint(s, name, p) {
    if (!s || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    const x = clamp(p.x, 0, s.width), y = clamp(p.y, 0, s.height);
    if (name === "A") {
      const a = { x, y: s.height / 2 };
      return improve(s, fixBD(s, a, { x: s.width - a.x, y: s.height / 2 }));
    }
    if (name === "C") {
      const c = { x, y: s.height / 2 };
      return improve(s, fixBD(s, { x: s.width - c.x, y: s.height / 2 }, c));
    }
    if (name === "B") {
      const b = { x: s.width / 2, y };
      return improve(s, fixAC(s, b, { x: s.width / 2, y: s.height - b.y }));
    }
    if (name === "D") {
      const d = { x: s.width / 2, y };
      return improve(s, fixAC(s, { x: s.width / 2, y: s.height - d.y }, d));
    }
    if (name === "E") {
      const e = projectOnLine({ x, y }, s.A, s.B);
      if (!finite(e)) return s;
      const next = { ...s, E: e, coefE: lineParam(s.A, s.B, e) };
      return computeF(next);
    }
    if (name === "F") {
      const f = projectOnLine({ x, y }, s.B, s.C);
      if (!finite(f)) return s;
      const next = { ...s, F: f, coefF: lineParam(s.B, s.C, f) };
      return computeE(next);
    }
    return s;
  }

  /** Geometry derived the way AsiaPacificKiteCanvas.Compute derives it. */
  function geometry(s) {
    const m = intersect(s.A, s.F, s.C, s.E);
    if (!finite(m)) return { M: null, N: null, circleABC: null, circleAEM: null, circleCFM: null };
    const cABC = circle(s.A, s.B, s.C);
    const cAEM = circle(s.A, s.E, m);
    const cCFM = circle(s.C, s.F, m);
    const points = circleIntersections(cAEM, cCFM).filter(finite);
    const n = other(points, m);
    return {
      M: m,
      N: finite(n) ? n : null,
      circleABC: cABC, circleAEM: cAEM, circleCFM: cCFM,
    };
  }

  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const den = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (den < EPS) return NaN;
    return (Math.acos(clamp(dot(u, w) / den, -1, 1)) * 180) / Math.PI;
  }

  function distToLine(p, a, b) {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  }

  /** True when E is past A and F past C, the page's stated configuration. */
  function isExterior(s) {
    return s.coefE > 1 && s.coefF < 0 && Number.isFinite(s.coefE) && Number.isFinite(s.coefF);
  }

  /** Every claim the discussion makes, as booleans for the logic test. */
  function claims(s) {
    const g = geometry(s);
    const out = {
      rhombus: false, angleABC: false, MOnCircle: false, NOnEF: false,
      powerC: false, powerA: false, tangentA: false, tangentC: false,
      angleAMC: false, exteriorArc: false,
    };
    const sides = [dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.D), dist(s.D, s.A)];
    const scale = Math.max(s.width, s.height);
    const tol = 1e-6 * scale;
    if (Math.min(...sides) < EPS) return out;
    out.rhombus = sides.every((d) => Math.abs(d - sides[0]) <= tol);
    out.angleABC = Math.abs(angleAt(s.B, s.A, s.C) - 60) <= 1e-8;
    if (!finite(g.M) || !g.circleABC) return out;
    out.MOnCircle = Math.abs(dist(g.M, g.circleABC) - g.circleABC.r) <= tol;
    const ca2 = dist(s.C, s.A) ** 2;
    out.powerC = Math.abs(dist(g.M, s.C) * dist(s.E, s.C) - ca2) <= tol * scale;
    out.powerA = Math.abs(dist(g.M, s.A) * dist(s.F, s.A) - ca2) <= tol * scale;
    out.tangentA = Boolean(g.circleAEM) &&
      Math.abs(distToLine(g.circleAEM, s.A, s.C) - g.circleAEM.r) <= tol;
    out.tangentC = Boolean(g.circleCFM) &&
      Math.abs(distToLine(g.circleCFM, s.A, s.C) - g.circleCFM.r) <= tol;
    const amc = angleAt(g.M, s.A, s.C);
    out.angleAMC = Math.abs(amc - 120) <= 1e-6 || Math.abs(amc - 60) <= 1e-6;
    /* In the exterior configuration M is on the arc AC away from B, whether
     * the applet's B happens to be above or below the centre of the canvas. */
    out.exteriorArc = isExterior(s) &&
      Math.abs(amc - 120) <= 1e-6 &&
      (g.M.y - s.height / 2) * (s.B.y - s.height / 2) <= tol;
    if (finite(g.N)) out.NOnEF = distToLine(g.N, s.E, s.F) <= tol;
    return out;
  }

  /** The s-parameter of E on AB (s=0 at A, s=1 at B), used by the test. */
  function lineS(s) {
    const t = lineParam(s.A, s.B, s.E);
    return t === null ? null : 1 - t;
  }

  /** Nothing is won or lost: this is an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    SQRT3, dist, dot, finite, copy,
    pointOnLine, lineParam, projectOnLine, intersect,
    circumcenter, circle, circleIntersections, circleIntersectionsX,
    circleIntersectionsY, other,
    start, computeE, computeF, fixAC, fixBD, withPoint, geometry,
    angleAt, distToLine, isExterior, claims, lineS, result,
  };
})();
