"use strict";

/*
 * Complex Numbers — the logic behind Alexander Bogomolny's applet
 * "ComplexNumbers" (cut-the-knot.org/Curriculum/Algebra/ComplexNumbers.shtml).
 *
 * The plane holds two draggable numbers, A = x1 + y1 i and B = x2 + y2 i. The
 * applet starts with A at modulus 2, argument 60 degrees (1.0471975511965976
 * rad) and B at modulus 3, argument 112.5 degrees (1.9634954084936207 rad), on
 * a 400 by 300 board with 20 pixels to the unit, so the plane runs from -10 to
 * 10 across and -7.5 to 7.5 up. What is drawn alongside them is the "Show"
 * choice: nothing, the conjugates, the sum A + B, the common product A*B, the
 * real product or the complex product. A second choice limits the dragging:
 * free hand, "fix angle" (each number can only slide along the line through the
 * origin and where it was when the choice was made) or "fix absolute value"
 * (each number can only turn on the circle round the origin it was on).
 *
 * The products come straight from the applet's own formulas (its y axis points
 * up here):
 *   common  (x1 x2 - y1 y2, x1 y2 + x2 y1)
 *   real    (x1 x2 + y1 y2, 0)              always on the real axis
 *   complex (0, x1 y2 - x2 y1)              always on the imaginary axis
 * The page's own formula for the complex product, (z1 Conj(z2) - Conj(z1) z2)/2,
 * equals (0, y1 x2 - x1 y2): the opposite sign to what the applet draws. Both
 * lie on the imaginary axis and are zero exactly when A, B and the origin are
 * on a line, so the port follows the applet and the maths section says so.
 *
 * No document, no window, no storage. The position is plain data and every
 * function returns a new one.
 */
const ComplexNumbersCore = (() => {
  const SCALE = 20; // pixels per unit in the applet
  const WIDTH = 400;
  const HEIGHT = 300;
  const HALF_W = WIDTH / 2 / SCALE; // 10
  const HALF_H = HEIGHT / 2 / SCALE; // 7.5
  const MODES = ["none", "conjugate", "sum", "common", "real", "complex"]; // Which = 0..5
  const CONSTRAINTS = ["free", "angle", "radius"];
  const ANGLE_A = 1.0471975511965976;
  const ANGLE_B = 1.9634954084936207;

  const polar = (r, t) => ({ x: r * Math.cos(t), y: r * Math.sin(t) });
  const modulus = (z) => Math.hypot(z.x, z.y);
  const argument = (z) => Math.atan2(z.y, z.x);

  /* ------------------------------------------------ the applet's operations */
  const conjugate = (z) => ({ x: z.x, y: -z.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const commonProduct = (a, b) => ({ x: a.x * b.x - a.y * b.y, y: a.x * b.y + b.x * a.y });
  const realProduct = (a, b) => ({ x: a.x * b.x + a.y * b.y, y: 0 });
  const complexProduct = (a, b) => ({ x: 0, y: a.x * b.y - b.x * a.y });
  /** Times(t): the applet scales a point from the origin (used to draw its lines). */
  const times = (z, t) => ({ x: z.x * t, y: z.y * t });

  /* ----------------------------------------------------------- the position */
  function locks(state, constraint) {
    if (constraint === "angle") return { a: argument(state.a), b: argument(state.b) };
    if (constraint === "radius") return { a: modulus(state.a), b: modulus(state.b) };
    return { a: null, b: null };
  }

  /** A new position: A and B as the applet opens, free hand, nothing shown. */
  function start(options) {
    const o = options || {};
    const state = { a: polar(2, ANGLE_A), b: polar(3, ANGLE_B), mode: "none", constraint: "free", lock: { a: null, b: null }, moves: 0, explored: false };
    if (o.a) state.a = { x: Number(o.a.x), y: Number(o.a.y) };
    if (o.b) state.b = { x: Number(o.b.x), y: Number(o.b.y) };
    if (MODES.includes(o.mode)) state.mode = o.mode;
    state.a = clampBox(state.a);
    state.b = clampBox(state.b);
    if (CONSTRAINTS.includes(o.constraint)) {
      state.constraint = o.constraint;
      state.lock = locks(state, o.constraint);
    }
    return state;
  }

  function clampBox(z) {
    return { x: Math.max(-HALF_W, Math.min(HALF_W, z.x)), y: Math.max(-HALF_H, Math.min(HALF_H, z.y)) };
  }

  const inBox = (z) => Math.abs(z.x) <= HALF_W + 1e-9 && Math.abs(z.y) <= HALF_H + 1e-9;

  /** Where a dragged number goes when the mouse is at (x, y): the constraint decides. */
  function restrict(state, which, target) {
    if (state.constraint === "free") return clampBox(target);
    if (state.constraint === "angle") {
      // The applet's RestrictToLine: the point of the line through O nearest the mouse.
      const t = state.lock[which];
      const ux = Math.cos(t), uy = Math.sin(t);
      let s = target.x * ux + target.y * uy;
      const lim = Math.min(ux ? HALF_W / Math.abs(ux) : Infinity, uy ? HALF_H / Math.abs(uy) : Infinity);
      s = Math.max(-lim, Math.min(lim, s));
      return { x: s * ux, y: s * uy };
    }
    // The applet's RestrictToCircle: the point of the circle nearest the mouse.
    const r = state.lock[which];
    const d = Math.hypot(target.x, target.y);
    if (d === 0) return state[which];
    const z = { x: (r * target.x) / d, y: (r * target.y) / d };
    return inBox(z) ? z : state[which];
  }

  /** The moves: drag a number, change what is shown, change what is fixed. */
  function legalMoves() {
    return [
      { type: "move", which: "a", x: 0, y: 0 }, { type: "move", which: "b", x: 0, y: 0 },
      ...MODES.map((mode) => ({ type: "mode", mode })),
      ...CONSTRAINTS.map((constraint) => ({ type: "constraint", constraint })),
    ];
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "move") {
      if ((m.which !== "a" && m.which !== "b") || !Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return null;
      const z = restrict(state, m.which, { x: Number(m.x), y: Number(m.y) });
      next = { ...state, [m.which]: z };
    } else if (m.type === "mode") {
      if (!MODES.includes(m.mode)) return null;
      next = { ...state, mode: m.mode };
    } else if (m.type === "constraint") {
      if (!CONSTRAINTS.includes(m.constraint)) return null;
      next = { ...state, constraint: m.constraint, lock: locks(state, m.constraint) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** The shown result for the current mode: points to draw as the applet does. */
  function shown(state) {
    const { a, b } = state;
    switch (state.mode) {
      case "conjugate": return { name: "conjugates", points: [conjugate(a), conjugate(b)] };
      case "sum": return { name: "A + B", points: [add(a, b)] };
      case "common": return { name: "A × B", points: [commonProduct(a, b)] };
      case "real": return { name: "real product", points: [realProduct(a, b)] };
      case "complex": return { name: "complex product", points: [complexProduct(a, b)] };
      default: return { name: "", points: [] };
    }
  }

  /** A demo: nothing to win; "done" once the player has changed something. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function fmt(z) {
    const f = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
    return f(z.x) + (z.y < -0.005 ? " − " : " + ") + f(Math.abs(z.y)) + "i";
  }

  return {
    SCALE, WIDTH, HEIGHT, HALF_W, HALF_H, MODES, CONSTRAINTS,
    start, legalMoves, move, result, shown, restrict,
    conjugate, add, commonProduct, realProduct, complexProduct, times, modulus, argument, polar, fmt,
  };
})();
