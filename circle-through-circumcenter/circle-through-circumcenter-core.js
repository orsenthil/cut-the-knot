"use strict";

/*
 * Circle Through Circumcenter — Alexander Bogomolny's applet
 * CircleThroughCircumcenter (problem 3, 1996 British Mathematical Olympiad).
 *
 * O is the circumcentre of triangle ABC.  The circle through B, O and C cuts
 * the lines AB and AC again at P and Q.  The claim is that AO is perpendicular
 * to PQ — and the old page adds that the triangle need not be acute.  The key
 * idea in the code is the same one the applet uses: build both circles from
 * three points, cut each circle with a line through a point already on it, and
 * intersect the chord PQ with the line AO.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CircleThroughCircumcenterCore, so the page
 * loads it with a plain <script> and porting/check-circle-through-circumcenter.mjs
 * loads it in Node.  The position is plain data (points in the SVG's viewBox
 * units), so it can be saved and handed to the tutor as it is.  Functions take
 * a position and return fresh objects; they never change what they are given.
 */

const CircleThroughCircumcenterCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 24;
  const DEG = 180 / Math.PI;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** Angle at v between the rays to p and q, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** Perpendicular distance from p to the line through a and b. */
  function distanceToLine(p, a, b) {
    const v = sub(b, a);
    const n = Math.hypot(v.x, v.y);
    return n ? Math.abs(cross(sub(p, a), v)) / n : dist(p, a);
  }

  /** Intersection of line(a,b) with line(c,d), or null when parallel. */
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return null;
    return add(a, mul(r, cross(sub(c, a), s) / den));
  }

  /** Keep a dragged vertex inside the board with room for its label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* The applet's own starting triangle: on a 400x300 canvas its centre is
   * (200,150), the radius is min(width,height)/4 = 75, and the three angles
   * (in screen coordinates, y pointing down) are -1.6, -3.7 and -0.2. */
  function home() {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = Math.min(VIEW.width, VIEW.height) / 4;
    const at = (t) => point(cx + r * Math.cos(t), cy + r * Math.sin(t));
    return { B: at(-1.6), C: at(-3.7), A: at(-0.2) };
  }

  /** The position a new diagram starts from. */
  function start(options) {
    const o = options || {};
    const p = home();
    return {
      A: p.A, B: p.B, C: p.C,
      /* The applet initialises both "names" and "hint" from the same
       * ShowNames parameter; keep that harmless quirk. */
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: o.hint === undefined ? true : !!o.hint,
        premises: !!o.premises,
        statement: !!o.statement,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** GeoSDoub.FindCircumcenter, then the applet's averaged radius. */
  function getCircle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = lineIntersection(
      m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
      m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)),
    );
    if (!o) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return { c: o, r: r };
  }

  /** The other place the line through v and towards meets the circle. */
  function secondOnCircle(v, towards, circle) {
    const d = unit(sub(towards, v));
    const t = -2 * dot(sub(v, circle.c), d);
    if (!Number.isFinite(t)) return null;
    return add(v, mul(d, t));
  }

  /** All the points of the drawing, from the three triangle vertices. */
  function compute(a, b, c) {
    const circumcircle = getCircle(b, c, a);
    if (!circumcircle || !(circumcircle.r > 1e-9)) return null;
    const O = circumcircle.c;                         // GetCircle's centre
    const circle = getCircle(b, c, O);                // circle through B, O, C
    if (!circle || !(circle.r > 1e-9)) return null;

    // Compute(): cut that circle with AB, AC and AO, keeping the far point.
    const P = secondOnCircle(b, a, circle);
    const Q = secondOnCircle(c, a, circle);
    const J = secondOnCircle(O, a, circle);
    const X = lineIntersection(P, Q, a, O);
    if (!P || !Q || !J || !X) return null;

    return {
      A: a, B: b, C: c, O: O, P: P, Q: Q, J: J, X: X,
      circumcircle: circumcircle, circle: circle,
      angles: { A: angle(a, b, c), B: angle(b, a, c), C: angle(c, a, b) },
      sides: { a: dist(b, c), b: dist(a, c), c: dist(a, b) },
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C);
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says, following the applet's four checkboxes. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the three points make a triangle.";
    const c = (g.angles.C * DEG).toFixed(1);
    const bao = (angle(g.A, g.B, g.O) * DEG).toFixed(1);
    if (state.options.hint) {
      // ∠APQ = ∠BCA always; for an obtuse corner C the unsigned angles differ
      // by 90° instead of adding to it (the page's directed angles add).
      const relation = g.angles.C < Math.PI / 2 ? "add to" : "differ by";
      return `∠APQ = ∠BCA = ${c}° and ∠BAO = ${bao}°; they ${relation} 90°, so AO ⟂ PQ.`;
    }
    if (state.options.statement) {
      return "AO crosses PQ at X, and all four angles at X are right angles.";
    }
    if (state.options.premises) {
      return "O is the centre of the circle through A, B and C; the second circle passes through B, O and C.";
    }
    return "Drag A, B or C: however the triangle changes, AO stays perpendicular to PQ.";
  }

  return {
    VIEW: VIEW, PAD: PAD, DEG: DEG,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, unit: unit, angle: angle,
    distanceToLine: distanceToLine, lineIntersection: lineIntersection, clamp: clamp,
    home: home, start: start, reset: reset, move: move, setOption: setOption,
    getCircle: getCircle, secondOnCircle: secondOnCircle,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
