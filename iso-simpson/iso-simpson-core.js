"use strict";

/*
 * Iso Simpson — the geometry behind Alexander Bogomolny's applet IsoSimpson
 * (cut-the-knot.org/Curriculum/Geometry/IsoSimpson.shtml). The live page now
 * embeds a GeoGebra replacement; a 2010 Wayback capture still embeds the Java
 * applet, whose bytecode is transcribed here.
 *
 * Drag the triangle ABC and the point P. The applet reflects the cevians at A
 * and B (the arcs drawn in cyan) to construct Q, the isogonal conjugate of P.
 * Perpendiculars from P and Q meet the three sides in six feet; the page's
 * claim is that all six feet lie on one circle, centred at the midpoint of
 * PQ. When P lies on the circumcircle of ABC the circle opens out into the
 * Simson line: the three feet of P are collinear.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, IsoSimpsonCore, and positions are plain data so the page and the
 * tutor can share them. Functions do not mutate what they are given.
 */
const IsoSimpsonCore = (() => {
  // The applet's getParameterInfo suggests 400 x 250; Canvas.init uses half
  // the width/height as the centre and min(width,height)/3 as its scale.
  const WIDTH = 400;
  const HEIGHT = 250;
  const NAMES = ["A", "B", "C", "P"];
  const OPTION_KEYS = ["showPerps", "showCircle", "showAngles"];
  const START_ANGLES = { A: -1.6, B: -4.0, C: -0.2, P: -3.0 };
  const ON_CIRCLE_TOLERANCE = 2; // DrawArcs: |Dist(P, O) - r| < 2

  /* ---------------------------------------------------- small vector helpers */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: Math.max(8, Math.min(WIDTH - 8, round(p.x))),
    y: Math.max(8, Math.min(HEIGHT - 8, round(p.y))),
  });

  /** GeoSDoub.FindOrientation: +1 when the cross expression is > 0, else -1. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(P,Q,R): the angle at P, signed by orientation. */
  function signedAngle(p, q, r) {
    const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / (2 * dist(p, q) * dist(p, r));
    const a = Math.acos(c); // the applet does not clamp c
    return orientation(p, q, r) === 1 ? a : -a;
  }

  /** GeoSDoub.Rotate(P,Q,angle,orientation): rotate Q about P (sine only flips). */
  function rotate(p, q, angle, orientationValue) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = q.x - p.x, dy = q.y - p.y;
    return {
      x: p.x + c * dx - orientationValue * s * dy,
      y: p.y + orientationValue * s * dx + c * dy,
    };
  }

  /** GeoSDoub.Intersect(P1,P2,P3,P4), including its |det| < 1 NaN guard. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter: two shifted perpendicular bisectors, then intersect. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const u = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
    const v = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
    return lineIntersection(m1, u, m2, v);
  }

  /** GeoSDoub.NearestPoint(P,A,B): the foot on the whole line AB. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return p;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** The applet's circle through three points: mean of the three distances. */
  function pedalCircle(p, q, r) {
    const center = circumcenter(p, q, r);
    if (!finite(center)) return null;
    return { center, radius: (dist(center, p) + dist(center, q) + dist(center, r)) / 3 };
  }

  /**
   * IsoSimpsonCanvas.DrawArcs. DrawMatchingArcs(P,A,B,C) rotates C about A by
   * the signed angle P-A-B and draws the ray A -> rotated(C); the same at B.
   * Their intersection is Q. The third ray at C uses the smaller of the two
   * angles in absolute value; it is drawn but never used to find Q.
   */
  function isogonal(a, b, c, p) {
    const angleA = signedAngle(a, p, b);
    const angleB = signedAngle(b, p, a);
    const rayA = rotate(a, c, angleA, 1);
    const rayB = rotate(b, c, angleB, 1);
    const Q = lineIntersection(a, rayA, b, rayB);
    const first = signedAngle(c, p, b);
    const second = signedAngle(c, p, a);
    const third = Math.abs(first) < Math.abs(second)
      ? rotate(c, a, first, 1) : rotate(c, b, second, 1);
    return { Q, rayA, rayB, rayC: third, angles: { A: angleA, B: angleB, C: first } };
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture and the applet's three unticked checkboxes. */
  function start(options) {
    const o = options || {};
    const cx = WIDTH / 2, cy = HEIGHT / 2;
    const scale = Math.min(WIDTH, HEIGHT) / 3;
    const state = {
      A: { x: cx + scale * Math.cos(START_ANGLES.A), y: cy + scale * Math.sin(START_ANGLES.A) },
      B: { x: cx + scale * Math.cos(START_ANGLES.B), y: cy + scale * Math.sin(START_ANGLES.B) },
      C: { x: cx + scale * Math.cos(START_ANGLES.C), y: cy + scale * Math.sin(START_ANGLES.C) },
      P: { x: cx + scale * Math.cos(START_ANGLES.P), y: cy + scale * Math.sin(START_ANGLES.P) },
      showPerps: false,
      showCircle: false,
      showAngles: false,
      moves: 0,
      explored: false,
    };
    for (const name of NAMES) {
      if (o[name] && finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** Everything the drawing needs at this position, in the applet's order. */
  function compute(state) {
    const { A, B, C, P } = state;
    if (![A, B, C, P].every(finite)) return { degenerate: true };
    if (dist(A, B) < 12 || dist(B, C) < 12 || dist(C, A) < 12) return { degenerate: true };
    if (Math.abs(cross(A, B, C)) < 1e-6) return { degenerate: true };

    const outer = circumcenter(A, B, C);
    const outerRadius = (dist(outer, A) + dist(outer, B) + dist(outer, C)) / 3;
    const onCircumcircle = finite(outer)
      && Math.abs(dist(P, outer) - outerRadius) < ON_CIRCLE_TOLERANCE;

    // DrawPerp computes the feet in the order BC, CA, AB.
    const feetP = { a: nearestPoint(P, B, C), b: nearestPoint(P, C, A), c: nearestPoint(P, A, B) };
    const circleP = pedalCircle(feetP.a, feetP.b, feetP.c);

    const iso = isogonal(A, B, C, P);
    const Q = iso.Q;
    let feetQ = null;
    let circleQ = null;
    if (!onCircumcircle && finite(Q)) {
      feetQ = { a: nearestPoint(Q, B, C), b: nearestPoint(Q, C, A), c: nearestPoint(Q, A, B) };
      circleQ = pedalCircle(feetQ.a, feetQ.b, feetQ.c);
    }

    // The centre predicted by the page: midpoint of PQ. The common radius is
    // measured from there, so it works for P's and Q's feet alike.
    const center = onCircumcircle || !finite(Q) ? null : midpoint(P, Q);
    const radius = center ? dist(center, feetP.a) : null;
    return {
      degenerate: false,
      outer, outerRadius, onCircumcircle,
      Q: onCircumcircle || !finite(Q) ? null : Q,
      feetP, feetQ, circleP, circleQ, center, radius,
      rayA: iso.rayA, rayB: iso.rayB, rayC: iso.rayC,
      // When P is on the circumcircle the applet draws DoubLine(foot1,foot2).
      simson: { a: feetP.a, b: feetP.b },
    };
  }

  /** Biggest error in the page's claim, scaled to the size of the picture. */
  function residuals(state, g) {
    if (g.degenerate || !g.center) return null;
    let pedalError = 0;
    for (const f of [g.feetP.a, g.feetP.b, g.feetP.c,
      g.feetQ.a, g.feetQ.b, g.feetQ.c]) {
      pedalError = Math.max(pedalError, Math.abs(dist(g.center, f) - g.radius));
    }
    const centerError = g.circleP
      ? dist(g.center, g.circleP.center) : Infinity;
    const radiusError = g.circleP
      ? Math.abs(g.radius - g.circleP.radius) : Infinity;
    return { pedalError, centerError, radiusError };
  }

  /** The moves a player can make: drag one of four points, tick a box, reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < 12)) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has nothing to win: it counts as played once it has changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, NAMES, OPTION_KEYS, START_ANGLES, ON_CIRCLE_TOLERANCE,
    add, sub, dist, sqDist, dot, cross, midpoint, finite, clampPoint,
    orientation, signedAngle, rotate, lineIntersection, circumcenter,
    nearestPoint, pedalCircle, isogonal,
    start, compute, residuals, legalMoves, move, result,
  };
})();
