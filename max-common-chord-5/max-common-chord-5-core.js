"use strict";

/*
 * Max Common Chord 5, from Alexander Bogomolny's applet MaxCommonChord5 and
 * the cut-the-knot page "Two Circles and Two More".
 *
 * Two fixed circles C(E) and C(F) meet at P and Q. A lies on C(E), B lies on
 * C(F), and the chord AB goes through P. W is the meeting point of the lines
 * AE and BF. The page claims that E, Q, W, F lie on one circle and that
 * A, Q, W, B lie on another, so W is their second common point after Q. Its
 * proof also says that the angle EWF equals EPF and therefore does not depend
 * on the position of AB. As an ordinary (non-directed) angle this is true up
 * to taking the supplement when W crosses to the other side; the angle
 * between the two lines AE and BF is fixed.
 *
 * The key construction is the applet's own one: C(E) passes through A, P, Q
 * and C(F) through B, P, Q; when A or B is dragged on a circle the other
 * endpoint is moved to the far intersection of its circle with the line
 * through P (the applet's Fix). Everything else is circumcentres, circle
 * intersections and one perpendicular foot.
 *
 * This file holds only the logic: no document, no window, no storage. It
 * defines one global, MaxCommonChord5Core. The position is plain data, so it
 * can be saved for the player's record and handed to the tutor.
 */

const MaxCommonChord5Core = (() => {
  // MaxCommonChord5Canvas.init: the four starting points are fractions of
  // the canvas size. With a 400 x 250 canvas these become the numbers below.
  const WIDTH = 400;
  const HEIGHT = 250;
  const P0 = { x: (6 * WIDTH) / 11, y: HEIGHT / 2 + HEIGHT / 10 };
  const Q0 = { x: WIDTH / 2, y: (3 * HEIGHT) / 5 + HEIGHT / 5 };
  const A0 = { x: (2 * WIDTH) / 5, y: (3 * HEIGHT) / 5 };
  const B0 = { x: (18 * WIDTH) / 20, y: (3 * HEIGHT) / 5 + HEIGHT / 5 };
  const EDGE = 8; // keep a dragged point inside the picture
  const MIN_SEPARATION = 2; // Compute() refuses points closer than 2 px

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = b.x * a.y - a.x * b.y;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = d.x * c.y - c.x * d.y;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** GeoSDoub.FindCircumcenter, followed by GetCircle's averaged radius. */
  function circle(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p = {
      x: m1.x + (b.y - a.y),
      y: m1.y - (b.x - a.x),
    };
    const q = {
      x: m2.x + (c.y - b.y),
      y: m2.y - (c.x - b.x),
    };
    const o = intersect(m1, p, m2, q);
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return { x: o.x, y: o.y, r };
  }

  /**
   * The two crossings of a line pq with a circle, in GeoSDoub's order. The
   * applet splits the quadratic on the larger coordinate difference and
   * keeps the linear coefficient halved (disc = B*B - A*C, no factor 4),
   * including its 1-pixel cut-off; that cut-off is why a Fix close to P can
   * quietly leave the other endpoint where it was.
   */
  function circleLine(c, p, q) {
    const xPath = Math.abs(p.y - q.y) > 1;
    if (!xPath && Math.abs(p.x - q.x) <= 1) return null;
    const m = xPath ? (p.x - q.x) / (p.y - q.y) : (p.y - q.y) / (p.x - q.x);
    const b = xPath ? q.x - m * q.y : q.y - m * q.x;
    const aa = m * m + 1;
    const bb = xPath ? m * (b - c.x) - c.y : m * (b - c.y) - c.x;
    const cc = xPath
      ? c.y * c.y + (b - c.x) * (b - c.x) - c.r * c.r
      : c.x * c.x + (b - c.y) * (b - c.y) - c.r * c.r;
    const disc = bb * bb - aa * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-bb + s) / aa, t2 = (-bb - s) / aa;
    return xPath
      ? [{ x: m * t1 + b, y: t1 }, { x: m * t2 + b, y: t2 }]
      : [{ x: t1, y: m * t1 + b }, { x: t2, y: m * t2 + b }];
  }

  /** Other(points, reference) in the applet: the farther of two crossings. */
  function other(points, reference) {
    if (!points || points.length !== 2) return null;
    return dist(points[0], reference) < dist(points[1], reference)
      ? points[1]
      : points[0];
  }

  /** The second intersection of two circles, other than a known common point. */
  function otherCirclePoint(c1, c2, known) {
    const v = { x: c2.x - c1.x, y: c2.y - c1.y };
    const d = Math.hypot(v.x, v.y);
    if (d < 1e-9 || d > c1.r + c2.r || d < Math.abs(c1.r - c2.r)) return null;
    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h2 = c1.r * c1.r - a * a;
    if (h2 < 0) return null;
    const h = Math.sqrt(h2);
    const ux = v.x / d, uy = v.y / d;
    const base = { x: c1.x + a * ux, y: c1.y + a * uy };
    const p = { x: base.x - h * uy, y: base.y + h * ux };
    const q = { x: base.x + h * uy, y: base.y - h * ux };
    return dist(p, known) < dist(q, known) ? q : p;
  }

  /** CTKGeometryPlus.Prorate(Q, centre, 2r): the antipode of Q on a circle. */
  function prorate(p, q, target) {
    const d = dist(p, q);
    if (d < 0.1) return copy(p);
    const t = target / d;
    return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
  }

  /** CTKGeometryPlus.Perp(P, Q, S): a point 10 units off S, across PQ. */
  function perp(p, q, s) {
    return {
      x: s.x + 10 * (q.y - p.y),
      y: s.y - 10 * (q.x - p.x),
    };
  }

  /** The angle at v with arms va and vb, in degrees, between 0 and 180. */
  function angle(a, v, b) {
    const u = { x: a.x - v.x, y: a.y - v.y };
    const w = { x: b.x - v.x, y: b.y - v.y };
    return (Math.atan2(Math.abs(u.x * w.y - u.y * w.x), u.x * w.x + u.y * w.y) * 180) / Math.PI;
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: clamp(p.x, EDGE, WIDTH - EDGE),
    y: clamp(p.y, EDGE, HEIGHT - EDGE),
  });

  /** The applet's Fix: put one endpoint on its circle along the line to P. */
  function fix(state, name) {
    const otherName = name === "A" ? "B" : "A";
    const circleOther = circle(state[otherName], state.P, state.Q);
    if (dist(state[name], state.P) < 1) return state;
    const hits = circleLine(circleOther, state[name], state.P);
    const chosen = other(hits, state.P);
    if (!chosen) return state;
    const next = {
      P: copy(state.P), Q: copy(state.Q), A: copy(state.A), B: copy(state.B),
    };
    next[otherName] = chosen;
    return next;
  }

  /** A fresh diagram: P, Q, A, B at the applet's fractions, then Fix(B, C(F), A). */
  function start() {
    const state = { P: copy(P0), Q: copy(Q0), A: copy(A0), B: copy(B0) };
    return fix(state, "A");
  }

  /**
   * Drag one point to a target. With "circles" selected, A and B are free and
   * their circles follow them; with "chord" selected (the applet's default),
   * A and B slide along their circles. Either way the opposite endpoint is
   * fixed onto its own circle along the line through P. P and Q are not
   * re-fixed, exactly as in the applet: dragging them can break the chord.
   */
  function move(state, name, target, mode) {
    if (!state || !["P", "Q", "A", "B"].includes(name)) return state;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return state;
    const next = {
      P: copy(state.P), Q: copy(state.Q), A: copy(state.A), B: copy(state.B),
    };
    const p = clampPoint(target);
    if (name === "P" || name === "Q") {
      next[name] = p;
      return next;
    }
    if (mode === "circles") {
      next[name] = p;
    } else {
      const c = circle(state[name], state.P, state.Q);
      const d = dist(p, c);
      next[name] = d < 1e-9 ? copy(state[name]) : {
        x: c.x + (c.r * (p.x - c.x)) / d,
        y: c.y + (c.r * (p.y - c.y)) / d,
      };
    }
    return fix(next, name);
  }

  /** A point on a circle at an angle in radians; useful for sampling drags. */
  function onCircle(c, theta) {
    return { x: c.x + c.r * Math.cos(theta), y: c.y + c.r * Math.sin(theta) };
  }

  /** Everything the page draws and the checks verify. */
  function geometry(state) {
    const { P, Q, A, B } = state;
    const E = circle(A, P, Q);
    const F = circle(B, P, Q);
    const separated = [dist(A, P), dist(A, Q), dist(B, P), dist(B, Q), dist(P, Q)]
      .every((d) => d > MIN_SEPARATION);
    const circlesFinite = [E, F].every((c) =>
      Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r) && c.r > 0);

    const rawEQF = circlesFinite ? circle(E, Q, F) : null;
    const rawABQ = circlesFinite ? circle(A, B, Q) : null;
    const rawW = circlesFinite ? intersect(A, E, B, F) : null;
    const usable = (c) => !!c && Number.isFinite(c.r) && c.r > 0 &&
      Number.isFinite(c.x) && Number.isFinite(c.y);
    const valid = separated && circlesFinite && usable(rawEQF) && usable(rawABQ) &&
      finitePoint(rawW);
    const EQF = valid ? rawEQF : null;
    const ABQ = valid ? rawABQ : null;
    const W = valid ? rawW : null;
    const L = valid ? otherCirclePoint(EQF, E, Q) : null;
    const M = valid ? otherCirclePoint(EQF, F, Q) : null;
    const S = valid && L && M ? intersect(A, L, B, M) : null;
    const R = valid ? other(circleLine(ABQ, P, Q), Q) : null;
    const U = valid ? other(circleLine(EQF, P, Q), Q) : null;
    const T = valid ? prorate(Q, EQF, 2 * EQF.r) : null;
    const N = valid && S && finitePoint(S)
      ? intersect(S, perp(P, Q, S), P, Q)
      : null;

    const chordLength = dist(A, B);
    const throughP = chordLength > 0 && Math.abs(cross(A, B, P)) / chordLength < 0.5;
    return {
      P, Q, A, B, E, F, EQF, ABQ, W, R, S, U, T, N, L, M,
      valid, throughP,
      angleEPF: valid ? angle(E, P, F) : NaN,
      angleEWF: valid && finitePoint(W) ? angle(E, W, F) : NaN,
      angleAQB: valid ? angle(A, Q, B) : NaN,
      angleAWB: valid && finitePoint(W) ? angle(A, W, B) : NaN,
    };
  }

  /** A compact, JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number.isFinite(v) ? Number(v.toFixed(6)) : null;
    const pt = (p) => p && finitePoint(p) ? { x: round(p.x), y: round(p.y) } : null;
    const circ = (c) => c && Number.isFinite(c.r)
      ? { center: pt(c), radius: round(c.r) }
      : null;
    return {
      P: pt(g.P), Q: pt(g.Q), A: pt(g.A), B: pt(g.B),
      E: pt(g.E), F: pt(g.F), W: pt(g.W),
      circleE: circ(g.E), circleF: circ(g.F),
      circleEQF: circ(g.EQF), circleABQ: circ(g.ABQ),
      throughP: g.throughP,
      angleEPF: round(g.angleEPF), angleEWF: round(g.angleEWF),
    };
  }

  return {
    WIDTH, HEIGHT, P0, Q0, A0, B0, EDGE, MIN_SEPARATION,
    copy, dist, cross, intersect, circle, circleLine, other, otherCirclePoint,
    prorate, perp, angle, clamp, clampPoint, onCircle,
    start, move, geometry, position,
  };
})();
