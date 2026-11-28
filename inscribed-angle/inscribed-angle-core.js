"use strict";

/*
 * InscribedAngle — Alexander Bogomolny's "Inscribed and Central Angles" applet.
 *
 * Three points A, B and C sit on one circle and can be dragged round it.  The
 * two chords from A cut off the arc BC that does not contain A; the angle at A
 * over that arc (an inscribed angle) is always half the central angle over the
 * same arc.  When that arc is more than a half circle the applet splits the
 * central angle at A′, the point opposite A.  When B or C is dragged onto A,
 * the applet replaces the vanished chord by the tangent at A; the angle
 * between tangent and remaining chord is half the central angle over it.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, InscribedAngleCore, so the page loads it
 * with a plain <script> and porting/check-inscribed-angle.mjs loads it in Node.
 * The position is plain data (numbers and plain points), so it can be saved
 * for the player's record and handed to the tutor.
 *
 * Coordinates follow the applet's 400x300 canvas, with y pointing down:
 * CreatePoint(cx, cy, t, r) = (cx + r cos t, cy + r sin t) and the radius is
 * min(W/2, H/2) * 2/3 = 100.  A′ = 2O − A, just as in the bytecode.
 */

const InscribedAngleCore = (() => {
  const TAU = 2 * Math.PI;
  const DEG = 180 / Math.PI;
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width / 2, VIEW.height / 2) * 2 / 3;
  const CIRCLE = { c: CENTER, r: RADIUS };
  // The applet picks each of its three angles at random in a quarter turn
  // around 90°, 180° and 270°.  A fixed representative of each range keeps
  // the port reproducible; the logic test walks all three ranges.
  const START_ANGLES = { A: Math.PI / 2, B: Math.PI, C: 3 * Math.PI / 2 };
  const HIT = 1; // the applet's "points coincide" test: distance < 1 pixel
  const HANDLES = ["A", "B", "C"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** GeoSDoub.ComputeAngle: law of cosines, the angle at the first point. */
  function angle(v, p, q) {
    const vp = dist(v, p), vq = dist(v, q), pq = dist(p, q);
    if (!vp || !vq) return 0;
    return Math.acos(Math.max(-1, Math.min(1,
      (sqDist(v, p) + sqDist(v, q) - pq * pq) / (2 * vp * vq))));
  }

  /** The applet's CreatePoint(cx, cy, t, r), in screen coordinates. */
  function pointOnCircle(circle, t) {
    return point(circle.c.x + circle.r * Math.cos(t), circle.c.y + circle.r * Math.sin(t));
  }

  /** Angle t about the centre, with y down, in [0, 2π). */
  function angleOf(p, circle) {
    const t = Math.atan2(p.y - circle.c.y, p.x - circle.c.x);
    return t < 0 ? t + TAU : t;
  }

  const ccw = (from, to) => ((to - from) % TAU + TAU) % TAU;

  /** The applet's RestrictToCircle: slide a dragged point onto the circle. */
  function project(p, circle) {
    const c = circle || CIRCLE;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return pointOnCircle(c, START_ANGLES.A);
    const d = sub(p, c.c);
    if (Math.hypot(d.x, d.y) < 1e-9) return pointOnCircle(c, START_ANGLES.A);
    return add(c.c, mul(unit(d), c.r));
  }

  /** The starting picture: A below the centre, B to the left, C above. */
  function start(options) {
    const o = options || {};
    return {
      A: pointOnCircle(CIRCLE, START_ANGLES.A),
      B: pointOnCircle(CIRCLE, START_ANGLES.B),
      C: pointOnCircle(CIRCLE, START_ANGLES.C),
      names: o.names === undefined ? true : !!o.names, // applet's "show" parameter defaults to "1"
      explored: false,
    };
  }

  function reset(state) {
    const s = start({ names: state.names });
    s.explored = !!state.explored;
    return s;
  }

  /** Drag one of the three points; it is restricted to the circle. */
  function move(state, name, p) {
    if (HANDLES.indexOf(name) < 0) return state;
    const q = project(p);
    if (dist(q, state[name]) < 1e-12) return state;
    const next = Object.assign({}, state, { explored: true });
    next[name] = q;
    return next;
  }

  /** The applet's only option is its "Show names" checkbox. */
  function setOption(state, name, value) {
    if (name !== "names") return state;
    return Object.assign({}, state, { names: !!value, explored: true });
  }

  /** GeoSDoub.FindOrientation, straight from the bytecode (> 0 ? 1 : -1). */
  function orientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  /** Measure of the arc BC that does NOT contain A, computed from the angles
   *  of the three points about O.  Independent of the law-of-cosines angle. */
  function subtendedArc(state) {
    const tA = angleOf(state.A, CIRCLE);
    const tB = angleOf(state.B, CIRCLE);
    const tC = angleOf(state.C, CIRCLE);
    const arc = ccw(tB, tC);
    const aOnArc = arc > 1e-12 && ccw(tB, tA) <= arc;
    return aOnArc ? TAU - arc : arc;
  }

  /** The tangent ray the applet's DrawTangent marks, and its mirror image. */
  function tangentPoints(A, O, chordPoint) {
    const T = point(A.x - (O.y - A.y), A.y + (O.x - A.x));
    const T2 = point(2 * A.x - T.x, 2 * A.y - T.y);
    const chosen = orientation(A, T, O) === orientation(A, T, chordPoint) ? T : T2;
    return { T, T2, chosen };
  }

  /**
   * Every point and angle of the picture, from the three draggable points.
   * `mode` follows the applet's Draw: a vanished B or C gives the tangent
   * case; otherwise the two proof triangles and the main angle arcs are drawn.
   */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C, O = CIRCLE.c;
    const Ap = point(2 * O.x - A.x, 2 * O.y - A.y);
    const dAB = dist(A, B), dAC = dist(A, C);
    const mode = dAB < HIT ? "tangentC" : dAC < HIT ? "tangentB" : "normal";
    const inscribed = angle(A, B, C);
    const arc = subtendedArc(state);
    // DrawAngles splits the central arc at A′ once the inscribed angle is a
    // right angle or more; below that it draws the single arc B-O-C.
    const split = inscribed >= Math.PI / 2;

    const proof = [];
    for (const name of ["B", "C"]) {
      const P = state[name];
      const show = dist(P, Ap) > HIT;
      proof.push({
        name: name,
        P: P,
        show: show,
        atP: show ? angle(P, A, Ap) : 0,
        base: show && dist(P, O) > 0 ? angle(P, A, O) : 0,
        atO: show ? angle(O, P, Ap) : 0,
      });
    }

    let tangent = null;
    if (mode !== "normal") {
      const chordPoint = mode === "tangentC" ? C : B;
      const points = tangentPoints(A, O, chordPoint);
      const central = angle(O, A, chordPoint);
      const marked = angle(A, chordPoint, points.chosen);
      tangent = {
        chordPoint: chordPoint,
        color: mode === "tangentC" ? "bad" : "good",
        T: points.T,
        T2: points.T2,
        chosen: points.chosen,
        central: central,
        marked: marked,
        acute: Math.min(marked, Math.PI - marked),
      };
    }

    return {
      circle: CIRCLE, O: O, A: A, B: B, C: C, Ap: Ap,
      dAB: dAB, dAC: dAC, mode: mode,
      inscribed: inscribed, arc: arc, central: arc, split: split,
      proof: proof, tangent: tangent,
    };
  }

  /* This is a picture, not a game: nothing is won or lost. */
  function result(state) {
    return null;
  }

  /** The status line: the numbers the player can watch while dragging. */
  function describe(state) {
    const g = geometry(state);
    const deg = (t) => (t * DEG).toFixed(1) + "°";
    if (g.tangent) {
      const vanished = g.mode === "tangentC" ? "B" : "C";
      const side = g.mode === "tangentC" ? "AC" : "AB";
      return `With ${vanished} on A, the tangent at A meets chord ${side} at ${deg(g.tangent.acute)} `
        + `(the marked angle is ${deg(g.tangent.marked)}); the central angle over that chord is ${deg(g.tangent.central)}.`;
    }
    return `∠BAC = ${deg(g.inscribed)} and the central angle over arc BC is ${deg(g.central)} `
      + `= twice ∠BAC${g.split ? " (split at A′)" : ""}.`;
  }

  return {
    TAU: TAU, DEG: DEG, VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS,
    CIRCLE: CIRCLE, START_ANGLES: START_ANGLES, HIT: HIT, HANDLES: HANDLES,
    point: point, add: add, sub: sub, mul: mul, dot: dot, dist: dist,
    sqDist: sqDist, unit: unit, angle: angle, pointOnCircle: pointOnCircle,
    angleOf: angleOf, ccw: ccw, project: project, orientation: orientation,
    subtendedArc: subtendedArc, tangentPoints: tangentPoints,
    start: start, reset: reset, move: move, setOption: setOption,
    geometry: geometry, result: result, describe: describe,
  };
})();
