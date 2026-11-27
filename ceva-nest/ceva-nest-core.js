"use strict";

/*
 * Ceva Nest, from Alexander Bogomolny's applet CevaNest.
 *
 * Start with a triangle P1P2P3 and a point P: the three cevians through P cut
 * the far sides at Q1, Q2, Q3. Now take any point Q and cut the sides of that
 * new Q triangle with the cevians through Q, giving R1, R2, R3. The claim on
 * the applet's page is that the outer triangle and the R triangle are
 * perspective: P1R1, P2R2 and P3R3 pass through one point. The code relies on
 * the applet's own line intersection (a 3-by-3 determinant, with its "parallel"
 * cut-off at 1) to build the two nested cevian triangles and to locate the
 * common point as the average of the three pairwise intersections.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CevaNestCore, so the page loads it with a plain
 * <script> and porting/check-ceva-nest.mjs loads it in Node. Every function
 * takes plain data and returns new objects; nothing passed in is changed.
 */
const CevaNestCore = (() => {
  // The applet's getParameterInfo says 400x250 is optimal.
  const WIDTH = 400;
  const HEIGHT = 250;
  // GeoSDoub.Intersect returns NaN when |det| < 1.
  const DET_MIN = 1;

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The position the applet's CevaNestCanvas.init gives the five draggable dots. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    // The applet halves the canvas size with integer division, then multiplies
    // and divides in integer arithmetic before converting to double.
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const V = [
      { x: Math.floor(cx * 5 / 6), y: Math.floor(cy * 6 / 7) },
      { x: Math.floor(cx * 2 / 5), y: Math.floor(cy / 6) },
      { x: Math.floor(cx / 5), y: Math.floor(cy * 9 / 10) },
    ];
    // Midpoint() calls CTKGeometryPlus.Barycenter on the three vertices.
    const P = {
      x: (V[0].x + V[1].x + V[2].x) / 3,
      y: (V[0].y + V[1].y + V[2].y) / 3,
    };
    // The second inner point starts 20 right and 40 up from P.
    const Q = { x: P.x + 20, y: P.y - 40 };
    return { V, P, Q };
  }

  /** A copy of the position with one dot moved. */
  function withPoint(state, name, p) {
    const next = { V: state.V.map(copy), P: copy(state.P), Q: copy(state.Q) };
    if (name === "P" || name === "Q") next[name] = copy(p);
    else if (/^V[012]$/.test(String(name))) next.V[Number(String(name)[1])] = copy(p);
    else if (Number.isInteger(name) && name >= 0 && name < 3) next.V[name] = copy(p);
    return next;
  }

  /**
   * GeoSDoub.Intersect(a, b, c, d): the crossing of the two *lines*, not of
   * the segments. The applet writes both coordinates as NaN if the determinant
   * is under a pixel; this core uses null for that case.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y;
    const b1 = b.x - a.x;
    const c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y;
    const b2 = d.x - c.x;
    const c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < DET_MIN) return null;
    const p = { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
    return finite(p) ? p : null;
  }

  /** intersect, but a missing input makes a missing crossing. */
  function cross(a, b, c, d) {
    if (!finite(a) || !finite(b) || !finite(c) || !finite(d)) return null;
    return intersect(a, b, c, d);
  }

  /** The ordinary average of three points (CTKGeometryPlus.Barycenter). */
  function barycenter(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  /** Directed ratio AF/FB on the line from A towards B. */
  function ratio(a, b, f) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return NaN;
    const t = ((f.x - a.x) * dx + (f.y - a.y) * dy) / len2;
    return Math.abs(1 - t) < 1e-12 ? NaN : t / (1 - t);
  }

  /** Ceva's product for three cevian feet: 1 exactly when the lines concur. */
  function cevaProduct(vertices, feet) {
    if (!vertices || !feet || vertices.length !== 3 || feet.length !== 3) return NaN;
    let product = 1;
    for (let k = 0; k < 3; k++) {
      const r = ratio(vertices[(k + 1) % 3], vertices[(k + 2) % 3], feet[k]);
      if (!Number.isFinite(r)) return NaN;
      product *= r;
    }
    return product;
  }

  /**
   * The full construction, in the applet's order: Q from P, R from Q, the
   * crossing W of the three P-R lines, and the extra S and T feet used in the
   * article's proof. `ok` says whether every line crossing exists.
   */
  function construct(state) {
    const V = state.V, P = state.P, Q = state.Q;
    const q = [
      intersect(V[0], P, V[1], V[2]),
      intersect(V[1], P, V[2], V[0]),
      intersect(V[2], P, V[0], V[1]),
    ];
    const r = q.map((qk, k) => cross(qk, Q, q[(k + 1) % 3], q[(k + 2) % 3]));
    const crossings = r.map((rk, k) => cross(V[k], rk, V[(k + 1) % 3], r[(k + 1) % 3]));
    const ok = q.every(finite) && r.every(finite) && crossings.every(finite);
    const W = ok ? barycenter(crossings[0], crossings[1], crossings[2]) : null;
    const spread = ok
      ? Math.max(
          dist(crossings[0], crossings[1]),
          dist(crossings[1], crossings[2]),
          dist(crossings[2], crossings[0]),
        )
      : NaN;
    const S = q.map((qk, k) => cross(V[k], qk, q[(k + 1) % 3], q[(k + 2) % 3]));
    const T = r.map((rk, k) => cross(V[k], rk, V[(k + 1) % 3], V[(k + 2) % 3]));
    const scale = Math.max(
      1,
      ...V.map((v) => Math.hypot(v.x, v.y)),
      ...V.map((v, k) => dist(v, V[(k + 1) % 3])),
    );
    // The three pairwise crossings coincide in exact arithmetic, so any
    // separation is rounding. Scale the tolerance with the drawing's size.
    const concurrent = ok && spread <= 2e-6 * scale;
    return {
      V, P, Q, q, r, S, T, crossings, W, ok, spread, scale, concurrent,
      cevaOuter: ok && T.every(finite) ? cevaProduct(V, T) : NaN,
      cevaInner: ok && r.every(finite) ? cevaProduct(q, r) : NaN,
    };
  }

  /** The illustration has no win or loss; this is here for the shared API. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, DET_MIN,
    start, withPoint, intersect, barycenter, ratio, cevaProduct, construct, result,
  };
})();
