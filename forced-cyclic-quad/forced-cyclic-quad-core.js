"use strict";

/*
 * Forced Cyclic Quadrilateral — Alexander Bogomolny's applet ForcedCyclicQuad.
 *
 * A, B, C and D are dragged on one circle.  B and C are the two base points;
 * at A we turn the ray AB by the add-on angle in one direction and at D we
 * turn DC by the same angle in the other direction.  Those two new rays meet
 * the line BC at E and F.  The page claims that A, E, F and D are cyclic,
 * that angle EAF = angle EDF and that, in particular, angle CAF = angle BDE.
 *
 * This file is only the geometry: no document, no window, no storage.  It
 * defines one global, ForcedCyclicQuadCore, so the page loads it with a plain
 * <script> and porting/check-forced-cyclic-quad.mjs loads it in Node.  All
 * positions are plain numbers in the SVG's viewBox units.  Rotate, Intersect
 * and FindCircumcenter below follow the applet's GeoSDoub bytecode literally,
 * including its |determinant| < 1 fallback to NaN and its mean-of-three
 * circumradius.
 */
const ForcedCyclicQuadCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 4;
  const TAU = 2 * Math.PI;
  const DEG = Math.PI / 180;
  const ANGLE_MIN = -45;
  const ANGLE_MAX = 45;
  const ANGLE_START = 20;
  const START_ANGLES = { A: Math.PI, B: Math.PI / 4, C: 0, D: 3 * Math.PI / 2 };
  const NAMES = ["A", "B", "C", "D"];
  const TOL = 2e-6; // angle comparison, radians (about a millionth of a turn)

  const point = (x, y) => ({ x, y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const wrap = (t) => ((t % TAU) + TAU) % TAU;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /** Applet AddAPoint: centre + radius*(cos t, -sin t) in screen coordinates. */
  function pointAt(t) {
    return point(CENTER.x + RADIUS * Math.cos(t), CENTER.y - RADIUS * Math.sin(t));
  }

  function angleOf(p) {
    return wrap(Math.atan2(CENTER.y - p.y, p.x - CENTER.x));
  }

  /** Applet CTKMoveableDoub.UpdateLocation for STAY_ON_CIRCLE. */
  function clamp(p) {
    if (!finite(p)) return null;
    const dx = p.x - CENTER.x, dy = p.y - CENTER.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-12) return pointAt(0);
    return point(CENTER.x + (RADIUS * dx) / d, CENTER.y + (RADIUS * dy) / d);
  }

  /** Applet PVNumeric: one decimal, clamped to [-45,45]. */
  function normalizeAngle(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, n)) * 10) / 10;
  }

  function start(options) {
    const o = options || {};
    return {
      angles: Object.assign({}, START_ANGLES),
      angle: ANGLE_START,
      options: {
        names: o.names === undefined ? false : !!o.names,
        premise: o.premise === undefined ? false : !!o.premise,
        statement: o.statement === undefined ? false : !!o.statement,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function points(state) {
    if (!state || !state.angles) return null;
    const p = {};
    for (const name of NAMES) {
      const t = state.angles[name];
      if (!Number.isFinite(t)) return null;
      p[name] = pointAt(t);
    }
    return p;
  }

  function move(state, name, p) {
    if (!NAMES.includes(name)) return state;
    const q = clamp(p);
    if (!q || !state.angles) return state;
    return Object.assign({}, state, {
      angles: Object.assign({}, state.angles, { [name]: angleOf(q) }),
      explored: true,
    });
  }

  function setAngle(state, value) {
    const n = normalizeAngle(value);
    if (n === null) return state;
    return Object.assign({}, state, { angle: n, explored: true });
  }

  function nudgeAngle(state, delta) {
    return setAngle(state, Math.round((state.angle + delta) * 10) / 10);
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** GeoSDoub.Rotate(P,Q,angle,dir): rotate Q about P, dir = +/-1. */
  function rotate(p, q, theta, dir) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const dx = q.x - p.x, dy = q.y - p.y;
    return point(
      p.x + c * dx - dir * s * dy,
      p.y + dir * s * dx + c * dy,
    );
  }

  /** GeoSDoub.Intersect: two full lines, NaN when |det| < 1 as in the applet. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det);
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
  function circumcenter(a, b, c) {
    const m1 = point((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = point((b.x + c.x) / 2, (b.y + c.y) / 2);
    return intersect(
      m1, point(m1.x + b.y - a.y, m1.y - (b.x - a.x)),
      m2, point(m2.x + c.y - b.y, m2.y - (c.x - b.x)),
    );
  }

  /** Applet GetCircumcircle: centre and the mean of the three radii. */
  function circumcircle(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!finite(center)) return null;
    return { c: center, r: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
  }

  /** The ordinary (unsigned) angle at v between the rays to p and q. */
  function angle(v, p, q) {
    const a = point(p.x - v.x, p.y - v.y), b = point(q.x - v.x, q.y - v.y);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  const toDeg = (r) => r / DEG;
  const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a - b) <= (tol === undefined ? TOL : tol);

  function invalid(reason, p) {
    return {
      valid: false, reason: reason,
      A: p && p.A, B: p && p.B, C: p && p.C, D: p && p.D,
      E: null, F: null, circle: null, measures: null, claims: null,
    };
  }

  /**
   * The applet's Compute(), plus measurements of the page's claims.  A
   * position with B and C closer than one pixel is skipped by the applet;
   * so is any position where its Intersect returns NaN.
   */
  function compute(state) {
    const p = points(state);
    if (!p) return invalid("Move the four points onto the circle.");
    const { A, B, C, D } = p;
    if (dist(B, C) < 1) return invalid("B and C are too close together.", p);

    const theta = state.angle * DEG;
    const A2 = rotate(A, B, theta, -1);
    const D2 = rotate(D, C, theta, 1);
    const E = intersect(A, A2, B, C);
    const F = intersect(D, D2, B, C);
    if (!finite(E) || !finite(F)) {
      return invalid("The new lines are parallel; move a point a little.", p);
    }
    const circle = circumcircle(A, D, E);
    if (!circle || !Number.isFinite(circle.r) || circle.r < 1e-9) {
      return invalid("The new circle cannot be drawn here.", p);
    }

    const BAE = angle(A, B, E), CDF = angle(D, C, F);
    const EAF = angle(A, E, F), EDF = angle(D, E, F);
    const CAF = angle(A, C, F), BDE = angle(D, B, E);
    const BAC = angle(A, B, C), BDC = angle(D, B, C);
    const ADF = angle(D, A, F), AEF = angle(E, A, F);
    const base = point(C.x - B.x, C.y - B.y);
    const tE = dot(point(E.x - B.x, E.y - B.y), base) / dot(base, base);
    const tF = dot(point(F.x - B.x, F.y - B.y), base) / dot(base, base);
    const tolDist = 1e-5 * Math.max(1, circle.r, dist(A, F), dist(D, E));
    const circleFError = Math.abs(dist(F, circle.c) - circle.r);
    const angleDiff = CAF - BDE;

    const measures = {
      addedAngle: Math.abs(state.angle),
      BAE: toDeg(BAE), CDF: toDeg(CDF),
      EAF: toDeg(EAF), EDF: toDeg(EDF),
      CAF: toDeg(CAF), BDE: toDeg(BDE),
      BAC: toDeg(BAC), BDC: toDeg(BDC),
      ADF: toDeg(ADF), AEF: toDeg(AEF),
      ADFplusAEF: toDeg(ADF + AEF),
      tE: tE, tF: tF,
      circleFError: circleFError,
    };
    const claims = {
      premiseAnglesEqual: near(BAE, CDF),
      premiseAnglesEqualModPi: near(BAE, CDF) || near(BAE + CDF, Math.PI),
      aefdCyclic: circleFError <= tolDist,
      eafEqualsEdf: near(EAF, EDF),
      cafEqualsBde: near(CAF, BDE),
      cafEqualsBdeModPi: near(Math.abs(angleDiff), 0) || near(Math.abs(angleDiff), Math.PI),
      bacEqualsBdc: near(BAC, BDC),
      supplementary: near(ADF + AEF, Math.PI, 1e-4),
      eBeforeBBeforeCBeforeF: tE < 0 && tF > 1,
      sameSideOutside: (tE < 0 && tF < 0) || (tE > 1 && tF > 1),
    };
    return {
      valid: true, A: A, B: B, C: C, D: D, E: E, F: F,
      A2: A2, D2: D2, circle: circle,
      measures: measures, claims: claims,
    };
  }

  const geometry = (state) => compute(state);

  /* An illustration: there is no win, no loss and no finishing move. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = compute(state);
    if (!g.valid) return g.reason;
    const m = g.measures;
    let text = `Added angles ${m.addedAngle.toFixed(1)}° at A and D. `
      + (g.claims.aefdCyclic ? "A, E, F and D lie on one circle. "
        : "A, E, F and D are close to one circle. ");
    if (Math.abs(m.CAF - m.BDE) < 0.05) {
      text += `Angle CAF = angle BDE = ${m.CAF.toFixed(1)}°.`;
    } else {
      // Both E and F can land beyond B or beyond C on the same side; then
      // B and C are not on the side EF of AEFD and the page's conclusion
      // as ordinary angles does not apply.  Do not claim it in the status.
      text += `Angle CAF is ${m.CAF.toFixed(1)}° and angle BDE is ${m.BDE.toFixed(1)}°.`;
    }
    if (g.claims.eBeforeBBeforeCBeforeF) {
      text += " In this order, angles ADF and AEF add to 180°.";
    }
    return text;
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS,
    ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX, ANGLE_START: ANGLE_START,
    START_ANGLES: START_ANGLES, NAMES: NAMES,
    point: point, finite: finite, wrap: wrap, dist: dist, dot: dot,
    pointAt: pointAt, angleOf: angleOf, clamp: clamp,
    normalizeAngle: normalizeAngle, start: start, reset: reset,
    points: points, move: move, setAngle: setAngle, nudgeAngle: nudgeAngle,
    setOption: setOption, rotate: rotate, intersect: intersect,
    circumcenter: circumcenter, circumcircle: circumcircle, angle: angle,
    toDeg: toDeg, compute: compute, geometry: geometry,
    result: result, describe: describe,
  };
})();
