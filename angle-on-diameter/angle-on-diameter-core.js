"use strict";

/*
 * AngleOnDiameter — Alexander Bogomolny's "Angle On Diameter" illustration.
 *
 * AB is a diameter of a circle with centre O, and P is a point that can be
 * dragged round the circle.  Thales' theorem says that the angle APB is always
 * a right angle.  The old applet proves it by drawing two isosceles triangles
 * AOP and BOP: their equal base angles add to 90°, and the radius OP splits
 * the angle at P into exactly those two angles.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, AngleOnDiameterCore, so the page loads it
 * with a plain <script> and porting/check-angle-on-diameter.mjs loads it in
 * Node.  The position is plain data (numbers and plain objects).
 *
 * The board follows the applet's suggested 400x300 canvas: the centre is
 * (200,150) and the radius is min(W/2, H/2) * 2/3 = 100.  Screen y points down,
 * so a point at mathematical angle t is (cx + r cos t, cy - r sin t) — exactly
 * the applet's CreatePoint(cx, cy, -t, r).
 */

const AngleOnDiameterCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const CENTER = { x: 200, y: 150 };
  const RADIUS = Math.min(VIEW.width / 2, VIEW.height / 2) * 2 / 3; // 100
  const CIRCLE = { c: CENTER, r: RADIUS };
  // CreatePoint(cx, cy, -t, r) with t in [3pi/8, 5pi/8] is the applet's start.
  // A fixed representative keeps the port reproducible; the check exercises
  // the whole range as well.
  const START_ANGLE = 3 * Math.PI / 8;
  const DEG = 180 / Math.PI;
  const MODES = ["plain", "statement", "hint"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** Angle at v between the rays v->p and v->q, in radians in [0, PI]. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** The applet's CreatePoint(cx, cy, -t, r), in screen coordinates. */
  function pointOnCircle(circle, t) {
    return point(circle.c.x + circle.r * Math.cos(t),
                 circle.c.y - circle.r * Math.sin(t));
  }

  /** The angle t of p about the centre, matching pointOnCircle. */
  function angleOf(p, circle) {
    const t = Math.atan2(circle.c.y - p.y, p.x - circle.c.x);
    return t < 0 ? t + 2 * Math.PI : t;
  }

  /** The applet's RestrictToCircle: slide a dragged point onto the circle. */
  function project(p, circle) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return pointOnCircle(circle, START_ANGLE);
    const d = sub(p, circle.c);
    if (Math.hypot(d.x, d.y) < 1e-9) return pointOnCircle(circle, START_ANGLE);
    return add(circle.c, mul(unit(d), circle.r));
  }

  /** Keep P on the fixed circle of the drawing. */
  function clamp(p) {
    return project(p, CIRCLE);
  }

  /** The position a new drawing opens with (the applet's "show=1" default). */
  function start(options) {
    const o = options || {};
    return {
      P: pointOnCircle(CIRCLE, START_ANGLE),
      options: {
        names: o.names === undefined ? true : !!o.names,
        mode: MODES.indexOf(o.mode) >= 0 ? o.mode : "plain",
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** Drag P; it stays on the circle, just as the applet restricts it. */
  function move(state, p) {
    return Object.assign({}, state, { P: clamp(p), explored: true });
  }

  function setOption(state, name, value) {
    if (name === "names") {
      return Object.assign({}, state, {
        options: Object.assign({}, state.options, { names: !!value }), explored: true,
      });
    }
    if (name === "mode" && MODES.indexOf(value) >= 0) {
      return Object.assign({}, state, {
        options: Object.assign({}, state.options, { mode: value }), explored: true,
      });
    }
    return state;
  }

  /** Every point and angle of the picture, from the draggable point P. */
  function geometry(state) {
    const P = state.P;
    const A = point(CENTER.x - RADIUS, CENTER.y); // CreatePoint(cx, cy, PI, r)
    const B = point(CENTER.x + RADIUS, CENTER.y); // CreatePoint(cx, cy, 0, r)
    const O = CENTER;
    const angles = {
      APB: angle(P, A, B),
      AOP: angle(O, A, P),
      BOP: angle(O, B, P),
      OAP: angle(A, O, P),
      APO: angle(P, A, O),
      OBP: angle(B, O, P),
      BPO: angle(P, B, O),
    };
    return {
      circle: CIRCLE, A: A, B: B, O: O, P: P,
      radius: RADIUS,
      angles: angles,
      // The dot product is zero exactly when PA and PB are perpendicular.
      corner: dot(sub(A, P), sub(B, P)),
      centralSum: angles.AOP + angles.BOP,
    };
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says; the numbers come from the current picture. */
  function describe(state) {
    const g = geometry(state);
    const apb = (g.angles.APB * DEG).toFixed(1);
    if (state.options.mode === "statement") {
      return `The square at P marks the right angle: ∠APB = ${apb}°.`;
    }
    if (state.options.mode === "hint") {
      const apo = (g.angles.APO * DEG).toFixed(1);
      const bpo = (g.angles.BPO * DEG).toFixed(1);
      return `OA = OB = OP, so the base angles are equal: ∠APO = ∠OAP = ${apo}° `
        + `and ∠BPO = ∠OBP = ${bpo}°. They add to ${(+apo + +bpo).toFixed(1)}°.`;
    }
    return `∠APB = ${apb}° — a right angle wherever P sits on the circle.`;
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS, CIRCLE: CIRCLE,
    START_ANGLE: START_ANGLE, DEG: DEG, MODES: MODES,
    point: point, add: add, sub: sub, mul: mul, dot: dot, dist: dist,
    unit: unit, angle: angle, pointOnCircle: pointOnCircle, angleOf: angleOf,
    project: project, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    geometry: geometry, result: result, describe: describe,
  };
})();
