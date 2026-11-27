"use strict";

/*
 * Eves Extension, from Alexander Bogomolny's applet EvesExtension.
 *
 * EvesExtension draws a polygon whose sides touch a circle: the draggable blue
 * points are the points of tangency, one on the circle for every side. A start
 * point on the first side is carried once around the polygon by rotating it
 * about each corner through the corner's angle. For an even number of sides
 * the second lap lands on exactly the same points as the first, whatever the
 * start; for an odd number the two laps coincide only when the start is a point
 * of tangency. The reason is the alternating sum of the side lengths: two
 * tangents drawn from one corner to the circle are equal.
 *
 * This file is only the geometry: no document, no window, no storage. It
 * defines one global, EvesExtensionCore, so a page loads it with a plain
 * <script> and porting/check-eves-extension.mjs loads it in Node. Positions are
 * plain data in board units and every function returns a new object.
 */
const EvesExtensionCore = (() => {
  const N_MIN = 3;
  const N_MAX = 20;
  const N_DEFAULT = 5;

  const point = (x, y) => ({ x: x, y: y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const mul = (p, s) => point(p.x * s, p.y * s);
  const sqDist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const roundTo = (v, places) => {
    const k = Math.pow(10, places);
    return Math.round(v * k) / k;
  };

  /** GeoSDoub.Intersect: the applet calls a near-parallel pair "NaN". */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, a2 = b.x - a.x, a3 = a.x * b.y - a.y * b.x;
    const c1 = c.y - d.y, c2 = d.x - c.x, c3 = c.x * d.y - c.y * d.x;
    const denom = a1 * c2 - c1 * a2;
    if (Math.abs(denom) < 1) return point(NaN, NaN);
    return point((a2 * c3 - c2 * a3) / denom, (a3 * c1 - c3 * a1) / denom);
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = point((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = point((b.x + c.x) / 2, (b.y + c.y) / 2);
    const bis1 = point(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
    const bis2 = point(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
    return intersect(m1, bis1, m2, bis2);
  }

  /** GeoSDoub.ComputeSignedAngle: law of cosines, signed by FindOrientation. */
  function signedAngle(a, b, c) {
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > 0.99 && sqDist(a, b) === 0) return Math.PI;
    const orientation = c.x * (a.y - b.y) + c.y * (b.x - a.x) +
      a.x * b.y - b.x * a.y;
    return orientation > 0 ? angle : -angle;
  }

  /** GeoSDoub.Rotate(p about center by angle; sign 1 is the applet's choice). */
  function rotate(center, p, angle, sign) {
    const s = sign === undefined ? 1 : sign;
    const co = Math.cos(angle), si = Math.sin(angle) * s;
    const dx = p.x - center.x, dy = p.y - center.y;
    return point(center.x + co * dx - si * dy, center.y + si * dx + co * dy);
  }

  /** GeoSDoub.NearestPoint: the foot of the perpendicular, unless very close. */
  function nearest(p, a, b) {
    if (sqDist(a, p) < 0.1) return point(p.x, p.y);
    const d = sub(b, a);
    const t = (d.x * (p.x - a.x) + d.y * (p.y - a.y)) / sqDist(a, b);
    return add(a, mul(d, t));
  }

  /** The applet's circle: centre from the first three points, mean radius. */
  function circleFor(points) {
    const center = circumcenter(points[0], points[1], points[2]);
    const radius = (dist(center, points[0]) + dist(center, points[1]) +
      dist(center, points[2])) / 3;
    return { center: center, radius: radius };
  }

  /** EvesExtensionCanvas.GetTangent: through p, perpendicular to the radius. */
  function tangentAt(p, center) {
    return point(p.x - (p.y - center.y), p.y + (p.x - center.x));
  }

  /** A line is a pair of endpoints, as in the applet's DoubLine. */
  function linesAt(points, center) {
    return points.map((p) => [point(p.x, p.y), tangentAt(p, center)]);
  }

  /**
   * EvesExtensionCanvas.Compute, lifted out of the drawing code. The corners
   * are intersections of neighbouring lines; F[0] is the start projected onto
   * the first side; each next point is a rotation about the next corner. The
   * final rotation of V[0] in the applet has no destination and is discarded.
   */
  function rotationLoop(lines, start) {
    const n = lines.length;
    const V = [];
    for (let i = 0; i < n; i++) {
      V.push(intersect(lines[i][0], lines[i][1],
        lines[(i + 1) % n][0], lines[(i + 1) % n][1]));
    }
    const F = [nearest(start, V[0], V[1])];
    for (let i = 1; i < n; i++) {
      const next = (i + 1) % n;
      F.push(rotate(V[i], F[i - 1], signedAngle(V[i], V[i - 1], V[next])));
    }
    const G = [rotate(V[0], F[n - 1], signedAngle(V[0], V[n - 1], V[1]))];
    for (let i = 1; i < n; i++) {
      const next = (i + 1) % n;
      G.push(rotate(V[i], G[i - 1], signedAngle(V[i], V[i - 1], V[next])));
    }
    let gap = 0;
    for (let i = 0; i < n; i++) gap = Math.max(gap, dist(F[i], G[i]));
    return { V: V, F: F, G: G, gap: gap, firstGap: dist(F[0], G[0]) };
  }

  /** The polygon side lengths, and the alternating sum the page writes as (1). */
  function sideLengths(vertices) {
    const n = vertices.length;
    return vertices.map((v, i) => dist(v, vertices[(i + 1) % n]));
  }
  function alternatingSum(vertices) {
    return sideLengths(vertices).reduce((sum, s, i) =>
      sum + (i % 2 ? -s : s), 0);
  }

  /** A plain 2x2 line solve for the incircle test (no applet pixel threshold). */
  function solveLines(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 1e-12) return point(NaN, NaN);
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
    return add(a, mul(r, t));
  }

  /** Incenter from two interior bisectors, and the spread of its side distances. */
  function incenter(vertices) {
    const n = vertices.length;
    if (n < 3) return point(NaN, NaN);
    const unit = (a, b) => {
      const d = dist(a, b);
      return d > 0 ? point((b.x - a.x) / d, (b.y - a.y) / d) : point(0, 0);
    };
    const bisector = (i) => {
      const v = vertices[i];
      const prev = vertices[(i - 1 + n) % n], next = vertices[(i + 1) % n];
      const a = unit(v, prev), b = unit(v, next);
      return [v, add(v, point(a.x + b.x, a.y + b.y))];
    };
    return solveLines(bisector(0)[0], bisector(0)[1],
      bisector(1)[0], bisector(1)[1]);
  }
  function incircleError(vertices) {
    const c = incenter(vertices);
    if (!isFinite(c.x) || !isFinite(c.y)) return Infinity;
    const distances = vertices.map((v, i) => {
      const w = vertices[(i + 1) % vertices.length];
      const d = sub(w, v);
      return Math.abs(d.x * (c.y - v.y) - d.y * (c.x - v.x)) / dist(d, point(0, 0));
    });
    return Math.max.apply(null, distances) - Math.min.apply(null, distances);
  }
  function hasIncircle(vertices, tolerance) {
    return incircleError(vertices) <= (tolerance === undefined ? 1e-6 : tolerance);
  }

  /** The applet's Reset: n points equally spaced on a circle of integer radius. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const n = Math.max(N_MIN, Math.min(N_MAX,
      Math.round(o.n === undefined ? N_DEFAULT : o.n)));
    const center = point(width / 2, height / 2);
    // Java: min(width, height) / 4 with integer division.
    const radius = Math.floor(Math.min(width, height) / 4);
    const points = [];
    for (let i = 0; i < n; i++) {
      const angle = 2 * Math.PI * i / n;
      points.push(point(center.x + radius * Math.cos(angle),
        center.y - radius * Math.sin(angle)));
    }
    const state = { n: n, width: width, height: height, points: points, start: null };
    const circle = circleFor(points);
    state.start = point(circle.center.x + circle.radius / n, circle.center.y);
    return state;
  }

  /** Reset with the current n (the applet's N spinner does this). */
  function reset(state, options) {
    const o = options || {};
    return start({
      n: state.n,
      width: o.width === undefined ? state.width : o.width,
      height: o.height === undefined ? state.height : state.height,
    });
  }

  /** Changing N rebuilds the diagram, exactly as the applet's spinner does. */
  function setCount(state, n) {
    const value = Math.max(N_MIN, Math.min(N_MAX, Math.round(n)));
    return start({ n: value, width: state.width, height: state.height });
  }

  /** A dragged tangency point is kept on the current circle. */
  function movePoint(state, index, p) {
    if (index < 0 || index >= state.n || !isFinite(p.x) || !isFinite(p.y)) {
      return state;
    }
    const circle = circleFor(state.points);
    const d = sub(p, circle.center);
    const length = Math.sqrt(sqDist(d, point(0, 0)));
    if (length === 0) return state;
    const onCircle = add(circle.center, mul(d, circle.radius / length));
    const points = state.points.map((q, i) => (i === index ? onCircle : point(q.x, q.y)));
    return {
      n: state.n, width: state.width, height: state.height,
      points: points, start: point(state.start.x, state.start.y),
    };
  }

  /** The red start point is free, as in the applet (a click anywhere moves it). */
  function setStart(state, p) {
    return {
      n: state.n, width: state.width, height: state.height,
      points: state.points.map((q) => point(q.x, q.y)), start: point(p.x, p.y),
    };
  }

  /** Convenience: put the start on a tangency point, where odd loops close. */
  function startAtTangency(state) {
    return setStart(state, state.points[1]);
  }

  /** The full computed diagram for a position. */
  function compute(state) {
    const circle = circleFor(state.points);
    const lines = linesAt(state.points, circle.center);
    const loops = rotationLoop(lines, state.start);
    const sides = sideLengths(loops.V);
    const oddSum = sides.reduce((s, v, i) => (i % 2 ? s : s + v), 0);
    const evenSum = sides.reduce((s, v, i) => (i % 2 ? s + v : s), 0);
    return {
      circle: circle, lines: lines, V: loops.V, F: loops.F, G: loops.G,
      gap: loops.gap, firstGap: loops.firstGap, sides: sides,
      oddSum: oddSum, evenSum: evenSum, alternating: oddSum - evenSum,
    };
  }

  /** The diagram also works for any polygon's side lines, incircle or not. */
  function polygonLines(vertices) {
    return vertices.map((v, i) => [v, vertices[(i + 1) % vertices.length]]);
  }
  function polygonLoop(vertices, start) {
    return rotationLoop(polygonLines(vertices), start);
  }

  /** Rounded board units, for the picture and the player's record. */
  function position(state) {
    const d = compute(state);
    return {
      n: state.n,
      points: state.points.map((p) => point(roundTo(p.x, 3), roundTo(p.y, 3))),
      start: point(roundTo(state.start.x, 3), roundTo(state.start.y, 3)),
      center: point(roundTo(d.circle.center.x, 3), roundTo(d.circle.center.y, 3)),
      radius: roundTo(d.circle.radius, 3),
      corners: d.V.map((p) => point(roundTo(p.x, 3), roundTo(p.y, 3))),
      firstLoop: d.F.map((p) => point(roundTo(p.x, 3), roundTo(p.y, 3))),
      secondLoop: d.G.map((p) => point(roundTo(p.x, 3), roundTo(p.y, 3))),
      gap: roundTo(d.gap, 3),
      alternating: roundTo(d.alternating, 3),
      even: state.n % 2 === 0,
    };
  }

  /** This is a picture, not a game: no position has a win or a loss. */
  function result(state) {
    return null;
  }

  return {
    N_MIN: N_MIN, N_MAX: N_MAX, N_DEFAULT: N_DEFAULT,
    point: point, sub: sub, add: add, mul: mul, dist: dist, sqDist: sqDist,
    intersect: intersect, circumcenter: circumcenter, signedAngle: signedAngle,
    rotate: rotate, nearest: nearest, circleFor: circleFor,
    tangentAt: tangentAt, linesAt: linesAt, rotationLoop: rotationLoop,
    sideLengths: sideLengths, alternatingSum: alternatingSum,
    incenter: incenter, incircleError: incircleError, hasIncircle: hasIncircle,
    start: start, reset: reset, setCount: setCount, movePoint: movePoint,
    setStart: setStart, startAtTangency: startAtTangency, compute: compute,
    polygonLines: polygonLines, polygonLoop: polygonLoop,
    position: position, result: result,
  };
})();
