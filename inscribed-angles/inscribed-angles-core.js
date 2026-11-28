"use strict";

/*
 * Inscribed Angles — the drawing and its test, from Alexander Bogomolny's
 * InscribedAngles applet (the original page is a "Mathematical Droodle").
 *
 * Four points A, B, C and D can be dragged. The circle is always the one
 * through A, C and D; B starts on it but may be pulled off. When B is on that
 * circle the two inscribed angles CAD and CBD subtend the same chord CD, so
 * (when A and B lie on the same arc) they are equal. The old applet's own
 * test uses *directed* angles: it calls GeoSDoub.ComputeSignedAngle(A,C,D)
 * and ComputeSignedAngle(B,C,D) and calls the picture Equal when their
 * difference is under 0.1 radian; it also requires B to be within 2 board
 * units of the circle through A, C and D. Those two tolerances and the
 * circumcircle formula from GeoSDoub.FindCircumcenter are kept exactly here,
 * so the page's status and Hint box follow the applet, not a textbook.
 *
 * There is no win and no loss: this is a drawing to explore.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, InscribedAnglesCore, so the page loads it
 * with a plain <script> and porting/check-inscribed-angles.mjs loads it in
 * Node. Positions are plain data (numbers, strings, arrays, plain objects);
 * functions take a position and return a new one, never changing the input.
 */
const InscribedAnglesCore = (() => {
  // InscribedAnglesCanvas.init(), with the applet's suggested 400 x 300 size.
  const VIEW = { width: 400, height: 300 };
  const CENTER = { x: 200, y: 150 };
  const RADIUS = 100; // min(width/2, height/2) * 2 / 3
  const START_RANDOM = 0.5; // a fixed draw of Math.random(), so Reset is repeatable

  // InscribedAnglesCanvas.IsOnCircle and CheckFinished, both literal.
  const ON_CIRCLE_TOL = 2;
  const EQUAL_TOL = 0.1;

  // Presentation only: keep a handle on the board and away from its neighbours.
  const EDGE = 12;
  const MIN_GAP = 10;
  const NAMES = ["A", "B", "C", "D"];

  const pt = (x, y) => ({ x, y });
  const clampCoord = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const deg = (rad) => (rad * 180) / Math.PI;

  /** GeoSDoub pointOnCircle, with the canvas y axis pointing down. */
  function pointOnCircle(c, r, angle) {
    return pt(c.x + r * Math.cos(angle), c.y + r * Math.sin(angle));
  }

  /* GeoSDoub.FindCircumcenter(a,b,c), transcribed from the bytecode:
   * midpoints of AB and BC, perpendicular directions, then
   * GeoSDoub.Intersect of the two lines. That Intersect returns NaN for a
   * determinant whose absolute value is below 1 - a quirk worth keeping,
   * because a nearly straight A-C-D then has no usable circle. */
  function circumcenter(a, b, c) {
    const mid1 = pt((a.x + b.x) / 2, (a.y + b.y) / 2);
    const mid2 = pt((b.x + c.x) / 2, (b.y + c.y) / 2);
    const p = pt(mid1.x + b.y - a.y, mid1.y - b.x + a.x);
    const q = pt(mid2.x + c.y - b.y, mid2.y - c.x + b.x);
    // GeoSDoub.Intersect(mid1, p, mid2, q), line coefficients in its own order.
    const a1 = mid1.y - p.y, b1 = p.x - mid1.x;
    const c1 = mid1.x * p.y - mid1.y * p.x;
    const a2 = mid2.y - q.y, b2 = q.x - mid2.x;
    const c2 = mid2.x * q.y - mid2.y * q.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** DoubCircle from GetCircle: centre = circumcenter, radius = mean distance. */
  function circleThrough(a, b, c) {
    const center = circumcenter(a, b, c);
    const r = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { c: center, r };
  }

  /* GeoSDoub.FindOrientation(a,b,c): sign of the cross product (b-a)x(c-a),
   * +1 for a positive turn, -1 otherwise (zero counts as -1). */
  function orientation(a, b, c) {
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(o,p,q): signed angle at o, from op to oq. */
  function signedAngle(o, p, q) {
    const cos = (sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) /
      (2 * dist(o, p) * dist(o, q));
    const a = Math.acos(cos);
    return orientation(o, p, q) === 1 ? a : -a;
  }

  /** The unsigned angle at o, for the words on the status line. */
  function angle(o, p, q) {
    return Math.abs(signedAngle(o, p, q));
  }

  /* Pure measurement of four points, as InscribedAnglesCanvas.CheckFinished
   * does on every repaint: rebuild ACD, test B, then compare the two directed
   * angles. The applet only replaces Equal while B is on the circle; `refresh`
   * below keeps that stale value in the state. */
  function measure(points) {
    const circle = circleThrough(points.A, points.C, points.D);
    const onCircle = Math.abs(dist(points.B, circle.c) - circle.r) < ON_CIRCLE_TOL;
    const signedCAD = signedAngle(points.A, points.C, points.D);
    const signedCBD = signedAngle(points.B, points.C, points.D);
    const difference = Math.abs(signedCAD - signedCBD);
    return {
      circle, onCircle, signedCAD, signedCBD, difference,
      equal: onCircle && difference < EQUAL_TOL,
      distanceToCircle: Math.abs(dist(points.B, circle.c) - circle.r),
      angleCAD: Math.abs(signedCAD), angleCBD: Math.abs(signedCBD),
    };
  }

  /** Attach the measured picture to a position, preserving the old `equal`. */
  function refresh(state) {
    const m = measure(state);
    const equal = m.onCircle ? m.difference < EQUAL_TOL : state.equal;
    return Object.assign({}, state, { measured: m, equal, onCircle: m.onCircle });
  }

  /** Keep a handle inside the board and clear of its three neighbours. */
  function clamp(p, points, name) {
    let q = pt(clampCoord(p.x, EDGE, VIEW.width - EDGE), clampCoord(p.y, EDGE, VIEW.height - EDGE));
    for (const other of NAMES) {
      if (other === name) continue;
      const d = dist(q, points[other]);
      if (!(d >= MIN_GAP)) {
        const dx = d > 1e-9 ? (q.x - points[other].x) / d : 1;
        const dy = d > 1e-9 ? (q.y - points[other].y) / d : 0;
        q = pt(clampCoord(points[other].x + dx * MIN_GAP, EDGE, VIEW.width - EDGE),
          clampCoord(points[other].y + dy * MIN_GAP, EDGE, VIEW.height - EDGE));
      }
    }
    return q;
  }

  /** InscribedAnglesCanvas.init(): four points on one circle, fixed seed. */
  function start(options) {
    const o = options || {};
    const random = clampCoord(Number.isFinite(o.random) ? o.random : START_RANDOM, 0, 1);
    const theta = Math.PI / 8 + (Math.PI / 4) * random;
    // The applet really adds 40.0 *radians* to D's angle; keep that quirk.
    const dAngle = theta + (3 * Math.PI) / 2 + 40;
    const points = {
      A: pointOnCircle(CENTER, RADIUS, theta),
      B: pointOnCircle(CENTER, RADIUS, theta + Math.PI / 2),
      C: pointOnCircle(CENTER, RADIUS, theta + Math.PI),
      D: pointOnCircle(CENTER, RADIUS, dAngle),
    };
    return refresh({
      A: points.A, B: points.B, C: points.C, D: points.D,
      showNames: o.showNames === undefined ? false : !!o.showNames,
      hint: o.hint === undefined ? false : !!o.hint,
      explored: false,
      equal: false,
    });
  }

  /** Drag one point. The other three stay where they are. */
  function move(state, name, p) {
    if (!NAMES.includes(name) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const points = { A: state.A, B: state.B, C: state.C, D: state.D };
    points[name] = clamp(p, points, name);
    return refresh(Object.assign({}, state, points, { explored: true }));
  }

  /** The two checkboxes. Hint is disabled (and cannot be ticked) off circle. */
  function setOption(state, key, value) {
    if (key === "showNames") return Object.assign({}, state, { showNames: !!value });
    if (key === "hint") {
      if (!state.onCircle && value) return state;
      return Object.assign({}, state, { hint: !!value });
    }
    return state;
  }

  /** Reset the picture, keeping the boxes and the fact that it was explored. */
  function reset(state) {
    const fresh = start({
      showNames: state.showNames,
      hint: state.hint,
    });
    return Object.assign(fresh, { explored: !!state.explored, equal: state.equal });
  }

  /** A drawing has no result: no win, no loss, no end to play. */
  function result(state) {
    return null;
  }

  /** Words for status: what the applet's two tests just found. */
  function describe(state) {
    const m = state.measured || measure(state);
    if (!m.onCircle) {
      return `B is ${m.distanceToCircle.toFixed(1)} units off the circle through A, C and D. ` +
        `Drag it back to compare the angles; Hint is unavailable.`;
    }
    if (m.difference < EQUAL_TOL) {
      return `B is on the circle. ∠CAD = ∠CBD = ${deg(m.angleCAD).toFixed(1)}° — ` +
        `the two angles match.`;
    }
    return `B is on the circle, but on the other arc: ∠CAD = ${deg(m.angleCAD).toFixed(1)}° ` +
      `and ∠CBD = ${deg(m.angleCBD).toFixed(1)}°. Move B to A's arc to make them match.`;
  }

  return {
    VIEW, CENTER, RADIUS, START_RANDOM, ON_CIRCLE_TOL, EQUAL_TOL, NAMES,
    pt, clamp, dist, sqDist, deg, pointOnCircle, orientation, signedAngle, angle,
    circumcenter, circleThrough, measure, refresh, start, move, setOption,
    reset, result, describe,
  };
})();
