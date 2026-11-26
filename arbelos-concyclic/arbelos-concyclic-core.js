"use strict";

/*
 * Concyclic points in an arbelos, from Alexander Bogomolny's applet
 * ArbelosConcyclic and the cut-the-knot page "Concyclic Points in Arbelos".
 *
 * A big semicircle on AB holds two smaller semicircles on AC and CB. The
 * circle inscribed in the arbelos touches them at E (left), F (right) and D
 * (big). M and N are the tops of the two small semicircles. The page claims
 * that A, C, F, D lie on the circle centred at M with radius MC, and that
 * B, C, E, D lie on the circle centred at N with radius NC. A remark adds
 * that A, B, F, E lie on the circle centred at L1, the reflection of the top
 * L of the big semicircle in AB. The logic test checks all three claims at
 * every draggable position.
 *
 * The key construction (Woo, as used by the applet's DefinePoints) is that
 * the two ends of the incircle's horizontal diameter, joined to A, B and C,
 * meet the three semicircles at exactly their tangency points. The incircle
 * itself is found from the three radii: its radius is
 *   a*b*(a+b) / (2*(a*a + a*b + b*b)),  a = AC, b = CB.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, ArbelosConcyclicCore. The position is plain data - the fraction
 * of AB where C sits - so it can be saved and handed to the tutor.
 */

const ArbelosConcyclicCore = (() => {
  // ArbelosConcyclicCanvas.init: margin 30, side = min(w-2m, 2(h-2m)),
  // rectangle (margin, height-margin-side/2, side, side), A and B on its
  // middle line. The applet's m_Point starts at 0.6*A.x + 0.7*B.x.
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 30;
  const DIAMETER = Math.min(WIDTH - 2 * MARGIN, 2 * (HEIGHT - 2 * MARGIN)); // 340
  const RECT = {
    x: MARGIN,
    y: HEIGHT - MARGIN - DIAMETER / 2,
    width: DIAMETER,
    height: DIAMETER,
  };
  const BASE_Y = RECT.y + RECT.height / 2; // 220
  const START_T = (0.6 * MARGIN + 0.7 * (MARGIN + DIAMETER) - MARGIN) / DIAMETER;
  // PointIsEligible refuses x within 10px of A or B.
  const EDGE = 10;
  const MIN_T = EDGE / DIAMETER;
  const MAX_T = 1 - MIN_T;

  const A = { x: RECT.x, y: BASE_Y };
  const B = { x: RECT.x + DIAMETER, y: BASE_Y };
  const R = DIAMETER / 2;
  const bigCenter = { x: (A.x + B.x) / 2, y: BASE_Y };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** Intersection of the lines through a,b and c,d (applet GeoSDoub.Intersect). */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = b.x * a.y - a.x * b.y;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = d.x * c.y - c.x * d.y;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-12) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  const clampT = (t) => {
    const v = Number.isFinite(t) ? t : START_T;
    return Math.max(MIN_T, Math.min(MAX_T, v));
  };

  /** The position a new diagram starts from. */
  function start(options) {
    const t = options && options.t !== undefined ? options.t : START_T;
    return { t: clampT(t) };
  }

  /** Move C to a new fraction of AB; never change the given position. */
  function setT(state, t) {
    return { t: clampT(t === undefined ? state.t : t) };
  }

  /** The fraction of AB belonging to a board x coordinate (from a drag). */
  function fractionAtX(x) {
    return clampT((x - A.x) / DIAMETER);
  }

  /** Everything the page draws, derived from one fraction. */
  function geometry(state) {
    const t = clampT(state.t);
    const C = { x: A.x + DIAMETER * t, y: BASE_Y };
    const a = C.x - A.x, b = B.x - C.x;
    const r1 = a / 2, r2 = b / 2;
    const O1 = { x: A.x + r1, y: BASE_Y };
    const O2 = { x: B.x - r2, y: BASE_Y };

    // Tangency to all three semicircles: radius and centre of the incircle.
    const incR = (a * b * DIAMETER) / (2 * (a * a + a * b + b * b));
    const incH = ((DIAMETER + a) * incR) / b; // x from A, in mathematical y-up
    const incK = Math.sqrt(Math.max(0, (R - incR) ** 2 - (incH - R) ** 2));
    const P = { x: A.x + incH, y: BASE_Y - incK };

    // DefinePoints: the ends of the incircle's horizontal diameter. Join
    // them to A, B and C; the three crossings are E, F and D.
    const rightEnd = { x: P.x + incR, y: P.y };
    const leftEnd = { x: P.x - incR, y: P.y };
    const E = intersect(A, rightEnd, C, leftEnd);
    const F = intersect(leftEnd, B, C, rightEnd);
    const D = intersect(A, leftEnd, B, rightEnd);

    const M = { x: O1.x, y: BASE_Y - r1 };
    const N = { x: O2.x, y: BASE_Y - r2 };
    const circleM = { center: M, radius: dist(M, C) };
    const circleN = { center: N, radius: dist(N, C) };
    // The applet's L is the top of the big semicircle; L1 is its mirror in AB.
    const L = { x: bigCenter.x, y: BASE_Y - R };
    const L1 = { x: bigCenter.x, y: BASE_Y + R };
    const circleL1 = { center: L1, radius: dist(L1, A) };

    return {
      t, A, B, C, a, b, r1, r2, R, O1, O2, bigCenter,
      incircle: { center: P, radius: incR }, P, rightEnd, leftEnd,
      E, F, D, M, N, circleM, circleN, L, L1, circleL1,
    };
  }

  /** A compact JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    const pt = (p) => ({ x: round(p.x), y: round(p.y) });
    return {
      t: round(g.t),
      A: pt(g.A), B: pt(g.B), C: pt(g.C),
      M: pt(g.M), N: pt(g.N),
      incircle: { center: pt(g.P), radius: round(g.incircle.radius) },
      E: pt(g.E), F: pt(g.F), D: pt(g.D),
      circleM: { center: pt(g.M), radius: round(g.circleM.radius) },
      circleN: { center: pt(g.N), radius: round(g.circleN.radius) },
    };
  }

  return {
    WIDTH, HEIGHT, MARGIN, DIAMETER, RECT, BASE_Y, START_T, EDGE, MIN_T, MAX_T,
    A, B, R, bigCenter, dist, intersect, clampT,
    start, setT, fractionAtX, geometry, position,
  };
})();
