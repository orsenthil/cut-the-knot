"use strict";

/*
 * Inversion2 — Alexander Bogomolny's "Inversion with Negative Power" applet.
 *
 * The circle t has a draggable centre O and a draggable point R.  C is kept on
 * t; C2 = 2O - C is the point opposite it.  The bold circle w is the circle
 * through C, C2 and A.  The applet draws A' = O - |OC|² (A-O) / |OA|², i.e. the
 * image of A under inversion in t with negative power -|OR|²; because C lies
 * on t, |OC| = |OR|.  Every such w also passes through A'.  The signed products
 * satisfy OA · OA' = -OR², and O separates A from A'.
 *
 * This file is only the geometry: no document, no window, no storage.  It
 * defines one global, Inversion2Core, so the page loads it with a plain <script>
 * and porting/check-inversion-2.mjs loads it in Node.  Positions are plain
 * objects in the SVG's viewBox units.
 */
const Inversion2Core = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  // The applet uses min(width, height) / 4 for its unit and places O one unit
  // right of centre, R one unit left of O.  A is two thirds of a unit away.
  const UNIT = Math.min(VIEW.width, VIEW.height) / 4;
  const DA = UNIT * 2 / 3;
  // The applet chooses both angles at random in [-45°, 45°]; we pin them so a
  // picture can be saved, replayed and compared in the logic test.
  const ANGLE_C = -Math.PI / 5;
  const ANGLE_A = -Math.PI / 24;
  const EPS = 1e-9;
  const DEGENERATE = 1e-7;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** The picture the applet draws on opening, in our 400 x 300 viewBox. */
  function start(options) {
    const o = options || {};
    const O = point(CENTER.x + UNIT, CENTER.y);
    const R = point(CENTER.x, CENTER.y);
    const ac = o.angleC === undefined ? ANGLE_C : o.angleC;
    const aa = o.angleA === undefined ? ANGLE_A : o.angleA;
    const da = o.distanceA === undefined ? DA : o.distanceA;
    const C = point(O.x + UNIT * Math.cos(ac), O.y + UNIT * Math.sin(ac));
    const A = point(O.x + da * Math.cos(aa), O.y + da * Math.sin(aa));
    return {
      O: O, R: R, C: C, A: A,
      options: { names: o.names === undefined ? false : !!o.names },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /** Keep C on t: RestrictToCircle(C, circle(O, |OR|)) in the applet. */
  function projectOnCircle(O, R, C) {
    const radius = dist(O, R);
    if (!(radius > EPS)) return point(O.x + radius, O.y);
    const from = dist(O, C);
    if (!(from > EPS)) return point(O.x + radius, O.y);
    const k = radius / from;
    return point(O.x + (C.x - O.x) * k, O.y + (C.y - O.y) * k);
  }

  /** Drag one of the four handles; C is re-restricted to the (possibly moved) t. */
  function move(state, name, raw) {
    if (name !== "O" && name !== "R" && name !== "C" && name !== "A") return state;
    const q = clamp(point(raw.x, raw.y));
    const next = Object.assign({}, state, { [name]: q, explored: true });
    next.C = projectOnCircle(next.O, next.R, name === "C" ? q : state.C);
    return next;
  }

  function setOption(state, name, value) {
    if (name !== "names") return state;
    return Object.assign({}, state, {
      options: { names: !!value },
      explored: true,
    });
  }

  /** GetCircle(C, C2, A): circumcentre, then the applet's averaged radius. */
  function circumcircle(p, q, r) {
    const ux = q.x - p.x, uy = q.y - p.y;
    const vx = r.x - p.x, vy = r.y - p.y;
    const det = ux * vy - uy * vx;
    const scale = Math.max(1, Math.hypot(ux, uy) * Math.hypot(vx, vy));
    if (Math.abs(det) < DEGENERATE * scale) return null;
    const u2 = (ux * ux + uy * uy) / 2;
    const v2 = (vx * vx + vy * vy) / 2;
    const c = point(p.x + (u2 * vy - uy * v2) / det,
                    p.y + (ux * v2 - u2 * vx) / det);
    // The bytecode averages the three centre-to-point distances instead of
    // taking just one.  At an exact circumcentre they are equal; this keeps
    // the same rounding behaviour as the applet.
    return { c: c, r: (dist(c, p) + dist(c, q) + dist(c, r)) / 3 };
  }

  /**
   * Everything the drawing needs.  The factor is transcribed in the applet's
   * own order: d4 = |OC|, d6 = |OA|, k = (-d4 * d4) / d6 / d6; note it uses
   * |OC|, which equals |OR| while C is restricted to t.
   */
  function geometry(state) {
    const O = state.O, R = state.R, C = state.C, A = state.A;
    const t = { c: O, r: dist(O, R) };
    const C2 = point(2 * O.x - C.x, 2 * O.y - C.y);
    const w = circumcircle(C, C2, A);
    const d4 = dist(O, C);
    const d6 = dist(O, A);
    let k = null;
    let Aprime = null;
    if (d6 > EPS) {
      k = (-d4 * d4) / d6 / d6;
      Aprime = point(O.x + (A.x - O.x) * k, O.y + (A.y - O.y) * k);
    }
    // Power of O with respect to w: it should be -|OR|².
    const power = w ? dot(sub(w.c, O), sub(w.c, O)) - w.r * w.r : null;
    return { t: t, C2: C2, w: w, Aprime: Aprime, k: k, power: power };
  }

  /** The page's negative-power rule, without using C or the circumcircle. */
  function negativeInverse(O, R, A) {
    const d = dist(O, A);
    if (!(d > EPS)) return null;
    const r = dist(O, R);
    const k = -(r * r) / d / d;
    return point(O.x + (A.x - O.x) * k, O.y + (A.y - O.y) * k);
  }

  /* A picture, not a game: there is no win, no loss and no ending move. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g.w || !g.Aprime) {
      return "Move A away from O and off the line through C and the point opposite it.";
    }
    // Signed OA' is opposite in direction to OA, hence the product is negative.
    const product = dist(state.O, state.A) * dist(state.O, state.A) * g.k;
    return `A' is on the bold circle too: OA × OA' = ${product.toFixed(1)} = -OR² (${(-g.t.r * g.t.r).toFixed(1)}).`;
  }

  return {
    VIEW: VIEW, PAD: PAD, CENTER: CENTER, UNIT: UNIT, EPS: EPS,
    point: point, add: add, sub: sub, mul: mul, dot: dot, dist: dist,
    clamp: clamp, start: start, reset: reset, projectOnCircle: projectOnCircle,
    move: move, setOption: setOption, circumcircle: circumcircle,
    geometry: geometry, negativeInverse: negativeInverse,
    result: result, describe: describe,
  };
})();
