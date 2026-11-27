"use strict";

/*
 * CevaPWW — Bogomolny's proof without words of Ceva's theorem.
 *
 * In triangle ABC the cevians AD, BE and CF pass through one point K. The
 * applet draws a grid of lines parallel to BE and CF, counts how many small
 * pieces of that grid cut the sides, and shows that
 *
 *     (AF / FB) (BD / DC) (CE / EA) = 1.
 *
 * The one idea the code relies on: the four integer counts on the sides
 * (AE:EC, AF:FB) determine all three feet by linear combinations, and the
 * third count is the product AD:DC = (AE·FB):(EC·AF), which makes the three
 * cevians meet. Every point of the picture is then a line intersection in
 * the same affine coordinates, exactly as in CevaPWWCanvas.DrawGrid.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CevaPwwCore, so the page loads it with a
 * plain <script> and porting/check-ceva-pww.mjs loads it in Node. All
 * functions take plain data, return new objects and leave their input alone.
 */
const CevaPwwCore = (() => {
  /** The panel's Min and Max, and the four numbers it starts with. */
  const MIN = -10;
  const MAX = 10;
  const DEFAULTS = { ae: 2, ec: 3, af: 3, fb: 2 };
  const EPS = 1e-9;

  const pt = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const same = (p, q, tol) => finite(p) && finite(q) &&
    Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /**
   * The starting picture, from CevaPWWCanvas.init at 400x300 (Java integer
   * division): A=(w/3,h/2), B=(2w/3,h/5), C=(3w/4,4h/7).
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const div = (n, d) => Math.trunc(n / d);
    const state = {
      A: o.points ? pt(o.points.A) : { x: div(width, 3), y: div(height, 2) },
      B: o.points ? pt(o.points.B) : { x: div(2 * width, 3), y: div(height, 5) },
      C: o.points ? pt(o.points.C) : { x: div(3 * width, 4), y: div(4 * height, 7) },
      ae: DEFAULTS.ae, ec: DEFAULTS.ec, af: DEFAULTS.af, fb: DEFAULTS.fb,
      grid: false, fine: false, diagonals: false, colors: false, cycle: false,
    };
    if (o.ratios) {
      for (const k of Object.keys(DEFAULTS)) {
        if (o.ratios[k] !== undefined) state[k] = setRatio(state, k, o.ratios[k])[k];
      }
    }
    for (const k of ["grid", "fine", "diagonals", "colors", "cycle"]) {
      if (o[k] !== undefined) state[k] = Boolean(o[k]);
    }
    return state;
  }

  /** Integer parse plus the panel's clamp; bad text restores the old value. */
  function setRatio(state, key, value) {
    if (!(key in DEFAULTS)) return { ...state };
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return { ...state };
    return { ...state, [key]: Math.max(MIN, Math.min(MAX, n)) };
  }

  /** The < and > buttons of the panel: one step, stopped at Min and Max. */
  function stepRatio(state, key, delta) {
    return setRatio(state, key, state[key] + delta);
  }

  /** One named corner moved to a new place; the ratios stay as they are. */
  function withPoint(state, name, p) {
    if (!(name in { A: 1, B: 1, C: 1 })) return { ...state };
    return { ...state, [name]: pt(p) };
  }

  /* ---------------- the applet's own primitive constructions, verbatim ---- */

  /** CevaPWWCanvas.LinComb: t*p + (1-t)*q. */
  function linComb(p, q, t) {
    return { x: t * p.x + (1 - t) * q.x, y: t * p.y + (1 - t) * q.y };
  }

  /** CevaPWWCanvas.Extend: q + t*(q-p). */
  function extend(p, q, t) {
    return { x: q.x + t * (q.x - p.x), y: q.y + t * (q.y - p.y) };
  }

  /** GeoSDoub.GetParallelTo: p + 100*(q-r), a point far along the parallel. */
  function parallelThrough(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  /** GeoSDoub.Intersect of two infinite lines, NaN when nearly parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - b2 * c1) / det,
      y: (c1 * a2 - c2 * a1) / det,
    };
  }

  /**
   * CevaPWWCanvas.DrawCevian: the line through V and the weighted point on
   * XY, or (when n = -m) the line through V parallel to XY. m_1 is the foot,
   * m_2 the vertex, matching DoubLine's constructor in the applet.
   */
  function cevian(V, X, Y, m, n) {
    if (n === -m) {
      const p = parallelThrough(V, X, Y);
      const q = parallelThrough(V, Y, X);
      return { foot: null, line: { p, q }, parallel: true };
    }
    const foot = linComb(X, Y, n / (m + n));
    return { foot, line: { p: foot, q: pt(V) }, parallel: false };
  }

  /**
   * Every point the applet draws, in the order DrawGrid builds it. Names are
   * the applet's own: E on AC, F on AB, D on BC, K their common point, G the
   * far corner of the grid parallelogram, Q and R its other two corners.
   */
  function figure(state) {
    const A = state.A, B = state.B, C = state.C;
    const be = cevian(B, A, C, state.ae, state.ec);   // E on AC
    const cf = cevian(C, A, B, state.af, state.fb);   // F on AB
    const ad = cevian(A, B, C, state.ae * state.fb, state.ec * state.af); // D on BC
    const E = be.foot, F = cf.foot, D = ad.foot;
    const nan = { x: NaN, y: NaN };
    const K = E && D ? intersect(E, B, A, D) : nan;

    const p8 = parallelThrough(A, F || nan, C);
    const p9 = parallelThrough(C, E || nan, B);
    const p10 = parallelThrough(A, E || nan, B);
    const p11 = parallelThrough(B, F || nan, C);
    const G = intersect(B, p11, C, p9);
    const Q = intersect(A, p8, C, p9);
    const R = intersect(A, p10, B, p11);
    const p16 = intersect(p10, A, F || nan, C);
    const p17 = intersect(p8, A, B, E || nan);

    /* DrawAddition: parallels to AD through B and C, and their intersections. */
    const p18 = parallelThrough(B, A, D || nan);
    const p19 = parallelThrough(C, A, D || nan);
    const p20 = intersect(B, p18, A, R);
    const p21 = intersect(C, p19, A, Q);
    const p22 = intersect(B, G, A, D || nan);
    const p23 = intersect(C, p19, B, G);

    return {
      A: pt(A), B: pt(B), C: pt(C), E, F, D, K, G, Q, R,
      p16, p17, p20, p21, p22, p23,
      cevians: { ad, be, cf },
      wellFormed: finite(E) && finite(F) && finite(D) && finite(K) &&
        finite(G) && finite(Q) && finite(R),
    };
  }

  /** The three ratios, both as the panel's integers and as a product. */
  function ratios(state) {
    const { ae, ec, af, fb } = state;
    const div = (a, b) => (b === 0 ? null : a / b);
    const aeEc = div(ae, ec);
    const afFb = div(af, fb);
    const bdDc = div(ae * fb, ec * af);
    const ceEa = div(ec, ae);
    return {
      aeEc, afFb, bdDc, ceEa,
      product: aeEc === null || afFb === null || bdDc === null || ceEa === null
        ? null : afFb * bdDc * ceEa,
    };
  }

  /** Signed fraction of the way from X to Y at which p lies. */
  function paramOn(p, X, Y) {
    const dx = Y.x - X.x, dy = Y.y - X.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return null;
    return ((p.x - X.x) * dx + (p.y - X.y) * dy) / len2;
  }

  /** Twice the triangle's area, a scale for the geometric tolerances. */
  function doubleArea(state) {
    return Math.abs(cross(state.A, state.B, state.C));
  }

  /**
   * Each claim made by the article beside the applet. All are geometric
   * checks on the current picture, so a wrong port fails them, not just an
   * algebra exercise on the four input numbers.
   */
  function claims(state) {
    const f = figure(state);
    const r = ratios(state);
    const { A, B, C, E, F, D, K, G, Q, R } = f;
    const positive = state.ae > 0 && state.ec > 0 && state.af > 0 && state.fb > 0;
    const tol = 1e-7 * Math.max(1, Math.hypot(B.x - A.x, B.y - A.y),
      Math.hypot(C.x - A.x, C.y - A.y), Math.hypot(B.x - C.x, B.y - C.y));
    const onLine = (p, X, Y) => finite(p) && Math.abs(cross(X, Y, p)) <= tol;
    const between = (p, X, Y) => {
      const t = paramOn(p, X, Y);
      return t !== null && t >= -tol && t <= 1 + tol;
    };
    const feetOnSides = positive && f.wellFormed &&
      onLine(E, A, C) && between(E, A, C) &&
      onLine(F, A, B) && between(F, A, B) &&
      onLine(D, B, C) && between(D, B, C);
    const ratioParams =
      onLine(E, A, C) && onLine(F, A, B) && onLine(D, B, C) &&
      close(paramOn(E, A, C), state.ae / (state.ae + state.ec), tol) &&
      close(paramOn(F, A, B), state.af / (state.af + state.fb), tol) &&
      close(paramOn(D, B, C),
        (state.ae * state.fb) / (state.ae * state.fb + state.ec * state.af), tol);
    const concurrent = f.wellFormed &&
      onLine(K, A, D) && onLine(K, B, E) && onLine(K, C, F);
    const Dp = D || { x: NaN, y: NaN };
    const measuredBD_DC = dist(B, Dp) / dist(Dp, C);
    return {
      nondegenerate: doubleArea(state) > 1e-7,
      feetOnSides,
      ratioParams: Boolean(ratioParams),
      concurrent,
      cevaProduct: r.product !== null && Math.abs(r.product - 1) < 1e-12,
      /* The article's grid claim: BD/DC = FB·EA / (CE·AF). */
      dissection: Boolean(positive && f.wellFormed &&
        Math.abs(measuredBD_DC - (state.fb * state.ae) / (state.ec * state.af)) < tol * 4),
      /* Q,R and G are the corners of one parallelogram based at A. */
      gridParallelogram: f.wellFormed && same(G, {
        x: Q.x + R.x - A.x, y: Q.y + R.y - A.y,
      }, tol * 4),
      /* In the fine grid K sits at step AE·AF on each side: at the fractions
         AE/(AE+EC) of Q and AF/(AF+FB) of R from A. */
      gridKCoordinates: f.wellFormed && same(K, {
        x: A.x + (state.ae / (state.ae + state.ec)) * (Q.x - A.x) +
           (state.af / (state.af + state.fb)) * (R.x - A.x),
        y: A.y + (state.ae / (state.ae + state.ec)) * (Q.y - A.y) +
           (state.af / (state.af + state.fb)) * (R.y - A.y),
      }, tol * 4),
    };
  }

  function close(a, b, tol) {
    return a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) &&
      Math.abs(a - b) <= tol;
  }

  /** An illustration: no play can be won, lost or finished. */
  function result(/* state */) {
    return null;
  }

  return {
    MIN, MAX, DEFAULTS,
    start, setRatio, stepRatio, withPoint,
    linComb, extend, parallelThrough, intersect, cevian,
    figure, ratios, paramOn, doubleArea, claims, result,
  };
})();
