"use strict";

/*
 * BOL13 — Archimedes' Book of Lemmas, Proposition 13, from Bogomolny's applet.
 *
 * A diameter AB of a circle meets a chord CD (not a diameter) in E. Drop
 * AM and BN perpendicular to the chord; the claim is CN = DM. The applet lets
 * the player drag the centre O, a radius point Bo (so the circle can grow or
 * shrink), and the two ends C and D of the chord, which slide on the circle.
 *
 * The one idea the code relies on: the foot H of the perpendicular from O to
 * CD is the midpoint of the chord, and the auxiliary points are found with the
 * same two primitives the applet uses — GeoSDoub.NearestPoint (a projection
 * onto the line through two points, with a 0.1 squared-distance short circuit)
 * and GeoSDoub.Intersect (two line equations solved by determinants, returning
 * NaN when |det| < 1). Using them literally is what makes the drawing match.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol13Core, so the page loads it with a plain
 * <script> and porting/check-bol-13.mjs loads it in Node. Positions are plain
 * data; functions return new objects and never change what they are given.
 */
const Bol13Core = (() => {
  const VIEW = { x: 0, y: 0, width: 420, height: 300 };
  const RADIUS = 100;
  const START_O = { x: 210, y: 150 };
  const START_C_ANGLE = Math.PI / 3;   // 1.0471975511965976 in the applet
  const START_D_ANGLE = Math.PI / 6;   // 0.5235987755982988 in the applet
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const pointOnCircle = (c, r, angle) => ({
    x: c.x + r * Math.cos(angle),
    y: c.y + r * Math.sin(angle), // screen coordinates: y grows downwards
  });

  /** The position the applet builds in BOL13Canvas.init(). */
  function start(options) {
    const o = options || {};
    if (o.position) {
      const p = o.position;
      return {
        O: { ...p.O }, Bo: { ...p.Bo }, C: { ...p.C }, D: { ...p.D },
        showNames: p.showNames !== false,
        showStatement: Boolean(p.showStatement),
        showHint: Boolean(p.showHint),
      };
    }
    const center = o.center || { ...START_O };
    const radius = o.radius === undefined ? RADIUS : o.radius;
    const cAngle = o.cAngle === undefined ? START_C_ANGLE : o.cAngle;
    const dAngle = o.dAngle === undefined ? START_D_ANGLE : o.dAngle;
    return {
      O: { ...center },
      Bo: { x: center.x - radius, y: center.y },
      C: pointOnCircle(center, radius, cAngle),
      // The applet subtracts r*cos and r*sin for D (angle PI/6).
      D: {
        x: center.x - radius * Math.cos(dAngle),
        y: center.y - radius * Math.sin(dAngle),
      },
      showNames: o.showNames !== false,
      showStatement: Boolean(o.showStatement),
      showHint: Boolean(o.showHint),
    };
  }

  /** GeoSDoub.NearestPoint(p, a, b), transcribed from the applet's bytecode. */
  function nearestPoint(p, a, b) {
    if (sqDist(p, a) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (Math.abs(len2) < EPS) return { x: NaN, y: NaN };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect(p1,p2,p3,p4), transcribed from the applet's bytecode. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  function inside(p) {
    return {
      x: Math.min(VIEW.width - 8, Math.max(8, p.x)),
      y: Math.min(VIEW.height - 8, Math.max(8, p.y)),
    };
  }

  /** Keep C and D on the circle, as the applet's RestrictToCircle does. */
  function clampOnCircle(s, name, p) {
    if (name !== "C" && name !== "D") return inside(p);
    const dx = p.x - s.O.x, dy = p.y - s.O.y;
    const len = Math.hypot(dx, dy);
    const r = distance(s.O, s.Bo);
    if (len < 0.1 || r < 0.1) return { ...s[name] };
    return {
      x: s.O.x + (dx / len) * r,
      y: s.O.y + (dy / len) * r,
    };
  }

  /** BOL13Canvas.AdjustCircle: put C and D back on a circle of the new size. */
  function reproject(s) {
    const r = distance(s.O, s.Bo);
    const place = (p) => {
      const dx = p.x - s.O.x, dy = p.y - s.O.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) return { ...p }; // the applet picks a random angle here
      return { x: s.O.x + (dx / len) * r, y: s.O.y + (dy / len) * r };
    };
    return {
      O: { ...s.O }, Bo: { ...s.Bo }, C: place(s.C), D: place(s.D),
      showNames: s.showNames, showStatement: s.showStatement, showHint: s.showHint,
    };
  }

  /** A new position with one point moved (or one checkbox flipped). */
  function withPoint(s, name, p) {
    const next = {
      O: { ...s.O }, Bo: { ...s.Bo }, C: { ...s.C }, D: { ...s.D },
      showNames: s.showNames, showStatement: s.showStatement, showHint: s.showHint,
    };
    if (name === "showNames" || name === "showStatement" || name === "showHint") {
      next[name] = Boolean(p);
      return next;
    }
    if (!next[name]) return next;
    const q = clampOnCircle(s, name, p);
    if (!finite(q)) return next;
    // A collapsed chord has no direction, so the applet's construction is
    // undefined. Keep the last distinct endpoint instead of its random jump.
    if (name === "C" && distance(q, s.D) < EPS) return next;
    if (name === "D" && distance(q, s.C) < EPS) return next;
    next[name] = q;
    return next;
  }

  /** Everything the page needs to draw the current diagram. */
  function measure(s) {
    const O = s.O, r = distance(O, s.Bo), C = s.C, D = s.D;
    const A = { x: O.x - r, y: O.y };
    const B = { x: O.x + r, y: O.y };
    const H = nearestPoint(O, C, D);
    const active = r > 0.1 && finite(H) && distance(O, H) > 0.1 && distance(C, D) > EPS;
    const m = {
      O, r, A, B, C, D, H,
      E: null, M: null, N: null, K: null,
      active, cn: null, dm: null,
    };
    if (!active) return m;
    m.E = intersect(A, B, C, D);
    m.M = nearestPoint(A, C, D);
    m.N = nearestPoint(B, C, D);
    m.K = intersect(m.M, B, H, O);
    if (!finite(m.E) || !finite(m.M) || !finite(m.N) || !finite(m.K)) return m;
    m.cn = distance(C, m.N);
    m.dm = distance(D, m.M);
    return m;
  }

  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const onLine = (p, a, b, tol) =>
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) <= tol;

  /** The page's four claims, checked numerically at this position. */
  function claims(s, measured) {
    const m = measured || measure(s);
    const bad = {
      chordBisected: false, midpointOfBM: false, midpointOfMN: false,
      perpendiculars: false, eOnBothLines: false, cnEqualsDm: false,
    };
    if (!m.active || !finite(m.E) || !finite(m.M) || !finite(m.N) || !finite(m.K)) return bad;
    const tol = 1e-7 * Math.max(1, m.r);
    const Hmid = midpoint(m.C, m.D);
    const Kmid = midpoint(m.M, m.B);
    const Nmid = midpoint(m.N, m.M);
    const dir = { x: m.D.x - m.C.x, y: m.D.y - m.C.y };
    return {
      chordBisected: distance(m.H, Hmid) <= tol,
      midpointOfBM: distance(m.K, Kmid) <= tol,
      midpointOfMN: distance(m.H, Nmid) <= tol,
      perpendiculars:
        Math.abs(dot({ x: m.M.x - m.A.x, y: m.M.y - m.A.y }, dir)) <= tol * m.r &&
        Math.abs(dot({ x: m.N.x - m.B.x, y: m.N.y - m.B.y }, dir)) <= tol * m.r &&
        Math.abs(dot({ x: m.H.x - m.O.x, y: m.H.y - m.O.y }, dir)) <= tol * m.r,
      // E is the intersection of the two *infinite* lines; it can lie outside
      // the circle, so there is no between-the-endpoints condition here.
      eOnBothLines: onLine(m.E, m.A, m.B, tol) && onLine(m.E, m.C, m.D, tol),
      cnEqualsDm: Math.abs(m.cn - m.dm) <= tol,
    };
  }

  /** An illustration cannot be won or lost. */
  function result() {
    return null;
  }

  return {
    VIEW, nearestPoint, intersect, start, withPoint, reproject, measure, claims,
    result, distance, pointOnCircle, inside,
  };
})();
