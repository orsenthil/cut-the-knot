"use strict";

/*
 * Elkies — the Six Circles Theorem, from Bogomolny's applet Elkies.
 *
 * A triangle is cut by a line from a vertex to a point on the opposite side;
 * the two new triangles have "companion" incircles. Repeat the cut from the
 * next vertex, tangent to the circle just drawn, and the chain of incircles
 * closes after six steps: the seventh circle is the first one again.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, ElkiesCore, so the page loads it with a
 * plain <script> and porting/check-elkies.mjs loads it in Node. Positions are
 * plain data (numbers, arrays, plain objects) for the player's record.
 */
const ElkiesCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 20;
  const TA_DEFAULT = 0.7; // applet: m_Ta = 0.7, measured from A2 towards A1
  const TA_MIN = 0.02; // the applet allows 0 and 1; both make an incircle vanish
  const TA_MAX = 0.98;
  const ALL = 6; // applet: Which = 6 means "Show all circles"
  const PAIRS = 6;

  const point = (x, y) => ({ x: x, y: y });
  const add = (a, b) => point(a.x + b.x, a.y + b.y);
  const sub = (a, b) => point(a.x - b.x, a.y - b.y);
  const mul = (a, k) => point(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const unit = (a, b) => {
    const v = sub(b, a), d = Math.hypot(v.x, v.y) || 1;
    return mul(v, 1 / d);
  };

  /** +1 when the turn from a->b to a->c is positive (applet FindOrientation). */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** The angle at vertex p of the triangle p, q, r, in radians. */
  function angleAt(p, q, r) {
    return Math.acos(clamp(dot(unit(p, q), unit(p, r)), -1, 1));
  }

  /** The foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const v = sub(b, a), d = dot(v, v);
    return d === 0 ? a : add(a, mul(v, dot(sub(p, a), v) / d));
  }

  /** The incenter: side-length weights, the same point as two angle bisectors. */
  function incenter(a, b, c) {
    const la = distance(b, c), lb = distance(c, a), lc = distance(a, b);
    const sum = la + lb + lc;
    if (!Number.isFinite(sum) || sum === 0) return null;
    return point((a.x * la + b.x * lb + c.x * lc) / sum,
      (a.y * la + b.y * lb + c.y * lc) / sum);
  }

  /** The applet's incircle: its incenter and the mean distance to the sides. */
  function incircle(a, b, c) {
    const center = incenter(a, b, c);
    if (!center || !finite(center)) return null;
    const radius = (distance(center, foot(center, a, b)) +
      distance(center, foot(center, b, c)) +
      distance(center, foot(center, c, a))) / 3;
    if (!Number.isFinite(radius) || radius <= 1e-12) return null;
    return { center: center, radius: radius };
  }

  /** Where two lines meet; the applet returns NaN when the determinant is < 1. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), den = cross(r, s);
    if (!Number.isFinite(den) || Math.abs(den) < 1) return point(NaN, NaN);
    return add(a, mul(r, cross(sub(c, a), s) / den));
  }

  /**
   * The two points where a tangent from p touches the circle (p outside it).
   * Analytic form of the applet's Inversion.Tangent + GeoSDoub.Intersect. The
   * *order* matters: Tangents.SelectTangent always tests the midpoint of the
   * first line, and GeoSDoub.Intersect lists its two circle intersections in
   * an order that depends on which axis it eliminated. These are the same two
   * points; only the list order changes with the sign of that axis.
   */
  function tangentPoints(p, circle) {
    const v = sub(p, circle.center), d2 = dot(v, v), r2 = circle.radius * circle.radius;
    if (!(d2 > r2) || r2 <= 0) return null;
    const along = add(circle.center, mul(v, r2 / d2));
    const across = mul(point(-v.y, v.x), circle.radius * Math.sqrt(d2 - r2) / d2);
    const plus = add(along, across), minus = sub(along, across);
    const dx = circle.center.x - p.x, dy = circle.center.y - p.y;
    if (Math.abs(dx) > 1) return dx > 0 ? [minus, plus] : [plus, minus];
    if (Math.abs(dy) > 1) return dy > 0 ? [plus, minus] : [minus, plus];
    return [circle.center, circle.center]; // the applet's degenerate fallback
  }

  /**
   * The applet's GetExternalTangent: SelectTangent tests the midpoint of the
   * first tangent against the two *circle centres* (the zero-radius circle at
   * the third vertex and the incircle), with sign -orientation(third,i,l).
   */
  function tangentLine(third, circle, sign) {
    const touches = tangentPoints(third, circle);
    if (!touches) return null;
    const middle = point((touches[0].x + third.x) / 2, (touches[0].y + third.y) / 2);
    const pick = orientation(third, circle.center, middle) * sign > 0 ? 0 : 1;
    return [touches[pick], third];
  }

  /** The position a new diagram starts from. The applet ignores other options. */
  function start(options) {
    const width = WIDTH, height = HEIGHT;
    return {
      width: width, height: height,
      V: [point(width / 2, MARGIN), point(width / 8, height - MARGIN),
        point(7 * width / 8, 4 * height / 5)],
      ta: TA_DEFAULT, which: ALL,
    };
  }

  /** Reset() restores the three vertices and the 0.7 cut but keeps the choice. */
  function reset(state) {
    return { ...start(), which: state.which };
  }

  /** The movable point P on side A1A2 (V[1] to V[2]); ta is measured from A2. */
  function sidePoint(state) {
    const a = state.V[2], b = state.V[1];
    return add(a, mul(sub(b, a), state.ta));
  }

  /** Put P where the player dragged it: project onto A1A2 and clamp to it. */
  function setTa(state, q) {
    const a = state.V[2], v = sub(state.V[1], a), d = dot(v, v);
    if (d === 0) return state;
    const ta = clamp(dot(sub(q, a), v) / d, TA_MIN, TA_MAX);
    return ta === state.ta ? state : { ...state, ta: ta };
  }

  /** Move a vertex, keeping ta (the applet's UpdateP recreates P at the same t). */
  function setVertex(state, index, q) {
    if (!Number.isInteger(index) || index < 0 || index > 2) return state;
    const p = point(clamp(q.x, 2, state.width - 2), clamp(q.y, 2, state.height - 2));
    const V = state.V.slice();
    V[index] = p;
    return { ...state, V: V };
  }

  /** The applet's seven checkboxes: 0..5 select a neighbouring pair, 6 is all. */
  function setWhich(state, which) {
    const value = clamp(Math.round(Number(which)), 0, ALL);
    return Number.isFinite(value) ? { ...state, which: value } : state;
  }

  /**
   * The applet's ShowCircles: one incircle, then six companion incircles, each
   * found by drawing the tangent from the next vertex and cutting the opposite
   * side where that tangent crosses it. A degenerate step stops the chain.
   */
  function chain(state) {
    const V = state.V;
    let p = sidePoint(state);
    let first = incircle(V[0], p, V[1]);
    const circles = [], cuts = [];
    if (!first) return { circles: circles, cuts: cuts, closed: false };
    circles.push(first);

    let i = 0, j = 1;
    for (let k = 0; k < PAIRS; k++) {
      const l = 3 - i - j; // the third vertex: i + j + l = 3
      const next = incircle(V[i], V[l], p);
      if (!next) break;
      circles.push(next);
      const line = tangentLine(V[j], next, -orientation(V[j], V[i], V[l]));
      if (!line) break;
      const cut = intersect(V[i], V[l], line[0], line[1]);
      if (!finite(cut)) break;
      cuts.push({ from: V[i], to: V[l], at: cut });
      p = cut;
      i = j;
      j = l;
    }

    const last = circles[circles.length - 1];
    const closed = circles.length === PAIRS + 1 && last !== null &&
      Math.abs(last.radius - first.radius) < 1e-6 * Math.max(1, first.radius) &&
      distance(last.center, first.center) < 1e-6 * Math.max(1, first.radius);
    return { circles: circles, cuts: cuts, closed: closed };
  }

  /** Plain board-unit data for the player's record and the tutor. */
  function position(state) {
    const result = chain(state);
    return {
      V: state.V.map((p) => point(p.x, p.y)),
      P: sidePoint(state), ta: state.ta, which: state.which,
      circles: result.circles.map((c) => ({ center: point(c.center.x, c.center.y), radius: c.radius })),
      closed: result.closed,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, ALL: ALL, PAIRS: PAIRS,
    TA_MIN: TA_MIN, TA_MAX: TA_MAX, TA_DEFAULT: TA_DEFAULT,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    distance: distance, clamp: clamp, orientation: orientation, foot: foot, angleAt: angleAt,
    incenter: incenter, incircle: incircle, intersect: intersect,
    tangentPoints: tangentPoints, tangentLine: tangentLine,
    start: start, reset: reset, sidePoint: sidePoint, setTa: setTa,
    setVertex: setVertex, setWhich: setWhich, chain: chain, position: position,
  };
})();
