"use strict";

/*
 * Foot Of Altitude — the geometry behind Alexander Bogomolny's applet
 * FootOfAltitude (cut-the-knot.org/Curriculum/Geometry/FootOfAltitude.shtml).
 *
 * A triangle ABC is drawn with a point D on the line BC. Dropping perpendiculars
 * from D to the lines AC and AB gives E and F. The cut-the-knot page asks where
 * D must be for EF to be shortest: at the foot of the altitude from A. It also
 * gives the identity EF = AD * sin(angle EDF); because AEDF is cyclic with AD
 * as a diameter, angle EDF does not change as D slides along BC, so the shortest
 * EF comes with the shortest AD. The page expressly rejects Honsberger's
 * exception for an obtuse base angle; the applet itself lets D slide past B and
 * C (Fix(2) holds its y coordinate), so the foot can lie outside the side.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, FootOfAltitudeCore. Positions are plain data, so the page and the
 * tutor share them. The projection, circumcircle and finish test below follow
 * GeoSDoub.NearestPoint, GetCircumcircle and CheckFinished from the bytecode.
 */

const FootOfAltitudeCore = (() => {
  // The canvas is 400 units wide; its "optimal" height parameter is 250.
  const WIDTH = 400;
  const HEIGHT = 250;
  const NAMES = ["A", "B", "C", "D"];
  // The applet calls Fix(2) on B, C and D: only their x coordinate can move.
  const HORIZONTAL = ["B", "C", "D"];
  const OPTION_KEYS = ["showNames", "showPremise", "showHint"];
  const MARGIN = 6;
  const MIN_SEPARATION = 12;
  // CheckFinished: dist(D, foot) < 1 (in canvas units) lights up the eyes.
  const FINISH_DISTANCE = 1;

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const twiceArea = (a, b, c) => cross(sub(b, a), sub(c, a));

  /* GeoSDoub.NearestPoint(P, A, B), transcribed from the bytecode: it projects
     onto the *infinite* line AB, and returns P itself when |PA|^2 < 0.1. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect(a,b,c,d): the two infinite lines, NaN if |det| < 1. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - b2 * c1) / det,
      y: (c1 * a2 - c2 * a1) / det,
    };
  }

  /** GeoSDoub.FindCircumcenter, then GetCircumcircle: mean of the three radii. */
  function circumcircle(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
    const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
    const center = lineIntersection(ab, p, bc, q);
    if (!finite(center)) return null;
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { center, radius };
  }

  /** Angle at v between the rays to p and q, in radians in [0, PI]. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    return Math.acos(clamp(dot(a, b) / (la * lb), -1, 1));
  }

  /** The opening picture: the same relative positions as FootOfAltitudeCanvas.init. */
  function start(options) {
    const o = options || {};
    const ay = HEIGHT / 5;
    const by = (HEIGHT * 5) / 6;
    const state = {
      A: { x: WIDTH / 1.8, y: ay },
      B: { x: WIDTH / 6, y: by },
      C: { x: (5 * WIDTH) / 6, y: by },
      D: { x: (WIDTH / 6 + (5 * WIDTH) / 6) / 2, y: by },
      showNames: true,   // the applet's ShowNames parameter defaults to 1
      showPremise: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    for (const name of NAMES) {
      if (o[name] && finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  function clampPoint(p) {
    return {
      x: clamp(p.x, MARGIN, WIDTH - MARGIN),
      y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
    };
  }

  /**
   * Everything the drawing needs at one position. D0 is the foot of the
   * altitude from A; E0 and F0 are its projections, so |E0F0| is the applet's
   * ComputeMinimum() and |EF| is the length drawn as the orange bar.
   */
  function compute(state) {
    const { A, B, C, D } = state;
    if (![A, B, C, D].every(finite)) return { degenerate: true, circle: null };
    const degenerate = Math.abs(twiceArea(A, B, C)) < 1e-9;
    const E = nearestPoint(D, A, C);
    const F = nearestPoint(D, A, B);
    const D0 = nearestPoint(A, B, C);
    const E0 = nearestPoint(D0, A, C);
    const F0 = nearestPoint(D0, A, B);
    const minLength = dist(E0, F0);
    const ef = dist(E, F);
    const circle = circumcircle(A, E, F);
    const ad = dist(A, D);
    const angle = angleAt(D, E, F);
    return {
      degenerate,
      E, F, D0, E0, F0,
      minLength, ef, ad, angle,
      angle0: angleAt(D0, E0, F0),
      circle,
      // CheckFinished: within one canvas unit of the altitude foot.
      finished: dist(D0, D) < FINISH_DISTANCE,
      // DoubPointSubscriptNice.SetCenter uses the rounded centroid.
      center: {
        x: Math.round((A.x + B.x + C.x) / 3),
        y: Math.round((A.y + B.y + C.y) / 3),
      },
    };
  }

  /** The moves a player can make: drag one of four points, three switches, reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null when the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      // Fix(2) in the applet keeps these three points on the base line.
      if (HORIZONTAL.includes(m.name)) p.y = state[m.name].y;
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < MIN_SEPARATION)) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A droodle has no win or loss; a play is over once the picture is changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, NAMES, HORIZONTAL, OPTION_KEYS, MARGIN, FINISH_DISTANCE,
    sub, add, mul, dot, cross, dist, sqDist, midpoint, finite, clamp, twiceArea,
    nearestPoint, lineIntersection, circumcircle, angleAt, clampPoint,
    start, compute, legalMoves, move, result,
  };
})();
