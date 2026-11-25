"use strict";

/*
 * Rolle's and the Mean Value Theorems, from Alexander Bogomolny's applet MVT.
 *
 * The graph is a natural cubic spline through 11 control points at x = 0, 1,
 * ..., 10 whose heights the player can drag (they start on the parabola
 * y = 25/3 - (x - 5)^2, as in the applet). Three more points slide along the
 * curve: the left end A (x = 1.1 to begin with), the right end B (8.1) and the
 * tangent point X (3.1). The secant through A and B has slope
 * (f(b) - f(a)) / (b - a). The Mean Value Theorem says that between a and b
 * there is a point c where the tangent has the same slope; if f(a) = f(b)
 * (Rolle's theorem) the slope is 0.
 *
 * The position is plain data: { ys, a, b, x } with ys the 11 heights and a, b, x
 * the abscissae of A, B and X.
 */
const MVTCore = (() => {
  const KNOTS = 11, XMIN = 0, XMAX = 10;
  const TOL = 0.02; // the slopes count as parallel when they differ by less than this

  const start = () => ({ ys: Array.from({ length: KNOTS }, (_, i) => 25 / 3 - (i - 5) * (i - 5)), a: 1.1, b: 8.1, x: 3.1 });

  /** The natural cubic spline through (i, ys[i]): its second derivatives m at the knots (tridiagonal solve). */
  function secondDerivs(ys) {
    const n = ys.length, m = Array(n).fill(0);
    if (n < 3) return m;
    const c = Array(n).fill(0), d = Array(n).fill(0);
    // 4 m[i] + m[i-1] + m[i+1] = 6 (y[i-1] - 2 y[i] + y[i+1]) with unit spacing, natural ends m = 0
    for (let i = 1; i < n - 1; i++) {
      const rhs = 6 * (ys[i - 1] - 2 * ys[i] + ys[i + 1]);
      const den = 4 - (i > 1 ? c[i - 1] : 0);
      c[i] = 1 / den;
      d[i] = (rhs - (i > 1 ? d[i - 1] : 0)) / den;
    }
    for (let i = n - 2; i >= 1; i--) m[i] = d[i] - c[i] * (i < n - 2 ? m[i + 1] : 0);
    return m;
  }

  const seg = (x) => Math.max(0, Math.min(KNOTS - 2, Math.floor(x)));

  /** The curve f(x), its slope f'(x) and its second derivative f''(x) at x, from precomputed second derivatives. */
  function evaluate(ys, m, x) {
    const i = seg(x), t = x - i, u = 1 - t;
    const f = u * ys[i] + t * ys[i + 1] + ((u * u * u - u) * m[i] + (t * t * t - t) * m[i + 1]) / 6;
    const df = ys[i + 1] - ys[i] + ((1 - 3 * u * u) * m[i] + (3 * t * t - 1) * m[i + 1]) / 6;
    const ddf = u * m[i] + t * m[i + 1];
    return { f, df, ddf };
  }

  /** A function f(x), f'(x) for the position, with the spline solved once. */
  function curve(state) {
    const m = secondDerivs(state.ys);
    return { f: (x) => evaluate(state.ys, m, x).f, df: (x) => evaluate(state.ys, m, x).df, ddf: (x) => evaluate(state.ys, m, x).ddf };
  }

  const clampX = (x) => Math.max(XMIN, Math.min(XMAX, x));

  /** The slopes and parallelism: { secant, tangent, parallel, rolle } or null when a and b are the same. */
  function readings(state) {
    const c = curve(state), a = Math.min(state.a, state.b), b = Math.max(state.a, state.b);
    if (b - a < 1e-9) return null;
    const secant = (c.f(b) - c.f(a)) / (b - a), tangent = c.df(state.x);
    const inside = state.x > a && state.x < b;
    return { a, b, fa: c.f(a), fb: c.f(b), secant, tangent, inside, parallel: inside && Math.abs(tangent - secant) < TOL, rolle: Math.abs(c.f(b) - c.f(a)) < 1e-3 };
  }

  /** Every point c in (a, b) where f'(c) equals the secant slope (found by sign changes and bisection). */
  function meanValuePoints(state) {
    const c = curve(state), a = Math.min(state.a, state.b), b = Math.max(state.a, state.b);
    if (b - a < 1e-9) return [];
    const s = (c.f(b) - c.f(a)) / (b - a), g = (x) => c.df(x) - s, out = [];
    const N = 4000;
    let px = a, pg = g(a);
    for (let i = 1; i <= N; i++) {
      const x = a + ((b - a) * i) / N, gx = g(x);
      if (pg === 0 && px > a) out.push(px);
      else if (pg * gx < 0) {
        let lo = px, hi = x, glo = pg;
        for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, gm = g(mid); if (glo * gm <= 0) hi = mid; else { lo = mid; glo = gm; } }
        out.push((lo + hi) / 2);
      }
      px = x; pg = gx;
    }
    return out;
  }

  /** Slide X to x (kept on the curve). If the tangent's slope crosses the secant's between the old and new x, X lands on the crossing (so the tangent is exactly parallel). */
  function moveX(state, x) {
    x = clampX(x);
    const c = curve(state), a = Math.min(state.a, state.b), b = Math.max(state.a, state.b);
    if (b - a < 1e-9) return { ...state, x };
    const s = (c.f(b) - c.f(a)) / (b - a), g = (t) => c.df(t) - s;
    const lo0 = Math.min(state.x, x), hi0 = Math.max(state.x, x);
    if (hi0 - lo0 > 1e-12 && lo0 >= a - 1e-9 && hi0 <= b + 1e-9) {
      // scan the stretch swept for a sign change and take the crossing nearest the new x
      let best = null; const N = 200;
      let px = lo0, pg = g(lo0);
      for (let i = 1; i <= N; i++) {
        const t = lo0 + ((hi0 - lo0) * i) / N, gt = g(t);
        if (pg * gt < 0) {
          let lo = px, hi = t, glo = pg;
          for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, gm = g(mid); if (glo * gm <= 0) hi = mid; else { lo = mid; glo = gm; } }
          const r = (lo + hi) / 2;
          if (best === null || Math.abs(r - x) < Math.abs(best - x)) best = r;
        }
        px = t; pg = gt;
      }
      if (best !== null) return { ...state, x: best };
    }
    return { ...state, x };
  }

  /** Move A or B (which = "a" or "b") along the curve to x. */
  function moveEnd(state, which, x) {
    if (which !== "a" && which !== "b") return null;
    return { ...state, [which]: clampX(x) };
  }

  /** Drag control point i to height y. */
  function setHeight(state, i, y) {
    if (!Number.isInteger(i) || i < 0 || i >= KNOTS || !Number.isFinite(y)) return null;
    return { ...state, ys: state.ys.map((v, k) => (k === i ? Math.max(-30, Math.min(30, y)) : v)) };
  }

  return { KNOTS, XMIN, XMAX, TOL, start, secondDerivs, evaluate, curve, readings, meanValuePoints, moveX, moveEnd, setHeight };
})();
