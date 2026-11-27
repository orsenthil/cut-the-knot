"use strict";

/*
 * CirclesOnAChord — Alexander Bogomolny's "Chain of Circles on a Chord".
 *
 * N equal circles of radius r sit in a row on a chord of a big circle of
 * radius R.  The big circle touches the first and last of them internally;
 * a second chord PQ is an internal common tangent to those two end circles.
 * The old tablet problem (N = 3) asks to show PQ = R + 3r.  The page
 * generalises to any N >= 3: PQ = 2(R + N(N-2)r)/(N-1), which with the
 * dashed circle of radius rho = Nr becomes PQ = 2(R + (N-2)rho)/(N-1).
 *
 * The one idea the code relies on: if O' is the middle of the row and d is
 * the distance from the big centre to O', then
 *   d² + [(N-1)r]² = (R-r)²,
 * so r is the positive root of a half-linear quadratic.  Once r is known the
 * tangent is built exactly as the applet builds it (two auxiliary circles
 * meet at the tangency point), and PQ is the chord cut off by that tangent.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CirclesOnAChordCore, so the page loads it
 * with a plain <script> and porting/check-circles-on-a-chord.mjs loads it in
 * Node.  The position is plain data (numbers and plain objects).
 */

const CirclesOnAChordCore = (() => {
  // The applet's own canvas is 400x300 with radius min(W,H)/3.  The page uses
  // a slightly shorter board so the row of seven circles still has room.
  const VIEW = { width: 400, height: 280 };
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 3;
  const N_MIN = 3, N_MAX = 7;   // the applet's JSpinner: 3,3,7,1
  const START_N = 3;
  const START_O = { x: CENTER.x, y: CENTER.y - RADIUS / 2 };

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** QuadraticEquation.Solve2(a,b,c): a x² + 2b x + c = 0, or null. */
  function solveHalf(a, b, c) {
    if (Math.abs(a) < 0.01) return null;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    return [(-b + s) / a, (-b - s) / a];
  }

  /** CTKGeometryPlus.Prorate(p,q,r): p plus r units towards q. */
  function prorate(p, q, r) {
    const d = dist(p, q);
    if (d < 0.1) return { x: p.x, y: p.y };
    return add(p, mul(sub(q, p), r / d));
  }

  /** The two points where the infinite line through p and q meets a circle. */
  function lineCircle(p, q, circle) {
    const v = sub(q, p);
    const len = Math.hypot(v.x, v.y);
    if (!len) return [];
    const u = mul(v, 1 / len);
    const w = sub(p, circle.c);
    const b = w.x * u.x + w.y * u.y;
    const c = w.x * w.x + w.y * w.y - circle.r * circle.r;
    const disc = b * b - c;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [
      add(p, mul(u, -b - s)),
      add(p, mul(u, -b + s)),
    ];
  }

  /** The intersections of two circles, by the standard radical-line formula. */
  function circleCircle(c1, r1, c2, r2) {
    const dvec = sub(c2, c1);
    const d = Math.hypot(dvec.x, dvec.y);
    if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const base = add(c1, mul(dvec, a / d));
    return [
      point(base.x - (dvec.y * h) / d, base.y + (dvec.x * h) / d),
      point(base.x + (dvec.y * h) / d, base.y - (dvec.x * h) / d),
    ];
  }

  /** Keep the draggable O on the vertical line through the big centre. */
  function clampO(p) {
    const q = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : START_O;
    const lo = CENTER.y - RADIUS + 2;
    const hi = CENTER.y + RADIUS - 2;
    return point(CENTER.x, clamp(q.y, lo, hi));
  }

  /** The picture a new page opens with: the applet's N=3 and O above centre. */
  function start(options) {
    const o = options || {};
    const n = Math.round(Number(o.N));
    return {
      N: Number.isFinite(n) ? clamp(n, N_MIN, N_MAX) : START_N,
      O: clampO(o.O),
      options: {
        names: o.names === undefined ? false : !!o.names,   // "Show" parameter
        circles: o.circles === undefined ? true : !!o.circles,
        hint: o.hint === undefined ? false : !!o.hint,
        extra: o.extra === undefined ? false : !!o.extra,
      },
      explored: false,
    };
  }

  function setN(state, n) {
    const next = Math.round(Number(n));
    return Object.assign({}, state, {
      N: Number.isFinite(next) ? clamp(next, N_MIN, N_MAX) : state.N,
      explored: true,
    });
  }

  function setOption(state, key, value) {
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [key]: !!value }),
      explored: true,
    });
  }

  /** Move the dragged O; the row and the chord are recomputed from it. */
  function withO(state, p) {
    return Object.assign({}, state, { O: clampO(p), explored: true });
  }

  /** The applet's ComputeTangent(), with the same choice of intersection. */
  function computeTangent(circles, big) {
    const first = circles[0], last = circles[circles.length - 1];
    const r1 = first.r, r2 = last.r;
    const helper = { c: first.c, r: r1 + r2 };
    const mid = point((first.c.x + last.c.x) / 2, (first.c.y + last.c.y) / 2);
    const half = dist(first.c, last.c) / 2;
    const midCircle = { c: mid, r: half };
    const hits = circleCircle(helper.c, helper.r, midCircle.c, midCircle.r);
    // The applet keeps the intersection with the larger screen y (the lower one).
    const x = !hits.length ? mid
      : hits[0].y < hits[1].y ? hits[1] : hits[0];
    // The second tangency vector is C2 - (X - C1), not C2 - X - C1.
    const delta = sub(last.c, sub(x, first.c));
    const T = prorate(first.c, x, r1);
    const S = prorate(last.c, delta, r2);
    const W = prorate(big.c, last.c, big.r);
    return { T, S, W, line: { p: T, q: S } };
  }

  /** Everything the page draws, in board units, recomputed from `state`. */
  function geometry(state) {
    const N = state.N;
    const big = { c: CENTER, r: RADIUS };
    const O = state.O;
    const d = dist(O, big.c);
    const result = {
      big, O, N, d, doDraw: d < big.r, A: null, B: null, circles: [],
      dash: null, dots: [], row: [], tangent: null, P: null, Q: null,
      chord: null, r: null, rho: null,
    };
    if (!result.doDraw) return result;

    // The chord AB through O parallel to D1D2, i.e. the horizontal line.
    const ra = Math.sqrt(Math.max(0, big.r * big.r - (O.y - big.c.y) ** 2));
    result.A = point(O.x - ra, O.y);
    result.B = point(O.x + ra, O.y);

    // d² + [(N-1)r]² = (R-r)² as a half-linear quadratic.
    const roots = solveHalf((N - 1) * (N - 1) - 1, big.r, d * d - big.r * big.r);
    if (!roots) {
      result.doDraw = false;
      return result;
    }
    const r = roots[0] >= 0 ? roots[0] : roots[1];
    result.r = r;
    const rho = N * r;
    result.rho = rho;
    for (let i = 0; i < N; i++) {
      result.circles.push({
        c: point(O.x - (N - 1 - 2 * i) * r, O.y),
        r: r,
      });
    }
    result.dash = { c: point(O.x, O.y), r: rho };

    // J. Marshall Unger's two dotted circles and the dots along the diameter.
    const k = 1 / (N - 1);
    const low = big.c.y - big.r, high = big.c.y + big.r;
    const gapLow = Math.abs(low - (O.y - rho)) * k;
    const gapHigh = Math.abs(high - (O.y + rho)) * k;
    const above = O.y < big.c.y;
    const r0 = above ? Math.abs(rho - gapLow) : Math.abs(rho - gapHigh);
    const r1 = above ? Math.abs(rho + gapHigh) : Math.abs(rho + gapLow);
    result.dots.push({ c: point(O.x, O.y), r: r0 });
    result.dots.push({ c: point(O.x, O.y), r: r1 });
    for (let i = 0; i < N; i++) {
      if (above) {
        result.row.push(point(O.x, O.y - rho + i * gapLow));
        result.row.push(point(O.x, O.y + rho + i * gapHigh));
      } else {
        result.row.push(point(O.x, O.y + rho + i * gapHigh));
        result.row.push(point(O.x, O.y - rho - i * gapLow));
      }
    }

    result.tangent = computeTangent(result.circles, big);
    const ends = lineCircle(result.tangent.line.p, result.tangent.line.q, big);
    if (ends.length < 2) {
      result.doDraw = false;
      return result;
    }
    ends.sort((p, q) => p.x - q.x);
    result.P = ends[0];
    result.Q = ends[1];
    result.chord = dist(result.P, result.Q);
    return result;
  }

  /** The page's claim, in the form that removes the square root. */
  function theorem(state) {
    const N = state.N;
    const r = geometry(state).r;
    if (r === null) return null;
    return 2 * (RADIUS + N * (N - 2) * r) / (N - 1);
  }

  function describe(state) {
    const g = geometry(state);
    if (!g.doDraw) return "Move O back inside the big circle to see the chain.";
    const rho = g.rho;
    const right = g.N === 3 ? `R + 3r = ${theorem(state).toFixed(2)}`
      : `2(R + ${g.N}(${g.N} - 2)r)/(${g.N} - 1) = ${theorem(state).toFixed(2)}`;
    return `${g.N} circles: r = ${g.r.toFixed(2)}, the dashed radius is ${rho.toFixed(2)}, and the chord PQ is ${g.chord.toFixed(2)} (${right}).`;
  }

  /** An illustration has no win or loss. */
  function result(state) {
    return null;
  }

  return {
    VIEW, CENTER, RADIUS, N_MIN, N_MAX, START_N, START_O,
    point, add, sub, mul, dist, clamp, solveHalf, prorate, lineCircle,
    circleCircle, clampO, start, setN, setOption, withO, computeTangent,
    geometry, theorem, describe, result,
  };
})();
