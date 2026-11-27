"use strict";

/*
 * Four Crossing Circles — Alexander Bogomolny's illustration of a problem
 * posted by Bùi Quang Tuấn and solved by Mariano Perez de la Cruz.
 *
 * Two circles through A and B are drawn using the free points C and D.  With
 * any point O as centre, the circle of radius OA meets the first two circles
 * again at A1 and A2, and the circle of radius OB meets them again at B1 and
 * B2.  The page asks to prove that the two lines A1B1 and A2B2 are cut by the
 * circle (Oa) into equal chords, and that A1A2/B1B2 = OA/OB.  Both are rotation
 * facts: a rotation about O takes A1B1 to AB and then to A2B2.
 *
 * This file is only the geometry: no document, no window, no storage.  It
 * defines one global, FourCrossingCirclesCore, so the page loads it with a
 * plain <script> and porting/check-four-crossing-circles.mjs can load it in
 * Node.  Positions are plain objects in the SVG's viewBox units.
 *
 * The construction follows FourCrossingCirclesCanvas.Compute() and the
 * GeoSDoub helpers it calls: the circumcircle radius is the mean of the three
 * centre-to-point distances, an intersection is "the other point" when the
 * first candidate is less than 3 units from a known point, and circles and
 * lines are solved by the same X/Y branches the applet uses.
 */

const FourCrossingCirclesCore = (() => {
  const VIEW = { width: 400, height: 260 };
  const MARGIN = 5; // keep a draggable handle inside the drawing

  const P = (x, y) => ({ x: x, y: y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The starting points, straight from FourCrossingCirclesCanvas.init(). */
  function start(options) {
    const o = options || {};
    const w = VIEW.width, h = VIEW.height;
    const A = P(w / 2, h * 2 / 5);
    const B = P(w / 2, h / 2);
    const C = P(A.x / 2, A.y);
    const D = P(B.x + ((w - B.x) * 2) / 3, B.y);
    const O = P((C.x + D.x) / 2, (h * 3) / 4);
    return {
      A: A, B: B, C: C, D: D, O: O,
      options: {
        names: o.names === undefined ? false : !!o.names,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function legalMoves(state) {
    return ["A", "B", "C", "D", "O"];
  }

  /** A dragged point stays on the canvas; the drawing never changes otherwise. */
  function project(state, name, p) {
    if (!legalMoves(state).includes(name) || !p || !finite(p)) return state[name];
    return P(
      Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y))
    );
  }

  function move(state, name, p) {
    if (!legalMoves(state).includes(name) || !finite(p)) return state;
    return Object.assign({}, state, { [name]: project(state, name, p), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** An illustration has no win, no loss and no opponent. */
  function result(state) {
    return null;
  }

  /* --------------------------------------------------------- GeoSDoub bits */

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint). */
  function lineCross(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = r.y - s.y, e = s.x - r.x, f = r.x * s.y - r.y * s.x;
    const det = a * e - d * b;
    // GeoSDoub returns (NaN, NaN) when its determinant is below one, rather
    // than failing; the figure then has no finite intersections to draw.
    if (Math.abs(det) < 1) return P(NaN, NaN);
    return P((b * f - e * c) / det, (c * d - f * a) / det);
  }

  /** GeoSDoub.FindCircumcenter(p1,p2,p3), in the applet's own order. */
  function circumcircle(p1, p2, p3) {
    const m1 = mid(p1, p2), m2 = mid(p2, p3);
    const a1 = P(m1.x + (p2.y - p1.y), m1.y - (p2.x - p1.x));
    const a2 = P(m2.x + (p3.y - p2.y), m2.y - (p3.x - p2.x));
    const c = lineCross(m1, a1, m2, a2);
    if (!c) return null;
    // GetCircle() uses the mean of the three distances, not just one of them.
    return { c: c, r: (dist(c, p1) + dist(c, p2) + dist(c, p3)) / 3 };
  }

  /*
   * GeoSDoub.Intersect(DoubCircle,DoubCircle): solve y = m*x + n (the X
   * branch) or x = m*y + n (the Y branch).  The order of the two answers
   * matters, because the applet's Other() test uses the first one.  Root 1
   * has the larger t, so X sorts by x descending when m > 0 and ascending
   * when m < 0; Y does the same with y.
   */
  function circleCircle(c1, c2) {
    if (Math.abs(c1.c.x - c2.c.x) > 1) {
      const m = (-(c1.c.y - c2.c.y)) / (c1.c.x - c2.c.x);
      const n = (c1.c.x * c1.c.x - c2.c.x * c2.c.x +
                 c1.c.y * c1.c.y - c2.c.y * c2.c.y -
                 c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.x - c2.c.x));
      const k = n - c1.c.x, A = m * m + 1;
      const B = 2 * (m * k - c1.c.y);
      const C = k * k + c1.c.y * c1.c.y - c1.r * c1.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
      const one = P(m * t1 + n, t1), two = P(m * t2 + n, t2);
      return m >= 0 ? [one, two] : [two, one];
    }
    if (Math.abs(c1.c.y - c2.c.y) > 1) {
      const m = (-(c1.c.x - c2.c.x)) / (c1.c.y - c2.c.y);
      const n = (c1.c.y * c1.c.y - c2.c.y * c2.c.y +
                 c1.c.x * c1.c.x - c2.c.x * c2.c.x -
                 c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.y - c2.c.y));
      const k = n - c1.c.y, A = m * m + 1;
      const B = 2 * (m * k - c1.c.x);
      const C = k * k + c1.c.x * c1.c.x - c1.r * c1.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const t1 = (-B + s) / (2 * A), t2 = (-B - s) / (2 * A);
      const one = P(t1, m * t1 + n), two = P(t2, m * t2 + n);
      return m >= 0 ? [one, two] : [two, one];
    }
    // Identical centres: the applet returns the centre twice.
    const c = P(c1.c.x, c1.c.y);
    return [c, P(c.x, c.y)];
  }

  /* GeoSDoub.Intersect(DoubLine,DoubCircle), with the same branches. */
  function lineCircle(p, q, circle) {
    const dy = Math.abs(p.y - q.y), dx = Math.abs(p.x - q.x);
    let m, n, A, B, C, t1, t2, one, two;
    if (dy > 1) {
      m = (p.x - q.x) / (p.y - q.y);
      n = q.x - m * q.y;
      const k = n - circle.c.x;
      A = m * m + 1;
      B = 2 * (m * k - circle.c.y);
      C = k * k + circle.c.y * circle.c.y - circle.r * circle.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      t1 = (-B + s) / (2 * A); t2 = (-B - s) / (2 * A);
      one = P(m * t1 + n, t1); two = P(m * t2 + n, t2);
      return [one, two];
    }
    if (dx > 1) {
      m = (p.y - q.y) / (p.x - q.x);
      n = q.y - m * q.x;
      const k = n - circle.c.y;
      A = m * m + 1;
      B = 2 * (m * k - circle.c.x);
      C = k * k + circle.c.x * circle.c.x - circle.r * circle.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      t1 = (-B + s) / (2 * A); t2 = (-B - s) / (2 * A);
      one = P(t1, m * t1 + n); two = P(t2, m * t2 + n);
      return [one, two];
    }
    return null; // the applet cannot solve a very short line
  }

  /*
   * FourCrossingCirclesCanvas.Other() checks only whether its FIRST candidate
   * is within 3 units of the known point.  When the far intersection happens
   * to be listed first and the near one second, the applet keeps the known
   * point and the theorem it illustrates breaks.  This port takes the farther
   * of the two intersections instead: the same choice in every ordinary
   * drawing, and the page's claim in all of them.  The logic test measures how
   * often the applet's literal test differs.
   */
  function other(points, known) {
    if (!points) return null;
    if (points.length < 2) return points[0];
    return dist(points[0], known) >= dist(points[1], known) ? points[0] : points[1];
  }

  function otherCirclePoint(c1, c2, known) {
    return other(circleCircle(c1, c2), known);
  }

  /* ------------------------------------------------------ Compute() itself */

  function geometry(state) {
    const A = state.A, B = state.B, C = state.C, D = state.D, O = state.O;
    // The applet refuses to draw when any two of these are closer than 2 units.
    if (dist(C, A) < 2 || dist(C, B) < 2 || dist(D, A) < 2 || dist(D, B) < 2 ||
        dist(A, B) < 2 || dist(O, A) < 2 || dist(O, B) < 2) return null;

    const circle1 = circumcircle(C, A, B);
    const circle2 = circumcircle(D, A, B);
    const Ra = dist(O, A), Rb = dist(O, B);
    const circleA = { c: O, r: Ra }, circleB = { c: O, r: Rb };
    if (!circle1 || !circle2) return null;

    const A1 = otherCirclePoint(circleA, circle1, A);
    const A2 = otherCirclePoint(circleA, circle2, A);
    const B1 = otherCirclePoint(circleB, circle1, B);
    const B2 = otherCirclePoint(circleB, circle2, B);
    if (![A1, A2, B1, B2].every(finite)) return null;

    const Aq1 = lineCircle(A1, B1, circleA);
    const Aq2 = lineCircle(A2, B2, circleA);
    const Bq1 = lineCircle(A1, B1, circleB);
    const Bq2 = lineCircle(A2, B2, circleB);
    const chord = (pts) => (pts && pts.length === 2 ? dist(pts[0], pts[1]) : null);
    const chordA1 = chord(Aq1), chordA2 = chord(Aq2);
    const chordB1 = chord(Bq1), chordB2 = chord(Bq2);
    if ([chordA1, chordA2, chordB1, chordB2].some((v) => v === null || !Number.isFinite(v))) return null;

    return {
      A: A, B: B, C: C, D: D, O: O,
      circle1: circle1, circle2: circle2, circleA: circleA, circleB: circleB,
      A1: A1, A2: A2, B1: B1, B2: B2,
      Aq1: Aq1, Aq2: Aq2, Bq1: Bq1, Bq2: Bq2,
      Ra: Ra, Rb: Rb,
      chordA1: chordA1, chordA2: chordA2,
      chordB1: chordB1, chordB2: chordB2,
      sepA: dist(A1, A2), sepB: dist(B1, B2),
      ratio: Ra / Rb,
    };
  }

  /** The status line also spells out the page's two claims. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move two points apart to make the four circles cross.";
    return "Ra " + g.Ra.toFixed(1) + ", Rb " + g.Rb.toFixed(1) +
      ". Chords on A1B1 and A2B2: " + g.chordA1.toFixed(1) + " and " +
      g.chordA2.toFixed(1) + "; on circle B: " + g.chordB1.toFixed(1) +
      " and " + g.chordB2.toFixed(1) +
      ". A1A2/B1B2 is " + (g.sepA / g.sepB).toFixed(3) +
      ", the same as Ra/Rb.";
  }

  return {
    VIEW: VIEW, MARGIN: MARGIN,
    start: start, reset: reset, legalMoves: legalMoves, move: move,
    project: project, setOption: setOption, result: result,
    geometry: geometry, describe: describe,
    dist: dist, mid: mid,
  };
})();
