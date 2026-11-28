"use strict";

/*
 * Circle Chains on Napoleon Triangles — HIAI019, by Alexander Bogomolny,
 * from a problem of Hirotaka Ebisui.  On each side of a triangle we put an
 * equilateral triangle and its circumcircle.  Pick a point D on the first
 * circle, draw the line through D and the opposite vertex to meet the next
 * circle, and repeat.  The chain comes back to D and the three new points
 * form an equilateral triangle (a porism of three concurrent circles).
 *
 * This file transcribes HIAI019Canvas and its GeoSDoub helpers: the -60 degree
 * Napoleon apex (Rotate with sign -1), the circumcircle whose radius is the
 * mean of the three distances to the circumcentre, the circle/line cut used by
 * PropagatePoints (including its one-pixel slope test), and Other's "within
 * one pixel of the vertex" choice.  A failed cut is swallowed, as in the
 * applet's try/catch.  Dragging a chain point projects it radially onto its
 * circle, as CTKMoveableDoub.RestrictToCircle does.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage.  It defines one global, Hiai019Core, so the page loads it with a
 * plain <script> and porting/check-hiai-019.mjs loads it in Node.  Positions
 * are plain data (numbers, arrays and plain objects) and functions return new
 * positions rather than changing what they are given.
 */
const Hiai019Core = (() => {
  const N = 3;
  const WIDTH = 400, HEIGHT = 250;              // the applet's optimal size
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  const STEP = (2 * Math.PI) / N;
  const RADIUS = Math.min(WIDTH, HEIGHT) / 5;   // Reset: min(w,h) / 5
  const TURN = 1.0471975511965976;              // Math.PI / 3, as in the class file
  const SIGN = -1;                              // GetNapoleon's rotation sense
  const EPS = 1e-9;
  const PAD = 8;                                // a UI margin for the handles

  const pt = (x, y) => ({ x, y });
  const copy = (p) => pt(p.x, p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const deg = (r) => (r * 180) / Math.PI;

  /* GeoSDoub.Rotate(p, q, angle, sign): turn q about p by sign * angle. */
  function rotate(p, q, angle, sign) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return pt(
      p.x + c * (q.x - p.x) - sign * s * (q.y - p.y),
      p.y + sign * s * (q.x - p.x) + c * (q.y - p.y)
    );
  }

  /* FindOrientation: +1 for a left turn in the applet's y-down coordinates. */
  function orientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeSignedAngle: + or - the minor angle at p1. */
  function signedAngle(p0, p1, p2) {
    const s = (sqDist(p0, p1) + sqDist(p0, p2) - sqDist(p1, p2)) / 2;
    const cos = s / (dist(p0, p1) * dist(p0, p2));
    const ang = Math.acos(clamp(cos, -1, 1));
    if (ang > 0.99 && (p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2 < 0) return Math.PI;
    return orientation(p0, p1, p2) === 1 ? ang : -ang;
  }

  /* GeoSDoub.Intersect(p1, p2, p3, p4): two infinite lines. */
  function lineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (d === 0) return null;
    const n1 = p1.x * p2.y - p1.y * p2.x;
    const n2 = p3.x * p4.y - p3.y * p4.x;
    return pt(
      (n1 * (p3.x - p4.x) - (p1.x - p2.x) * n2) / d,
      (n1 * (p3.y - p4.y) - (p1.y - p2.y) * n2) / d
    );
  }

  /* FindCircumcenter: the intersection of the perpendicular bisectors. */
  function findCircumcenter(a, b, c) {
    const m1 = pt((a.x + b.x) / 2, (a.y + b.y) / 2);
    const m2 = pt((b.x + c.x) / 2, (b.y + c.y) / 2);
    return lineIntersection(
      m1, pt(m1.x + a.y - b.y, m1.y + b.x - a.x),
      m2, pt(m2.x + b.y - c.y, m2.y + c.x - b.x)
    );
  }

  /* GetCircle(p,q,r): the applet averages the three distances for its radius.
     For an equilateral triangle they agree, so this is the circumradius. */
  function circleThrough(a, b, c) {
    const o = findCircumcenter(a, b, c);
    return { center: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /* GeoSDoub.IntersectX / IntersectY(DoubLine, DoubCircle), with the same
     |slope direction| > 1 test from Intersect(DoubLine, DoubCircle).  The
     returned order is [+root, -root], which is what Other relies on. */
  function lineCircle(p, q, circle) {
    const dx = p.x - q.x, dy = p.y - q.y;
    const byX = Math.abs(dy) > 1;
    const byY = !byX && Math.abs(dx) > 1;
    if (!byX && !byY) return null;
    const m = byX ? dx / dy : dy / dx;
    const b = byX ? q.x - m * q.y : q.y - m * q.x;
    const A = m * m + 1;
    const B = byX ? m * (b - circle.center.x) - circle.center.y
                  : m * (b - circle.center.y) - circle.center.x;
    const C = (byX
      ? circle.center.y * circle.center.y + (b - circle.center.x) ** 2
      : circle.center.x * circle.center.x + (b - circle.center.y) ** 2) - circle.r * circle.r;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(Math.max(0, disc));
    const t1 = (-B + root) / A, t2 = (-B - root) / A;
    return byX
      ? [pt(m * t1 + b, t1), pt(m * t2 + b, t2)]
      : [pt(t1, m * t1 + b), pt(t2, m * t2 + b)];
  }

  /* Other(points, vertex): the far intersection.  The near one is the vertex
     itself, and the bytecode tests whether points[0] is within a pixel of it. */
  function other(points, vertex) {
    if (dist(points[0], vertex) < 1) return points[1];
    return points[0];
  }

  function getNapoleons(vertices) {
    return vertices.map((_, i) => rotate(vertices[i], vertices[(i + 1) % N], TURN, SIGN));
  }

  function getCircles(vertices, napoleons) {
    return vertices.map((_, i) => circleThrough(
      vertices[i], vertices[(i + 1) % N], napoleons[i]
    ));
  }

  function computeAngles(circles, points) {
    return circles.map((circle, i) => signedAngle(
      pt(circle.center.x + 200, circle.center.y), circle.center, points[i]
    ));
  }

  /* PropagatePoints(index): work round the chain once.  A failed cut is
     ignored, exactly like the applet's catch around the loop body. */
  function propagate(points, vertices, circles, index) {
    for (let k = 0; k < N; k++) {
      const j = (k + index) % N;
      const jp = (j + 1) % N;
      try {
        const cuts = lineCircle(points[j], vertices[jp], circles[jp]);
        if (!cuts || cuts.length < 2) continue;
        const chosen = other(cuts, vertices[jp]);
        points[jp].x = chosen.x;
        points[jp].y = chosen.y;
      } catch (e) {
        /* the applet swallows a bad intersection too */
      }
    }
    return points;
  }

  function onCircle(circle, angle) {
    return pt(circle.center.x + circle.r * Math.cos(angle),
              circle.center.y + circle.r * Math.sin(angle));
  }

  const angleOn = (circle, p) => Math.atan2(p.y - circle.center.y, p.x - circle.center.x);

  /** Check that a supplied triple of vertices can be used. */
  function validVertices(v) {
    return Array.isArray(v) && v.length === N && v.every((p) =>
      p && Number.isFinite(p.x) && Number.isFinite(p.y)) &&
      dist(v[0], v[1]) > EPS && dist(v[1], v[2]) > EPS && dist(v[2], v[0]) > EPS;
  }

  /** The position a new illustration starts from (Reset in the applet). */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const r = o.radius === undefined ? Math.min(w, h) / 5 : o.radius;
    const cx = o.center ? o.center.x : w / 2;
    const cy = o.center ? o.center.y : h / 2;
    const vertices = validVertices(o.vertices)
      ? o.vertices.map(copy)
      : [0, 1, 2].map((i) => pt(
          Math.trunc(r * Math.cos(i * STEP) + cx),
          Math.trunc(r * Math.sin(i * STEP) + cy)
        ));
    const napoleons = getNapoleons(vertices);
    const circles = getCircles(vertices, napoleons);
    const random = typeof o.random === "function" ? o.random : Math.random;
    const firstAngle = (random() / 4) * Math.PI;
    const points = [onCircle(circles[0], firstAngle), pt(0, 0), pt(0, 0)];
    propagate(points, vertices, circles, 0);
    const signed = computeAngles(circles, points);
    return {
      width: w, height: h, center: pt(cx, cy), radius: r,
      vertices, napoleons, circles, points, signedAngles: signed, selected: 0,
      showNames: o.showNames === undefined ? true : !!o.showNames,
      showPremises: o.showPremises === undefined ? false : !!o.showPremises,
      showStatement: o.showStatement === undefined ? false : !!o.showStatement,
    };
  }

  /** The current geometry, derived without changing the state. */
  function compute(state) {
    const napoleons = getNapoleons(state.vertices);
    const circles = getCircles(state.vertices, napoleons);
    const p = state.points;
    const sides = [dist(p[0], p[1]), dist(p[1], p[2]), dist(p[2], p[0])];
    const triangleAngles = [
      Math.acos(clamp((sqDist(p[0], p[1]) + sqDist(p[0], p[2]) - sqDist(p[1], p[2])) /
        (2 * dist(p[0], p[1]) * dist(p[0], p[2])), -1, 1)),
      Math.acos(clamp((sqDist(p[1], p[0]) + sqDist(p[1], p[2]) - sqDist(p[0], p[2])) /
        (2 * dist(p[1], p[0]) * dist(p[1], p[2])), -1, 1)),
      Math.acos(clamp((sqDist(p[2], p[0]) + sqDist(p[2], p[1]) - sqDist(p[0], p[1])) /
        (2 * dist(p[2], p[0]) * dist(p[2], p[1])), -1, 1)),
    ];
    /* The inscribed angle at each chain point, subtending its circle's side. */
    const inscribed = [0, 1, 2].map((j) => {
      const a = state.vertices[j], b = state.vertices[(j + 1) % N], d = p[j];
      return Math.acos(clamp((sqDist(d, a) + sqDist(d, b) - sqDist(a, b)) /
        (2 * dist(d, a) * dist(d, b)), -1, 1));
    });
    /* Follow one more turn of the chain from the current point and see where
       it lands: a porism must land back on the point we started with. */
    const walked = p.map(copy);
    if (walked[0] && circles[0]) {
      const near = onCircle(circles[0], angleOn(circles[0], walked[0]));
      walked[0] = near;
    }
    propagate(walked, state.vertices, circles, 0);
    const closure = dist(walked[0], p[0]);
    return {
      napoleons, circles, sides, triangleAngles, inscribed, closure,
      equilateral: Math.max(...sides) - Math.min(...sides),
      onCircleError: Math.max(...p.map((q, j) => Math.abs(dist(q, circles[j].center) - circles[j].r))),
    };
  }

  /* The third circle through the meeting point of the first two.  Returns
     both intersections; either one can be the common (Fermat) point. */
  function circleIntersections(c1, c2) {
    const dx = c2.center.x - c1.center.x, dy = c2.center.y - c1.center.y;
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > c1.r + c2.r || d < Math.abs(c1.r - c2.r)) return [];
    const a = (c1.r ** 2 - c2.r ** 2 + d * d) / (2 * d);
    const h2 = c1.r ** 2 - a * a;
    if (h2 < -1e-7) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const x = c1.center.x + (a * dx) / d, y = c1.center.y + (a * dy) / d;
    return [pt(x - (h * dy) / d, y + (h * dx) / d),
            pt(x + (h * dy) / d, y - (h * dx) / d)];
  }

  /** The common point of the three circumcircles, if one can be found. */
  function commonPoint(state, tolerance) {
    const g = compute(state);
    const tol = tolerance === undefined ? 1e-6 : tolerance;
    let best = null, bestError = Infinity;
    for (const pair of [[0, 1], [1, 2], [2, 0]]) {
      for (const p of circleIntersections(g.circles[pair[0]], g.circles[pair[1]])) {
        const error = Math.max(...g.circles.map((c) => Math.abs(dist(p, c.center) - c.r)));
        if (error < bestError) { bestError = error; best = p; }
      }
    }
    return best && bestError <= tol ? { point: best, error: bestError } : null;
  }

  function moveVertex(state, index, position) {
    if (!Number.isInteger(index) || index < 0 || index >= N || !position) return state;
    const p = pt(
      clamp(position.x, PAD, state.width - PAD),
      clamp(position.y, PAD, state.height - PAD)
    );
    const vertices = state.vertices.map(copy);
    vertices[index] = p;
    const napoleons = getNapoleons(vertices);
    const circles = getCircles(vertices, napoleons);
    /* AdjustCircles: put the selected point back at its old signed angle,
       then carry the whole chain round once. */
    const points = state.points.map(copy);
    points[index] = onCircle(circles[index], state.signedAngles[index]);
    propagate(points, vertices, circles, index);
    return Object.assign({}, state, {
      vertices, napoleons, circles, points,
      signedAngles: computeAngles(circles, points), selected: index,
    });
  }

  function movePointTo(state, index, position) {
    if (!Number.isInteger(index) || index < 0 || index >= N || !position) return state;
    const circle = state.circles[index];
    const v = pt(position.x - circle.center.x, position.y - circle.center.y);
    const len = Math.hypot(v.x, v.y);
    const p = len < EPS ? onCircle(circle, state.signedAngles[index])
                        : pt(circle.center.x + (circle.r * v.x) / len,
                             circle.center.y + (circle.r * v.y) / len);
    return rotatePointTo(state, index, angleOn(circle, p));
  }

  /** Keyboard/button version of a drag: slide the point along its circle. */
  function rotatePointTo(state, index, angle) {
    if (!Number.isInteger(index) || index < 0 || index >= N) return state;
    const points = state.points.map(copy);
    points[index] = onCircle(state.circles[index], angle);
    propagate(points, state.vertices, state.circles, index);
    return Object.assign({}, state, {
      points, signedAngles: computeAngles(state.circles, points), selected: index,
    });
  }

  function turnPoint(state, index, delta) {
    if (!Number.isInteger(index) || index < 0 || index >= N) return state;
    return rotatePointTo(state, index,
      angleOn(state.circles[index], state.points[index]) + delta);
  }

  function toggle(state, option) {
    const keys = { showNames: 1, showPremises: 1, showStatement: 1 };
    if (!keys[option]) return state;
    return Object.assign({}, state, { [option]: !state[option] });
  }

  /** Status line: describe what the picture shows, without a win or a loss. */
  function describe(state) {
    const g = compute(state);
    const meet = commonPoint(state);
    const round = (v) => v.toFixed(2);
    return `Chain back at D: ${round(g.closure)} units off. ` +
      `D-E-F sides ${round(g.sides[0])}, ${round(g.sides[1])}, ${round(g.sides[2])}; ` +
      `angles ${Math.round(deg(g.triangleAngles[0]))}\u00b0, ` +
      `${Math.round(deg(g.triangleAngles[1]))}\u00b0, ` +
      `${Math.round(deg(g.triangleAngles[2]))}\u00b0. ` +
      (meet ? `Circles share a point (${round(meet.error)} units off).`
            : "The three circles do not meet at one point here.");
  }

  /** An illustration has no result to report. */
  function result(state) {
    return null;
  }

  return {
    N, WIDTH, HEIGHT, CENTER, STEP, RADIUS, TURN, SIGN, PAD,
    pt, dist, sqDist, clamp, deg, rotate, orientation, signedAngle,
    lineIntersection, findCircumcenter, circleThrough, lineCircle, other,
    onCircle, angleOn, getNapoleons, getCircles, computeAngles, propagate,
    circleIntersections, commonPoint,
    start, compute, moveVertex, movePointTo, rotatePointTo, turnPoint,
    toggle, describe, result,
  };
})();
