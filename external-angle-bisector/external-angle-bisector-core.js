"use strict";

/*
 * External Angle Bisector — the illustration behind Alexander Bogomolny's
 * applet ExternalAngleBisector (cut-the-knot.org/Curriculum/Geometry/
 * ExternalAngleBisector.shtml).
 *
 * Drag the corners of a triangle: the line through A perpendicular to the
 * bisector of angle A is the bisector of the *external* angle at A. It meets
 * the line BC at D, outside the segment, and the page claims
 * AB/AC = DB/DC, just as for the internal bisector. The proof draws the
 * parallel through C to AD meeting line AB at E; then AE = AC and triangles
 * BEC and BAD are similar.
 *
 * The one idea the code relies on is that side lengths are weights: with
 * a = |BC|, b = |CA|, c = |AB|, the internal foot on BC is
 * (b*B + c*C)/(b+c) and the external foot is (c*C - b*B)/(c-b). The point E
 * comes from an honest line intersection, as the applet's GeoSDoub.Intersect
 * does. When b = c the external bisector is parallel to BC; the applet then
 * draws the line through A parallel to BC, and so does this code.
 *
 * The page also prints an angle calculation. Read literally it ends with
 * "90° = BAC/2", which is false; the true identity is
 * angle AEC = angle ACE = 90° - BAC/2. The logic test checks both the true
 * identity and the failure of the printed one.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, ExternalAngleBisectorCore, so the page
 * loads it with a plain <script> and porting/check-external-angle-bisector.mjs
 * loads it in Node. Every function takes plain data and returns new objects;
 * nothing passed in is changed.
 */
const ExternalAngleBisectorCore = (() => {
  const EPS = 1e-9;
  const FAR = 10000; // the applet rejects a foot with |x| or |y| above this

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const vecCross = (u, v) => u.x * v.y - u.y * v.x;
  const cross = (a, b, c) => vecCross(
    { x: b.x - a.x, y: b.y - a.y },
    { x: c.x - a.x, y: c.y - a.y },
  );
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

  /** Intersect the infinite lines p1p2 and p3p4 (GeoSDoub.Intersect). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < EPS) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** The starting triangle, placed as ExternalAngleBisectorCanvas.init places it. */
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
    // Canvas.init: half the width, three fifths of the height, an eighth of
    // the width, and a fixed offset of 50. C is 60 degrees from B.
    const halfW = width / 2;
    const highY = (height * 3) / 5;
    const step = width / 8;
    const off = 50;
    return {
      A: { x: halfW, y: highY + off },
      B: { x: halfW + 2 * step, y: highY + off },
      C: {
        x: halfW + step * Math.cos(Math.PI / 3),
        y: highY - step * Math.sin(Math.PI / 3) - (off * 3) / 2,
      },
      // The page embeds the applet twice; the second instance sets
      // ShowNames=1. This port shows those names by default.
      showNames: true, hint: false, extra: false,
    };
  }

  /** a = |BC|, b = |CA|, c = |AB|, in the applet's notation. */
  function sides(s) {
    return { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) };
  }

  /** Twice the unsigned area, handy as a scale for tolerances. */
  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  function isDegenerate(s) {
    const len = sides(s);
    return !Number.isFinite(len.a + len.b + len.c) ||
      doubleArea(s) < 1e-7 || Math.min(len.a, len.b, len.c) < EPS;
  }

  /** Foot of the internal bisector at `v` on the line pq. */
  function internalFootAt(v, p, q) {
    const vp = distance(v, p), vq = distance(v, q);
    if (!Number.isFinite(vp + vq) || vp + vq < EPS) return null;
    return {
      x: (vq * p.x + vp * q.x) / (vp + vq),
      y: (vq * p.y + vp * q.y) / (vp + vq),
    };
  }

  /**
   * Foot of the external bisector at `v` on the line pq. It divides pq
   * externally in the ratio |vp| / |vq|. No finite foot when the two sides
   * are equal (the bisector is parallel to pq), or when the foot is far
   * outside the applet's 10000-unit guard.
   */
  function externalFootAt(v, p, q) {
    const vp = distance(v, p), vq = distance(v, q);
    const d = vp - vq;
    if (!Number.isFinite(d) || Math.abs(d) < 1e-7 || Math.abs(cross(v, p, q)) < 1e-7) return null;
    const foot = {
      x: (vp * q.x - vq * p.x) / d,
      y: (vp * q.y - vq * p.y) / d,
    };
    if (!Number.isFinite(foot.x) || !Number.isFinite(foot.y) ||
        Math.abs(foot.x) > FAR || Math.abs(foot.y) > FAR) return null;
    return foot;
  }

  const internalFoot = (s) => internalFootAt(s.A, s.B, s.C);
  const externalFoot = (s) => externalFootAt(s.A, s.B, s.C);

  /**
   * A direction vector along the external bisector at A. The applet falls
   * back to the line through A parallel to BC when it has no finite foot.
   */
  function externalDirection(s) {
    const D = externalFoot(s);
    if (D) return { x: D.x - s.A.x, y: D.y - s.A.y };
    return directionAt(s.A, s.B, s.C);
  }

  /** GeoSDoub.GetParallelTo(C, A, D): C + 100*(A-D), or its fallback. */
  function parallelPoint(s, D) {
    if (D) return { x: s.C.x + 100 * (s.A.x - D.x), y: s.C.y + 100 * (s.A.y - D.y) };
    const d = directionAt(s.A, s.B, s.C);
    return { x: s.C.x + 100 * d.x, y: s.C.y + 100 * d.y };
  }

  /** Canvas.Draw: D, the parallel through C, and E on the line AB. */
  function auxiliary(s) {
    const D = externalFoot(s);
    const F = internalFoot(s);
    const parallel = parallelPoint(s, D);
    const E = intersect(s.B, s.A, s.C, parallel);
    // The applet uses its far-away fallback point for this test as well.
    const testD = D || { x: s.A.x + 100 * (s.B.x - s.C.x), y: s.A.y + 100 * (s.B.y - s.C.y) };
    return { D, F, parallel, E, testD, direction: externalDirection(s) };
  }

  /** The smaller angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (!norm) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / norm)));
  }

  /** Reflect a point in the line through a with direction d. */
  function reflectInDirection(p, a, d) {
    const len2 = dot(d, d);
    if (!len2) return { ...p };
    const t = dot({ x: p.x - a.x, y: p.y - a.y }, d) / len2;
    return { x: 2 * (a.x + d.x * t) - p.x, y: 2 * (a.y + d.y * t) - p.y };
  }

  /** InsideTest.IsInside(B, C, D) from the applet, as a boolean. */
  function insideTest(B, C, D) {
    if (!D) return false;
    return (B.x - C.x) * (B.x - D.x) + (B.y - C.y) * (B.y - D.y) <= 0;
  }

  /**
   * The external-bisector direction at any vertex: the difference of the two
   * unit rays. This stays accurate even when the foot is beyond the applet's
   * 10000-unit guard, where p-q alone would only be an approximation.
   */
  function directionAt(v, p, q) {
    const vp = distance(v, p), vq = distance(v, q);
    if (!vp || !vq) return { x: p.x - q.x, y: p.y - q.y };
    return {
      x: (p.x - v.x) / vp - (q.x - v.x) / vq,
      y: (p.y - v.y) / vp - (q.y - v.y) / vq,
    };
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(s) {
    const lens = sides(s);
    const { D, F, parallel, E, testD, direction } = auxiliary(s);
    const inside = insideTest(s.B, s.C, testD);
    const chosen = inside ? s.B : s.C;
    const reflected = reflectInDirection(chosen, s.A, direction);
    const bisPoint = { x: s.A.x + direction.x, y: s.A.y + direction.y };
    const t = D && lens.a ? distance(s.B, D) / lens.a : null;
    const BAC = angleAt(s.A, s.B, s.C);
    const halfComplement = Math.PI / 2 - BAC / 2;
    return {
      A: s.A, B: s.B, C: s.C,
      sides: lens,
      degenerate: isDegenerate(s),
      doubleArea: doubleArea(s),
      D, F, parallel, E, testD, direction, bisPoint, inside, chosen, reflected,
      t,
      angles: {
        BAC,
        AEC: E ? angleAt(E, s.A, s.C) : null,
        ACE: E ? angleAt(s.C, s.A, E) : null,
        halfComplement,
        externalWithChosen: angleAt(s.A, chosen, bisPoint),
        externalWithReflection: angleAt(s.A, reflected, bisPoint),
      },
      ratios: {
        AB_AC: lens.b ? lens.c / lens.b : null,
        internalDB_DC: F && distance(F, s.C) ? distance(s.B, F) / distance(F, s.C) : null,
        externalDB_DC: D && distance(D, s.C) ? distance(s.B, D) / distance(D, s.C) : null,
        AE_AC: E ? distance(s.A, E) / lens.b : null,
        BE_BA: E && lens.c ? distance(s.B, E) / lens.c : null,
        BC_BD: D && distance(s.B, D) ? lens.a / distance(s.B, D) : null,
        CE_AD: E && D ? distance(s.C, E) / distance(s.A, D) : null,
      },
      showNames: s.showNames !== false,
      hint: Boolean(s.hint),
      extra: Boolean(s.extra),
    };
  }

  /** The common excenter: internal at A, external at B and C. */
  function excenter(s) {
    const { a, b, c } = sides(s);
    const den = -a + b + c;
    if (Math.abs(den) < EPS) return null;
    return {
      x: (-a * s.A.x + b * s.B.x + c * s.C.x) / den,
      y: (-a * s.A.y + b * s.B.y + c * s.C.y) / den,
    };
  }

  /**
   * Each claim on the applet's page, checked numerically at this triangle.
   * `printedAngle` is the page's literal closing equality, which is false;
   * `correctedAngle` is the true statement proved just above it.
   */
  function claims(s) {
    const m = measurements(s);
    const off = {
      internalRatio: false, externalRatio: false, perpendicular: false,
      AE_equals_AC: false, CE_parallel_AD: false, similarTriangles: false,
      bisectsExternalAngle: false, correctedAngle: false, concurrence: false,
      printedAngle: false,
    };
    if (m.degenerate) return off;

    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-6 * scale;
    const close = (x, y, eps = 1e-7) =>
      Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= eps;
    const onLine = (p, x, y) => p && Math.abs(cross(x, y, p)) <= tol;
    const X = excenter(s);

    // "AB/AC = DB/DC" for the internal foot and, as the page adds, for the
    // external foot. Past the applet's 10000-unit guard there is no drawn
    // foot, so use the untruncated foot to check the limiting ratio.
    const internalRatio = m.ratios.internalDB_DC !== null &&
      close(m.ratios.internalDB_DC, m.ratios.AB_AC, 1e-7);
    let externalRatio;
    if (m.D) {
      externalRatio = close(m.ratios.externalDB_DC, m.ratios.AB_AC, 1e-7);
    } else {
      const vp = m.sides.c, vq = m.sides.b, d = vp - vq;
      if (Math.abs(d) < 1e-7) {
        externalRatio = close(m.ratios.AB_AC, 1, 1e-7); // exactly parallel
      } else {
        const raw = Math.abs(cross(s.A, s.B, s.C)) > 1e-7 ? {
          x: (vp * s.C.x - vq * s.B.x) / d,
          y: (vp * s.C.y - vq * s.B.y) / d,
        } : null;
        const dp = raw ? distance(raw, s.B) : 0, dq = raw ? distance(raw, s.C) : 0;
        externalRatio = Boolean(raw) && dq > 0 && close(dp / dq, m.ratios.AB_AC, 1e-7);
      }
    }

    // The outside bisector is perpendicular to the inside one.
    const perp = m.F && close(dot(
      { x: m.F.x - s.A.x, y: m.F.y - s.A.y }, m.direction,
    ) / (scale * Math.hypot(m.direction.x, m.direction.y)), 0, 1e-7);

    const parallel = m.E && Math.abs(vecCross(
      { x: m.bisPoint.x - s.A.x, y: m.bisPoint.y - s.A.y },
      { x: m.E.x - s.C.x, y: m.E.y - s.C.y },
    )) <= tol * Math.hypot(m.direction.x, m.direction.y);

    const onDirection = (p, v, d) => p &&
      Math.abs(vecCross({ x: p.x - v.x, y: p.y - v.y }, d)) <= tol * Math.hypot(d.x, d.y);
    const concurrence = Boolean(X) && onDirection(X, s.A, m.F
      ? { x: m.F.x - s.A.x, y: m.F.y - s.A.y } : m.direction) &&
      onDirection(X, s.B, directionAt(s.B, s.A, s.C)) &&
      onDirection(X, s.C, directionAt(s.C, s.A, s.B));

    return {
      internalRatio,
      externalRatio,
      perpendicular: Boolean(perp),
      AE_equals_AC: m.ratios.AE_AC !== null && close(m.ratios.AE_AC, 1),
      CE_parallel_AD: Boolean(parallel),
      // With b = c the foot is at infinity and E coincides with B; the
      // similarity statement is the limiting one, so only AE = AC remains.
      similarTriangles: m.E && (m.D
        ? close(m.ratios.BE_BA, m.ratios.BC_BD, 1e-7) &&
          close(m.ratios.CE_AD, m.ratios.BC_BD, 1e-7)
        : close(m.ratios.AE_AC, 1)),
      bisectsExternalAngle: close(m.angles.externalWithChosen, m.angles.externalWithReflection, 1e-7),
      correctedAngle: m.E && close(m.angles.AEC, m.angles.halfComplement, 1e-7) &&
        close(m.angles.ACE, m.angles.halfComplement, 1e-7),
      // The page prints "... = 90° = BAC/2". That is only true in the
      // degenerate limit BAC = 180°, so it must fail for a real triangle.
      printedAngle: close(m.angles.ACE, Math.PI / 2, 1e-7) &&
        close(m.angles.BAC / 2, Math.PI / 2, 1e-7),
      concurrence,
    };
  }

  /**
   * The applet's Hint: lines drawn parallel to AD between two sides. Each
   * pair joins a point on `from` to a point on `to`; the count is the
   * applet's (int)(length/15) scaled by the neighbouring side lengths.
   */
  function hintSegments(s, m) {
    if (!m || m.degenerate || !m.E) return [];
    const D = m.testD || m.D;
    if (!D) return [];
    const out = [];
    const dir = m.direction;
    function parallels(p, q, r, u, step) {
      const length = distance(p, q);
      const count = Math.trunc(length / step);
      if (!Number.isFinite(count) || count <= 0 || length < 2 * count) return;
      for (let i = 0; i < count && out.length < 80; i++) {
        const P = lerp(p, q, i / count);
        const Q = intersect(P, { x: P.x + 100 * dir.x, y: P.y + 100 * dir.y }, r, u);
        if (Q) out.push([P, Q]);
      }
    }
    const base = Math.trunc((m.inside ? distance(s.A, s.C) : distance(s.B, D)) / 15);
    if (base <= 0) return out;
    if (m.inside) {
      const CD = distance(s.C, D), CB = m.sides.a, DB = distance(D, s.B);
      const n1 = Math.trunc((base * CB) / CD);
      const n2 = Math.trunc((base * DB) / CD);
      const p = m.extra ? m.E : s.C;
      parallels(p, s.B, s.C, s.A, distance(s.B, p) / n1);
      parallels(s.B, D, s.C, s.A, DB / n2);
    } else {
      const BD = distance(s.B, D), BC = m.sides.a, CD = distance(s.C, D);
      const n1 = Math.trunc((base * BC) / BD);
      const n2 = Math.trunc((base * CD) / BD);
      parallels(D, s.C, s.A, s.B, CD / n2);
      parallels(s.C, s.B, s.A, s.B, BC / n1);
    }
    return out;
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
    EPS, FAR, distance, dot, cross, vecCross, lerp, intersect,
    start, sides, doubleArea, isDegenerate,
    internalFootAt, externalFootAt, internalFoot, externalFoot,
    externalDirection, directionAt, parallelPoint, auxiliary, angleAt,
    reflectInDirection, insideTest, measurements, excenter, claims,
    hintSegments, withPoint, withOption, result,
  };
})();
