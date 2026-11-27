"use strict";

/*
 * Equilateral Triangles, from Alexander Bogomolny's applet EquilateralTriangles.
 *
 * Three equal equilateral triangles share the centre O of a circle; their
 * other two vertices lie on the circle. Label them A1,B1, A2,B2, A3,B3 with
 * B_i = Rotate(A_i about O by 60 degrees). The applet joins B1 to A2, B2 to A3
 * and B3 to A1 and draws the triangle of their midpoints M1,M2,M3. That
 * triangle is always equilateral. The page's Explanation proves more: the six
 * vertices need not lie on a circle at all, only each pair must form an
 * equilateral triangle with O.
 *
 * Coordinates follow the applet's canvas: x grows right, y grows down, and
 * its 400x300 canvas has centre (200,150) and circle radius min(w,h)/3 = 100.
 * GeoSDoub.Rotate(centre, point, angle, dir) is transcribed literally below,
 * including its dir = 1 (visually clockwise in screen coordinates).
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, EquilateralTrianglesCore, so the page
 * loads it with a plain <script> and porting/check-equilateral-triangles.mjs
 * loads it in Node. Positions are plain data and every function returns new
 * data instead of changing what it was given.
 */
const EquilateralTrianglesCore = (() => {
  // The commented-out APPLET tag on the page gives WIDTH=400, HEIGHT=300;
  // the applet's init() sets centre = (w/2, h/2) and radius = min(w,h)/3.
  const APPLET = {
    width: 400,
    height: 300,
    angle: 1.0471975511965976, // 60 degrees, as written in ComputeTriangle()
    dir: 1,                    // GeoSDoub.Rotate's fourth argument
    twoPi: 6.283185307179586,  // Math.random() * 2π in init()
  };
  const EPS = 1e-10;

  const pt = (x, y) => ({ x, y });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);

  /**
   * GeoSDoub.Rotate(O, P, angle, dir), transcribed from its bytecode:
   *   X = O.x + cos(a)*(P.x-O.x) - dir*sin(a)*(P.y-O.y)
   *   Y = O.y + dir*sin(a)*(P.x-O.x) + cos(a)*(P.y-O.y)
   */
  function rotate(center, p, angle, dir) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return pt(
      center.x + cos * (p.x - center.x) - dir * sin * (p.y - center.y),
      center.y + dir * sin * (p.x - center.x) + cos * (p.y - center.y),
    );
  }

  /** CTKMoveableDoub.UpdateLocation() with RestrictToCircle(): radial projection. */
  function onCircle(center, radius, p) {
    const d = distance(center, p);
    if (d < EPS) return pt(center.x + radius, center.y);
    return pt(
      center.x + ((p.x - center.x) * radius) / d,
      center.y + ((p.y - center.y) * radius) / d,
    );
  }

  /**
   * The position a new illustration starts from. With no options the three
   * angles are random, as in the applet's init(). Tests and the page can pass
   * explicit angles or sizes to get a reproducible picture.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? APPLET.width : o.width;
    const height = o.height === undefined ? APPLET.height : o.height;
    const center = pt(width / 2, height / 2);
    const radius = Math.min(width, height) / 3;
    const restrict = o.restrict === undefined ? true : !!o.restrict;
    const angles = o.angles || [0, 1, 2].map(() => Math.random() * APPLET.twoPi);
    // init() places A_i at O + r*(sin(t), -cos(t)).
    const points = angles.map((t) => pt(
      center.x + radius * Math.sin(t),
      center.y - radius * Math.cos(t),
    ));
    return { width, height, center, radius, restrict, points };
  }

  /** The three handles a player can move: their indices in points. */
  function legalMoves(state) {
    return state.points.map((_, i) => i);
  }

  /** Replace one of A1,A2,A3; the circle restriction is applied like the applet. */
  function withPoint(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.points.length) return state;
    const q = state.restrict ? onCircle(state.center, state.radius, p) : pt(p.x, p.y);
    return {
      ...state,
      points: state.points.map((old, i) => (i === index ? q : pt(old.x, old.y))),
    };
  }

  /** Move one point on the circle by a turn in radians (useful for keyboards). */
  function turn(state, index, delta) {
    const p = state.points[index];
    if (!p) return state;
    return withPoint(state, index, rotate(state.center, p, delta, -APPLET.dir));
  }

  /**
   * Turn the RestrictToCircle parameter on or off. The applet only reads it
   * once at construction; here it is a control, so re-enabling it must put the
   * three points back on the circle.
   */
  function withRestrict(state, on) {
    const flag = !!on;
    return {
      ...state,
      restrict: flag,
      points: flag
        ? state.points.map((p) => onCircle(state.center, state.radius, p))
        : state.points.map((p) => pt(p.x, p.y)),
    };
  }

  /** The object the applet's Draw() builds on every frame. */
  function configuration(state) {
    const A = state.points.map((p) => pt(p.x, p.y));
    // ComputeTriangle(i) = GeoSDoub.Rotate(Circle, m_Points[i], π/3, 1).
    const B = A.map((p) => rotate(state.center, p, APPLET.angle, APPLET.dir));
    // DrawMidPoint(B[0], A[1]), (B[1], A[2]), (B[2], A[0]), joined in that order.
    const M = [
      midpoint(B[0], A[1]),
      midpoint(B[1], A[2]),
      midpoint(B[2], A[0]),
    ];
    return {
      center: pt(state.center.x, state.center.y),
      radius: state.radius,
      A, B, M,
      triangles: A.map((p, i) => [pt(state.center.x, state.center.y), p, B[i]]),
    };
  }

  /** The three side lengths of the midpoint triangle M1M2, M2M3, M3M1. */
  function sides(c) {
    return [
      distance(c.M[0], c.M[1]),
      distance(c.M[1], c.M[2]),
      distance(c.M[2], c.M[0]),
    ];
  }

  /** Equal sides, allowing only floating-point rounding. */
  function equilateral(c, tolerance) {
    const s = sides(c);
    const scale = Math.max(...s, 1);
    return Math.max(...s) - Math.min(...s) <= (tolerance === undefined ? EPS : tolerance) * scale;
  }

  /** Side lengths of each coloured triangle O-A_i-B_i. */
  function triangleSides(c) {
    return c.triangles.map(([o, a, b]) => [
      distance(o, a), distance(a, b), distance(b, o),
    ]);
  }

  /** There is no win or loss: this is an illustration. */
  function result(state) {
    return null;
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!m || !Number.isInteger(m.index) || !m.point ||
        !Number.isFinite(m.point.x) || !Number.isFinite(m.point.y)) return null;
    return withPoint(state, m.index, m.point);
  }

  return {
    APPLET, pt, distance, midpoint, rotate, onCircle,
    start, legalMoves, move, withPoint, turn, withRestrict,
    configuration, sides, equilateral, triangleSides, result,
  };
})();
