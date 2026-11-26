"use strict";

/*
 * Arbelos Bui — Alexander Bogomolny's illustration of Bùi Quang Tuấn's pair of
 * circles in an arbelos.  On the three semicircles of diameter AC, CB and AB,
 * the perpendicular bisectors of AC and CB meet the big semicircle at D1 and
 * D2; the lines D1A, D1C meet the small semicircle at E1, F1, and D2C, D2B meet
 * the other one at E2, F2.  The circles with diameters E1F1 and E2F2 have the
 * radius of Archimedes' twins, r1*r2/(r1+r2), and their centres are the same
 * distance from O.  All of that is checked over many positions in
 * porting/check-arbelos-bui.mjs.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, ArbelosBuiCore, so the page loads it with a
 * plain <script> and the logic test can load it in Node.  Positions are plain
 * objects in the SVG's viewBox coordinates.
 *
 * The old applet let A and B move vertically as well, which takes the three
 * points off one line and so stops the figure being an arbelos.  Here all three
 * handles stay on the baseline: a deliberate restriction so that the picture
 * always shows the construction the article describes.  The horizontal limits
 * (a gap of five units, a five-unit margin) are the applet's own.
 */

const ArbelosBuiCore = (() => {
  const VIEW = { width: 400, height: 250 };
  const BASE_Y = Math.floor(VIEW.height * 5 / 6); // 208: the applet's row
  const GAP = 5; // the applet's PointIsEligible margin
  const P = (x, y) => ({ x: x, y: y });
  const add = (p, q) => P(p.x + q.x, p.y + q.y);
  const sub = (p, q) => P(p.x - q.x, p.y - q.y);
  const mul = (p, k) => P(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Where a dragged handle may go: on the baseline, between its neighbours. */
  function project(state, name, p) {
    if (!p || !Number.isFinite(p.x)) return state[name];
    const x = p.x;
    if (name === "A") {
      return P(Math.max(GAP + 1, Math.min(x, state.C.x - GAP - 1)), BASE_Y);
    }
    if (name === "B") {
      return P(Math.min(VIEW.width - GAP - 1, Math.max(x, state.C.x + GAP + 1)), BASE_Y);
    }
    if (name === "C") {
      return P(Math.max(state.A.x + GAP + 1, Math.min(x, state.B.x - GAP - 1)), BASE_Y);
    }
    return state[name];
  }

  /** The applet's starting points: A=(20,208), B=(380,208), C=0.3A+0.7B. */
  function start(options) {
    const o = options || {};
    const A = P(20, BASE_Y);
    const B = P(VIEW.width - 20, BASE_Y);
    return {
      A: A,
      B: B,
      C: P(0.3 * A.x + 0.7 * B.x, BASE_Y),
      options: {
        names: o.names === undefined ? true : !!o.names,
        proposition: !!o.proposition,
        hint: !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function legalMoves(state) {
    return ["A", "B", "C"];
  }

  function move(state, name, p) {
    if (!legalMoves(state).includes(name) || !p || !Number.isFinite(p.x)) return state;
    return Object.assign({}, state, { [name]: project(state, name, p), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  /* The applet's GeoSDoub.Intersect(DoubLine, DoubCircle): substitute the
   * parametric line v + t*(towards-v) into the circle and solve the quadratic. */
  function lineCircle(v, towards, circle) {
    const d = sub(towards, v);
    const f = sub(v, circle.c);
    const a = dot(d, d);
    if (a < 1e-18) return [];
    const b = 2 * dot(f, d);
    const c = dot(f, f) - circle.r * circle.r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [
      add(v, mul(d, (-b + s) / (2 * a))),
      add(v, mul(d, (-b - s) / (2 * a))),
    ];
  }

  /** FindEF in the applet: the intersection that is not the given vertex.
   *  The applet uses a one-unit test for this, which picks the vertex itself
   *  when a semicircle is only a few units wide; taking the farther point is
   *  the same choice whenever the figure is big enough and keeps the article's
   *  claims true at the extremes too. */
  function other(points, vertex) {
    if (!points.length) return null;
    if (points.length < 2) return points[0];
    return dist(points[0], vertex) >= dist(points[1], vertex) ? points[0] : points[1];
  }

  /** FindD in the applet: perpendicular bisector of a diameter, upper point. */
  function findD(big, small, A, B) {
    const c = small.c;
    const aux = P(c.x + (A.y - B.y), c.y - (A.x - B.x));
    const pts = lineCircle(aux, c, big);
    if (pts.length < 2) return null;
    return pts[0].y < A.y ? pts[0] : pts[1];
  }

  /** Every point of the drawing, transcribed from ArbelosBuiCanvas.Compute(). */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C;
    const r1 = dist(A, C) / 2;
    const r2 = dist(C, B) / 2;
    const R = dist(A, B) / 2;
    if (!(r1 > 1e-6 && r2 > 1e-6)) return null;

    const big = { c: mid(A, B), r: R };
    const c1 = { c: mid(A, C), r: r1 };
    const c2 = { c: mid(C, B), r: r2 };
    const D1 = findD(big, c1, A, B);
    const D2 = findD(big, c2, A, B);
    const E1 = other(lineCircle(D1, A, c1), A);
    const E2 = other(lineCircle(D2, C, c2), C);
    const F1 = other(lineCircle(D1, C, c1), C);
    const F2 = other(lineCircle(D2, B, c2), B);
    const K1 = mid(E1, F1);
    const K2 = mid(E2, F2);
    const rho = dist(E1, F1) / 2;
    const k1 = { c: K1, r: rho };
    const k2 = { c: K2, r: rho };
    const G1 = other(lineCircle(E1, D1, k1), E1);
    const H1 = other(lineCircle(F1, D1, k1), F1);
    const G2 = other(lineCircle(E2, D2, k2), E2);
    const H2 = other(lineCircle(F2, D2, k2), F2);

    const all = [A, B, C, D1, D2, E1, E2, F1, F2, K1, K2, G1, H1, G2, H2];
    if (!all.every(finite)) return null;

    return {
      A: A, B: B, C: C, O: big.c, O1: c1.c, O2: c2.c,
      D1: D1, D2: D2, E1: E1, E2: E2, F1: F1, F2: F2,
      K1: K1, K2: K2, G1: G1, H1: H1, G2: G2, H2: H2,
      big: big, c1: c1, c2: c2, k1: k1, k2: k2,
      r1: r1, r2: r2, R: R,
      rho: rho, twinRadius: r1 * r2 / (r1 + r2),
      k1o: dist(K1, big.c), k2o: dist(K2, big.c),
      span1: dist(G1, H1), span2: dist(G2, H2),
      arbelosArea: Math.PI * r1 * r2,
      twinArea: Math.PI * rho * rho,
    };
  }

  /** Spoken status line; the test checks the numbers it reports. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move C away from A or B to make the two semicircles.";
    return "AC " + Math.round(dist(state.A, state.C)) + ", CB " +
      Math.round(dist(state.C, state.B)) + ". Each new circle has radius " +
      g.rho.toFixed(1) + ", and both centres are " + g.k1o.toFixed(1) +
      " from O. The two extra chords add to " + (g.span1 + g.span2).toFixed(1) +
      ", twice that radius.";
  }

  return {
    VIEW: VIEW, BASE_Y: BASE_Y, GAP: GAP,
    start: start, reset: reset, legalMoves: legalMoves, move: move,
    setOption: setOption, project: project, result: result,
    geometry: geometry, describe: describe,
    dist: dist, mid: mid,
  };
})();
