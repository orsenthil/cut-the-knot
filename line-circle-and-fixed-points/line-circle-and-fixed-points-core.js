"use strict";

/*
 * Line, Circle, and Fixed Points — Alexander Bogomolny's applet
 * LineCircleAndFixedPoints, which illustrates Problem 3 of the 2007 Irish
 * Mathematical Olympiad. P and Q are fixed: P sits on the circle C(O), Q on a
 * line. Move V along the line; the circle through P, Q and V meets C(O) again
 * at R, and the line VR meets C(O) again at S. The page claims that VR always
 * passes through a fixed point. The true fixed point is S: it is the second
 * intersection of C(O) with the line PO (the antipode of P when O is the
 * centre). The applet itself fixes S instead, takes V' = line PS ∩ QV and
 * checks that the circle through P, Q, V' is tangent to C(O) at P.
 *
 * This file transcribes the applet's Compute() faithfully: GeoSDoub's
 * line/circle and circle/circle intersections (including its X/Y branch by
 * coordinate difference), FindCircumcenter via perpendicular bisectors,
 * GetCircle's averaged radius, Other() and Barycenter. It has no DOM, no
 * window and no storage; it defines one global, LineCircleAndFixedPointsCore,
 * so the page loads it with a plain <script> and the logic test loads it in
 * Node. The position is plain data and can be handed to the tutor as it is.
 */
const LineCircleAndFixedPointsCore = (() => {
  // The applet's canvas (400 x 300) is drawn here at a viewBox of the same
  // proportions. Its init() places the four points as fractions of the size:
  const WIDTH = 400;
  const HEIGHT = 300;
  const EDGE = 12;              // keep handles away from the border
  const MIN_VQ = 12;            // Compute() returns early when dist(V,Q) < 1
  const OPTION_KEYS = ["showNames", "showPremise", "showStatement", "showHint"];
  const HANDLES = ["P", "Q", "V", "O"];

  const EPS = 1;
  const round = (v) => Math.round(v * 1000) / 1000;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clone = (p) => ({ x: p.x, y: p.y });

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p, m2, q);
  }

  /** The applet's GetCircle: centre + the mean of the three radii. */
  function getCircle(a, b, c) {
    const center = circumcenter(a, b, c);
    return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
  }

  /* The next four functions transcribe GeoSDoub.IntersectCirclesX/Y and
   * IntersectX/Y(DoubLine,DoubCircle). The applet branches on whether the two
   * centres differ by more than 1 in x (or y); for a line on a circle it
   * branches on |dy| > 1 and otherwise on |dx| > 1. Keeping the same branch is
   * important: the port and the bytecode must make the same choice at a
   * borderline position, even when either branch would be mathematically
   * fine. */

  function intersectCirclesX(c1, c2) {
    const a = -(c1.center.y - c2.center.y) / (c1.center.x - c2.center.x);
    const b = (c1.center.x * c1.center.x - c2.center.x * c2.center.x
      + c1.center.y * c1.center.y - c2.center.y * c2.center.y
      - c1.radius * c1.radius + c2.radius * c2.radius) / (2 * (c1.center.x - c2.center.x));
    const m = b - c1.center.x;
    const A = a * a + 1, B = a * m - c1.center.y;
    const C = m * m + c1.center.y * c1.center.y - c1.radius * c1.radius;
    const D = B * B - A * C;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
  }

  function intersectCirclesY(c1, c2) {
    const a = -(c1.center.x - c2.center.x) / (c1.center.y - c2.center.y);
    const b = (c1.center.y * c1.center.y - c2.center.y * c2.center.y
      + c1.center.x * c1.center.x - c2.center.x * c2.center.x
      - c1.radius * c1.radius + c2.radius * c2.radius) / (2 * (c1.center.y - c2.center.y));
    const m = b - c1.center.y;
    const A = a * a + 1, B = a * m - c1.center.x;
    const C = m * m + c1.center.x * c1.center.x - c1.radius * c1.radius;
    const D = B * B - A * C;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    const x1 = (-B + s) / A, x2 = (-B - s) / A;
    return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
  }

  function circlesIntersect(c1, c2) {
    if (Math.abs(c1.center.x - c2.center.x) > 1) return intersectCirclesX(c1, c2);
    if (Math.abs(c1.center.y - c2.center.y) > 1) return intersectCirclesY(c1, c2);
    return [clone(c1.center), clone(c1.center)];
  }

  function intersectLineXCircle(p, q, c) { // y = a x + b
    const a = (p.y - q.y) / (p.x - q.x), b = q.y - a * q.x;
    const A = a * a + 1, B = a * (b - c.center.y) - c.center.x;
    const C = (b - c.center.y) * (b - c.center.y) + c.center.x * c.center.x - c.radius * c.radius;
    const D = B * B - A * C;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    const x1 = (-B + s) / A, x2 = (-B - s) / A;
    return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
  }

  function intersectLineYCircle(p, q, c) { // x = a y + b
    const a = (p.x - q.x) / (p.y - q.y), b = q.x - a * q.y;
    const A = a * a + 1, B = a * (b - c.center.x) - c.center.y;
    const C = (b - c.center.x) * (b - c.center.x) + c.center.y * c.center.y - c.radius * c.radius;
    const D = B * B - A * C;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    const y1 = (-B + s) / A, y2 = (-B - s) / A;
    return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
  }

  function lineCircleIntersect(p, q, c) {
    if (Math.abs(p.y - q.y) > 1) return intersectLineXCircle(p, q, c);
    if (Math.abs(p.x - q.x) > 1) return intersectLineYCircle(p, q, c);
    return null;
  }

  /** The applet's Other(points, reference): the entry not equal to reference. */
  function other(points, reference) {
    if (!points) return null;
    if (dist(points[0], reference) < 1) return points[1];
    return points[0];
  }

  /** The fixed point S of the page's claim. Take V arbitrarily far along the
   *  line QV: the circle through P, Q, V tends to the line PQ, so R tends to
   *  the second point R∞ where line PQ meets C(O), and line VR tends to the
   *  line through R∞ parallel to QV. S is the other intersection of that
   *  parallel with C(O). Because QV is the horizontal line y = Q.y, this is
   *  just the reflection of R∞ in the vertical diameter of C(O). */
  function fixedPoint(P, Q, O) {
    const d = { x: Q.x - P.x, y: Q.y - P.y }, dd = dot(d, d);
    if (!dd) return null;
    const t = -2 * dot({ x: P.x - O.x, y: P.y - O.y }, d) / dd;
    const R = { x: P.x + t * d.x, y: P.y + t * d.y };
    const r = dist(O, P), dy = R.y - O.y, disc = r * r - dy * dy;
    if (disc < 0) return null;
    const dx = Math.sqrt(disc);
    return Math.abs(O.x + dx - R.x) < Math.abs(O.x - dx - R.x)
      ? { x: O.x - dx, y: R.y } : { x: O.x + dx, y: R.y };
  }

  /** The opening picture, at the same fractions as Canvas.init(). */
  function start(options) {
    const cx = WIDTH / 2, cy = HEIGHT / 2, dx = cx / 2, dy = cy / 2;
    let s = {
      P: { x: cx, y: cy },
      Q: { x: cx + dx, y: HEIGHT - dy / 2 },
      V: { x: cx - dx, y: HEIGHT - dy / 2 },
      O: { x: cx - dx * 3 / 5, y: cy - dy / 4 },
      showNames: true,       // the applet's "show" parameter defaults to "1"
      showPremise: false,
      showStatement: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    const o = options || {};
    for (const name of HANDLES) {
      if (finite(o[name])) s = move(s, { type: "point", name, point: o[name] });
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") s = { ...s, [key]: o[key] };
    }
    return { ...s, moves: 0, explored: false };
  }

  /** Keep a handle inside the board. Q is a free point; V is the point fixed
   *  to Q's horizontal line (the applet's mouseDragged resets V.y to Q.y). */
  function clampHandle(name, q, state) {
    if (!HANDLES.includes(name) || !finite(q)) return null;
    const x = round(Math.max(EDGE, Math.min(WIDTH - EDGE, q.x)));
    const y = round(Math.max(EDGE, Math.min(HEIGHT - EDGE, q.y)));
    if (name === "V") {
      const lineY = round(state.Q.y);
      let vx = x;
      if (Math.abs(vx - state.Q.x) < MIN_VQ) {
        vx = round(state.Q.x + (vx < state.Q.x ? -MIN_VQ : MIN_VQ));
      }
      return { x: Math.max(EDGE, Math.min(WIDTH - EDGE, vx)), y: lineY };
    }
    return { x, y };
  }

  /** The moves a player can make: four handles, four switches and Reset. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      const p = clampHandle(m.name, m.point, state);
      if (!p) return null;
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next || !HANDLES.every((n) => finite(next[n]))) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has nothing to win: it counts as played once it was changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** Canvas.Compute(), transcribed from the bytecode. Returns null in the
   *  applet's early-return case dist(V,Q) < 1, or when an intersection is
   *  missing; a well-posed configuration returns every object the applet
   *  draws plus the fixed point and the tangency test of its parenthetical. */
  function compute(state) {
    if (!state || !HANDLES.every((n) => finite(state[n]))) return null;
    const P = state.P, Q = state.Q, V = state.V, O = state.O;
    if (dist(V, Q) < 1) return null;

    const circleO = { center: clone(O), radius: dist(O, P) };
    const circleX = getCircle(P, Q, V);
    const R = other(circlesIntersect(circleX, circleO), P);
    if (!R || !finite(R)) return null;
    const lineVR = [clone(V), clone(R)];
    const second = lineCircleIntersect(V, R, circleO);
    const S = other(second, R);
    if (!S || !finite(S)) return null;
    const T = intersect(S, P, V, Q);                 // V' in the page's proof
    const circleT = finite(T) ? getCircle(P, Q, T) : null;
    const Sfixed = fixedPoint(P, Q, O);
    return {
      P: clone(P), Q: clone(Q), V: clone(V), O: clone(O),
      circleO, circleX, circleT, R: clone(R), S: clone(S),
      T: circleT ? clone(T) : null, lineVR, VQ: [clone(Q), { x: 0, y: Q.y }],
      Sfixed,
      // The applet's chosen V' makes circleT and circleO tangent at P.
      tangency: circleT ? Math.abs(dist(circleT.center, O) - (circleT.radius + circleO.radius)) : null,
      // Residual of the page's claim: S should be the fixed point.
      fixedError: Sfixed ? dist(S, Sfixed) : null,
    };
  }

  /** Geometric residuals used by the logic test. */
  function residuals(g) {
    if (!g || !g.circleT) return null;
    return {
      onCircleO: Math.abs(dist(g.O, g.S) - g.circleO.radius),
      onCircleX: Math.abs(dist(g.circleX.center, g.R) - g.circleX.radius),
      onCircleT: Math.abs(dist(g.circleT.center, g.P) - g.circleT.radius),
      pOnBoth: Math.abs(dist(g.circleO.center, g.P) - g.circleO.radius),
      vrCollinear: Math.abs(cross({ x: g.S.x - g.V.x, y: g.S.y - g.V.y },
        { x: g.R.x - g.V.x, y: g.R.y - g.V.y })),
      sptCollinear: Math.abs(cross({ x: g.S.x - g.P.x, y: g.S.y - g.P.y },
        { x: g.T.x - g.P.x, y: g.T.y - g.P.y })),
      tvqCollinear: Math.abs(g.T.y - g.Q.y),
      tangency: g.tangency,
      fixedError: g.fixedError,
    };
  }

  return {
    WIDTH, HEIGHT, EDGE, MIN_VQ, EPS, OPTION_KEYS, HANDLES,
    round, dist, cross, dot, finite, intersect, circumcenter, getCircle,
    intersectCirclesX, intersectCirclesY, circlesIntersect,
    intersectLineXCircle, intersectLineYCircle, lineCircleIntersect,
    other, fixedPoint, start, clampHandle, legalMoves, move, result,
    compute, residuals,
  };
})();
