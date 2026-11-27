"use strict";

/*
 * Circum Quadri — Alexander Bogomolny's applet CircumQuadri, "A Property of
 * Circumscribed Quadrilaterals".
 *
 * Four touch points A,B,C,D glide on one circle. The tangents there meet in
 * pairs at the corners P=t(A)&cap;t(B), Q=t(B)&cap;t(C), R=t(C)&cap;t(D) and
 * S=t(D)&cap;t(A) of a quadrilateral that wraps around the circle. The page
 * claims that its diagonals PR and QS and the lines joining the opposite
 * touch points AC and BD all pass through one point M. (On the page the
 * quadrilateral is ABCD and the touch points are E,F,G,H, so EG is our AC
 * and FH our BD.)
 *
 * The one idea the code relies on is the applet's own arithmetic, read from
 * its bytecode: GeoSDoub.FindCircumcenter and Intersect (which returns
 * (NaN, NaN) when |det| < 1), GetTangent, and a dragged point projected back
 * onto the circle as CTKMoveableDoub.RestrictToCircle does.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CircumQuadriCore, so the page loads it with
 * a plain <script> and porting/check-circum-quadri.mjs loads it in Node.
 * The position is plain data; nothing passed in is changed.
 */
const CircumQuadriCore = (() => {
  const NAMES = ["A", "B", "C", "D"];
  // The applet's getParameterInfo calls these optimal (the old page used 500x300).
  const WIDTH = 400;
  const HEIGHT = 250;
  // CircumQuadriCanvas.init(): angles 0, 1.2, 2.9, 4.5 on min(w,h)/4.
  // init also computes Math.random()*Math.PI into a local and never uses it;
  // a reproducible diagram starts at the four fixed angles instead.
  const START_ANGLES = [0, 1.2, 2.9, 4.5];

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
  function intersect(line1, line2) {
    return intersectPoints(line1.p, line1.q, line2.p, line2.q);
  }

  /*
   * The applet's |det| < 1 cut-off is a drawing guard, not a mathematical
   * parallel test: for a big board it refuses to draw corners that are
   * perfectly usable. The ratio claims below are about the exact lines, so
   * they use this unclipped intersection and return null only when the lines
   * really are parallel.
   */
  function intersectPrecise(line1, line2) {
    const [p, q] = line1, [r, s] = line2;
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /**
   * CircumQuadriCanvas.GetCircle: circumcentre of the first three touch
   * points and the mean of its three distances to them, via
   * GeoSDoub.FindCircumcenter. The applet only builds this circle once.
   */
  function circumcircle(A, B, C) {
    const m1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const m2 = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const u1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
    const u2 = { x: m2.x + (C.y - B.y), y: m2.y - (C.x - B.x) };
    const center = intersectPoints(m1, u1, m2, u2);
    return { center, radius: (distance(center, A) + distance(center, B) + distance(center, C)) / 3 };
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
    if (!isFinitePoint(p)) return null;
    const dx = p.x - circle.center.x, dy = p.y - circle.center.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || !Number.isFinite(d)) return pointOnCircle(circle, 0);
    return {
      x: circle.center.x + (dx * circle.radius) / d,
      y: circle.center.y + (dy * circle.radius) / d,
    };
  }

  /** CircumQuadriCanvas.GetTangent: a DoubLine through P, perpendicular to OP. */
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
          : circumcircle(pts.A, pts.B, pts.C),
        points: pts,
        checked: Boolean(o.checked),
      };
    }
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const base = { center: { x: width / 2, y: height / 2 }, radius: Math.min(width, height) / 4 };
    const pts = {};
    START_ANGLES.forEach((a, i) => { pts[NAMES[i]] = pointOnCircle(base, a); });
    return {
      width, height, circle: circumcircle(pts.A, pts.B, pts.C), points: pts,
      checked: false,
    };
  }

  /** The four corners made by neighbouring tangents, as in DrawConfiguration. */
  function vertices(state) {
    const tangents = NAMES.map((n) => tangent(state.points[n], state.circle));
    return tangents.map((t, i) => intersect(t, tangents[(i + 1) % 4]));
  }

  /** The red diagonals of the circumscribed quadrilateral. */
  function diagonals(state) {
    const v = vertices(state);
    return [[v[0], v[2]], [v[1], v[3]]];
  }

  /** The blue chords joining opposite touch points (EG and FH on the page). */
  function chords(state) {
    const p = state.points;
    return [[p.A, p.C], [p.B, p.D]];
  }

  /** The four sides of the quadrilateral, each touching one of the dots. */
  function sides(state) {
    const v = vertices(state);
    return [[v[3], v[0]], [v[0], v[1]], [v[1], v[2]], [v[2], v[3]]];
  }

  /** The light-grey half-sides the applet draws from each touch point. */
  function halfSides(state) {
    const v = vertices(state), p = state.points;
    return [
      [p.A, v[3]], [p.A, v[0]], [p.B, v[0]], [p.B, v[1]],
      [p.C, v[1]], [p.C, v[2]], [p.D, v[2]], [p.D, v[3]],
    ];
  }

  /** Shortest distance from p to the infinite line through a and b. */
  function distToLine(p, a, b) {
    const len = distance(a, b);
    if (len < EPS) return Infinity;
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  }

  /**
   * Where lines meet, if they do: the first two give a point, and `error` is
   * how far that point is from every other line. This is a measurement, not
   * the applet's drawing guard, so it uses the unclipped intersection.
   */
  function concurrency(lines) {
    if (lines.length < 2 || !isFinitePoint(lines[0][0]) || !isFinitePoint(lines[1][0])) return null;
    const point = intersectPrecise(lines[0], lines[1]);
    if (!point || !isFinitePoint(point)) return null;
    let error = 0;
    for (const [a, b] of lines) error = Math.max(error, distToLine(point, a, b));
    return { point, error };
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(state) {
    const v = vertices(state);
    const lines = diagonals(state).concat(chords(state));
    return {
      circle: state.circle,
      points: state.points,
      vertices: v,
      diagonals: diagonals(state),
      chords: chords(state),
      sides: sides(state),
      halfSides: halfSides(state),
      finite: v.every(isFinitePoint),
      concurrent: concurrency(lines),
      tolerance: 1e-7 * Math.max(1, 4 * state.circle.radius),
    };
  }

  /**
   * The page's exact claims, checked at this diagram. The last two are the
   * ratios from its proof: EG cuts AC in the ratio AE/CG, and FH cuts BD in
   * the ratio AH/CF (with our vertices and touch points renamed).
   */
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
    const sidesTouch = m.finite && m.sides.every(([a, b], i) =>
      Math.abs(distToLine(o, a, m.points[NAMES[i]]) - r) < tol &&
      Math.abs(distToLine(o, m.points[NAMES[i]], b) - r) < tol);
    const concurrent = Boolean(m.concurrent) && m.concurrent.error < tol;

    const ratio = (vertex1, vertex2, touch1, touch2, chord) => {
      const cut = intersectPrecise(chord, [vertex1, vertex2]);
      if (!cut || !isFinitePoint(cut)) return null;
      const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
      return near(distance(vertex1, cut) / distance(vertex2, cut),
        distance(vertex1, touch1) / distance(vertex2, touch2));
    };
    // Page AC = V3V1, EG = our AC, E = our A, G = our C.
    const splitsAC = m.finite && ratio(m.vertices[3], m.vertices[1], m.points.A, m.points.C, m.chords[0]);
    // Page BD = V0V2, FH = our BD, F = our B, H = our D.
    const splitsBD = m.finite && ratio(m.vertices[0], m.vertices[2], m.points.B, m.points.D, m.chords[1]);
    return { onCircle, tangentsTouch, sidesTouch, finiteVertices: m.finite, concurrent, splitsAC, splitsBD };
  }

  /** A new position with one named touch point moved (and held on the circle). */
  function move(state, name, p) {
    if (!NAMES.includes(name)) return state;
    const q = projectToCircle(p, state.circle);
    if (!q) return state;
    return { ...state, points: { ...state.points, [name]: q }, checked: false };
  }

  /** The player has pressed Check the theorem. */
  function check(state) {
    return state.checked ? state : { ...state, checked: true };
  }

  /** Back to the four starting touch points, with the check cleared. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /** An illustration has no winner. */
  function result(/* state */) {
    return null;
  }

  /** The status line, also read by the player's record. */
  function describe(state) {
    const m = measurements(state);
    if (!m.finite || !m.concurrent) {
      return "Two tangents are almost parallel. Move a dot away and check again.";
    }
    const holds = m.concurrent.error < m.tolerance;
    if (state.checked && holds) {
      return "The two diagonals and the two chords meet at one point, M — the theorem holds here.";
    }
    if (state.checked) return "The lines do not quite meet here. Drag a dot and check again.";
    return "Drag the four dots around the circle, then press Check the theorem.";
  }

  return {
    NAMES, WIDTH, HEIGHT, START_ANGLES, distance, isFinitePoint,
    intersectPoints, intersect, circumcircle, pointOnCircle, projectToCircle,
    tangent, start, vertices, diagonals, chords, sides, halfSides, distToLine,
    concurrency, measurements, claims, move, check, reset, result, describe,
  };
})();
