"use strict";

/*
 * Four Circle Sangaku, from Alexander Bogomolny's applet FourCircleSangaku.
 *
 * AB is a diameter of a circle and C is a point on it; D is C reflected in AB.
 * One circle is the incircle of triangle ABC, and two more sit on the far side
 * of AB, each touching AB and the large circle. The key identity is that the
 * incircle's radius is the average of the other two radii, and the vertical
 * lines through the two outer centres are tangent to the incircle.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FourCircleSangakuCore, so the page loads it
 * with a plain <script> and porting/check-four-circle-sangaku.mjs loads it in
 * Node. The position is plain data; functions take a position and return a
 * new one, never changing what they were given.
 */
const FourCircleSangakuCore = (() => {
  /** The applet's Reset() puts C at -3*pi/8 on the circumcircle. */
  const START_ANGLE = -1.1780972450961724;
  /** Compute() keeps the old picture when C comes within one unit of A. */
  const TOO_CLOSE = 1;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The applet's GeoSDoub.NearestPoint: the foot of the perpendicular. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) < 0.1) return { x: p.x, y: p.y };
    const len2 = dx * dx + dy * dy;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** CTKMoveableDoub.SetLocation with m_Fixed == 3: radial projection. */
  function projectToCircle(p, center, radius) {
    const d = distance(p, center);
    if (!(d > 0)) {
      return {
        x: center.x + radius * Math.cos(START_ANGLE),
        y: center.y + radius * Math.sin(START_ANGLE),
      };
    }
    return {
      x: center.x + ((p.x - center.x) * radius) / d,
      y: center.y + ((p.y - center.y) * radius) / d,
    };
  }

  const pointAt = (center, radius, angle) => ({
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  });

  /**
   * The incenter by its side-length weights; GetIncircle() then averages the
   * distances from that point to the three sides, which is the inradius.
   */
  function incenter(A, B, Cc) {
    const a = distance(B, Cc), b = distance(Cc, A), c = distance(A, B);
    const sum = a + b + c;
    const center = {
      x: (a * A.x + b * B.x + c * Cc.x) / sum,
      y: (a * A.y + b * B.y + c * Cc.y) / sum,
    };
    const radius = (
      distance(center, nearestPoint(center, A, B)) +
      distance(center, nearestPoint(center, B, Cc)) +
      distance(center, nearestPoint(center, Cc, A))
    ) / 3;
    return { center, radius };
  }

  /**
   * The applet's GetMongrelCircle(side): tangent to AB and internally tangent
   * to the large circle. dx is K.x - O.x and side is +1 or -1.
   */
  function mongrelCircle(side, K, center, radius, C) {
    const dx = K.x - center.x;
    const r = -(radius + side * dx) +
      Math.sqrt(2 * radius * (radius + side * dx));
    // dcmpg in the bytecode: +1 while C is above AB, -1 once C has crossed it.
    const away = C.y < K.y ? 1 : -1;
    return {
      center: { x: K.x + side * r, y: K.y + away * r },
      radius: r,
    };
  }

  /** The position a new diagram starts from, in board units. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 260 : o.height;
    // Java's integer division for the canvas centre and radius.
    const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
    const radius = Math.min(Math.floor(width / 3), Math.floor(height / 3));
    const angle = o.angle === undefined ? START_ANGLE : o.angle;
    return {
      width, height, center, radius, angle,
      C: pointAt(center, radius, angle),
      showNames: !!o.showNames,
      showHint: !!o.showHint,
    };
  }

  /** Back to the applet's opening angle, keeping the board and the options. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames, showHint: state.showHint,
    });
  }

  /** Drag C: project the pointer onto the circumcircle as the applet does. */
  function moveC(state, p) {
    const C = projectToCircle(p, state.center, state.radius);
    return { ...state, C, angle: Math.atan2(C.y - state.center.y, C.x - state.center.x) };
  }

  /** Turn C by an angle in radians, for keyboard play without a pointer. */
  function turn(state, delta) {
    return start({
      width: state.width, height: state.height,
      angle: state.angle + delta,
      showNames: state.showNames, showHint: state.showHint,
    });
  }

  /**
   * One recomputation of the diagram. Returns null in the applet's one special
   * case (C within one unit of A), where Compute() leaves the picture alone.
   */
  function compute(state) {
    const { center, radius: R, C } = state;
    const A = { x: center.x - R, y: center.y };
    const B = { x: center.x + R, y: center.y };
    if (distance(A, C) <= TOO_CLOSE) return null;

    const K = nearestPoint(C, A, B);
    const D = { x: 2 * K.x - C.x, y: 2 * K.y - C.y };
    const upper = incenter(A, B, C);
    const right = mongrelCircle(1, K, center, R, C);
    const left = mongrelCircle(-1, K, center, R, C);

    const uPoint = { x: upper.center.x - upper.radius, y: upper.center.y };
    const vPoint = { x: upper.center.x + upper.radius, y: upper.center.y };
    const wPoint = { x: upper.center.x, y: A.y };
    const sPoint = { x: left.center.x, y: A.y };
    const tPoint = { x: right.center.x, y: A.y };

    return {
      A, B, C, K, D, O: center,
      circle: { center, radius: R },
      upper, right, left,
      uPoint, vPoint, wPoint, sPoint, tPoint,
      r: upper.radius, rR: right.radius, rL: left.radius,
      d: K.x - center.x,
    };
  }

  /** Plain board-unit data for the player's record and the tutor. */
  function position(state) {
    return {
      C: { x: state.C.x, y: state.C.y },
      angle: state.angle,
      radius: state.radius,
      showNames: state.showNames,
      showHint: state.showHint,
    };
  }

  return {
    START_ANGLE, TOO_CLOSE,
    start, reset, moveC, turn, compute, position,
    distance, nearestPoint, projectToCircle, incenter, mongrelCircle, pointAt,
  };
})();
