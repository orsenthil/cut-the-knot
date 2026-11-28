"use strict";

/*
 * Many Circles — Alexander Bogomolny's illustration of a polygon inscribed in
 * several circles that all meet at one point O.  Number the circles from the
 * rightmost one.  Circle i meets circle i+1 again at P_i.  Starting with a
 * point on circle 0, draw the line through P_i to meet circle i+1 at the next
 * vertex; after going round, the last line arrives back at the first point.
 *
 * The construction, its integers and its "other intersection" test are taken
 * from the Java applet ManyCircles (ManyCirclesCanvas and GeoSDoub).  The
 * common point is the middle of the canvas, the starting circles have radius
 * 24% of the shorter side and their centres are placed at equal angles with
 * whole-number coordinates, exactly as Reset does in the bytecode.  Dragging
 * a vertex keeps it on its circle; dragging a centre keeps that vertex at the
 * same angle from its (new) centre.  Both then rebuild the chain from the
 * handle that moved.  Centres are kept on the board and at least 12 units
 * from O so that no circle collapses; the applet had no such guard.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, ManyCirclesCore, so the page loads it with
 * a plain <script> and porting/check-many-circles.mjs can load it in Node.
 * Positions are plain objects in the SVG's viewBox coordinates.
 */

const ManyCirclesCore = (() => {
  const VIEW = Object.freeze({ width: 400, height: 250 });
  const O = Object.freeze({ x: VIEW.width / 2, y: VIEW.height / 2 });
  const RADIUS = Math.floor(Math.min(VIEW.width, VIEW.height) * 24 / 100); // 60
  const MIN_N = 3;
  const MAX_N = 10;
  const MIN_CENTER_RADIUS = 12;

  const P = (x, y) => ({ x: x, y: y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pointOn = (c, r, a) => P(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* GeoSDoub.IntersectCirclesX: solve the radical-axis line y = k*x + c. */
  function circlesX(a, b) {
    const k = -(a.c.y - b.c.y) / (a.c.x - b.c.x);
    const c = (a.c.x * a.c.x - b.c.x * b.c.x + a.c.y * a.c.y - b.c.y * b.c.y -
      a.r * a.r + b.r * b.r) / (2 * (a.c.x - b.c.x));
    const h = c - a.c.x;
    const aa = 1 + k * k;
    const cc = k * h - a.c.y;
    const dd = h * h + a.c.y * a.c.y - a.r * a.r;
    const disc = cc * cc - aa * dd;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-cc + root) / aa;
    const t2 = (-cc - root) / aa;
    return [P(k * t1 + c, t1), P(k * t2 + c, t2)];
  }

  /* GeoSDoub.IntersectCirclesY: the same, with x = k*y + c. */
  function circlesY(a, b) {
    const k = -(a.c.x - b.c.x) / (a.c.y - b.c.y);
    const c = (a.c.y * a.c.y - b.c.y * b.c.y + a.c.x * a.c.x - b.c.x * b.c.x -
      a.r * a.r + b.r * b.r) / (2 * (a.c.y - b.c.y));
    const h = c - a.c.y;
    const aa = 1 + k * k;
    const cc = k * h - a.c.x;
    const dd = h * h + a.c.x * a.c.x - a.r * a.r;
    const disc = cc * cc - aa * dd;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-cc + root) / aa;
    const t2 = (-cc - root) / aa;
    return [P(t1, k * t1 + c), P(t2, k * t2 + c)];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle): its one-unit axis test. */
  function circleCircle(a, b) {
    if (Math.abs(a.c.x - b.c.x) > 1) return circlesX(a, b);
    if (Math.abs(a.c.y - b.c.y) > 1) return circlesY(a, b);
    return [P(a.c.x, a.c.y), P(a.c.x, a.c.y)];
  }

  /* GeoSDoub.IntersectX(DoubLine, DoubCircle): line x = k*y + b. */
  function lineX(v, w, c) {
    const k = (v.x - w.x) / (v.y - w.y);
    const b = w.x - k * w.y;
    const aa = 1 + k * k;
    const cc = k * (b - c.c.x) - c.c.y;
    const dd = c.c.y * c.c.y + (b - c.c.x) * (b - c.c.x) - c.r * c.r;
    const disc = cc * cc - aa * dd;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-cc + root) / aa;
    const t2 = (-cc - root) / aa;
    return [P(k * t1 + b, t1), P(k * t2 + b, t2)];
  }

  /* GeoSDoub.IntersectY(DoubLine, DoubCircle): line y = k*x + b. */
  function lineY(v, w, c) {
    const k = (v.y - w.y) / (v.x - w.x);
    const b = w.y - k * w.x;
    const aa = 1 + k * k;
    const cc = k * (b - c.c.y) - c.c.x;
    const dd = c.c.x * c.c.x + (b - c.c.y) * (b - c.c.y) - c.r * c.r;
    const disc = cc * cc - aa * dd;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-cc + root) / aa;
    const t2 = (-cc - root) / aa;
    return [P(t1, k * t1 + b), P(t2, k * t2 + b)];
  }

  /** GeoSDoub.Intersect(DoubLine, DoubCircle): null for a tiny line. */
  function lineCircle(v, w, c) {
    if (Math.abs(v.y - w.y) > 1) return lineX(v, w, c);
    if (Math.abs(v.x - w.x) > 1) return lineY(v, w, c);
    return null;
  }

  /* ManyCirclesCanvas.Other: the point at least one unit away.  The applet's
   * one-unit test is kept deliberately; it is why the chain can jump when a
   * vertex is within a unit of a crossing (see "Look for the math"). */
  function other(pts, ref) {
    if (!pts || !pts.length) return null;
    if (dist(pts[0], ref) < 1) return pts[1] || pts[0];
    return pts[0];
  }

  /** The mathematically right choice: the farther of the two crossings. */
  function farther(pts, ref) {
    if (!pts || !pts.length) return null;
    if (pts.length < 2) return pts[0];
    return dist(pts[0], ref) >= dist(pts[1], ref) ? pts[0] : pts[1];
  }

  /** ManyCirclesCanvas.FormIntersects. */
  function formIntersects(circles, common, pick) {
    const n = circles.length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = pick(circleCircle(circles[i], circles[(i + 1) % n]), common);
      out[i] = q || P(common.x, common.y);
    }
    return out;
  }

  /** ManyCirclesCanvas.PropagateVertices(start): Java's exception catch
   *  leaves every vertex after a failed intersection where it was. */
  function propagate(vertices, intersections, circles, start, pick) {
    const n = circles.length;
    const out = vertices.slice();
    if (start < 0 || start >= n || !finite(out[start])) return out;
    for (let k = 0; k < n; k++) {
      const i = (k + start) % n;
      const j = (i + 1) % n;
      const q = pick(lineCircle(out[i], intersections[i], circles[j]), intersections[i]);
      if (!q || !finite(q)) break;
      out[j] = P(q.x, q.y);
    }
    return out;
  }

  /** The signed angle the applet stores at a centre, from +x to the vertex. */
  function angleAt(center, vertex) {
    return Math.atan2(vertex.y - center.y, vertex.x - center.x);
  }

  /** The applet's Reset: whole-number centres on a 24%-of-min-side circle. */
  function fresh(options) {
    const o = options || {};
    const n = clamp(Math.trunc(Number.isFinite(o.n) ? o.n : MIN_N), MIN_N, MAX_N);
    const common = finite(o.common) ? P(o.common.x, o.common.y) : P(O.x, O.y);
    const angle = Number.isFinite(o.angle) ? o.angle : Math.random() * Math.PI;
    // The bytecode forms the step once and multiplies by i; keeping that
    // order matters because a rounded cosine decides a whole-number centre.
    const step = 2 * Math.PI / n;
    const centers = [];
    for (let i = 0; i < n; i++) {
      const a = step * i;
      centers.push(P(Math.trunc(common.x + RADIUS * Math.cos(a)),
        Math.trunc(common.y + RADIUS * Math.sin(a))));
    }
    const circles = centers.map((c) => ({ c: c, r: dist(c, common) }));
    const first = new Array(n);
    first[0] = pointOn(centers[0], circles[0].r, angle);
    const intersections = formIntersects(circles, common, other);
    const vertices = propagate(first, intersections, circles, 0, other);
    const angles = vertices.map((v, i) => angleAt(centers[i], v));
    return {
      n: n, common: common, angle: angle,
      centers: centers, circles: circles,
      vertices: vertices, intersections: intersections, angles: angles,
      explored: false,
    };
  }

  function start(options) {
    return fresh(options || {});
  }

  function reset(state) {
    const s = fresh({ n: state.n, common: state.common });
    s.explored = !!state.explored;
    return s;
  }

  /** The spinner's 3..10 range; changing it calls Reset in the applet. */
  function setCount(state, n) {
    const s = fresh({ n: n, common: state.common });
    s.explored = !!state.explored;
    return s;
  }

  function legalMoves(state) {
    const out = [];
    for (let i = 0; i < state.n; i++) out.push("v" + i, "c" + i);
    return out;
  }

  /** A centre stays on the board and its circle keeps a usable radius. */
  function projectCenter(state, p) {
    let q = P(clamp(p.x, 12, VIEW.width - 12), clamp(p.y, 12, VIEW.height - 12));
    const r = dist(q, state.common);
    if (r < MIN_CENTER_RADIUS) {
      const a = r > 1e-9 ? Math.atan2(q.y - state.common.y, q.x - state.common.x) : 0;
      q = pointOn(state.common, MIN_CENTER_RADIUS, a);
    }
    return q;
  }

  /** Project onto a circle, as CTKMoveableDoub.STAY_ON_CIRCLE does. */
  function onCircle(center, radius, p) {
    if (!finite(p)) return pointOn(center, radius, 0);
    const d = dist(center, p);
    if (d < 1e-9) return pointOn(center, radius, 0);
    return P(center.x + (p.x - center.x) * radius / d,
      center.y + (p.y - center.y) * radius / d);
  }

  /** AdjustVertices: move one corner along its circle, then rebuild the chain. */
  function moveVertex(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n || !finite(p)) return state;
    const q = onCircle(state.centers[index], state.circles[index].r, p);
    const vertices = propagate([q].concat(state.vertices.slice(1)),
      state.intersections, state.circles, index, other);
    return Object.assign({}, state, {
      vertices: vertices,
      angles: vertices.map((v, i) => angleAt(state.centers[i], v)),
      angle: angleAt(state.centers[index], q),
      explored: true,
    });
  }

  /** AdjustCircles: change a radius, keep the corner's angle, rebuild all. */
  function moveCenter(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n || !finite(p)) return state;
    const center = projectCenter(state, p);
    const centers = state.centers.slice();
    centers[index] = center;
    const circles = centers.map((c) => ({ c: c, r: dist(c, state.common) }));
    const vertices = state.vertices.slice();
    vertices[index] = pointOn(center, circles[index].r, state.angles[index]);
    const intersections = formIntersects(circles, state.common, other);
    const chain = propagate(vertices, intersections, circles, index, other);
    return Object.assign({}, state, {
      centers: centers, circles: circles, vertices: chain,
      intersections: intersections,
      angles: chain.map((v, i) => angleAt(centers[i], v)),
      explored: true,
    });
  }

  /** An illustration: no win and no loss. */
  function result(state) {
    return null;
  }

  /** Re-walk the chain from the first corner; the gap is the closure error. */
  function closureError(state, pick) {
    const vertices = propagate(state.vertices, state.intersections, state.circles, 0, pick || other);
    return dist(vertices[0], state.vertices[0]);
  }

  function sides(state) {
    const out = [];
    for (let i = 0; i < state.n; i++) out.push(dist(state.vertices[i], state.vertices[(i + 1) % state.n]));
    return out;
  }

  /** A short spoken description, also used by the test. */
  function describe(state) {
    const gap = closureError(state);
    return state.n + " circles, " + sides(state).length + " sides. " +
      "The walk misses its start by " + gap.toFixed(2) + " units. " +
      "Drag a centre or a corner to change the figure.";
  }

  /** Plain data for the player's record and the tutor. */
  function position(state) {
    return {
      n: state.n,
      common: state.common,
      centers: state.centers.map((c) => P(c.x, c.y)),
      vertices: state.vertices.map((v) => P(v.x, v.y)),
      intersections: state.intersections.map((v) => P(v.x, v.y)),
      angles: state.angles.slice(),
      sides: sides(state),
      closureGap: closureError(state),
      explored: !!state.explored,
    };
  }

  return {
    VIEW: VIEW, O: O, RADIUS: RADIUS, MIN_N: MIN_N, MAX_N: MAX_N,
    MIN_CENTER_RADIUS: MIN_CENTER_RADIUS,
    start: start, reset: reset, setCount: setCount, legalMoves: legalMoves,
    moveVertex: moveVertex, moveCenter: moveCenter, result: result,
    projectCenter: projectCenter, onCircle: onCircle,
    closureError: closureError, sides: sides, describe: describe,
    position: position, dist: dist, other: other, farther: farther,
    formIntersects: formIntersects, propagate: propagate,
    circleCircle: circleCircle, lineCircle: lineCircle,
  };
})();
