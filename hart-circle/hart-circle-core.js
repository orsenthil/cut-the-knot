"use strict";

/*
 * Hart Circle — Alexander Bogomolny's applet HartCircle.
 *
 * Three circles cut the plane into eight curved triangles. Pick one as the
 * base; the circle inscribed in it and the three circles inscribed in the
 * associated triangles (which share an arc with the base) all touch one more
 * circle, the Hart circle. The applet builds each inscribed circle as one of
 * the two solutions of the Apollonius problem for the three given circles;
 * the Hart circle is the Apollonius solution for the three red ones that also
 * touches the green one. This file is that computation and nothing else: no
 * document, no window, no storage. It defines one global, HartCircleCore, so
 * the page loads it with a plain <script> and the Node test can load it too.
 *
 * Positions are plain objects in the SVG's viewBox units: three circles given
 * by a centre and a boundary point, plus the dropdown index and two display
 * switches. Functions take a position and return a new one.
 */

const HartCircleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 6;
  const EPS = 1e-9;

  /* HartCirclePanel's eight Choice items, in their applet order. */
  const OPTIONS = ["+++", "++-", "+-+", "-++", "+--", "-+-", "--+", "---"];

  /* HartCircleCanvas's sign tables, copied in declaration order. signs0 is
   * the green base incircle, signs1..3 the red associated incircles, signs
   * the blue Hart circle. */
  const SIGNS0 = [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
    [1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  ];
  const SIGNS = [
    [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1],
    [-1, 1, 1], [1, -1, 1], [-1, -1, 1], [-1, -1, -1],
  ];
  const SIGNS1 = [
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [1, 1, 1],
    [-1, -1, -1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  ];
  const SIGNS2 = [
    [1, -1, 1], [1, -1, -1], [1, 1, 1], [-1, -1, 1],
    [1, 1, -1], [-1, -1, -1], [-1, 1, 1], [-1, 1, -1],
  ];
  const SIGNS3 = [
    [1, 1, -1], [1, 1, 1], [1, -1, -1], [-1, 1, -1],
    [1, -1, 1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1],
  ];

  const point = (x, y) => ({ x, y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  function clampVariant(v) {
    if (typeof v === "string") {
      const i = OPTIONS.indexOf(v);
      return i >= 0 ? i : 0;
    }
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(7, n)) : 0;
  }

  /** Reset(): the applet's placement on a 400x300 canvas. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const gap = Math.min(cx, cy) / 3;
    const make = (angle, factor) => {
      const c = point(cx + gap * Math.sin(angle), cy + gap * Math.cos(angle));
      const b = point(c.x + factor * gap, c.y);
      return { c, b };
    };
    const showAddOns = !!o.showAddOns;
    return {
      circles: [make(0, 1.1), make(2 * Math.PI / 3, 1.5), make(4 * Math.PI / 3, 2)],
      variant: clampVariant(o.variant === undefined ? 0 : o.variant),
      showAddOns: showAddOns,
      // The applet's checkbox is disabled while "Show additional circles" is
      // off, and its canvas flag is the conjunction of the two switches.
      showTangency: !!o.showTangency && showAddOns,
      explored: false,
    };
  }

  function reset(state) {
    const s = start({
      variant: state.variant,
      showAddOns: state.showAddOns,
      showTangency: state.showTangency,
    });
    s.explored = state.explored;
    return s;
  }

  /* MoveableCircle.GetRadius(): the boundary point sets the radius. */
  function givenCircle(pair) {
    return { x: pair.c.x, y: pair.c.y, r: dist(pair.c, pair.b) };
  }

  function move(state, name, p) {
    const m = /^(c|b)([123])$/.exec(String(name));
    if (!m) return state;
    const i = Number(m[2]) - 1;
    const circles = state.circles.map((x) => ({ c: { ...x.c }, b: { ...x.b } }));
    circles[i][m[1] === "c" ? "c" : "b"] = clamp(point(p.x, p.y));
    return { ...state, circles, explored: true };
  }

  /* Mover.UpdateLocation() on a MoveableCircle translates its centre and its
   * boundary point together, keeping the radius. */
  function moveCircle(state, index, delta) {
    if (!(index >= 0 && index < 3)) return state;
    const circles = state.circles.map((x) => ({ c: { ...x.c }, b: { ...x.b } }));
    const item = circles[index];
    const lo = VIEW.x + PAD, hiX = VIEW.x + VIEW.width - PAD, hiY = VIEW.y + VIEW.height - PAD;
    const dx = Math.max(lo - item.c.x, lo - item.b.x,
      Math.min(hiX - item.c.x, hiX - item.b.x, delta.x));
    const dy = Math.max(lo - item.c.y, lo - item.b.y,
      Math.min(hiY - item.c.y, hiY - item.b.y, delta.y));
    item.c = point(item.c.x + dx, item.c.y + dy);
    item.b = point(item.b.x + dx, item.b.y + dy);
    return { ...state, circles, explored: true };
  }

  function setOption(state, name, value) {
    if (name === "variant") {
      return { ...state, variant: clampVariant(value), explored: true };
    }
    if (name === "showAddOns") {
      const on = !!value;
      return { ...state, showAddOns: on, showTangency: on && state.showTangency, explored: true };
    }
    if (name === "showTangency") {
      // The applet disables the checkbox when the red circles are hidden.
      return state.showAddOns
        ? { ...state, showTangency: !!value, explored: true }
        : state;
    }
    return state;
  }

  /* ---------------------------------------------- the applet's Apollonius code */

  /* ApolloniusCircle.CInfo. */
  function cInfo(c) {
    return c.x * c.x + c.y * c.y - c.r * c.r;
  }

  /* ApolloniusCircle.SetCircles: the linear system for the radical centre. */
  function prepare(c1, c2, c3) {
    const p = {
      ci: [c1, c2, c3],
      A1: 2 * (c2.x - c1.x), A2: 2 * (c3.x - c1.x),
      B1: 2 * (c2.y - c1.y), B2: 2 * (c3.y - c1.y),
    };
    p.o = cInfo(c1);
    p.D1 = p.o - cInfo(c2);
    p.D2 = p.o - cInfo(c3);
    p.K = p.A1 * p.B2 - p.A2 * p.B1;
    p.G = (p.B1 * p.D2 - p.B2 * p.D1) / p.K;
    p.I = -(p.A1 * p.D2 - p.A2 * p.D1) / p.K;
    return p;
  }

  /* ApolloniusCircle.Compute(s1,s2,s3): the two oriented tangent circles. */
  function compute(p, s1, s2, s3) {
    if (Math.abs(p.K) < 0.01) return null; // TreatZeroDeterminant returns null
    const L3 = 2 * (s1 * p.ci[0].r - s2 * p.ci[1].r);
    const L5 = 2 * (s1 * p.ci[0].r - s3 * p.ci[2].r);
    const X = (p.B1 * L5 - p.B2 * L3) / p.K;
    const Y = -(p.A1 * L5 - p.A2 * L3) / p.K;
    const Q = X * X + Y * Y - 1;
    if (Math.abs(Q) < 0.001) return null;
    // The trailing dmul multiplies the whole bracket, not just X*G.
    const P = 2 * (X * p.G + Y * p.I - X * p.ci[0].x - Y * p.ci[0].y
      + s1 * p.ci[0].r);
    const R = p.G * p.G + p.I * p.I - 2 * p.G * p.ci[0].x
      - 2 * p.I * p.ci[0].y + p.o;
    let disc = P * P - 4 * Q * R;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    // The bytecode keeps the signed root for the centre (dload 19) but
    // stores its absolute value as DoubCircle.m_R (dload 21).
    let t = (-P + disc) / (2 * Q);
    const first = { x: X * t + p.G, y: Y * t + p.I, r: Math.abs(t) };
    t = (-P - disc) / (2 * Q);
    const second = { x: X * t + p.G, y: Y * t + p.I, r: Math.abs(t) };
    return [first, second];
  }

  /* HartCircleCanvas.Dist, used by WasUsed. */
  function circleDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.r - b.r);
  }

  /* DrawOneCircle: reject the first solution when it repeats an earlier one. */
  function drawOne(p, used, signs) {
    const pair = compute(p, signs[0], signs[1], signs[2]);
    if (!pair) return null;
    // The bytecode computes Signature(s1,s2,s3) here and never uses it.
    const chosen = used.some((u) => circleDistance(pair[0], u) < 1) ? pair[1] : pair[0];
    if (chosen) used.push(chosen);
    return chosen;
  }

  /* ComputePoint(a,b): the centre of similitude, used for tangency dots. */
  function computePoint(a, b) {
    const d = dist(a, b);
    const s = b.r / d;
    const t = ((b.r > d || a.r > d) && a.r > b.r) ? -1 : 1;
    return point(b.x + t * (a.x - b.x) * s, b.y + t * (a.y - b.y) * s);
  }

  /* IsTangent(a,b): ComputePoint lies on a's circumference to within 2px. */
  function isTangent(a, b) {
    if (!a || !b) return false;
    const q = computePoint(a, b);
    return Math.abs(dist(q, a) - a.r) < 2;
  }

  /* The second DrawOneCircle overload: pick the branch tangent to target. */
  function drawOneTangent(p, used, signs, target) {
    const pair = compute(p, signs[0], signs[1], signs[2]);
    if (!pair) return null;
    const chosen = isTangent(pair[0], target) ? pair[0] : pair[1];
    if (chosen) used.push(chosen);
    return chosen;
  }

  /** Everything the drawing needs, in the applet's update() order. */
  function geometry(state) {
    const given = state.circles.map(givenCircle);
    const p = prepare(given[0], given[1], given[2]);
    const usedBase = [];
    const base = drawOne(p, usedBase, SIGNS0[state.variant]);
    let extras = [null, null, null];
    let hart = null;
    if (state.showAddOns) {
      extras = [
        drawOne(prepare(given[0], given[1], given[2]), [], SIGNS1[state.variant]),
        drawOne(prepare(given[0], given[1], given[2]), [], SIGNS2[state.variant]),
        drawOne(prepare(given[0], given[1], given[2]), [], SIGNS3[state.variant]),
      ];
      if (extras.every(Boolean)) {
        const hp = prepare(extras[0], extras[1], extras[2]);
        hart = drawOneTangent(hp, [], SIGNS[state.variant], base);
      }
    }
    const tangency = [];
    const effectiveTangency = state.showTangency && state.showAddOns;
    if (effectiveTangency) {
      // ShowTangency(green/red, Ci1, Ci2, Ci3) and ShowTangency(hart, base,
      // extras): the applet dots every pair, without an IsTangent filter.
      if (base) for (const c of given) tangency.push({ p: computePoint(base, c), kind: "base" });
      for (const extra of extras) {
        if (extra) for (const c of given) tangency.push({ p: computePoint(extra, c), kind: "extra" });
      }
      if (hart && base) tangency.push({ p: computePoint(hart, base), kind: "hart" });
      if (hart) for (const extra of extras) {
        if (extra) tangency.push({ p: computePoint(hart, extra), kind: "hart" });
      }
    }
    return {
      given: given, base: base, extras: extras, hart: hart,
      tangency: tangency, tangencyShown: effectiveTangency,
      degenerate: Math.abs(p.K) < 0.01,
    };
  }

  /** Independent tangency test used by the logic test and the status line. */
  function tangent(a, b, tol) {
    if (!a || !b) return false;
    const tolerance = tol === undefined ? 1 : tol;
    const d = dist(a, b);
    return Math.abs(d - (a.r + b.r)) < tolerance
      || Math.abs(d - Math.abs(a.r - b.r)) < tolerance;
  }

  /* A picture, not a game: nobody wins or loses. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    const name = OPTIONS[state.variant];
    const r = (c) => c.r.toFixed(1);
    if (g.degenerate || !g.base) {
      return `Base ${name}: no incircle here — drag a centre or a boundary point away from a straight line.`;
    }
    if (!state.showAddOns) {
      return `Base ${name}: green incircle radius ${r(g.base)}. Tick “Show additional circles” for the red incircles and the Hart circle.`;
    }
    if (!g.hart) {
      return `Base ${name}: green incircle radius ${r(g.base)}; no Hart circle for this arrangement.`;
    }
    const touching = [g.base, ...g.extras].every((c) => tangent(g.hart, c, 2));
    return `Base ${name}: green incircle r ${r(g.base)}; blue Hart circle r ${r(g.hart)}${touching ? ", touching all four incircles" : " (near-tangent candidate)"}.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, OPTIONS: OPTIONS,
    SIGNS0: SIGNS0, SIGNS: SIGNS, SIGNS1: SIGNS1, SIGNS2: SIGNS2, SIGNS3: SIGNS3,
    point: point, dist: dist, clamp: clamp, clampVariant: clampVariant,
    start: start, reset: reset, move: move, moveCircle: moveCircle, setOption: setOption,
    givenCircle: givenCircle, cInfo: cInfo, prepare: prepare, compute: compute,
    circleDistance: circleDistance, drawOne: drawOne, computePoint: computePoint,
    isTangent: isTangent, drawOneTangent: drawOneTangent,
    geometry: geometry, tangent: tangent, result: result, describe: describe,
  };
})();
