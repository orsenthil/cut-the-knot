"use strict";

/*
 * Brahmagupta's theorem, from Alexander Bogomolny's applet Brahmagupta
 * (classes/Brahmagupta.zip, BrahmaguptaCanvas.DrawQuadri).
 *
 * Two points A and D can be dragged around a circle. The applet keeps their
 * partners on the same circle: B is D reflected in the vertical diameter and
 * C is A reflected in the horizontal diameter (GetOtherH and GetOtherV use
 * GeoSDoub.NearestPoint to find those diameter crossings). So the diagonals
 * AC and BD are always vertical and horizontal, and meet at right angles at
 * T. Q is the midpoint of BC and E is where the line QT crosses AD.
 *
 * The key fact the applet illustrates is Brahmagupta's theorem: the line from
 * the crossing of perpendicular diagonals to the middle of one side is
 * perpendicular to the opposite side. Equivalently, the line QT meets AD at
 * right angles at E, and the same holds for the other three sides. The four
 * such lines all pass through T. Brahmagupta's area formula,
 * S = sqrt((s-a)(s-b)(s-c)(s-d)), holds for every cyclic quadrilateral.
 *
 * Coordinates are the applet's canvas coordinates (y grows downwards): the
 * canvas is 500x400, its circle is centred at (250, 200) with radius
 * min(width, height)/3. This file is the game's logic and nothing else: no
 * document, no window, no storage. It defines one global, BrahmaguptaCore.
 */
const BrahmaguptaCore = (() => {
  const APPLET = { width: 500, height: 400, mirrorReach: 200, degenerate: 1 };
  const EPS = 1e-12;

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const mul = (p, k) => pt(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const pointOnCircle = (c, r, angle) => pt(c.x + r * Math.cos(angle), c.y + r * Math.sin(angle));

  const CENTER = pt(APPLET.width / 2, APPLET.height / 2);
  const RADIUS = Math.min(APPLET.width, APPLET.height) / 3;
  const START = { A: -2, D: 0.2 };

  /** GeoSDoub.NearestPoint: project `point` onto the line p -> q. */
  function nearestPoint(point, p, q) {
    if ((point.x - p.x) ** 2 + (point.y - p.y) ** 2 < 0.1) return { ...point };
    const dx = q.x - p.x, dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { ...point };
    const t = ((point.x - p.x) * dx + (point.y - p.y) * dy) / len2;
    return pt(p.x + dx * t, p.y + dy * t);
  }

  /** GeoSDoub.Intersect, with the applet's |denominator| < 1 guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < APPLET.degenerate) return null;
    return pt((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
  }

  /** The position a new illustration starts from, straight from init(). */
  function start() {
    return {
      center: { ...CENTER },
      r: RADIUS,
      A: pointOnCircle(CENTER, RADIUS, START.A),
      D: pointOnCircle(CENTER, RADIUS, START.D),
    };
  }

  /**
   * Drag one of the two handles. CTKMoveableDoub.UpdateLocation projects the
   * pointer onto the circle radially; keep that exact rule. A pointer at the
   * centre has no direction, so the applet's division would be undefined: the
   * position is left alone there.
   */
  function withPoint(state, which, p) {
    if (which !== "A" && which !== "D") return state;
    const c = state.center;
    const dx = p.x - c.x, dy = p.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return state;
    return {
      center: { ...state.center },
      r: state.r,
      A: which === "A" ? pt(c.x + state.r * dx / len, c.y + state.r * dy / len) : { ...state.A },
      D: which === "D" ? pt(c.x + state.r * dx / len, c.y + state.r * dy / len) : { ...state.D },
    };
  }

  /** The same projection, used by the page as a handle clamp. */
  function project(state, p) {
    const c = state.center;
    const dx = p.x - c.x, dy = p.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return { ...state.A };
    return pt(c.x + state.r * dx / len, c.y + state.r * dy / len);
  }

  /**
   * DrawQuadri, transcribed. Every point is in canvas/SVG units. `null`
   * points mean the applet's construction degenerated for this drag.
   */
  function configuration(state) {
    const O = state.center;
    const A = state.A, D = state.D;

    // GetOtherH(D, "B"): reflect D in the vertical diameter.
    const h = nearestPoint(O, D, pt(D.x + APPLET.mirrorReach, D.y));
    const B = pt(2 * h.x - D.x, D.y);

    // GetOtherV(A, "C"): reflect A in the horizontal diameter.
    const v = nearestPoint(O, A, pt(A.x, A.y + APPLET.mirrorReach));
    const C = pt(A.x, 2 * v.y - A.y);

    const T = intersect(A, C, B, D);
    const Q = midpoint(B, C);
    const E = T ? intersect(Q, T, A, D) : null;
    return { center: O, r: state.r, A, B, C, D, T, Q, E, circle: { center: O, r: state.r } };
  }

  /** Side lengths AB, BC, CD, DA and the semiperimeter (the page's a,b,c,d,s). */
  function sides(g) {
    const a = distance(g.A, g.B), b = distance(g.B, g.C);
    const c = distance(g.C, g.D), d = distance(g.D, g.A);
    return { a, b, c, d, s: (a + b + c + d) / 2 };
  }

  /** Twice the signed area of a polygon, then half its absolute value. */
  function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }

  /**
   * Whether A, B, C, D go around the circle in order, i.e. the outline is a
   * convex quadrilateral. Brahmagupta's theorem is stated for that case; if a
   * drag crosses the outline the perpendiculars still hold, but the shoelace
   * area of the crossed path is no longer the area of a quadrilateral.
   */
  function ordered(state) {
    const g = configuration(state);
    const path = [g.A, g.B, g.C, g.D];
    let sign = 0;
    for (let i = 0; i < path.length; i++) {
      const u = sub(path[(i + 1) % 4], path[i]);
      const v = sub(path[(i + 2) % 4], path[(i + 1) % 4]);
      const turn = u.x * v.y - u.y * v.x;
      if (Math.abs(turn) < 1e-9 * state.r * state.r) return false;
      if (sign && Math.sign(turn) !== sign) return false;
      sign = Math.sign(turn);
    }
    return true;
  }

  /** Brahmagupta's formula and the measured area of the same quadrilateral. */
  function formula(g) {
    const m = sides(g);
    const product = (m.s - m.a) * (m.s - m.b) * (m.s - m.c) * (m.s - m.d);
    const S = Math.sqrt(Math.max(0, product));
    const measured = area([g.A, g.B, g.C, g.D]);
    return { ...m, S, measured, holds: Math.abs(S - measured) < 1e-9 * Math.max(1, measured) };
  }

  return {
    APPLET, CENTER, RADIUS, START,
    pt, add, sub, mul, dot, distance, midpoint, pointOnCircle,
    nearestPoint, intersect, start, withPoint, project, configuration, ordered, sides, area, formula,
  };
})();
