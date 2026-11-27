"use strict";

/*
 * Evelyn N, from Alexander Bogomolny's applet EvelynN (a chain of touching
 * circles in a polygon).  There is no game to win: the player moves the
 * polygon's corners and the yellow point on the first bisector, and watches a
 * chain of circles, each tangent to the previous one and to two successive
 * sides of the polygon.
 *
 * The key idea in the code is the applet's own construction.  At corner A the
 * point L is where the internal angle bisector meets the diagonal joining A's
 * two neighbours.  A circle whose centre is A + t(L - A) is tangent to the
 * next side with radius t times the distance from L to that side.  Tangency to
 * the previous circle gives a quadratic in t; the applet solves it with its
 * QuadraticEquation.Solve2(a,b,c), which solves a*t*t + 2*b*t + c = 0 and
 * takes (-b + sqrt(b*b - a*c)) / a.  We keep that exact root choice, including
 * its preference for the first root in [0,1] and its fallback to the second.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage.  It defines one global, EvelynNCore, for the page and for
 * porting/check-evelyn-n.mjs.  All positions are plain data.
 */
const EvelynNCore = (() => {
  /* The applet's canvas is 400 by 320; its circumcircle radius is min/2.
   * We inset that radius by 20 board units so the draggable corner handles
   * never clip.  Every length in the construction scales with this one
   * radius, so no incidence or claim changes. */
  const VIEW = Object.freeze({ width: 400, height: 320 });
  const CENTER = Object.freeze({ x: 200, y: 160 });
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 2 - 20;

  const N_MIN = 3;
  const N_MAX = 21;
  const WHICH_MIN = 0;
  const TA_INIT = 0.7;          // m_Ta in the applet
  const EDGE = 8;               // keeps a dragged handle inside the viewBox

  const point = (x, y) => ({ x: x, y: y });
  const sqDist = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /* GeoSDoub.NearestPoint(P,A,B): foot of the perpendicular, not clamped. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return point(a.x + dx * t, a.y + dy * t);
  }

  /* GeoSDoub.Dist(P, DoubLine(A,B)), including its near-endpoint shortcut. */
  function distanceToLine(p, a, b) {
    if (sqDist(a, p) < 0.1) return 0;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return Math.hypot(a.x - p.x + dx * t, a.y - p.y + dy * t);
  }

  /* GeoSDoub.FindOrientation / ComputeAngle / Rotate / Intersect, used by
   * FindAngleBisector(V[i], V[i-1], V[i+1]). */
  function orientation(a, b, c) {
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }
  function angleAt(a, b, c) {
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    return Math.acos(cos);
  }
  function rotate(p, q, theta, dir) {
    const co = Math.cos(theta), si = Math.sin(theta);
    return point(p.x + co * (q.x - p.x) - dir * si * (q.y - p.y),
                 p.y + dir * si * (q.x - p.x) + co * (q.y - p.y));
  }
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return point(NaN, NaN); // the applet returns NaN points
    return point((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
  }
  function bisectorFoot(a, b, c) {
    const half = angleAt(a, b, c) / 2;
    const arm = rotate(a, b, half, orientation(a, b, c));
    return intersect(a, arm, b, c);
  }

  /* QuadraticEquation.Solve2(a,b,c): a*t*t + 2*b*t + c = 0. */
  function solve2(a, b, c) {
    if (Math.abs(a) < 0.01) return null;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [(-b + root) / a, (-b - root) / a];
  }

  /* EvelynNCanvas.GetTouchingCircle(nextVertex, circle, vertex, foot). */
  function nextCircle(nextVertex, circle, vertex, foot) {
    const d = dist(foot, nearestPoint(foot, vertex, nextVertex));
    const a = sqDist(foot, vertex) - d * d;
    const b = (foot.x - vertex.x) * (vertex.x - circle.x) +
              (foot.y - vertex.y) * (vertex.y - circle.y) - circle.r * d;
    const c = sqDist(vertex, circle) - circle.r * circle.r;
    const roots = solve2(a, b, c);
    if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
    let t = -1;
    if (roots[0] >= 0 && roots[0] <= 1) t = roots[0];
    if (t < 0) t = roots[1]; // the applet keeps this root even outside [0,1]
    return {
      x: vertex.x + t * (foot.x - vertex.x),
      y: vertex.y + t * (foot.y - vertex.y),
      r: d * t,
    };
  }

  function regularVertices(n) {
    return Array.from({ length: n }, (_, i) => {
      const a = 2 * Math.PI * i / n;
      return point(CENTER.x + RADIUS * Math.cos(a), CENTER.y + RADIUS * Math.sin(a));
    });
  }

  function bisectorsOf(V) {
    const n = V.length;
    return V.map((v, i) => bisectorFoot(v, V[(i + n - 1) % n], V[(i + 1) % n]));
  }

  /* DoubLine(a,b).CreateMidPoint(t): a*t + b*(1-t). */
  function pointOnSegment(a, b, t) {
    return point(a.x * t + b.x * (1 - t), a.y * t + b.y * (1 - t));
  }

  /* DoubLine(a,b).UpdateMidPoint(p) after RestrictToSegment(true): project
   * p onto a-b and clamp the line's parameter t to [0,1]. */
  function projectToSegment(a, b, p) {
    const dx = a.x - b.x, dy = a.y - b.y;
    const denom = dx * dx + dy * dy;
    const t = clamp(-(dx * (b.x - p.x) + dy * (b.y - p.y)) / denom, 0, 1);
    return { t: t, point: pointOnSegment(a, b, t) };
  }

  /* A circle i is red when it is the emphasized pair i, i+1 (mod 2n);
   * Which = 2n colours them all, as the page says. */
  function emphasized(i, which, total) {
    if (which === total) return true;
    return i === which || (i + total - 1) % total === which;
  }

  function geometry(state) {
    if (!state || !Array.isArray(state.vertices) || state.vertices.length < N_MIN) return null;
    const V = state.vertices;
    const n = V.length;
    const total = 2 * n;
    const L = bisectorsOf(V);
    const p = pointOnSegment(V[0], L[0], state.ta);
    const firstRadius = distanceToLine(p, V[0], V[1 % n]);
    let circle = { x: p.x, y: p.y, r: firstRadius };
    const circles = [{ x: circle.x, y: circle.y, r: circle.r,
      red: emphasized(0, state.which, total) }];
    for (let i = 1; i < total; i++) {
      const j = i % n;
      const next = nextCircle(V[(j + 1) % n], circle, V[j], L[j]);
      if (!next) break;
      circle = next;
      circles.push({ x: circle.x, y: circle.y, r: circle.r,
        red: emphasized(i, state.which, total) });
    }
    /* The first return of the chain to its opening circle, if it is drawn. */
    let closureAt = 0;
    for (let i = 1; i < circles.length; i++) {
      if (dist(circles[0], circles[i]) < 1e-6 * RADIUS &&
          Math.abs(circles[0].r - circles[i].r) < 1e-6 * RADIUS) {
        closureAt = i;
        break;
      }
    }
    return {
      n: n,
      which: state.which,
      vertices: V,
      bisectors: L,
      p: p,
      firstRadius: firstRadius,
      circles: circles,
      chainLength: circles.length,
      closureAt: closureAt,
    };
  }

  /** The position a new picture starts from (the applet's N=3, Which=6). */
  function start(options) {
    const o = options || {};
    const n = clamp(Math.round(o.n === undefined ? N_MIN : o.n), N_MIN, N_MAX);
    const which = clamp(Math.round(o.which === undefined ? 2 * n : o.which), WHICH_MIN, 2 * n);
    return {
      n: n,
      which: which,
      whichSpinner: which,
      ta: o.ta === undefined ? TA_INIT : clamp(o.ta, 0, 1),
      vertices: regularVertices(n),
      explored: false,
    };
  }

  /** EvelynNPanel.stateChanged when the N spinner changes: clamp the pair
   * spinner's maximum to 2N, Reset the picture, then copy the pair value. */
  function setN(state, n) {
    const nextN = clamp(Math.round(n), N_MIN, N_MAX);
    const spinner = clamp(state.whichSpinner, WHICH_MIN, 2 * nextN);
    return {
      n: nextN,
      which: spinner,
      whichSpinner: spinner,
      ta: state.ta,
      vertices: regularVertices(nextN),
      explored: true,
    };
  }

  /** EvelynNPanel.stateChanged when the pair spinner changes: no Reset. */
  function setWhich(state, which) {
    const w = clamp(Math.round(which), WHICH_MIN, 2 * state.n);
    return Object.assign({}, state, { which: w, whichSpinner: w, explored: true });
  }

  /** EvelynNCanvas.Reset(): regular polygon and Which = 2N.  The pair
   * spinner keeps its own value, exactly as in the panel. */
  function reset(state) {
    return {
      n: state.n,
      which: 2 * state.n,
      whichSpinner: state.whichSpinner,
      ta: state.ta,
      vertices: regularVertices(state.n),
      explored: true,
    };
  }

  /** Drag one corner.  The applet only checks the canvas bounds. */
  function moveVertex(state, i, p) {
    if (!Number.isInteger(i) || i < 0 || i >= state.n || !finite(p)) return state;
    const V = state.vertices.slice();
    V[i] = point(clamp(p.x, EDGE, VIEW.width - EDGE),
                 clamp(p.y, EDGE, VIEW.height - EDGE));
    return Object.assign({}, state, { vertices: V, explored: true });
  }

  /** Drag the point on the first angle bisector: project it back onto the
   * segment V[0]L[0] and remember the new parameter as m_Ta. */
  function movePoint(state, p) {
    if (!finite(p)) return state;
    const L = bisectorsOf(state.vertices);
    const projected = projectToSegment(state.vertices[0], L[0], p);
    if (!Number.isFinite(projected.t)) return state;
    return Object.assign({}, state, { ta: projected.t, explored: true });
  }

  /** A demonstration: no win, loss or finishing condition. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "The polygon cannot be drawn.";
    const pair = g.which === 2 * g.n ? "colours every circle" :
      "highlights circles #" + g.which + " and #" + ((g.which + 1) % (2 * g.n));
    const closure = g.closureAt
      ? " The chain closes with " + g.closureAt + " circles."
      : " The first circle does not repeat in the displayed range.";
    return "N = " + g.n + ", " + g.circles.length + " circles; pair #" + g.which +
      " " + pair + "." + closure;
  }

  /** Plain data for Track.state() and the tutor. */
  function snapshot(state) {
    const g = geometry(state);
    return {
      n: state.n,
      which: state.which,
      whichSpinner: state.whichSpinner,
      ta: state.ta,
      vertices: g ? g.vertices.map((v) => ({ x: v.x, y: v.y })) : [],
      p: g ? { x: g.p.x, y: g.p.y } : null,
      circles: g ? g.circles.map((c) => ({ x: c.x, y: c.y, r: c.r, red: c.red })) : [],
      chainLength: g ? g.chainLength : 0,
      closureAt: g ? g.closureAt : 0,
      explored: !!state.explored,
    };
  }

  return {
    VIEW: VIEW, CENTER: CENTER, RADIUS: RADIUS,
    N_MIN: N_MIN, N_MAX: N_MAX, TA_INIT: TA_INIT,
    start: start, setN: setN, setWhich: setWhich, reset: reset,
    moveVertex: moveVertex, movePoint: movePoint,
    geometry: geometry, result: result, describe: describe, snapshot: snapshot,
    /* exposed for independent verification of the bytecode transcription */
    solve2: solve2, nextCircle: nextCircle, distanceToLine: distanceToLine,
    bisectorFoot: bisectorFoot, projectToSegment: projectToSegment,
  };
})();
