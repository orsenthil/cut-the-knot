"use strict";

/*
 * Brianchon — Alexander Bogomolny's applet of the theorem dual to Pascal's.
 *
 * Six dots sit on a circle. The line through each dot perpendicular to its
 * radius is the tangent there; two neighbouring tangents meet at a vertex of
 * a hexagon that circumscribes the circle. The three diagonals joining
 * opposite vertices of that hexagon always pass through one point. Nothing is
 * won or lost: the page is an illustration with draggable points.
 *
 * The one idea the code relies on is the applet's own construction:
 *   - the circle is the circumcircle of the first, third and fifth dots,
 *     with its radius taken as the average of the three distances to them;
 *   - the tangent at P is the line through P and P + (-(P.y - O.y), P.x - O.x);
 *   - vertices are intersections of consecutive tangents, and the diagonals
 *     are the joins V0V3, V1V4 and V2V5.
 * GeoSDoub.Intersect returns (NaN, NaN) when its determinant is below 1, so
 * this file does too: a near-parallel pair leaves no usable vertex.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BrianchonCore, so the page loads it with a plain
 * <script> and porting/check-brianchon.mjs loads it in Node. The position is
 * plain data and every function returns new objects; nothing passed in is
 * changed.
 */
const BrianchonCore = (() => {
  const NAMES = ["A", "B", "C", "D", "E", "F"];
  // Brianchon.getParameterInfo calls these optimal; the archived page used 500x300.
  const WIDTH = 400;
  const HEIGHT = 250;
  // The applet's init(): six MoveablePoints at these angles on min(w,h)/4.
  const START_ANGLES = [0, 1.2, 2.5, 3.1, 4.9, 5.5];

  const EPS = 1e-9;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const isFinitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect of the lines p->q and r->s, straight from bytecode. */
  function intersectPoints(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** Intersect two DoubLines, each stored as the two points that define it. */
  function intersect(l1, l2) {
    return intersectPoints(l1.p, l1.q, l2.p, l2.q);
  }

  /**
   * BrianchonCanvas.GetCircle: circumcentre of the first three given dots and
   * the mean of its three distances to them. The applet only calls it once,
   * with A, C and E; after that the six dots glide on this same circle.
   */
  function circumcircle(A, C, E) {
    const m1 = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
    const m2 = { x: (C.x + E.x) / 2, y: (C.y + E.y) / 2 };
    const u1 = { x: m1.x + (C.y - A.y), y: m1.y - (C.x - A.x) };
    const u2 = { x: m2.x + (E.y - C.y), y: m2.y - (E.x - C.x) };
    const center = intersectPoints(m1, u1, m2, u2);
    return { center, radius: (distance(center, A) + distance(center, C) + distance(center, E)) / 3 };
  }

  /** A point of the circle at an angle in radians (SVG's y points down). */
  function pointOnCircle(circle, angle) {
    return {
      x: circle.center.x + circle.radius * Math.cos(angle),
      y: circle.center.y + circle.radius * Math.sin(angle),
    };
  }

  /** Push a dragged point back onto the circle, as RestrictToCircle does. */
  function projectToCircle(p, circle) {
    const dx = p.x - circle.center.x, dy = p.y - circle.center.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || !Number.isFinite(d)) return pointOnCircle(circle, 0);
    return {
      x: circle.center.x + (dx * circle.radius) / d,
      y: circle.center.y + (dy * circle.radius) / d,
    };
  }

  /** BrianchonCanvas.GetTangent: a DoubLine through P, perpendicular to OP. */
  function tangent(p, circle) {
    return {
      p: p,
      q: { x: p.x - (p.y - circle.center.y), y: p.y + (p.x - circle.center.x) },
    };
  }

  /** The position a new diagram starts from. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      const pts = {};
      for (const name of NAMES) pts[name] = { x: o.points[name].x, y: o.points[name].y };
      return {
        width: o.width === undefined ? WIDTH : o.width,
        height: o.height === undefined ? HEIGHT : o.height,
        circle: o.circle ? { center: { ...o.circle.center }, radius: o.circle.radius }
          : circumcircle(pts.A, pts.C, pts.E),
        points: pts,
        addons: false,
        drawLong: false,
      };
    }
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const radius = Math.min(width, height) / 4;
    const center = { x: width / 2, y: height / 2 };
    const base = { center, radius };
    const pts = {};
    START_ANGLES.forEach((a, i) => { pts[NAMES[i]] = pointOnCircle(base, a); });
    return {
      width, height, circle: circumcircle(pts.A, pts.C, pts.E), points: pts,
      addons: false, drawLong: false,
    };
  }

  /** The six intersections of consecutive tangents: the hexagon's vertices. */
  function vertices(state) {
    const tangents = NAMES.map((n) => tangent(state.points[n], state.circle));
    return tangents.map((t, i) => intersect(t, tangents[(i + 1) % 6]));
  }

  /** The three major diagonals joining opposite hexagon vertices. */
  function diagonals(state) {
    const v = vertices(state);
    return [[v[0], v[3]], [v[1], v[4]], [v[2], v[5]]];
  }

  /** The red extra chords of the applet: opposite points of contact. */
  function chords(state) {
    const p = state.points;
    return [[p.A, p.D], [p.B, p.E], [p.C, p.F]];
  }

  /** Shortest distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const len = distance(a, b);
    if (len < EPS) return Infinity;
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  }

  /**
   * Where three lines meet, if they do: the first two intersections give a
   * point and `error` is how far that point is from the third line.
   */
  function concurrency(lines) {
    if (lines.length < 3 || !isFinitePoint(lines[0][0]) || !isFinitePoint(lines[1][0])) return null;
    const point = intersect({ p: lines[0][0], q: lines[0][1] }, { p: lines[1][0], q: lines[1][1] });
    if (!isFinitePoint(point)) return null;
    let error = 0;
    for (const [a, b] of lines) error = Math.max(error, distToLine(point, a, b));
    return { point, error };
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(state) {
    const V = vertices(state);
    const lines = diagonals(state);
    const scale = Math.max(4 * state.circle.radius, 1);
    return {
      circle: state.circle,
      points: state.points,
      vertices: V,
      diagonals: lines,
      chords: chords(state),
      finite: V.every(isFinitePoint),
      concurrent: concurrency(lines),
      tolerance: 1e-7 * scale,
    };
  }

  /** The claims on the applet's page, checked numerically at this diagram. */
  function claims(state) {
    const m = measurements(state);
    const o = m.circle.center, r = m.circle.radius, tol = m.tolerance;
    const onCircle = NAMES.every((n) => Math.abs(distance(m.points[n], o) - r) < tol);
    const tangentsTouch = NAMES.every((n) => {
      const p = m.points[n];
      const t = tangent(p, m.circle);
      const radial = { x: p.x - o.x, y: p.y - o.y };
      const along = { x: t.q.x - t.p.x, y: t.q.y - t.p.y };
      return Math.abs(radial.x * along.x + radial.y * along.y) < tol &&
        Math.abs(distToLine(o, t.p, t.q) - r) < tol;
    });
    const sidesTouch = m.finite && NAMES.every((n, i) =>
      Math.abs(distToLine(o, m.vertices[i], m.points[n]) - r) < tol &&
      Math.abs(distToLine(o, m.vertices[(i + 5) % 6], m.points[n]) - r) < tol);
    const majorDiagonals = Boolean(m.concurrent) && m.concurrent.error < tol;
    return { onCircle, tangentsTouch, sidesTouch, finiteVertices: m.finite, majorDiagonals };
  }

  /** The page's quadrilateral case: two pairs of points coalesce. */
  function quadrilateral(state) {
    const pts = {};
    for (const n of NAMES) pts[n] = { ...state.points[n] };
    pts.B = { ...pts.A };
    pts.E = { ...pts.D };
    const coalesced = { ...state, points: pts };
    const v = vertices(coalesced);
    // At a coalesced pair the two tangents coincide; in the limit their
    // vertex is simply the point of contact itself.
    v[0] = pts.A;
    v[3] = pts.D;
    const lines = [[v[0], v[3]], [v[1], v[4]], [v[2], v[5]]];
    return concurrency(lines);
  }

  /** A new position with one named dot moved (and held on the circle). */
  function withPoint(state, name, p) {
    if (!NAMES.includes(name)) return state;
    return {
      ...state,
      points: { ...state.points, [name]: projectToCircle(p, state.circle) },
    };
  }

  /** The applet's two checkboxes. */
  function withOptions(state, options) {
    return {
      ...state,
      addons: Boolean(options.addons === undefined ? state.addons : options.addons),
      drawLong: Boolean(options.drawLong === undefined ? state.drawLong : options.drawLong),
    };
  }

  /** An illustration has no winner. */
  function result(/* state */) {
    return null;
  }

  return {
    NAMES, WIDTH, HEIGHT, START_ANGLES, distance, isFinitePoint,
    intersectPoints, intersect, circumcircle, pointOnCircle, projectToCircle,
    tangent, start, vertices, diagonals, chords, distToLine, concurrency,
    measurements, claims, quadrilateral, withPoint, withOptions, result,
  };
})();
