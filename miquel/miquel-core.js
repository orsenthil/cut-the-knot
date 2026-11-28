"use strict";

/*
 * Miquel — Alexander Bogomolny's applet Miquel (a Mathematical Droodle).
 *
 * A triangle has a draggable point on each side line, the line extended if
 * needed. The three circles through a corner and the two side points on the
 * sides meeting at that corner always have a second common point P: the
 * Miquel point (the Pivot Theorem). When the three side points are collinear,
 * P also lies on the triangle's circumcircle — the Miquel point of a 4-line.
 *
 * The code is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MiquelCore, so the page loads it with a
 * plain <script> and porting/check-miquel.mjs can load it in Node.
 *
 * Two applet details are kept. Side points are held on their side line by
 * orthogonal projection, not snapped to the segment: Reset calls
 * RestrictToSegment(false), so points may sit on a side's extension. Moving
 * a corner keeps each side point at the same fraction t along its line, the
 * applet's DoubLine.m_T. The position is plain data: three vertices and three
 * t values, so it can be saved and handed to the tutor as it is.
 */
const MiquelCore = (() => {
  /* The Wayback copy of the applet page embeds it at 480x300. */
  const VIEW = { x: 0, y: 0, width: 480, height: 300 };
  const PAD = 12;              // room for the handles and their labels
  const COL_TOL = 1;           // DrawSimson calls points collinear within 1 unit

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /* Java's integer division in RandomPoint: 5*width/7 with width=480 is 342. */
  const jdiv = (a, b) => Math.trunc(a / b);
  const HOME = [
    point(jdiv(VIEW.width, 3), jdiv(3 * VIEW.height, 5)),
    point(jdiv(5 * VIEW.width, 7), jdiv(3 * VIEW.height, 5)),
    point(jdiv(VIEW.width, 2), jdiv(VIEW.height, 7)),
  ];

  function clampPoint(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* DoubLine.CreateMidPoint / UpdateEndPoints: t is measured from a to b. */
  function pointAt(a, b, t) {
    return point(a.x * t + b.x * (1 - t), a.y * t + b.y * (1 - t));
  }

  /* DoubLine.UpdateMidPoint, with RestrictToSegment(false): no clamping. */
  function parameterOnLine(p, a, b) {
    const u = sub(a, b);
    const len2 = dot(u, u);
    if (!Number.isFinite(len2) || len2 < 1e-18) return null;
    return -dot(u, sub(b, p)) / len2;
  }

  /** The side line i: 0 is V1V2, 1 is V0V2, 2 is V0V1, as in the applet. */
  const ends = (v, i) => (i === 0 ? [v[1], v[2]] : i === 1 ? [v[0], v[2]] : [v[0], v[1]]);

  /** The state a new drawing starts from; t is random just as Math.random() is. */
  function start(options) {
    const o = options || {};
    const vertices = (o.vertices || HOME).map((p) => point(p.x, p.y));
    const ts = o.t || [Math.random(), Math.random(), Math.random()];
    return { vertices: vertices, t: [ts[0], ts[1], ts[2]], explored: false };
  }

  /** Reset restores the applet's triangle and picks fresh random side points. */
  function reset(state) {
    const s = start({});
    s.explored = !!(state && state.explored);
    return s;
  }

  /** The three marked points, on their side lines (possibly on extensions). */
  function sidePoints(state) {
    const v = state.vertices;
    return [pointAt(v[1], v[2], state.t[0]),
            pointAt(v[0], v[2], state.t[1]),
            pointAt(v[0], v[1], state.t[2])];
  }

  /** Dragging a corner keeps t, exactly like DoubLine.UpdateEndPoints. */
  function moveVertex(state, i, p) {
    if (!Number.isInteger(i) || i < 0 || i > 2 || !p) return state;
    const v = state.vertices.slice();
    v[i] = clampPoint(point(p.x, p.y));
    return { vertices: v, t: state.t.slice(), explored: true };
  }

  /** Dragging a side point projects it onto its side line, extensions included. */
  function moveSidePoint(state, i, p) {
    if (!Number.isInteger(i) || i < 0 || i > 2 || !p) return state;
    const e = ends(state.vertices, i);
    const t = parameterOnLine(point(p.x, p.y), e[0], e[1]);
    if (t === null) return state;
    const ts = state.t.slice();
    ts[i] = t;
    return { vertices: state.vertices.slice(), t: ts, explored: true };
  }

  /** Put the three side points on one transversal through the centroid. */
  function makeCollinear(state) {
    const v = state.vertices;
    const g = mul(add(add(v[0], v[1]), v[2]), 1 / 3);
    let d = null;
    for (let k = 0; k < 24 && !d; k++) {
      const a = Math.PI * (0.12 + k * 0.137);
      const q = point(Math.cos(a), Math.sin(a));
      if ([ends(v, 0), ends(v, 1), ends(v, 2)].every((e) =>
          Math.abs(cross(q, sub(e[1], e[0]))) / dist(e[1], e[0]) > 0.25)) d = q;
    }
    if (!d) return state;
    const ts = state.t.slice();
    for (let i = 0; i < 3; i++) {
      const e = ends(v, i);
      const q = lineIntersection(g, add(g, d), e[0], e[1]);
      if (!q) return state;
      const t = parameterOnLine(q, e[0], e[1]);
      if (t === null) return state;
      ts[i] = t;
    }
    return { vertices: v.slice(), t: ts, explored: true };
  }

  /** Intersection of two lines, with the applet's tolerance for parallel lines. */
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (!Number.isFinite(den) || Math.abs(den) < 1e-12) return null;
    const t = cross(sub(c, a), s) / den;
    return add(a, mul(r, t));
  }

  /** Circumcircle from the two perpendicular bisectors; radius from V (not the mean). */
  function circumcircle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = lineIntersection(m1, point(m1.x + (b.y - a.y), m1.y - (b.x - a.x)),
                               m2, point(m2.x + (c.y - b.y), m2.y - (c.x - b.x)));
    if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
    const r = dist(o, a);
    if (!Number.isFinite(r) || r < 1e-9) return null;
    return { c: o, r: r };
  }

  /** The two meetings of two circles (standard radical-axis computation). */
  function circleIntersection(a, b) {
    const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
    const d = Math.hypot(dx, dy);
    if (!d || d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
    const t = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
    const h2 = a.r * a.r - t * t;
    if (h2 < 0) return [];
    const h = Math.sqrt(h2);
    const base = point(a.c.x + (dx * t) / d, a.c.y + (dy * t) / d);
    if (h < 1e-10) return [base];
    return [point(base.x - (dy * h) / d, base.y + (dx * h) / d),
            point(base.x + (dy * h) / d, base.y - (dx * h) / d)];
  }

  /** Other(points, reference): the meeting that is not the shared side point. */
  function other(points, reference) {
    if (points.length === 0) return null;
    if (points.length === 1) return points[0];
    return dist(points[0], reference) < 1 ? points[1] : points[0];
  }

  function distanceToLine(p, a, b) {
    if (dist(a, p) < Math.sqrt(0.1)) return 0; // GeoSDoub's near-endpoint case
    const u = sub(b, a), n = Math.hypot(u.x, u.y);
    return n ? Math.abs(cross(sub(p, a), u)) / n : dist(p, a);
  }

  /** DrawSimson's three attempts, in the applet's order, with its 1-unit test. */
  function collinearity(m) {
    const pairs = [[1, 2, 0], [0, 2, 1], [0, 1, 2]];
    const distances = pairs.map(([i, j, k]) => distanceToLine(m[k], m[i], m[j]));
    for (let n = 0; n < 3; n++) {
      if (distances[n] < COL_TOL) {
        return { collinear: true, pair: pairs[n].slice(0, 2), distance: distances[n] };
      }
    }
    return { collinear: false, pair: null, distance: Math.min.apply(null, distances) };
  }

  /** All the objects on the board, in board units. */
  function geometry(state) {
    const v = state.vertices, m = sidePoints(state);
    const c0 = circumcircle(v[0], m[1], m[2]);   // corner V0, sides V0V2 and V0V1
    const c1 = circumcircle(v[1], m[0], m[2]);   // corner V1, sides V1V2 and V0V1
    const c2 = circumcircle(v[2], m[0], m[1]);   // corner V2, sides V1V2 and V0V2
    if (!c0 || !c1 || !c2) return null;
    const p = other(circleIntersection(c0, c1), m[2]);
    if (!p) return null;
    const circum = circumcircle(v[0], v[1], v[2]);
    const simson = collinearity(m);
    return {
      vertices: v, side: m, circles: [c0, c1, c2], point: p,
      circum: circum,
      circumGap: circum ? dist(circum.c, p) - circum.r : null,
      simson: simson,
    };
  }

  /* An illustration, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a point until the three circles can be drawn.";
    if (g.simson.collinear) {
      return "The three marked points line up: the triangle's circumcircle and the orange line share the same Miquel point.";
    }
    return "Try making the \"midpoints\" collinear. The three circles already share the Miquel point.";
  }

  return {
    VIEW: VIEW, HOME: HOME, PAD: PAD, COL_TOL: COL_TOL,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, clampPoint: clampPoint,
    pointAt: pointAt, parameterOnLine: parameterOnLine, ends: ends,
    start: start, reset: reset, sidePoints: sidePoints,
    moveVertex: moveVertex, moveSidePoint: moveSidePoint, makeCollinear: makeCollinear,
    lineIntersection: lineIntersection, circumcircle: circumcircle,
    circleIntersection: circleIntersection, other: other,
    distanceToLine: distanceToLine, collinearity: collinearity,
    geometry: geometry, result: result, describe: describe,
  };
})();
