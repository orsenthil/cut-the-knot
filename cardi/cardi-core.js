"use strict";

/*
 * Cardi — the cardioid construction in Alexander Bogomolny's applet Cardi
 * ("Hearty Munching on Cardioids", cut-the-knot.org/ctk/Cardi.shtml).
 *
 * A circle of radius r rolls without slipping round the outside of a fixed
 * circle of the same radius. A mark M on its rim starts at the touching point
 * A (the cusp) and traces a cardioid. The applet keeps the moving centre P and
 * the mark M and rotates both a little every tick: the mark turns about P by
 * Delta * R/r degrees (its "Roll/Rotate" factor V is 1 here) and then the whole
 * picture turns about the fixed centre O by Delta degrees. So after a turn of
 * angle t the mark's offset from P has turned by 2t, which gives
 *
 *     M = O + (R + r)(cos t, sin t) - r(cos 2t, sin 2t).
 *
 * The page also describes the common tangent (the perpendicular bisector of
 * AM), the pedal construction, the hinged parallelogram OPMQ and the chord MN
 * through the cusp. All of those are derived below from the same point M; the
 * logic test checks every claim against a second, literal transcription of the
 * applet's updateCC / RotateInternal loop read from the bytecode.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CardiCore, so the page loads it with a plain
 * <script> and porting/check-cardi.mjs loads it in Node. Positions are plain
 * data and every function returns a new object.
 */
const CardiCore = (() => {
  const VIEW = { x: 0, y: 0, width: 390, height: 350 }; // applet: "390 will do", "350 will do"
  const O = { x: VIEW.width / 2, y: VIEW.height / 2 }; // m_Center
  const R = 30; // m_R: the fixed circle
  const R_MOVING = 30; // m_r: the rolling circle, equal to R (m_Rr = 1)
  const DELTA = 2; // m_Delta: degrees per tick
  const TICK_MS = 100; // Cardi.run sleeps 100 ms between updates
  const MODES = ["cross", "parallelogram", "double"]; // which = 0, 1, 2
  const START_ANGLE = Math.PI / 3; // the applet opens at the cusp; we open at 60 degrees
  const TAU = 2 * Math.PI;
  const DEG = 180 / Math.PI;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => mul(add(p, q), 0.5);
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  const onCircle = (c, r, a) => point(c.x + r * Math.cos(a), c.y + r * Math.sin(a));

  /** The applet's FindAngle: asin(dy/d) and acos(dx/d), picked by quadrant. */
  function findAngle(dx, dy, d) {
    const s = Math.asin(dy / d);
    return s >= 0 ? Math.acos(dx / d) : -Math.acos(dx / d);
  }

  /*
   * The closed form of cCTKCycloid2.updateFormulaCC for a mark added at time 0:
   * InitAngle = PI, CentralAngle = 0, Dist = r, i = 1, V = 1.
   */
  function formulaPoint(theta, o, fixed, rolling, factor) {
    const f = factor === undefined ? 1 : factor;
    const b = theta;
    const a = theta * (fixed / rolling + 1) * f + Math.PI;
    return point(
      o.x + (fixed + rolling) * Math.cos(b) + rolling * Math.cos(a),
      o.y + (fixed + rolling) * Math.sin(b) + rolling * Math.sin(a),
    );
  }

  /** The cusp A: the fixed point on the stationary circle where M starts. */
  function cusp(o, fixed) {
    return point(o.x + fixed, o.y);
  }

  /**
   * A second transcription, straight from the bytecode: eCTKCycloid2.reset,
   * cCTKCycloid2.updateCC and CTKCycloid2.RotateInternal. The mark is copied
   * from PointsO to PointsN, spun about the old P, and then P and the mark are
   * both spun about O. Runs from time 0, never using formulaPoint.
   */
  function incremental(o, fixed, rolling, steps, deltaDeg, speed) {
    const factor = speed === 0 ? 0 : speed > 0 ? speed : 1 / Math.abs(speed);
    let centre = point(o.x + fixed + rolling, o.y); // eCTKCycloid2.reset
    // CardiCanvas.reset: new Point(trunc(P.x - r*cos 0), trunc(P.y + r*sin 0))
    let mark = point(Math.trunc(centre.x - rolling), Math.trunc(centre.y));
    const spin = ((deltaDeg * Math.PI) / 180) * (fixed / rolling) * factor;
    const orbit = (deltaDeg * Math.PI) / 180;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const co = Math.cos(orbit), so = Math.sin(orbit);
    for (let k = 0; k < steps; k++) {
      // RotateInternal(0, sinPart, cosPart) about the *old* moving centre.
      const sx = mark.x - centre.x, sy = mark.y - centre.y;
      mark = point(centre.x + sx * cs - sy * sn, centre.y + sx * sn + sy * cs);
      // updateCC then turns the moving centre and every mark about the fixed centre.
      const px = centre.x - o.x, py = centre.y - o.y;
      centre = point(o.x + px * co - py * so, o.y + px * so + py * co);
      const mx = mark.x - o.x, my = mark.y - o.y;
      mark = point(o.x + mx * co - my * so, o.y + mx * so + my * co);
    }
    return { P: centre, M: mark };
  }

  /** A fresh illustration: 60 degrees into the roll, the plain cross overlay. */
  function start(options) {
    const o = options || {};
    return {
      theta: norm(typeof o.theta === "number" && Number.isFinite(o.theta) ? o.theta : START_ANGLE),
      mode: MODES.indexOf(o.mode) >= 0 ? o.mode : "cross",
      construction: o.construction === undefined ? false : !!o.construction,
      explored: false,
    };
  }

  /** All the named points of one instant, in board units (y down). */
  function geometry(state) {
    const theta = norm(state.theta);
    const A = cusp(O, R);
    const P = onCircle(O, R + R_MOVING, theta);
    const T = onCircle(O, R, theta); // the touching point = midpoint of OP
    const M = formulaPoint(theta, O, R, R_MOVING, 1);
    const N = formulaPoint(theta + Math.PI, O, R, R_MOVING, 1); // the other end of the chord
    const Q = add(O, sub(M, P)); // OQ is equal and parallel to PM
    const foot = midpoint(A, M); // the pedal point, on the tangent at T
    return { O, A, P, T, M, N, Q, foot, theta, R, r: R_MOVING, radius: R + R_MOVING };
  }

  /** The common tangent at T: through T, at right angles to OP. */
  function tangent(g) {
    const u = { x: (g.P.x - g.O.x) / g.radius, y: (g.P.y - g.O.y) / g.radius };
    return {
      direction: point(-u.y, u.x),
      along: (d) => add(g.T, mul(point(-u.y, u.x), d)),
    };
  }

  /** Angle of a dragged point: from the cusp for M, from O for T. */
  function thetaFrom(p, which) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const centre = which === "T" ? O : cusp(O, R);
    return norm(Math.atan2(p.y - centre.y, p.x - centre.x));
  }

  /** Keep a dragged handle exactly on its curve. */
  function clamp(p, which) {
    const theta = thetaFrom(p, which);
    if (theta === null) return which === "T" ? onCircle(O, R, START_ANGLE) : formulaPoint(START_ANGLE, O, R, R_MOVING, 1);
    return which === "T" ? onCircle(O, R, theta) : formulaPoint(theta, O, R, R_MOVING, 1);
  }

  function legalMoves() {
    return [
      { type: "theta", value: START_ANGLE },
      { type: "step", count: 1 },
      { type: "mode", value: "cross" },
      { type: "construction", value: true },
      { type: "reset" },
    ];
  }

  /** The moves: drag a handle, roll a number of ticks, choose the overlay, reset. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "theta") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, theta: norm(Number(m.value)) };
    } else if (m.type === "step") {
      const count = Number.isInteger(m.count) ? m.count : 1;
      next = { ...state, theta: norm(state.theta + count * DELTA * Math.PI / 180) };
    } else if (m.type === "mode") {
      if (MODES.indexOf(m.value) < 0) return null;
      next = { ...state, mode: m.value };
    } else if (m.type === "construction") {
      if (typeof m.value !== "boolean") return null;
      next = { ...state, construction: m.value };
    } else if (m.type === "reset") {
      next = start(state);
    }
    if (!next) return null;
    return { ...next, explored: true };
  }

  /** A picture has no win and no loss; it is finished once it has been explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The page's claims at this instant, each as a true/false check. */
  function claims(state) {
    const g = geometry(state);
    const tol = 1e-7;
    const near = (a, b) => Math.abs(a - b) < tol;
    const close = (p, q) => dist(p, q) < tol;
    const u = mul(sub(g.P, g.O), 1 / g.radius); // the normal to the tangent at T
    const mirror = sub(g.A, mul(u, 2 * dot(sub(g.A, g.T), u)));
    return {
      markOnRollingCircle: near(dist(g.M, g.P), g.r),
      contactBetweenCentres: near(dist(g.O, g.T), g.R) && near(dist(g.P, g.T), g.r) && close(midpoint(g.O, g.P), g.T),
      equalRadii: near(g.R, g.r),
      equalChordsTA_TM: near(dist(g.T, g.A), dist(g.T, g.M)),
      reflectionInTangent: close(mirror, g.M),
      tangentThroughFoot: close(g.foot, add(g.T, mul(tangent(g).direction, dot(sub(g.foot, g.T), tangent(g).direction)))),
      pedalIsMidpoint: close(g.foot, midpoint(g.A, g.M)),
      parallelogramOQ_PM: close(sub(g.Q, g.O), sub(g.M, g.P)) && near(dist(g.Q, g.O), g.r) && near(dist(g.P, g.O), 2 * g.r),
      chordThroughCuspIs4r: (() => {
        const am = dist(g.A, g.M), an = dist(g.A, g.N);
        return near(dist(g.M, g.N), 4 * g.r)
          && (am < tol || an < tol || Math.abs(dot(sub(g.A, g.M), sub(g.A, g.N)) / (am * an) + 1) < tol);
      })(),
      midpointOnFixedCircle: near(dist(midpoint(g.M, g.N), g.O), g.r),
      speedFromCusp: near(Math.hypot(2 * g.r * Math.sin(g.theta) - 2 * g.r * Math.sin(2 * g.theta),
        2 * g.r * Math.cos(g.theta) - 2 * g.r * Math.cos(2 * g.theta)), 4 * g.r * Math.abs(Math.sin(g.theta / 2))),
    };
  }

  /** Words for the status line, using the current picture. */
  function describe(state) {
    const g = geometry(state);
    const deg = Math.round(g.theta * DEG) % 360;
    const mode = {
      cross: "the tangent and the mirror line",
      parallelogram: "the hinged parallelogram",
      double: "the doubled parallelogram",
    }[state.mode];
    return `Rolled ${deg}°: M is ${Math.round(dist(g.M, g.P))} from P and ${Math.round(dist(g.M, g.N))} (= 4r) from N along the chord through A. Overlay: ${mode}.`;
  }

  return {
    VIEW, O, R, R_MOVING, DELTA, TICK_MS, MODES, START_ANGLE, TAU, DEG,
    point, add, sub, mul, dot, dist, midpoint, norm, onCircle,
    findAngle, formulaPoint, cusp, incremental, start, geometry, tangent,
    thetaFrom, clamp, legalMoves, move, result, claims, describe,
  };
})();
