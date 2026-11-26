"use strict";

/*
 * Angles In Circle — Secant Angles in a Circle II, from Alexander Bogomolny's
 * AnglesInCircle applet (the approach was suggested by Stuart Anderson).
 *
 * Two secants meet at A and cut the circle at B, C (the nearer pair) and D, E
 * (the farther pair). The angle between the secants is half the sum of the
 * intercepted arcs BC and DE when A is inside the circle, and half their
 * difference when A is outside (a tangent is just the case where one pair
 * collapses to a single point). Sliding a chord parallel to itself keeps the
 * angle, and therefore that half-sum or half-difference, unchanged. The page
 * proves this by giving the arcs signs; the core measures the arcs directly,
 * taking the major arc when the two excluded points lie on the short way.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, AnglesInCircleCore, so the page loads it with a
 * plain <script> and porting/check-angles-in-circle.mjs loads it in Node. Positions
 * are plain data (numbers, strings, arrays, plain objects).
 */
const AnglesInCircleCore = (() => {
  const TAU = 2 * Math.PI;
  const EPS = 1e-8;
  const CENTER = { x: 180, y: 120 };
  const RADIUS = 84;
  const RO = { x: CENTER.x + RADIUS, y: CENTER.y }; // the applet's reference point Ro
  const MIN_X = 14, MAX_X = 346, MIN_Y = 14, MAX_Y = 226;
  const HANDLE_RING = RADIUS + 8; // handles sit outside the circle, like the applet's border points
  const MIN_HANDLE = 18;          // a handle must stay far enough from A to define a line

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const deg = (r) => (r * 180) / Math.PI;
  const moveToFirst = (a) => {
    while (a < 0) a += TAU;
    while (a >= TAU) a -= TAU;
    return a;
  };
  const polar = (p) => {
    const a = Math.atan2(p.y - CENTER.y, p.x - CENTER.x);
    return a < 0 ? a + TAU : a;
  };
  const unit = (p, q) => {
    const dx = q.x - p.x, dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };

  /* GeoSDoub.ComputeSignedAngle: the signed turn from p to q about o.
     Its size is the minor central angle (>0 when q is clockwise from p on
     the screen), which is exactly what the applet's Arc.Value stores. */
  function signedAngle(o, p, q) {
    const op = dist(o, p), oq = dist(o, q);
    if (!op || !oq) return 0;
    const cos = clamp((sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / (2 * op * oq), -1, 1);
    const cross = (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
    return (cross > 0 ? 1 : -1) * Math.acos(cos);
  }

  /* The arc from p to q in the increasing (SVG y-down) direction that does
     NOT pass through the two excluded points — the arc intercepted by the
     angle at A. It may be a major arc; that is why the signed-angle trick in
     the page is needed when one arc swallows the other. */
  function arcBetween(p, q, x, y) {
    if (dist(p, q) < 1e-5) return 0; // the two endpoints have merged (tangent, or A on the circle)
    const pp = polar(p), qp = polar(q);
    const ccw = (qp - pp + TAU) % TAU;
    if (ccw < EPS) return 0; // a tangent: the two endpoints have merged
    const ex1 = polar(x), ex2 = polar(y);
    const liesInside = (v) => {
      const d = (v - pp + TAU) % TAU;
      return d > EPS && d < ccw - EPS; // an excluded point equal to p or q does not count
    };
    return liesInside(ex1) || liesInside(ex2) ? TAU - ccw : ccw;
  }

  /** The (minor) angle between the rays A->p and A->q, in radians. */
  function angleAt(a, p, q) {
    const u = { x: p.x - a.x, y: p.y - a.y }, v = { x: q.x - a.x, y: q.y - a.y };
    const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
    if (!nu || !nv) return 0;
    return Math.acos(clamp((u.x * v.x + u.y * v.y) / (nu * nv), -1, 1));
  }

  /* GeoSDoub.Intersect(DoubCircle, DoubLine), in the form the applet uses:
     a unit direction from A and the two parameters along it, sorted. */
  function circleLine(a, d) {
    const b = (a.x - CENTER.x) * d.x + (a.y - CENTER.y) * d.y;
    const c = sqDist(a, CENTER) - RADIUS * RADIUS;
    const disc = b * b - c;
    if (disc < -EPS) return null;
    const s = Math.sqrt(Math.max(0, disc));
    const at = (t) => ({ x: a.x + t * d.x, y: a.y + t * d.y });
    return [{ p: at(-b - s), t: -b - s }, { p: at(-b + s), t: -b + s }];
  }

  /* A literal transcription of AnglesInCircleCanvas$Arc together with the
     arc choice in Compute()/Draw(): SetAngle, MoveToFirstCircle, Contains,
     ToComplement. Kept here so the page and the check can share the applet's
     own signed-arc picture; the theorem's arcs are measured separately. */
  function appletArcs(a, bPoint, cPoint) {
    const s1 = circleLine(a, unit(a, cPoint));
    const s2 = circleLine(a, unit(a, bPoint));
    const out = { available: false, B: null, C: null, D: null, E: null, arc1: null, arc2: null };
    if (!s1 || !s2) return out;
    // A exactly on the circle counts as the outside case, as in the applet's
    // strict Inside() test; the 1e-6 margin absorbs floating-point jitter.
    const inside = dist(a, CENTER) < RADIUS - 1e-6;
    const r1 = inside ? cPoint : a;
    const r2 = inside ? bPoint : a;
    const near1 = dist(r1, s1[0].p) <= dist(r1, s1[1].p) ? s1[0].p : s1[1].p;
    const far1 = near1 === s1[0].p ? s1[1].p : s1[0].p;
    const near2 = dist(r2, s2[0].p) <= dist(r2, s2[1].p) ? s2[0].p : s2[1].p;
    const far2 = near2 === s2[0].p ? s2[1].p : s2[0].p;
    const B = near2, C = near1, D = far2, E = far1;

    const setAngle = (start, end) => ({
      start: moveToFirst(signedAngle(CENTER, start, RO)),
      value: signedAngle(CENTER, end, start),
      startPoint: start,
      endPoint: end,
    });
    const contains = (arc, x) => {
      const t = moveToFirst(x);
      if (arc.value > 0) return t >= arc.start && t <= arc.start + arc.value;
      if (arc.value < 0) return t <= arc.start + arc.value && t >= arc.start;
      return false;
    };
    const containsArc = (one, two) => contains(one, two.start) || contains(one, two.start + two.value);
    const complement = (arc) => {
      arc.start += arc.value;
      arc.value = arc.value > 0 ? TAU - arc.value : -TAU - arc.value;
      return arc;
    };
    const arc1 = setAngle(B, C), arc2 = setAngle(D, E);
    if (containsArc(arc1, arc2)) complement(arc1);
    else if (containsArc(arc2, arc1)) complement(arc2);

    return { available: true, B, C, D, E, arc1, arc2 };
  }

  /** Keep a handle on the board and far enough from A to define a line. */
  function clampHandle(p, a) {
    let q = { x: clamp(p.x, MIN_X, MAX_X), y: clamp(p.y, MIN_Y, MAX_Y) };
    const da = dist(q, a);
    if (da < MIN_HANDLE) {
      const k = MIN_HANDLE / (da || 1);
      q = da ? { x: a.x + (q.x - a.x) * k, y: a.y + (q.y - a.y) * k }
             : { x: a.x + MIN_HANDLE, y: a.y };
      q.x = clamp(q.x, MIN_X, MAX_X);
      q.y = clamp(q.y, MIN_Y, MAX_Y);
    }
    return q;
  }

  /** The starting picture: A outside the circle, two secants cutting it. */
  function start(options) {
    const o = options || {};
    const center = { x: CENTER.x, y: CENTER.y };
    const radius = RADIUS;
    const a = o.A ? { x: o.A.x, y: o.A.y } : { x: 288, y: 120 };
    return {
      center: center,
      radius: radius,
      A: { x: clamp(a.x, MIN_X, MAX_X), y: clamp(a.y, MIN_Y, MAX_Y) },
      B: clampHandle(o.B ? { x: o.B.x, y: o.B.y } : { x: 150, y: 46 }, a),
      C: clampHandle(o.C ? { x: o.C.x, y: o.C.y } : { x: 150, y: 194 }, a),
      showNames: o.showNames === undefined ? true : !!o.showNames,
      showArcs: o.showArcs === undefined ? true : !!o.showArcs,
      showAngles: o.showAngles === undefined ? true : !!o.showAngles,
    };
  }

  /* Dragging A slides both secants together: B and C travel with it, so the
     angle between the lines (and hence the theorem's value) is preserved. */
  function moveA(state, p) {
    const a = { x: clamp(p.x, MIN_X, MAX_X), y: clamp(p.y, MIN_Y, MAX_Y) };
    const dx = a.x - state.A.x, dy = a.y - state.A.y;
    return Object.assign({}, state, {
      A: a,
      B: clampHandle({ x: state.B.x + dx, y: state.B.y + dy }, a),
      C: clampHandle({ x: state.C.x + dx, y: state.C.y + dy }, a),
    });
  }

  /** Rotate one secant about A by moving its handle. */
  function moveHandle(state, name, p) {
    if (name !== "B" && name !== "C") return state;
    const q = clampHandle(p, state.A);
    return Object.assign({}, state, { [name]: q });
  }

  /* Translate one chord parallel to itself by `amount` (in board units along
     its normal). Its intersection with the other chord slides along that
     chord, exactly as in the applet's PARALLEL drag. */
  function slide(state, name, amount) {
    if (name !== "B" && name !== "C") return state;
    const d1 = unit(state.A, state.C); // line AC
    const d2 = unit(state.A, state.B); // line AB
    if (Math.abs(d1.x * d2.y - d1.y * d2.x) < 1e-6) return state; // parallel chords
    let a, b, c;
    if (name === "C") {
      const n1 = { x: -d1.y, y: d1.x };
      const t = amount / (d2.x * n1.x + d2.y * n1.y);
      a = { x: state.A.x + t * d2.x, y: state.A.y + t * d2.y };
      c = { x: state.C.x + t * d2.x, y: state.C.y + t * d2.y };
      b = state.B;
    } else {
      const n2 = { x: -d2.y, y: d2.x };
      const t = amount / (d1.x * n2.x + d1.y * n2.y);
      a = { x: state.A.x + t * d1.x, y: state.A.y + t * d1.y };
      b = { x: state.B.x + t * d1.x, y: state.B.y + t * d1.y };
      c = state.C;
    }
    a.x = clamp(a.x, MIN_X, MAX_X);
    a.y = clamp(a.y, MIN_Y, MAX_Y);
    return Object.assign({}, state, {
      A: a, B: clampHandle(b, a), C: clampHandle(c, a),
    });
  }

  function toggle(state, name) {
    if (name !== "showNames" && name !== "showArcs" && name !== "showAngles") return state;
    return Object.assign({}, state, { [name]: !state[name] });
  }

  /** Everything the page draws and the check verifies, from a position. */
  function compute(state) {
    const arc = appletArcs(state.A, state.B, state.C);
    const out = Object.assign({
      valid: false, available: false, inside: false, onCircle: false,
      tangent: false, angle: 0, arcBC: 0, arcDE: 0, formula: 0,
      A: state.A, B: null, C: null, D: null, E: null,
    }, arc, { valid: arc.available, available: arc.available });
    if (!arc.available) return out;

    const dA = dist(state.A, CENTER);
    out.inside = dA < RADIUS - 1e-6;
    out.onCircle = Math.abs(dA - RADIUS) < 1e-6;
    out.tangent = dist(arc.B, arc.D) < 1e-6 || dist(arc.C, arc.E) < 1e-6;
    out.arcBC = arcBetween(arc.B, arc.C, arc.D, arc.E);
    out.arcDE = arcBetween(arc.D, arc.E, arc.B, arc.C);
    out.angle = out.onCircle
      ? angleAt(state.A, arc.D, arc.E)     // near points are A itself at the circle
      : angleAt(state.A, arc.B, arc.C);    // the two nearer intersection points
    out.formula = out.inside ? (out.arcBC + out.arcDE) / 2 : Math.abs(out.arcBC - out.arcDE) / 2;
    return out;
  }

  /** The live line under the picture. An illustration has no win or loss. */
  function describe(state) {
    const g = compute(state);
    if (!g.valid) return "Drag the points until both lines cross the circle.";
    const where = g.onCircle ? "A is on the circle" : g.inside ? "A is inside the circle" : "A is outside the circle";
    const kind = g.inside ? "half the sum" : "half the difference";
    const tangent = g.tangent ? " One secant is a tangent." : "";
    return `${where}. Angle at A ${deg(g.angle).toFixed(1)}°, arc BC ${deg(g.arcBC).toFixed(1)}°, ` +
           `arc DE ${deg(g.arcDE).toFixed(1)}°. ${kind} = ${deg(g.formula).toFixed(1)}°.${tangent}`;
  }

  function result() { return null; } // a demo: nothing to win or lose

  return {
    TAU: TAU, EPS: EPS, CENTER: CENTER, RADIUS: RADIUS, RO: RO,
    MIN_X: MIN_X, MAX_X: MAX_X, MIN_Y: MIN_Y, MAX_Y: MAX_Y,
    MIN_HANDLE: MIN_HANDLE, HANDLE_RING: HANDLE_RING,
    clamp: clamp, dist: dist, sqDist: sqDist, deg: deg, polar: polar, unit: unit,
    signedAngle: signedAngle, arcBetween: arcBetween, angleAt: angleAt,
    circleLine: circleLine, moveToFirst: moveToFirst,
    appletArcs: appletArcs, clampHandle: clampHandle,
    start: start, moveA: moveA, moveHandle: moveHandle, slide: slide,
    toggle: toggle, compute: compute, describe: describe, result: result,
  };
})();
