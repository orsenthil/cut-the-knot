"use strict";

/*
 * Fixed Point, from Alexander Bogomolny's applet FixedPoint.
 *
 * A line started along the side AB is turned about A until it lies on AC,
 * then about C until it lies on BC, then about B until it lies on AB again.
 * One such trip leaves the line where it was but reversed; the whole trip is a
 * half-turn about the point where the incircle touches AB. Two trips therefore
 * bring every point of the line back to where it began.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, FixedPointCore, so the page loads it with a plain
 * <script> and porting/check-fixed-point.mjs loads it in Node.
 *
 * Positions are plain data: the three vertices, the tracked copies of the
 * rotating line's points, and the current stage of the animation. Functions
 * take a position and return a new one; they never change what they are given.
 */

const FixedPointCore = (() => {
  // The applet's canvas is 500 by 400 and its vertices start on a circle of
  // radius min(width, height) / 4, one third of a turn apart (GetPoint).
  const WIDTH = 500;
  const HEIGHT = 400;
  const RADIUS = Math.min(WIDTH, HEIGHT) / 4;
  const IDLE = -1;
  const STAGES = ["A", "C", "B"]; // run(): rotate about A, then C, then B
  const HIT_SQ = 0.1; // PointOnLine.Equals: dx² + dy² < 0.1

  const pt = (x, y) => ({ x, y });
  const copy = (p) => pt(p.x, p.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const same = (p, q) => sqDist(p, q) < HIT_SQ;

  /** Applet GetPoint(i): the three starts on a circle about the board centre. */
  function getPoint(i) {
    return pt(
      WIDTH / 2 + RADIUS * Math.cos((i * 2 * Math.PI) / 3),
      HEIGHT / 2 + RADIUS * Math.sin((i * 2 * Math.PI) / 3),
    );
  }

  /** The position a new illustration starts from. */
  function start() {
    const A = getPoint(0), B = getPoint(1), C = getPoint(2);
    return {
      A, B, C,
      pts: null,          // copies of A, B, the midpoint of AB and C
      firstTime: true,    // m_FirstTime: the copies are made on the first Go
      addedC: false,      // C is appended after the second rotation
      phase: IDLE,        // -1 idle, 0 about A, 1 about C, 2 about B
      step: 0,
      total: 0,
      angle: 0,
      orientation: 1,
      trips: 0,           // our own count, for the spoken status only
    };
  }

  /** Applet PointIsEligible: the pointer must stay just inside the canvas. */
  function eligible(p) {
    return p.x > 2 && p.y > 0 && p.x < WIDTH && p.y < HEIGHT - 2;
  }

  /** A flat or zero-length triangle has no angle to rotate through. */
  function valid(s) {
    const area = (s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x);
    return Math.abs(area) > 1e-3 && dist(s.A, s.B) > 1e-3 &&
      dist(s.B, s.C) > 1e-3 && dist(s.C, s.A) > 1e-3;
  }

  /** Dragging a vertex clears the pivot line, as mousePressed/ClearPivotLine do. */
  function withVertex(state, name, p) {
    if (!STAGES.includes(name) || !eligible(p)) return state;
    return {
      ...state,
      [name]: copy(p),
      pts: null,
      firstTime: true,
      addedC: false,
      phase: IDLE,
      step: 0,
      total: 0,
      angle: 0,
      orientation: 1,
      trips: 0,
    };
  }

  /* -------------------------------- the geometry, transcribed from bytecode */

  /** LineOfPoints.ComputeAngle: the angle at p, in radians. */
  function computeAngle(p, q, r) {
    const n = sqDist(p, q) + sqDist(p, r) - sqDist(q, r);
    return Math.acos(n / (2 * dist(p, q) * dist(p, r)));
  }

  /** LineOfPoints.FindOrientation: sign of (q-p) × (r-p); zero counts as -1. */
  function findOrientation(p, q, r) {
    const value = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return value > 0 ? 1 : -1;
  }

  /** LineOfPoints.Rotate(centre, point, theta, orientation). */
  function rotate(centre, p, theta, orientation) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return pt(
      centre.x + c * (p.x - centre.x) - orientation * s * (p.y - centre.y),
      centre.y + orientation * s * (p.x - centre.x) + c * (p.y - centre.y),
    );
  }

  /** Number of animation steps run() uses for one vertex: round(a*6*10/pi)+1. */
  function steps(angle) {
    return Math.round((angle * 6 * 10) / Math.PI) + 1;
  }

  /** The angle, direction and step count for one stage of the current triangle. */
  function stageConfig(state, phase) {
    const pivot = STAGES[phase];
    const other = phase === 0 ? [state.B, state.C]
      : phase === 1 ? [state.A, state.B] : [state.C, state.A];
    const angle = computeAngle(state[pivot], other[0], other[1]);
    return {
      pivot,
      angle,
      orientation: findOrientation(state[pivot], other[0], other[1]),
      total: steps(angle),
    };
  }

  /* ------------------------------------- the animated trip, step by step */

  /** Press Go: seed the tracked copies on the first press, then start stage A. */
  function beginTrip(state) {
    if (state.phase !== IDLE || !valid(state)) return state;
    const pts = state.firstTime
      ? [copy(state.A), copy(state.B), midpoint(state.A, state.B)]
      : state.pts.map(copy);
    const cfg = stageConfig(state, 0);
    return {
      ...state,
      pts,
      phase: 0,
      step: 0,
      total: cfg.total,
      angle: cfg.angle,
      orientation: cfg.orientation,
    };
  }

  /**
   * One frame of run(): RotateThrough(angle/total, orientation) about the
   * current vertex, skipping the tracked point sitting on that vertex.
   * At the end of a stage the applet moves on to the next vertex; C's copy is
   * appended after the second stage, and the third stage finishes the trip.
   */
  function stepOnce(state) {
    if (state.phase === IDLE || !state.pts) return state;
    const pivot = state[STAGES[state.phase]];
    const theta = state.angle / state.total;
    const pts = state.pts.map((p) => (same(p, pivot) ? p : rotate(pivot, p, theta, state.orientation)));
    let step = state.step + 1;
    let phase = state.phase;
    let next = { ...state, pts, step };
    if (step >= state.total) {
      if (phase === 1 && !state.addedC) {
        next.pts = [...pts, copy(state.C)];
        next.addedC = true;
        next.firstTime = false;
      }
      phase += 1;
      if (phase === STAGES.length) {
        next.phase = IDLE;
        next.trips = state.trips + 1;
      } else {
        const cfg = stageConfig(state, phase);
        next.phase = phase;
        next.step = 0;
        next.angle = cfg.angle;
        next.orientation = cfg.orientation;
        next.total = cfg.total;
      }
    }
    return next;
  }

  /** Run a whole trip without waiting; used by the logic test. */
  function trip(state) {
    let s = beginTrip(state);
    for (let guard = 0; s.phase !== IDLE && guard < 10000; guard++) s = stepOnce(s);
    return s;
  }

  /* -------------------------------------- the incircle and the fixed point */

  /** Applet FindIncenter: the meet of two internal angle bisectors. */
  function incenter(A, B, C) {
    const orientation = findOrientation(A, B, C);
    const a = computeAngle(A, B, C);
    const b = computeAngle(B, C, A);
    return intersect(A, rotate(A, B, a / 2, orientation), B, rotate(B, C, b / 2, orientation));
  }

  /** Applet Intersect: the meet of the lines pq and rs, by Cramer's rule. */
  function intersect(p, q, r, s) {
    // The bytecode's locals S4, S6, S8, S10, S12, S14, S16, S18, S20.
    const s4 = p.y - q.y;
    const s6 = q.x - p.x;
    const s8 = p.x * q.y - p.y * q.x;
    const s10 = r.y - s.y;
    const s12 = s.x - r.x;
    const s14 = r.x * s.y - r.y * s.x;
    const s16 = s6 * s14 - s12 * s8;
    const s18 = s8 * s10 - s14 * s4;
    const s20 = s4 * s12 - s10 * s6;
    return pt(s16 / s20, s18 / s20);
  }

  /** Foot of the perpendicular from p onto the line ab. */
  function foot(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
    return pt(a.x + t * vx, a.y + t * vy);
  }

  /**
   * Tangent lengths from the vertices, and where the incircle touches AB.
   * With a = BC, b = CA, c = AB: tA = (b+c-a)/2, tB = (a+c-b)/2,
   * tC = (a+b-c)/2. The page's x, y, z are these three lengths in its own
   * side notation.
   */
  function tangentLengths(A, B, C) {
    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const tA = (b + c - a) / 2;
    const tB = (a + c - b) / 2;
    const tC = (a + b - c) / 2;
    return { a, b, c, tA, tB, tC, touchAB: foot(incenter(A, B, C), A, B) };
  }

  /** The composition of the three vertex rotations, without animation. */
  function mapPoint(p, A, B, C) {
    let q = p;
    q = rotate(A, q, computeAngle(A, B, C), findOrientation(A, B, C));
    q = rotate(C, q, computeAngle(C, A, B), findOrientation(C, A, B));
    return rotate(B, q, computeAngle(B, C, A), findOrientation(B, C, A));
  }

  /** The midpoint of AB is fixed exactly when CA = CB. */
  function midpointIsFixed(A, B, C) {
    const m = midpoint(A, B);
    return dist(mapPoint(m, A, B, C), m) < 1e-7;
  }

  return {
    WIDTH, HEIGHT, RADIUS, IDLE, STAGES, HIT_SQ,
    pt, copy, dist, sqDist, midpoint, getPoint, start, eligible, valid,
    withVertex, computeAngle, findOrientation, rotate, steps, stageConfig,
    beginTrip, stepOnce, trip, intersect, incenter, foot, tangentLengths,
    mapPoint, midpointIsFixed,
  };
})();
