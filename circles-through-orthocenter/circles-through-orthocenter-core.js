"use strict";

/*
 * Circles Through the Orthocenter — the geometry behind Alexander Bogomolny's
 * applet CirclesThroughOrthocenter (cut-the-knot.org/Curriculum/Geometry/
 * CirclesThroughOrthocenter.shtml), which illustrates Problem 1 of the 2008 IMO.
 *
 * ABC is a triangle with orthocenter H. For each side, take the circle centred
 * at the side's midpoint M_a (etc.) that passes through H. It cuts the line BC
 * at A1 and A2, and likewise on the other two sides. The theorem says the six
 * points are concyclic. The circle is centred at the circumcenter O of ABC:
 * since OM_a is perpendicular to BC, OA1^2 = OM_a^2 + M_aA1^2 = s_a^2 + r_a^2,
 * and the page's equations (1) and (3) make that the same for all three sides.
 * The page also notes that "acute-angled" is a red herring: the six points are
 * concyclic for every non-degenerate triangle.
 *
 * The construction here follows the applet's bytecode literally:
 * GeoSDoub.FindAltitude for the feet, Intersect(A,H_a,B,H_b) for H, Midpoint
 * and Dist for the three circles, GeoSDoub.Intersect(DoubCircle,DoubLine) with
 * its IntersectX/IntersectY branches for the six points, and Canvas.GetCircle
 * (the mean of the three distances from a circumcenter) for the drawn circle.
 * porting/check-circles-through-orthocenter.mjs transcribes those methods a
 * second time and compares them on hundreds of triangles.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, CirclesThroughOrthocenterCore, so the page loads it with a plain
 * <script> and the Node logic test can load it too. Positions are plain data —
 * three draggable points, two display flags and counters — so the page and the
 * tutor can share them. Functions never change the position they are given.
 */
const CirclesThroughOrthocenterCore = (() => {
  const WIDTH = 360;   // viewBox width, in board units
  const HEIGHT = 240;  // viewBox height
  const MARGIN = 6;
  const MIN_GAP = 12;  // two corners closer than this cannot make a triangle
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showNames", "showHint"];

  /* The applet's Canvas.init() puts its corners at (w/5, 2h/3),
     (3w/4, 2h/3) and (9w/22, h/7) of its canvas. */
  function opening() {
    return {
      A: { x: WIDTH / 5, y: 2 * HEIGHT / 3 },
      B: { x: 3 * WIDTH / 4, y: 2 * HEIGHT / 3 },
      C: { x: 9 * WIDTH / 22, y: HEIGHT / 7 },
    };
  }

  /* ------------------------------------------------------- vector helpers */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const reflect = (p, q) => ({ x: 2 * q.x - p.x, y: 2 * q.y - p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: round(clamp(p.x, MARGIN, WIDTH - MARGIN)),
    y: round(clamp(p.y, MARGIN, HEIGHT - MARGIN)),
  });
  const o0 = opening();
  const DEFAULT = { A: clampPoint(o0.A), B: clampPoint(o0.B), C: clampPoint(o0.C) };

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.FindAltitude(a,b,c): where the altitude from a meets line bc. */
  function altitudeFoot(a, b, c) {
    const q = { x: a.x + c.y - b.y, y: a.y - (c.x - b.x) };
    return intersect(a, q, b, c);
  }

  /** GeoSDoub.FindCircumcenter(a,b,c), via two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
    const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
    return intersect(ab, p, bc, q);
  }

  /** Canvas.GetCircle(a,b,c): the circumcenter and the mean of the radii. */
  function getCircle(a, b, c) {
    const centre = circumcenter(a, b, c);
    if (!finite(centre)) return null;
    return { c: centre, r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
  }

  /* GeoSDoub.Intersect(DoubCircle,DoubLine) sends a line with a big y-difference
     to IntersectX (solve for y, then x = m*y + b) and otherwise, when the
     x-difference is big, to IntersectY (solve for x). */
  function intersectX(p, q, circle) {
    const m = (p.x - q.x) / (p.y - q.y);
    const b = q.x - m * q.y;
    const aa = m * m + 1;
    const bb = 2 * (m * (b - circle.c.x) - circle.c.y);
    const cc = circle.c.y * circle.c.y + (b - circle.c.x) ** 2 - circle.r * circle.r;
    const disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y0 = (-bb + s) / (2 * aa), y1 = (-bb - s) / (2 * aa);
    return [{ x: m * y0 + b, y: y0 }, { x: m * y1 + b, y: y1 }];
  }

  function intersectY(p, q, circle) {
    const m = (p.y - q.y) / (p.x - q.x);
    const b = q.y - m * q.x;
    const aa = m * m + 1;
    const bb = 2 * (m * (b - circle.c.y) - circle.c.x);
    const cc = circle.c.x * circle.c.x + (b - circle.c.y) ** 2 - circle.r * circle.r;
    const disc = bb * bb - 4 * aa * cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const x0 = (-bb + s) / (2 * aa), x1 = (-bb - s) / (2 * aa);
    return [{ x: x0, y: m * x0 + b }, { x: x1, y: m * x1 + b }];
  }

  function circleLine(circle, p, q) {
    if (Math.abs(p.y - q.y) > 1) return intersectX(p, q, circle);
    if (Math.abs(p.x - q.x) > 1) return intersectY(p, q, circle);
    return null;
  }

  /**
   * The second point where two circles meet, given one point `known` they
   * share (here H). Reflecting it in the line of centres is exact for two
   * circles through the point, and is what Canvas.Other picks from
   * GeoSDoub.Intersect(circle,circle).
   */
  function otherCirclePoint(c1, c2, known) {
    const d = sub(c2.c, c1.c);
    const len2 = dot(d, d);
    if (len2 < 1e-12) return null;
    const footOnCentres = add(c1.c, mul(d, dot(sub(known, c1.c), d) / len2));
    return reflect(known, footOnCentres);
  }

  /** Signed twice the area: zero means the corners lie in a straight line. */
  function twiceArea(a, b, c) {
    return cross(sub(b, a), sub(c, a));
  }

  /* ------------------------------------------------------------- position */

  /** The opening picture, with the applet's option defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: clampPoint(o.A && finite(o.A) ? o.A : DEFAULT.A),
      B: clampPoint(o.B && finite(o.B) ? o.B : DEFAULT.B),
      C: clampPoint(o.C && finite(o.C) ? o.C : DEFAULT.C),
      showNames: o.showNames !== false, // the applet's ShowNames parameter is "1"
      showHint: !!o.showHint,
      moves: 0,
      explored: false,
    };
    return state;
  }

  /** The whole construction at a position, or { degenerate: true }. */
  function compute(state) {
    if (!state || ![state.A, state.B, state.C].every(finite)) {
      return { degenerate: true, reason: "corners" };
    }
    const A = state.A, B = state.B, C = state.C;
    if (Math.abs(twiceArea(A, B, C)) < 1e-6) {
      return { degenerate: true, reason: "line" };
    }
    // Canvas.Compute: the three feet, then H = Intersect(A,H_a,B,H_b).
    const Ha = altitudeFoot(A, B, C);
    const Hb = altitudeFoot(B, C, A);
    const Hc = altitudeFoot(C, A, B);
    const H = intersect(A, Ha, B, Hb);
    if (![Ha, Hb, Hc, H].every(finite)) return { degenerate: true, reason: "altitude" };

    // The three circles are centred at the side midpoints and pass through H.
    const Ma = midpoint(B, C), Mb = midpoint(C, A), Mc = midpoint(A, B);
    const r = { a: dist(Ma, H), b: dist(Mb, H), c: dist(Mc, H) };
    if (Math.min(r.a, r.b, r.c) < 1e-6) return { degenerate: true, reason: "radius" };
    const circles = {
      a: { c: Ma, r: r.a },
      b: { c: Mb, r: r.b },
      c: { c: Mc, r: r.c },
    };
    // AA, BB, CC: the six crossings with the side lines.
    const pairs = {
      A: circleLine(circles.a, B, C),
      B: circleLine(circles.b, C, A),
      C: circleLine(circles.c, A, B),
    };
    if (!pairs.A || !pairs.B || !pairs.C
      || ![pairs.A, pairs.B, pairs.C].every((pair) => pair.every(finite))) {
      return { degenerate: true, reason: "crossings" };
    }
    const six = [pairs.A[0], pairs.A[1], pairs.B[0], pairs.B[1], pairs.C[0], pairs.C[1]];

    // Canvas.GetCircle on one point of each pair, and on the triangle itself.
    // In a right triangle H is a vertex, so the applet's chosen three points
    // can coincide (e.g. B, A, B) and GetCircle has no circumcenter. The six
    // points are still concyclic; the page's circle is centred at O, which we
    // can always draw. Keep the quirk visible as circle === null.
    const circle = getCircle(pairs.A[0], pairs.B[0], pairs.C[0]);
    const circumcircle = getCircle(A, B, C);
    if (!circumcircle) return { degenerate: true, reason: "circle" };
    const O = circumcircle.c;
    const oa = sub(Ma, O);
    const theoremCircle = { c: O, r: Math.sqrt(r.a * r.a + dot(oa, oa)) };

    // The pairwise radical axes (drawn by the applet's ShowHint / Highlight).
    const radical = {
      ab: otherCirclePoint(circles.a, circles.b, H),
      bc: otherCirclePoint(circles.b, circles.c, H),
      ca: otherCirclePoint(circles.c, circles.a, H),
    };
    return {
      degenerate: false,
      feet: { a: Ha, b: Hb, c: Hc },
      H,
      mids: { a: Ma, b: Mb, c: Mc },
      radii: r,
      circles,
      pairs,
      six,
      circle,          // the applet's GetCircle, null when its three points coincide
      theoremCircle,   // the circle the page proves, always centred at O
      circumcircle,
      radical,
      O,
    };
  }

  /**
   * Residuals behind the page's claims. All are zero for a true theorem; the
   * logic test checks them over exact and random triangles, and the page shows
   * the largest gap so a player can see the six points agree.
   */
  function residuals(state, g) {
    if (g.degenerate || !state) return null;
    const { A, B, C } = state;
    const { H, mids, radii, six, circle, theoremCircle, O } = g;
    const Oa = sub(mids.a, O), Ob = sub(mids.b, O), Oc = sub(mids.c, O);
    const side = (p, x, y) => Math.abs(cross(sub(p, x), sub(y, x))) / (dist(x, y) || 1);
    const power = (c, p) => Math.abs(dist(c.c, p) ** 2 - c.r ** 2);
    return {
      // Every one of the six points is the same distance from O.
      concyclic: Math.max(...six.map((p) => Math.abs(dist(O, p) - theoremCircle.r))),
      // r_a^2 + s_a^2 = r_b^2 + s_b^2 = r_c^2 + s_c^2 (the page's (3)).
      equalRadii: Math.max(
        Math.abs(radii.a ** 2 + dot(Oa, Oa) - radii.b ** 2 - dot(Ob, Ob)),
        Math.abs(radii.b ** 2 + dot(Ob, Ob) - radii.c ** 2 - dot(Oc, Oc)),
      ),
      // (a/2)^2 - r_a^2 = (b/2)^2 - r_b^2 = (c/2)^2 - r_c^2 (the page's (1)).
      equalPowers: Math.max(
        Math.abs((dist(B, C) / 2) ** 2 - radii.a ** 2
          - (dist(C, A) / 2) ** 2 + radii.b ** 2),
        Math.abs((dist(C, A) / 2) ** 2 - radii.b ** 2
          - (dist(A, B) / 2) ** 2 + radii.c ** 2),
      ),
      // H has zero power in all three circles: it is their radical center.
      radicalCenter: Math.max(power(g.circles.a, H), power(g.circles.b, H), power(g.circles.c, H)),
      // The altitude feet are on their sides and H is on all three altitudes.
      altitudes: Math.max(
        side(g.feet.a, B, C), side(g.feet.b, C, A), side(g.feet.c, A, B),
        side(H, A, g.feet.a), side(H, B, g.feet.b), side(H, C, g.feet.c),
      ),
      // A1 and A2 lie on BC, and their midpoint is the circle's centre.
      crossings: Math.max(
        side(g.pairs.A[0], B, C), side(g.pairs.A[1], B, C),
        side(g.pairs.B[0], C, A), side(g.pairs.B[1], C, A),
        side(g.pairs.C[0], A, B), side(g.pairs.C[1], A, B),
        dist(midpoint(g.pairs.A[0], g.pairs.A[1]), mids.a),
        dist(midpoint(g.pairs.B[0], g.pairs.B[1]), mids.b),
        dist(midpoint(g.pairs.C[0], g.pairs.C[1]), mids.c),
      ),
      // The applet's drawn circle is centred at O, except for the right-angle
      // coincidence; null then means "the applet could not draw it".
      circleCentre: circle ? dist(circle.c, O) : 0,
    };
  }

  /* ------------------------------------------------------- moves / demo */

  /** Drag a corner, tick a display box, or reset the picture. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < MIN_GAP)) return null;
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

  /** A small arrow-key step for one corner. */
  function nudge(state, name, dx, dy) {
    const p = state[name];
    return finite(p) ? move(state, { type: "point", name, point: add(p, { x: dx, y: dy }) }) : null;
  }

  /** A demo has nothing to win: it counts as played once it has been explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /** compute(), named for the page's script. */
  function geometry(state) {
    return compute(state);
  }

  return {
    WIDTH, HEIGHT, MARGIN, MIN_GAP, NAMES, OPTION_KEYS, DEFAULT,
    add, sub, mul, dot, cross, dist, midpoint, reflect, finite, clamp, clampPoint,
    intersect, altitudeFoot, circumcenter, getCircle, intersectX, intersectY,
    circleLine, otherCirclePoint, twiceArea,
    start, compute, geometry, residuals, legalMoves, move, nudge, result,
  };
})();
