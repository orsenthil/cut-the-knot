"use strict";

/*
 * ABOnCircumcircle — Alexander Bogomolny's "Angle Bisectors On Circumcircle".
 *
 * A triangle's three angle bisectors meet its circumcircle again at D, E and
 * F.  Those points are the midpoints of the arcs they cut off, the bisectors
 * meet at the incenter I, and (the point of the droodle) AD is perpendicular
 * to EF.  This file is the geometry and nothing else: no document, no window.
 * It defines one global, AbOnCircumcircleCore, so it loads with a plain
 * <script> and porting/check-ab-on-circumcircle.mjs can load it in Node.
 *
 * The three draggable vertices are plain points in the SVG's viewBox units.
 * Every computation returns fresh plain objects.  The construction follows
 * the applet: find the circumcircle, cut it with each angle bisector, choose
 * the intersection that is not the vertex, then intersect AD with EF.
 */

const AbOnCircumcircleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const HOME = { x: 200, y: 150, r: 100 };
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

  /** Angle at v between the rays v->p and v->q, in radians. */
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

  /* The applet's own starting triangle: angles 60°, 144° and 36° about the
   * centre of a 400x300 canvas, radius 100, with screen y pointing down. */
  function start(options) {
    const o = options || {};
    return {
      A: point(HOME.x + HOME.r * Math.cos(Math.PI / 3), HOME.y - HOME.r * Math.sin(Math.PI / 3)),
      B: point(HOME.x + HOME.r * Math.cos(4 * Math.PI / 5), HOME.y + HOME.r * Math.sin(4 * Math.PI / 5)),
      C: point(HOME.x + HOME.r * Math.cos(Math.PI / 5), HOME.y + HOME.r * Math.sin(Math.PI / 5)),
      options: {
        names: o.names === undefined ? true : !!o.names,
        statement: !!o.statement,
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

  /** Circumcentre from two perpendicular bisectors, and the applet's radius
   * (the mean of the three centre-to-vertex distances). */
  function circumcircle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = lineIntersection(
      m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
      m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)),
    );
    if (!o) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return { c: o, r: r };
  }

  /** A second point on the ray from v along the bisector of the angle at v. */
  function bisectorPoint(v, p, q) {
    return add(v, add(unit(sub(p, v)), unit(sub(q, v))));
  }

  /** The other place that the line v->towards meets the circle. */
  function secondOnCircle(v, towards, circle) {
    const d = unit(sub(towards, v));
    const t = -2 * dot(sub(v, circle.c), d);
    if (!Number.isFinite(t)) return null;
    return add(v, mul(d, t));
  }

  /** All the points of the drawing, from three triangle vertices. */
  function compute(a, b, c) {
    const circle = circumcircle(a, b, c);
    if (!circle || !(circle.r > 1e-9)) return null;

    const D = secondOnCircle(a, bisectorPoint(a, b, c), circle);
    const E = secondOnCircle(b, bisectorPoint(b, a, c), circle);
    const F = secondOnCircle(c, bisectorPoint(c, a, b), circle);
    if (!D || !E || !F) return null;

    // Incenter: side-length-weighted average of the vertices.  It is also
    // AD ∩ BE, which the logic test checks against the applet's construction.
    const la = dist(b, c), lb = dist(a, c), lc = dist(a, b);
    const sum = la + lb + lc;
    const I = point((la * a.x + lb * b.x + lc * c.x) / sum,
                    (la * a.y + lb * b.y + lc * c.y) / sum);
    const M = lineIntersection(E, F, a, D);
    if (!M) return null;

    return {
      circle: circle, A: a, B: b, C: c, D: D, E: E, F: F, I: I, M: M,
      angles: { A: angle(a, b, c), B: angle(b, a, c), C: angle(c, a, b) },
      sides: { a: la, b: lb, c: lc },
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C);
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** What the status line says.  The hint is the article's angle chase. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the three points make a triangle.";
    if (state.options.hint) {
      const halfB = g.angles.B * DEG / 2;
      const sumAC = (g.angles.A + g.angles.C) * DEG / 2;
      return `∠IFM = ∠CFE = ∠CBE = B/2 = ${halfB.toFixed(1)}°; `
        + `∠FIM = A/2 + C/2 = ${sumAC.toFixed(1)}°; so the angle at M is 90°.`;
    }
    if (state.options.statement) {
      return "AD is perpendicular to EF: all four angles at M are right angles.";
    }
    return "The bisectors meet the circle at D, E and F, and each one cuts an arc in half.";
  }

  return {
    VIEW: VIEW, HOME: HOME, DEG: DEG,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, unit: unit, angle: angle,
    distanceToLine: distanceToLine, lineIntersection: lineIntersection, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    circumcircle: circumcircle, bisectorPoint: bisectorPoint,
    secondOnCircle: secondOnCircle, compute: compute, geometry: geometry,
    result: result, describe: describe,
  };
})();
