"use strict";

/*
 * Coaxal Circles — Alexander Bogomolny's CoaxalCircles applet.
 *
 * Two points A and B can slide along one horizontal line.  The applet draws
 * two pencils of circles: one with its centres on the line AB (the Apollonian
 * circles, which never meet), and one with its centres on the perpendicular
 * bisector (the circles through A and B).  Every circle of the first pencil
 * meets every circle of the second at right angles: that is the Coaxal
 * Circles Theorem.  The vertical line through the midpoint of AB is the
 * straight-line member of the first pencil and the common radical axis.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CoaxalCirclesCore, so the page loads it
 * with a plain <script> and porting/check-coaxal-circles.mjs loads it in Node.
 * Positions are plain objects in the SVG's viewBox units.
 */

const CoaxalCirclesCore = (() => {
  const VIEW = { x: 0, y: 0, width: 600, height: 440 };
  const PAD = 12;
  const STEP = 10;                 // the applet's hard-coded 10-pixel increment
  const N_DEFAULT = 5;
  const N_MIN = 1;
  const N_MAX = 100;               // PVNumeric.setMinValue(1), setMaxValue(100)
  const EPS = 1e-9;

  const point = (x, y) => ({ x: x, y: y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function clampN(v) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return N_DEFAULT;
    return clamp(n, N_MIN, N_MAX);
  }

  /* The applet places A and B at cx ± width/12, both on y = height/2.  It
   * calls Fix(2) on both points, so dragging changes only their x-coordinates. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2, gap = VIEW.width / 12;
    return {
      A: point(cx - gap, cy),
      B: point(cx + gap, cy),
      options: {
        n: clampN(o.n === undefined ? N_DEFAULT : o.n),
        familyOne: o.familyOne === undefined ? true : !!o.familyOne,
        familyTwo: !!o.familyTwo,
        // The archived page passes no ShowNames parameter, so the applet's
        // "1".equals(getParameter(...)) test leaves the names unchecked.
        names: o.names === undefined ? false : !!o.names,
      },
      explored: false,
    };
  }

  /** The Reset button is a modern convenience; the applet's Reset was empty.
   *  It restores the two points and keeps the choices in the panel. */
  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /** Only A and B move, and only along the line of centres. */
  function clampPoint(p) {
    return point(clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD), (VIEW.y + VIEW.height) / 2);
  }

  function move(state, name, p) {
    if (name !== "A" && name !== "B") return state;
    const q = clampPoint(p);
    const next = Object.assign({}, state, { [name]: q, explored: true });
    return next;
  }

  function setOption(state, name, value) {
    if (!(name in state.options)) return state;
    const next = Object.assign({}, state, {
      options: Object.assign({}, state.options, {
        n: name === "n" ? clampN(value) : state.options.n,
        familyOne: name === "familyOne" ? !!value : state.options.familyOne,
        familyTwo: name === "familyTwo" ? !!value : state.options.familyTwo,
        names: name === "names" ? !!value : state.options.names,
      }),
      explored: true,
    });
    return next;
  }

  /* Compute() in the applet: Xc = round((A.x + B.x) / 2).  The two axes are
   * drawn at y = round(A.y) and x = Xc. */
  function geometry(state) {
    const Xc = Math.round((state.A.x + state.B.x) / 2);
    const s = Math.abs(state.B.x - state.A.x) / 2;
    const y = state.A.y;
    return {
      A: state.A, B: state.B, Xc: Xc, s: s, y: y,
      axis: { p: point(VIEW.x, y), q: point(VIEW.x + VIEW.width, y) },
      bisector: { p: point(Xc, VIEW.y), q: point(Xc, VIEW.y + VIEW.height) },
    };
  }

  /* DrawFamilyOne, transcribed from the bytecode:
   *   s = |B.x - A.x| / 2
   *   for k = 0 .. N-1: t = s + (k+1)*10
   *       circle(Xc + t, A.y, sqrt(t*t - s*s)) and circle(Xc - t, A.y, ...)
   * Every radius is real because t > s.  The centres lie outside segment AB. */
  function familyOne(state) {
    const g = geometry(state), out = [];
    for (let k = 0; k < state.options.n; k++) {
      const t = g.s + (k + 1) * STEP;
      const r = Math.sqrt(t * t - g.s * g.s);
      out.push({ c: point(g.Xc + t, g.y), r: r, k: k, side: 1 });
      out.push({ c: point(g.Xc - t, g.y), r: r, k: k, side: -1 });
    }
    return out;
  }

  /* DrawSecondFamily:
   *   for k = 1 .. N-1: t = k*10
   *       circle(Xc, A.y + t, sqrt(t*t + s*s)) and circle(Xc, A.y - t, ...)
   *   then, outside the loop, circle(Xc, A.y, s) — the circle on AB as diameter.
   * All of them pass through A and B. */
  function familyTwo(state) {
    const g = geometry(state), out = [];
    for (let k = 1; k < state.options.n; k++) {
      const t = k * STEP;
      const r = Math.sqrt(t * t + g.s * g.s);
      out.push({ c: point(g.Xc, g.y + t), r: r, k: k, side: 1 });
      out.push({ c: point(g.Xc, g.y - t), r: r, k: k, side: -1 });
    }
    out.push({ c: point(g.Xc, g.y), r: g.s, k: 0, side: 0, diameter: true });
    return out;
  }

  /** The circle through A and B that is tangent to AB at A (or B) and its
   *  conjugate with the perpendicular axis: the second half of the theorem. */
  function tangentPair(a, t, u) {
    const c1 = point(a.x + t, a.y), c2 = point(a.x, a.y + u);
    return [{ c: c1, r: Math.abs(t) }, { c: c2, r: Math.abs(u) }];
  }

  /* The power of p with respect to a circle; constant on the radical axis. */
  function power(circle, p) {
    return (p.x - circle.c.x) ** 2 + (p.y - circle.c.y) ** 2 - circle.r ** 2;
  }

  function describe(state) {
    const g = geometry(state);
    const f1 = state.options.familyOne ? `${2 * state.options.n} circles along AB` : "the first family is hidden";
    const f2 = state.options.familyTwo ? `${2 * (state.options.n - 1) + 1} circles through A and B` : "the second family is hidden";
    return `A and B are ${(2 * g.s).toFixed(1)} units apart. First family: ${f1}; second family: ${f2}. Drag A or B, or use the arrow keys.`;
  }

  /* A picture, not a game: there is no win and no loss. */
  function result() {
    return null;
  }

  return {
    VIEW: VIEW, PAD: PAD, STEP: STEP, EPS: EPS,
    N_DEFAULT: N_DEFAULT, N_MIN: N_MIN, N_MAX: N_MAX,
    point: point, clamp: clamp, clampN: clampN, clampPoint: clampPoint,
    start: start, reset: reset, move: move, setOption: setOption,
    geometry: geometry, familyOne: familyOne, familyTwo: familyTwo,
    tangentPair: tangentPair, power: power, describe: describe, result: result,
  };
})();
