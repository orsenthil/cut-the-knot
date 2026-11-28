"use strict";

/*
 * Hippocrates: Angle Trisection by Hippocrates, Alexander Bogomolny's applet.
 *
 * A, B and E start on two horizontal lines, C above A. D is the foot of the
 * perpendicular from C to AB, F the corner of the rectangle ADCF, and H the
 * point where AE crosses CD. The circle is centred at E with radius 2*AC;
 * the point K on EA at that distance from E is the one to match with H.
 * G is the midpoint of E and K. When EH = 2*AC the match is exact and the
 * angle at A between AB and AE is one third of the angle between AB and AC.
 *
 * The bytecode (HippocratesCanvas.ComputePoints, CheckSolved and the drag
 * fix-ups) is followed literally: GeoSDoub.NearestPoint, GetParallelTo and
 * Intersect, the strict "distance < 1" finish test, and the Y-fixed A and E.
 * This is a picture with a target, not a game: there is no win or loss.
 *
 * No document, no window, no storage: one global, plain-data positions, and
 * functions that return a new position instead of changing the old one.
 */
const HippocratesCore = (() => {
  const DEFAULT_WIDTH = 400;   // applet parameter "(400 will do)"
  const DEFAULT_HEIGHT = 300;  // applet parameter "(300 will do)"
  const FINISH_DISTANCE = 1;   // CheckSolved: dist(H, K) < 1 (strict)
  const CIRCLE_FACTOR = 2;     // radius = 2 * dist(A, C)
  const PARALLEL_STEP = 100;   // GeoSDoub.GetParallelTo uses 100 units
  const EDGE = 6;              // keep the handles inside the drawing

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const trunc = (n) => Math.trunc(n);

  function point(x, y) {
    return { x, y };
  }

  function sqDist(p, q) {
    return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  }

  function dist(p, q) {
    return Math.sqrt(sqDist(p, q));
  }

  function midPoint(p, q) {
    return point((p.x + q.x) / 2, (p.y + q.y) / 2);
  }

  /* GeoSDoub.NearestPoint: the foot on line a-b, with the applet's 0.1 guard. */
  function nearestPoint(p, a, b) {
    if (sqDist(b, a) < 0.1) return point(a.x, a.y);
    const vx = b.x - a.x, vy = b.y - a.y;
    const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
    return point(a.x + vx * t, a.y + vy * t);
  }

  /* GeoSDoub.GetParallelTo: a point on the parallel to a-b through c. */
  function getParallelTo(a, b, c) {
    return point(a.x + PARALLEL_STEP * (b.x - c.x), a.y + PARALLEL_STEP * (b.y - c.y));
  }

  /* GeoSDoub.Intersect of the two full lines, with its |det| < 1 NaN guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* GeoSDoub.ComputeAngle, on the three points that make the angle at o. */
  function angleAt(o, p, q) {
    const op = dist(o, p), oq = dist(o, q);
    if (!op || !oq) return NaN;
    const cos = clamp((sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / (2 * op * oq), -1, 1);
    return Math.acos(cos);
  }

  /** HippocratesCanvas.init: the integer starting positions from width/height. */
  function start(options) {
    const o = options || {};
    const width = Number.isFinite(o.width) ? o.width : DEFAULT_WIDTH;
    const height = Number.isFinite(o.height) ? o.height : DEFAULT_HEIGHT;
    const A = point(trunc(width / 6), trunc((height * 4) / 5));
    const B = point(trunc((width * 5) / 6), A.y);
    const C = point(trunc(width / 4), trunc((height * 2) / 5));
    const E = point(trunc((width * 5) / 6), C.y);
    const state = {
      width, height, A, B, C, E,
      circle: point(E.x, E.y), // DoubCircle centre; its radius is set below
      radius: 0,
      showNames: !!o.showNames,
      hint: false,
      hintEnabled: false,
      showHint: false,
      finished: false,
      moves: 0,
    };
    state.radius = CIRCLE_FACTOR * dist(A, C);
    return finish(state);
  }

  /* CheckSolved and the tiny checkboxes: finished is never a win or a loss. */
  function finish(state) {
    const shape = compute(state);
    const finished = shape.solved;
    const hintEnabled = finished;
    // The applet forces the checkbox back to false whenever K leaves H.
    const hint = finished && state.hint;
    return Object.assign({}, state, {
      finished, hintEnabled, hint, showHint: hint,
    });
  }

  /** HippocratesCanvas.ComputePoints, given a position (no DOM). */
  function compute(state) {
    const { A, B, C, E } = state;
    const D = nearestPoint(C, A, B);
    const parallel = getParallelTo(A, C, D);
    const F = nearestPoint(C, A, parallel);
    const H = intersect(A, E, C, D);
    const ac = dist(A, C);
    const ae = dist(A, E);
    const shape = {
      D, F, H, K: null, G: null, radius: state.radius,
      ac, ae, finished: false, solved: false,
      BAC: angleAt(A, B, C), BAE: angleAt(A, B, E), CAE: angleAt(A, C, E),
    };
    if (ae === 0) return shape; // the Java method returns before K and G
    const t = state.radius / ae;
    const K = point(E.x + t * (A.x - E.x), E.y + t * (A.y - E.y));
    shape.K = K;
    shape.G = midPoint(E, K);
    shape.solved = dist(H, K) < FINISH_DISTANCE;
    shape.finished = shape.solved;
    return shape;
  }

  /** The drag fix-ups in mouseDragged/mouseReleased, plus the Fix(2) limits. */
  function move(state, name, p) {
    const loX = EDGE, hiX = state.width - EDGE;
    const loY = EDGE, hiY = state.height - EDGE;
    if (name === "A") {
      const A = point(clamp(p.x, loX, hiX), state.A.y);
      return finish(Object.assign({}, state, {
        A, radius: CIRCLE_FACTOR * dist(A, state.C),
        circle: point(state.circle.x, state.circle.y),
        moves: state.moves + 1,
      }));
    }
    if (name === "E") {
      const E = point(clamp(p.x, loX, hiX), state.E.y);
      return finish(Object.assign({}, state, {
        E, radius: CIRCLE_FACTOR * dist(state.A, state.C),
        circle: point(E.x, state.circle.y),
        moves: state.moves + 1,
      }));
    }
    if (name === "C") {
      // Dragging C sets E.y and the circle's y to C.y; the circle's x tracks E.
      const C = point(clamp(p.x, loX, hiX), clamp(p.y, loY, hiY));
      const E = point(state.E.x, C.y);
      return finish(Object.assign({}, state, {
        C, E, radius: CIRCLE_FACTOR * dist(state.A, C),
        circle: point(E.x, C.y),
        moves: state.moves + 1,
      }));
    }
    return state;
  }

  function toggleNames(state) {
    return Object.assign({}, state, { showNames: !state.showNames });
  }

  function toggleHint(state) {
    if (!state.hintEnabled) return state; // the applet disables it until solved
    const hint = !state.hint;
    return Object.assign({}, state, { hint, showHint: hint });
  }

  /** "done" for the matched construction; an illustration has no win/loss. */
  function result(state) {
    return state.finished ? "done" : null;
  }

  /** The line under the drawing: the two angles and whether K has met H. */
  function describe(state, shape) {
    const s = shape || compute(state);
    const deg = (r) => Number.isFinite(r) ? `${((r * 180) / Math.PI).toFixed(1)}\u00b0` : "?";
    if (s.solved) {
      return `K is on H. Angle BAE is ${deg(s.BAE)} and angle BAC is ${deg(s.BAC)}: one third.`;
    }
    if (s.K === null) {
      return "A and E are on top of each other. Move E away to build the circle.";
    }
    return `Angle BAC is ${deg(s.BAC)} and angle BAE is ${deg(s.BAE)}. Slide E until K reaches H.`;
  }

  /** A solver for the check script: E.x with EH = 2*AC (acute C only). */
  function solveE(state, options) {
    const o = options || {};
    const A = state.A, C = state.C;
    const f = (x) => {
      const E = point(x, C.y);
      const H = intersect(A, E, C, point(C.x, A.y));
      return dist(E, H) - CIRCLE_FACTOR * dist(A, C);
    };
    const lo0 = o.lo === undefined ? C.x + 1e-7 : o.lo;
    const hi0 = o.hi === undefined ? C.x + (o.span === undefined ? 1e6 : o.span) : o.hi;
    let lo = lo0, hi = hi0;
    if (f(lo) * f(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  return {
    DEFAULT_WIDTH, DEFAULT_HEIGHT, FINISH_DISTANCE, CIRCLE_FACTOR,
    dist, sqDist, midPoint, nearestPoint, getParallelTo, intersect, angleAt,
    start, compute, move, toggleNames, toggleHint, result, describe, solveE,
  };
})();
