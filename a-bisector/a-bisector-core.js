"use strict";

/*
 * ABisector — the illustration behind Bogomolny's "The Angle Bisectors".
 *
 * Drag the corners of a triangle and the three internal angle bisectors follow.
 * They always meet at one point, the incenter, which is the centre of the circle
 * touching all three sides. The bisector from A cuts BC at D with AB/AC = BD/DC.
 *
 * The one idea the code relies on: side lengths are weights. If a = |BC|,
 * b = |CA|, c = |AB|, then the bisector foot on BC is (b*B + c*C)/(b+c) and the
 * incenter is (a*A + b*B + c*C)/(a+b+c). Both follow from the angle-bisector
 * theorem and the area argument on the applet's page, and they hold for acute,
 * right and obtuse triangles alike.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, ABisectorCore, so the page loads it with a plain
 * <script> and porting/check-a-bisector.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const ABisectorCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lensRatio = (u, v) => (v > EPS ? u / v : null);

  /** The point on the segment XY nearest to p (x and y swapped away). */
  function projectOnSegment(p, x, y) {
    const dx = y.x - x.x, dy = y.y - x.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= EPS) return { x: x.x, y: x.y };
    const t = Math.max(0, Math.min(1, ((p.x - x.x) * dx + (p.y - x.y) * dy) / len2));
    return { x: x.x + dx * t, y: y.y + dy * t };
  }

  /** The starting triangle, placed just as ABisectorCanvas.GetPoint places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const radius = Math.min(width, height) / 3;
    const getPoint = (i) => {
      const a = (2 * Math.PI * (i + 1)) / 3;
      return {
        x: Math.round(width / 2 + radius * Math.cos(a)),
        y: Math.round(height / 2 + radius * Math.sin(a)) + 50,
      };
    };
    return { A: getPoint(0), B: getPoint(1), C: getPoint(2) };
  }

  /** a = |BC|, b = |CA|, c = |AB|, in the applet's notation. */
  function sides(s) {
    return {
      a: distance(s.B, s.C),
      b: distance(s.C, s.A),
      c: distance(s.A, s.B),
    };
  }

  /** Twice the (unsigned) area, handy as a scale for tolerances. */
  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  function isDegenerate(s) {
    const lens = sides(s);
    return doubleArea(s) < 1e-7 || Math.min(lens.a, lens.b, lens.c) < EPS;
  }

  /** Where the bisector from a vertex meets the opposite side. */
  function bisectorFoot(s, vertex) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    if (vertex === "A") return { x: (b * s.B.x + c * s.C.x) / (b + c), y: (b * s.B.y + c * s.C.y) / (b + c) };
    if (vertex === "B") return { x: (a * s.A.x + c * s.C.x) / (a + c), y: (a * s.A.y + c * s.C.y) / (a + c) };
    if (vertex === "C") return { x: (a * s.A.x + b * s.B.x) / (a + b), y: (a * s.A.y + b * s.B.y) / (a + b) };
    return null;
  }

  /** The incenter: the side lengths are the barycentric weights. */
  function incenter(s) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    const sum = a + b + c;
    return {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
  }

  /** Shortest distance from p to the infinite line through x and y. */
  function distToLine(p, x, y) {
    const len = distance(x, y);
    if (len < EPS) return Infinity;
    return Math.abs(cross(x, y, p)) / len;
  }

  function inradius(s) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    return doubleArea(s) / (a + b + c); // area / semiperimeter
  }

  /** Angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (norm < EPS) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / norm)));
  }

  function halfAngles(s) {
    return {
      A: angleAt(s.A, s.B, s.C) / 2,
      B: angleAt(s.B, s.A, s.C) / 2,
      C: angleAt(s.C, s.A, s.B) / 2,
    };
  }

  /** Ceva's product for the three bisector feet; it is exactly 1. */
  function ceva(s) {
    const D = bisectorFoot(s, "A"), E = bisectorFoot(s, "B"), F = bisectorFoot(s, "C");
    if (!D || !E || !F) return null;
    return (
      (distance(s.B, D) / distance(D, s.C)) *
      (distance(s.C, E) / distance(E, s.A)) *
      (distance(s.A, F) / distance(F, s.B))
    );
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(s) {
    const lens = sides(s);
    const feet = {
      D: bisectorFoot(s, "A"),
      E: bisectorFoot(s, "B"),
      F: bisectorFoot(s, "C"),
    };
    return {
      A: s.A, B: s.B, C: s.C,
      sides: lens,
      degenerate: isDegenerate(s),
      doubleArea: doubleArea(s),
      feet: feet,
      incenter: incenter(s),
      inradius: inradius(s),
      halfAngles: halfAngles(s),
      ratios: {
        AB_AC: lens.b ? lens.c / lens.b : null,
        BD_DC: feet.D && distance(feet.D, s.C) ? distance(s.B, feet.D) / distance(feet.D, s.C) : null,
        CE_EA: feet.E && distance(feet.E, s.A) ? distance(s.C, feet.E) / distance(feet.E, s.A) : null,
        AF_FB: feet.F && distance(feet.F, s.B) ? distance(s.A, feet.F) / distance(feet.F, s.B) : null,
      },
    };
  }

  /** Each claim on the applet's page, checked numerically at this triangle. */
  function claims(s) {
    const m = measurements(s);
    if (m.degenerate) {
      return {
        anglesSplit: false, bisectorRatio: false, feetOnSides: false,
        concurrent: false, equidistant: false, inradiusFormula: false, ceva: false,
      };
    }
    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-7 * scale;
    const I = m.incenter;
    const onLine = (p, x, y) => distToLine(p, x, y) <= tol;
    const between = (p, x, y) =>
      Math.abs(distance(x, p) + distance(p, y) - distance(x, y)) <= tol;
    const { D, E, F } = m.feet;
    const dA1 = angleAt(s.A, s.B, D), dA2 = angleAt(s.A, D, s.C);
    const dB1 = angleAt(s.B, s.A, E), dB2 = angleAt(s.B, E, s.C);
    const dC1 = angleAt(s.C, s.A, F), dC2 = angleAt(s.C, F, s.B);
    const r = m.inradius;
    return {
      anglesSplit:
        Math.abs(dA1 - dA2) < 1e-6 && Math.abs(dB1 - dB2) < 1e-6 && Math.abs(dC1 - dC2) < 1e-6,
      bisectorRatio:
        Math.abs(m.ratios.AB_AC - m.ratios.BD_DC) < 1e-8 &&
        Math.abs(lensRatio(m.sides.a, m.sides.c) - m.ratios.CE_EA) < 1e-8 &&
        Math.abs(lensRatio(m.sides.b, m.sides.a) - m.ratios.AF_FB) < 1e-8,
      feetOnSides:
        onLine(D, s.B, s.C) && between(D, s.B, s.C) &&
        onLine(E, s.C, s.A) && between(E, s.C, s.A) &&
        onLine(F, s.A, s.B) && between(F, s.A, s.B),
      concurrent:
        onLine(I, s.A, D) && onLine(I, s.B, E) && onLine(I, s.C, F),
      equidistant:
        Math.abs(distToLine(I, s.B, s.C) - r) < tol &&
        Math.abs(distToLine(I, s.C, s.A) - r) < tol &&
        Math.abs(distToLine(I, s.A, s.B) - r) < tol,
      inradiusFormula: Math.abs(distToLine(I, s.A, s.B) * (m.sides.a + m.sides.b + m.sides.c) - m.doubleArea) < tol,
      ceva: Math.abs(ceva(s) - 1) < 1e-8,
    };
  }

  /** A new position with one named point moved; vertices reset the aux points. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    start, sides, doubleArea, isDegenerate, bisectorFoot, incenter, distToLine,
    inradius, angleAt, halfAngles, ceva, measurements, claims,
    projectOnSegment, withPoint, result,
  };
})();
