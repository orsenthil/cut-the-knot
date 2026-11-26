"use strict";

/*
 * BID — the "Consecutive Isosceles Decomposition" applet by Alexander Bogomolny.
 *
 * Start with an isosceles triangle ABC (AB = AC). Walk up its two sides:
 * from the base, draw a circle with radius BC to find D with BD = BC, put E
 * on the perpendicular bisector of BD so that BE = DE, then repeat with the
 * same radius: EF = DE, and so on. The last step always lands so that
 * AF = EF, for every apex angle below 60 degrees.
 *
 * The one idea the code relies on: the applet's own construction is a chain
 * of circle/line and perpendicular-bisector intersections, and it is simpler
 * to reproduce that chain than to invent a formula for the points. For an
 * apex angle under 45 degrees the four triangles BCD, BDE, DEF and AEF tile
 * ABC; at 45 degrees D and F coincide (three triangles); above 45 the equal
 * sides still match but F lies past D and the lines cross. At 36 degrees
 * (the golden triangle) the two pairs of triangles are similar.
 *
 * The labels here follow the article's figure: B is the left base, C the
 * right base. The applet called its right base "B" and its left base "C";
 * that is only a mirror of the same construction.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, BidCore. All functions take plain data
 * and return new objects; nothing passed in is changed.
 */
const BidCore = (() => {
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const copy = (p) => point(p.x, p.y);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const cross = (u, v) => u.x * v.y - u.y * v.x;
  const doubleArea = (p, q, r) => Math.abs(cross(point(q.x - p.x, q.y - p.y), point(r.x - p.x, r.y - p.y)));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (u, v, tol) => Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= tol;

  /** Where the infinite lines p1p2 and p3p4 meet; NaN point if parallel. */
  function lineIntersection(p1, p2, p3, p4) {
    const u = point(p2.x - p1.x, p2.y - p1.y);
    const v = point(p4.x - p3.x, p4.y - p3.y);
    const den = cross(u, v);
    if (Math.abs(den) < 1) return point(NaN, NaN); // the applet's own cut-off
    const t = cross(point(p3.x - p1.x, p3.y - p1.y), v) / den;
    return point(p1.x + t * u.x, p1.y + t * u.y);
  }

  /**
   * The two points where the circle (c, r) cuts the infinite line pq.
   * The first entry is the lower one on the screen (the larger y), as in
   * GeoSDoub.IntersectX, so "Other" can pick the entry that is not p.
   */
  function circleLine(c, r, p, q) {
    const u = point(q.x - p.x, q.y - p.y);
    const len2 = dot(u, u);
    if (len2 < EPS) return null;
    const w = point(c.x - p.x, c.y - p.y);
    const t = dot(w, u) / len2;
    const foot = point(p.x + t * u.x, p.y + t * u.y);
    const away2 = cross(u, w) * cross(u, w) / len2; // squared distance to the line
    const along2 = r * r - away2;
    if (along2 < -1e-8 * r * r) return null; // no real intersection
    const s = Math.sqrt(Math.max(0, along2) / len2);
    return [point(foot.x - s * u.x, foot.y - s * u.y),
            point(foot.x + s * u.x, foot.y + s * u.y)];
  }

  /** The triangle BIDCanvas.Reset draws for a scrollbar value. */
  function resetTriangle(angle, width, height) {
    const w = width === undefined ? 400 : width;
    const h0 = height === undefined ? 300 : height;
    const dy = 30;
    const rad = (angle * Math.PI) / 180;
    let margin = 10;
    let heightOfTriangle = h0 - margin - 2 * dy;
    let half = heightOfTriangle * Math.tan(rad / 2);
    if (2 * half > w - 2 * dy) {
      half = (w - 2 * dy) / 2;
      heightOfTriangle = half / Math.tan(rad / 2);
      margin = h0 - heightOfTriangle - 2 * dy;
    }
    const A = point(Math.floor(w / 2), margin + dy);
    return { A, B: point(A.x - half, A.y + heightOfTriangle), C: point(A.x + half, A.y + heightOfTriangle) };
  }

  /** The apex angle of any isosceles position, in degrees. */
  function angleOf(s) {
    const u = point(s.B.x - s.A.x, s.B.y - s.A.y);
    const v = point(s.C.x - s.A.x, s.C.y - s.A.y);
    const den = Math.sqrt(dot(u, u) * dot(v, v));
    if (den < EPS) return 0;
    return (Math.acos(clamp(dot(u, v) / den, -1, 1)) * 180) / Math.PI;
  }

  function makeState(s, A, B, C) {
    const next = { ...s, A: copy(A), B: copy(B), C: copy(C) };
    next.angle = Math.round(angleOf(next) * 1e9) / 1e9;
    return next;
  }

  /** A new game is the applet's starting scrollbar value of 45 degrees. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const angle = o.angle === undefined ? 45 : o.angle;
    const tri = resetTriangle(angle, width, height);
    return { ...makeState({ width, height }, tri.A, tri.B, tri.C), angle };
  }

  /** Move the scrollbar: the whole triangle is laid out again. */
  function withAngle(s, angle) {
    const tri = resetTriangle(angle, s.width, s.height);
    return { ...makeState(s, tri.A, tri.B, tri.C), angle };
  }

  /** Drag a vertex; the two equal sides are kept and the angle follows. */
  function withPoint(s, name, p) {
    const baseY = s.B.y;
    const half = Math.abs(s.C.x - s.A.x);
    if (name === "A") {
      const A = point(p.x, p.y);
      return makeState(s, A, point(A.x - half, baseY), point(A.x + half, baseY));
    }
    if (name === "B" || name === "C") {
      const h = Math.max(EPS, Math.abs(p.x - s.A.x));
      return makeState(s, copy(s.A), point(s.A.x - h, baseY), point(s.A.x + h, baseY));
    }
    return { ...s };
  }

  /** BIDCanvas.Compute: the chain of points, in the order the applet draws it. */
  function construct(s) {
    const angle = s.angle === undefined ? angleOf(s) : s.angle;
    const A = s.A, B = s.B, C = s.C;
    const points = [copy(C), copy(B)]; // the base ends, in the applet's order
    const labels = ["C", "B", "D", "E", "F", "G", "H", "I", "J", "K"];
    let radius = distance(B, C);
    const steps = Math.round(180 / angle / 2) + 1;
    let n = steps - 1;
    while (n-- >= 0) {
      const size = points.length;
      const last = points[size - 1];
      const prev = points[size - 2];
      if (size === 3) {
        // The third point sits on the perpendicular bisector of B and D,
        // where the applet's first circle last cut the far side.
        const mid = point((prev.x + last.x) / 2, (prev.y + last.y) / 2);
        const perp = point(mid.x + (prev.y - last.y), mid.y + (last.x - prev.x));
        const p = lineIntersection(A, prev, mid, perp);
        points.push(p);
        radius = distance(B, p);
      } else {
        const hits = circleLine(last, radius, prev, A);
        // GeoSDoub.Other returns the second hit, or the old point when the
        // circle misses the line (a tangency, e.g. at 45 degrees).
        const p = hits ? (distance(hits[0], prev) < 1 ? hits[1] : hits[0]) : prev;
        if (p.y <= A.y - 0.001) break; // the next step would pass the apex
        points.push(copy(p));
      }
    }
    return { points, labels, radius, steps };
  }

  /** The three angles of a triangle, in degrees, at p, q and r. */
  function anglesOf(p, q, r) {
    const at = (v, x, y) => {
      const u = point(x.x - v.x, x.y - v.y);
      const w = point(y.x - v.x, y.y - v.y);
      const den = Math.sqrt(dot(u, u) * dot(w, w));
      if (den < EPS) return NaN;
      return (Math.acos(clamp(dot(u, w) / den, -1, 1)) * 180) / Math.PI;
    };
    return [at(p, q, r), at(q, p, r), at(r, p, q)];
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function analyze(s) {
    const built = construct(s);
    const points = built.points;
    const D = points[2], E = points[3], F = points[4], G = points[5];
    const BC = distance(s.B, s.C);
    const BD = D ? distance(s.B, D) : null;
    const BE = E ? distance(s.B, E) : null;
    const DE = D && E ? distance(D, E) : null;
    const EF = E && F ? distance(E, F) : null;
    const AF = F ? distance(s.A, F) : null;
    const lengths = { BC, BD, BE, DE, EF, AF, AD: D ? distance(s.A, D) : null };
    const triangles = {
      BCD: D ? anglesOf(s.B, s.C, D) : null,
      BDE: D && E ? anglesOf(s.B, D, E) : null,
      DEF: D && E && F ? anglesOf(D, E, F) : null,
      AEF: E && F ? anglesOf(s.A, E, F) : null,
    };
    return {
      ...s,
      measuredAngle: angleOf(s),
      points,
      labels: built.labels,
      steps: built.steps,
      radius: built.radius,
      D, E, F, G,
      lengths,
      triangles,
      areaABC: doubleArea(s.A, s.B, s.C) / 2,
    };
  }

  /** True when p lies on the segment xy (ends included). */
  function onSegment(p, x, y) {
    if (!p) return false;
    const d = distance(x, y);
    if (d < EPS) return false;
    return Math.abs(distance(x, p) + distance(p, y) - d) <= 1e-7 * d;
  }

  /** Every claim the article makes, checked at this position. */
  function claims(s) {
    const m = analyze(s);
    const a = m.measuredAngle;
    const tol = 1e-6 * Math.max(1, m.lengths.BC);
    const eq = (u, v) => close(u, v, tol);
    const { D, E, F } = m;
    const L = m.lengths;
    const equalSides = Boolean(D && E && F &&
      eq(L.BD, L.BC) && eq(L.BE, L.DE) && eq(L.EF, L.DE) && eq(L.AF, L.EF));
    const def = m.triangles.DEF;
    const defOK = Boolean(def && def.every(Number.isFinite));
    const angleFormulas = Boolean(m.triangles.BCD && m.triangles.BDE && m.triangles.AEF &&
      eq(m.triangles.BCD[0], a) &&
      eq(m.triangles.BCD[1], 90 - a / 2) && eq(m.triangles.BCD[2], 90 - a / 2) &&
      eq(m.triangles.BDE[2], 3 * a) &&
      eq(m.triangles.BDE[0], 90 - (3 * a) / 2) && eq(m.triangles.BDE[1], 90 - (3 * a) / 2) &&
      eq(m.triangles.AEF[0], a) && eq(m.triangles.AEF[1], a) &&
      eq(m.triangles.AEF[2], 180 - 2 * a) &&
      (!defOK || (eq(def[0], Math.min(2 * a, 180 - 2 * a)) &&
                  eq(def[2], Math.min(2 * a, 180 - 2 * a)) &&
                  eq(def[1], Math.abs(180 - 4 * a)))));
    const parts = D && E && F
      ? doubleArea(s.B, s.C, D) / 2 + doubleArea(s.B, D, E) / 2 +
        doubleArea(D, E, F) / 2 + doubleArea(s.A, E, F) / 2
      : 0;
    const tiles = Boolean(equalSides && onSegment(D, s.A, s.C) && onSegment(E, s.A, s.B) &&
      onSegment(F, s.A, D) && eq(parts, m.areaABC));
    const sorted = (angles) => (angles ? [...angles].sort((u, v) => u - v) : null);
    const golden = Boolean(Math.abs(a - 36) < 1e-6 && defOK &&
      m.triangles.AEF && m.triangles.BDE && m.triangles.BCD &&
      sorted(m.triangles.AEF).every((v, i) => eq(v, sorted(m.triangles.BDE)[i])) &&
      sorted(m.triangles.DEF).every((v, i) => eq(v, sorted(m.triangles.BCD)[i])));
    const obtusePair = Boolean(m.triangles.BDE && m.triangles.DEF &&
      m.triangles.BDE[2] > 90 && m.triangles.AEF[2] > 90 &&
      m.triangles.BCD.every((v) => v < 90) && m.triangles.DEF.every((v) => v < 90));
    return {
      equalSides, angleFormulas, tiles, golden, obtusePair,
      threeAt45: Boolean(equalSides && Math.abs(a - 45) < 1e-6 && eq(L.AF, L.AD) &&
        eq(doubleArea(s.B, s.C, D) / 2 + doubleArea(s.B, D, E) / 2 +
           doubleArea(s.A, E, F) / 2, m.areaABC)),
      crossesAbove45: Boolean(equalSides && a > 45 && a < 60 && F && !onSegment(F, s.A, D)),
      noChainAbove60: a > 60 + 1e-3 && m.points.length === 2,
      partsRatio: m.areaABC > EPS ? parts / m.areaABC : NaN,
    };
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withAngle, withPoint, resetTriangle, angleOf, construct, analyze,
    anglesOf, onSegment, claims, result, distance, point, copy, close,
  };
})();
