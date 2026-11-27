"use strict";

/*
 * Four Circles In Triangle, from Alexander Bogomolny's applet
 * FourCirclesInTriangle (Evelyn, Money-Coutts and Tyrrell, pp. 39-42).
 *
 * Three vertices can be dragged. Inside the triangle sit the incircle and,
 * in each corner, a smaller circle tangent to the two sides at that corner
 * and to the incircle. The applet joins the incircle's touch point on each
 * side to its touch point with the opposite corner circle. Those three lines
 * meet at one point.
 *
 * The construction follows the bytecode literally: FindIncenter gives the
 * incircle, GetTouchingCircle solves a quadratic for the homothety ratio of
 * each corner circle, FindCommonPoint gives the circle-circle tangency, and
 * FindAltitude gives the contact point on a side. The two interesting facts
 * behind it are that the corner circle is the incircle shrunk towards the
 * vertex, and that the tangency point therefore lies on the incircle exactly
 * opposite the vertex: it is the midpoint of the arc cut off by the two
 * adjacent side contact points. The three joins are angle bisectors of the
 * contact triangle, so they meet at that triangle's incenter.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const FourCirclesInTriangleCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 260;
  const MARGIN = 16;
  const EPS = 1e-12;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.NearestPoint: foot of p on the line ab, with its 0.1 guard. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = dot({ x: p.x - a.x, y: p.y - a.y }, { x: dx, y: dy }) / len2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  /** GeoSDoub.FindAltitude: the perpendicular foot from p onto line ab. */
  function altitude(p, a, b) {
    const dx = p.x + b.y - a.y;
    const dy = p.y - b.x + a.x;
    return intersectLines({ x: p.x, y: p.y }, { x: dx, y: dy }, a, b);
  }

  /** GeoSDoub.Intersect, including the applet's |determinant| < 1 guard. */
  function intersectLines(a, b, c, d) {
    const rx = a.y - b.y, sx = b.x - a.x, q = a.x * b.y - a.y * b.x;
    const ry = c.y - d.y, sy = d.x - c.x, r = c.x * d.y - c.y * d.x;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (sx * r - sy * q) / den, y: (q * ry - r * rx) / den };
  }

  /** Perpendicular distance from p to the line ab (for the check script). */
  function lineDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return dist(p, a);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  }

  /** The incenter, as side-length barycentric coordinates. */
  function incenter(v) {
    const a = dist(v[1], v[2]), b = dist(v[2], v[0]), c = dist(v[0], v[1]);
    const sum = a + b + c;
    if (sum < EPS) return null;
    return {
      x: (a * v[0].x + b * v[1].x + c * v[2].x) / sum,
      y: (a * v[0].y + b * v[1].y + c * v[2].y) / sum,
    };
  }

  /**
   * GetIncircle: the applet finds the incenter and then averages the distance
   * to the side V0V1 three times. The repetition is harmless and is kept.
   */
  function getIncircle(v) {
    const center = incenter(v);
    if (!center || !isFinite(center.x) || !isFinite(center.y)) return null;
    const sideDist = dist(center, nearestPoint(center, v[0], v[1]));
    return { center, radius: (sideDist + sideDist + sideDist) / 3 };
  }

  /** QuadraticEquation.Solve2: solves a*t^2 + 2*b*t + c = 0. */
  function solve2(a, b, c) {
    if (Math.abs(a) < 0.01) return null;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [(-b + root) / a, (-b - root) / a];
  }

  /**
   * GetTouchingCircle(sideMate, incircle, corner, guidePoint), with arguments
   * in exactly the applet's order. `sideMate` is the neighbouring vertex used
   * with `corner` to fix one side; `guidePoint` is the incenter, passed to the
   * applet as a DoubPoint. The parameter t runs from the corner towards the
   * incenter and the circle has radius sideDistance * t. The root in [0, 1] is
   * the small corner circle; the other root is a large circle outside it.
   */
  function getTouchingCircle(sideMate, inc, corner, guidePoint) {
    if (!inc) return null;
    const sideDistance = dist(guidePoint, nearestPoint(guidePoint, corner, sideMate));
    const ux = guidePoint.x - corner.x, uy = guidePoint.y - corner.y;
    const a = ux * ux + uy * uy - sideDistance * sideDistance;
    const b = dot({ x: ux, y: uy }, {
      x: corner.x - inc.center.x, y: corner.y - inc.center.y,
    }) - inc.radius * sideDistance;
    const c = sqDist(corner, inc.center) - inc.radius * inc.radius;
    const roots = solve2(a, b, c);
    if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
    let t = -1;
    if (roots[0] >= 0 && roots[0] <= 1) t = roots[0];
    if (t < 0) {
      if (roots[1] >= 0 && roots[1] <= 1) t = roots[1];
      else return null;
    }
    return {
      center: {
        x: corner.x + t * (guidePoint.x - corner.x),
        y: corner.y + t * (guidePoint.y - corner.y),
      },
      radius: sideDistance * t,
      ratio: t,
    };
  }

  /** FindCommonPoint: external tangency point of two circles. */
  function commonPoint(c1, c2) {
    const sum = c1.radius + c2.radius;
    if (Math.abs(sum) < EPS) return { x: NaN, y: NaN };
    return {
      x: (c1.center.x * c2.radius + c2.center.x * c1.radius) / sum,
      y: (c1.center.y * c2.radius + c2.center.y * c1.radius) / sum,
    };
  }

  /** The board a new diagram starts from: the applet's Reset in board units. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    return {
      width: width,
      height: height,
      vertices: [
        { x: width / 2, y: 20 },
        { x: width / 8, y: height - 20 },
        { x: 7 * width / 8, y: 4 * height / 5 },
      ],
      showLines: o.showLines !== false,
      showPoints: o.showPoints !== false,
    };
  }

  /** Move one vertex, keeping every point on the board. Does not mutate. */
  function setVertex(state, index, point) {
    const i = Math.round(index);
    if (i < 0 || i > 2 || !point || !isFinite(point.x) || !isFinite(point.y)) return state;
    const vertices = state.vertices.map((p, k) => (k === i ? {
      x: clamp(point.x, MARGIN, state.width - MARGIN),
      y: clamp(point.y, MARGIN, state.height - MARGIN),
    } : { x: p.x, y: p.y }));
    return { ...state, vertices };
  }

  /** The same board size and display options, with the applet's triangle back. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showLines: state.showLines, showPoints: state.showPoints,
    });
  }

  /** All the geometry the picture needs, or visible:false when the applet
   * would draw nothing (degenerate triangle, tiny incircle, missing root). */
  function diagram(state) {
    const v = state.vertices;
    const inc = getIncircle(v);
    if (!inc) return { visible: false, reason: "The triangle has collapsed." };
    const circles = [
      getTouchingCircle(v[2], inc, v[0], inc.center),
      getTouchingCircle(v[0], inc, v[1], inc.center),
      getTouchingCircle(v[1], inc, v[2], inc.center),
    ];
    if (circles.some((c) => !c)) {
      return { visible: false, reason: "Move the corners apart to fit the circles." };
    }
    if (inc.radius < 0.5) {
      return { visible: false, reason: "The triangle is too small for the circles." };
    }
    const feet = [
      altitude(inc.center, v[1], v[2]),
      altitude(inc.center, v[2], v[0]),
      altitude(inc.center, v[0], v[1]),
    ];
    const touch = circles.map((c) => commonPoint(inc, c));
    const lines = feet.map((f, i) => ({ a: f, b: touch[i] }));
    const meeting = intersectLines(lines[0].a, lines[0].b, lines[1].a, lines[1].b);
    return {
      visible: [inc, ...circles, ...feet, ...touch, meeting].every(
        (p) => isFinite(p.center ? p.center.x : p.x) && isFinite(p.center ? p.center.y : p.y),
      ),
      reason: "The lines are nearly parallel; move a corner.",
      incircle: inc,
      circles: circles,
      feet: feet,
      touch: touch,
      lines: lines,
      meeting: meeting,
      deviation: lineDistance(meeting, lines[2].a, lines[2].b),
    };
  }

  /** The saved position, in board units, for the record and the tutor. */
  function position(state) {
    const d = diagram(state);
    return {
      vertices: state.vertices.map((p) => ({ x: p.x, y: p.y })),
      visible: d.visible,
      incircle: d.incircle ? {
        x: d.incircle.center.x, y: d.incircle.center.y, radius: d.incircle.radius,
      } : null,
      meeting: d.visible ? { x: d.meeting.x, y: d.meeting.y } : null,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MARGIN: MARGIN,
    dist: dist, sqDist: sqDist, nearestPoint: nearestPoint, altitude: altitude,
    intersectLines: intersectLines, lineDistance: lineDistance, incenter: incenter,
    getIncircle: getIncircle, solve2: solve2, getTouchingCircle: getTouchingCircle,
    commonPoint: commonPoint, start: start, setVertex: setVertex, reset: reset,
    diagram: diagram, position: position,
  };
})();
