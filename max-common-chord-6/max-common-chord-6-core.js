"use strict";

/*
 * Max Common Chord 6, from Alexander Bogomolny's applet MaxCommonChord6
 * ("Problem 4, 1975 USA Math Olympiad: The Final Touch", cut-the-knot.org).
 *
 * Two circles meet at P and Q. A segment AB through P has its ends on the two
 * circles. Among all such segments, AP·PB is largest when S - the centre of
 * the circumcircle ABQ - is the point of C(O) whose radius OS is parallel to
 * PQ. This page joins that synthetic answer to the trigonometric one: at the
 * maximum the second intersection W of AE and BF lies on both C(O) and C(S),
 * RW is a diameter of C(S), so RA and RB are tangents and angle EPA = angle FPB.
 *
 * This file is logic only: no document, no window, no storage. It defines one
 * global, MaxCommonChord6Core, so the page loads it with a plain <script> and
 * porting/check-max-common-chord-6.mjs loads it in Node. A position is plain
 * data, so it can be saved and handed to the tutor.
 *
 * The geometry follows the applet's own bytecode: GeoSDoub.FindCircumcenter
 * (intersecting the two perpendicular bisectors), the X/Y branch choice in
 * circle-line and circle-circle intersections, the "other point at least one
 * unit away" rule, the averaged radius in GetCircle, and ComputeAngle's
 * vertex-first order. Its Finished test is
 * |angle(Q,U,S) - angle(Q,S,T)| < 0.01; the logic test shows that this is
 * exactly the maximum-product chord, not a decorative extra.
 */
const MaxCommonChord6Core = (() => {
  const WIDTH = 640;
  const HEIGHT = 460;
  const MARGIN = 12;
  const HANDLES = ["P", "Q", "A", "B"];
  const OPTIONS = ["mode", "showNames"];
  const FINISHED_EPS = 0.01;

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;

  /** GeoSDoub.Intersect of two lines, including its near-parallel NaN result. */
  function intersectLines(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  /** GeoSDoub.FindCircumcenter: two shifted midpoints, then their intersection. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b);
    const m2 = midpoint(b, c);
    const v1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const v2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersectLines(m1, v1, m2, v2);
  }

  /** GetCircle(a,b,c): the applet averages the three distances for the radius. */
  function circleFrom3(a, b, c) {
    if (!finite(a) || !finite(b) || !finite(c)) return null;
    const o = circumcenter(a, b, c);
    if (!finite(o)) return null;
    return { x: o.x, y: o.y, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /** CTKGeometryPlus.Prorate(p,q,d): scale the distance p->q to d. */
  function prorate(p, q, d) {
    const len = dist(p, q);
    if (len < 0.1) return copy(p);
    const t = d / len;
    return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
  }

  /** CTKGeometryPlus.Perp(p,q,r): rotate q-p by 90 degrees about r, ×10. */
  function perpVec(p, q, r) {
    const at = r || midpoint(p, q);
    return {
      x: at.x + (p.y - q.y) * 10,
      y: at.y - (p.x - q.x) * 10,
    };
  }

  /** GeoSDoub.ComputeAngle(a,b,c): angle at the FIRST argument. */
  function angleAt(v, p, q) {
    const d1 = dist(v, p), d2 = dist(v, q);
    if (!d1 || !d2) return 0;
    const cos = (sqDist(v, p) + sqDist(v, q) - sqDist(p, q)) / (2 * d1 * d2);
    return Math.acos(clamp(cos, -1, 1));
  }

  /** GeoSDoub.IntersectX(DoubLine,DoubCircle): solve y = m x + b. */
  function intersectX(p, q, circle) {
    const m = (p.x - q.x) / (p.y - q.y);
    const b = q.x - m * q.y;
    const a = m * m + 1;
    const k = m * (b - circle.x) - circle.y;
    const c = circle.y * circle.y + (b - circle.x) ** 2 - circle.r * circle.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  /** GeoSDoub.IntersectY(DoubLine,DoubCircle): solve x = m y + b. */
  function intersectY(p, q, circle) {
    const m = (p.y - q.y) / (p.x - q.x);
    const b = q.y - m * q.x;
    const a = m * m + 1;
    const k = m * (b - circle.y) - circle.x;
    const c = circle.x * circle.x + (b - circle.y) ** 2 - circle.r * circle.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  function intersectCircleLine(circle, p, q) {
    if (!circle || !finite(p) || !finite(q)) return null;
    if (Math.abs(p.y - q.y) > 1) return intersectX(p, q, circle);
    if (Math.abs(p.x - q.x) > 1) return intersectY(p, q, circle);
    return null;
  }

  /** GeoSDoub.IntersectCirclesX / Y, with the same dispatch order. */
  function intersectCirclesX(c0, c1) {
    const m = -(c0.y - c1.y) / (c0.x - c1.x);
    const b = (
      c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.x - c1.x);
    const h = b - c0.x, a = m * m + 1, k = m * h - c0.y;
    const c = h * h + c0.y * c0.y - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  function intersectCirclesY(c0, c1) {
    const m = -(c0.x - c1.x) / (c0.y - c1.y);
    const b = (
      c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
      c0.r * c0.r + c1.r * c1.r
    ) / 2 / (c0.y - c1.y);
    const h = b - c0.y, a = m * m + 1, k = m * h - c0.x;
    const c = h * h + c0.x * c0.x - c0.r * c0.r;
    const disc = k * k - a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / a, x2 = (-k - root) / a;
    return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
  }

  function intersectCircles(c0, c1) {
    if (!c0 || !c1 || !finite(c0) || !finite(c1) ||
        !Number.isFinite(c0.r) || !Number.isFinite(c1.r)) return null;
    if (Math.abs(c0.x - c1.x) > 1) return intersectCirclesX(c0, c1);
    if (Math.abs(c0.y - c1.y) > 1) return intersectCirclesY(c0, c1);
    return [copy(c0), copy(c0)];
  }

  /** The applet's Other(): the second point, at least one unit from ref. */
  function other(points, ref) {
    if (!points || !points[0] || !points[1]) return null;
    return dist(points[0], ref) < 1 ? points[1] : points[0];
  }

  /** CTKMoveableDoub.RestrictToCircle: radial projection onto the circle. */
  function restrictToCircle(p, circle) {
    if (!circle || !finite(p)) return copy(p);
    const d = dist(p, circle);
    if (d < 1e-12) return { x: circle.x + circle.r, y: circle.y };
    return {
      x: circle.x + ((p.x - circle.x) * circle.r) / d,
      y: circle.y + ((p.y - circle.y) * circle.r) / d,
    };
  }

  /** Fix(target, circle, guide): keep target on circle and on line guide-P. */
  function fix(target, circle, guide, P) {
    if (!circle || !finite(target) || !finite(guide) || dist(guide, P) < 1) return copy(target);
    const hit = intersectCircleLine(circle, guide, P);
    const point = other(hit, P);
    return point ? copy(point) : copy(target);
  }

  /** The board's circles, as recomputed by Compute on every repaint. */
  function circles(state) {
    const E = circleFrom3(state.A, state.P, state.Q);
    const F = circleFrom3(state.B, state.P, state.Q);
    if (!E || !F) return null;
    const EQF = circleFrom3(E, state.Q, F);
    const AB = circleFrom3(state.A, state.B, state.Q);
    if (!EQF || !AB) return null;
    return { E, F, EQF, AB };
  }

  /** The exact guard at the head of MaxCommonChord6Canvas.Compute(). */
  function canCompute(state) {
    const { P, Q, A, B } = state;
    return [A, Q, B].every((p) => finite(p)) && finite(P) &&
      dist(A, P) >= 2 && dist(A, Q) >= 2 &&
      dist(B, P) >= 2 && dist(B, Q) >= 2 && dist(P, Q) >= 2;
  }

  /** MaxCommonChord6Canvas.Compute(), as plain data. */
  function compute(state) {
    const invalid = { valid: false, finished: false };
    if (!state || !canCompute(state)) return invalid;
    const cs = circles(state);
    if (!cs) return invalid;
    const { P, Q, A, B } = state;
    const { E, F, EQF, AB } = cs;
    const L = other(intersectCircles(EQF, E), Q);
    const M = other(intersectCircles(EQF, F), Q);
    const rPts = intersectCircleLine(AB, P, Q);
    const R = other(rPts, Q);
    if (!L || !M || !R || dist(P, R) < 1) return invalid;

    const S = intersectLines(A, L, B, M);
    const U = other(intersectCircleLine(EQF, P, Q), Q);
    const T = prorate(Q, EQF, 2 * EQF.r);
    if (!finite(S) || !U || !finite(T)) return invalid;
    const perp = perpVec(P, Q, S);
    const N = intersectLines(S, perp, P, Q);
    if (!finite(N)) return invalid;
    const W = intersectLines(A, E, B, F);
    if (!finite(W)) return invalid;

    const finished = Math.abs(
      angleAt(Q, U, S) - angleAt(Q, S, T),
    ) < FINISHED_EPS;
    const product = dist(A, P) * dist(B, P);
    return {
      valid: true, finished, product,
      E, F, EQF, AB, L, M, R, S, U, T, N, W,
      circleS: { x: S.x, y: S.y, r: dist(S, Q) },
      perp,
      angleUS: angleAt(Q, U, S),
      angleST: angleAt(Q, S, T),
    };
  }

  /**
   * The synthetic answer: S on C(O) with OS parallel to PQ, taking the ray
   * that points from Q towards P. C(S) is the circle centred there through Q;
   * its second crossings with C(E) and C(F) are the optimal A and B.
   */
  function optimal(state) {
    const g = compute(state);
    if (!g.valid) return null;
    const { P, Q } = state;
    const u = { x: (P.x - Q.x) / dist(P, Q), y: (P.y - Q.y) / dist(P, Q) };
    const S = { x: g.EQF.x + u.x * g.EQF.r, y: g.EQF.y + u.y * g.EQF.r };
    const circleS = { x: S.x, y: S.y, r: dist(S, Q) };
    const A = other(intersectCircles(circleS, g.E), Q);
    const B = other(intersectCircles(circleS, g.F), Q);
    if (!A || !B) return null;
    return { P: copy(P), Q: copy(Q), A, B, mode: state.mode, showNames: state.showNames };
  }

  /** The position a new diagram starts from, from the applet's init(). */
  function start(options) {
    const o = options || {};
    const width = o.width || WIDTH;
    const height = o.height || HEIGHT;
    const state = {
      P: { x: (width * 6) / 11, y: Math.trunc((height / 2 + height / 10)) },
      Q: { x: width / 2, y: Math.trunc((height * 3) / 5 + height / 5) },
      A: { x: 259, y: 251 },
      B: { x: (width * 18) / 20, y: Math.trunc((height * 3) / 5 + height / 5) },
      mode: "chord",
      showNames: false,
    };
    state.B = fix(state.B, circleFrom3(state.B, state.P, state.Q), state.A, state.P);
    return state;
  }

  function reset(state) {
    return start({ width: WIDTH, height: HEIGHT });
  }

  function setOption(state, key, value) {
    if (!OPTIONS.includes(key)) return state;
    if (key === "mode" && value !== "circles" && value !== "chord") return state;
    return { ...state, [key]: key === "mode" ? value : Boolean(value) };
  }

  /** Drag one handle: the same Fix/restrict behaviour as mouseDragged(). */
  function drag(state, name, point) {
    if (!HANDLES.includes(name) || !finite(point)) return state;
    const q = clampToBoard(point);
    const next = { ...state, [name]: q };
    if (name === "P" || name === "Q") return next; // the applet just moves them

    const E = circleFrom3(state.A, state.P, state.Q);
    const F = circleFrom3(state.B, state.P, state.Q);
    if (!E || !F) return next;

    if (name === "A") {
      if (state.mode === "circles") {
        next.A = q; // GetCircle(P,Q,A) is recomputed by Compute()
      } else {
        next.A = restrictToCircle(q, E);
      }
      next.B = fix(state.B, F, next.A, state.P);
    } else {
      if (state.mode === "circles") {
        next.B = q; // GetCircle(P,Q,B) is recomputed by Compute()
      } else {
        next.B = restrictToCircle(q, F);
      }
      next.A = fix(state.A, E, next.B, state.P);
    }
    return next;
  }

  /** A plain-language readout for the status line; never a win or a loss. */
  function describe(state) {
    const g = compute(state);
    if (!g.valid) return "Move the dots apart to draw the two circles again.";
    if (g.finished) {
      return "Best chord found: the two angles at P match, and AP×PB is largest.";
    }
    return `AP×PB is ${Math.round(g.product)}. Drag A or B, or press “Show the best chord”.`;
  }

  /** An illustration has no win, loss or finished play of its own. */
  function result(state) {
    return null;
  }

  return {
    WIDTH, HEIGHT, HANDLES, OPTIONS, FINISHED_EPS,
    start, reset, setOption, drag, compute, optimal, describe, result,
    // The applet's geometric primitives, exposed for the Node logic test.
    geom: {
      dist, sqDist, dot, cross, midpoint, clamp, clampToBoard, copy, finite,
      intersectLines, circumcenter, circleFrom3, prorate, perpVec, angleAt,
      intersectCircleLine, intersectCircles, other, restrictToCircle, fix, circles,
    },
  };
})();
