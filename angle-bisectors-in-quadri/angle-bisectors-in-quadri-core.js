"use strict";

/*
 * Angle Bisectors in a Quadrilateral — Alexander Bogomolny's applet
 * AngleBisectorsInQuadri ("Cyclic and Otherwise").
 *
 * Drag the four corners of a quadrilateral.  X is where the bisectors of
 * angles CAD and CBD meet, Y is where the bisectors of ACB and ADB meet,
 * U = AX ∩ DY, V = BX ∩ CY and G = AC ∩ BD.  The old page claims that
 * U, G, V are always on one straight line, and that when ABCD is cyclic,
 * X and Y lie on its circumcircle.  It also gives a version without
 * cyclicity: X lies on the circumcircle of BCD exactly when A does, and
 * then Y lies there too.
 *
 * This file is the geometry and nothing else: no document, no window.  It
 * defines one global, AngleBisectorsInQuadriCore, so the page loads it with
 * a plain <script> and the logic test can load it in Node.  Positions and
 * results are plain data in the SVG's viewBox units.
 */

const AngleBisectorsInQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;

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
    return n > 0 ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** Angle at v between the rays v→p and v→q, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** A point on the internal bisector of the angle at v between p and q. */
  function bisectorPoint(v, p, q) {
    return add(v, unit(add(unit(sub(p, v)), unit(sub(q, v)))));
  }

  /** Intersection of the lines a-b and c-d, or null when they are parallel. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (!Number.isFinite(den) || Math.abs(den) < 1e-10) return null;
    const q = add(a, mul(r, cross(sub(c, a), s) / den));
    return Number.isFinite(q.x) && Number.isFinite(q.y) ? q : null;
  }

  /** Distance from p to the line through a and b. */
  function distanceToLine(p, a, b) {
    const n = dist(a, b);
    return n > 0 ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
  }

  /** The applet's circumcircle: FindCircumcenter, with its mean radius. */
  function circumcircle(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const o = intersect(
      ab, add(ab, point(b.y - a.y, a.x - b.x)),
      bc, add(bc, point(c.y - b.y, b.x - c.x)),
    );
    if (!o) return null;
    return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /** Keep a corner inside the board, with room for its label and handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* The applet's Reset() on its 400x300 canvas: A=(120,160), B=(280,240),
   * C=(320,80), D=(180,130).  All three "Show" checkboxes start unchecked. */
  function start(options) {
    const o = options || {};
    return {
      A: point(120, 160), B: point(280, 240), C: point(320, 80), D: point(180, 130),
      options: {
        angles: o.angles === undefined ? false : !!o.angles,
        names: o.names === undefined ? false : !!o.names,
        extra: o.extra === undefined ? false : !!o.extra,
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
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** True when p is strictly inside the triangle a,b,c (same side test). */
  function insideTriangle(p, a, b, c) {
    const s1 = cross(sub(b, a), sub(p, a));
    const s2 = cross(sub(c, b), sub(p, b));
    const s3 = cross(sub(a, c), sub(p, c));
    return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
  }

  function onBisector(vertex, first, second, target) {
    const a = angle(vertex, first, target);
    const b = angle(vertex, target, second);
    return Number.isFinite(a) && Number.isFinite(b)
      && Math.abs(a - b) < 1e-7 * Math.max(1, a + b);
  }

  /**
   * Every point of the drawing, from the four corners.  Returns null when a
   * quadrilateral is too flat to define the construction (parallel bisectors
   * or collinear diagonal endpoints).
   */
  function compute(a, b, c, d) {
    if (![a, b, c, d].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    if (dist(a, b) < 1e-9 || dist(b, c) < 1e-9 || dist(c, d) < 1e-9 || dist(a, d) < 1e-9) return null;

    // The four angles in the page's statement: CAD, CBD at A and B,
    // ACB, ADB at C and D.
    const X = intersect(a, bisectorPoint(a, d, c), b, bisectorPoint(b, d, c));
    const Y = intersect(c, bisectorPoint(c, a, b), d, bisectorPoint(d, a, b));
    if (!X || !Y) return null;
    const U = intersect(a, X, d, Y);
    const V = intersect(b, X, c, Y);
    const G = intersect(a, c, b, d);
    const circle = circumcircle(a, b, c);
    if (!U || !V || !G || !circle || !(circle.r > 1e-9)) return null;

    const scale = Math.max(1, dist(a, c), dist(b, d), dist(a, b), dist(b, c));
    const tol = 1e-6 * scale;

    // The collinearity claim, measured as a distance perpendicular to UV.
    const collinearError = distanceToLine(G, U, V);

    // The circle through B, C, D: the generalised claim uses it.
    const circleBCD = circumcircle(b, c, d);
    const onCircle = (p, cc) => (cc ? Math.abs(dist(p, cc.c) - cc.r) : Infinity);
    const onBCD = (p) => onCircle(p, circleBCD);

    // GU and GV bisect a pair of vertical angles, so their unit directions
    // must be opposite (and their cross product zero).
    const gu = unit(sub(U, G)), gv = unit(sub(V, G));
    const opposite = Math.abs(cross(gu, gv)) < 1e-7 && dot(gu, gv) < -0.999999;

    const cyclicError = onCircle(d, circle);
    const claims = {
      collinear: collinearError <= tol,
      bisectedAtA: onBisector(a, d, c, X),
      bisectedAtB: onBisector(b, d, c, X),
      bisectedAtC: onBisector(c, a, b, Y),
      bisectedAtD: onBisector(d, a, b, Y),
      uIncenter: onBisector(a, d, G, U) && onBisector(d, a, G, U) && insideTriangle(U, a, d, G),
      vIncenter: onBisector(b, c, G, V) && onBisector(c, b, G, V) && insideTriangle(V, b, c, G),
      verticalAngles: opposite,
      cyclic: cyclicError <= tol,
      // The circle claims are implications: they only apply when the
      // quadrilateral is cyclic (or when X is on the circle through B,C,D).
      cyclicImpliesXOnCircle: cyclicError > tol || onCircle(X, circle) <= tol,
      cyclicImpliesYOnCircle: cyclicError > tol || onCircle(Y, circle) <= tol,
      cyclicImpliesArcMidpoints: cyclicError > tol
        || (Math.abs(dist(X, c) - dist(X, d)) <= tol
          && Math.abs(dist(Y, a) - dist(Y, b)) <= tol),
      generalized: onBCD(X) <= tol ? onBCD(a) <= tol && onBCD(Y) <= tol
        : onBCD(a) > tol,
    };

    return {
      A: a, B: b, C: c, D: d, X: X, Y: Y, U: U, V: V, G: G,
      circle: circle, circleBCD: circleBCD,
      appletCyclic: Math.abs(dist(d, circle.c) - circle.r) < 1,
      measures: {
        collinearError: collinearError,
        cyclicError: cyclicError,
        xCircleError: onCircle(X, circle),
        yCircleError: onCircle(Y, circle),
        aCircleBCD: onBCD(a),
        xCircleBCD: onBCD(X),
        yCircleBCD: onBCD(Y),
      },
      claims: claims,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* This is an illustration, not a game: no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a quadrilateral.";
    const m = g.measures;
    const line = `U, G and V are on one straight line (off by ${m.collinearError.toFixed(2)} in the drawing).`;
    if (g.appletCyclic) {
      return line + " ABCD is cyclic, so X and Y lie on its circumcircle.";
    }
    if (m.cyclicError < 2) {
      return line + " ABCD is almost cyclic: X and Y are close to the circle through A, B and C.";
    }
    return line + " Drag a corner: the line stays straight.";
  }

  return {
    VIEW: VIEW, PAD: PAD,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, unit: unit, angle: angle,
    bisectorPoint: bisectorPoint, intersect: intersect,
    distanceToLine: distanceToLine, circumcircle: circumcircle, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
