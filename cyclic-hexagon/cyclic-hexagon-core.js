"use strict";

/*
 * Cyclic Hexagon, from Alexander Bogomolny's applet CyclicHexagon
 * (the page credits the theorem to Bui Quang Tuan). Six draggable points on
 * one circle form two interlaced triangles. For each A vertex we drop a
 * perpendicular to the line through its two neighbouring B vertices, and for
 * each B vertex to the line through its two neighbouring A vertices. The
 * three distances in one direction always have the same product as the three
 * in the other, and that product is the product of the six sides of the
 * hexagon divided by the cube of the circle's diameter.
 *
 * The key identity used here is that a point P on a circle of diameter D and
 * a chord UV give dist(P, line UV) = |PU| * |PV| / D: the triangle PUV is
 * right-angled at the foot of the perpendicular, and its circumcircle is the
 * original circle. The applet's own Compute() uses the same points, plus the
 * six circles on the hexagon's sides and the six half-size circles at the
 * vertices; all of them are plain functions of the six positions.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, CyclicHexagonCore, so the page loads it
 * with a plain <script> and porting/check-cyclic-hexagon.mjs loads it in Node.
 * Positions are plain data; functions never change what they are given.
 */
const CyclicHexagonCore = (() => {
  const N = 3;
  const WIDTH = 480, HEIGHT = 420;
  const TAU = Math.PI * 2;
  /* CyclicHexagonCanvas.Reset(): centre is the integer half of the canvas,
     radius is min(width/3, height/3), A_i at 2*pi*i/N and B_i at
     pi*(2*i+3)/N, i.e. opposite A_i when N is 3. */
  const CENTER = { x: Math.floor(WIDTH / 2), y: Math.floor(HEIGHT / 2) };
  const RADIUS = Math.min(Math.floor(WIDTH / 3), Math.floor(HEIGHT / 3));
  const OPTIONS = ["showNames", "showCircles1", "showCircles2"];

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const onCircle = (a) => ({ x: CENTER.x + RADIUS * Math.cos(a), y: CENTER.y + RADIUS * Math.sin(a) });
  const next = (i) => (i + 1) % N;
  const prev = (i) => (i + N - 1) % N;
  const product = (xs) => xs.reduce((a, b) => a * b, 1);

  /* GeoSDoub.NearestPoint(P, A, B): foot on the infinite line AB, with the
     applet's 0.1 early return when P is essentially at A. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return { x: p.x, y: p.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** The position a new illustration starts from. */
  function start(options) {
    const o = options || {};
    const A = [], B = [];
    for (let i = 0; i < N; i++) {
      A.push(onCircle(TAU * i / N));
      B.push(onCircle(Math.PI * (2 * i + 3) / N));
    }
    return {
      center: { x: CENTER.x, y: CENTER.y },
      radius: RADIUS,
      A: A,
      B: B,
      showNames: o.showNames === true,
      showCircles1: o.showCircles1 === true,
      showCircles2: o.showCircles2 === true,
    };
  }

  /** CTKMoveableDoub.UpdateLocation() with m_Fixed == 3: radial projection
      onto the circumcircle. name is "A0".."A2" or "B0".."B2". */
  function movePoint(state, name, p) {
    const m = /^([AB])([0-2])$/.exec(String(name));
    if (!m || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const dx = p.x - state.center.x, dy = p.y - state.center.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-12) return state; // the applet would divide by zero here
    const q = {
      x: state.center.x + (state.radius * dx) / d,
      y: state.center.y + (state.radius * dy) / d,
    };
    const key = m[1], i = Number(m[2]);
    const moved = state[key].slice();
    moved[i] = q;
    return Object.assign({}, state, { [key]: moved });
  }

  /** One of the three checkboxes from CyclicHexagonPanel. */
  function toggle(state, which) {
    if (OPTIONS.indexOf(which) < 0) return state;
    return Object.assign({}, state, { [which]: !state[which] });
  }

  /** Reset() rebuilds the six points but keeps the panel's checkboxes. */
  function reset(state) {
    return start({
      showNames: state.showNames,
      showCircles1: state.showCircles1,
      showCircles2: state.showCircles2,
    });
  }

  /** CyclicHexagonCanvas.Compute(): the whole diagram from six positions. */
  function compute(state) {
    const A = state.A, B = state.B, R = state.radius, D = 2 * R;
    const K = [], L = [], k = [], l = [], P = [], Q = [];
    const rP = [], rQ = [], circleA = [], circleB = [], circleOA = [], circleOB = [];
    const sides = [];
    for (let i = 0; i < N; i++) {
      K[i] = foot(A[i], B[next(i)], B[prev(i)]);
      L[i] = foot(B[i], A[next(i)], A[prev(i)]);
      k[i] = dist(A[i], K[i]);
      l[i] = dist(B[i], L[i]);
      P[i] = mid(A[i], B[next(i)]);
      Q[i] = mid(B[i], A[next(i)]);
      rP[i] = dist(A[i], B[next(i)]) / 2;
      rQ[i] = dist(B[i], A[next(i)]) / 2;
      sides[2 * i] = 2 * rP[i];
      sides[2 * i + 1] = 2 * rQ[i];
      circleA[i] = { center: P[i], radius: rP[i] }; // GetCircumcircle(A_i, B_i+1, K_i)
      circleB[i] = { center: Q[i], radius: rQ[i] }; // GetCircumcircle(B_i, A_i+1, L_i)
      circleOA[i] = { center: mid(A[i], state.center), radius: R / 2 };
      circleOB[i] = { center: mid(B[i], state.center), radius: R / 2 };
    }
    const kProduct = product(k), lProduct = product(l), sideProduct = product(sides);
    return {
      N: N, A: A, B: B, K: K, L: L, k: k, l: l, P: P, Q: Q,
      rP: rP, rQ: rQ, sides: sides,
      circleA: circleA, circleB: circleB, circleOA: circleOA, circleOB: circleOB,
      R: R, D: D,
      kProduct: kProduct, lProduct: lProduct, sideProduct: sideProduct,
      sideOverDiameter: sideProduct / (D * D * D),
    };
  }

  /** The status line: the two products and the side formula, side by side. */
  function describe(state) {
    const g = compute(state);
    const fmt = (x) => x.toFixed(2);
    return `k0·k1·k2 = ${fmt(g.kProduct)}   l0·l1·l2 = ${fmt(g.lProduct)}   ` +
      `six sides ÷ D³ = ${fmt(g.sideOverDiameter)} — the three numbers match.`;
  }

  /** An illustration has no win, loss or end. */
  function result(state) {
    return null;
  }

  return {
    N: N, WIDTH: WIDTH, HEIGHT: HEIGHT, CENTER: CENTER, RADIUS: RADIUS,
    OPTIONS: OPTIONS, TAU: TAU,
    start: start, movePoint: movePoint, toggle: toggle, reset: reset,
    compute: compute, describe: describe, result: result,
    dist: dist, foot: foot, mid: mid,
  };
})();
