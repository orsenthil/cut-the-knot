"use strict";

/*
 * Equilateral Triangle on Parallel Lines — Alexander Bogomolny's
 * EquilateralOnLines applet. Three horizontal lines carry one draggable point
 * each: C on line 0, C1 on line 1, C2 on line 2. Slide the points or drag a
 * line up and down to try to make C, C1 and C2 an equilateral triangle.
 *
 * The one idea behind the code is the applet's rotation construction: rotate
 * line 1 about C through 60 degrees in either direction; its intersection with
 * line 2 is the image B of C1, and rotating B back gives C1 = A. Because a
 * rotation preserves length and turns through 60 degrees, CA = CB and the
 * angle at C is 60 degrees, so ABC is equilateral. For each fixed C there are
 * two such triangles, one for each rotation direction.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, EquilateralOnLinesCore, so the page loads it
 * with a plain <script> and porting/check-equilateral-on-lines.mjs can load it
 * in Node. All positions are plain objects in the SVG viewBox units.
 *
 * Faithful quirks of the original kept here: the coefficient of a point on a
 * line is stored in DoubLine.CreateMidPoint's reversed convention (t=0 is the
 * right end); GeoSDoub.Intersect returns NaN when |det| < 1; Compute() snaps a
 * point to a solution from within 3px and declares success within 1px, after
 * trying the two orientations in that order. The Rotation slider is the
 * applet's Scrollbar(0, 0, 5, 0, 65): an integer 0..65, starting at 0.
 */

const EquilateralOnLinesCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const LEFT = 10;                    // InitLines: endpoints at x = 10 and width-10
  const RIGHT = VIEW.width - 10;
  const Y_MIN = 10, Y_MAX = VIEW.height - 10;
  const SIXTY = Math.PI / 3;
  const DEFAULT_Y = [120, 170, 225]; // one deterministic stand-in for the random starts
  const DEFAULT_COEF = [0.5, 0.5, 0.5];
  const ANGLE_MIN = 0, ANGLE_MAX = 65;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampX = (x) => clamp(x, LEFT, RIGHT);
  const clampY = (y) => clamp(y, Y_MIN, Y_MAX);
  const point = (x, y) => ({ x, y });
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const lerp = (a, b, t) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const lineOf = (y) => ({ a: point(LEFT, y), b: point(RIGHT, y) });

  /** DoubLine.CreateMidPoint(t): t weights the LEFT end, reversed from PointOnLine. */
  function createMidPoint(line, t) {
    return point(line.a.x * t + line.b.x * (1 - t), line.a.y * t + line.b.y * (1 - t));
  }

  /** The canvas's private PointOnLine(DoubLine, t): t weights the second end. */
  function pointOnLine(line, t) {
    return point(line.b.x * t + line.a.x * (1 - t), line.b.y * t + line.a.y * (1 - t));
  }

  /** GeoSDoub.Rotate(centre, q, angle, dir), with y growing downwards. */
  function rotate(centre, q, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = q.x - centre.x, dy = q.y - centre.y;
    return point(centre.x + c * dx - dir * s * dy,
                 centre.y + dir * s * dx + c * dy);
  }

  /** GeoSDoub.Intersect(a,b,c,d): NaN coordinates when |det| < 1. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.NearestPoint(p, a, b): foot of the perpendicular to line a-b. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.1) return point(p.x, p.y);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return point(a.x + dx * t, a.y + dy * t);
  }

  /** A raw position: lines are horizontal, points lie on their own line. */
  function make(config) {
    const o = config || {};
    const lines = (o.lines || DEFAULT_Y).map(clampY).slice(0, 3);
    while (lines.length < 3) lines.push(DEFAULT_Y[lines.length]);
    const coef = (o.coef || DEFAULT_COEF).map((t) => clamp(t, 0, 1)).slice(0, 3);
    while (coef.length < 3) coef.push(0.5);
    const points = lines.map((y, i) => {
      const p = o.points && o.points[i];
      return p ? point(clampX(p.x), y) : createMidPoint(lineOf(y), coef[i]);
    });
    return {
      lines: lines,
      coef: coef,
      points: points,
      angle: clamp(Math.round(o.angle === undefined ? 0 : o.angle), ANGLE_MIN, ANGLE_MAX),
      hint: !!o.hint,
      names: o.names === undefined ? true : !!o.names,
      explored: !!o.explored,
      finished: false,
      solvedIndex: -1,
    };
  }

  /**
   * The canvas's Compute(), before ClipPoints(): for both directions build
   * the line rotated through the slider angle (the blue guide), the image of
   * C1 on it (the yellow dot), the foot from C (dashed blue), and the two
   * candidate triangles from a 60 degree rotation of line 1.
   */
  function geometry(state) {
    const C = state.points[0];
    const line1 = lineOf(state.lines[1]);
    const line2 = lineOf(state.lines[2]);
    const p0 = pointOnLine(line1, 0);
    const p1 = pointOnLine(line1, 1);
    const theta = state.angle * Math.PI / 180;
    const solutions = [];
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const r0 = rotate(C, p0, theta, sign);
      const r1 = rotate(C, p1, theta, sign);
      const rotated = { a: r0, b: r1 };
      const image = createMidPoint(rotated, state.coef[1]);
      const foot = nearestPoint(C, r0, r1);
      const q0 = rotate(C, p0, SIXTY, sign);
      const q1 = rotate(C, p1, SIXTY, sign);
      const B = intersect(q0, q1, line2.a, line2.b);
      const A = rotate(C, B, SIXTY, -sign);
      solutions.push({ sign: sign, rotated: rotated, image: image,
        foot: foot, A: A, B: B });
    }
    return {
      lines: state.lines.map(lineOf),
      points: state.points.map((p) => point(p.x, p.y)),
      solutions: solutions,
      angle: state.angle,
    };
  }

  /**
   * One repaint of the applet: Compute() then ClipPoints(), then the Finished
   * test. A point within 3px of a candidate is snapped to it; success needs
   * both points within 1px of the same candidate. The two candidates are tried
   * in order, so the second can overwrite a snap made by the first.
   */
  function settle(state) {
    const g = geometry(state);
    const points = state.points.map((p) => point(p.x, p.y));
    for (let i = 0; i < 2; i++) {
      if (dist(points[1], g.solutions[i].A) < 3) {
        points[1] = point(g.solutions[i].A.x, g.solutions[i].A.y);
      }
      if (dist(points[2], g.solutions[i].B) < 3) {
        points[2] = point(g.solutions[i].B.x, g.solutions[i].B.y);
      }
    }
    let solvedIndex = -1;
    for (let i = 0; i < 2; i++) {
      if (dist(points[1], g.solutions[i].A) < 1 &&
          dist(points[2], g.solutions[i].B) < 1) {
        solvedIndex = i;
        break;
      }
    }
    return Object.assign({}, state, {
      points: points,
      finished: solvedIndex >= 0,
      solvedIndex: solvedIndex,
    });
  }

  /** The starting picture; a demo has no win and no loss. */
  function start(options) {
    return settle(make(options));
  }

  /** InitLines(): the three random offsets and coefficients of the applet. */
  function shuffle(state, rand) {
    const r = typeof rand === "function" ? rand : Math.random;
    const gap = VIEW.height / 6;
    const offsets = [1, -1, 2].map((k) => k * gap * r());
    const coef = [0, 1, 2].map(() => 0.3 + 0.4 * r());
    return settle(make({
      lines: offsets.map((o) => VIEW.height / 2 + o),
      coef: coef,
      angle: state ? state.angle : 0,
      hint: state ? state.hint : false,
      names: state ? state.names : true,
      explored: state ? state.explored : false,
    }));
  }

  function reset(state) {
    return settle(make({
      angle: state ? state.angle : 0,
      hint: state ? state.hint : false,
      names: state ? state.names : true,
    }));
  }

  /** Drag one of the three points; it is projected back onto its own line. */
  function movePoint(state, i, p) {
    if (!Number.isInteger(i) || i < 0 || i > 2 || !p ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const q = point(clampX(p.x), state.lines[i]);
    const coef = state.coef.slice();
    coef[i] = (RIGHT - q.x) / (RIGHT - LEFT);
    const points = state.points.slice();
    points[i] = q;
    return settle(Object.assign({}, state, { coef: coef, points: points, explored: true }));
  }

  /** Drag a whole line up or down; its point keeps its coefficient. */
  function moveLine(state, i, dy) {
    if (!Number.isInteger(i) || i < 0 || i > 2 || !Number.isFinite(dy)) return state;
    const y = clampY(state.lines[i] + dy);
    const lines = state.lines.slice();
    lines[i] = y;
    const points = state.points.slice();
    points[i] = createMidPoint(lineOf(y), state.coef[i]);
    return settle(Object.assign({}, state, { lines: lines, points: points, explored: true }));
  }

  /** The applet's Rotation scrollbar: 0..65, integral. */
  function setAngle(state, value) {
    if (!Number.isFinite(value)) return state;
    const angle = clamp(Math.round(value), ANGLE_MIN, ANGLE_MAX);
    if (angle === state.angle) return state;
    return settle(Object.assign({}, state, { angle: angle, explored: true }));
  }

  function setOption(state, name, on) {
    if (name !== "hint" && name !== "names") return state;
    if (state[name] === !!on) return state;
    return settle(Object.assign({}, state, { [name]: !!on, explored: true }));
  }

  /* A picture, not a game: even a matched triangle does not win or lose. */
  function result(state) {
    return null;
  }

  /** The status line: short, plain, and faithful to what the picture shows. */
  function describe(state) {
    if (state.finished) {
      return "C, A and B form an equilateral triangle: one point on each line.";
    }
    if (state.hint) {
      return "The two red triangles are the two ways to turn line 1 by 60 degrees to reach line 2.";
    }
    if (state.angle > 0) {
      return "The blue lines are line 1 turned by " + state.angle + " degrees about C.";
    }
    return "Slide C1 and C2 along their lines, or move a line up or down, until the three points make an equilateral triangle.";
  }

  return {
    VIEW: VIEW, LEFT: LEFT, RIGHT: RIGHT, Y_MIN: Y_MIN, Y_MAX: Y_MAX,
    SIXTY: SIXTY, ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX,
    DEFAULT_Y: DEFAULT_Y, DEFAULT_COEF: DEFAULT_COEF,
    clamp: clamp, clampX: clampX, clampY: clampY, point: point,
    sqDist: sqDist, dist: dist, lerp: lerp, lineOf: lineOf,
    createMidPoint: createMidPoint, pointOnLine: pointOnLine,
    rotate: rotate, intersect: intersect, nearestPoint: nearestPoint,
    make: make, geometry: geometry, settle: settle,
    start: start, shuffle: shuffle, reset: reset,
    movePoint: movePoint, moveLine: moveLine,
    setAngle: setAngle, setOption: setOption,
    result: result, describe: describe,
  };
})();
