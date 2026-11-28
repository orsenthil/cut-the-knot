"use strict";

/*
 * Alexander Bogomolny's HingedPythagoras applet: a hinged dissection behind
 * Proof #9 of the Pythagorean theorem.
 *
 * The applet draws two equal squares of side s = min(width/2, height) - 120.
 * A point M on the bottom side of the left square is dragged with the mouse;
 * writing a = L1.x - M.x and b = s - a, each square is cut into four right
 * triangles with legs a and b. In the left square the four triangles leave a
 * tilted square of side c = sqrt(a² + b²), area c² = s² - 2ab. In the right
 * square two of those triangles are hinged at the top and bottom cut points
 * and swung by an angle set by a scrollbar (0 to 95 whole degrees). At 90°
 * the same four triangles leave a square of side a and a square of side b:
 * their total area is a² + b² = c², so the algebraic step of Proof #4 is
 * unnecessary.
 *
 * Coordinates follow the applet's AWT canvas: y grows downwards. init() uses
 * integer pixel arithmetic, notably M.x = (L0.x + L1.x) / 3 with truncation,
 * so side lengths and angles here are integers just as they are in the applet.
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, HingedPythagorasCore, and takes and returns plain data.
 */
const HingedPythagorasCore = (() => {
  const CANVAS = { width: 640, height: 460, margin: 60 };
  const LIMITS = {
    minAngle: 0,
    maxAngle: 95,
    dragBand: 20,
    // The applet compares the angle in radians with PI/2 - 0.01 before
    // drawing its little alignment line; with whole degrees this is 90..95.
    guideAngle: Math.PI / 2 - 0.01,
    rightAngleDegrees: 90,
  };

  const pt = (x, y) => ({ x, y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const truncDiv = (n, d) => Math.trunc(n / d); // Java's int division

  /** The applet's init(), reduced to the numbers a port needs. */
  function initial(width = CANVAS.width, height = CANVAS.height) {
    const half = truncDiv(width, 2);
    const side = Math.min(half, height) - 2 * CANVAS.margin;
    const dx = truncDiv(half - side, 2);
    const dy = truncDiv(height - side, 2);
    const left = dx, right = dx + side;
    const Mx = truncDiv(left + right, 3); // java.awt.Point coordinates are ints
    return { side, a: right - Mx, angle: 0 };
  }

  /** The two axis-aligned squares, in the order init() builds their corners. */
  function layout(state, width = CANVAS.width, height = CANVAS.height) {
    const side = state.side;
    const half = truncDiv(width, 2);
    const dx = truncDiv(half - side, 2);
    const dy = truncDiv(height - side, 2);
    const L = [pt(dx, dy + side), pt(dx + side, dy + side),
      pt(dx + side, dy), pt(dx, dy)];
    const R = [pt(dx + half, dy + side), pt(dx + half + side, dy + side),
      pt(dx + half + side, dy), pt(dx + half, dy)];
    return { side, dx, dy, L, R, M: pt(L[1].x - state.a, L[0].y) };
  }

  /** The position a new illustration starts from. */
  function start() {
    return initial();
  }

  /** A screen rotation with y downwards, as Graphics2D.rotate(angle) does. */
  function rotate(p, centre, angle) {
    const x = p.x - centre.x, y = p.y - centre.y;
    const c = Math.cos(angle), s = Math.sin(angle);
    return pt(centre.x + x * c - y * s, centre.y + x * s + y * c);
  }

  const radians = (degrees) => degrees * Math.PI / 180;

  /**
   * The four cuts in the left square (DrawLPyth), the two fixed triangles in
   * the right square, the two triangles swung about their hinges
   * (DrawRPyth), and the tilted square left over in the middle.
   */
  function pieces(state, width = CANVAS.width, height = CANVAS.height) {
    const g = layout(state, width, height);
    const { L, R, M, side } = g;
    const a = state.a;

    // Left square, clockwise from the lower-left corner: each triangle has
    // its right angle at a corner of the square.
    const l2 = pt(L[0].x, L[0].y - a);
    const l3 = pt(L[3].x + a, L[3].y);
    const l4 = pt(L[2].x, L[2].y + a);
    const left = [
      [L[0], M, l2],
      [l2, L[3], l3],
      [l3, L[2], l4],
      [l4, L[1], M],
    ];

    // Right square. The swinging triangles are described relative to their
    // hinge, exactly as DrawRPyth's CreatePoly calls do.
    const F = pt(R[0].x + (M.x - L[0].x), R[0].y);
    const U = pt(R[0].x, R[0].y - a);
    const V = pt(R[3].x + a, R[3].y);
    const W = pt(R[2].x, R[2].y + a);
    const angle = radians(state.angle);
    const fixed = [[F, R[0], U], [U, R[3], V]];
    const turned = [
      [V, rotate(R[2], V, angle), rotate(W, V, angle)],
      [F, rotate(R[1], F, -angle), rotate(W, F, -angle)],
    ];
    const tilted = [l2, l3, l4, M];
    return { g, a, b: side - a, M, F, U, V, W, left, fixed, turned, tilted };
  }

  /** Mouse press or drag, as in the applet: only a strip along the bottom. */
  function dragHinge(state, p, width = CANVAS.width, height = CANVAS.height) {
    const { L } = layout(state, width, height);
    if (p.x < L[0].x || p.x > L[1].x ||
        p.y < L[0].y - LIMITS.dragBand || p.y > L[0].y + LIMITS.dragBand) return null;
    return setHinge(state, p.x, width, height);
  }

  /** Keyboard and direct setting: put M at x along the bottom side. */
  function setHinge(state, x, width = CANVAS.width, height = CANVAS.height) {
    const { L } = layout(state, width, height);
    const xm = clamp(Math.round(x), L[0].x, L[1].x);
    return { ...state, a: L[1].x - xm };
  }

  /** The applet's scrollbar: whole degrees from 0 to 95. */
  function setAngle(state, degrees) {
    return { ...state, angle: clamp(Math.round(degrees), LIMITS.minAngle, LIMITS.maxAngle) };
  }

  /** The horizontal line the applet adds once its angle passes ~89.43°. */
  function guide(state, width = CANVAS.width, height = CANVAS.height) {
    if (radians(state.angle) <= LIMITS.guideAngle) return null;
    const { R, L } = layout(state, width, height);
    return {
      x1: Math.max(R[3].x + state.a, R[2].x - state.a),
      x2: R[2].x,
      y: R[0].y - state.a,
      bandLeft: L[0].x,
      bandRight: L[1].x,
    };
  }

  /** Do the four hinged pieces leave the two leg-squares? Only at 90°. */
  function formed(state) {
    return state.angle === LIMITS.rightAngleDegrees;
  }

  /** The two squares of sides b (above) and a (below) left at 90°. */
  function legSquares(state, width = CANVAS.width, height = CANVAS.height) {
    const { R } = layout(state, width, height);
    const a = state.a, b = state.side - a;
    return [
      [pt(R[3].x + a, R[3].y), R[2], pt(R[2].x, R[3].y + b), pt(R[3].x + a, R[3].y + b)],
      [pt(R[3].x + b, R[3].y + b), pt(R[2].x, R[3].y + b), R[1], pt(R[3].x + b, R[1].y)],
    ];
  }

  /** The arithmetic the picture demonstrates; all values are exact ints. */
  function identity(state) {
    const a = state.a, b = state.side - a;
    const a2 = a * a, b2 = b * b;
    return {
      a, b, c: Math.sqrt(a2 + b2), a2, b2, c2: a2 + b2,
      s2: state.side * state.side, triangles2: 2 * a * b,
      holds: a2 + b2 === state.side * state.side - 2 * a * b,
    };
  }

  return {
    CANVAS, LIMITS, pt, clamp, radians, rotate, initial, layout, start,
    pieces, dragHinge, setHinge, setAngle, guide, formed, legSquares, identity,
  };
})();
