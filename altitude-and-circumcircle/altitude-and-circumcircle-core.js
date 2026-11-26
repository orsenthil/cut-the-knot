"use strict";

/*
 * Altitude And Circumcircle — the geometry behind Alexander Bogomolny's applet
 * AltitudeAndCircumcircle (cut-the-knot.org/Curriculum/Geometry/AltitudeAndCircumcircle.shtml).
 *
 * Three corners of a triangle can be dragged. The applet draws the circumcircle,
 * the feet of the altitudes (Ha, Hb, Hc), their meeting point H, and the points
 * Ka, Kb, Kc obtained by extending each altitude an equal distance past its
 * foot: Ka = 2*Ha - H. The theorem on the page is that those three reflections
 * of H in the side lines lie on the circumcircle; the foot Ha is the midpoint
 * of H and Ka, so HH_a = H_a K_a. Its "extra circle" option draws the circle
 * through H, B and C — the circumcircle reflected in BC — and the point S,
 * the reflection of A in Ha, which lies on that circle.
 *
 * This is the logic only: no document, no window, no storage. It defines one
 * global, AltitudeAndCircumcircleCore. Positions are plain data (points, four
 * option flags and counters), so the page and the tutor can share them.
 */

const AltitudeAndCircumcircleCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 240;
  const CENTER = { x: 180, y: 120 };
  // The applet puts its three corners on a circle of radius min(w,h)/4 at
  // angles -1.6, -4.0 and -0.2 radians (AltitudeAndCircumcircleCanvas.init).
  // Our viewBox is larger than the applet's, so the same angles use 72 units.
  const SCALE = 72;
  const START_ANGLES = { A: -1.6, B: -4.0, C: -0.2 };
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showNames", "showHint", "showAltitudes", "showCircle"];

  /* ---------------------------------------------------- small vector helpers */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: Math.max(6, Math.min(WIDTH - 6, round(p.x))),
    y: Math.max(6, Math.min(HEIGHT - 6, round(p.y))),
  });

  /** Foot of the perpendicular from p to line(a,b) — Geom.foot, in board units. */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (len2 === 0) return { x: a.x, y: a.y };
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /** Intersection of line(a,b) with line(c,d), or null if they are parallel. */
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-12) return null;
    return add(a, mul(r, cross(sub(c, a), s) / den));
  }

  /**
   * Circumcenter the way the applet does it (GeoSDoub.FindCircumcenter): build
   * the midpoints of AB and BC, push each along a perpendicular to its side,
   * and intersect the two bisectors.
   */
  function circumcenter(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
    const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
    return lineIntersection(ab, p, bc, q);
  }

  /**
   * The applet's DoubCircle: its center is the circumcenter and its radius is
   * the mean of the three distances to the corners (GetCircle).
   */
  function circumcircle(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!finite(center)) return null;
    return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
  }

  /** The applet's Extend(p,q): the reflection of p in q, i.e. 2q - p. */
  function reflect(p, q) {
    return { x: 2 * q.x - p.x, y: 2 * q.y - p.y };
  }

  /** Angle at v between the rays to p and q, in radians in [0, PI]. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb))));
  }

  /** Signed area, twice the triangle's area; 0 means the corners are in a line. */
  function twiceArea(a, b, c) {
    return cross(sub(b, a), sub(c, a));
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's option defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.A), y: CENTER.y + SCALE * Math.sin(START_ANGLES.A) }),
      B: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.B), y: CENTER.y + SCALE * Math.sin(START_ANGLES.B) }),
      C: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.C), y: CENTER.y + SCALE * Math.sin(START_ANGLES.C) }),
      showNames: true,   // the applet's ShowNames parameter defaults to "1"
      showHint: false,   // the other three checkboxes start unticked
      showAltitudes: false,
      showCircle: false,
      moves: 0,
      explored: false,
    };
    for (const name of NAMES) {
      if (o[name] && finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** The whole construction at a position, or { degenerate: true }. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finite) || Math.abs(twiceArea(A, B, C)) < 1e-6) {
      return { degenerate: true };
    }
    const circle = circumcircle(A, B, C);
    if (!circle) return { degenerate: true };
    const Ha = foot(A, B, C), Hb = foot(B, A, C), Hc = foot(C, B, A);
    const H = lineIntersection(A, Ha, B, Hb);
    if (!finite(H)) return { degenerate: true };
    const Ka = reflect(H, Ha), Kb = reflect(H, Hb), Kc = reflect(H, Hc);
    const S = reflect(A, Ha);
    return {
      degenerate: false,
      O: circle.center, r: circle.radius, circle,
      feet: { a: Ha, b: Hb, c: Hc },
      H,
      refs: { a: Ka, b: Kb, c: Kc },
      S,
      circleHBC: circumcircle(H, B, C),
      circles: {
        ABC: circle,
        ABH: circumcircle(A, B, H),
        BCH: circumcircle(B, C, H),
        CAH: circumcircle(C, A, H),
      },
    };
  }

  /**
   * The page calls Ka the second point in which AH_a meets the circumcircle.
   * Solving the line/circle intersection gives another transcription of the
   * same point; it must agree with the applet's Extend(H, Ha).
   */
  function secondAltitudePoint(a, footPoint, circle) {
    const d = sub(footPoint, a);
    const len2 = dot(d, d);
    if (!len2) return { x: NaN, y: NaN };
    const t = (2 * dot(sub(circle.center, a), d)) / len2;
    return add(a, mul(d, t));
  }

  /** Residuals behind the claims on the page, for the logic test and status. */
  function residuals(state, g) {
    if (g.degenerate) return null;
    const { A, B, C } = state;
    const { a: Ha, b: Hb, c: Hc } = g.feet;
    const { a: Ka, b: Kb, c: Kc } = g.refs;
    const perp = (p, footPoint, x, y) => Math.abs(dot(sub(p, footPoint), sub(y, x))) / (dist(x, y) || 1);
    return {
      altitude: Math.max(perp(A, Ha, B, C), perp(B, Hb, A, C), perp(C, Hc, B, A)),
      collinearH: Math.max(
        Math.abs(cross(sub(g.H, A), sub(Ha, A))),
        Math.abs(cross(sub(g.H, B), sub(Hb, B))),
        Math.abs(cross(sub(g.H, C), sub(Hc, C))),
      ),
      bisected: Math.max(
        dist(midpoint(g.H, Ka), Ha), dist(midpoint(g.H, Kb), Hb), dist(midpoint(g.H, Kc), Hc),
      ),
      concyclic: Math.max(
        Math.abs(dist(g.O, Ka) - g.r), Math.abs(dist(g.O, Kb) - g.r), Math.abs(dist(g.O, Kc) - g.r),
      ),
      secondPoint: Math.max(
        dist(Ka, secondAltitudePoint(A, Ha, g.circle)),
        dist(Kb, secondAltitudePoint(B, Hb, g.circle)),
        dist(Kc, secondAltitudePoint(C, Hc, g.circle)),
      ),
      // In a right triangle H is a corner, so two of these "circles" have
      // collinear points and do not exist; only the existing ones are compared.
      equalCircles: Math.max(0, ...[g.circles.ABH, g.circles.BCH, g.circles.CAH, g.circleHBC]
        .filter(Boolean).map((c) => Math.abs(c.radius - g.r))),
      SOnCircleHBC: g.circleHBC ? Math.abs(dist(g.circleHBC.center, g.S) - g.circleHBC.radius) : Infinity,
    };
  }

  /* ----------------------------------------------------------- moves / demo */

  /** The moves a player can make: drag a corner, tick a box, or reset. */
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
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < 12)) return null;
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

  /** A picture has nothing to win: it counts as played once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, CENTER, SCALE, START_ANGLES, NAMES, OPTION_KEYS,
    add, sub, mul, dot, cross, dist, midpoint, finite, foot, lineIntersection,
    circumcenter, circumcircle, reflect, angleAt, twiceArea,
    start, compute, secondAltitudePoint, residuals, legalMoves, move, result,
  };
})();
