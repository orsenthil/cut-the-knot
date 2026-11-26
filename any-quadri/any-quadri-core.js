"use strict";

/*
 * Any Quadri — Alexander Bogomolny's applet AnyQuadri ("Bimedians in a
 * Quadrilateral").
 *
 * Drag the four corners of a quadrilateral.  K, L, M, N are the midpoints of
 * its sides AB, BC, CD, DA; E and F are the midpoints of its diagonals BD and
 * AC.  The page claims that the three segments EF, KM and LN (the bimedians)
 * meet at one point and that each is cut in half there.  The common point is
 * the centroid G = (A+B+C+D)/4: the barycenter of four equal weights at the
 * corners.  The applet's Hint colours two sides of the parallelogram ENFL
 * and its diagonal NL to show why NL and EF bisect each other.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, AnyQuadriCore, so the page loads it with a
 * plain <script> and porting/check-any-quadri.mjs loads it in Node.  Positions
 * are plain data in the SVG viewBox units.
 */
const AnyQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 14;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  /* The applet's MidPoint(DoubPoint, DoubPoint): component-wise / 2.0. */
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** Keep a corner inside the board, with room for its label and handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * AnyQuadriCanvas.Reset() on a 400x300 canvas, straight from the bytecode:
   * with W=400, H=300, locals 4=40, 5=60, 7=30, 8=30,
   *   A[0] = (W/2 - 4*40 + 30, H/2 - 60 + 30)        = (70, 120)
   *   A[1] = (W/2 + 30,       H/2 - 2*40 - 60 + 30)  = (230, 40)
   *   A[2] = (W/2 + 2*40+30,  H/2 + 2*40 - 60 + 30)  = (310, 200)
   *   A[3] = (W/2 + 30 + 25,  H - 2*60 + 30)         = (255, 210)
   * The Hint checkbox starts unchecked.
   */
  function start(options) {
    const o = options || {};
    return {
      A: point(70, 120), B: point(230, 40), C: point(310, 200), D: point(255, 210),
      options: { hint: o.hint === undefined ? false : !!o.hint },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /**
   * All the points of the drawing, from the four corners.  E and F are the
   * diagonal midpoints; K,L,M,N the side midpoints; G the common midpoint.
   * Returns null only when two corners coincide and the picture degenerates.
   */
  function compute(a, b, c, d) {
    const cs = [a, b, c, d];
    if (!cs.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        if (dist(cs[i], cs[j]) < 1e-9) return null;
      }
    }

    // The six midpoints, named as on the page.
    const K = midpoint(a, b); // AB
    const L = midpoint(b, c); // BC
    const M = midpoint(c, d); // CD
    const N = midpoint(d, a); // DA
    const E = midpoint(b, d); // BD
    const F = midpoint(a, c); // AC
    const G = point((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4);

    // The midpoint of each of the three bimedians.
    const kmMid = midpoint(K, M);
    const lnMid = midpoint(L, N);
    const efMid = midpoint(E, F);

    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a),
      dist(a, c), dist(b, d));
    const tol = 1e-9 * scale;

    // Concurrency: the three segment midpoints are one and the same point.
    const concurrencyError = Math.max(
      dist(kmMid, lnMid), dist(lnMid, efMid), dist(efMid, kmMid),
    );
    // Each line is bisected at G (the common point).
    const kmBisectError = dist(kmMid, G);
    const lnBisectError = dist(lnMid, G);
    const efBisectError = dist(efMid, G);

    // ENFL and EKFM are parallelograms: opposite side vectors are equal.
    const enflError = Math.max(
      dist(sub(N, E), sub(F, L)), // EN == LF
      dist(sub(F, N), sub(L, E)), // NF == EL
    );
    const ekfmError = Math.max(
      dist(sub(K, E), sub(F, M)), // EK == MF
      dist(sub(F, K), sub(M, E)), // KF == EM
    );

    // The barycenter: G is the mean of the corners, and also the mean of the
    // three pairwise combinations of midpoints.
    const barycenterError = Math.max(
      dist(G, point((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4)),
      dist(G, kmMid), dist(G, lnMid), dist(G, efMid),
    );

    const claims = {
      concurrent: concurrencyError <= tol,
      kmBisected: kmBisectError <= tol,
      lnBisected: lnBisectError <= tol,
      efBisected: efBisectError <= tol,
      parallelogramENFL: enflError <= tol,
      parallelogramEKFM: ekfmError <= tol,
      barycenter: barycenterError <= tol,
    };

    /* The Hint's coloured lines, from AnyQuadriCanvas.Draw: N-E and L-F in
     * DarkGreen, N-L in DarkOrange.  K, L, M, N, E, F are the same points the
     * applet's MidPoint() produces. */
    const hintLines = [[N, E], [L, F], [N, L]];

    return {
      A: a, B: b, C: c, D: d,
      K: K, L: L, M: M, N: N, E: E, F: F, G: G,
      kmMid: kmMid, lnMid: lnMid, efMid: efMid,
      hintLines: hintLines,
      measures: {
        concurrencyError: concurrencyError,
        kmBisectError: kmBisectError,
        lnBisectError: lnBisectError,
        efBisectError: efBisectError,
        enflError: enflError,
        ekfmError: ekfmError,
        barycenterError: barycenterError,
      },
      claims: claims,
      tol: tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a quadrilateral.";
    const m = g.measures;
    let text = "The three lines meet at one dot, and each is split into two equal parts there.";
    if (state.options.hint) {
      text += " The Hint shows the parallelogram that makes it happen.";
    }
    if (m.concurrencyError > g.tol) {
      text += ` Off by ${m.concurrencyError.toExponential(1)} in the drawing.`;
    }
    return text;
  }

  return {
    VIEW: VIEW, PAD: PAD,
    point: point, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, midpoint: midpoint, clamp: clamp,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
