"use strict";

/*
 * Archimedes' angle trisection, from Alexander Bogomolny's applet "archi"
 * (cut-the-knot.org/pythagoras/archi.shtml). The article now shows a GeoGebra
 * remake of the same figure; the rules below come from the Java applet itself.
 *
 * O is the centre of a circle of radius R, A its rightmost point and B a point
 * on the circle, so angle AOB is the angle to trisect. C slides on the line OA
 * to the left of O. D is placed on the ray CB with CD = R (the same length as
 * OB). When D lands on the circle, OD = R too: triangle CDO is isosceles, so
 * angle DCO = angle DOC; triangle OBD is isosceles too, and the exterior-angle
 * theorem then gives angle AOB = 3 * angle DCO. The exact C for a given angle
 * theta is at distance 2R cos(theta / 3) to the left of O.
 *
 * Coordinates are plain data in the applet's 400 x 350 board, y increasing
 * downwards as on the screen. This file is the logic only: no document, no
 * window, no storage. It defines one global, ArchiCore.
 */
const ArchiCore = (() => {
  "use strict";

  const WIDTH = 400;          // applet getParameterInfo: "(400 will do)"
  const HEIGHT = 350;         // applet getParameterInfo: "(350 will do)"
  const O = { x: WIDTH / 2, y: Math.trunc(3 * HEIGHT / 4) }; // (200, 262)
  const R = Math.trunc(HEIGHT / 5);                          // 70
  const HANDLE_R = 4;         // m_R: the two control rings
  const TOL = 0.6;            // FindSecondEnd(): |OD - R| < 0.6
  const START_ANGLE = Math.PI / 6; // m_Angle = 30 degrees
  const START_B = { x: O.x + Math.trunc(Math.cos(START_ANGLE) * R),
                    y: O.y - Math.trunc(Math.sin(START_ANGLE) * R) }; // (260, 227)
  const START_C = { x: O.x - Math.trunc(3 * R / 2), y: O.y };       // (95, 262)

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const deg = (radians) => radians * 180 / Math.PI;

  /** B at a given mathematical angle above the horizontal ray OA. */
  function pointOnCircle(angle) {
    return { x: O.x + R * Math.cos(angle), y: O.y - R * Math.sin(angle) };
  }

  /** The opening picture, or a picture with the two handles placed by options. */
  function start(options) {
    const o = options || {};
    const state = { B: copy(START_B), C: copy(START_C), moves: 0, explored: false };
    if (o.B && Number.isFinite(Number(o.B.x)) && Number.isFinite(Number(o.B.y))) {
      const q = { x: Number(o.B.x), y: Number(o.B.y) };
      const d = dist(O, q);
      if (d >= 0.001) state.B = { x: O.x + R * (q.x - O.x) / d, y: O.y + R * (q.y - O.y) / d };
    }
    if (o.C && Number.isFinite(Number(o.C.x)) && Number.isFinite(Number(o.C.y))) {
      state.C = { x: Math.min(Number(o.C.x), O.x - 1), y: O.y };
    }
    return state;
  }

  /** Examples of every move the player can make from this position. */
  function legalMoves(state) {
    const s = state || start();
    return [
      { type: "B", x: s.B.x, y: s.B.y - 10 },
      { type: "C", x: s.C.x - 10, y: O.y },
      { type: "reset" },
    ];
  }

  /**
   * The position after a move, or null if the applet would not make it.
   * Dragging B projects it back onto the circle (MoveAngleHand); dragging C
   * only changes its x, and only while it stays left of O (MoveMovingPoint).
   */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "B") {
      if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const q = { x: Number(m.x), y: Number(m.y) };
      const d = dist(O, q);
      if (d < 0.001) return null; // the applet ignores a drag onto its centre
      next = { ...state, B: { x: O.x + R * (q.x - O.x) / d, y: O.y + R * (q.y - O.y) / d } };
    } else if (m.type === "C") {
      if (!Number.isFinite(Number(m.x))) return null;
      const x = Number(m.x);
      if (x >= O.x) return null; // MoveMovingPoint() refuses this drag
      next = { ...state, C: { x: x, y: O.y } };
    } else if (m.type === "reset") {
      return start();
    } else {
      return null;
    }
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** The exact solved C for an angle, from OC = 2R cos(theta / 3). */
  function solveFor(angle) {
    if (!Number.isFinite(angle) || angle <= 0 || angle >= Math.PI) return null;
    const phi = angle / 3;
    const B = pointOnCircle(angle);
    const C = { x: O.x - 2 * R * Math.cos(phi), y: O.y };
    const len = dist(C, B);
    const D = { x: C.x + R * (B.x - C.x) / len, y: C.y + R * (B.y - C.y) / len };
    return { B, C, D, angle, third: phi };
  }

  /** The whole figure for a position: the applet's D, angles and success test. */
  function construct(state) {
    const s = state || start();
    const B = copy(s.B), C = copy(s.C);
    const A = { x: O.x + R, y: O.y };
    const len = dist(C, B);
    const D = len < 0.001 ? null
      : { x: C.x + R * (B.x - C.x) / len, y: C.y + R * (B.y - C.y) / len };
    // draw() reads the displayed angle with acos from B.x alone.
    const angle = Math.acos(clamp((B.x - O.x) / R, -1, 1));
    const angleDeg = Math.trunc(deg(angle));
    const CO = { x: O.x - C.x, y: O.y - C.y };
    const CD = D ? { x: D.x - C.x, y: D.y - C.y } : null;
    const atC = D && dist({ x: 0, y: 0 }, CO) > 0.001
      ? Math.acos(clamp(dot(CO, CD) / (Math.hypot(CO.x, CO.y) * R), -1, 1)) : 0;
    const onCircle = D !== null && Math.abs(dist(O, D) - R) < TOL;
    // A near-solution still counts as a trisection; the only other way to
    // satisfy CD = OD = R is the collapsed branch where D sits on top of B.
    const trisects = onCircle && Math.abs(atC - angle / 3) < 0.02;
    const collapsed = onCircle && !trisects && dist(D, B) < 3;
    return {
      O: copy(O), A, B, C, D,
      R, angle, angleDeg, angleAtC: atC,
      onCircle, trisects, collapsed,
      between: D !== null && dist(C, D) <= dist(C, B) + 1e-9,
      above: B.y <= O.y,
    };
  }

  /** A demo: nothing is won or lost; it counts as explored after one move. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The line under the board. */
  function describe(g) {
    if (!g || !g.D) return "Drag C to the left of O to place D.";
    const a = deg(g.angle).toFixed(1), t = deg(g.angleAtC).toFixed(1);
    if (g.trisects) {
      return `D is on the circle: angle AOB is ${a}° and angle DCO is ${t}°, exactly one third of it.`;
    }
    if (g.collapsed) {
      return `D is on the circle, but it has collapsed onto B, so angle DCO is ${t}° and does not trisect ${a}°. Slide C much further left.`;
    }
    if (g.onCircle) {
      return `D is on the circle: angle AOB is ${a}° and angle DCO is ${t}°, close to a third. Keep sliding C for the exact split.`;
    }
    return `Angle AOB is ${a}°. Slide C until D falls on the circle; then angle DCO will be one third of ${a}°.`;
  }

  return {
    WIDTH, HEIGHT, O, R, HANDLE_R, TOL, START_ANGLE, START_B, START_C,
    copy, clamp, dist, deg, pointOnCircle,
    start, legalMoves, move, solveFor, construct, result, describe,
  };
})();
