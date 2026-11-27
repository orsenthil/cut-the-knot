"use strict";

/*
 * Four Touching Circles, from Alexander Bogomolny's Java applet
 * FourTouchingCircles and the cut-the-knot page "The Four Touching Circles
 * Problem". The page first states that the four contact points of a cyclic
 * chain of four tangent circles are concyclic, then corrects itself: that is
 * true only when the number of external tangencies is even (0, 2 or 4).
 *
 * This applet builds a particular chain: two vertical lines and two circles
 * touching each other at E and touching one line each at A and B. Its
 * tangency points are A, E, B and the point at infinity where the parallel
 * lines meet, so they lie on the line AB. Inverting about the draggable pink
 * circle sends AB to a circle through the inversion centre O, and sends the
 * three finite contact points to three points on it: that is the page's
 * "inverted diagram" and the heart of its proof. Because this family is made
 * from parallel lines, it can only show the even case. The third applet
 * (FourTouchingCircles3) lets all four circles be dragged, including chains
 * with one or three internal tangencies, where the claim fails.
 *
 * The formulas here follow the applet's bytecode: MoveableCircle.ImproveData,
 * DrawCircle's GeoSDoub.Intersect/perpbisector construction, InvLine.Invert
 * and Inversion.Invert. This file is only logic: no document, no window, no
 * storage. It defines the one global FourTouchingCirclesCore. A position is
 * plain data, so it can be handed to the tutor.
 */

const FourTouchingCirclesCore = (() => {
  const WIDTH = 600;   // the applet on the original page was 600 by 450
  const HEIGHT = 450;
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  /** GeoSDoub.Intersect(p1,p2,p3,p4): intersection of two lines, NaN if parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < EPS) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** Foot of the perpendicular from a point onto the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  /** Inversion.Invert(circle, point): p -> O + r^2 (p-O) / |p-O|^2. */
  function invertPoint(circle, p) {
    const d2 = sqDist(circle.center, p);
    if (d2 < EPS) return { x: NaN, y: NaN };
    const k = circle.radius * circle.radius / d2;
    return {
      x: circle.center.x + k * (p.x - circle.center.x),
      y: circle.center.y + k * (p.y - circle.center.y),
    };
  }

  /** InvLine.InvertLinC: image of a line in the inversion circle. */
  function invertLine(line, circle) {
    const n = foot(circle.center, line.p, line.q);
    const d = dist(circle.center, n);
    if (d <= 0.1) return { kind: "line", p: line.p, q: line.q };
    const k = circle.radius * circle.radius / (d * d);
    const p = {
      x: circle.center.x + k * (n.x - circle.center.x),
      y: circle.center.y + k * (n.y - circle.center.y),
    };
    return {
      kind: "circle",
      center: { x: (p.x + circle.center.x) / 2, y: (p.y + circle.center.y) / 2 },
      radius: dist(p, circle.center) / 2,
    };
  }

  /** InvLine.InvertCinC: image of a circle in the inversion circle. */
  function invertCircle(c, circle) {
    const power = sqDist(c.center, circle.center) - c.radius * c.radius;
    if (Math.abs(power) > 100) {
      const k = circle.radius * circle.radius / power;
      return {
        kind: "circle",
        center: {
          x: circle.center.x + k * (c.center.x - circle.center.x),
          y: circle.center.y + k * (c.center.y - circle.center.y),
        },
        radius: Math.abs(k) * c.radius,
      };
    }
    // A circle exactly through O inverts to a line. The applet approximates
    // that limit by the tangent at the inverted antipode; the page's claim
    // about two *parallel* lines needs the exact limit, so use it when the
    // centre lies on the inversion circle to numerical precision.
    const powerExact = 1e-9 * c.radius * c.radius;
    if (Math.abs(power) <= powerExact) {
      const n = { x: c.center.x - circle.center.x, y: c.center.y - circle.center.y };
      const len2 = sqDist(c.center, circle.center);
      if (len2 > EPS) {
        const t = circle.radius * circle.radius / (2 * len2);
        const base = { x: circle.center.x + t * n.x, y: circle.center.y + t * n.y };
        const scale = 200 / Math.sqrt(len2);
        return {
          kind: "line",
          p: { x: base.x - scale * n.y, y: base.y + scale * n.x },
          q: { x: base.x + scale * n.y, y: base.y - scale * n.x },
        };
      }
    }
    // The applet's near-degenerate branch for a circle merely close to O:
    // invert the antipode and draw the tangent there.
    const far = {
      x: 2 * c.center.x - circle.center.x,
      y: 2 * c.center.y - circle.center.y,
    };
    const p = invertPoint(circle, far);
    if (!Number.isFinite(p.x)) return { kind: "none" };
    return {
      kind: "line",
      p: p,
      q: { x: p.x + 100 * (p.y - circle.center.y), y: p.y - 100 * (p.x - circle.center.x) },
    };
  }

  /** DrawCircle: circle through T and E, tangent to the vertical line at T. */
  function tangentCircle(T, E) {
    const mid = { x: (E.x + T.x) / 2, y: (E.y + T.y) / 2 };
    const perp = { x: mid.x + E.y - T.y, y: mid.y - (E.x - T.x) };
    const horizontal = { x: T.x + 100, y: T.y };
    const centre = intersect(mid, perp, T, horizontal);
    if (!Number.isFinite(centre.x)) return { center: centre, radius: 0 };
    return { center: centre, radius: Math.abs(centre.x - T.x) };
  }

  /** The (finite) circle through three points, or null when they are collinear. */
  function circumcircle(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-7) return null;
    const a2 = sqDist(a, { x: 0, y: 0 });
    const b2 = sqDist(b, { x: 0, y: 0 });
    const c2 = sqDist(c, { x: 0, y: 0 });
    const centre = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
    return { center: centre, radius: dist(centre, a) };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The starting position, transcribed from Canvas.init (600 by 450). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const A = { x: width * 2 / 5, y: height * 9 / 25 };
    const B = { x: width * 4 / 5, y: height / 5 };
    const E = { x: (4 * A.x + 3 * B.x) / 7, y: (4 * A.y + 3 * B.y) / 7 };
    const O = { x: width * 5 / 8, y: height * 5 / 8 };
    const R = { x: 7 * (width / 2) / 8, y: height * 3 / 4 };
    const s = { width, height, A, B, E, O, R, inverted: !!o.inverted };
    return s;
  }

  /**
   * Move a named point. Bytecode details: E is RestrictToLine(AB), so a drag
   * lands on the foot of the perpendicular to AB; after A or B moves, AdjustE
   * re-solves E.y from its unchanged x and the slope of AB.
   */
  function setPoint(state, name, q) {
    const s = {
      width: state.width, height: state.height,
      A: { ...state.A }, B: { ...state.B }, E: { ...state.E },
      O: { ...state.O }, R: { ...state.R }, inverted: state.inverted,
    };
    if (name === "E") s.E = foot(q, s.A, s.B);
    else if (name === "A" || name === "B" || name === "O" || name === "R") {
      s[name] = { x: clamp(q.x, 12, s.width - 12), y: clamp(q.y, 12, s.height - 12) };
      if (name === "A" || name === "B") {
        if (Math.abs(s.A.x - s.B.x) < 0.1) s.E.y = (s.A.y + s.B.y) / 2;
        else s.E.y = s.B.y + (s.A.y - s.B.y) / (s.A.x - s.B.x) * (s.E.x - s.B.x);
      }
    }
    return s;
  }

  /** Set the "Inverted diagram" tick without changing any geometry. */
  function setInverted(state, on) {
    return { ...state, E: { ...state.E }, A: { ...state.A }, B: { ...state.B },
      O: { ...state.O }, R: { ...state.R }, inverted: !!on };
  }

  /** The state the tutor saves: the five draggable points, in board units. */
  function position(state) {
    return { A: state.A, B: state.B, E: state.E, O: state.O, R: state.R,
      inverted: state.inverted };
  }

  /** Everything the page draws and checks, derived from a position. */
  function geometry(state) {
    const { A, B, E, O, R, width, height } = state;
    const inversion = { center: O, radius: dist(O, R) };
    const lineA = { p: { x: A.x, y: 0 }, q: { x: A.x, y: height } };
    const lineB = { p: { x: B.x, y: 0 }, q: { x: B.x, y: height } };
    const lineAB = { p: A, q: B };
    const cA = tangentCircle(A, E);
    const cB = tangentCircle(B, E);

    const imgLineA = invertLine(lineA, inversion);
    const imgLineB = invertLine(lineB, inversion);
    const imgLineAB = invertLine(lineAB, inversion);
    const imgCA = invertCircle(cA, inversion);
    const imgCB = invertCircle(cB, inversion);

    // The point at infinity where the two parallel lines touch inverts to O.
    const A2 = invertPoint(inversion, A);
    const E2 = invertPoint(inversion, E);
    const B2 = invertPoint(inversion, B);
    const through = circumcircle(O, A2, E2);
    const concyclic = through
      ? Math.abs(dist(through.center, B2) - through.radius) <= 1e-6 * Math.max(1, through.radius)
      : Math.abs((B2.x - A2.x) * (O.y - A2.y) - (B2.y - A2.y) * (O.x - A2.x))
        <= 1e-6 * Math.max(1, dist(A2, B2));

    // A, E and B are on AB; the fourth contact is its point at infinity.
    const onAB = Math.abs((E.x - A.x) * (B.y - A.y) - (E.y - A.y) * (B.x - A.x))
      <= 1e-6 * Math.max(1, dist(A, B));

    return {
      A, B, E, O, R, width, height, inversion,
      lineA, lineB, lineAB, cA, cB,
      imgLineA, imgLineB, imgLineAB, imgCA, imgCB,
      invertedPoints: { A: A2, E: E2, B: B2, infinity: O },
      through, concyclic, onAB,
      // The two line-circle contacts are external. cA and cB touch externally
      // when E lies between A and B, internally otherwise; the parallel pair
      // touches at infinity, where the type depends on the point of view. The
      // page's parity statement is tested on a family of four *finite* circles
      // in porting/check-four-touching-circles.mjs instead.
      externalFinite: (E.x - A.x) * (E.x - B.x) < 0 ? 3 : 2,
      valid: Number.isFinite(cA.radius) && cA.radius > 0 &&
             Number.isFinite(cB.radius) && cB.radius > 0 && inversion.radius > 0,
    };
  }

  return { WIDTH, HEIGHT, start, setPoint, setInverted, position, geometry,
    // Exposed for the logic test's second transcription of the bytecode.
    _internals: { dist, sqDist, intersect, foot, invertPoint, invertLine,
      invertCircle, tangentCircle, circumcircle } };
})();
