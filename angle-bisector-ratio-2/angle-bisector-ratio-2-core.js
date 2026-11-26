"use strict";

/*
 * Angle Bisector Ratio 2 — Alexander Bogomolny's second angle-bisector applet.
 *
 * In triangle ABC the bisector of angle A meets BC at D. The page claims
 *     AB / AC = DB / DC.
 * The applet's proof builds a point E on AD (or its extension) with
 * angle ACB = angle ABE: triangles ACD and ABE are similar, so AB/AC = BE/DC,
 * and the isosceles triangle BDE gives BE = BD. Hence the claim.
 *
 * This port computes D from side lengths as a weighted point and E as the
 * second intersection of line AD with the circle centred at B through D.
 * porting/check-angle-bisector-ratio-2.mjs compares both with a separate,
 * literal transcription of the applet's GeoSDoub methods (rotate a ray by half
 * the angle, intersect two lines) and checks the page's ratio over thousands
 * of triangles.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, AngleBisectorRatio2Core, so the page loads it with a
 * plain <script> and the check script loads it in Node. All functions take
 * plain data and return new objects; nothing passed in is changed.
 */
const AngleBisectorRatio2Core = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const doubleArea = (s) => Math.abs(cross(s.A, s.B, s.C));
  const clone = (p) => ({ x: p.x, y: p.y });
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

  /** Lengths in the applet's notation: c = AB, b = AC, a = BC. */
  function sides(s) {
    return { AB: distance(s.A, s.B), AC: distance(s.A, s.C), BC: distance(s.B, s.C) };
  }

  function isDegenerate(s) {
    const l = sides(s);
    return doubleArea(s) < 1e-7 || Math.min(l.AB, l.AC, l.BC) < EPS;
  }

  /**
   * The starting triangle, from AngleBisectorRatio2Canvas.init for the page's
   * 600x550 applet: A = (w/4 + 100, 3h/5 + 100), B = (3w/4 + 100, 3h/5 + 100),
   * C = (w/2 + (w/8)cos(pi/3)*6/5, 3h/5 - (w/8)sin(pi/3) - 150).
   */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: clone(o.points.A), B: clone(o.points.B), C: clone(o.points.C) };
    }
    const width = o.width === undefined ? 600 : o.width;
    const height = o.height === undefined ? 550 : o.height;
    const cx = width / 2;
    const baseY = (height * 3) / 5;
    const unit = width / 8;
    return {
      A: { x: cx - 2 * unit + 100, y: baseY + 100 },
      B: { x: cx + 2 * unit + 100, y: baseY + 100 },
      C: {
        x: cx + unit * Math.cos(Math.PI / 3) * (6 / 5),
        y: baseY - unit * Math.sin(Math.PI / 3) - 150,
      },
    };
  }

  /**
   * The foot D on BC. BD/DC = AB/AC, so D divides BC with weights AC for B
   * and AB for C: D = (AC*B + AB*C)/(AB + AC).
   */
  function bisectorFoot(s) {
    if (isDegenerate(s)) return null;
    const { AB, AC } = sides(s);
    const sum = AB + AC;
    return {
      x: (AC * s.B.x + AB * s.C.x) / sum,
      y: (AC * s.B.y + AB * s.C.y) / sum,
    };
  }

  /**
   * The point E of the proof: BD = BE and A, D, E are collinear. D is already
   * one intersection of line AD with the circle about B of radius BD; E is
   * the other one.
   */
  function secondPoint(s, D) {
    if (!D || isDegenerate(s)) return null;
    const ux = D.x - s.A.x, uy = D.y - s.A.y;
    const fx = s.A.x - s.B.x, fy = s.A.y - s.B.y;
    const radius = distance(s.B, D);
    const qa = ux * ux + uy * uy;
    const qb = 2 * (fx * ux + fy * uy);
    const qc = fx * fx + fy * fy - radius * radius;
    const disc = qb * qb - 4 * qa * qc;
    if (qa < EPS || disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-qb + root) / (2 * qa);
    const t2 = (-qb - root) / (2 * qa);
    // D itself is the root nearest t = 1; the other root is E.
    const t = Math.abs(t1 - 1) < Math.abs(t2 - 1) ? t2 : t1;
    return { x: s.A.x + ux * t, y: s.A.y + uy * t };
  }

  /** The angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y };
    const b = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (norm < EPS) return 0;
    const cos = (a.x * b.x + a.y * b.y) / norm;
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** Where the external bisector at A cuts line BC (the first applet's note). */
  function externalFoot(s) {
    if (isDegenerate(s)) return null;
    const { AB, AC } = sides(s);
    if (Math.abs(AB - AC) < EPS) return null; // parallel to BC
    return {
      x: (AB * s.C.x - AC * s.B.x) / (AB - AC),
      y: (AB * s.C.y - AC * s.B.y) / (AB - AC),
    };
  }

  /** Apply the page's ratio at all three corners: the Ceva product is 1. */
  function ceva(s) {
    if (isDegenerate(s)) return null;
    const { AB, AC, BC } = sides(s);
    const footA = bisectorFoot(s);
    const footB = { x: (AB * s.C.x + BC * s.A.x) / (AB + BC), y: (AB * s.C.y + BC * s.A.y) / (AB + BC) };
    const footC = { x: (AC * s.B.x + BC * s.A.x) / (AC + BC), y: (AC * s.B.y + BC * s.A.y) / (AC + BC) };
    return (
      (distance(s.B, footA) / distance(footA, s.C)) *
      (distance(s.C, footB) / distance(footB, s.A)) *
      (distance(s.A, footC) / distance(footC, s.B))
    );
  }

  /** Everything the page draws and says about a triangle. */
  function measurements(s) {
    const l = sides(s);
    const D = bisectorFoot(s);
    const E = secondPoint(s, D);
    const ratios = {
      AB_AC: l.AC > EPS ? l.AB / l.AC : null,
      DB_DC: D && distance(D, s.C) > EPS ? distance(s.B, D) / distance(D, s.C) : null,
      BE_DC: E && distance(D, s.C) > EPS ? distance(s.B, E) / distance(D, s.C) : null,
      BE_BD: E && distance(s.B, D) > EPS ? distance(s.B, E) / distance(s.B, D) : null,
    };
    return {
      A: s.A, B: s.B, C: s.C, D, E,
      sides: l,
      ratios,
      angles: {
        ACB: angleAt(s.C, s.A, s.B),
        ABE: E ? angleAt(s.B, s.A, E) : null,
        BAD: D ? angleAt(s.A, s.B, D) : null,
        DAC: D ? angleAt(s.A, D, s.C) : null,
      },
      degenerate: isDegenerate(s),
      doubleArea: doubleArea(s),
    };
  }

  /** Each claim on the two pages, checked numerically for one triangle. */
  function claims(s) {
    const m = measurements(s);
    if (m.degenerate || !m.D || !m.E) {
      return {
        anglesHalved: false, footOnBC: false, EOnAD: false,
        pageRatio: false, similarity: false, isosceles: false,
        equalAngles: false, ceva: false, externalRatio: false,
      };
    }
    const scale = Math.max(m.sides.AB, m.sides.AC, m.sides.BC);
    const tol = 1e-7 * scale;
    const onLine = (p, x, y) => Math.abs(cross(x, y, p)) <= tol;
    const between = (p, x, y) =>
      distance(x, p) + distance(p, y) - distance(x, y) <= tol;
    const external = externalFoot(s);
    return {
      anglesHalved: Math.abs(m.angles.BAD - m.angles.DAC) < 1e-8,
      footOnBC: onLine(m.D, s.B, s.C) && between(m.D, s.B, s.C),
      EOnAD: onLine(m.E, s.A, m.D),
      pageRatio: Math.abs(m.ratios.AB_AC - m.ratios.DB_DC) < 1e-8,
      similarity: Math.abs(m.ratios.AB_AC - m.ratios.BE_DC) < 1e-8,
      isosceles: Math.abs(m.ratios.BE_BD - 1) < 1e-8,
      // A tolerance in radians: when AB = AC the circle is tangent to AD and
      // E coincides with D, so the angle comes from an ill-conditioned point.
      equalAngles: Math.abs(m.angles.ACB - m.angles.ABE) < 1e-6,
      ceva: Math.abs(ceva(s) - 1) < 1e-8,
      // With AB = AC the external bisector is parallel to BC: no foot to test.
      externalRatio: !external ||
        Math.abs(m.ratios.AB_AC - distance(s.B, external) / distance(external, s.C)) < 1e-8,
    };
  }

  /** A new position with one named corner moved; nothing here mutates s. */
  function withPoint(s, name, p) {
    const next = { A: clone(s.A), B: clone(s.B), C: clone(s.C) };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** An illustration: there is no win, loss or losing state. */
  function result(/* state */) {
    return null;
  }

  return {
    start, sides, doubleArea, isDegenerate, bisectorFoot, secondPoint,
    angleAt, externalFoot, ceva, measurements, claims, withPoint, result,
    distance, cross, lerp,
  };
})();
