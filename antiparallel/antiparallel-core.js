"use strict";

/*
 * Antiparallel — Alexander Bogomolny's applet of the same name.
 *
 * A circle is drawn with centre P on the perpendicular bisector of AB, so it
 * passes through both A and B. It meets BC again at D and AC again at E. The
 * chord DE is antiparallel to AB in the angle at C: it makes the same angle
 * with one side as AB makes with the other, in the opposite order.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, AntiparallelCore, so the page loads it with
 * a plain <script> and porting/check-antiparallel.mjs can load it in Node.
 * The four draggable points are plain objects in the SVG viewBox units; every
 * function returns fresh plain objects and never changes its arguments.
 *
 * The two moves that move A or B keep P on the perpendicular bisector at the
 * same distance from AB, on the same side as before — the applet's
 * AdjustAxisAndP. Dragging P itself slides it along that axis and adopts the
 * new distance — the applet's AdjustDistToAB.
 */

const AntiparallelCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 22;
  const DEFAULT_DIST = 30; // the applet field DistToAB, initialised to 30
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

  /** Angle at v between the rays v->p and v->q, in radians, in [0, PI]. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = dist(v, p) * dist(v, q);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** The smaller angle between two undirected lines, in radians. */
  function lineAngle(u, v) {
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, Math.abs(dot(u, v)) / n)));
  }

  /** GeoSDoub.FindOrientation: +1 left of a->b, -1 otherwise. */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const n = dist(a, b);
    return n ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
  }

  /** Where p projects onto the side of the triangle from a to b. */
  function parameters(p, a, b) {
    const v = sub(b, a);
    const n2 = dot(v, v);
    return n2 ? dot(sub(p, a), v) / n2 : 0;
  }

  /** Keep a dragged handle inside the board, with room for its label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* The applet's Perp(m, a): a point on the perpendicular bisector of AB. */
  function perpPoint(m, a) {
    return point(m.x + a.y - m.y, m.y - a.x + m.x);
  }

  /**
   * The applet's AdjustAxisAndP: put P on the perpendicular bisector at
   * distance `height` from AB, keeping the side it was on (oldP).
   */
  function placeOnAxis(a, b, oldP, height) {
    const m = midpoint(a, b);
    const perp = perpPoint(m, a);
    const w = sub(perp, m);
    const sign = orientation(a, b, oldP) === orientation(a, b, perp) ? 1 : -1;
    const len = Math.hypot(w.x, w.y) || 1;
    const u = mul(w, 1 / (len * sign));
    return add(m, mul(u, height));
  }

  /** Slide a freely dragged P onto the perpendicular bisector of AB. */
  function projectOnAxis(p, a, b) {
    const m = midpoint(a, b);
    const u = unit(point(-(b.y - a.y), b.x - a.x));
    return add(m, mul(u, dot(sub(p, m), u)));
  }

  /** The two points where the line through v and w cuts the circle. */
  function lineCircle(v, w, circle) {
    const d = unit(sub(w, v));
    if (!d.x && !d.y) return [];
    const f = sub(v, circle.c);
    const along = dot(f, d);
    const half = Math.sqrt(Math.max(0, along * along - dot(f, f) + circle.r * circle.r));
    const pts = [add(v, mul(d, -along + half)), add(v, mul(d, -along - half))];
    // GeoSDoub.Intersect lists its two hits by decreasing y (IntersectX)
    // or decreasing x (IntersectY). Keep that order: Other()'s 1px test
    // can distinguish them when the cut is almost tangent at a vertex.
    if (Math.abs(v.y - w.y) > 1) pts.sort((p, q) => q.y - p.y);
    else pts.sort((p, q) => q.x - p.x);
    return pts;
  }

  /** Other(points, vertex) from the applet: the hit at least 1px away. */
  function other(points, vertex) {
    if (!points.length) return null;
    return dist(points[0], vertex) >= 1 ? points[0] : (points[1] || points[0]);
  }

  /**
   * The applet's Compute(), in its own terms: the circle about P with mean
   * radius (PA + PB)/2, then the second crossings of BC and AC.
   */
  function compute(a, b, c, p) {
    // NoDraw in the applet: all three separations must be at least 2px.
    if (dist(a, c) < 2 || dist(b, c) < 2 || dist(a, b) < 2) return null;
    try {
      const circle = { c: p, r: (dist(p, a) + dist(p, b)) / 2 };
      const D = other(lineCircle(b, c, circle), b);
      const E = other(lineCircle(a, c, circle), a);
      if (!D || !E) return null;
      const m = midpoint(a, b);
      return {
        A: a, B: b, C: c, P: p, circle: circle, D: D, E: E,
        M: m, foot: (function () {
          const v = sub(b, a), t = parameters(p, a, b);
          return add(a, mul(v, t));
        })(),
        height: distanceToLine(p, a, b),
        tD: parameters(D, b, c), tE: parameters(E, a, c),
        angles: {
          atA: angle(a, b, c), atB: angle(b, a, c), atC: angle(c, a, b),
          // The two equal angles that make DE antiparallel to AB.
          toSide: lineAngle(sub(E, D), sub(a, c)),
          fromBase: lineAngle(sub(a, b), sub(b, c)),
        },
      };
    } catch (e) {
      return null;
    }
  }

  /* A modern starting triangle, with P 30px above AB as in the applet. */
  function start(options) {
    const o = options || {};
    const a = point(90, 220), b = point(310, 220), c = point(200, 40);
    return {
      A: a, B: b, C: c,
      P: placeOnAxis(a, b, point(0, 0), DEFAULT_DIST),
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: !!o.hint,
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
    if (name !== "A" && name !== "B" && name !== "C" && name !== "P") return state;
    const q = clamp(point(p.x, p.y));
    if (name === "P") {
      return Object.assign({}, state, { P: projectOnAxis(q, state.A, state.B), explored: true });
    }
    if (name === "A" || name === "B") {
      const height = distanceToLine(state.P, state.A, state.B);
      const a = name === "A" ? q : state.A;
      const b = name === "B" ? q : state.B;
      return Object.assign({}, state, {
        A: a, B: b, P: placeOnAxis(a, b, state.P, height), explored: true,
      });
    }
    return Object.assign({}, state, { C: q, explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.P);
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says, using the angle the construction produces. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Spread A, B and C apart to make a triangle.";
    const deg = (r) => (r * DEG).toFixed(1);
    if (state.options.hint) {
      return `DE meets AC at ${deg(g.angles.toSide)}°, the same as AB meets BC at ${deg(g.angles.fromBase)}° — the order is reversed.`;
    }
    if (g.tD > 0 && g.tD < 1 && g.tE > 0 && g.tE < 1) {
      return "D and E lie on the two sides: A, B, D and E are on one circle, and DE is antiparallel to AB.";
    }
    return "The circle cuts a side beyond the triangle: DE is still antiparallel to AB.";
  }

  return {
    VIEW: VIEW, PAD: PAD, DEFAULT_DIST: DEFAULT_DIST, DEG: DEG,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, unit: unit, angle: angle, lineAngle: lineAngle,
    orientation: orientation, distanceToLine: distanceToLine, parameters: parameters,
    clamp: clamp, perpPoint: perpPoint, placeOnAxis: placeOnAxis,
    projectOnAxis: projectOnAxis, lineCircle: lineCircle, other: other,
    compute: compute, start: start, reset: reset, move: move,
    setOption: setOption, geometry: geometry, result: result, describe: describe,
  };
})();
