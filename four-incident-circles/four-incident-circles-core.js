"use strict";

/*
 * Four Incident Circles — Alexander Bogomolny's applet FourIncidentCircles.
 *
 * Four circles of the same radius all pass through one point O.  The four
 * external common tangents between neighbouring circles cut out a
 * quadrilateral, and the old page claims that its four corners always lie on
 * a circle.  The applet keeps the picture true by rescaling the other three
 * centres whenever one is dragged: every centre stays R from O and every
 * circle keeps radius R.  This file is that geometry and nothing else: no
 * document, no window, no storage.  It defines one global,
 * FourIncidentCirclesCore, so it loads with a plain <script> and
 * porting/check-four-incident-circles.mjs can load it in Node.
 *
 * Point and state objects are plain data; every operation returns a fresh
 * state, so the position can be saved for the tutor as it is.
 */

const FourIncidentCirclesCore = (() => {
  /* The applet on the cut-the-knot page is 560 x 500; Reset uses min(w, h)/6
   * with integer division, so the common radius is exactly 83. */
  const VIEW = { x: 0, y: 0, width: 560, height: 500 };
  const CENTER = { x: 280, y: 250 };
  const RADIUS = Math.floor(Math.min(VIEW.width, VIEW.height) / 6);
  /* The four angles in the applet's Reset, in radians, screen y pointing down. */
  const START_ANGLES = [
    0.5235987755982988,
    2.6179938779914944,
    3.765191430678208,
    5.235987755982989,
  ];
  const PAD = 10;

  const point = (x, y) => ({ x, y });
  const copy = (p) => point(p.x, p.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a dragged centre in the board, like the applet's mover bounds. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** The position the applet draws after init(): four centres on a circle. */
  function start(options) {
    const o = options || {};
    return {
      center: copy(CENTER),
      radius: RADIUS,
      A: START_ANGLES.map((a) => point(CENTER.x + RADIUS * Math.cos(a), CENTER.y + RADIUS * Math.sin(a))),
      options: {
        hint: o.hint === true,
        names: o.names === true,
      },
      explored: false,
    };
  }

  /** Reset from the applet: same starting picture, same checkboxes. */
  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /**
   * A drag.  The applet moves the chosen centre to the pointer, measures its
   * new distance d from O, then scales each other centre along its ray from O
   * to that same distance and gives every circle radius d.  So the four
   * centres stay concyclic and all four circles still pass through O.
   */
  function move(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index > 3 || !p || !finite(p)) return state;
    const q = clamp(copy(p));
    const d = dist(state.center, q);
    if (!(d > 1e-9)) return state; // the applet has no circle at zero radius
    const A = state.A.slice();
    A[index] = q;
    for (let j = 0; j < 4; j++) {
      if (j === index) continue;
      const old = dist(state.center, A[j]);
      if (old > 0) {
        const k = d / old;
        A[j] = point(state.center.x + (A[j].x - state.center.x) * k,
                     state.center.y + (A[j].y - state.center.y) * k);
      }
    }
    return Object.assign({}, state, { A, radius: d, explored: true });
  }

  function setOption(state, name, on) {
    if (name !== "hint" && name !== "names") return state;
    const options = Object.assign({}, state.options, { [name]: !!on });
    return Object.assign({}, state, { options, explored: true });
  }

  /* ---- the applet's own geometry, in its own order of operations ---- */

  /** GeoSDoub.Intersect: NaN coordinates when the lines are parallel. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / den, (a2 * c1 - a1 * c2) / den);
  }

  /** GeoSDoub.NearestPoint: the foot on the whole line, with the applet's
   * 0.1 short cut when the point is essentially an endpoint. */
  function nearestPoint(p, a, b) {
    if (dist(p, a) * dist(p, a) < 0.1) return copy(a);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return copy(a);
    const t = dot(sub(b, a), sub(p, a)) / len2;
    return point(a.x + t * dx, a.y + t * dy);
  }

  /** GeoSDoub.FindCircumcenter, and the applet's mean of the three radii. */
  function circumcircle(p1, p2, p3) {
    const m1 = point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    const m2 = point((p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
    const q1 = point(m1.x + (p2.y - p1.y), m1.y - (p2.x - p1.x));
    const q2 = point(m2.x + (p3.y - p2.y), m2.y - (p3.x - p2.x));
    const c = lineIntersection(m1, q1, m2, q2);
    if (!finite(c)) return null;
    const r = (dist(c, p1) + dist(c, p2) + dist(c, p3)) / 3;
    return { center: c, radius: r };
  }

  /**
   * The applet's GetCommonTangent: two offset lines, then whichever is
   * farther from the common point O.  Null when the centres are under one
   * unit apart, exactly as the applet's d < 1 test.
   */
  function commonTangent(c1, c2, radius, center) {
    const d = dist(c1.c, c2.c);
    if (d < 1) return null;
    const t = radius / d;
    const ox = (c1.c.y - c2.c.y) * t;
    const oy = (c2.c.x - c1.c.x) * t;
    const plus = [add(c1.c, point(ox, oy)), add(c2.c, point(ox, oy))];
    const minus = [sub(c1.c, point(ox, oy)), sub(c2.c, point(ox, oy))];
    const nearPlus = nearestPoint(center, plus[0], plus[1]);
    const nearMinus = nearestPoint(center, minus[0], minus[1]);
    return dist(center, nearPlus) >= dist(center, nearMinus) ? plus : minus;
  }

  /** Angle at v between the rays to p and q, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** Everything the picture draws, from a plain state. */
  function geometry(state) {
    const circles = state.A.map((c) => ({ c: copy(c), r: state.radius }));
    const tangents = [];
    for (let i = 0; i < 4; i++) {
      tangents.push(commonTangent(circles[i], circles[(i + 1) % 4], state.radius, state.center));
    }
    const result = {
      circles, tangents, vertices: [], outer: null, angles: [],
      cyclicError: Infinity, parallelError: 0, degenerate: false,
      centerDistances: state.A.map((p) => dist(state.center, p)),
    };
    if (tangents.some((t) => !t)) {
      result.degenerate = true;
      return result;
    }

    /* DrawOuterCircle uses T0∩T1, T1∩T2 and T2∩T3; Draw labels the fourth
     * corner B1 at T3∩T0. */
    const crossAt = (i) => {
      const j = (i + 1) % 4;
      return lineIntersection(tangents[i][0], tangents[i][1], tangents[j][0], tangents[j][1]);
    };
    const b2 = crossAt(0), b3 = crossAt(1), b4 = crossAt(2), b1 = crossAt(3);
    const vertices = [b1, b2, b3, b4];
    result.vertices = vertices;
    if (!vertices.every(finite)) {
      result.degenerate = true;
      return result;
    }
    result.outer = circumcircle(b2, b3, b4);
    if (!result.outer) {
      result.degenerate = true;
      return result;
    }
    result.cyclicError = Math.abs(dist(result.outer.center, b1) - result.outer.radius);
    result.angles = vertices.map((b, i) => angle(b, vertices[(i + 3) % 4], vertices[(i + 1) % 4]));

    /* A tangent is parallel to the chord joining the two centres. */
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const side = sub(circles[j].c, circles[i].c);
      const along = sub(tangents[i][1], tangents[i][0]);
      const n = Math.hypot(side.x, side.y) * Math.hypot(along.x, along.y);
      if (n > 0) result.parallelError = Math.max(result.parallelError, Math.abs(cross(side, along)) / n);
    }
    return result;
  }

  /* This is a picture, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /** The sentence under the picture: the checkerboard of claims in words. */
  function describe(state) {
    const g = geometry(state);
    if (g.degenerate) {
      return "Two centres are too close for a tangent. Drag one away from the red point.";
    }
    if (state.options.hint) {
      return "Every centre is " + state.radius.toFixed(1) + " units from the red point, and each tangent is parallel to the chord between two centres. The four corners stay on one circle.";
    }
    return "Four equal circles meet at the red point. The four straight tangents make a quadrilateral whose corners lie on one circle.";
  }

  return {
    VIEW, CENTER, RADIUS, START_ANGLES, PAD,
    point, copy, sub, add, mul, dot, cross, dist, finite, clamp,
    start, reset, move, setOption,
    lineIntersection, nearestPoint, circumcircle, commonTangent, angle,
    geometry, result, describe,
  };
})();
