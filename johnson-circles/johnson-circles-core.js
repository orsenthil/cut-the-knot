"use strict";

/*
 * Johnson Circles — the geometry of Alexander Bogomolny's applet JohnsonCircles.
 * The article is at cut-the-knot.org/Curriculum/Geometry/JohnsonCircles.shtml.
 *
 * Three circles of one radius r all pass through a common point O. In the
 * applet their centres Oa, Ob, Oc are kept on a guide circle of radius r about
 * O, so every circle has radius r. A is the second meeting of the circles
 * centred Ob and Oc, B the second meeting of Oc and Oa, C of Oa and Ob.
 *
 * Taking O as the origin and writing a, b, c for the three centre vectors,
 * each circle is |x - a| = r with |a| = r. The second meeting of the b- and
 * c-circles is b + c, because |(b + c) - b| = |c| = r and likewise for c.
 * Hence
 *     A = b + c,   B = c + a,   C = a + b,
 * the circumcentre of ABC is Q = a + b + c (distance r to all three), and the
 * anticomplementary triangle has vertices A' = 2a, B' = 2b, C' = 2c. Those
 * vector identities are the whole configuration; the page's "homothety -1"
 * is Q - a = A, and the nine-point centre of OaObOc is N = Q/2.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, JohnsonCirclesCore, so the page loads it with a plain <script>
 * and porting/check-johnson-circles.mjs loads it in Node. Points are plain
 * {x, y} objects in SVG user units; no function mutates what it is given.
 */
const JohnsonCirclesCore = (() => {
  /** The SVG user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 420, height: 300 };
  const O = { x: VIEW.width / 2, y: VIEW.height / 2 };
  /** Canvas.init(): radius = min(width, height) / 5. */
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 5;

  /* Canvas.init(): the three starting angles, in the canvas's y-down frame. */
  const ANGLES = {
    Oa: Math.PI / 4,
    Ob: 3 * Math.PI / 4,
    Oc: -2 * Math.PI / 5,
  };

  /* The five checkboxes of JohnsonCirclesPanel, all unchecked on startup. */
  const OPTION_KEYS = ["names", "homothety", "anticomplementary", "altitudes", "hint"];

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const copy = (p) => ({ x: p.x, y: p.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const onGuide = (angle) => ({
    x: O.x + RADIUS * Math.cos(angle),
    y: O.y + RADIUS * Math.sin(angle),
  });

  /** Canvas.init(): the three draggable centres at 45°, 135° and -72°. */
  function opening() {
    return {
      Oa: onGuide(ANGLES.Oa),
      Ob: onGuide(ANGLES.Ob),
      Oc: onGuide(ANGLES.Oc),
    };
  }
  const START = opening();

  /** Canvas.Compute() refuses positions with two centres within two pixels. */
  function separated(state) {
    if (!state || ![state.Oa, state.Ob, state.Oc].every(finite)) return false;
    return dist(state.Oa, state.Ob) >= 2 &&
      dist(state.Ob, state.Oc) >= 2 &&
      dist(state.Oc, state.Oa) >= 2;
  }

  /**
   * The full configuration. `guide` is the circle the applet restricts the
   * centres to; `circleA/B/C` pass through O, `circle` is the fourth circle
   * through A, B, C, and `antiCircle` is twice the guide circle.
   */
  function compute(state) {
    if (!separated(state)) return { valid: false, reason: "centres" };
    const Oa = copy(state.Oa), Ob = copy(state.Ob), Oc = copy(state.Oc);
    const a = sub(Oa, O), b = sub(Ob, O), c = sub(Oc, O);

    const A = add(O, add(b, c));
    const B = add(O, add(c, a));
    const C = add(O, add(a, b));
    const Q = add(O, add(add(a, b), c));
    const N = midpoint(O, Q);

    const Ap = add(O, scale(a, 2));
    const Bp = add(O, scale(b, 2));
    const Cp = add(O, scale(c, 2));

    return {
      valid: true, reason: null,
      O: copy(O), r: RADIUS,
      guide: { c: copy(O), r: RADIUS },
      Oa, Ob, Oc,
      A, B, C, Q, N,
      Ap, Bp, Cp,
      circleA: { c: Oa, r: RADIUS },
      circleB: { c: Ob, r: RADIUS },
      circleC: { c: Oc, r: RADIUS },
      circle: { c: Q, r: RADIUS },
      antiCircle: { c: copy(O), r: 2 * RADIUS },
      centres: [Oa, Ob, Oc],
      triangle: [A, B, C],
      anticomplementary: [Ap, Bp, Cp],
      /* The three rhombi A-Ob-O-Oc, C-Oa-O-Ob and B-Oc-O-Oa. */
      rhombi: [
        [A, Ob, O, Oc], [C, Oa, O, Ob], [B, Oc, O, Oa],
      ],
      altitudes: [[A, O], [B, O], [C, O]],
      centreAltitudes: [[Oa, Q], [Ob, Q], [Oc, Q]],
      spokes: [[Oa, B], [Oa, C], [Ob, C], [Ob, A], [Oc, A], [Oc, B]],
    };
  }
  const geometry = compute;

  /** A fresh diagram, with the applet's five boxes unchecked. */
  function start(options) {
    const o = options || {};
    const base = opening();
    const opts = {};
    for (const k of OPTION_KEYS) opts[k] = Boolean(o.options && o.options[k] === true);
    return {
      Oa: finite(o.Oa) ? projectToGuide(o.Oa) : base.Oa,
      Ob: finite(o.Ob) ? projectToGuide(o.Ob) : base.Ob,
      Oc: finite(o.Oc) ? projectToGuide(o.Oc) : base.Oc,
      options: opts,
      moves: 0,
      explored: false,
    };
  }

  /** "New diagram": the same three angles turned by a random amount. */
  function randomStart(rand = Math.random) {
    const turn = rand() * 2 * Math.PI;
    return start({
      Oa: onGuide(ANGLES.Oa + turn),
      Ob: onGuide(ANGLES.Ob + turn),
      Oc: onGuide(ANGLES.Oc + turn),
    });
  }

  /** CTKMoveableDoub.RestrictToCircle: a dragged centre stays on the guide. */
  function projectToGuide(point) {
    if (!finite(point)) return point;
    const dx = point.x - O.x, dy = point.y - O.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return { x: O.x + RADIUS, y: O.y };
    return { x: O.x + (dx / d) * RADIUS, y: O.y + (dy / d) * RADIUS };
  }

  function moveCenter(state, name, point) {
    if (!["Oa", "Ob", "Oc"].includes(name) || !finite(point)) return state;
    return {
      ...state,
      [name]: projectToGuide(point),
      moves: state.moves + 1,
      explored: true,
    };
  }

  function setOption(state, name, on) {
    if (!OPTION_KEYS.includes(name)) return state;
    return {
      ...state,
      options: { ...state.options, [name]: Boolean(on) },
      explored: true,
    };
  }

  /** The Reset button restores the opening centres but keeps the options. */
  function reset(state) {
    return start({ options: state ? state.options : {} });
  }

  /** An illustration has no win or loss: Track marks exploration as "done". */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** The status line: the radius invariant, or why the picture is not drawn. */
  function describe(g) {
    if (!g || !g.valid) return "Keep the three circle centres apart so the circles meet properly.";
    return `Three circles of radius ${g.r.toFixed(0)} share O. The circle through A, B and C ` +
      `has the same radius, centred at Q; the nine-point centre N sits halfway from O to Q.`;
  }
  const label = describe;

  return {
    VIEW, O, RADIUS, ANGLES, OPTION_KEYS, START,
    start, randomStart, reset, moveCenter, setOption, result,
    compute, geometry, describe, label, projectToGuide, separated,
    finite, copy, add, sub, scale, dot, dist, midpoint, onGuide,
  };
})();
