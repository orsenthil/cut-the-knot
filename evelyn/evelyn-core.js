"use strict";

/*
 * Evelyn — the Six Circles Theorem, from Alexander Bogomolny's applet Evelyn.
 *
 * Pick a triangle and a point on the bisector of its first corner. Draw the
 * circle at that corner tangent to the two sides through it; then, going round
 * the corners, draw a circle tangent to the two sides at the next corner and
 * to the circle just drawn. The chain closes: the seventh circle is the first
 * one again, so a chain of circles touching their neighbours and successive
 * pairs of sides never has more than six members.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, EvelynCore, so the page loads it with a
 * plain <script> and porting/check-evelyn.mjs loads it in Node. The position
 * is plain data (numbers and arrays of {x,y} points); functions return new
 * objects and never change what they are given.
 *
 * The formulas below are transcribed from EvelynCanvas, GeoSDoub, DoubLine
 * and QuadraticEquation in the original class files, including the applet's
 * idiv starting vertices, its 0.7 starting parameter, its Solve2 root choice
 * and its six-circle drawing loop.
 */
const EvelynCore = (() => {
  /* The applet's EMBED width/height and its own constants. */
  const WIDTH = 500;
  const HEIGHT = 450;
  const MARGIN = 20;
  const DEFAULT_TA = 0.7;
  const DEFAULT_WHICH = 6; /* "Show all circles" is checked at startup. */
  const PAIRS = 6;
  const EPS = 1e-7;
  const pt = (x, y) => ({ x, y });
  const clone = (p) => pt(p.x, p.y);
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v))));

  const sqDist = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const dist = (a, b) => Math.sqrt(sqDist(a, b));

  /* GeoSDoub.FindOrientation: +1 for one orientation of the triple, -1 else. */
  const orientation = (a, b, c) =>
    (c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1);

  /* GeoSDoub.Rotate(b about a, by s*theta). */
  function rotate(a, b, theta, s) {
    const co = Math.cos(theta);
    const si = Math.sin(theta);
    return pt(
      a.x + co * (b.x - a.x) - s * si * (b.y - a.y),
      a.y + s * si * (b.x - a.x) + co * (b.y - a.y),
    );
  }

  /* GeoSDoub.Intersect of two lines through pairs of points; NaN if parallel. */
  function intersect(a, b, c, d) {
    const a4 = a.y - b.y;
    const b4 = b.x - a.x;
    const c4 = a.x * b.y - a.y * b.x;
    const a5 = c.y - d.y;
    const b5 = d.x - c.x;
    const c5 = c.x * d.y - c.y * d.x;
    const d4 = b4 * c5 - b5 * c4;
    const d5 = c4 * a5 - c5 * a4;
    const d6 = a4 * b5 - a5 * b4;
    if (Math.abs(d6) < 1) return pt(NaN, NaN);
    return pt(d4 / d6, d5 / d6);
  }

  /* GeoSDoub.ComputeAngle, kept literally (including its Dist denominator). */
  function computeAngle(a, b, c) {
    const half = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2;
    return Math.acos(half / dist(a, b) / dist(a, c));
  }

  /* GeoSDoub.FindAngleBisector: meets the opposite side at the bisector foot. */
  function findAngleBisector(a, b, c) {
    const angle = computeAngle(a, b, c) / 2;
    const turned = rotate(a, b, angle, orientation(a, b, c));
    return intersect(a, turned, b, c);
  }

  /* GeoSDoub.NearestPoint(p onto the line q->r) and Dist(p, DoubLine). */
  function nearestPoint(p, q, r) {
    const dx = r.x - q.x;
    const dy = r.y - q.y;
    if (sqDist(q, p) < 0.1) return clone(p);
    const t = (dx * (p.x - q.x) + dy * (p.y - q.y)) / (dx * dx + dy * dy);
    return pt(q.x + dx * t, q.y + dy * t);
  }

  function distToLine(p, line) {
    const dx = line.b.x - line.a.x;
    const dy = line.b.y - line.a.y;
    if (sqDist(line.a, p) < 0.1) return 0;
    const t = (dx * (p.x - line.a.x) + dy * (p.y - line.a.y)) / (dx * dx + dy * dy);
    return Math.hypot(line.a.x - p.x + dx * t, line.a.y - p.y + dy * t);
  }

  /* QuadraticEquation.Solve2: roots of a*t*t + b*t + c = 0 (note: b² - a*c). */
  function solve2(a, b, c) {
    if (Math.abs(a) < 0.01) return null;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [(-b + root) / a, (-b - root) / a];
  }

  /** The applet's Reset(): three vertices with Java integer division. */
  function initialVertices(w, h) {
    return [
      pt(Math.trunc(w / 2), MARGIN),
      pt(Math.trunc(w / 8), h - MARGIN),
      pt(Math.trunc((7 * w) / 8), Math.trunc((4 * h) / 5)),
    ];
  }

  /** The start position; V may be three dragged points, Ta is 0..1. */
  function start(options) {
    const o = options || {};
    const w = clamp(o.w === undefined ? WIDTH : o.w, 40, 4000);
    const h = clamp(o.h === undefined ? HEIGHT : o.h, 40, 4000);
    const base = initialVertices(w, h);
    const V = Array.isArray(o.V) && o.V.length === 3
      ? o.V.map((p) => pt(clamp(p.x, 0, w), clamp(p.y, 0, h)))
      : base;
    return {
      w, h, V,
      Ta: clamp(o.Ta === undefined ? DEFAULT_TA : o.Ta, 0, 1),
      which: clampInt(o.which === undefined ? DEFAULT_WHICH : o.which, 0, PAIRS),
    };
  }

  /** A new position with some options changed; never mutates the old one. */
  function withOptions(state, changes) {
    const o = changes || {};
    const w = o.w === undefined ? state.w : clamp(o.w, 40, 4000);
    const h = o.h === undefined ? state.h : clamp(o.h, 40, 4000);
    return {
      w, h,
      V: o.V === undefined ? state.V.map(clone)
        : o.V.map((p) => pt(clamp(p.x, 0, w), clamp(p.y, 0, h))),
      Ta: o.Ta === undefined ? state.Ta : clamp(o.Ta, 0, 1),
      which: o.which === undefined ? state.which : clampInt(o.which, 0, PAIRS),
    };
  }

  /** EvelynCanvas.CreateBisector(): the three angle-bisector feet and P. */
  function geometry(state) {
    const V = state.V.map(clone);
    const L = [
      findAngleBisector(V[0], V[2], V[1]),
      findAngleBisector(V[1], V[0], V[2]),
      findAngleBisector(V[2], V[1], V[0]),
    ];
    const P = pt(V[0].x * state.Ta + L[0].x * (1 - state.Ta),
      V[0].y * state.Ta + L[0].y * (1 - state.Ta));
    const sides = [
      { a: V[0], b: V[1] }, { a: V[1], b: V[2] }, { a: V[2], b: V[0] },
    ];
    return { V, L, P, sides };
  }

  /**
   * EvelynCanvas.GetTouchingCircle(A, c, B, C): the circle centred on the
   * bisector at B that touches the side B->A and the previous circle c. The
   * coefficient names L5, L7, L9, L11 and the root choice follow the bytecode.
   */
  function nextCircle(A, c, B, C) {
    const L5 = dist(C, nearestPoint(C, B, A));
    const L7 = sqDist(C, B) - L5 * L5;
    const L9 = (C.x - B.x) * (B.x - c.x) + (C.y - B.y) * (B.y - c.y) - c.r * L5;
    const L11 = sqDist(B, c) - c.r * c.r;
    const roots = solve2(L7, L9, L11);
    if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
    let t = -1;
    if (roots[0] >= 0 && roots[0] <= 1) t = roots[0];
    if (t < 0 && roots[1] >= 0 && roots[1] <= 1) t = roots[1];
    if (t < 0) return null;
    const center = pt(B.x + t * (C.x - B.x), B.y + t * (C.y - B.y));
    return { x: center.x, y: center.y, r: L5 * t, t, d: L5 };
  }

  /**
   * The first circle plus `limit - 1` steps round the corners. The applet's
   * ShowCircles() calls this with limit 6 (circles 0..5); a larger limit is
   * used by the logic test to check the closing claim.
   */
  function extend(state, limit = PAIRS) {
    const g = geometry(state);
    if (!finite(g.P) || !g.L.every(finite)) return [];
    const r0 = distToLine(g.P, g.sides[0]);
    if (!Number.isFinite(r0)) return [];
    const d0 = distToLine(g.L[0], g.sides[2]);
    const circles = [{ x: g.P.x, y: g.P.y, r: r0, k: 0, t: 1 - state.Ta, d: d0 }];
    for (let k = 1; k < limit; k++) {
      const i = k % 3;
      const j = (i + 2) % 3;
      const next = nextCircle(g.V[j], circles[circles.length - 1], g.V[i], g.L[i]);
      if (!next || !Number.isFinite(next.r) || next.r < -EPS || !finite(next)) break;
      circles.push({ x: next.x, y: next.y, r: next.r, k, t: next.t, d: next.d });
    }
    return circles;
  }

  /** Exactly the circles EvelynCanvas.ShowCircles() paints. */
  function chain(state) {
    return extend(state, PAIRS);
  }

  /**
   * ShowCircles()'s colour rule: Which=6 paints everything red; Which=0..5
   * paints the two successive circles of that pair red and the rest pink.
   */
  function isRed(which, k) {
    if (which === 6) return true;
    if (k === 0) return which === 0 || which === 5;
    return k === which || (k + PAIRS - 1) % PAIRS === which;
  }

  /** Where the perpendicular from a circle centre lands on a side, 0..1. */
  function footParameter(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  }

  /** The page's claim, checked circle by circle for this position. */
  function claims(state) {
    const g = geometry(state);
    const drawn = chain(state);
    const all = extend(state, PAIRS + 2);
    const near = (a, b, eps = EPS) => Math.abs(a - b) <= eps;
    const touches = drawn.every((c) => {
      if (!Number.isFinite(c.r) || c.r < 0) return false;
      const i = c.k % 3;
      const j = (i + 2) % 3;
      return near(distToLine(c, g.sides[i]), c.r, 1e-6)
        && near(distToLine(c, g.sides[j]), c.r, 1e-6);
    });
    const neighbours = drawn.slice(1).every((c, n) =>
      near(dist(c, drawn[n]), c.r + drawn[n].r, 1e-6));
    const feetOnSides = drawn.every((c) => {
      const i = c.k % 3;
      const j = (i + 2) % 3;
      const u = footParameter(c, g.V[i], g.V[(i + 1) % 3]);
      const v = footParameter(c, g.V[i], g.V[j]);
      return u >= -EPS && u <= 1 + EPS && v >= -EPS && v <= 1 + EPS;
    });
    const closes = all.length > PAIRS && Number.isFinite(all[PAIRS].r)
      && near(dist(all[PAIRS], all[0]), 0, 1e-6) && near(all[PAIRS].r, all[0].r, 1e-6);
    return {
      finite: drawn.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)),
      touchesBothSides: touches,
      neighboursTouch: neighbours,
      feetOnSides,
      atMostSix: drawn.length <= PAIRS,
      closesAfterSix: closes,
      /* The theorem's bound: either no seventh circle fits, or it is the
         first circle again, so no new circle is added to the chain. */
      repeatsOrStops: all.length <= PAIRS || closes,
      circles: drawn.length,
    };
  }

  return {
    WIDTH, HEIGHT, MARGIN, DEFAULT_TA, DEFAULT_WHICH, PAIRS, EPS,
    pt, dist, sqDist, clamp, clampInt,
    solve2, initialVertices, start, withOptions, geometry, nextCircle,
    extend, chain, isRed, footParameter, distToLine, claims,
  };
})();
