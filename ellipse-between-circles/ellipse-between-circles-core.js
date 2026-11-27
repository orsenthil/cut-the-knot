"use strict";

/*
 * Ellipse Between Circles — the geometry of Alexander Bogomolny's applet
 * EllipseBetweenCircles. A large circle has a horizontal diameter AB; a smaller
 * circle has the horizontal diameter DC, with D initially at A and C two thirds
 * of the way to B. A slider picks an x-coordinate between A and B. The applet
 * puts a third circle at the point of the ellipse with foci at the two circle
 * centres whose long axis is the sum of their radii, then gives it the radius
 * that makes it touch the small circle from outside; because the point is on
 * that ellipse, it also touches the large circle from inside.
 *
 * This is a line-for-line transcription of EllipseBetweenCirclesCanvas.init,
 * Compute, Circle, CircleFromDiameter, SetPoint (Fix(2) = keep y fixed) and the
 * scrollbar (0..101, T = value/100, initial 20). The unused r1*r2 local and the
 * sign taken from T rather than from the circle's height are kept as the applet
 * has them. There is nothing to win: the state records the slider and the two
 * draggable end points, so it can be handed to Track and the tutor as it is.
 * No document, no window, no storage: just the global EllipseBetweenCirclesCore.
 */
const EllipseBetweenCirclesCore = (() => {
  // The applet's optimal 400 x 250 canvas: A = (10, h-20), B = (w-10, h-20).
  const W = 400, H = 250;
  const A = { x: 10, y: H - 20 };
  const B = { x: W - 10, y: H - 20 };
  const FRACTION = 1 / 3;                 // C.x = A.x*FRACTION + B.x*(1-FRACTION)
  const SLIDER_MIN = 0, SLIDER_MAX = 101; // new Scrollbar(0, 20, 5, 0, 101)
  const SLIDER_DEFAULT = 20;
  const STAY = A.y;                       // Fix(2): D and C keep their y

  /** Java's Math.round: NaN becomes 0, half values round towards +infinity. */
  function javaRound(v) {
    return Number.isNaN(v) ? 0 : Math.floor(v + 0.5);
  }

  // GeoSDoub.Dist is Math.sqrt(SqDist), not Math.hypot; keep the same rounding.
  function dist(p, q) {
    const dx = p.x - q.x, dy = p.y - q.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampInt(value, lo, hi, fallback) {
    if (value === null || value === undefined || typeof value === "boolean" ||
        (typeof value === "string" && !value.trim())) return fallback;
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
  }

  /** DoubCircle(centre = midpoint(p,q), radius = half the diameter). */
  function circleFromDiameter(p, q) {
    const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    return { x: m.x, y: m.y, r: dist(m, p) };
  }

  /** The applet's private Circle(x, big, small, T), with A, B, D as fields. */
  function circle(x, big, small, t, fields) {
    const r1 = big.r;                            // local 7
    const r2 = small.r;                          // local 9
    const product = r1 * r2;                     // local 11: computed, never read
    const dx = big.x - small.x;                  // local 13
    const mx = (big.x + small.x) / 2;            // local 15
    const sum = r1 + r2;                         // local 17
    const a = sum / 2;                           // local 19, semi-major axis
    const h = Math.sqrt(sum * sum / 4 - dx * dx / 4); // local 21, semi-minor axis
    const rect = {                               // field Ellipse, rounded by Math.round
      x: javaRound(mx - a), y: javaRound(fields.D.y - h),
      w: javaRound(2 * a), h: javaRound(2 * h),
    };
    // The bytecode compares local 5 (T) with zero, then adds big.y last.
    const side = t > 0 ? -1 : 1;
    let y = big.y + side * h * Math.sqrt(1 - ((x - mx) * (x - mx)) / (a * a)); // local 23
    let r = dist({ x, y }, small) - r2;          // local 25
    let cx = x;
    let fallback = false;
    if (r < 0 || Number.isNaN(r)) {              // dcmpg/iflt, then Double.isNaN
      fallback = true;
      y = fields.A.y;
      if (x < small.x) {
        cx = (fields.A.x + small.x - r2) / 2;
        r = cx - fields.A.x;
      } else {
        cx = (fields.B.x + small.x + r2) / 2;
        r = fields.B.x - cx;
      }
    }
    return { x: cx, y, r, rect, product, a, h, mx, sum, dx, fallback };
  }

  /** The starting picture, with the applet's slider and both handle positions. */
  function start(options) {
    const o = options || {};
    const slider = clampInt(o.slider === undefined ? SLIDER_DEFAULT : o.slider,
      SLIDER_MIN, SLIDER_MAX, SLIDER_DEFAULT);
    const defaultD = { x: A.x, y: STAY };
    const defaultC = { x: A.x * FRACTION + B.x * (1 - FRACTION), y: STAY };
    return {
      slider,
      d: { x: atX(o.d, defaultD.x), y: STAY },
      c: { x: atX(o.c, defaultC.x), y: STAY },
      moves: 0,
      explored: false,
    };
  }

  function atX(value, fallback) {
    if (value === null || value === undefined || typeof value === "boolean") return fallback;
    const q = typeof value === "object" ? value.x : value;
    const n = Number(q);
    return Number.isFinite(n) ? Math.max(1, Math.min(W - 2, n)) : fallback;
  }

  /** The scrollbar: T = value/100 and Compute uses |T| for the chosen x. */
  function setSlider(state, value) {
    const slider = clampInt(value, SLIDER_MIN, SLIDER_MAX, SLIDER_DEFAULT);
    return slider === state.slider ? state
      : { ...state, slider, moves: state.moves + 1, explored: true };
  }

  /** Mouse drags stay on the horizontal diameter (Fix(2)) and inside the canvas. */
  function clampHandle(q, name) {
    const fallback = name === "d" ? A.x : A.x * FRACTION + B.x * (1 - FRACTION);
    return { x: atX(q && q.x, fallback), y: STAY };
  }

  function setHandle(state, name, point) {
    if (name !== "c" && name !== "d") return state;
    const x = clampHandle(point, name).x;
    if (state[name].x === x) return state;
    return { ...state, [name]: { x, y: STAY }, moves: state.moves + 1, explored: true };
  }

  /** Compute(): make the two circles, then the circle for the slider's x. */
  function compute(state) {
    const t = state.slider / 100;
    const big = circleFromDiameter(A, B);        // field BigCircle
    const small = circleFromDiameter(state.d, state.c); // field LeftCircle
    const x = A.x + Math.abs(t) * (B.x - A.x);   // Compute's first argument
    const result = circle(x, big, small, t, { A, B, D: state.d });
    return { ...result, t, probeX: x, big, small, A, B, D: state.d, C: state.c,
      centre: { x: result.x, y: result.y } };
  }

  /** What the status line says about the current picture. */
  function status(state, g) {
    const round = (v) => Math.round(v);
    return `Slider ${state.slider}: the two given circles have radii ${round(g.big.r)} and ` +
      `${round(g.small.r)}. The new circle is centred at (${round(g.centre.x)}, ${round(g.centre.y)}) ` +
      `with radius ${Math.max(0, round(g.r))}; its centre is on the ellipse whose long axis is ` +
      `${round(g.sum)}, the sum of those two radii.` +
      (g.fallback ? " At this slider setting the applet puts it on the ellipse's horizontal axis." : "");
  }

  /** A picture with no win or loss: the record counts it once it is explored. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    W, H, A, B, FRACTION, SLIDER_MIN, SLIDER_MAX, SLIDER_DEFAULT, STAY,
    javaRound, dist, circleFromDiameter, circle, start, setSlider,
    clampHandle, setHandle, compute, status, result,
  };
})();
