"use strict";

/*
 * Circle Through the Incenter and Antiparallels — Alexander Bogomolny's
 * applet CircleThroughIncenter2, the fifth solution of problem 7 of the 2009
 * Australian Mathematical Olympiad. I is the incenter of triangle ABC; the
 * circle through A, I and B cuts the lines AC and BC again at X and Y. The
 * claim is AX = BY. The applet also marks J, the second crossing of the
 * circle with the bisector CI, because the arcs XA and YB are compared by
 * way of J.
 *
 * The key idea is that XY is antiparallel to AB in the angle at C: it makes
 * with one side the same angle that AB makes with the other, in reverse
 * order. Equal inscribed angles then give equal arcs XA and YB, hence equal
 * chords. This is a different theorem from the sibling "Circle Through
 * Incenter" applet: that one shows the circle's centre lies on the bisector
 * CI; this one is about the two lengths cut off on the sides.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CircleThroughIncenter2Core, so the page
 * loads it with a plain <script> and porting/check-circle-through-incenter-2.mjs
 * loads it in Node. Points are plain objects in the 400x300 board units and
 * every function returns fresh data.
 */
const CircleThroughIncenter2Core = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 18;                         // room for a handle and its label
  const DEG = 180 / Math.PI;
  const OPTION_KEYS = ["names", "statement", "premises", "hint"];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clampValue = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** Where p falls on the infinite line a->b, in units of |b-a|. */
  function parameter(p, a, b) {
    const v = sub(b, a);
    const n2 = dot(v, v);
    return n2 ? dot(sub(p, a), v) / n2 : 0;
  }

  /** The smaller angle between two undirected lines, in radians. */
  function lineAngle(u, v) {
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (!n) return 0;
    return Math.acos(clampValue(Math.abs(dot(u, v)) / n, -1, 1));
  }

  /** Angle at v between the rays v->p and v->q, in radians, in [0, PI]. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = dist(v, p) * dist(v, q);
    if (!n) return 0;
    return Math.acos(clampValue(dot(a, b) / n, -1, 1));
  }

  /** Keep a dragged handle inside the board, with room for its label. */
  function clamp(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return point(
      clampValue(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clampValue(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  /*
   * GeoSDoub.FindIncenter, written with side lengths instead of its two
   * half-angle rotations. Both give the same point: I = (aA + bB + cC) /
   * (a + b + c), with a = |BC|, b = |CA|, c = |AB|. The logic test compares
   * this with a method-for-method copy of the bytecode's rotation version.
   */
  function incenter(a, b, c) {
    const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
    const total = la + lb + lc;
    if (!total) return null;
    return point(
      (la * a.x + lb * b.x + lc * c.x) / total,
      (la * a.y + lb * b.y + lc * c.y) / total,
    );
  }

  /* Analytic form of GeoSDoub.FindCircumcenter (the intersection of two
   * perpendicular bisectors in the applet). */
  function circumcenter(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = dot(a, a), b2 = dot(b, b), c2 = dot(c, c);
    return point(
      (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    );
  }

  /** The applet's GetCircle: circumcentre, with the mean of the three radii. */
  function getCircle(a, b, c) {
    const centre = circumcenter(a, b, c);
    if (!finite(centre)) return null;
    return {
      c: centre,
      r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3,
    };
  }

  /*
   * GeoSDoub.Intersect(DoubCircle, DoubLine): IntersectX when the line's two
   * points differ in y by more than 1, else IntersectY when they differ in x
   * by more than 1, else no hits. Each method lists the point with the
   * larger coordinate first; keep that order, since Other() uses it. The
   * projection form here is the same pair of points without the line-equation
   * division.
   */
  function lineCircle(v, w, circle) {
    const dx = w.x - v.x, dy = w.y - v.y;
    let by;
    if (Math.abs(dy) > 1) by = "y";
    else if (Math.abs(dx) > 1) by = "x";
    else return [];
    const d = unit(point(dx, dy));
    const f = sub(v, circle.c);
    const along = dot(f, d);
    const disc = circle.r * circle.r - (dot(f, f) - along * along);
    if (disc < -1e-9) return [];
    const half = Math.sqrt(Math.max(0, disc));
    const foot = add(v, mul(d, -along));
    const hits = [add(foot, mul(d, half)), add(foot, mul(d, -half))];
    hits.sort((p, q) => (by === "y" ? q.y - p.y : q.x - p.x));
    return hits;
  }

  /** The applet's Other(points, vertex): the hit at least 1px away. */
  function other(points, vertex) {
    if (!points.length) return null;
    return dist(points[0], vertex) >= 1 ? points[0] : (points[1] || points[0]);
  }

  /**
   * The applet's Compute(): incenter, the circle through A, I and B, then
   * the second crossings X (with AC), Y (with BC) and J (with CI).
   */
  function compute(a, b, c) {
    if (![a, b, c].every(finite)) return null;
    if (dist(a, b) < 2 || dist(a, c) < 2 || dist(b, c) < 2) return null;
    if (Math.abs(cross(sub(b, a), sub(c, a))) < 1e-6) return null;
    const i = incenter(a, b, c);
    const circle = getCircle(a, b, i);
    if (!circle) return null;
    const xHits = lineCircle(a, c, circle);
    const yHits = lineCircle(b, c, circle);
    const jHits = lineCircle(c, i, circle);
    if (!xHits.length || !yHits.length || !jHits.length) return null;
    const x = other(xHits, a);
    const y = other(yHits, b);
    const j = other(jHits, i);
    if (![x, y, j].every(finite)) return null;
    return {
      A: a, B: b, C: c, I: i, X: x, Y: y, J: j, circle: circle,
      ax: dist(a, x), by: dist(b, y),
      tX: parameter(x, a, c), tY: parameter(y, b, c), tJ: parameter(j, c, i),
      angles: {
        // XY is antiparallel to AB: the order of the two side angles flips.
        toSide: lineAngle(sub(y, x), sub(a, c)),
        fromBase: lineAngle(sub(b, a), sub(b, c)),
        atA: angle(a, b, x),
        atY: angle(y, b, x),
      },
    };
  }

  /** The board as the applet's init() lays it out (400x300, centre, /4). */
  function start(options) {
    const o = options || {};
    const scale = Math.min(VIEW.width, VIEW.height) / 4; // the applet's s
    const cx = VIEW.x + VIEW.width / 2;
    const cy = VIEW.y + VIEW.height / 2;
    const onCircle = (a) => point(cx + scale * Math.cos(a), cy + scale * Math.sin(a));
    const opts = {
      names: o.names === undefined ? true : !!o.names,
      statement: !!o.statement,
      premises: !!o.premises,
      hint: !!o.hint,
    };
    return {
      A: onCircle(-1.6), B: onCircle(-4.0), C: onCircle(-0.2),
      options: opts, explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    const q = clamp(p);
    if (!q) return state;
    return Object.assign({}, state, { [name]: q, explored: true });
  }

  function setOption(state, name, on) {
    if (!OPTION_KEYS.includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C);
  }

  /* A picture, not a game: no win, no loss and no end. */
  function result(state) {
    return null;
  }

  /** The status line, spoken for the player's record as well as on screen. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Spread A, B and C apart to make a triangle.";
    const len = g.ax.toFixed(2);
    // The applet's Other() uses a 1px test; at an almost tangent cut it can
    // keep the vertex, so do not claim equal lengths in that rare case.
    if (Math.abs(g.ax - g.by) > 1e-6) {
      return "Almost tangent at a corner: the second cut is under a pixel away, so the mark stays on the corner.";
    }
    if (state.options.hint) {
      return `The arcs XA and YB match, so their chords match too: AX = BY = ${len}.`;
    }
    if (state.options.statement) {
      return `The two marked lengths are equal: AX = BY = ${len}.`;
    }
    return `The circle through A, I and B cuts the sides again at X and Y. Watch AX and BY stay equal as you drag.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, DEG: DEG, OPTION_KEYS: OPTION_KEYS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, unit: unit, finite: finite,
    clamp: clamp, parameter: parameter, angle: angle, lineAngle: lineAngle,
    incenter: incenter, circumcenter: circumcenter, getCircle: getCircle,
    lineCircle: lineCircle, other: other, compute: compute,
    start: start, reset: reset, move: move, setOption: setOption,
    geometry: geometry, result: result, describe: describe,
  };
})();
