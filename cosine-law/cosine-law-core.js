"use strict";

/*
 * Cosine Law, from Alexander Bogomolny's applet CosineLaw.
 *
 * Drag the corners of triangle ABC. Two squares are erected outwardly on AC
 * and BC, and three parallelograms CTPR, STPM and QRPN complete a heptagon
 * ABQNPMS that can be cut into the same pieces in two ways. The applet's own
 * observation is that CP is equal and perpendicular to AB: with CTPR a
 * parallelogram, CP is the median of triangle CTR, so it is also the altitude
 * of the friendly triangle ABC. Comparing the two cuttings gives
 * c² = a² + b² - 2ab cos(C), for both acute and obtuse C.
 *
 * Coordinates follow the applet's canvas (y grows downwards). Every derived
 * point is computed by the same rotations and sums as FormSquares(),
 * Compute() and ShiftPoints() in the bytecode; the second, unfolded copy is
 * translated by V = (2*(width/2 - centroid.x), 0), exactly as in the applet.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CosineLawCore. Functions take plain data
 * and return new plain data.
 */
const CosineLawCore = (() => {
  const HALF_PI = Math.PI / 2;
  // The page embeds the applet at 500x450; the port's board is 600x440 so
  // that both overlaid cuttings fit at phone width. The offsets and formulas
  // below are unchanged; callers may pass their own board size.
  const APPLET = { width: 500, height: 450, grab: 5 };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Twice the signed shoelace area of a polygon. */
  function signed2(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += cross(p, q);
    }
    return sum;
  }
  const area = (points) => Math.abs(signed2(points)) / 2;

  /* GeoSDoub.FindOrientation: +1 when the test is > 0, -1 otherwise. */
  function orientation(p, q, r) {
    const d = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return d > 0 ? 1 : -1;
  }

  /*
   * GeoSDoub.Rotate(pivot, point, angle, orientation): the orientation
   * multiplies the sine, which is how the applet keeps the squares outward
   * when the triangle is dragged across itself.
   */
  function rotate(pivot, point, angle, sense) {
    const dx = point.x - pivot.x, dy = point.y - pivot.y;
    const c = Math.cos(angle), s = Math.sin(angle);
    return pt(pivot.x + c * dx - sense * s * dy,
      pivot.y + sense * s * dx + c * dy);
  }

  /* GeoSDoub.ComputeAngle, clamped only against rounding at 0 and PI. */
  function angleAt(p, q, r) {
    const u = sub(q, p), v = sub(r, p);
    const den = 2 * distance(p, q) * distance(p, r);
    if (!den) return NaN;
    const ratio = (distance(p, q) ** 2 + distance(p, r) ** 2 - distance(q, r) ** 2) / den;
    return Math.acos(clamp(ratio, -1, 1));
  }

  /** The position a new illustration starts from, straight from init(). */
  function start(options = {}) {
    const width = options.width ?? APPLET.width;
    const height = options.height ?? APPLET.height;
    const C = pt(width / 3.5, (2 * height) / 3);
    return {
      A: pt(C.x - 50, C.y + 40),
      B: pt(C.x + 60, C.y + 20),
      C,
      width,
      height,
      showColors: false,
      showNames: false,
    };
  }

  /** Move one of the three draggable corners; the other fields stay put. */
  function withPoint(state, name, point) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return {
      ...state,
      [name]: pt(point.x, point.y),
    };
  }

  /** The two "Show" checkboxes from the applet's panel. */
  function withOption(state, name, on) {
    if (name !== "showColors" && name !== "showNames") return state;
    return { ...state, [name]: Boolean(on) };
  }

  /** Centroid of ABC, as in the applet's Center(). */
  function center(state) {
    return pt((state.A.x + state.B.x + state.C.x) / 3,
      (state.A.y + state.B.y + state.C.y) / 3);
  }

  /*
   * FormSquares(), Compute(), ShiftPoints() and the SwitchParas test, in the
   * applet's order. `switchParas` is true exactly when angle C is acute, as
   * the bytecode sets it: 1 if ComputeAngle(C,A,B) < PI/2, else 0.
   */
  function figure(state) {
    const { A, B, C } = state;
    const sense = orientation(C, A, B);

    const S = rotate(A, C, HALF_PI, sense);
    const T = rotate(S, A, HALF_PI, sense);
    const Q = rotate(B, C, -HALF_PI, sense);
    const R = rotate(Q, B, -HALF_PI, sense);

    const P = pt(T.x + R.x - C.x, T.y + R.y - C.y);
    const M = pt(A.x + P.x - C.x, A.y + P.y - C.y);
    const N = pt(B.x + P.x - C.x, B.y + P.y - C.y);

    const mid = center(state);
    // The Java width/2 is integer division, and V.y is never assigned.
    const V = pt(2 * (Math.floor(state.width / 2) - mid.x), 0);
    const shifted = (p) => add(p, V);
    const shiftedPoints = {
      Ap: shifted(A), Bp: shifted(B), Cp: shifted(C),
      Sp: shifted(S), Tp: shifted(T), Qp: shifted(Q), Rp: shifted(R),
      Pp: shifted(P), Mp: shifted(M), Np: shifted(N),
    };

    return {
      sense, S, T, Q, R, P, M, N, V,
      ...shiftedPoints,
      switchParas: angleAt(C, A, B) < HALF_PI,
    };
  }

  /** The lengths, angle and two sides of the identity, for the readout. */
  function measure(state, drawing = figure(state)) {
    const { A, B, C } = state;
    const a = distance(B, C); // opposite A
    const b = distance(A, C); // opposite B
    const c = distance(A, B); // opposite C
    const angle = angleAt(C, A, B);
    const cosC = dot(sub(A, C), sub(B, C)) / (a * b || NaN);
    const heptagon = [A, B, drawing.Q, drawing.N, drawing.P, drawing.M, drawing.S];
    return {
      a, b, c, angle, cosC,
      acute: drawing.switchParas,
      cp: distance(drawing.P, C),
      ab: c,
      perpendicular: dot(sub(drawing.P, C), sub(B, A)),
      heptagonArea: area(heptagon),
      left: c * c,
      right: a * a + b * b - 2 * a * b * cosC,
    };
  }

  return {
    APPLET, pt, add, sub, cross, dot, distance, clamp,
    signed2, area, orientation, rotate, angleAt,
    start, withPoint, withOption, center, figure, measure,
  };
})();
