"use strict";

/*
 * Barygon — Bogomolny's "A Quest for Paragon" applet.
 *
 * Take a polygon with N vertices. Replace each vertex by the average (barycenter)
 * of NA successive vertices, wrapping around the ends, and repeat NI times.
 * The question on the page is whether some NA other than N/2 can turn a polygon
 * into a paragon: a polygon whose opposite sides are parallel and equal.
 *
 * The two ideas the code relies on:
 *
 *   1. Telescoping. If Q_i = (P_i + ... + P_{i+NA-1})/NA then
 *      Q_{i+1} - Q_i = (P_{i+NA} - P_i)/NA.  In Fourier modes z_k of an N-gon,
 *      averaging multiplies mode k by lambda_k = (1/NA)(1 + z_k + ... + z_k^(NA-1)).
 *   2. A paragon has S_{i+N/2} = -S_i for its side vectors S_i. For even N this
 *      kills exactly the even modes k = 2,4,...: z_k^(N/2) = 1, so those modes
 *      break the condition. lambda_k = 0 precisely when z_k^NA = 1 and z_k != 1,
 *      i.e. when N/2 divides k*NA. For k=2 this says N/2 | NA, which then holds
 *      for every even k. So one step gives a paragon exactly when N/2 divides NA;
 *      when N divides NA every vertex becomes the centroid. For other NA no
 *      finite number of steps is exact (lambda_2 != 0 but |lambda_2| < 1), although
 *      the polygons converge to a paragon. In particular NA = 3*(N/2) is a
 *      non-degenerate paragon with an averaging number different from N/2.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BarygonCore, so the page loads it with a plain <script>
 * and porting/check-barygon.mjs loads it in Node.
 *
 * The position is plain data (N, NA, NI, the canvas size and the vertices), so
 * it can be saved and handed to the tutor as it is. Nothing passed in is changed.
 */
const BarygonCore = (() => {
  /* BarygonPanel: NI 1..20, NA 2..20, N 3..20; initial values 1, 3, 6. */
  const RANGES = Object.freeze({ N: [3, 20], NA: [2, 20], NI: [1, 20] });
  const DEFAULTS = Object.freeze({ N: 6, NA: 3, NI: 1, width: 600, height: 420 });
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The number canvases wrap within their ranges; enforce the same bounds. */
  function clampOption(name, value) {
    const range = RANGES[name];
    if (!range) throw new Error(`unknown option ${name}`);
    const v = Math.round(Number(value));
    if (!Number.isFinite(v)) throw new Error(`${name} must be a number`);
    return Math.min(range[1], Math.max(range[0], v));
  }

  /** BarygonCanvas.Reset: place vertices in consecutive PI/NA sectors. */
  function start(options = {}) {
    const N = clampOption("N", options.N === undefined ? DEFAULTS.N : options.N);
    const NA = clampOption("NA", options.NA === undefined ? DEFAULTS.NA : options.NA);
    const NI = clampOption("NI", options.NI === undefined ? DEFAULTS.NI : options.NI);
    const width = options.width === undefined ? DEFAULTS.width : options.width;
    const height = options.height === undefined ? DEFAULTS.height : options.height;
    const random = typeof options.random === "function" ? options.random : Math.random;
    let points;
    if (options.points) {
      points = options.points.map(copy);
    } else {
      const cx = width / 2, cy = height / 2;
      const radius = Math.min(width, height) / 4;
      points = [];
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI / NA) * i + (Math.PI / NA) * random();
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
    }
    return { N, NA, NI, width, height, points };
  }

  /** BaryCenter(int, DoubPoint[]), transcribed from the bytecode. */
  function baryCenter(i, poly, NA) {
    const n = poly.length;
    let sx = 0, sy = 0;
    for (let j = i; j < i + NA; j++) {
      const p = poly[j % n];
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / NA, y: sy / NA };
  }

  /** ComputeBary: one whole averaging pass over all N vertices. */
  function average(poly, NA) {
    const out = [];
    for (let i = 0; i < poly.length; i++) out.push(baryCenter(i, poly, NA));
    return out;
  }

  /** Draw: Q starts at P, then ComputeBary is applied NI times. */
  function sequence(state) {
    const out = [state.points.map(copy)];
    let poly = out[0];
    for (let t = 0; t < state.NI; t++) {
      poly = average(poly, state.NA);
      out.push(poly.map(copy));
    }
    return out;
  }

  /** Final polygon Q after all the iterations. */
  function resultPolygon(state) {
    const seq = sequence(state);
    return seq[seq.length - 1];
  }

  /** Directed side vectors S_i = Q_{i+1} - Q_i, including the closing side. */
  function sideVectors(poly) {
    const n = poly.length, out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: poly[(i + 1) % n].x - poly[i].x, y: poly[(i + 1) % n].y - poly[i].y });
    }
    return out;
  }

  const scaleOf = (poly) => {
    let s = 0;
    for (const p of poly) s = Math.max(s, Math.abs(p.x), Math.abs(p.y));
    return Math.max(1, s);
  };

  /**
   * Paragon defect: sum over i of |S_{i+N/2} + S_i|^2. Zero (to rounding) is
   * exactly the applet's paragon condition: opposite sides parallel and equal.
   * Returns null for an odd number of vertices, which has no opposite side.
   * The sum is in coordinate units: averaging contracts it. relativeDefect
   * divides by the size of the current polygon when a scale-free test is needed.
   */
  function paragonDefect(poly) {
    const n = poly.length;
    if (n % 2 !== 0) return null;
    const h = n / 2, sides = sideVectors(poly);
    let sum = 0;
    for (let i = 0; i < h; i++) {
      const dx = sides[i + h].x + sides[i].x;
      const dy = sides[i + h].y + sides[i].y;
      sum += dx * dx + dy * dy;
    }
    return sum;
  }

  /** The defect divided by the polygon's own size squared. */
  function relativeDefect(poly) {
    const d = paragonDefect(poly);
    if (d === null) return null;
    return d / (scaleOf(poly) * scaleOf(poly) * poly.length);
  }

  /** All vertices at (almost) the same place: the degenerate paragon. */
  function isCoincident(poly, tolerance = 1e-7) {
    if (!poly.length) return true;
    const tol = tolerance * scaleOf(poly);
    return poly.every((p) => distance(p, poly[0]) <= tol);
  }

  /** The paragon test, with a scale-relative tolerance. */
  function isParagon(poly, tolerance = 1e-7) {
    const defect = relativeDefect(poly);
    return defect !== null && defect <= tolerance * tolerance;
  }

  /** |lambda_k| for Fourier mode k; the contraction factor of one averaging. */
  function eigenModulus(k, N, NA) {
    let re = 0, im = 0;
    for (let j = 0; j < NA; j++) {
      const a = (2 * Math.PI * k * j) / N;
      re += Math.cos(a);
      im += Math.sin(a);
    }
    return Math.hypot(re, im) / NA;
  }

  /**
   * The paragon a repeated averaging converges towards, for even N:
   * centroid + (P_i - P_{i+N/2})/2. Its opposite sides are negatives of each
   * other. Kept here so the test can check convergence to the right shape.
   */
  function limitPolygon(poly) {
    const n = poly.length;
    if (n % 2 !== 0) return null;
    const h = n / 2;
    const c = { x: 0, y: 0 };
    for (const p of poly) { c.x += p.x / n; c.y += p.y / n; }
    return poly.map((p, i) => ({
      x: c.x + (p.x - poly[(i + h) % n].x) / 2,
      y: c.y + (p.y - poly[(i + h) % n].y) / 2,
    }));
  }

  /** The page's claims at one configuration, for the Check button. */
  function claims(state) {
    const seq = sequence(state);
    const first = seq[1];
    const h = state.N / 2;
    const even = state.N % 2 === 0;
    const halfDivides = even && Number.isInteger(h) && state.NA % h === 0;
    const allDivides = state.N > 0 && state.NA % state.N === 0;
    return {
      even,
      telescoping: seq.length > 1 && seq[1].every((q, i) => {
        const p = state.points, next = p[(i + state.NA) % state.N];
        const expected = { x: (next.x - p[i].x) / state.NA, y: (next.y - p[i].y) / state.NA };
        const side = sideVectors(first)[i];
        return Math.abs(side.x - expected.x) < 1e-7 * scaleOf(p) &&
          Math.abs(side.y - expected.y) < 1e-7 * scaleOf(p);
      }),
      halfDivides,
      allDivides,
      paragonAfterOneStep: halfDivides && isParagon(first),
      collapsedAfterOneStep: allDivides && isCoincident(first),
      defect: paragonDefect(seq[seq.length - 1]),
      finalIsParagon: isParagon(seq[seq.length - 1]),
      neverExact: even && !halfDivides && paragonDefect(seq[seq.length - 1]) > 1e-12,
    };
  }

  /** A new position with one vertex moved; the other vertices stay put. */
  function withPoint(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.points.length) return state;
    const points = state.points.map(copy);
    points[index] = copy(p);
    return { ...state, points };
  }

  /**
   * A new position with options changed. In the applet a change of N calls
   * Reset (which throws away the vertices); changes of NA or NI keep them.
   */
  function withOptions(state, opts = {}) {
    const N = clampOption("N", opts.N === undefined ? state.N : opts.N);
    const NA = clampOption("NA", opts.NA === undefined ? state.NA : opts.NA);
    const NI = clampOption("NI", opts.NI === undefined ? state.NI : opts.NI);
    if (N !== state.N) {
      return start({ ...state, N, NA, NI, points: undefined });
    }
    return { ...state, N, NA, NI };
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    RANGES, DEFAULTS, clampOption, start, baryCenter, average, sequence,
    resultPolygon, sideVectors, paragonDefect, relativeDefect, isCoincident, isParagon,
    eigenModulus, limitPolygon, claims, withPoint, withOptions, result,
    distance,
  };
})();
