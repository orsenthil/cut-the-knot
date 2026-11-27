"use strict";

/*
 * Cross Points in a Polygon, from Alexander Bogomolny's applet CevaInNgon.
 *
 * Number the vertices A_0 ... A_(n-1) of an odd-sided polygon and pick any
 * point P. The side A_k A_(k+1) is called opposite to A_m when
 * k = m + floor(n/2) (mod n). The cross point of A_m is where the whole line
 * P A_m meets the line of that opposite side. A cross point is "inside" when
 * it lies between the two ends of the side. The applet draws one short line
 * from P to every vertex and marks exactly the inside cross points.
 *
 * The page makes two claims, both checked in porting/check-ceva-in-ngon.mjs:
 * the number of inside cross points is always odd, and the product of the
 * signed ratios A_k B / B A_(k+1) over all sides is 1. Both fail only in the
 * exceptional positions the article excludes (parallel lines or coincident
 * points), which this core reports as degenerate instead of guessing.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CevaInNgonCore, so the page loads it with
 * a plain <script> and the logic test loads it in Node. A position is plain
 * data (numbers and arrays), so it can be saved for the tutor as it is.
 */
const CevaInNgonCore = (() => {
  const MIN_N = 3;
  const MAX_N = 21;
  const STEP_N = 2;
  const DEFAULT_N = 5;

  /* The applet's canvas is square: centre (width/2, width*10/19), points on
   * a circle of radius width/4. Our SVG has the same square viewBox. */
  const SIZE = 360;
  const CENTER = { x: SIZE / 2, y: (SIZE * 10) / 19 };
  const RADIUS = SIZE / 4;

  /** The spinner only offers odd values from 3 to 21. */
  function normalizeN(n) {
    let value = Math.round(Number(n));
    if (!Number.isFinite(value)) value = DEFAULT_N;
    value = Math.max(MIN_N, Math.min(MAX_N, value));
    if (value % 2 === 0) value = Math.max(MIN_N, value - 1);
    return value;
  }

  /**
   * A new picture: n vertices spread round a circle, each nudged by a random
   * fraction of half a step, and P at the centre — exactly the applet's
   * Reset(). Pass `random` to make the starting shape reproducible.
   */
  function start(options = {}) {
    const n = normalizeN(options.n ?? DEFAULT_N);
    const random = typeof options.random === "function" ? options.random : Math.random;
    const vertices = [];
    for (let i = 0; i < n; i++) {
      const angle = ((2 * Math.PI) / n) * i + (random() * Math.PI) / n;
      vertices.push({
        x: CENTER.x + RADIUS * Math.cos(angle),
        y: CENTER.y + RADIUS * Math.sin(angle),
      });
    }
    return { n, vertices, p: { ...CENTER } };
  }

  /** The shape after changing the spinner: the applet resets the points. */
  function withN(state, n) {
    return start({ n });
  }

  /** Move P ("P") or one vertex ("V0" ...), without changing the others. */
  function withPoint(state, name, point) {
    const q = { x: Number(point.x), y: Number(point.y) };
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return state;
    if (name === "P") return { ...state, p: q };
    const match = /^V(\d+)$/.exec(name);
    if (!match) return state;
    const i = Number(match[1]);
    if (i < 0 || i >= state.n) return state;
    const vertices = state.vertices.slice();
    vertices[i] = q;
    return { ...state, vertices };
  }

  /** The side opposite to vertex m, as a pair of indices (k, k+1 mod n). */
  function oppositeSide(state, m) {
    const k = (m + Math.floor(state.n / 2)) % state.n;
    return [k, (k + 1) % state.n];
  }

  /*
   * GeoSDoub.Intersect: the lines through p1,p2 and p3,p4 in ax+by+c=0 form.
   * The applet returns NaN when |det| < 1; null says the same thing here.
   */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (c1 * a2 - c2 * a1) / det;
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  /* InsideTest.IsInside(s, a, b): (s-a)·(s-b) <= 0, so the ends count as in. */
  function inside(s, a, b) {
    if (!s) return false;
    return (s.x - a.x) * (s.x - b.x) + (s.y - a.y) * (s.y - b.y) <= 0;
  }

  /** The applet's Compute(): one cross point and one inside flag per vertex. */
  function compute(state) {
    const { n, vertices, p } = state;
    const cross = [], isInside = [], sides = [];
    for (let m = 0; m < n; m++) {
      const [k, k1] = oppositeSide(state, m);
      sides.push([k, k1]);
      const s = intersect(p, vertices[m], vertices[k], vertices[k1]);
      cross.push(s);
      isInside.push(inside(s, vertices[k], vertices[k1]));
    }
    return { cross, isInside, sides, count: isInside.filter(Boolean).length };
  }

  /** Oriented t along side k, where 0 is A_k and 1 is A_(k+1). */
  function sideParameter(state, m) {
    const [k, k1] = oppositeSide(state, m);
    const a = state.vertices[k], b = state.vertices[k1];
    const s = compute(state).cross[m];
    if (!s) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) return null;
    const t = ((s.x - a.x) * dx + (s.y - a.y) * dy) / len2;
    return Math.abs(1 - t) < 1e-8 ? null : t;
  }

  /** The signed fraction A_k B / B A_(k+1) for the cross point of vertex m. */
  function ratio(state, m) {
    const t = sideParameter(state, m);
    return t === null ? null : t / (1 - t);
  }

  /** True when none of the applet's lines are parallel or nearly coincident. */
  function isGeneric(state) {
    if (!state || !Array.isArray(state.vertices)) return false;
    for (let m = 0; m < state.n; m++) {
      if (sideParameter(state, m) === null) return false;
      const s = compute(state).cross[m];
      const [k, k1] = oppositeSide(state, m);
      if (!s || Math.hypot(s.x - state.vertices[k].x, s.y - state.vertices[k].y) < 1 ||
          Math.hypot(s.x - state.vertices[k1].x, s.y - state.vertices[k1].y) < 1) return false;
    }
    return true;
  }

  /** The two claims on the article, or null when the picture is degenerate. */
  function claims(state) {
    if (!isGeneric(state)) return null;
    const result = compute(state);
    let product = 1;
    for (let m = 0; m < state.n; m++) product *= ratio(state, m);
    return {
      oddCrossings: result.count % 2 === 1,
      productIsOne: Math.abs(product - 1) < 1e-6,
      product,
      count: result.count,
    };
  }

  return {
    MIN_N, MAX_N, STEP_N, DEFAULT_N, SIZE, CENTER, RADIUS,
    start, withN, withPoint, normalizeN, oppositeSide, intersect, inside,
    compute, sideParameter, ratio, isGeneric, claims,
  };
})();
