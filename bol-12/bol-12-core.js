"use strict";

/*
 * BOL12 — the geometry behind Alexander Bogomolny's applet for Proposition 12
 * of Archimedes' Book of Lemmas
 * (cut-the-knot.org/Curriculum/Geometry/BookOfLemmas/BOL12.shtml).
 *
 * AB is a diameter of a circle with centre C. T is any point outside the
 * circle; TP and TQ are the tangents from it. AQ and BP meet at R, and TR
 * meets AB at M. The proposition says TR is perpendicular to AB. In fact
 * R lies directly above (or below) T on the vertical through T, and
 * TP = TQ = TR: T is the centre of a circle through P, Q, R and O = 2T - P.
 *
 * The one idea the code relies on: with the centre at the origin and radius 1,
 * a point (cos a, sin a) written as t = tan(a/2) has x = (1-t²)/(1+t²),
 * y = 2t/(1+t²). The tangent condition T·(cos a, sin a) = 1 becomes
 * (u+1)t² - 2v t + (1-u) = 0. Its two roots are the parameters of P and Q;
 * their product is (1-u)/(1+u), which is exactly what makes AQ and BP cross
 * at x = u. The logic test checks this against a second transcription of the
 * applet's own circle-circle intersections over thousands of configurations.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol12Core, so the page loads it with a plain <script>
 * and porting/check-bol-12.mjs loads it in Node. All functions take plain data
 * and return new objects; nothing passed in is changed.
 */
const Bol12Core = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 8;
  const MIN_RADIUS = 16;   // keep the radius handle usable with a finger
  const HANDLES = ["C", "Bo", "T"];
  const OPTION_KEYS = ["showNames", "showStatement", "showHint"];

  // BOL12Canvas.init(): radius = WIDTH/6, C = (WIDTH/2 - r, HEIGHT/2 + r/2),
  // Bo = (C.x - r, C.y), T = (C.x + r/2, C.y - 1.2r).
  const RADIUS = WIDTH / 6;
  const START = {
    C: { x: WIDTH / 2 - RADIUS, y: HEIGHT / 2 + RADIUS / 2 },
    Bo: { x: WIDTH / 2 - 2 * RADIUS, y: HEIGHT / 2 + RADIUS / 2 },
    T: { x: WIDTH / 2 - RADIUS / 2, y: HEIGHT / 2 + RADIUS / 2 - 1.2 * RADIUS },
  };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });

  /** GeoSDoub.Intersect for four points, in ax+by+c form. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** Shortest distance from p to the line through a and b. */
  function distanceToLine(p, a, b) {
    const len = dist(a, b);
    return len < 1e-12 ? dist(p, a) : Math.abs(cross(sub(b, a), sub(p, a))) / len;
  }

  /** AdjustDiameter(): the horizontal diameter through the centre. */
  function diameter(center, r) {
    return {
      A: { x: center.x - r, y: center.y },
      B: { x: center.x + r, y: center.y },
    };
  }

  /** Extend(p, q) in the applet: the reflection of p in q. */
  function extend(p, q) {
    return { x: 2 * q.x - p.x, y: 2 * q.y - p.y };
  }

  /** DefinePQ(): P is the tangency point farther from B, Q the nearer one. */
  function definePQ(pts, B) {
    if (dist(pts[0], B) < dist(pts[1], B)) return { P: pts[1], Q: pts[0] };
    return { P: pts[0], Q: pts[1] };
  }

  /**
   * The two tangency points, from right triangles rather than the applet's
   * circle-circle intersection: the chord PQ is perpendicular to CT, its
   * midpoint is C + (r²/d²)(T-C), and its half length is r*sqrt(d²-r²)/d.
   * The second transcription in the logic test uses the applet's method.
   */
  function tangents(center, r, T, B) {
    const d = dist(center, T);
    if (!finite(center) || !finite(T) || !finite(B) || !(r > 0) || !(d > r)) return null;
    const u = mul(sub(T, center), 1 / d);
    const perp = { x: -u.y, y: u.x };
    const foot = add(center, mul(u, (r * r) / d));
    const half = (r * Math.sqrt(d * d - r * r)) / d;
    return definePQ([add(foot, mul(perp, half)), sub(foot, mul(perp, half))], B);
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return lineIntersection(m1, p, m2, q);
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's switch defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      C: { ...START.C },
      Bo: { ...START.Bo },
      T: { ...START.T },
      showNames: true,       // the applet's ShowNames parameter defaults to "1"
      showStatement: false,  // the other two checkboxes start unticked
      showHint: false,
      moves: 0,
      explored: false,
    };
    for (const name of HANDLES) {
      if (finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** Drag one of the three points, tick a switch, or reset the picture. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      let p = clampPoint(m.point);
      if (m.name === "Bo" && dist(p, state.C) < MIN_RADIUS) {
        const away = dist(state.C, state.Bo) > 1e-9
          ? mul(sub(state.Bo, state.C), 1 / dist(state.C, state.Bo))
          : { x: -1, y: 0 };
        p = clampPoint(add(state.C, mul(away, MIN_RADIUS)));
      }
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** An illustration has no win or loss: it counts as done once explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the geometry */

  /** Everything the page needs to draw the picture at this position. */
  function compute(state) {
    const C0 = state && state.C, Bo = state && state.Bo, T = state && state.T;
    if (!finite(C0) || !finite(Bo) || !finite(T)) {
      return { valid: false, reason: "invalid" };
    }
    const r = dist(C0, Bo);
    const d = dist(C0, T);
    const { A, B } = diameter(C0, r);
    if (!(r > 0) || !(d > r)) {
      return { valid: false, reason: "outside", C0, Bo, T, r, d, A, B };
    }
    const pair = tangents(C0, r, T, B);
    if (!pair) return { valid: false, reason: "outside", C0, Bo, T, r, d, A, B };
    const { P, Q } = pair;
    // Draw(): R = Intersect(A,Q,B,P), M = Intersect(A,B,T,R), O = Extend(P,T).
    const R = lineIntersection(A, Q, B, P);
    const M = lineIntersection(A, B, T, R || A);
    if (!R || !M) return { valid: false, reason: "parallel", C0, Bo, T, r, d, A, B, P, Q };
    const O = extend(P, T);
    const hint = circumcenter(O, Q, P);
    const hintRadius = hint
      ? (dist(hint, O) + dist(hint, Q) + dist(hint, P)) / 3
      : null;
    return {
      valid: true, reason: null, C0, Bo, T, r, d, A, B, P, Q, R, M, O, hint, hintRadius,
    };
  }

  /** Residuals of the proposition and its proof, divided by the radius. */
  function residuals(g) {
    if (!g || !g.valid) return null;
    const { C0, r, d, T, A, B, P, Q, R, M, O, hint, hintRadius } = g;
    const radii = [P, Q, R, O].map((p) => dist(T, p));
    return {
      onCircle: Math.max(Math.abs(dist(C0, P) - r), Math.abs(dist(C0, Q) - r)) / r,
      tangency: Math.max(
        Math.abs(dot(sub(P, C0), sub(T, P))) / (r * d),
        Math.abs(dot(sub(Q, C0), sub(T, Q))) / (r * d),
      ),
      equalTangents: Math.abs(dist(T, P) - dist(T, Q)) / r,
      // TR perpendicular to AB is R.x == T.x, since AB is horizontal.
      perpendicular: Math.abs(R.x - T.x) / r,
      foot: Math.max(Math.abs(M.y - C0.y), Math.abs(M.x - T.x)) / r,
      footOnLine: distanceToLine(M, T, R) / r,
      equalRadii: (Math.max(...radii) - Math.min(...radii)) / r,
      concurrence: Math.max(distanceToLine(R, A, Q), distanceToLine(R, B, P)) / r,
      hintCenter: hint ? dist(hint, T) / r : Infinity,
      hintRadius: hintRadius === null ? Infinity : Math.abs(hintRadius - dist(T, P)) / r,
    };
  }

  /** Each claim as a pass/fail flag, at a tolerance scaled to the picture. */
  function claims(g, tol) {
    const r = residuals(g);
    if (!r) return null;
    const t = tol === undefined ? 1e-7 : tol;
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v < t]));
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_RADIUS, HANDLES, OPTION_KEYS, RADIUS, START,
    add, sub, mul, dot, cross, dist, midpoint, finite, clamp, clampPoint,
    lineIntersection, distanceToLine, diameter, extend, definePQ, tangents,
    circumcenter, start, legalMoves, move, result, compute, residuals, claims,
  };
})();
