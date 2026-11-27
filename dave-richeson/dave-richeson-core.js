"use strict";

/*
 * DaveRichesonCore — the logic of David Richeson's extension of the old
 * Japanese theorem, from Alexander Bogomolny's DaveRicheson applet.
 *
 * N vertices lie on one circle.  A triangulation is made by the applet's
 * random ear clipping: repeatedly take a vertex k of the current polygon,
 * join its two neighbours, and keep clipping until three vertices remain.
 * Each triangle gets its incircle; a clockwise triangle's radius counts
 * negative.  The signed sum does not depend on how the polygon was cut up.
 *
 * The incenter is found exactly as GeoSDoub.FindIncenter does in the applet:
 * intersect the two internal angle bisectors, then average the distances
 * from that point to the three sides.  No DOM, no window, no storage: one
 * global, and the position is plain data that can be handed to the tutor.
 */
const DaveRichesonCore = (() => {
  const CENTER = { x: 300, y: 275 };
  const RADIUS = 220;          // min(600, 550) / 2.5, as in the applet
  const TAU = 2 * Math.PI;
  const MIN_N = 3;
  const MAX_N = 30;            // the applet's JSpinner range
  const DEFAULT_N = 6;
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The sign of GeoSDoub.FindOrientation: the Java cross product's sign. */
  function orientation(a, b, c) {
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) +
      a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }

  function pointAt(angle) {
    return { x: CENTER.x + RADIUS * Math.cos(angle), y: CENTER.y + RADIUS * Math.sin(angle) };
  }

  /** The applet's STAY_ON_CIRCLE restriction: radial projection back onto it. */
  function project(p) {
    const dx = p.x - CENTER.x, dy = p.y - CENTER.y;
    const d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d < EPS) return pointAt(0);
    return { x: CENTER.x + (RADIUS * dx) / d, y: CENTER.y + (RADIUS * dy) / d };
  }

  function clampN(n) {
    const value = Math.round(Number(n));
    return Number.isFinite(value) ? clamp(value, MIN_N, MAX_N) : DEFAULT_N;
  }

  /* A deterministic stand-in for Math.random.  Tests supply their own draws
   * as a plain array; the page lets the seed advance, so pressing the button
   * gives a fresh triangulation every time. */
  function nextSeed(seed) {
    let s = (seed + 0x6d2b79f5) | 0;
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return { seed: s >>> 0, value: ((s ^ (s >>> 14)) >>> 0) / 4294967296 };
  }

  function angleAt(v, p, q) {
    const vp = dist(v, p), vq = dist(v, q), pq = dist(p, q);
    if (vp < EPS || vq < EPS) return 0;
    return Math.acos(clamp((vp * vp + vq * vq - pq * pq) / (2 * vp * vq), -1, 1));
  }

  /* GeoSDoub.Rotate(pivot, point, angle, orientation). */
  function rotate(pivot, point, angle, sign) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    return {
      x: pivot.x + c * dx - sign * s * dy,
      y: pivot.y + sign * s * dx + c * dy,
    };
  }

  /* GeoSDoub.Intersect of the two lines p1p2 and p3p4. */
  function intersect(p1, p2, p3, p4) {
    const a = p1.y - p2.y, b = p2.x - p1.x, c = p1.x * p2.y - p1.y * p2.x;
    const d = p3.y - p4.y, e = p4.x - p3.x, f = p3.x * p4.y - p3.y * p4.x;
    const den = a * e - d * b;
    if (Math.abs(den) < EPS) return { x: NaN, y: NaN };
    return { x: (b * f - e * c) / den, y: (c * d - f * a) / den };
  }

  /* GeoSDoub.NearestPoint: the foot on the infinite line ab. */
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < EPS) return a;
    const t = ((b.x - a.x) * (p.x - a.x) + (b.y - a.y) * (p.y - a.y)) /
      (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Textbook incenter, used only if two dragged corners coincide. */
  function fallbackIncircle(a, b, c) {
    const la = dist(b, c), lb = dist(a, c), lc = dist(a, b);
    const per = la + lb + lc;
    if (per < EPS) return { x: a.x, y: a.y, r: 0 };
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
    return {
      x: (la * a.x + lb * b.x + lc * c.x) / per,
      y: (la * a.y + lb * b.y + lc * c.y) / per,
      r: area / (per / 2),
    };
  }

  /** GetIncircle from the applet: bisectors meet at I; r is the mean of the
   *  three distances from I to the sides. */
  function incircle(a, b, c) {
    const sign = orientation(a, b, c);
    const angleA = angleAt(a, b, c), angleB = angleAt(b, c, a);
    const bisA = rotate(a, b, angleA / 2, sign);
    const bisB = rotate(b, c, angleB / 2, sign);
    const I = intersect(a, bisA, b, bisB);
    if (!Number.isFinite(I.x) || !Number.isFinite(I.y)) return fallbackIncircle(a, b, c);
    const r = (dist(I, nearest(I, a, b)) + dist(I, nearest(I, b, c)) +
      dist(I, nearest(I, c, a))) / 3;
    if (!Number.isFinite(r)) return fallbackIncircle(a, b, c);
    return { x: I.x, y: I.y, r };
  }

  /**
   * The applet's Diagonals/Reorder/Diagonal methods, in one pass.
   * `draws`, when given, is the exact sequence of Math.random() values.
   */
  function triangulate(state, draws) {
    const seq = draws ? draws.slice() : null;
    let seed = state.seed >>> 0 || 1;
    let order = state.points.map((_, i) => i);
    const triangles = [], diagonals = [];
    function draw() {
      if (seq) {
        if (!seq.length) throw new Error("not enough random draws to triangulate");
        return seq.shift();
      }
      const next = nextSeed(seed);
      seed = next.seed;
      return next.value;
    }

    // Diagonal(): clip an ear, or hand the last three vertices to T.
    function diagonal() {
      const len = order.length;
      if (len < 4) {
        triangles.push(order.slice());
        return null;
      }
      const k = Math.floor(draw() * len);
      const prev = (k - 1 + len) % len;
      const next = (k + 1) % len;
      triangles.push([order[prev], order[k], order[next]]);
      return { indices: [prev, next], endpoints: [order[prev], order[next]] };
    }
    // Reorder(): start the polygon again at the second index of `indices`.
    function reorder(indices) {
      const old = order, out = new Array(old.length - 1);
      for (let i = 0; i < out.length; i++) out[i] = old[(indices[1] + i) % old.length];
      return out;
    }

    for (;;) {
      const ear = diagonal();
      if (!ear) break;
      diagonals.push(ear.endpoints);
      order = reorder(ear.indices);
    }
    return Object.assign({}, state, { triangles, diagonals, seed, explored: true });
  }

  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n);
    const seed = (o.seed === undefined ? 1 : o.seed) >>> 0 || 1;
    const points = [];
    for (let i = 0; i < n; i++) points.push(pointAt((TAU * i) / n));
    return triangulate({ n, points, seed, explored: false }, o.draws);
  }

  /** Changing N resets the vertices to a regular polygon, as Reset does. */
  function setN(state, n, draws) {
    const size = clampN(n);
    const points = [];
    for (let i = 0; i < size; i++) points.push(pointAt((TAU * i) / size));
    return triangulate({ n: size, points, seed: state.seed, explored: true }, draws);
  }

  /** Drag a corner along the circle.  The triangulation keeps its topology. */
  function moveVertex(state, index, p) {
    const i = Math.floor(index);
    if (i < 0 || i >= state.n || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const points = state.points.map((q, k) => (k === i ? project(p) : q));
    return Object.assign({}, state, { points, explored: true });
  }

  /** All geometry needed for the SVG, with the signed sum from Draw(). */
  function geometry(state) {
    const circles = [];
    let sum = 0, blue = 0, red = 0;
    for (const tri of state.triangles) {
      const a = state.points[tri[0]], b = state.points[tri[1]], c = state.points[tri[2]];
      const inc = incircle(a, b, c);
      const sign = orientation(a, b, c);
      circles.push({ x: inc.x, y: inc.y, r: inc.r, sign });
      sum += sign * inc.r;
      if (sign > 0) blue++; else red++;
    }
    return { circle: { c: CENTER, r: RADIUS }, circles, sum, blue, red };
  }

  /** A plain-English status line; this is a demo, so there is no winner. */
  function describe(state) {
    const g = geometry(state);
    return `Signed sum ${g.sum.toFixed(2)} — ${g.blue} blue, ${g.red} red incircle${g.circles.length === 1 ? "" : "s"}.`;
  }

  function legalMoves(state) {
    return state.points.map((_, i) => i);
  }

  function move(state, m) {
    if (!m) return null;
    if (m.type === "point") return moveVertex(state, m.index, m.point);
    if (m.type === "n") return setN(state, m.value);
    if (m.type === "triangulate") return triangulate(state);
    return null;
  }

  /** An illustration has no win or loss. */
  function result() {
    return null;
  }

  return {
    CENTER, RADIUS, MIN_N, MAX_N, DEFAULT_N,
    start, setN, triangulate, moveVertex, move, legalMoves, result,
    geometry, describe, orientation, incircle, project, pointAt, clampN,
  };
})();
