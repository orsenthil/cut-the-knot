"use strict";

/*
 * Cross Circle — the geometry in Alexander Bogomolny's Java applet CrossCircle,
 * from "A Circle Crosses A Triangle" (Curriculum/Geometry/CrossCircle.shtml).
 *
 * Drop perpendiculars from a point P to the three side lines of triangle ABC.
 * The three feet determine a circle. In general that circle meets each side
 * line a second time. The perpendiculars erected there meet at one point: the
 * half-turn image S = 2·centre − P. The reason is that orthogonal projection
 * onto a line is affine, so the projection of S onto a side is the reflection
 * of the projection of P in the projection of the circle's centre, which is
 * exactly the other end of the chord cut out by the circle on that side.
 *
 * Every derived point is computed in the same order as the applet's bytecode:
 * GeoSDoub.FindCircumcenter and GetCircle's averaged radius for the circle,
 * GeoSDoub.NearestPoint (including its sqrt(0.1) snap) for the first feet and
 * the chord midpoints, GetOther's 2·projection − foot for the second points,
 * and Perp's quarter-turn of a side direction for the new perpendiculars.
 *
 * No document, no window, no storage: this file defines one global,
 * CrossCircleCore, whose positions are plain data. It is used by the page and
 * by porting/check-cross-circle.mjs, which compares it with a second literal
 * transcription of those bytecode methods.
 */
const CrossCircleCore = (() => {
  const VIEW = Object.freeze({ width: 400, height: 300 }); // the applet's 4:3 canvas
  const MARGIN = 12; // keeps every handle inside the board at phone width
  // CrossCircleCanvas.init: angles −1.6, −4 and −0.2 about the canvas centre,
  // at radius min(width,height)/4 (Java integer division: 300 / 4 = 75).
  const INIT_ANGLES = [-1.6, -4, -0.2];
  // The applet chooses Math.random()*PI for P on the circumcircle of ABC,
  // 20 units inside it. A fixed angle in that same interval is easier to
  // recognise and to check; "Move P" uses the applet's random rule.
  const START_ANGLE = Math.PI * 0.75;

  const copy = (p) => ({ x: p.x, y: p.y });
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect(P1,P2,P3,P4): lines as ax + by = c; |det| < 1 is NaN. */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y;
    const b1 = P2.x - P1.x;
    const c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y;
    const b2 = P4.x - P3.x;
    const c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.NearestPoint(P,X,Y), with the applet's SqDist(X,P) < 0.1 snap. */
  function nearestPoint(P, X, Y) {
    if (sqDist(X, P) < 0.1) return copy(P);
    const dx = Y.x - X.x;
    const dy = Y.y - X.y;
    const denom = dx * dx + dy * dy;
    if (denom === 0) return copy(X);
    const t = ((P.x - X.x) * dx + (P.y - X.y) * dy) / denom;
    return { x: X.x + dx * t, y: X.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter then CrossCircleCanvas.GetCircle's radius. */
  function circumcircle(F1, F2, F3) {
    const mid12 = midpoint(F1, F2);
    const mid23 = midpoint(F2, F3);
    const d1 = { x: mid12.x + F2.y - F1.y, y: mid12.y - F2.x + F1.x };
    const d2 = { x: mid23.x + F3.y - F2.y, y: mid23.y - F3.x + F2.x };
    const centre = intersect(mid12, d1, mid23, d2);
    const r = (dist(centre, F1) + dist(centre, F2) + dist(centre, F3)) / 3;
    return { x: centre.x, y: centre.y, r };
  }

  /** CrossCircleCanvas.GetOther(U,V,foot,circle). */
  function otherPoint(U, V, foot, circle) {
    const mid = nearestPoint(circle, U, V);
    return { x: 2 * mid.x - foot.x, y: 2 * mid.y - foot.y };
  }

  /** CrossCircleCanvas.Perp(U,V,other): the far end of its perpendicular stub. */
  function perpEnd(U, V, other) {
    return { x: other.x + U.y - V.y, y: other.y - U.x + V.x };
  }

  /** Clamp a dragged handle into the board, keeping its whole hit radius visible. */
  function inside(p, options) {
    const o = options || {};
    const w = o.width === undefined ? VIEW.width : o.width;
    const h = o.height === undefined ? VIEW.height : o.height;
    return {
      x: clamp(p.x, MARGIN, w - MARGIN),
      y: clamp(p.y, MARGIN, h - MARGIN),
    };
  }

  /** The state the illustration opens with (the applet's init, with fixed P). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const cx = width / 2, cy = height / 2;
    const radius = Math.floor(Math.min(width, height) / 4);
    const onCircle = (a) => ({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    const A = onCircle(INIT_ANGLES[0]);
    const B = onCircle(INIT_ANGLES[1]);
    const C = onCircle(INIT_ANGLES[2]);
    const triangleCircle = circumcircle(A, B, C);
    const angle = o.angle === undefined ? START_ANGLE : o.angle;
    const gap = Math.max(1, triangleCircle.r - 20);
    const P = {
      x: triangleCircle.x + gap * Math.cos(angle),
      y: triangleCircle.y + gap * Math.sin(angle),
    };
    return {
      A: copy(A), B: copy(B), C: copy(C), P,
      hint: o.hint === undefined ? false : Boolean(o.hint),
    };
  }

  /** The applet's random placement of P: an angle in [0, PI] on its circle. */
  function randomP(state, random) {
    const next = typeof random === "function" ? random : Math.random;
    const angle = next() * Math.PI;
    const triangleCircle = circumcircle(state.A, state.B, state.C);
    const gap = Math.max(1, triangleCircle.r - 20);
    return {
      ...state,
      P: {
        x: triangleCircle.x + gap * Math.cos(angle),
        y: triangleCircle.y + gap * Math.sin(angle),
      },
    };
  }

  /** A new position with one handle moved; never mutates the old one. */
  function withPoint(state, name, point) {
    if (!["A", "B", "C", "P"].includes(name)) return state;
    return { ...state, [name]: inside(point, state) };
  }

  function withHint(state, value) {
    return { ...state, hint: Boolean(value) };
  }

  /** Everything the page draws, from the four handles. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C, P = state.P;
    const sides = [[B, C], [C, A], [A, B]];
    // The bytecode uses (B,C), (A,C), (B,A) for GetOther and (B,C), (C,A),
    // (A,B) for Perp: the same lines in slightly different orders.
    const otherPairs = [[B, C], [A, C], [B, A]];
    const feet = [
      nearestPoint(P, B, C),
      nearestPoint(P, C, A),
      nearestPoint(P, A, B),
    ];
    const circle = circumcircle(feet[0], feet[1], feet[2]);
    // The midpoint of a chord is the projection of the circle's centre.
    const projections = sides.map(([U, V]) => nearestPoint(circle, U, V));
    const others = feet.map((foot, i) => otherPoint(otherPairs[i][0], otherPairs[i][1], foot, circle));
    const ends = others.map((other, i) => perpEnd(sides[i][0], sides[i][1], other));
    const directions = ends.map((end, i) => ({
      x: end.x - others[i].x,
      y: end.y - others[i].y,
    }));
    const reflected = { x: 2 * circle.x - P.x, y: 2 * circle.y - P.y };
    // The applet draws the three segments from the reflected point; the claim
    // on the page is that the same three lines pass through this one point.
    const meet = intersect(others[0], ends[0], others[1], ends[1]);
    return {
      feet, ones: feet, sides, circle, projections, others, directions, ends,
      reflected, meet,
    };
  }

  /** True when the circle and the concurrence point are both drawn properly. */
  function drawn(d) {
    return finite(d.circle) && Number.isFinite(d.circle.r) &&
      finite(d.reflected) && d.others.every(finite) &&
      d.ends.every(finite) && finite(d.meet);
  }

  /** Largest distance from the claimed meeting point to the three lines. */
  function concurrenceError(d) {
    if (!drawn(d)) return Infinity;
    let worst = 0;
    for (let i = 0; i < 3; i++) {
      const v = d.directions[i];
      const len = Math.hypot(v.x, v.y);
      if (len === 0) return Infinity;
      worst = Math.max(worst, Math.abs(cross(d.others[i],
        { x: d.others[i].x + v.x, y: d.others[i].y + v.y }, d.meet)) / len);
    }
    return worst;
  }

  /** How far the computed meeting point is from the reflected point. */
  function reflectionError(d) {
    return drawn(d) ? dist(d.meet, d.reflected) : Infinity;
  }

  return {
    VIEW, INIT_ANGLES, START_ANGLE,
    start, randomP, withPoint, withHint, inside,
    compute, drawn, concurrenceError, reflectionError,
    intersect, nearestPoint, circumcircle, otherPoint, perpEnd,
    copy, midpoint, dist, sqDist, finite,
  };
})();
