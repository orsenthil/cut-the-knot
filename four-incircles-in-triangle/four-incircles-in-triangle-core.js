"use strict";

/*
 * Four Incircles in an Equilateral Triangle, from Bogomolny's applet
 * FourIncirclesInTriangle.
 *
 * ABC is equilateral. A point T slides on the circle through A and B whose
 * centre is one circumradius below the centre of ABC; on the arc between A
 * and B the angle TAB is the angle the three cevians make with the sides.
 * Rotating the rays by that angle builds an equilateral triangle A'B'C'
 * together with its three congruent 120-degree corner triangles. The puzzle
 * asks for the side of A'B'C' when its incircle matches the other three.
 *
 * Every routine here is plain geometry: no document, no window, no storage.
 * The file defines one global, FourIncirclesInTriangleCore, so the page can
 * load it with a plain <script> and porting/check-four-incircles-in-triangle.mjs
 * can load it in Node. Positions are plain data; functions return new values.
 */
const FourIncirclesInTriangleCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  /** The applet picks Math.PI/3 + Math.random()*Math.PI/18; we use its midpoint. */
  const START_ANGLE = (7 * Math.PI) / 18;
  /** CheckFinished in the applet: |r(middle) - r(A)| < 0.5 pixels. */
  const FINISH_TOLERANCE = 0.5;
  /** The valid arc: T below A is where the applet's Compute() bails out. */
  const ARC_START = Math.PI / 6;
  const ARC_END = (5 * Math.PI) / 6;

  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const distance = (p, q) => Math.sqrt(sq(p, q));

  /** GeoSDoub.ComputeAngle: the angle at p in the triangle p, q, r. */
  function angle(p, q, r) {
    const value = (sq(p, q) + sq(p, r) - sq(q, r)) /
      (2 * distance(p, q) * distance(p, r));
    return Math.acos(Math.max(-1, Math.min(1, value)));
  }

  /** GeoSDoub.FindOrientation, in the applet's own (screen y) coordinates. */
  function orientation(a, b, c) {
    return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn the ray p->q by orientation*theta radians. */
  function rotate(p, q, theta, sign) {
    const co = Math.cos(theta), si = Math.sin(theta);
    const dx = q.x - p.x, dy = q.y - p.y;
    return {
      x: p.x + co * dx - sign * si * dy,
      y: p.y + sign * si * dx + co * dy,
    };
  }

  /** GeoSDoub.Intersect of two lines; NaN when they are parallel. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  /** GeoSDoub.NearestPoint: the perpendicular foot on the line a-b. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return { x: p.x, y: p.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindIncenter: the intersection of two interior angle bisectors. */
  function findIncenter(a, b, c) {
    const sign = orientation(a, b, c);
    const rayA = rotate(a, b, angle(a, b, c) / 2, sign);
    const rayB = rotate(b, c, angle(b, c, a) / 2, sign);
    return intersect(a, rayA, b, rayB);
  }

  /** GetIncircle: its centre is the incenter and its radius the mean of the
   * three distances from that centre to the sides. */
  function getIncircle(a, b, c) {
    const I = findIncenter(a, b, c);
    const radius = (
      distance(I, nearestPoint(I, a, b)) +
      distance(I, nearestPoint(I, b, c)) +
      distance(I, nearestPoint(I, c, a))
    ) / 3;
    return { center: I, radius };
  }

  /** The applet's Swivel: rotate q about p by theta, then set its distance
   * from p to length. (Its scale factor is length / |p-q|.) */
  function swivel(p, q, theta, length) {
    const turned = rotate(p, q, theta, -1);
    const t = length / distance(p, q);
    return {
      x: p.x + t * (turned.x - p.x),
      y: p.y + t * (turned.y - p.y),
    };
  }

  /** The applet's Stretch: put q on the same ray at distance length from p. */
  function stretch(p, q, length) {
    const t = length / distance(p, q);
    return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
  }

  /** Points of the sliding circle, parameterised like the applet's T. */
  function gliderPoint(glider, theta) {
    return {
      x: glider.center.x + glider.radius * Math.cos(theta),
      y: glider.center.y - glider.radius * Math.sin(theta),
    };
  }

  /** CTKMoveableDoub with m_Fixed == 3: radial projection onto the circle. */
  function projectToGlider(p, glider) {
    const dx = p.x - glider.center.x, dy = p.y - glider.center.y;
    const d = Math.hypot(dx, dy);
    if (!(d > 0)) return gliderPoint(glider, START_ANGLE);
    return {
      x: glider.center.x + (dx * glider.radius) / d,
      y: glider.center.y + (dy * glider.radius) / d,
    };
  }

  /** The opening diagram, in board units (the applet's 400x250 canvas). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const cx = width / 2;
    const cy = (height * 2) / 3;
    const radius = Math.min(width, height) / 2.5;
    const center = { x: cx, y: cy };
    const glider = { center: { x: cx, y: cy + radius }, radius };
    const A = { x: cx + radius * Math.cos((5 * Math.PI) / 6), y: cy + radius - radius * Math.sin((5 * Math.PI) / 6) };
    const B = { x: cx + radius * Math.cos(Math.PI / 6), y: cy + radius - radius * Math.sin(Math.PI / 6) };
    const C = { x: cx, y: A.y - ((B.x - A.x) * Math.sqrt(3)) / 2 };
    const theta = o.angle === undefined ? START_ANGLE : o.angle;
    const T = o.angle === undefined && o.T ? o.T : gliderPoint(glider, theta);
    return {
      width, height, center, radius, glider, A, B, C,
      angle: theta,
      T,
      showNames: !!o.showNames,
    };
  }

  /** Reset keeps the board and the "Show names" option. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames,
    });
  }

  /** Drag T: a pointer is projected onto the sliding circle. */
  function moveT(state, p) {
    const T = projectToGlider(p, state.glider);
    return {
      ...state, T,
      angle: Math.atan2(state.glider.center.y - T.y, T.x - state.glider.center.x),
    };
  }

  /** Turn T along the sliding circle, for keyboard play without a pointer. */
  function turn(state, delta) {
    return start({
      width: state.width, height: state.height,
      angle: state.angle + delta, showNames: state.showNames,
    });
  }

  /** The applet's GetParaLine: reflect the middle incenter in the cevian p-q,
   * then draw the parallel through that reflected point. */
  function getParaLine(middle, p, q, bounds) {
    const foot = nearestPoint(middle.center, p, q);
    const mirrored = {
      x: 2 * middle.center.x - foot.x,
      y: 2 * middle.center.y - foot.y,
    };
    const line = {
      p: mirrored,
      q: { x: mirrored.x + q.x - p.x, y: mirrored.y + q.y - p.y },
    };
    return line;
  }

  /** The applet's Compute(). Returns null while T is below A, where it
   * returns false and the old picture is left on the canvas. */
  function compute(state) {
    const { A, B, C, T, glider } = state;
    if (A.y < T.y) return null;

    const theta = angle(A, T, B);
    let d = distance(A, T);
    let Ap, Bp, Cp;
    if (d < distance(T, B)) {
      Ap = swivel(B, C, theta, d);
      Bp = swivel(C, A, theta, d);
      Cp = T;
      const K = intersect(A, Ap, B, Bp);
      d = distance(A, K);
      Ap = stretch(A, Ap, d);
      Bp = stretch(B, Bp, d);
      Cp = stretch(C, Cp, d);
    } else {
      Ap = T;
      Bp = swivel(B, C, theta, d);
      Cp = swivel(C, A, theta, d);
    }

    const circleA = getIncircle(A, Ap, B);
    const circleB = getIncircle(B, Bp, C);
    const circleC = getIncircle(C, Cp, A);
    const circleM = getIncircle(Ap, Bp, Cp);
    const finished = Math.abs(circleM.radius - circleA.radius) < FINISH_TOLERANCE;
    const bounds = { x: 0, y: 0, width: state.width, height: state.height };

    return {
      A, B, C, T, Ap, Bp, Cp,
      circleA, circleB, circleC, circleM,
      rA: circleA.radius, rB: circleB.radius, rC: circleC.radius,
      rM: circleM.radius,
      side: distance(Ap, Bp),
      outerSide: distance(A, B),
      theta,
      finished,
      cevians: [{ p: A, q: Ap }, { p: B, q: Bp }, { p: C, q: Cp }],
      parallels: [
        getParaLine(circleM, B, Bp, bounds),
        getParaLine(circleM, C, Cp, bounds),
        getParaLine(circleM, A, Cp, bounds),
      ],
      bounds,
    };
  }

  /** The matching configuration on the left-hand arc, found by bisection.
   * This is a convenience for the illustration, not a button in the applet. */
  function solve(options) {
    const s = start(options);
    const diff = (t) => {
      const g = compute(start({ ...s, angle: t }));
      return g ? g.rM - g.rA : NaN;
    };
    let lo = ARC_START, hi = Math.PI / 2;
    for (let i = 0; i < 70; i++) {
      const mid = (lo + hi) / 2;
      if (diff(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** Plain board-unit data for the player's record and the tutor. */
  function position(state) {
    return {
      T: { x: state.T.x, y: state.T.y },
      angle: state.angle,
      radius: state.radius,
      showNames: state.showNames,
    };
  }

  return {
    WIDTH, HEIGHT, START_ANGLE, FINISH_TOLERANCE, ARC_START, ARC_END,
    start, reset, moveT, turn, compute, solve, position,
    distance, sq, angle, orientation, rotate, intersect, nearestPoint,
    findIncenter, getIncircle, swivel, stretch, gliderPoint, projectToGlider,
  };
})();
