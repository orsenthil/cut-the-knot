"use strict";

/*
 * Inscriptible Quadri — the geometry behind Alexander Bogomolny's applet
 * InscriptibleQuadri (cut-the-knot.org/Curriculum/Geometry/InscriptibleQuadri.shtml).
 *
 * The applet puts four dots M, Q, N and P on a circle. At each dot it draws the
 * tangent line; two tangents meet in a corner of a four-sided figure:
 *   A = tangent(M) ∩ tangent(P),  B = tangent(P) ∩ tangent(N),
 *   C = tangent(N) ∩ tangent(Q),  D = tangent(Q) ∩ tangent(M).
 * The circle touches AB at P, BC at N, CD at Q and DA at M. Because the two
 * tangents from any one corner have the same length, AB + CD = BC + DA
 * (Pitot's theorem) whenever the circle really lies inside the figure.
 *
 * The code follows the applet's bytecode: GetCircle (circumcentre of M,Q,N and
 * the mean of its three distances), GetTangent (the radius turned by a quarter
 * turn), GeoSDoub.Intersect (its lines, including the |det| < 1 fallback to
 * NaN), and Compute (the six intersections above). Dragging a dot projects it
 * back onto the circle; dragging the centre translates the whole picture, just
 * as MoveableCircle.UpdateLocation and UpdateBPoints do.
 *
 * This file is only geometry and state: no document, no window, no storage.
 * It defines one global, InscriptibleQuadriCore, so the page loads it with a
 * plain <script> and porting/check-inscriptible-quadri.mjs loads it in Node.
 * The position is plain data and can be handed to the tutor as it is.
 */

const InscriptibleQuadriCore = (() => {
  // The applet's getParameterInfo says 400 x 250 "seems optimal".
  const WIDTH = 400;
  const HEIGHT = 250;
  const PAD = 8;
  const HANDLES = ["M", "Q", "N", "P"];
  const OPTION_KEYS = ["showNames", "showTangency", "showTangents", "showSides"];
  const START_O = { x: WIDTH / 3, y: HEIGHT / 2 + 20 };     // applet init()
  const START_R = Math.min(WIDTH, HEIGHT) / 6;
  // The applet uses cos/sin(0.4), (1.2), (2.9) for M, Q, N and a random angle
  // in [0, PI) for P. We pin P at 4.6 so the opening picture is a proper
  // circumscribed quadrilateral; start({ random: true }) restores the applet's
  // random choice. Dragging reaches every configuration either way.
  const START_ANGLES = { M: 0.4, Q: 1.2, N: 2.9, P: 4.6 };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const onCircle = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  const clampPoint = (p) => ({
    x: clamp(p.x, PAD, WIDTH - PAD),
    y: clamp(p.y, PAD, HEIGHT - PAD),
  });

  /** GeoSDoub.Intersect(P1,P2,P3,P4): ax+by+c=0 lines, |det| < 1 gives NaN. */
  function intersect(L, K) {
    const a1 = L.a.y - L.b.y, b1 = L.b.x - L.a.x;
    const c1 = L.a.x * L.b.y - L.a.y * L.b.x;
    const a2 = K.a.y - K.b.y, b2 = K.b.x - K.a.x;
    const c2 = K.a.x * K.b.y - K.a.y * K.b.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter plus the canvas's GetCircle: mean of 3 radii. */
  function circleFrom3(p, q, r) {
    const m12 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m23 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const O = intersect(
      { a: m12, b: { x: m12.x + q.y - p.y, y: m12.y + p.x - q.x } },
      { a: m23, b: { x: m23.x + r.y - q.y, y: m23.y + q.x - r.x } },
    );
    if (!finite(O)) return { O, r: NaN };
    return { O, r: (dist(O, p) + dist(O, q) + dist(O, r)) / 3 };
  }

  /** InscriptibleQuadriCanvas.GetTangent: p plus the radius turned 90 degrees. */
  function tangentLine(p, circle) {
    return {
      a: p,
      b: { x: p.x - (p.y - circle.O.y), y: p.y + (p.x - circle.O.x) },
    };
  }

  /** The circle glider in CTKMoveableDoub.UpdateLocation: project onto the circle. */
  function projectToCircle(p, circle) {
    const O = circle.O, r = circle.r;
    const d = dist(O, p);
    if (!finite(p) || d < 1e-9) return null;
    return { x: O.x + ((p.x - O.x) * r) / d, y: O.y + ((p.y - O.y) * r) / d };
  }

  /** MoveableCircle.UpdateLocation + UpdateBPoints: translate circle and dots. */
  function translateCircle(state, target) {
    if (!finite(target)) return null;
    const O = {
      x: clamp(target.x, PAD + state.r, WIDTH - PAD - state.r),
      y: clamp(target.y, PAD + state.r, HEIGHT - PAD - state.r),
    };
    const d = sub(O, state.O);
    const next = { ...state, O };
    for (const name of HANDLES) next[name] = add(state[name], d);
    return next;
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture and the applet's four checkbox defaults. */
  function start(options) {
    const o = options || {};
    const angles = { ...START_ANGLES, ...(o.angles || {}) };
    if (o.random) angles.P = Math.random() * Math.PI;   // applet init()
    const O = finite(o.O) ? { ...o.O } : { ...START_O };
    const r = Number.isFinite(o.r) && o.r > 0 ? o.r : START_R;
    const state = {
      O, r,
      M: onCircle(O, r, angles.M),
      Q: onCircle(O, r, angles.Q),
      N: onCircle(O, r, angles.N),
      P: onCircle(O, r, angles.P),
      showNames: false,      // the archived applet set ShowNames=0
      showTangency: false,
      showTangents: false,
      showSides: false,
      moves: 0,
      explored: false,
    };
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** The moves a player can make: five drags, four switches, reset. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      { type: "circle", point: state.O },
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The next position, or null when the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      const p = projectToCircle(clampPoint(m.point), { O: state.O, r: state.r });
      if (p) next = { ...state, [m.name]: p };
    } else if (m.type === "circle") {
      next = translateCircle(state, m.point);
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = start(Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])));
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has no win or loss: it counts as explored once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the geometry */

  /** True when p lies on the segment ab (tangent point between two corners). */
  function onSegment(p, a, b) {
    if (!finite(p) || !finite(a) || !finite(b)) return false;
    const tol = 1e-7 * Math.max(1, dist(a, b));
    return Math.abs(cross(sub(b, a), sub(p, a))) <= tol && dot(sub(p, a), sub(p, b)) <= tol;
  }

  /** Everything the picture needs at a position; mirrors the canvas's Compute(). */
  function compute(state) {
    if (!state || !finite(state.O) || !HANDLES.every((n) => finite(state[n]))) {
      return { valid: false, reason: "invalid" };
    }
    const circle = { O: state.O, r: state.r };
    const lines = {};
    for (const name of HANDLES) lines[name] = tangentLine(state[name], circle);
    // The six intersections, in the applet's order.
    const v = {
      A: intersect(lines.M, lines.P),
      B: intersect(lines.P, lines.N),
      C: intersect(lines.N, lines.Q),
      D: intersect(lines.Q, lines.M),
      S: intersect(lines.M, lines.N),
      T: intersect(lines.P, lines.Q),
    };
    const valid = [v.A, v.B, v.C, v.D].every(finite);
    const sides = {
      AB: dist(v.A, v.B), BC: dist(v.B, v.C),
      CD: dist(v.C, v.D), DA: dist(v.D, v.A),
    };
    // The two tangent segments from each corner, equal in length by Pythagorean
    // right triangles; these are the pieces Pitot's proof adds up.
    const touch = {
      AM: dist(v.A, state.M), AP: dist(v.A, state.P),
      BP: dist(v.B, state.P), BN: dist(v.B, state.N),
      CN: dist(v.C, state.N), CQ: dist(v.C, state.Q),
      DQ: dist(v.D, state.Q), DM: dist(v.D, state.M),
    };
    // The circle is inside exactly when each tangency point lies on its side.
    const inscribed = valid &&
      onSegment(state.P, v.A, v.B) && onSegment(state.N, v.B, v.C) &&
      onSegment(state.Q, v.C, v.D) && onSegment(state.M, v.D, v.A);
    return {
      valid, reason: valid ? null : "parallel", circle, lines, v, sides, touch, inscribed,
      residuals: residuals({ sides, touch, inscribed }),
    };
  }

  /** The page's formula and its exscriptible alternatives, as signed errors. */
  function residuals(g) {
    if (!g || !g.sides) return null;
    const { AB, BC, CD, DA } = g.sides;
    const t = g.touch;
    return {
      pitot: AB + CD - BC - DA,
      exscriptibleB: AB + BC - CD - DA,
      exscriptibleA: AB + DA - BC - CD,
      tangents: Math.max(
        Math.abs(t.AM - t.AP), Math.abs(t.BP - t.BN),
        Math.abs(t.CN - t.CQ), Math.abs(t.DQ - t.DM),
      ),
    };
  }

  return {
    WIDTH, HEIGHT, PAD, HANDLES, OPTION_KEYS, START_O, START_R, START_ANGLES,
    add, sub, mul, dot, cross, dist, finite, clamp, onCircle, clampPoint,
    intersect, circleFrom3, tangentLine, projectToCircle, translateCircle, onSegment,
    start, legalMoves, move, result, compute, residuals,
  };
})();
