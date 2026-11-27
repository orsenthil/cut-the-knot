"use strict";

/*
 * Equal Angles In Crossed Circles — the geometry in Bogomolny's Java applet
 * EqualAnglesInCrossedCircles (Curriculum/Geometry/EqualAnglesInCrossedCircles.shtml).
 *
 * Two circles share the points S and T. A straight chord through one circle
 * meets the other in two more points: A, B on the large circle and P, Q on
 * the small one, in that order along the line. The page claims the two angle
 * pairs are equal: ∠ASP = ∠BTQ and ∠ATP = ∠BSQ. The proof uses the inscribed
 * angles in the quadrilaterals ASTB and PSTQ.
 *
 * Four handles are draggable: S, T and the two points RB, RS that choose the
 * circles. Each circle is the circumcircle of S, T and one of those handles,
 * with the applet's averaged radius. The chord is the line RS→RB, cut by
 * GeoSDoub.Intersect(DoubLine, DoubCircle) in each circle; intersections are
 * put in left-to-right order, exactly as Compute() does.
 *
 * This file is DOM-free. It defines one global, EqualAnglesInCrossedCirclesCore,
 * and works on plain data so the page and porting/check-equal-angles-in-crossed-circles.mjs
 * can share it. There is no win or loss: the applet is an illustration.
 */
const EqualAnglesInCrossedCirclesCore = (() => {
  const VIEW = Object.freeze({ width: 400, height: 400 }); // the page's <APPLET> size
  const MARGIN = 12; // keeps a whole handle visible on a phone-sized board

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.sqrt(sqDist(p, q)); // GeoSDoub.Dist, not Math.hypot
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finitePt = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const finiteCircle = (c) => Boolean(c) && finitePt(c) && Number.isFinite(c.r);

  /* Java's dcmpg/dcmpl, used for the applet's branching on doubles. */
  function dcmpg(a, b) {
    if (Number.isNaN(a) || Number.isNaN(b) || a > b) return 1;
    return a < b ? -1 : 0;
  }
  function dcmpl(a, b) {
    if (Number.isNaN(a) || Number.isNaN(b)) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /** GeoSDoub.Intersect(P1,P2,P3,P4); |det| < 1 gives NaN, as in the applet. */
  function intersectLines(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x;
    const c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x;
    const c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GetCircle(U,V,W): circumcentre, with its radius averaged over three distances. */
  function circleFrom3(U, V, W) {
    const m12 = { x: (U.x + V.x) / 2, y: (U.y + V.y) / 2 };
    const m23 = { x: (V.x + W.x) / 2, y: (V.y + W.y) / 2 };
    const d1 = { x: m12.x + V.y - U.y, y: m12.y - V.x + U.x };
    const d2 = { x: m23.x + W.y - V.y, y: m23.y - W.x + V.x };
    const centre = intersectLines(m12, d1, m23, d2);
    const r = (dist(centre, U) + dist(centre, V) + dist(centre, W)) / 3;
    return { x: centre.x, y: centre.y, r };
  }

  /*
   * GeoSDoub.Intersect(DoubLine,DoubCircle): solve for y when the line is
   * steep (IntersectX), otherwise for x (IntersectY). A line with both
   * coordinate changes at most 1, or one that misses the circle, has no two
   * points: return null instead of inventing an intersection.
   */
  function lineCircle(P, Q, c) {
    const dy = P.y - Q.y, dx = P.x - Q.x;
    let k, b, A, B, C, alongX;
    if (Math.abs(dy) > 1) {
      k = dx / dy;
      b = Q.x - k * Q.y;
      A = k * k + 1;
      B = 2 * (k * (b - c.x) - c.y);
      C = (b - c.x) ** 2 + c.y * c.y - c.r * c.r;
      alongX = true;
    } else if (Math.abs(dx) > 1) {
      k = dy / dx;
      b = Q.y - k * Q.x;
      A = k * k + 1;
      B = 2 * (k * (b - c.y) - c.x);
      C = (b - c.y) ** 2 + c.x * c.x - c.r * c.r;
      alongX = false;
    } else {
      return null;
    }
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-B + root) / (2 * A), t2 = (-B - root) / (2 * A);
    return alongX
      ? [{ x: k * t1 + b, y: t1 }, { x: k * t2 + b, y: t2 }]
      : [{ x: t1, y: k * t1 + b }, { x: t2, y: k * t2 + b }];
  }

  /** GeoSDoub.ComputeAngle: the unsigned angle at V between VP and VQ. */
  function angle(V, P, Q) {
    // Bytecode: (SqDist(V,P)+SqDist(V,Q)-SqDist(P,Q))/2/Dist(V,P)/Dist(V,Q).
    // Keep that division order: it decides whether acos sees a value just
    // outside [-1,1] on nearly collinear points.
    const numerator = sqDist(V, P) + sqDist(V, Q) - sqDist(P, Q);
    return Math.acos(numerator / 2 / dist(V, P) / dist(V, Q));
  }

  /** GeoSDoub.ComputeSignedAngle, with FindOrientation's screen-space sign. */
  function signedAngle(V, P, Q) {
    const cross = (P.x - V.x) * (Q.y - V.y) - (P.y - V.y) * (Q.x - V.x);
    const magnitude = angle(V, P, Q);
    return Number.isNaN(magnitude) ? NaN : (cross > 0 ? magnitude : -magnitude);
  }

  /** Java's dcmpl ordering, used by Compute() to choose A/B and P/Q. */
  function leftFirst(pair) {
    return dcmpg(pair[0].x, pair[1].x) < 0 ? [pair[0], pair[1]] : [pair[1], pair[0]];
  }

  /** The position the applet's init() starts with, plus unchecked option boxes. */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? VIEW.width : o.width;
    const h = o.height === undefined ? VIEW.height : o.height;
    const cx = w / 2;
    return {
      S: { x: Math.floor(w / 2) - cx / 4, y: Math.floor(h * 4 / 5) },
      T: { x: Math.floor(w / 2) + cx / 4, y: Math.floor(h * 4 / 5) },
      RB: { x: Math.floor(w / 3), y: Math.floor(h / 2) },
      RS: { x: w / 1.8, y: Math.floor(h / 2) },
      // The page embeds the applet twice; its second copy sets ShowNames=1.
      names: o.names === undefined ? true : Boolean(o.names),
      statement: o.statement === undefined ? false : Boolean(o.statement),
      extra: o.extra === undefined ? false : Boolean(o.extra),
    };
  }

  /** Clamp a dragged handle into the board with its whole hit radius visible. */
  function inside(p, options) {
    const o = options || {};
    const w = o.width === undefined ? VIEW.width : o.width;
    const h = o.height === undefined ? VIEW.height : o.height;
    return { x: clamp(p.x, MARGIN, w - MARGIN), y: clamp(p.y, MARGIN, h - MARGIN) };
  }

  function withPoint(state, name, point) {
    if (!["S", "T", "RB", "RS"].includes(name)) return state;
    return { ...state, [name]: inside(point, state) };
  }

  function withToggle(state, name, value) {
    if (!["names", "statement", "extra"].includes(name)) return state;
    return { ...state, [name]: Boolean(value) };
  }

  /*
   * Compute(), transcribed: S is the left of the two top handles, the two
   * circumcircles are compared by radius, and the chord RS→RB is cut twice
   * in each circle. `stale` marks the applet's early return when S and T
   * come within one unit: it leaves the previous picture on the screen.
   */
  function compute(state) {
    if (dist(state.S, state.T) < 1) {
      return { stale: true, valid: false, S: copy(state.S), T: copy(state.T) };
    }
    const S = dcmpg(state.S.x, state.T.x) < 0 ? copy(state.S) : copy(state.T);
    const T = dcmpg(state.S.x, state.T.x) < 0 ? copy(state.T) : copy(state.S);
    const viaRB = circleFrom3(T, S, state.RB);
    const viaRS = circleFrom3(T, S, state.RS);
    const bigger = dcmpg(viaRB.r, viaRS.r) > 0; // applet: dcmpl(rRB,rRS) > 0
    const bigCircle = bigger ? viaRB : viaRS;
    const smallCircle = bigger ? viaRS : viaRB;
    const RB = bigger ? copy(state.RB) : copy(state.RS);
    const RS = bigger ? copy(state.RS) : copy(state.RB);
    const chord = { p1: RS, p2: RB };
    const outer = lineCircle(RS, RB, bigCircle);
    const inner = lineCircle(RS, RB, smallCircle);
    if (!outer || !inner) {
      return { stale: false, valid: false, S, T, viaRB, viaRS, bigCircle, smallCircle,
        RB, RS, chord, A: null, B: null, P: null, Q: null };
    }
    const [A, B] = leftFirst(outer);
    const [P, Q] = leftFirst(inner);
    const d = {
      stale: false, valid: true, S, T, viaRB, viaRS, bigCircle, smallCircle,
      RB, RS, chord, A, B, P, Q,
    };
    d.angleASP = angle(S, A, P);
    d.angleBTQ = angle(T, B, Q);
    d.angleBSQ = angle(S, B, Q);
    d.angleATP = angle(T, P, A);
    d.signedASP = signedAngle(S, A, P);
    d.signedBTQ = signedAngle(T, B, Q);
    d.signedBSQ = signedAngle(S, B, Q);
    d.signedATP = signedAngle(T, P, A);
    return d;
  }

  /** True when every point and circle the drawing needs is finite. */
  function drawn(d) {
    return Boolean(d) && d.valid && !d.stale &&
      [d.S, d.T, d.A, d.B, d.P, d.Q, d.RB, d.RS].every(finitePt) &&
      finiteCircle(d.bigCircle) && finiteCircle(d.smallCircle);
  }

  /** The page's two equalities; 0 when they hold, Infinity on a bad picture. */
  function angleGap(d) {
    if (!drawn(d)) return Infinity;
    const gaps = [Math.abs(d.angleASP - d.angleBTQ), Math.abs(d.angleBSQ - d.angleATP)];
    return gaps.some((g) => !Number.isFinite(g)) ? Infinity : Math.max(...gaps);
  }

  return {
    VIEW, MARGIN, copy, dist, sqDist, clamp, dcmpg, dcmpl,
    intersectLines, circleFrom3, lineCircle, angle, signedAngle, leftFirst,
    start, inside, withPoint, withToggle, compute, drawn, angleGap,
    finitePt, finiteCircle,
  };
})();
