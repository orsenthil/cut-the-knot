"use strict";

/*
 * Napoleon's Theorem and the Petr-Douglas-Neumann theorem, from Alexander
 * Bogomolny's applet Napolegon.
 *
 * Take an n-gon with vertices P[0..n-1] (complex numbers). For a complex number c
 * the linear polygonal transformation puts new vertices
 *     Q[j] = c P[j-1] + (1 - c) P[j]          (indices mod n),
 * the apexes of triangles similar to the triangle 0, 1, c built on the sides.
 * With w = e^(2 pi i / n), use c_k = 1 / (1 - w^k) for k = 1, ..., n-1. The step k
 * wipes out the part of the polygon that turns with frequency n - k (the vertices
 * w^((n-k) j)). The theorem: apply the transformations for every k except one chosen
 * k = m (the "excluded" number), in any order (n - 2 steps): only the frequency
 * n - m is left, so the result is a regular n-gon (star-shaped unless m = 1 or n - 1)
 * whatever P was. For n = 3 this is
 * Napoleon's theorem. All the polygons share the centroid.
 *
 * The applet's controls: n from 3 to 15 (5 to begin with), the excluded number
 * (0 up to n-1; 1 to begin with), a box to show the triangles. The polygons
 * made at each step are listed in the order of k. The position is plain data:
 *   { n, m, points, showTriangles }
 * with points the base polygon's vertices as {x, y}.
 */
const NapoleonCore = (() => {
  const MIN_N = 3, MAX_N = 15, DEFAULT_N = 5, DEFAULT_M = 1;
  const WIDTH = 500, HEIGHT = 360;

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));
  const clampM = (m, n) => Math.min(n - 1, Math.max(0, Math.round(Number(m)) || 0));

  /** A regular n-gon with centre (WIDTH/2, HEIGHT/2) and radius min(WIDTH, HEIGHT)/2 * 3/n, as the applet draws it. */
  function regular(n) {
    const r = (Math.min(WIDTH, HEIGHT) / 2) * 3 / n;
    return Array.from({ length: n }, (_, j) => ({ x: WIDTH / 2 + r * Math.cos((2 * Math.PI * j) / n), y: HEIGHT / 2 + r * Math.sin((2 * Math.PI * j) / n) }));
  }

  const start = () => ({ n: DEFAULT_N, m: DEFAULT_M, points: regular(DEFAULT_N), showTriangles: false });

  /* complex numbers as {x, y} (re, im) */
  const cmul = (a, b) => ({ x: a.x * b.x - a.y * b.y, y: a.x * b.y + a.y * b.x });
  const cadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const cdiv = (a, b) => { const d = b.x * b.x + b.y * b.y; return { x: (a.x * b.x + a.y * b.y) / d, y: (a.y * b.x - a.x * b.y) / d }; };

  /** w^k with w = e^(2 pi i / n). */
  const root = (n, k) => ({ x: Math.cos((2 * Math.PI * k) / n), y: Math.sin((2 * Math.PI * k) / n) });

  /** The number c_k = 1 / (1 - w^k) of step k. */
  function stepNumber(n, k) {
    const w = root(n, k);
    return cdiv({ x: 1, y: 0 }, { x: 1 - w.x, y: -w.y });
  }

  /** One transformation: Q[j] = c P[j-1] + (1 - c) P[j]. */
  function transform(points, c) {
    const n = points.length, oneMinus = { x: 1 - c.x, y: -c.y };
    return points.map((p, j) => cadd(cmul(points[(j + n - 1) % n], c), cmul(p, oneMinus)));
  }

  /** The steps (values of k) in the order the applet uses: 1..n-1 without m. */
  const stepsFor = (n, m) => Array.from({ length: n - 1 }, (_, i) => i + 1).filter((k) => k !== m);

  /** All the polygons made: polygons[i] is the result of step steps[i] applied to polygons[i-1] (polygons[-1] the base polygon). */
  function polygons(state) {
    const out = []; let cur = state.points;
    for (const k of stepsFor(state.n, state.m)) { cur = transform(cur, stepNumber(state.n, k)); out.push(cur); }
    return out;
  }

  const centroid = (pts) => ({ x: pts.reduce((t, p) => t + p.x, 0) / pts.length, y: pts.reduce((t, p) => t + p.y, 0) / pts.length });

  /**
   * How regular is a polygon? The largest relative difference between |P[j] - centre|
   * and the mean of those, and between the sides; 0 for a regular n-gon (star shapes included)
  
   */
  function regularity(pts, freq = 1) {
    const n = pts.length, c = centroid(pts);
    const d = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y)), mean = d.reduce((t, v) => t + v, 0) / n;
    // compare with centre + a w^(freq j) where a = the first vertex's offset
    const a = { x: pts[0].x - c.x, y: pts[0].y - c.y };
    let dev = 0;
    for (let j = 0; j < n; j++) {
      const want = cadd(c, cmul(a, root(n, freq * j)));
      dev = Math.max(dev, Math.hypot(pts[j].x - want.x, pts[j].y - want.y));
    }
    return { spread: mean < 1e-12 ? 0 : Math.max(...d.map((v) => Math.abs(v - mean))) / mean, dev, radius: mean };
  }

  /** The base polygon moved: vertex i goes to (x, y), kept inside the board. null for no such vertex. */
  function movePoint(state, i, x, y) {
    if (!Number.isInteger(i) || i < 0 || i >= state.n || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const p = { x: Math.max(2, Math.min(WIDTH - 2, x)), y: Math.max(2, Math.min(HEIGHT - 2, y)) };
    return { ...state, points: state.points.map((q, k) => (k === i ? p : q)) };
  }

  /** Set the size of the polygon: a new regular n-gon; the excluded number is kept within 0..n-1. */
  function setN(state, n) {
    n = clampN(n);
    return { ...state, n, m: clampM(state.m, n), points: regular(n) };
  }

  const setM = (state, m) => ({ ...state, m: clampM(m, state.n) });
  const setTriangles = (state, on) => ({ ...state, showTriangles: !!on });

  return { MIN_N, MAX_N, DEFAULT_N, DEFAULT_M, WIDTH, HEIGHT, clampN, clampM, regular, start, root, stepNumber, transform, stepsFor, polygons, centroid, regularity, movePoint, setN, setM, setTriangles };
})();
