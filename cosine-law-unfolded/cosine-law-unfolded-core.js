"use strict";

/*
 * The unfolded proof of the law of cosines, as in Alexander Bogomolny's
 * applet CosineLawUnfolded. The three vertices A, B, C of a triangle can be
 * moved; squares are erected outwards on all three sides.
 *
 * The key point of the picture is that P = C + s·J(B−A), where J is a quarter
 * turn and s is the triangle's orientation. So CP is a quarter-turn copy of
 * AB: it has the same length and is perpendicular to it. CTPR is a
 * parallelogram, hence its diagonals CP and TR bisect each other; that makes
 * CP the median of triangle CTR. Since CT = AC and CR = BC, triangle CTR is
 * "friendly" to ABC: its median from C is the altitude of ABC, and the two
 * triangles have the same area. Unfolding the squares into two parallelograms
 * of area AC·BC·|cos C| gives
 *
 *     AB² = AC² + BC² − 2·AC·BC·cos(C).
 *
 * All the point formulae below follow the applet's own bytecode:
 * GeoSDoub.Rotate / FindOrientation / ComputeAngle and the canvas's
 * FormSquares, Translate and Compute methods. Screen y grows downwards, as in
 * the Java canvas. This file is pure data and geometry: no document, no
 * window, no storage. It defines exactly one global.
 */
const CosineLawUnfoldedCore = (() => {
  const APPLET = { width: 500, height: 450 };
  // The SVG viewBox keeps the Java canvas's width and leaves room for the
  // square on AB when the triangle starts as the applet's init() sets it.
  const BOARD = { width: 500, height: 520, margin: 16 };
  const HALF_PI = Math.PI / 2;
  const EPS = 1e-9;

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mid = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.Rotate(base, tip, angle, dir), from its bytecode. */
  function rotate(base, tip, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = base.x + c * (tip.x - base.x) - dir * s * (tip.y - base.y);
    const y = base.y + dir * s * (tip.x - base.x) + c * (tip.y - base.y);
    return pt(x, y);
  }

  /** GeoSDoub.FindOrientation(p0, p1, p2), from its bytecode. */
  function findOrientation(p0, p1, p2) {
    const d = p2.x * (p0.y - p1.y) + p2.y * (p1.x - p0.x) +
      p0.x * p1.y - p1.x * p0.y;
    return d > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeAngle(p0, p1, p2), at p1, from its bytecode. */
  function computeAngle(p0, p1, p2) {
    const d01 = dist(p0, p1) * dist(p0, p1);
    const d02 = dist(p0, p2) * dist(p0, p2);
    const d12 = dist(p1, p2) * dist(p1, p2);
    return Math.acos((d01 + d02 - d12) / 2 / dist(p0, p1) / dist(p0, p2));
  }

  /** The canvas's Translate(a, b, c): the vector b->c applied to a. */
  const translate = (a, b, c) => pt(a.x + c.x - b.x, a.y + c.y - b.y);

  /** The triangles' vertices as the applet's init() places them. */
  function start() {
    const cx = APPLET.width / 2;
    const cy = (APPLET.height * 3) / 7;
    return {
      C: pt(cx, cy),
      A: pt(cx - 50, cy + 40),
      B: pt(cx + 90, cy + 20),
    };
  }

  /** Move one vertex, keeping it on the board. */
  function withPoint(state, name, p) {
    const lo = BOARD.margin;
    const q = pt(
      clamp(p.x, lo, BOARD.width - lo),
      clamp(p.y, lo, BOARD.height - lo),
    );
    const next = { ...state };
    next[name] = q;
    return next;
  }

  /** The applet's FormSquares(): six outer corners of the three squares. */
  function formSquares(A, B, C) {
    const orientation = findOrientation(C, B, A);
    const S = rotate(A, C, HALF_PI, -orientation);
    const T = rotate(S, A, HALF_PI, -orientation);
    const Q = rotate(B, C, HALF_PI, orientation);
    const R = rotate(Q, B, HALF_PI, orientation);
    const E = rotate(A, B, HALF_PI, orientation);
    const D = rotate(B, A, HALF_PI, -orientation);
    return { orientation, S, T, Q, R, E, D };
  }

  /** The applet's Compute(), including both unfoldings and SwitchParas. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    const squares = formSquares(A, B, C);
    const { S, T, Q, R, E, D } = squares;

    const P = translate(T, C, R);
    const F = translate(A, P, T);
    const G = translate(B, P, R);
    const H = translate(E, C, B);
    const J = translate(H, C, P);

    // The byte code compares ComputeAngle(C, A, B) with pi/2 by dcmpg:
    // a NaN also takes the "not less than" branch.
    const SwitchParas = computeAngle(C, A, B) < HALF_PI;
    let M, N, K, L;
    if (SwitchParas) {
      M = translate(F, E, H);
      L = M;
      N = translate(G, D, H);
      K = N;
    } else {
      M = translate(A, C, P);
      N = translate(B, C, P);
      K = translate(H, T, P);
      L = translate(H, R, P);
    }
    const O = pt((A.x + B.x) / 2, (A.y + B.y) / 2);
    const center = pt((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3);
    return {
      A, B, C, S, T, Q, R, E, D, P, F, G, H, J, M, N, K, L, O, center,
      orientation: squares.orientation, SwitchParas,
    };
  }

  /** Unsigned area of a polygon given in order (shoelace). */
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }

  /** The orange quadrilaterals the applet unfolds, as point lists. */
  function foldedParallelograms(q) {
    return q.SwitchParas
      ? [[q.M, q.H, q.E, q.F], [q.N, q.H, q.D, q.G]]
      : [[q.M, q.S, q.T, q.P], [q.N, q.Q, q.R, q.P]];
  }

  /** Everything a reader might want to check about one configuration. */
  function measure(state) {
    const q = compute(state);
    const ab = dist(q.A, q.B), ac = dist(q.A, q.C), bc = dist(q.B, q.C);
    const cosC = (ac * ac + bc * bc - ab * ab) / (2 * ac * bc);
    const angleC = Math.acos(clamp(cosC, -1, 1));
    const angleA = Math.acos(clamp((ab * ab + ac * ac - bc * bc) / (2 * ab * ac), -1, 1));
    const quads = foldedParallelograms(q);
    const tOverR = mid(q.T, q.R);
    return {
      points: q, ab, ac, bc, cosC, angleC, angleA,
      cp: dist(q.C, q.P),
      cpDot: dot(sub(q.B, q.A), sub(q.P, q.C)),
      ct: dist(q.C, q.T), cr: dist(q.C, q.R),
      areaABC: polygonArea([q.A, q.B, q.C]),
      areaCTR: polygonArea([q.C, q.T, q.R]),
      parallelogram: sub(add(q.T, q.R), add(q.C, q.P)),
      median: dist(q.C, tOverR),
      medianDot: dot(sub(q.B, q.A), sub(tOverR, q.C)),
      quadrilaterals: quads,
      quadAreas: quads.map(polygonArea),
      expectedQuadArea: Math.abs(ac * bc * cosC),
      lawResidual: ab * ab - (ac * ac + bc * bc - 2 * ac * bc * cosC),
      symmetry: [
        sub(add(q.A, q.B), add(q.C, q.J)),
        sub(add(q.A, q.B), add(q.S, q.G)),
        sub(add(q.A, q.B), add(q.Q, q.F)),
      ],
      branchSymmetry: q.SwitchParas
        ? [sub(add(q.A, q.B), add(q.R, q.M)), sub(add(q.A, q.B), add(q.T, q.N))]
        : [sub(add(q.A, q.B), add(q.D, q.M)), sub(add(q.A, q.B), add(q.E, q.N))],
    };
  }

  /** The line under the board: no win or loss, only what is measured. */
  function status(state) {
    const m = measure(state);
    if (!Number.isFinite(m.angleC) || !Number.isFinite(m.angleA)) {
      return "Move C off the line AB to see the construction.";
    }
    const deg = (r) => (r * 180 / Math.PI).toFixed(1);
    return `AB ${m.ab.toFixed(1)} · CP ${m.cp.toFixed(1)} · angle A ${deg(m.angleA)}° · angle C ${deg(m.angleC)}°`;
  }

  return {
    APPLET, BOARD, pt, add, sub, dot, cross, dist, clamp, mid,
    rotate, findOrientation, computeAngle, translate,
    start, withPoint, formSquares, compute, polygonArea,
    foldedParallelograms, measure, status,
  };
})();
