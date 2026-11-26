"use strict";

/*
 * Adjacent Incircles, from Alexander Bogomolny's applet AdjacentIncircles.
 *
 * Apex A and points M0..M(n-1) on one straight line form a fan of triangles.
 * When the circles inscribed in the neighbouring triangles Mi A M(i+1) all
 * have the same radius, the circles in every wider triangle Mi A M(i+k) do
 * too. The key identity is r = h/2 * (1 - g(i)/g(i+1)), where h is the
 * distance from A to the base line and g(i) = (AMi + signed offset of Mi from
 * the foot of the altitude) / h. Equal radii therefore make the g(i) a
 * geometric progression, and the same ratio governs every level k.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, AdjacentIncirclesCore, so the page loads it
 * with a plain <script> and porting/check-adjacent-incircles.mjs loads it in
 * Node. The position is plain data and every function returns a new position.
 */
const AdjacentIncirclesCore = (() => {
  const N_MIN = 3;
  const N_MAX = 10;
  const N_DEFAULT = 4;
  /** The applet's own test treats radii within one pixel as equal. */
  const MATCH = 1;
  const EPS = 1e-10;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Foot of the perpendicular from p onto the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Inradius of a triangle: area / semiperimeter, by Heron's formula. */
  function inradius(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const s = (x + y + z) / 2;
    if (s <= 0) return 0;
    const product = (s - x) * (s - y) * (s - z);
    return product > 0 ? Math.sqrt(product / s) : 0;
  }

  /** Incenter: barycentric coordinates weighted by the opposite side lengths. */
  function incenter(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const sum = x + y + z;
    if (sum < EPS) return { x: a.x, y: a.y };
    return {
      x: (x * a.x + y * b.x + z * c.x) / sum,
      y: (x * a.y + y * b.y + z * c.y) / sum,
    };
  }

  function incircle(a, b, c) {
    return { center: incenter(a, b, c), radius: inradius(a, b, c) };
  }

  /** A diagram with n evenly spaced points plus the applet's small jitter. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 360 : o.width;
    const height = o.height === undefined ? 240 : o.height;
    const n = clamp(Math.round(o.n === undefined ? N_DEFAULT : o.n), N_MIN, N_MAX);
    const rng = typeof o.rng === "function" ? o.rng : Math.random;
    const margin = Math.min(width, height) / 5;
    const left = margin, right = width - margin;
    const baseY = height - margin / 2;
    const points = [];
    for (let i = 0; i < n; i++) {
      // Java: (int)(Math.random()*10) - 10/2, i.e. a jitter of -5..4.
      const jitter = Math.floor(rng() * 10) - 5;
      points.push({ x: left + (right - left) * i / (n - 1) + jitter, y: baseY });
    }
    return {
      n: n, width: width, height: height,
      left: left, right: right, baseY: baseY,
      apex: { x: width / 3, y: height / 3 },
      points: points,
      showNames: !!o.showNames,
    };
  }

  /** The applet's Reset: same settings, fresh points and a fresh apex. */
  function reset(state, options) {
    const o = options || {};
    return start({
      n: state.n, width: state.width, height: state.height,
      showNames: state.showNames, rng: o.rng,
    });
  }

  /** The line through the first and last base points, with a unit direction. */
  function baseLine(state) {
    const a = state.points[0], b = state.points[state.points.length - 1];
    const len = distance(a, b);
    const u = len > EPS ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
    return { a: a, b: b, u: u, foot: foot(state.apex, a, b), h: distance(state.apex, foot(state.apex, a, b)) };
  }

  /**
   * g(i) = (AMi + the signed offset of Mi from the altitude's foot) / h.
   * Returns null when the apex lies on the base line.
   */
  function gValues(state) {
    const line = baseLine(state);
    if (line.h < EPS) return null;
    return state.points.map((p) => {
      const s = (p.x - line.foot.x) * line.u.x + (p.y - line.foot.y) * line.u.y;
      return (distance(state.apex, p) + s) / line.h;
    });
  }

  /** Radii of the triangles with a base spanning `level` neighbouring gaps. */
  function radii(state, level) {
    const k = clamp(Math.round(level === undefined ? 1 : level), 1, state.n - 1);
    const out = [];
    for (let i = 0; i + k < state.n; i++) {
      out.push(inradius(state.apex, state.points[i], state.points[i + k]));
    }
    return out;
  }

  /** The same triangles as `radii`, with their centers. */
  function circles(state, level) {
    const k = clamp(Math.round(level === undefined ? 1 : level), 1, state.n - 1);
    const out = [];
    for (let i = 0; i + k < state.n; i++) {
      out.push(incircle(state.apex, state.points[i], state.points[i + k]));
    }
    return out;
  }

  function spread(values) {
    if (!values.length) return 0;
    return Math.max.apply(null, values) - Math.min.apply(null, values);
  }

  /** The applet's Finished test on the first level, with its 1-pixel tolerance. */
  function equalFirstLevel(state, tolerance) {
    return spread(radii(state, 1)) <= (tolerance === undefined ? MATCH : tolerance);
  }

  /** The page's full claim: every level has equal radii, not just level 1. */
  function theoremHolds(state, tolerance) {
    const tol = tolerance === undefined ? MATCH : tolerance;
    for (let k = 1; k < state.n; k++) {
      if (spread(radii(state, k)) > tol) return false;
    }
    return true;
  }

  /**
   * Place the points so that the g(i) form a geometric progression, which is
   * exactly the condition for equal level-1 circles. A modern convenience
   * (the applet has no such button); the geometry is unchanged.
   */
  function makeEqual(state, ratio) {
    const line = baseLine(state);
    if (line.h < EPS) return {
      n: state.n, width: state.width, height: state.height,
      left: state.left, right: state.right, baseY: state.baseY,
      apex: { x: state.apex.x, y: state.apex.y },
      points: state.points.map((p) => ({ x: p.x, y: p.y })),
      showNames: state.showNames,
    };

    const gAt = (s) => (Math.sqrt(s * s + line.h * line.h) + s) / line.h;
    const coord = (p) => (p.x - line.foot.x) * line.u.x + (p.y - line.foot.y) * line.u.y;
    const gLo = gAt(coord({ x: state.left, y: state.baseY }));
    const gHi = gAt(coord({ x: state.right, y: state.baseY }));
    const maxRatio = Math.pow(gHi / gLo, 1 / (state.n - 1));
    const q = clamp(Number(ratio) || 1.6, 1.01, Math.max(1.02, maxRatio));
    const g0 = Math.sqrt(gLo * gHi / Math.pow(q, state.n - 1));
    const points = [];
    for (let i = 0; i < state.n; i++) {
      const g = g0 * Math.pow(q, i);
      const s = line.h * (g - 1 / g) / 2;
      points.push({
        x: line.foot.x + line.u.x * s,
        y: line.foot.y + line.u.y * s,
      });
    }
    return {
      n: state.n, width: state.width, height: state.height,
      left: state.left, right: state.right, baseY: state.baseY,
      apex: { x: state.apex.x, y: state.apex.y },
      points: points, showNames: state.showNames,
    };
  }

  /** The plain position saved for the player's record and the tutor. */
  function position(state) {
    return {
      n: state.n,
      apex: { x: state.apex.x, y: state.apex.y },
      points: state.points.map((p) => ({ x: p.x, y: p.y })),
      level1: radii(state, 1),
      equal: equalFirstLevel(state),
    };
  }

  return {
    N_MIN: N_MIN, N_MAX: N_MAX, N_DEFAULT: N_DEFAULT, MATCH: MATCH,
    distance: distance, foot: foot, inradius: inradius, incenter: incenter,
    incircle: incircle, start: start, reset: reset, baseLine: baseLine,
    gValues: gValues, radii: radii, circles: circles, spread: spread,
    equalFirstLevel: equalFirstLevel, theoremHolds: theoremHolds,
    makeEqual: makeEqual, position: position,
  };
})();
