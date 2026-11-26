"use strict";

/*
 * ApollonianCircle — Alexander Bogomolny's "Apollonian Circles Theorem" applet.
 *
 * For two fixed points A and B and a positive number r, the points P with
 * AP / BP = r form a circle (or, when r = 1, the perpendicular bisector of AB).
 * The applet builds it from the two points that divide AB internally and
 * externally in the ratio r: those are M and N, the ends of a diameter.  It
 * then keeps P on that circle and shows its image under inversion in the
 * circle centred at A through a draggable point R: the image is a circle
 * centred at the image of B, which is what makes the whole family coaxal.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, ApollonianCircleCore, so the page loads it
 * with a plain <script> and porting/check-apollonian-circle.mjs loads it in
 * Node.  Positions are plain objects in the SVG's viewBox units.
 */

const ApollonianCircleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;
  const K_APPLET = 1.536;            // the applet's fixed ratio
  const RATIO_MIN = 0.25;
  const RATIO_MAX = 4;
  const N_MIN = 1;
  const N_MAX = 15;
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  function clampRatio(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return K_APPLET;
    return Math.max(RATIO_MIN, Math.min(RATIO_MAX, n));
  }

  function clampN(v) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return 1;
    return Math.max(N_MIN, Math.min(N_MAX, n));
  }

  /* The applet's own starting configuration on a 400x300 canvas. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2, g = VIEW.width / 4;
    const A = point(cx - g, cy);
    const B = point(cx + g / 8, cy);
    const R = point(A.x - VIEW.width / 5, A.y);
    const P0 = point(
      cx + cy * Math.cos(Math.PI / 3) / 4 - g / 2,
      cy - cy * Math.sin(Math.PI / 3) / 4,
    );
    const ratio = clampRatio(o.ratio === undefined ? K_APPLET : o.ratio);
    const state = {
      A: A, B: B, R: R, P: P0,
      options: {
        ratio: ratio,
        n: clampN(o.n === undefined ? 1 : o.n),
        names: o.names === undefined ? true : !!o.names,
        hint: o.hint === undefined ? true : !!o.hint,
        extra: !!o.extra,
      },
      explored: false,
    };
    return Object.assign({}, state, { P: restrict(state, P0) });
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /* CutI / CutE from the bytecode, with the applet's second argument fixed at
   * 1 (Reset calls both with a literal 1, not with the N from the panel). */
  function cutI(a, b, r, n) {
    const den = r + n;
    return point((n * a.x + r * b.x) / den, (n * a.y + r * b.y) / den);
  }

  function cutE(a, b, r, n) {
    const den = r - n;
    // The applet's sentinel for r = 1: a point a long way out, which draws a
    // huge circle standing in for the perpendicular bisector.  We use the
    // exact line instead, as the verified article describes.
    if (Math.abs(den) < EPS) return point(1e6, a.y);
    return point((r * b.x - n * a.x) / den, (r * b.y - n * a.y) / den);
  }

  function circleFromDiameter(d, e) {
    return { c: midpoint(d, e), r: dist(d, e) / 2 };
  }

  /** The locus: circle for r != 1, perpendicular bisector for r = 1. */
  function compute(a, b, r) {
    const d = dist(a, b);
    if (!(d > EPS) || !(r > 0)) return null;
    const D = cutI(a, b, r, 1);
    const atOne = Math.abs(r - 1) < EPS;
    const E = atOne ? null : cutE(a, b, r, 1);
    const circle = atOne ? null : circleFromDiameter(D, E);
    const M = midpoint(a, b);
    return {
      A: a, B: b, r: r, d: d, M: M, D: D, E: E, circle: circle,
      line: atOne ? { m: M, n: sub(b, a) } : null,
    };
  }

  /* Push P onto the locus: radial projection onto the circle, or orthogonal
   * projection onto the bisector.  The circle case is the applet's Reset. */
  function project(g, p) {
    if (!g) return p;
    if (g.circle) {
      const c = g.circle.c;
      const from = dist(p, c);
      if (!(from > EPS)) return point(c.x + g.circle.r, c.y);
      return point(c.x + (p.x - c.x) * g.circle.r / from,
                   c.y + (p.y - c.y) * g.circle.r / from);
    }
    const n = g.line.n;
    const nn = dist(n, point(0, 0));
    const t = ((p.x - g.line.m.x) * n.x + (p.y - g.line.m.y) * n.y) / (nn * nn);
    return sub(p, mul(n, t));
  }

  function restrict(state, p) {
    return project(compute(state.A, state.B, state.options.ratio), clamp(p));
  }

  function move(state, name, p) {
    const q = clamp(point(p.x, p.y));
    if (name !== "A" && name !== "B" && name !== "R" && name !== "P") return state;
    const next = Object.assign({}, state, { [name]: q, explored: true });
    if (name === "P") {
      next.P = restrict(state, q);
    } else {
      next.P = restrict(next, state.P);
    }
    return next;
  }

  function setOption(state, name, value) {
    if (!(name in state.options)) return state;
    let ratio = state.options.ratio;
    if (name === "ratio") ratio = clampRatio(value);
    const next = Object.assign({}, state, {
      options: Object.assign({}, state.options, {
        ratio: ratio,
        n: name === "n" ? clampN(value) : state.options.n,
        names: name === "names" ? !!value : state.options.names,
        hint: name === "hint" ? !!value : state.options.hint,
        extra: name === "extra" ? !!value : state.options.extra,
      }),
      explored: true,
    });
    if (name === "ratio") next.P = restrict(next, state.P);
    return next;
  }

  /** Inversion in the circle centred at c with radius r: c + r²(p-c)/|p-c|². */
  function invert(circle, p) {
    const d2 = Math.max(dist(p, circle.c), EPS);
    const k = circle.r * circle.r / (d2 * d2);
    return point(circle.c.x + (p.x - circle.c.x) * k,
                 circle.c.y + (p.y - circle.c.y) * k);
  }

  /** Everything the drawing needs, recomputed from the three handles + P. */
  function geometry(state) {
    const g = compute(state.A, state.B, state.options.ratio);
    if (!g) return null;
    const inv = { c: state.A, r: dist(state.A, state.R) };
    const Bp = invert(inv, state.B);
    const Pp = invert(inv, state.P);
    const invD = g.E ? invert(inv, g.D) : null;
    return Object.assign({}, g, {
      inv: inv, Bp: Bp, Pp: Pp,
      imageCircle: invD ? { c: Bp, r: dist(Bp, invD) } : null,
    });
  }

  /** Independent closed forms, used by the logic test to check the diameter
   * construction: centre = A + r²/(r²-1)·(B-A), radius = r·AB/|r²-1|. */
  function locus(a, b, r) {
    if (!(r > 0) || !(dist(a, b) > EPS)) return null;
    if (Math.abs(r - 1) < EPS) {
      const m = midpoint(a, b);
      const n = sub(b, a);
      return { line: { m: m, n: n } };
    }
    const k = r * r / (r * r - 1);
    return { c: add(a, mul(sub(b, a), k)),
             r: Math.abs(r / (r * r - 1)) * dist(a, b) };
  }

  /* A picture, not a game: there is no win and no loss. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag A and B apart to see the circle.";
    const measured = dist(state.P, state.A) / Math.max(dist(state.P, state.B), EPS);
    if (g.line) {
      return `r = 1: the locus is the perpendicular bisector of AB; AP/BP at P = ${measured.toFixed(3)}.`;
    }
    return `AP/BP at P = ${measured.toFixed(3)}; centre (${g.circle.c.x.toFixed(0)}, ${g.circle.c.y.toFixed(0)}), radius ${g.circle.r.toFixed(0)}.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, K_APPLET: K_APPLET, EPS: EPS,
    RATIO_MIN: RATIO_MIN, RATIO_MAX: RATIO_MAX, N_MIN: N_MIN, N_MAX: N_MAX,
    point: point, add: add, sub: sub, mul: mul, dist: dist, midpoint: midpoint,
    clamp: clamp, clampRatio: clampRatio, clampN: clampN,
    start: start, reset: reset, move: move, setOption: setOption,
    cutI: cutI, cutE: cutE, compute: compute, project: project,
    restrict: restrict, invert: invert, geometry: geometry, locus: locus,
    result: result, describe: describe,
  };
})();
