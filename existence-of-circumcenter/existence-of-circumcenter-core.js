"use strict";

/*
 * Existence of the Circumcenter — Euclid IV.5, from Alexander Bogomolny's
 * ExistenceOfCircumcenter applet. Drag the corners A, B, C of a triangle. The
 * dots L, M, N ride on the sides; their perpendicular lines cross at O. Slide
 * the three dots onto the middles of their sides and the circle through all
 * three corners appears. There is no win and no loss: this is a demonstration
 * that the three perpendicular bisectors meet in one point, the circumcenter.
 *
 * The one idea the code relies on: a point on the perpendicular bisector of a
 * side is equally far from its two ends. Solving the two equal-distance
 * equations for AB and AC gives O, and the same equations also hold for BC.
 * The starting triangle, the coefficients of the three side dots, the 0.1
 * snap and the 2-pixel "hit" tests are the applet's own numbers.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, ExistenceOfCircumcenterCore, so the page
 * loads it with a plain <script> and porting/check-existence-of-circumcenter.mjs
 * loads it in Node. Positions are plain data; functions return new objects.
 */
const ExistenceOfCircumcenterCore = (() => {
  const EPS = 1e-12;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The applet's point-on-a-side rule: coef*first + (1-coef)*second. */
  function along(first, second, coef) {
    return {
      x: coef * first.x + (1 - coef) * second.x,
      y: coef * first.y + (1 - coef) * second.y,
    };
  }

  /** The applet's UpgradeCoefs.coef: where p sits from second toward first. */
  function sideCoef(p, first, second) {
    const dx = first.x - second.x, dy = first.y - second.y;
    if (Math.hypot(dx, dy) < 1) return 0;
    const denominator = dx * dx + dy * dy;
    return ((first.x - second.x) * (p.x - second.x) +
            (first.y - second.y) * (p.y - second.y)) / denominator;
  }

  /** Project onto the infinite line through a and b (the applet's RestrictToLine). */
  function projectOnLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    if (length2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.GetPerp as the canvas uses it: a line through mid at right angles to p-q. */
  function perpendicularLine(mid, p, q) {
    return {
      from: { x: mid.x, y: mid.y },
      to: { x: mid.x + p.y - q.y, y: mid.y - p.x + q.x },
    };
  }

  /*
   * The circumcenter from the equal-distance equations:
   *   2(B-A)·O = |B|²-|A|² and 2(C-A)·O = |C|²-|A|².
   * Java's GeoSDoub.Intersect refuses a determinant smaller than 1; the
   * determinant here is twice the signed area, so the same cut-off applies.
   */
  function circumcenter(A, B, C) {
    const ax = B.x - A.x, ay = B.y - A.y;
    const bx = C.x - A.x, by = C.y - A.y;
    const det = 2 * (ax * by - ay * bx);
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    const ra = B.x * B.x + B.y * B.y - A.x * A.x - A.y * A.y;
    const rb = C.x * C.x + C.y * C.y - A.x * A.x - A.y * A.y;
    return {
      x: (ra * by - rb * ay) / det,
      y: (ax * rb - bx * ra) / det,
    };
  }

  /** The starting triangle is ExistenceOfCircumcenterCanvas.init at 450x400. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 450 : o.width;
    const height = o.height === undefined ? 400 : o.height;
    const fifthX = width / 5, fifthY = height / 5;
    const A = { x: fifthX, y: height - fifthY };
    const B = { x: 4.5 * fifthX, y: A.y };
    const C = { x: width - fifthX, y: 2 * fifthY };
    const coefL = o.coefL === undefined ? 0.3 : o.coefL;
    const coefM = o.coefM === undefined ? 0.3 : o.coefM;
    const coefN = o.coefN === undefined ? 0.4 : o.coefN;
    return {
      A: o.A ? { ...o.A } : A,
      B: o.B ? { ...o.B } : B,
      C: o.C ? { ...o.C } : C,
      coefL, coefM, coefN,
      L: along(o.C || C, o.B || B, coefL),
      M: along(o.A || A, o.C || C, coefM),
      N: along(o.B || B, o.A || A, coefN),
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
      width, height,
    };
  }

  /* UpgradePoints: dragging a corner only moves the dots on the sides touching it. */
  function moveVertex(state, name, p) {
    const next = {
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
      coefL: state.coefL, coefM: state.coefM, coefN: state.coefN,
      showNames: state.showNames, width: state.width, height: state.height,
    };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    next.L = along(next.C, next.B, next.coefL);
    next.M = along(next.A, next.C, next.coefM);
    next.N = along(next.B, next.A, next.coefN);
    return next;
  }

  /* The dots are restricted to their side; the coefficients change on release. */
  const SIDE_OF = { L: ["C", "B", "coefL"], M: ["A", "C", "coefM"], N: ["B", "A", "coefN"] };

  function dragMidpoint(state, name, p) {
    const side = SIDE_OF[name];
    if (!side) return state;
    const next = { ...state, L: { ...state.L }, M: { ...state.M }, N: { ...state.N } };
    next[name] = projectOnLine(p, state[side[0]], state[side[1]]);
    return next;
  }

  /* UpgradeCoefs: recompute a coefficient, snapping to 1/2 within 0.1 of it. */
  function releaseMidpoint(state, name) {
    const side = SIDE_OF[name];
    if (!side) return state;
    let coef = sideCoef(state[name], state[side[0]], state[side[1]]);
    if (Math.abs(coef - 0.5) < 0.1) coef = 0.5;
    const next = { ...state, [side[2]]: coef, L: { ...state.L }, M: { ...state.M }, N: { ...state.N } };
    next[name] = along(state[side[0]], state[side[1]], coef);
    return next;
  }

  /** Accessibility shortcut: put all three dots at the exact middles. */
  function snapMidpoints(state) {
    return {
      ...state,
      coefL: 0.5, coefM: 0.5, coefN: 0.5,
      L: along(state.C, state.B, 0.5),
      M: along(state.A, state.C, 0.5),
      N: along(state.B, state.A, 0.5),
    };
  }

  function signedDoubleArea(A, B, C) {
    return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
  }

  /** Everything the page needs to draw and describe the current diagram. */
  function measurements(state) {
    const { A, B, C, L, M, N } = state;
    const center = circumcenter(A, B, C);
    const noDraw = !Number.isFinite(center.x) || !Number.isFinite(center.y);
    const dA = noDraw ? NaN : distance(center, A);
    const dB = noDraw ? NaN : distance(center, B);
    const dC = noDraw ? NaN : distance(center, C);
    /* GetCircle takes the mean of the three radii, not one of them. */
    const radius = noDraw ? NaN : (dA + dB + dC) / 3;
    const hits = {
      L: !noDraw && Math.abs(distance(L, B) - distance(L, C)) < 2,
      M: !noDraw && Math.abs(distance(M, C) - distance(M, A)) < 2,
      N: !noDraw && Math.abs(distance(N, A) - distance(N, B)) < 2,
    };
    const area = signedDoubleArea(A, B, C);
    const onBC = !noDraw && Math.abs(signedDoubleArea(B, C, center)) <= 1e-7 * Math.max(1, Math.abs(area)) &&
      Math.min(B.x, C.x) - 1e-7 <= center.x && center.x <= Math.max(B.x, C.x) + 1e-7 &&
      Math.min(B.y, C.y) - 1e-7 <= center.y && center.y <= Math.max(B.y, C.y) + 1e-7;
    const boundary = 1e-8 * Math.abs(area);
    const inside = !noDraw && !onBC &&
      signedDoubleArea(A, B, center) * area > boundary &&
      signedDoubleArea(B, C, center) * area > boundary &&
      signedDoubleArea(C, A, center) * area > boundary;
    const rightAtA = Math.abs((B.x - A.x) * (C.x - A.x) + (B.y - A.y) * (C.y - A.y)) < 1e-7;
    return {
      A, B, C, L, M, N, center, noDraw, radius,
      distances: { A: dA, B: dB, C: dC },
      hits, allHit: hits.L && hits.M && hits.N,
      lines: {
        L: perpendicularLine(L, B, C),
        M: perpendicularLine(M, C, A),
        N: perpendicularLine(N, A, B),
      },
      trueLines: {
        L: perpendicularLine(along(C, B, 0.5), B, C),
        M: perpendicularLine(along(A, C, 0.5), C, A),
        N: perpendicularLine(along(B, A, 0.5), A, B),
      },
      area, onBC, inside, rightAtA,
    };
  }

  /** The statements on the cut-the-knot page, as numerical assertions. */
  function claims(state) {
    const m = measurements(state);
    if (m.noDraw) {
      return {
        midpointsEquidistant: false, linesPerpendicular: false, bisectorsConcurrent: false,
        equidistant: false, circleThroughVertices: false, locationPossible: false,
      };
    }
    const scale = Math.max(distance(m.A, m.B), distance(m.B, m.C), distance(m.C, m.A));
    const tol = 1e-7 * Math.max(1, scale);
    const mid = (p, q) => along(p, q, 0.5);
    const onLine = (p, line) => {
      const dx = line.to.x - line.from.x, dy = line.to.y - line.from.y;
      return Math.abs(dx * (p.y - line.from.y) - dy * (p.x - line.from.x)) <= tol * Math.hypot(dx, dy);
    };
    const mL = mid(m.B, m.C), mM = mid(m.C, m.A), mN = mid(m.A, m.B);
    const perpendicular = (line, p, q) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      return Math.abs((line.to.x - line.from.x) * dx + (line.to.y - line.from.y) * dy) <= tol * Math.hypot(dx, dy);
    };
    return {
      // The midpoint of a segment is equally far from its two ends.
      midpointsEquidistant:
        Math.abs(distance(mL, m.B) - distance(mL, m.C)) < tol &&
        Math.abs(distance(mM, m.C) - distance(mM, m.A)) < tol &&
        Math.abs(distance(mN, m.A) - distance(mN, m.B)) < tol,
      linesPerpendicular:
        perpendicular(m.trueLines.L, m.B, m.C) &&
        perpendicular(m.trueLines.M, m.C, m.A) &&
        perpendicular(m.trueLines.N, m.A, m.B),
      bisectorsConcurrent:
        onLine(m.center, m.trueLines.L) &&
        onLine(m.center, m.trueLines.M) &&
        onLine(m.center, m.trueLines.N),
      equidistant:
        Math.abs(m.distances.A - m.distances.B) < tol &&
        Math.abs(m.distances.A - m.distances.C) < tol &&
        Math.abs(m.distances.B - m.distances.C) < tol,
      circleThroughVertices:
        Math.abs(distance(m.center, m.A) - m.radius) < tol &&
        Math.abs(distance(m.center, m.B) - m.radius) < tol &&
        Math.abs(distance(m.center, m.C) - m.radius) < tol,
      // Inside, on BC (a right angle at A), or outside are all possible.
      locationPossible: m.inside || m.onBC || (!m.inside && !m.onBC),
    };
  }

  /** The illustration can be completed, but never won or lost. */
  function result(state) {
    return measurements(state).allHit ? "done" : null;
  }

  return {
    distance, along, sideCoef, projectOnLine, perpendicularLine, circumcenter,
    start, moveVertex, dragMidpoint, releaseMidpoint, snapMidpoints,
    measurements, claims, result,
  };
})();
