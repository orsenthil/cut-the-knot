"use strict";

/*
 * Equal Angles In Two Circles — the geometry in Bogomolny's Java applet
 * EqualAnglesInTwoCircles (Curriculum/Geometry/EqualAnglesInTwoCircles.shtml).
 *
 * The page claims: two circles cross at S and T; P is a point on one circle
 * inside the other; AB is a chord of the larger circle tangent to the smaller
 * one at P. Then ∠ASP = ∠BTP and ∠ATP = ∠BSP. The proof uses the tangent–
 * chord angle ∠PST = ∠BPT and the cyclic quadrilateral ABTS.
 *
 * The applet has four draggable points: S and T (the crossings) and two
 * handles, RB and RS, each of which defines a circle through S and T. The
 * larger-radius circle is the outer one; the other handle becomes P, and the
 * chord is the tangent to the inner circle at P. Compute() is transcribed
 * below in bytecode order, including its FindOrientation test for naming A
 * and B and its tangent replacement for the line ST when S and T nearly
 * coincide. GetCircle() averages three distances for its radius; the tangent
 * and line–circle intersection helpers are GeoSDoub's own arithmetic.
 *
 * This file is DOM-free. It defines one global, EqualAnglesInTwoCirclesCore,
 * so the page loads it with a plain <script> and
 * porting/check-equal-angles-in-two-circles.mjs loads it in Node. The
 * position is plain data and every function returns a new object. There is
 * no win or loss: the applet is an illustration.
 */
const EqualAnglesInTwoCirclesCore = (() => {
  const VIEW = Object.freeze({ width: 400, height: 400 }); // the page's <APPLET> size
  const MARGIN = 12; // keeps a whole handle visible on a phone-sized board

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q)); // GeoSDoub.Dist
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

  /** GeoSDoub.FindOrientation(A,B,C): +1 left of AB, -1 otherwise. */
  function findOrientation(A, B, C) {
    const value = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
    return dcmpl(value, 0) > 0 ? 1 : -1;
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
   * DoubCircle.Tangent(P): the other end of a tangent segment starting at P.
   * When P is not on the circle (within one unit) Java returns null; the
   * applet then builds a DoubLine with a null end, so there is no drawing.
   */
  function tangent(c, p) {
    if (dcmpl(Math.abs(dist(c, p) - c.r), 1) > 0) return null;
    return { x: p.x + (c.y - p.y), y: p.y - (c.x - p.x) };
  }

  /*
   * GeoSDoub.Intersect(DoubLine,DoubCircle), via IntersectX when the line is
   * steep and IntersectY otherwise. The root with +sqrt is element 0, which
   * matters because Compute() uses it in its FindOrientation comparison.
   * A line with both coordinate changes at most 1, or one that misses the
   * circle, has no two points: return null instead of inventing any.
   */
  function lineCircle(P, Q, c) {
    const dy = P.y - Q.y, dx = P.x - Q.x;
    let k, b, A, B, C, alongX;
    if (Math.abs(dy) > 1) {
      k = dx / dy;
      b = Q.x - k * Q.y;
      A = k * k + 1;
      B = k * (b - c.x) - c.y;
      C = (b - c.x) ** 2 + c.y * c.y - c.r * c.r;
      alongX = true;
    } else if (Math.abs(dx) > 1) {
      k = dy / dx;
      b = Q.y - k * Q.x;
      A = k * k + 1;
      B = k * (b - c.y) - c.x;
      C = (b - c.y) ** 2 + c.x * c.x - c.r * c.r;
      alongX = false;
    } else {
      return null;
    }
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-B + root) / A, t2 = (-B - root) / A;
    return alongX
      ? [{ x: k * t1 + b, y: t1 }, { x: k * t2 + b, y: t2 }]
      : [{ x: t1, y: k * t1 + b }, { x: t2, y: k * t2 + b }];
  }

  /** GeoSDoub.ComputeAngle: the unsigned angle at V between VP and VQ. */
  function angle(V, P, Q) {
    // Keep the bytecode's division order: it decides whether acos sees a
    // value just outside [-1,1] on nearly collinear points.
    const numerator = sqDist(V, P) + sqDist(V, Q) - sqDist(P, Q);
    return Math.acos(numerator / 2 / dist(V, P) / dist(V, Q));
  }

  /** The position the applet's init() starts with, plus unchecked option boxes. */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? VIEW.width : o.width;
    const h = o.height === undefined ? VIEW.height : o.height;
    return {
      S: { x: Math.floor(w / 2) - w / 4, y: Math.floor(h * 4 / 5) },
      T: { x: Math.floor(w / 2) + w / 4, y: Math.floor(h * 4 / 5) },
      RB: { x: Math.floor(w / 3), y: Math.floor(h / 2) },
      RS: { x: w / 1.8, y: Math.floor(h / 2) },
      // The page embeds the applet twice; its second copy sets ShowNames=1.
      names: o.names === undefined ? true : Boolean(o.names),
      statement: o.statement === undefined ? false : Boolean(o.statement),
      hint: o.hint === undefined ? false : Boolean(o.hint),
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
    if (!["names", "statement", "hint", "extra"].includes(name)) return state;
    return { ...state, [name]: Boolean(value) };
  }

  /*
   * Compute(), transcribed in bytecode order:
   *   circles through (T,S,RB) and (T,S,RS), larger radius first;
   *   ST is S→T, or the tangent at T when S and T are within one unit;
   *   the chord is the tangent to the small circle at P (=RS);
   *   its two crossings of the big circle are named A/B by FindOrientation.
   * When S and T come within one unit the applet replaces the line ST by the
   * tangent at T; there is no early return, unlike its crossed-circles
   * sibling. A null tangent (the handle is off its circle) leaves no picture.
   */
  function compute(state) {
    const viaRB = circleFrom3(state.T, state.S, state.RB);
    const viaRS = circleFrom3(state.T, state.S, state.RS);
    const bigger = dcmpl(viaRB.r, viaRS.r) > 0;
    const bigCircle = bigger ? viaRB : viaRS;
    const smallCircle = bigger ? viaRS : viaRB;
    const RB = bigger ? copy(state.RB) : copy(state.RS);
    const RS = bigger ? copy(state.RS) : copy(state.RB);
    const close = dcmpg(dist(state.S, state.T), 1) < 0;
    const stEnd = close ? tangent(bigCircle, state.T) : null;
    const st = close
      ? (stEnd ? { p1: copy(state.T), p2: stEnd } : null)
      : { p1: copy(state.S), p2: copy(state.T) };
    const chordEnd = tangent(smallCircle, RS);
    const chord = chordEnd ? { p1: copy(RS), p2: chordEnd } : null;
    const outer = chord ? lineCircle(RS, chordEnd, bigCircle) : null;
    const d = {
      stale: false, valid: Boolean(outer && st), S: copy(state.S), T: copy(state.T),
      viaRB, viaRS, bigCircle, smallCircle, RB, RS, st, chord, close,
      A: null, B: null, P: copy(RS),
    };
    if (!d.valid) return d;
    const ref = findOrientation(RS, state.S, state.T);
    const first = findOrientation(outer[0], state.S, RS);
    d.A = first === ref ? copy(outer[0]) : copy(outer[1]);
    d.B = first === ref ? copy(outer[1]) : copy(outer[0]);
    d.angleASP = angle(state.S, d.A, RS);
    d.angleBTP = angle(state.T, d.B, RS);
    d.angleATP = angle(state.T, d.A, RS);
    d.angleBSP = angle(state.S, d.B, RS);
    // The proof's helper angles, as lettered by the applet's Hint checkbox.
    d.anglePST = angle(state.S, RS, state.T);
    d.anglePBT = angle(d.B, RS, state.T);
    d.angleBPT = angle(RS, d.B, state.T);
    d.angleSTP = angle(state.T, state.S, RS);
    d.angleSPA = angle(RS, state.S, d.A);
    d.angleABT = angle(d.B, d.A, state.T);
    d.angleABS = angle(d.A, d.B, state.S);
    return d;
  }

  /** True when every point and circle the drawing needs is finite. */
  function drawn(d) {
    return Boolean(d) && d.valid &&
      [d.S, d.T, d.A, d.B, d.P, d.RB, d.RS].every(finitePt) &&
      finiteCircle(d.bigCircle) && finiteCircle(d.smallCircle);
  }

  /** The page's picture: P is on the inner circle and inside the outer one. */
  function pictured(d) {
    return drawn(d) &&
      dcmpl(dist(d.bigCircle, d.P), d.bigCircle.r) < 0 &&
      Math.abs(dist(d.smallCircle, d.P) - d.smallCircle.r) < 1e-6 &&
      dist(d.A, d.B) > 0.01 && dist(d.S, d.T) > 1 &&
      Number.isFinite(d.angleASP) && Number.isFinite(d.angleBTP) &&
      Number.isFinite(d.angleATP) && Number.isFinite(d.angleBSP);
  }

  /** The page's two equalities; Infinity on a bad picture. */
  function angleGap(d) {
    if (!drawn(d)) return Infinity;
    const gaps = [Math.abs(d.angleASP - d.angleBTP), Math.abs(d.angleATP - d.angleBSP)];
    return gaps.some((g) => !Number.isFinite(g)) ? Infinity : Math.max(...gaps);
  }

  return {
    VIEW, MARGIN, copy, dist, sqDist, clamp, dcmpg, dcmpl, findOrientation,
    intersectLines, circleFrom3, tangent, lineCircle, angle,
    start, inside, withPoint, withToggle, compute, drawn, pictured, angleGap,
    finitePt, finiteCircle,
  };
})();
