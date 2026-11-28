"use strict";

/*
 * Alexander Bogomolny's HingedPythagoras3 applet, "Pythagorean Theorem By
 * Hinged Dissection I" — the dynamic version of Proof #2 on cut-the-knot.
 *
 * The canvas (640x460 in the applet) holds two copies of a staircase made from
 * a square of side b next to a square of side a. A point M on the bottom edge
 * of the left copy sets a = M.x - L0.x and b = L1.x - M.x. Each copy has two
 * right triangles with legs a and b: on the left they are drawn inside the
 * two squares; on the right they are hinged at the upper cut corners and
 * swung by the slider's angle (one clockwise, one counterclockwise). At a
 * quarter turn the fixed cut lines and the free edges of the swung triangles
 * are the four sides of a tilted square of side c = sqrt(a² + b²). Nothing
 * stretches, so the two squares' area a² + b² equals c².
 *
 * All coordinates follow the applet's own bytecode: point fields are Java
 * ints, integer division truncates, y grows downwards, and Graphics2D.rotate
 * turns by +angle clockwise on screen. The scrollbar is declared 0..95 with
 * a visible amount of 5, so Java clamps its value at 90; this core keeps that
 * effective range. This file is only the logic: no document, no window, no
 * storage. It defines one global, HingedPythagoras3Core, and takes and returns
 * plain data, so the page and the Node test can both use it.
 */
const HingedPythagoras3Core = (() => {
  const APPLET = {
    width: 640,
    height: 460,
    inset: 60,        // init(): side = min(width/2, height) - 2*inset
    shiftDivisor: 5,  // init(): D = 2*width/5, the gap between the copies
    dragBand: 20,     // mousePressed/mouseDragged accept y within 20 of L0.y
  };
  const LIMITS = {
    declaredMin: 0,
    declaredMax: 95,   // Scrollbar(0, 0, 5, 0, 95)
    visibleAmount: 5,  // Java caps the value at max - visibleAmount = 90
    minAngle: 0,
    maxAngle: 90,
    rightAngle: 90,
  };

  const pt = (x, y) => ({ x, y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const truncDiv = (n, d) => Math.trunc(n / d); // Java's int division
  const radians = (degrees) => (degrees * Math.PI) / 180;

  /** Graphics2D.rotate(theta) on a screen where y grows downwards. */
  function rotate(p, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return pt(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  /** The geometry of init(), including the applet's starting hinge. */
  function initial(width = APPLET.width, height = APPLET.height) {
    const half = truncDiv(width, 2);
    const side = Math.min(half, height) - 2 * APPLET.inset;
    const dx = truncDiv(half - side, 2);
    const dy = truncDiv(height - side, 2);
    const shift = truncDiv(2 * width, APPLET.shiftDivisor);
    const left = dx, right = dx + side;
    const mx = truncDiv(left + right, 3); // M = (L0 + L1) / 3, int division
    return { side, dx, dy, shift, mx, a: mx - left, b: right - mx };
  }

  /** The position a new illustration starts from. */
  function start() {
    return { a: initial().a, angle: 0 };
  }

  /**
   * The six Java Points of each staircase, in the order init()/Compute()
   * build them. L0,L1 are the bottom corners; L5,L4,L3,L2 are recomputed on
   * every paint from the current hinge. R is L translated by D in x.
   */
  function layout(state, width = APPLET.width, height = APPLET.height) {
    const init = initial(width, height);
    const side = init.side, dx = init.dx, dy = init.dy;
    const a = clamp(Math.round(state.a), 0, side);
    const b = side - a;
    const base = dy + side;
    const L = [
      pt(dx, base),
      pt(dx + side, base),
      pt(dx + side, base - a),
      pt(dx + b, base - a),
      pt(dx + b, base - b),
      pt(dx, base - b),
    ];
    const R = L.map((p) => pt(p.x + init.shift, p.y));
    return {
      side, dx, dy, shift: init.shift, a, b, L, R,
      M: pt(L[0].x + a, L[0].y),
    };
  }

  /** The moving point where both right-hand triangles meet when angle = 0. */
  function movingPoint(state, width = APPLET.width, height = APPLET.height) {
    const g = layout(state, width, height);
    return pt(g.R[0].x + g.a, g.R[0].y); // DrawRPyth's local P4
  }

  /** Mouse press or drag, as in the applet: only a band along the bottom. */
  function dragHinge(state, p, width = APPLET.width, height = APPLET.height) {
    const g = layout(state, width, height);
    if (p.x < g.L[0].x || p.x > g.L[1].x ||
        p.y < g.L[0].y - APPLET.dragBand || p.y > g.L[0].y + APPLET.dragBand) return null;
    return setHinge(state, p.x, width, height);
  }

  /** Keyboard and direct setting: put M at x on the bottom edge. */
  function setHinge(state, x, width = APPLET.width, height = APPLET.height) {
    const g = layout(state, width, height);
    return { ...state, a: clamp(Math.round(x), g.L[0].x, g.L[1].x) - g.L[0].x };
  }

  /** The scrollbar: whole degrees from 0 to 90 (declared maximum 95). */
  function setAngle(state, degrees) {
    return {
      ...state,
      angle: clamp(Math.round(degrees), LIMITS.minAngle, LIMITS.maxAngle),
    };
  }

  /**
   * Everything the page draws: the two staircases, the two triangles on the
   * left, the two hinged triangles on the right, their hinge dots, the fixed
   * cut lines and the tilted square that appears at a quarter turn.
   */
  function pieces(state, width = APPLET.width, height = APPLET.height) {
    const g = layout(state, width, height);
    const { L, R, a, b, M } = g;
    const MR = pt(R[0].x + a, R[0].y); // P4, the M of the right copy
    const hingeLow = R[5];             // upper-left corner of the b-square
    const hingeHigh = R[2];            // upper-right corner of the a-square
    const theta = radians(state.angle);

    // DrawLPyth: the two congruent triangles inside the left staircase.
    const leftTriangles = [
      [L[0], M, L[5]],
      [L[2], L[1], M],
    ];
    const dashed = [pt(L[3].x, L[3].y), pt(L[3].x, L[0].y)];

    // DrawRPyth: polygons are built relative to their hinge, then the canvas
    // is translated there and rotated by -Angle (low hinge) or +Angle (high).
    const swingLow = [
      [0, 0], [0, b], [a, b],
    ].map(([x, y]) => {
      const q = rotate(pt(x, y), -theta);
      return pt(hingeLow.x + q.x, hingeLow.y + q.y);
    });
    const swingHigh = [
      [0, 0], [-b, a], [0, a],
    ].map(([x, y]) => {
      const q = rotate(pt(x, y), theta);
      return pt(hingeHigh.x + q.x, hingeHigh.y + q.y);
    });

    // The fixed lines the applet draws between the hinges and P4, plus the
    // staircase R5-R4-R3-R2. At 90° the first two and the free triangle edges
    // are the four sides of the tilted square.
    const spans = [
      [hingeLow, MR], [MR, hingeHigh],
      [R[5], R[4]], [R[4], R[3]], [R[3], R[2]],
    ];
    const apex = pt(R[0].x + b, g.dy); // both free corners meet here at 90°
    const cSquare = [hingeLow, apex, hingeHigh, MR];
    return {
      g, M, MR, hingeLow, hingeHigh, leftTriangles, dashed,
      rightTriangles: [swingLow, swingHigh], spans, apex, cSquare,
    };
  }

  /** Only a quarter turn shows the other dissection. */
  function formed(state) {
    return state.angle === LIMITS.rightAngle;
  }

  /** The arithmetic the picture demonstrates: all of it is exact integers. */
  function identity(state, width = APPLET.width, height = APPLET.height) {
    const side = initial(width, height).side;
    const a = clamp(Math.round(state.a), 0, side);
    const b = side - a;
    const a2 = a * a, b2 = b * b;
    return {
      a, b, c: Math.sqrt(a2 + b2), a2, b2, c2: a2 + b2,
      side2: side * side, triangles2: 2 * a * b,
      // Proof #4's computation of the same two squares: (a+b)² - 2ab.
      holds: a2 + b2 === side * side - 2 * a * b,
    };
  }

  return {
    APPLET, LIMITS, pt, clamp, truncDiv, radians, rotate, initial, start,
    layout, movingPoint, dragHinge, setHinge, setAngle, pieces, formed, identity,
  };
})();
