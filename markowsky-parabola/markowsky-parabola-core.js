"use strict";

/*
 * Greg Markowsky's Problem for Parabola, from Alexander Bogomolny's applet
 * MarkowskyParabola (cut-the-knot.org/Curriculum/Geometry/MarkowskyParabola.shtml).
 *
 * A and B sit on the right branch of a parabola with vertex O and vertical
 * axis OO'. The line OB meets the vertical line through A at C; D is the
 * point of the axis level with C. The page asks to show that the two angles
 * ADC and BDC are equal. With O at the origin and the parabola y = x^2/(4a),
 * C = (p, pq/(4a)) and D = (0, pq/(4a)), so DA and DB have slopes
 * (p-q)/(4a) and (q-p)/(4a): mirror images across the horizontal ray DC.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MarkowskyParabolaCore, so the page loads it
 * with a plain <script> and porting/check-markowsky-parabola.mjs loads it in
 * Node. The position is plain data and can be handed to the tutor as it is.
 *
 * The drawing follows the applet's own methods (MarkowskyParabolaCanvas.java):
 * a = 40, Dh = 20, Dt = 2, Parabola(t) = ((t*t)/4)/a with integer division,
 * Compute(H,t) = H - a - Parabola(t) - Dh, and the two scrollbars TtA, TtB
 * run from -250 to 260 starting at 80 and 180. The construction is skipped
 * when |TtA-TtB| < 0.1, |TtB| < 0.1 or |TtA| < 0.1, as in ComputeWhatNot.
 */

const MarkowskyParabolaCore = (() => {
  /* The applet as embedded on its page is 560 by 500. */
  const VIEW = Object.freeze({ width: 560, height: 500 });
  const A = 40;        // canvas field a
  const DH = 20;       // canvas field Dh
  const DT = 2;        // step used by DrawParabola
  const HALF = VIEW.width / 2;
  const MIN_T = -250;
  const MAX_T = 260;
  const START_T = Object.freeze({ A: 80, B: 180 });
  const OPTION_NAMES = Object.freeze(["names", "statement", "hint"]);

  const pt = (x, y) => ({ x, y });
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  // A scrollbar's value arrives from the page as a string; the check script
  // passes numbers. Both must land on the same integer offset.
  const offset = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };

  /** Java's ((t*t)/4)/a with 32-bit int division (truncation towards zero). */
  function parabola(t) {
    return Math.trunc(Math.trunc((t * t) / 4) / A);
  }

  /** Compute(height, t) in the applet: a screen y, increasing downwards. */
  function computeY(t) {
    return VIEW.height - A - parabola(t) - DH;
  }

  /** The starting picture, with the applet's two scrollbars and checkboxes. */
  function start(options) {
    const o = options || {};
    return {
      tA: clamp(offset(o.tA, START_T.A), MIN_T, MAX_T),
      tB: clamp(offset(o.tB, START_T.B), MIN_T, MAX_T),
      options: {
        names: Boolean(o.names === undefined ? false : o.names),
        statement: Boolean(o.statement === undefined ? false : o.statement),
        hint: Boolean(o.hint === undefined ? false : o.hint),
      },
      touches: 0,
    };
  }

  /** The applet's Assign(which, value) for a scrollbar; "A" is 1, "B" is 2. */
  function setOffset(state, which, value) {
    const key = which === "A" || which === 1 ? "tA" : which === "B" || which === 2 ? "tB" : null;
    if (!key) return state;
    const t = clamp(offset(value, state[key]), MIN_T, MAX_T);
    if (t === state[key]) return state;
    const next = { tA: state.tA, tB: state.tB, options: { ...state.options }, touches: state.touches + 1 };
    next[key] = t;
    return next;
  }

  /** A dragged or arrow-nudged dot is projected back onto the curve. */
  function moveVertex(state, which, p) {
    if (!p || !Number.isFinite(p.x)) return state;
    return setOffset(state, which, Math.round(p.x - HALF));
  }

  /** The applet's "names", "statement" and "extra" checkboxes. */
  function setOption(state, name, on) {
    if (!OPTION_NAMES.includes(name)) return state;
    if (state.options[name] === Boolean(on)) return state;
    const next = { tA: state.tA, tB: state.tB, options: { ...state.options }, touches: state.touches };
    next.options[name] = Boolean(on);
    return next;
  }

  /** GeoSDoub.Intersect(p,q,r,s), using the same line coefficients. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return null; // the applet returns (NaN, NaN)
    return pt((b1 * c2 - b2 * c1) / den, (c1 * a2 - a1 * c2) / den);
  }

  /** GeoSDoub.NearestPoint(p, line(a,b)). */
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.1) return pt(p.x, p.y);
    const k = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return pt(a.x + k * dx, a.y + k * dy);
  }

  /** Tangent point fifty units along the curve, as in ComputeTangent1/2. */
  function tangentEnd(t, pointY) {
    return pt(HALF + t + 50, pointY - (50 * (t / A)) / 2);
  }

  /**
   * The whole construction in drawing coordinates. `active` is false exactly
   * when the applet's ComputeWhatNot returns before building anything.
   */
  function geometry(state) {
    const tA = state.tA, tB = state.tB;
    const O = pt(HALF, computeY(0));
    const Op = pt(HALF, DH);
    const Apt = pt(HALF + tA, computeY(tA));
    const Bpt = pt(HALF + tB, computeY(tB));
    const Aprime = pt(Apt.x, DH);
    const Bprime = pt(Bpt.x, DH);
    const base = {
      view: VIEW, O, Op, A: Apt, B: Bpt, Aprime, Bprime,
      directrixY: VIEW.height - DH,
      active: false, C: null, D: null, K: null, M: null,
      tangentA: null, tangentB: null,
    };
    if (Math.abs(tA - tB) < 0.1 || Math.abs(tB) < 0.1 || Math.abs(tA) < 0.1) return base;

    const AT = tangentEnd(tA, Apt.y);
    const BT = tangentEnd(tB, Bpt.y);
    const C = intersect(O, Bpt, Apt, Aprime);   // field CB: page's C
    if (!C) return base;
    const D = nearest(C, O, Op);                // field D, on the axis
    const K = intersect(O, Apt, Bpt, Bprime);   // field CA, labelled K in the hint
    const M = intersect(Apt, AT, Bpt, BT);      // tangent intersection
    return {
      ...base, active: true, C, D, K, M,
      tangentA: { p: Apt, q: AT }, tangentB: { p: Bpt, q: BT },
    };
  }

  /** Angle at v between the rays v->p and v->q, in degrees. */
  function angle(v, p, q) {
    if (!v || !p || !q) return NaN;
    const ax = p.x - v.x, ay = p.y - v.y, bx = q.x - v.x, by = q.y - v.y;
    const na = Math.hypot(ax, ay), nb = Math.hypot(bx, by);
    if (!na || !nb) return NaN;
    const c = clamp((ax * bx + ay * by) / (na * nb), -1, 1);
    return (Math.acos(c) * 180) / Math.PI;
  }

  /** The two angles the applet's ShowStatement draws, in degrees. */
  function readings(state) {
    const g = geometry(state);
    if (!g.active) return { adc: NaN, bdc: NaN, gap: NaN };
    const adc = angle(g.D, g.A, g.C);
    const bdc = angle(g.D, g.B, g.C);
    return { adc, bdc, gap: Math.abs(adc - bdc) };
  }

  /**
   * The same picture for a mathematically exact parabola (no pixel rounding).
   * This is the claim on the page; the core above is the applet's own drawing.
   */
  function ideal(tA, tB) {
    const f = (t) => (t * t) / (4 * A);
    const O = pt(0, 0);
    const Ap = pt(tA, f(tA)), Bp = pt(tB, f(tB));
    const C = pt(tA, (tA * tB) / (4 * A));
    const D = pt(0, C.y);
    const K = pt(tB, C.y);
    const M = pt((tA + tB) / 2, C.y);
    return { O, A: Ap, B: Bp, C, D, K, M,
      slopeDA: (f(tA) - C.y) / tA,
      slopeDB: (f(tB) - C.y) / tB };
  }

  /** Point on the exact curve above an x offset, for the SVG handles. */
  function curvePoint(t) {
    return pt(HALF + t, computeY(t));
  }

  /** The polyline DrawParabola draws: t = -272..272 in steps of Dt. */
  function parabolaPoints() {
    const top = Math.min(HALF, Math.round(Math.sqrt(4 * A * (VIEW.height - A))) + 1);
    const points = [];
    for (let t = -top; t <= top; t += DT) points.push(pt(HALF + t, computeY(t)));
    return points;
  }

  /** The status line. An illustration has no win, loss or end of play. */
  function status(state) {
    const g = geometry(state);
    if (!g.active) return "Put A and B at different distances from the axis to build the picture.";
    if (!(state.tA > 0 && state.tB > state.tA)) {
      return "For the claim, put both dots to the right of the axis, with A nearer O than B.";
    }
    const r = readings(state);
    return `Angles ADC and BDC: ${r.adc.toFixed(1)}° and ${r.bdc.toFixed(1)}°. The true curve makes them equal; whole pixels round them a little.`;
  }

  return {
    VIEW, MIN_T, MAX_T, START_T, A, DH, DT, HALF,
    parabola, computeY, start, setOffset, moveVertex, setOption,
    geometry, angle, readings, ideal, curvePoint, parabolaPoints, status,
  };
})();
