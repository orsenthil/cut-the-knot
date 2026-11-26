"use strict";

/*
 * Archimedes Quadruplets, from Alexander Bogomolny's applet
 * ArchimedesQuadruplets and the cut-the-knot article of the same name.
 *
 * An arbelos is a big semicircle on AB with two smaller semicircles on AC and
 * CB. Archimedes' two twin circles have radius t = r1*r2/(r1+r2). F. Power's
 * four circles are built at the tops D and E of the small semicircles: two
 * circles of radius x touch the line OD at D (and OE at E) and the big
 * semicircle. Solving OL = r - x with OL^2 = x^2 + OD^2 and OD^2 = r1^2+r2^2
 * gives exactly x = r1*r2/(r1+r2) = t: four more Archimedean circles, equal
 * in radius, so equal in area too.
 *
 * The Java applet's BigCircle object was built with radius |AB| = 2r rather
 * than the drawn semicircle's r = |AB|/2, which made its four circles half
 * the advertised size and put its tangency dots off the arc. This core follows
 * the article's explicit claim; porting/check-archimedes-quadruplets.mjs keeps
 * a literal transcription of the applet's arithmetic and checks the difference.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, ArchimedesQuadrupletsCore. The position is plain data: the x
 * coordinates of the three draggable points A, C and B on a fixed baseline.
 */

const ArchimedesQuadrupletsCore = (() => {
  // ArchimedesQuadrupletsCanvas.init: margin 20, w=360, h=240 -> A=(20,200),
  // B=(340,200) and the baseline sits at floor(5h/6). PointIsEligible keeps
  // the three points in the order A < C < B with a five-unit gap.
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 20;
  const BASE_Y = Math.floor(HEIGHT * 5 / 6);
  const DIAMETER = WIDTH - 2 * MARGIN;
  const EDGE = 5;
  const GAP = 5;

  // init(): C = 0.3*A.x + 0.7*B.x = 0.7 of the way from A to B (a harmless
  // leftover of the applet's weighting; kept so the port opens the same way).
  const START_AX = MARGIN;
  const START_BX = WIDTH - MARGIN;
  // (rounded from the double 0.3*20 + 0.7*340 = 243.99999999999997)
  const START_CX = 244;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const number = (v, fallback) => (Number.isFinite(v) ? v : fallback);

  /** Put any three x coordinates into the applet's eligible order. */
  function arrange(ax, bx, cx) {
    const a = number(ax, START_AX);
    const b = number(bx, START_BX);
    const c = number(cx, START_CX);
    const c2 = clamp(c, a + GAP, b - GAP);
    return {
      ax: clamp(a, EDGE, c2 - GAP),
      bx: clamp(b, c2 + GAP, WIDTH - EDGE),
      cx: c2,
    };
  }

  /** The starting position (or a caller's position, clamped the same way). */
  function start(options) {
    const o = options || {};
    return arrange(
      o.ax === undefined ? START_AX : o.ax,
      o.bx === undefined ? START_BX : o.bx,
      o.cx === undefined ? START_CX : o.cx);
  }

  /** Drag one of the three points along the baseline; the input is untouched. */
  function setPoint(state, name, x) {
    const s = start(state);
    const v = number(x, 0);
    if (name === "A") return { ax: clamp(v, EDGE, s.cx - GAP), bx: s.bx, cx: s.cx };
    if (name === "B") return { ax: s.ax, bx: clamp(v, s.cx + GAP, WIDTH - EDGE), cx: s.cx };
    if (name === "C") return { ax: s.ax, bx: s.bx, cx: clamp(v, s.ax + GAP, s.bx - GAP) };
    return s;
  }

  /** Whether PointIsEligible would accept this new x for the named point. */
  function eligible(state, name, x) {
    const s = start(state);
    if (!Number.isFinite(x)) return false;
    if (name === "A") return x > EDGE && x < s.cx;
    if (name === "B") return x > s.cx + GAP && x < WIDTH - EDGE;
    if (name === "C") return x > s.ax + GAP && x < s.bx - GAP;
    return false;
  }

  /** Everything the page draws and reports, derived from the three x's. */
  function geometry(state) {
    const s = start(state);
    const a = s.cx - s.ax;
    const b = s.bx - s.cx;
    const r1 = a / 2;
    const r2 = b / 2;
    const r = r1 + r2;
    const A = { x: s.ax, y: BASE_Y };
    const B = { x: s.bx, y: BASE_Y };
    const C = { x: s.cx, y: BASE_Y };
    const O = { x: (s.ax + s.bx) / 2, y: BASE_Y };
    const O1 = { x: (s.ax + s.cx) / 2, y: BASE_Y };
    const O2 = { x: (s.cx + s.bx) / 2, y: BASE_Y };
    // D and E are the highest points (the "midpoints of the arcs") of the
    // two small semicircles. The applet subtracts the radius from y.
    const D = { x: O1.x, y: BASE_Y - r1 };
    const E = { x: O2.x, y: BASE_Y - r2 };

    // The radius of Archimedes' twins, and of Power's four circles.
    const radius = r > 0 ? (r1 * r2) / r : 0;

    // GetPerp(P, O, x): from P, step x perpendicular to OP, on both sides.
    function perpPair(P) {
      const d = Math.hypot(P.x - O.x, P.y - O.y);
      if (!(d > 0)) return [{ x: P.x, y: P.y }, { x: P.x, y: P.y }];
      const s2 = radius / d;
      const vx = (P.y - O.y) * s2;
      const vy = (O.x - P.x) * s2;
      return [
        { x: P.x + vx, y: P.y + vy },
        { x: P.x - vx, y: P.y - vy },
      ];
    }

    // Extend(L, O, r/(r-x)): the tangency point on the big semicircle.
    function contact(L) {
      const d = Math.hypot(L.x - O.x, L.y - O.y);
      const f = d > 0 ? r / d : 1;
      return { x: O.x + (L.x - O.x) * f, y: O.y + (L.y - O.y) * f };
    }

    const leftCenters = perpPair(D);
    const rightCenters = perpPair(E);
    const left = leftCenters.map((c) => ({ center: c, contact: contact(c) }));
    const right = rightCenters.map((c) => ({ center: c, contact: contact(c) }));

    // The original twin circles, for the radius comparison: a twin touches
    // the upright through C, its small semicircle and the big semicircle.
    const twinHeight1 = 2 * Math.sqrt(Math.max(0, r1 * radius));
    const twinHeight2 = 2 * Math.sqrt(Math.max(0, r2 * radius));
    const twins = [
      { center: { x: C.x - radius, y: BASE_Y - twinHeight1 }, radius: radius },
      { center: { x: C.x + radius, y: BASE_Y - twinHeight2 }, radius: radius },
    ];

    const circleArea = Math.PI * radius * radius;
    return {
      a: a, b: b, r1: r1, r2: r2, r: r, radius: radius,
      A: A, B: B, C: C, O: O, O1: O1, O2: O2, D: D, E: E,
      left: left, right: right, twins: twins,
      od2: r1 * r1 + r2 * r2,
      ol2: (r1 * r1 + r2 * r2) + radius * radius,
      circleArea: circleArea,
      twinArea: circleArea,
      fourArea: 4 * circleArea,
    };
  }

  /** A compact, JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const s = start(state);
    const g = geometry(s);
    const round = (v) => Number(v.toFixed(6));
    return {
      A: { x: round(g.A.x), y: round(g.A.y) },
      C: { x: round(g.C.x), y: round(g.C.y) },
      B: { x: round(g.B.x), y: round(g.B.y) },
      r1: round(g.r1), r2: round(g.r2), r: round(g.r),
      radius: round(g.radius), circleArea: round(g.circleArea),
      D: { x: round(g.D.x), y: round(g.D.y) },
      E: { x: round(g.E.x), y: round(g.E.y) },
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MARGIN: MARGIN, BASE_Y: BASE_Y,
    DIAMETER: DIAMETER, EDGE: EDGE, GAP: GAP,
    START_AX: START_AX, START_BX: START_BX, START_CX: START_CX,
    arrange: arrange, start: start, setPoint: setPoint, eligible: eligible,
    geometry: geometry, position: position,
  };
})();
