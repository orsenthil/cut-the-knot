"use strict";

/*
 * Isoperimetric, from Alexander Bogomolny's applet of the same name.
 *
 * The applet shows three families of curves between the same two endpoints A
 * and B: one big semicircle against abutting small semicircles, one broken
 * line A-M-B against small broken lines, and one freehand curve against small
 * similar copies of it. In every family the pieces divide the segment AB, so
 * every blue piece is a scaled copy of its red curve and the two total
 * lengths are equal. This core holds that geometry and nothing else: no DOM,
 * no window, one global. The position is plain data for the record and tutor.
 *
 * The numbers below come from the bytecode: PointMover.Reset puts A at
 * (30, 3h/4) and B at (w-30, 3h/4); the break-point x positions come from its
 * order[j] = j+2 table; LinearPointMover.Reset puts the apex at the midpoint
 * of the first gap and at 3h/8; SplinePointMover.Reset makes 21 points at
 * u = -10..10 with y offset (u^2-100)(u^2+40) * h/8000.
 */
const IsoperimetricCore = (() => {
  const WIDTH = 600;
  const HEIGHT = 400;
  const MARGIN = 30;
  const N_MIN = 1;
  const N_MAX = 15;
  const MODES = ["arcs", "lines", "spline"];
  const SPLINE_COUNT = 21;
  const SPLINE_HALF = 10;
  const STEP = 4; // CubicSpline.Draw's pixel step
  const GAP = 8; // keeps a dragged break point between its neighbours

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The two endpoints the applet sets from the canvas rectangle. */
  function endpoints(state) {
    const a = { x: MARGIN, y: Math.floor((state.height * 3) / 4) };
    const b = { x: state.width - MARGIN, y: a.y };
    return { A: a, B: b, L: b.x - a.x };
  }

  /** PointMover.Reset: its odd order[j] = j+2 table and the running sum. */
  function initialPoints(n, state) {
    const { A, L } = endpoints(state);
    const order = [];
    let sum = 0;
    for (let j = 0; j <= n; j++) {
      order[j] = j + 2;
      sum += order[j];
    }
    const points = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += order[n - i];
      points.push({ x: A.x + (L * acc) / sum, y: A.y });
    }
    return points;
  }

  /** LinearPointMover.Reset: the apex of the first little broken line. */
  function initialApex(n, state) {
    const { A, L } = endpoints(state);
    return { x: A.x + L / (n + 1) / 2, y: (state.height * 3) / 8 };
  }

  /** SplinePointMover.Reset: 21 points on a symmetric double dip. */
  function initialSpline(state) {
    const { A, B } = endpoints(state);
    const mid = (A.x + B.x) / 2;
    const size = (state.height / 2) / 4000;
    const points = [];
    for (let k = 0; k < SPLINE_COUNT; k++) {
      const u = k - SPLINE_HALF;
      const dip = (u * u - 100) * (u * u + 40);
      points.push({
        x: Math.round(mid + ((B.x - A.x) * u) / (SPLINE_COUNT - 1)),
        y: Math.round(A.y + size * dip),
      });
    }
    return points;
  }

  /** The start position, or the position after Reset / a mode / count change. */
  function start(options) {
    const o = options || {};
    const width = o.width || WIDTH;
    const height = o.height || HEIGHT;
    const mode = MODES.indexOf(o.mode) >= 0 ? o.mode : "arcs";
    const n = clamp(Math.round(o.n === undefined ? 3 : o.n), N_MIN, N_MAX);
    const base = { width, height, mode, n, alternate: false, reflect: false };
    return {
      ...base,
      points: initialPoints(n, base),
      apex: initialApex(n, base),
      spline: initialSpline(base),
    };
  }

  function reset(state, options) {
    const o = options || {};
    return start({
      width: state.width,
      height: state.height,
      mode: o.mode || state.mode,
      n: o.n === undefined ? state.n : o.n,
      alternate: o.alternate === undefined ? state.alternate : o.alternate,
    });
  }

  /** Only the freehand family has the Y-alternate (reflect) checkbox. */
  function setFlag(state, key, value) {
    if (key !== "alternate" && key !== "reflect") return state;
    const next = { ...state, [key]: !!value };
    if (key === "reflect" && state.mode !== "spline") next.reflect = false;
    return next;
  }

  /** Move one of the hollow circles; the index is in the family's own list. */
  function move(state, kind, index, p) {
    const { A, B, L } = endpoints(state);
    if (kind === "point" && index >= 0 && index < state.n) {
      const left = index === 0 ? A.x + GAP : state.points[index - 1].x + GAP;
      const right = index === state.n - 1 ? B.x - GAP : state.points[index + 1].x - GAP;
      if (left > right) return state;
      const points = state.points.map((q, k) =>
        k === index ? { x: clamp(p.x, left, right), y: A.y } : q);
      return { ...state, points };
    }
    if (kind === "apex") {
      return {
        ...state,
        apex: {
          x: clamp(p.x, A.x + GAP, B.x - GAP),
          y: clamp(p.y, GAP, A.y - GAP),
        },
      };
    }
    if (kind === "spline" && index >= 0 && index < state.spline.length) {
      // VPoint.UpdateLocation changes y only: these handles move vertically.
      const spline = state.spline.map((q, k) =>
        k === index ? { x: q.x, y: clamp(p.y, GAP, state.height - GAP) } : q);
      return { ...state, spline };
    }
    return state;
  }

  /** The x values that cut AB into the little replicas: A, the points, B. */
  function cuts(state) {
    const { A, B } = endpoints(state);
    return [A.x, ...state.points.slice(0, state.n).map((p) => p.x), B.x];
  }

  /** One big semicircle above a row of smaller ones (below the baseline). */
  function arcs(state) {
    const { A, B, L } = endpoints(state);
    const xs = cuts(state);
    const red = [];
    const blue = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const p = { x: xs[i], y: A.y };
      const q = { x: xs[i + 1], y: A.y };
      const r = (q.x - p.x) / 2;
      const piece = { p, q, r, length: Math.PI * r };
      red.push(piece);
      blue.push({ ...piece, below: state.alternate && i % 2 === 1 });
    }
    // The red curve is the single semicircle on the whole diameter AB.
    return {
      red: [{ p: A, q: B, r: L / 2, length: (Math.PI * L) / 2, below: false }],
      blue,
      redLength: (Math.PI * L) / 2,
      blueLength: blue.reduce((s, p) => s + p.length, 0),
    };
  }

  /**
   * The broken-line family. A little V over [p,q] is the big V scaled by
   * (q.x-p.x)/L; with X-alternate every other V is the mirror below AB.
   * The first V is over [A,P0] and the last is over [P(n-1),B].
   */
  function apexOf(state, p, q, mirrored) {
    const { A, L } = endpoints(state);
    const M = state.apex;
    const t = (q.x - p.x) / L;
    return mirrored
      ? { x: q.x - t * (M.x - A.x), y: A.y - t * (M.y - A.y) }
      : { x: p.x + t * (M.x - A.x), y: A.y + t * (M.y - A.y) };
  }

  function lines(state) {
    const { A, B } = endpoints(state);
    const xs = cuts(state);
    const n = xs.length - 2;
    const apexes = [apexOf(state, { x: xs[0], y: A.y }, { x: xs[1], y: A.y }, false)];
    const blue = [
      { p: A, q: apexes[0] },
      { p: apexes[0], q: { x: xs[1], y: A.y } },
    ];
    for (let i = 0; i < n; i++) {
      const p = { x: xs[i + 1], y: A.y };
      const q = { x: xs[i + 2], y: A.y };
      // The loop's toggle is true for even i; the closing toggle at the end
      // is true when n is odd.
      const mirrored = state.alternate && (i < n - 1 ? i % 2 === 0 : n % 2 === 1);
      const x = apexOf(state, p, q, mirrored);
      apexes.push(x);
      blue.push({ p, q: x }, { p: x, q });
    }
    const red = [{ p: A, q: state.apex }, { p: state.apex, q: B }];
    const redLength = red.reduce((s, seg) => s + dist(seg.p, seg.q), 0);
    const blueLength = blue.reduce((s, seg) => s + dist(seg.p, seg.q), 0);
    return { red, blue, apexes, redLength, blueLength };
  }

  /* ------------------------------- clamped cubic spline (CubicSpline.java) */

  function fitSpline(points) {
    const n = points.length;
    const h = new Array(n - 1);
    const alpha = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = points[i + 1].x - points[i].x;
      alpha[i] = (points[i + 1].y - points[i].y) / h[i];
    }
    // Tridiagonal.Solve, in the applet's scaling: (h_i/6)M_{i-1} +
    // ((h_i+h_{i+1})/3)M_i + (h_{i+1}/6)M_{i+1} = alpha_{i+1} - alpha_i.
    // CubicSpline sets N = points.length - 1 and solves a system of N-1.
    const size = n - 2;
    const lower = new Array(size).fill(0);
    const diag = new Array(size).fill(0);
    const upper = new Array(size).fill(0);
    const rhs = new Array(size).fill(0);
    for (let i = 0; i < size; i++) {
      diag[i] = (h[i] + h[i + 1]) / 3;
      if (i > 0) lower[i] = h[i] / 6;
      if (i < size - 1) upper[i] = h[i + 1] / 6;
      rhs[i] = alpha[i + 1] - alpha[i];
    }
    const m = new Array(size).fill(0);
    for (let i = 1; i < size; i++) {
      const factor = lower[i] / diag[i - 1];
      diag[i] -= factor * upper[i - 1];
      rhs[i] -= factor * rhs[i - 1];
    }
    m[size - 1] = rhs[size - 1] / diag[size - 1];
    for (let i = size - 2; i >= 0; i--) {
      m[i] = (rhs[i] - upper[i] * m[i + 1]) / diag[i];
    }
    return { h, alpha, m };
  }

  /** CubicSpline.Value without the DOM: the screen y at screen x. */
  function splineValue(state, x) {
    const pts = state.spline;
    const { h, m } = fitSpline(pts);
    const n = pts.length;
    let i = 0;
    while (i < n - 2 && x > pts[i + 1].x) i++;
    const hh = h[i];
    const t1 = (pts[i + 1].x - x) / hh;
    const t2 = (x - pts[i].x) / hh;
    const left = i === 0 ? 0 : m[i - 1];
    const right = i > n - 3 ? 0 : m[i];
    const curve =
      t1 * pts[i].y + t2 * pts[i + 1].y +
      ((t1 * t1 * t1 - t1) * left + (t2 * t2 * t2 - t2) * right) * ((hh * hh) / 6);
    return curve;
  }

  function splineSamples(state) {
    const { A, B } = endpoints(state);
    const out = [];
    for (let x = A.x; x <= B.x; x += STEP) out.push({ x, y: splineValue(state, x) });
    const last = out[out.length - 1];
    if (!last || last.x < B.x) out.push({ x: B.x, y: splineValue(state, B.x) });
    return out;
  }

  /**
   * The freehand family. SplinePointMover.Draw keeps the drawn copy inside
   * its gap [p,q]: the whole red curve is the source (Scale with factor
   * L/(q-p) from the gap's left edge), so the copy is smaller by (q-p)/L.
   * X-alternate flips it vertically, and Y-alternate reverses it along x.
   */
  function spline(state) {
    const { A, L } = endpoints(state);
    const xs = cuts(state);
    const red = splineSamples(state);
    const blue = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const p = xs[i];
      const q = xs[i + 1];
      const scale = L / (q - p);
      const dir = state.reflect ? -1 : 1;
      const x0 = state.reflect ? q : p;
      const sign = state.alternate && i % 2 === 1 ? -1 : 1;
      blue.push(red.map((pt) => ({
        x: x0 + (dir * (pt.x - A.x)) / scale,
        y: A.y + (sign / scale) * (pt.y - A.y),
      })));
    }
    const lengthOf = (poly) => {
      let total = 0;
      for (let i = 1; i < poly.length; i++) total += dist(poly[i - 1], poly[i]);
      return total;
    };
    return {
      red,
      blue,
      redLength: lengthOf(red),
      blueLength: blue.reduce((s, poly) => s + lengthOf(poly), 0),
    };
  }

  /** The lengths the picture is asking about, in one place. */
  function lengths(state) {
    if (state.mode === "lines") {
      const g = lines(state);
      return { red: g.redLength, blue: g.blueLength };
    }
    if (state.mode === "spline") {
      const g = spline(state);
      return { red: g.redLength, blue: g.blueLength };
    }
    const g = arcs(state);
    return { red: g.redLength, blue: g.blueLength };
  }

  /** A demo: there is no win, loss or finishing move. */
  function result(state) {
    return null;
  }

  /** JSON-safe board position for Track.state and the tutor. */
  function position(state) {
    return {
      mode: state.mode,
      n: state.n,
      alternate: state.alternate,
      reflect: state.reflect,
      width: state.width,
      height: state.height,
      points: state.points.map((p) => Number(p.x.toFixed(3))),
      apex: { x: Number(state.apex.x.toFixed(3)), y: Number(state.apex.y.toFixed(3)) },
      spline: state.spline.map((p) => Number(p.y.toFixed(3))),
    };
  }

  return {
    WIDTH, HEIGHT, N_MIN, N_MAX, MODES, STEP, GAP,
    clamp, dist, endpoints, initialPoints, initialApex, initialSpline,
    start, reset, setFlag, move, cuts, arcs, apexOf, lines,
    fitSpline, splineValue, splineSamples, spline, lengths, result, position,
  };
})();
