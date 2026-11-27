"use strict";

/*
 * Fuss — Alexander Bogomolny's applet "Fuss", from the cut-the-knot page
 * "Fuss' Theorem". An outer circle O(R) and an inner circle I(r), whose
 * centres are d apart, are chosen so that a closed quadrilateral can be drawn
 * with all four sides touching the inner circle and all four corners on the
 * outer one. Dragging the first corner A gives another member of the same
 * Poncelet family; the radius r is fixed by Fuss' relation
 *
 *     1/(R - d)^2 + 1/(R + d)^2 = 1/r^2.
 *
 * This file is only the geometry: no document, no window and no storage.  It
 * defines one global, FussCore, so a browser loads it with a plain <script>
 * and porting/check-fuss.mjs can load it in Node.  The position is plain data
 * and every function returns a new position.
 *
 * The construction follows FussCanvas.Compute(): solve the formula for r,
 * put I at (O.x + d, O.y), take the tangent from each corner to the inner
 * circle on the side chosen by GeoSDoub.FindOrientation, meet that tangent
 * with the outer circle again, and repeat four times.  The inner circle's
 * nearest points to the four sides are K, L, M, N; P is KM ∩ LN.
 */
const FussCore = (() => {
  const CENTER = { x: 200, y: 150 };
  const DEFAULT_RADIUS = 50;       // the applet: min(width/2, height/2)/3
  const DEFAULT_DISTANCE = 40;     // the applet's scrollbar starts at 40
  const DEFAULT_ANGLE = 0.65;      // the applet picks a random angle here
  const EPS = 1e-10;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The scrollbar maximum the applet sets on every Compute(): (int)(0.8R). */
  function maxDistance(radius) {
    return Math.floor(0.8 * radius);
  }

  /** Solve Fuss' relation for r: the applet's Compute() does exactly this. */
  function inradius(radius, d) {
    const sum = 1 / (radius + d) ** 2 + 1 / (radius - d) ** 2;
    return Math.sqrt(1 / sum);
  }

  /** Foot of the perpendicular from p to line ab (GeoSDoub.NearestPoint). */
  function foot(p, a, b) {
    const v = sub(b, a);
    const n = sqDist(a, p);
    if (n < 0.1) return point(p.x, p.y); // the applet's own short circuit
    const t = dot(sub(p, a), v) / dot(v, v);
    return add(a, mul(v, t));
  }

  /** GeoSDoub.Intersect of the two lines ab and cd. */
  function lineIntersection(a, b, c, d) {
    const x1 = a.y - b.y, x2 = b.x - a.x, x3 = a.x * b.y - a.y * b.x;
    const y1 = c.y - d.y, y2 = d.x - c.x, y3 = c.x * d.y - c.y * d.x;
    const den = x1 * y2 - y1 * x2;
    if (!Number.isFinite(den) || Math.abs(den) < 1) return null; // GeoSDoub's tolerance
    return point((x2 * y3 - y2 * x3) / den, (x3 * y1 - y3 * x1) / den);
  }

  /**
   * The tangent point from p to a circle, on the side chosen by the applet:
   * GeoSDoub.FindOrientation(p, T, I) must be positive.  The two tangent
   * points differ by the sign of the angle; the applet's circle-circle
   * intersection picks the "-" one.
   */
  function tangentFrom(p, circle) {
    const v = sub(circle.c, p);
    const len = Math.hypot(v.x, v.y);
    if (!(len > circle.r) || !Number.isFinite(len)) return null;
    const reach = Math.sqrt(len * len - circle.r * circle.r);
    const alpha = -Math.asin(circle.r / len);
    const u = mul(v, 1 / len);
    const rotated = point(u.x * Math.cos(alpha) - u.y * Math.sin(alpha),
                          u.x * Math.sin(alpha) + u.y * Math.cos(alpha));
    return add(p, mul(rotated, reach));
  }

  /** The second meeting of the line v->t with the circle centred at c. */
  function otherOnCircle(v, t, c) {
    const dir = sub(t, v);
    const s = -2 * dot(sub(v, c), dir) / dot(dir, dir);
    return add(v, mul(dir, s));
  }

  /** Keep a dragged point on the outer circle. */
  function onCircle(state, p) {
    const a = Math.atan2(p.y - state.center.y, p.x - state.center.x);
    return point(state.center.x + state.radius * Math.cos(a),
                 state.center.y + state.radius * Math.sin(a));
  }

  function start(options) {
    const o = options || {};
    const radius = o.radius === undefined ? DEFAULT_RADIUS : o.radius;
    const d = clamp(Math.round(o.d === undefined ? DEFAULT_DISTANCE : o.d), 0, maxDistance(radius));
    return {
      center: point(CENTER.x, CENTER.y),
      radius: radius,
      d: d,
      angle: o.angle === undefined ? DEFAULT_ANGLE : o.angle,
      names: !!o.names,
      diagonals: !!o.diagonals,
      explored: false,
    };
  }

  /** A new position after one change, or null for an unknown change. */
  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "point" && m.p) {
      const at = onCircle(state, m.p);
      next = Object.assign({}, state, {
        angle: Math.atan2(at.y - state.center.y, at.x - state.center.x),
      });
    } else if (m.type === "turn" && Number.isFinite(m.delta)) {
      next = Object.assign({}, state, { angle: state.angle + m.delta });
    } else if (m.type === "distance" && Number.isFinite(m.value)) {
      next = Object.assign({}, state, {
        d: clamp(Math.round(m.value), 0, maxDistance(state.radius)),
      });
    } else if (m.type === "option" && (m.name === "names" || m.name === "diagonals")) {
      next = Object.assign({}, state, { [m.name]: !!m.value });
    } else if (m.type === "reset") {
      next = start({
        radius: state.radius,
        d: state.d,
        angle: DEFAULT_ANGLE,
        names: state.names,
        diagonals: state.diagonals,
      });
    }
    if (!next) return null;
    next.explored = state.explored || m.type !== "option";
    return next;
  }

  function movePoint(state, p) { return move(state, { type: "point", p }); }
  function setDistance(state, value) { return move(state, { type: "distance", value }); }
  function setOption(state, name, value) { return move(state, { type: "option", name, value }); }
  function reset(state) { return move(state, { type: "reset" }); }

  /** The whole drawing, in the SVG's view-box units. */
  function geometry(state) {
    const radius = state.radius;
    const d = state.d;
    if (!(radius > 0) || d < 0 || d >= radius) return null;
    const r = inradius(radius, d);
    const outer = { c: state.center, r: radius };
    const inner = { c: point(state.center.x + d, state.center.y), r: r };
    const v = [point(state.center.x + radius * Math.cos(state.angle),
                     state.center.y + radius * Math.sin(state.angle))];
    const tangentPoints = [];
    for (let i = 0; i < 4; i++) {
      const t = tangentFrom(v[i], inner);
      if (!t) return null;
      tangentPoints.push(t);
      v.push(otherOnCircle(v[i], t, outer.c));
    }
    const vertices = v.slice(0, 4);
    const touch = [];
    for (let i = 0; i < 4; i++) touch.push(foot(inner.c, vertices[i], vertices[(i + 1) % 4]));
    const P = lineIntersection(touch[0], touch[2], touch[1], touch[3]);
    if (!P || !vertices.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    // One more tangent: the Poncelet quadrilateral closes on its first corner.
    const closing = otherOnCircle(vertices[3], tangentFrom(vertices[3], inner), outer.c);
    return {
      outer: outer,
      inner: inner,
      vertices: vertices,
      touch: touch,
      tangents: tangentPoints,
      P: P,
      closing: closing,
      closureError: dist(closing, vertices[0]),
      formulaSum: 1 / (radius - d) ** 2 + 1 / (radius + d) ** 2,
      inverseRSquared: 1 / (r * r),
    };
  }

  /** What the status line says in words, with the live numbers. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "This pair of circles cannot make a four-sided path.";
    const closed = g.closureError < 1e-6 ? "The four sides close back on A." : "The four sides do not close.";
    return "Outer radius " + state.radius + ", centre gap " + state.d +
      ", inner radius " + g.inner.r.toFixed(3) + ". " + closed +
      " Move A or the slider: the same relation keeps holding.";
  }

  /** A demo ends when the player has explored it; there is no win or loss. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    CENTER, DEFAULT_RADIUS, DEFAULT_DISTANCE, DEFAULT_ANGLE,
    maxDistance, inradius, onCircle, start, move, movePoint, setDistance,
    setOption, reset, geometry, describe, result,
    point, add, sub, mul, dot, dist, sqDist, foot, lineIntersection,
  };
})();
