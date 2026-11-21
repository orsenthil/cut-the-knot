"use strict";

/*
 * The Delian construction — the logic behind Alexander Bogomolny's applet
 * "Delian" (cut-the-knot.org/do_you_know/Delian.shtml, a reader's "solution"
 * to the doubling of the cube).
 *
 * The construction, in the applet's own steps. Take a right triangle ABC with
 * AB = 2 (the height) and BC = 1 (the base). D is the midpoint of AB, so AD = 1.
 * The point X on AB with AX = sqrt 2 (the hypotenuse of a unit right triangle at
 * A, carried over with a compass) gives, by a parallel to BC, the point F on AC;
 * the triangle BFD is the "Golden Triangle". Divide BC into N equal parts and join
 * A to the points of division (radials). Each radial meets DF and BF; from the
 * point on DF draw a parallel to BF down to AB, from the point on BF a parallel
 * to DF down to AB. The reader claims the points where these meet AB, from A
 * outward, are 2^(k/N): the N-1 mean proportionals between AD = 1 and AB = 2, and
 * for N = 3 the cube root of 2, which would double a cube with compass and
 * straight edge. That is impossible (Wantzel, 1837): x^3 - 2 has no rational root,
 * so it is irreducible over the rationals, and a constructible number lies in a
 * tower of quadratic extensions, so its degree over Q is a power of 2.
 *
 * What the construction really gives (checked by the logic test for every N): the
 * point for division k lies at distance
 *       f(t) = (1 + (sqrt 2 - 1) t) / (1 - (1 - sqrt 2 / 2) t)     from A, t = k/N,
 * a projective (Moebius) function of t, not 2^t. They agree at t = 0, 1/2 and 1,
 * which is why the picture looks right, and differ by less than 0.0024 anywhere
 * (about 0.13%), which is why the mistake is hard to see: f(1/3) = 1.26120 where
 * the cube root of 2 is 1.25992.
 *
 * The applet's scroll bar N runs from 2 to 20 and opens at 2. This file does the
 * plane geometry in real numbers, with B at the origin, A = (0, 2), C = (-1, 0)
 * (y up). No document, no window, no storage; the position is plain data.
 */
const DelianCore = (() => {
  const MIN_N = 2;
  const MAX_N = 20; // Scrollbar(0, 2, 5, 2, 25): the value runs from 2 to 25 - 5
  const START_N = 2;
  const SQRT2 = Math.SQRT2;

  /** A new position. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX_N, Math.trunc(Number(o.n)))) : START_N;
    return { n, moves: 0, explored: false };
  }

  /* ----------------------------------------------------------- plane geometry */

  /** The intersection of line p1-p2 with line p3-p4 (GeoSDoub.Intersect), or null if they are parallel. */
  function intersect(p1, p2, p3, p4) {
    const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-14) return null;
    const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }

  /** The line through p parallel to q-r, as a second point (GeoSDoub.GetParallelTo). */
  const parallel = (p, q, r) => [p[0] + (r[0] - q[0]), p[1] + (r[1] - q[1])];

  /** The fixed points of the construction. */
  function frame() {
    const A = [0, 2], B = [0, 0], C = [-1, 0], D = [0, 1];
    const X = [0, 2 - SQRT2]; // on AB with AX = sqrt 2 (compass arc of radius AE with AE = sqrt(AD^2 + DE^2))
    const F = [-SQRT2 / 2, 2 - SQRT2]; // the parallel to BC through X meets AC at F
    return { A, B, C, D, E: [-1, 1], X, F };
  }

  /** The distance from A of a point on AB. */
  const fromA = (p) => 2 - p[1];

  /** The whole construction for N divisions of BC, step by step as the applet draws it. */
  function construct(n) {
    const f = frame();
    const divisions = [];
    for (let i = 0; i < n; i++) {
      const P = [-1 + i / n, 0]; // the i-th point of division, from C towards B
      const Q = intersect(f.A, P, f.D, f.F); // the radial meets DF
      const R = intersect(f.A, P, f.B, f.F); // and BF
      const S = intersect(Q, parallel(Q, f.B, f.F), f.A, f.B); // parallel to BF through Q meets AB
      const T = intersect(R, parallel(R, f.D, f.F), f.A, f.B); // parallel to DF through R meets AB
      divisions.push({ i, P, Q, R, S, T, fromAS: fromA(S), fromAT: fromA(T) });
    }
    return { n, ...f, divisions };
  }

  /**
   * The N + 1 points on AB the reader says are 1, 2^(1/N), ..., 2: what the construction gives for
   * k = 0..N (k = N is B itself), and the claim.
   */
  function positions(n) {
    const c = construct(n);
    const rows = [];
    for (let k = 0; k <= n; k++) {
      const got = k === n ? 2 : c.divisions[k].fromAT;
      const claimed = Math.pow(2, k / n);
      rows.push({ k, got, claimed, error: got - claimed, relativeError: (got - claimed) / claimed });
    }
    return rows;
  }

  /** The closed form the construction really follows: a projective function of t = k / N. */
  function projective(t) {
    return (1 + (SQRT2 - 1) * t) / (1 - (1 - SQRT2 / 2) * t);
  }

  /** The reader's claim, exponential: 2^t. */
  const exponential = (t) => Math.pow(2, t);

  /** The worst gap between the construction and 2^(k/N) over k. */
  function worst(n) {
    const rows = positions(n);
    let best = rows[0];
    for (const r of rows) if (Math.abs(r.error) > Math.abs(best.error)) best = r;
    return best;
  }

  /** The largest gap between the two functions anywhere in [0, 1], and where it occurs. */
  function worstAnywhere(samples) {
    const n = samples || 100000;
    let max = 0, at = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, e = Math.abs(projective(t) - exponential(t));
      if (e > max) { max = e; at = t; }
    }
    return { max, at };
  }

  /** Why the cube cannot be doubled with ruler and compass: x^3 - 2 has no rational root. */
  function cubeRootOfTwoIsNotConstructible() {
    // A rational root p/q (lowest terms) of x^3 - 2 needs p | 2 and q | 1: only +-1, +-2.
    const candidates = [1, -1, 2, -2];
    const roots = candidates.filter((x) => x * x * x - 2 === 0);
    return { candidates, roots, irreducibleCubic: roots.length === 0, degree: 3, constructibleDegreesArePowersOfTwo: true };
  }

  /** The moves: set N. */
  function legalMoves() {
    return [{ type: "n", value: START_N }, { type: "n", dir: 1 }, { type: "n", dir: -1 }];
  }

  function move(state, m) {
    if (!m) return null;
    if (m.type !== "n") return null;
    const v = m.dir !== undefined ? state.n + (m.dir > 0 ? 1 : -1) : Math.trunc(Number(m.value));
    if (!Number.isFinite(v) || v < MIN_N || v > MAX_N) return null;
    return { ...state, n: v, moves: state.moves + 1, explored: true };
  }

  /** A demo: nothing to win; "done" once N has been set to 12 (the reader's case) or 3 (the cube root). */
  function result(state) {
    return state.explored && (state.n === 3 || state.n === 12) ? "done" : null;
  }

  return {
    MIN_N, MAX_N, START_N, SQRT2,
    start, frame, intersect, parallel, construct, positions, projective, exponential, worst, worstAnywhere, cubeRootOfTwoIsNotConstructible, legalMoves, move, result, fromA,
  };
})();
