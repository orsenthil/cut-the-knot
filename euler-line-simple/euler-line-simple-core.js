"use strict";

/*
 * Euler Line Simple — the geometry behind Alexander Bogomolny's applet
 * EulerLineSimple (cut-the-knot.org/Curriculum/Geometry/EulerLineSimple.shtml).
 *
 * Three corners of a triangle can be dragged. The applet computes the feet of
 * the altitudes (Ha, Hb, Hc), their meeting point H, the centroid G, the
 * circumcircle (center O, radius the mean of its three distances), and the
 * antipodes D, E, F obtained with CTKGeometryPlus.Prorate(point, circle,
 * 2*distance) — that is 2*O - vertex. With the Hint switch on, choosing or
 * dragging a vertex shades the parallelogram made by the other two vertices,
 * H and that vertex's antipode; the page's proof uses C, F, A, B and the
 * midpoint Mc of AB.
 *
 * The claim on the page is: in any triangle H, G and O are collinear on the
 * Euler line and GH = 2*GO. The logic test checks this, and the parallelogram
 * and median facts behind the proof, on thousands of triangles.
 *
 * This is the logic only: no document, no window, no storage. It defines one
 * global, EulerLineSimpleCore. Positions are plain data, so the page and the
 * tutor can share them.
 */

const EulerLineSimpleCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 240;
  const CENTER = { x: 180, y: 120 };
  // EulerLineSimpleCanvas.init puts the corners at min(w,h)/4 from the
  // center, at angles -1.6, -4.0 and -0.2 radians. Our viewBox uses 72 units.
  const SCALE = 72;
  const START_ANGLES = { A: -1.6, B: -4.0, C: -0.2 };
  const NAMES = ["A", "B", "C"];
  // The order of EulerLineSimplePanel's checkboxes: altitudes, medians,
  // perpendicular bisectors, hint, names.
  const OPTION_KEYS = ["showAltitudes", "showMedians", "showBisectors", "showHint", "showNames"];
  // Which vertex drives the highlighted parallelogram.
  const ANTIPODE = { A: "D", B: "E", C: "F" };
  const MIDPOINT = { A: "Ma", B: "Mb", C: "Mc" };

  /* ---------------------------------------------------- small vector helpers */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clampPoint = (p) => ({
    x: Math.max(6, Math.min(WIDTH - 6, Math.round(p.x * 1000) / 1000)),
    y: Math.max(6, Math.min(HEIGHT - 6, Math.round(p.y * 1000) / 1000)),
  });

  /** GeoSDoub.Intersect(P,Q,R,S), with the applet's |det| < 1 guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindAltitude(A,B,C): the foot of the altitude from A to BC. */
  function findAltitude(a, b, c) {
    const q = { x: a.x + (c.y - b.y), y: a.y - (c.x - b.x) };
    return intersect(a, q, b, c);
  }

  /** GeoSDoub.FindCircumcenter(A,B,C): two perpendicular bisectors meet. */
  function findCircumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const p = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const q = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p, m2, q);
  }

  /** EulerLineSimpleCanvas.GetCircle: radius is the mean of the three radii. */
  function getCircle(a, b, c) {
    const center = findCircumcenter(a, b, c);
    return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
  }

  /** CTKGeometryPlus.Prorate(p, center, scale), including its 0.1 guard. */
  function prorate(p, center, scale) {
    const d = dist(p, center);
    if (d < 0.1) return { x: p.x, y: p.y };
    const f = scale / d;
    return { x: p.x + f * (center.x - p.x), y: p.y + f * (center.y - p.y) };
  }

  /** The applet's Extend(p,q) = 2q - p, used by the proof's diagonal. */
  function extend(p, q) { return { x: 2 * q.x - p.x, y: 2 * q.y - p.y }; }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's option defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      A: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.A), y: CENTER.y + SCALE * Math.sin(START_ANGLES.A) }),
      B: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.B), y: CENTER.y + SCALE * Math.sin(START_ANGLES.B) }),
      C: clampPoint({ x: CENTER.x + SCALE * Math.cos(START_ANGLES.C), y: CENTER.y + SCALE * Math.sin(START_ANGLES.C) }),
      showAltitudes: false,
      showMedians: false,
      showBisectors: false,
      showHint: false,
      showNames: true,   // the applet's ShowNames parameter defaults to "1"
      selected: null,    // the applet's Selected is null until a corner is pressed
      moves: 0,
      explored: false,
    };
    for (const name of NAMES) {
      if (o[name] && finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    if (NAMES.includes(o.selected)) state.selected = o.selected;
    return state;
  }

  /** EulerLineSimpleCanvas.Compute, as one plain-data construction. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    const Ma = midpoint(B, C), Mb = midpoint(C, A), Mc = midpoint(A, B);
    const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const Ha = findAltitude(A, B, C);
    const Hb = findAltitude(B, A, C);
    const Hc = findAltitude(C, B, A);
    const candidateH = intersect(A, Ha, B, Hb);
    // The applet keeps its old H when the intersection is null or NaN; at the
    // start of a fresh draw there is none, so the picture has no Euler line.
    const H = finite(candidateH) ? candidateH : null;
    const circle = getCircle(A, B, C);
    const O = circle.center;
    const D = prorate(A, O, 2 * dist(A, O));
    const E = prorate(B, O, 2 * dist(B, O));
    const F = prorate(C, O, 2 * dist(C, O));
    const degenerate = !H || ![O, D, E, F].every(finite) || !Number.isFinite(circle.radius)
      || Math.abs(cross(sub(B, A), sub(C, A))) < 1e-6;
    return {
      degenerate, A, B, C, Ma, Mb, Mc, G, Ha, Hb, Hc, H, O, r: circle.radius,
      D, E, F, antipodes: { A: D, B: E, C: F }, midpoints: { A: Ma, B: Mb, C: Mc },
      feet: { A: Ha, B: Hb, C: Hc },
    };
  }

  /** Residuals behind the page's claims, for the logic test and the status. */
  function residuals(state, g) {
    if (g.degenerate) return null;
    const { A, B, C } = g;
    const side = { A: [B, C], B: [A, C], C: [A, B] };
    const foot = { A: g.Ha, B: g.Hb, C: g.Hc };
    const anti = { A: g.D, B: g.E, C: g.F };
    const mids = { A: g.Ma, B: g.Mb, C: g.Mc };
    const lineDist = (p, a, b) => Math.abs(cross(sub(p, a), sub(b, a))) / (dist(a, b) || 1);
    const antipodeError = Math.max(...NAMES.map((n) => dist(anti[n], extend(g[n], g.O))));
    const antipodeOnCircle = Math.max(...NAMES.map((n) => Math.abs(dist(g.O, anti[n]) - g.r)));
    const medianRatio = Math.max(...NAMES.map((n) => {
      const expected = add(g[n], mul(sub(mids[n], g[n]), 2 / 3));
      return dist(g.G, expected);
    }));
    return {
      altitudePerp: Math.max(...NAMES.map((n) => {
        const [p, q] = side[n];
        return Math.abs(dot(sub(g[n], foot[n]), sub(q, p))) / (dist(p, q) || 1);
      })),
      HOnAltitudes: Math.max(...NAMES.map((n) => lineDist(g.H, g[n], foot[n]))),
      HOnOtherAltitudes: Math.max(...NAMES.map((n) => {
        const [p, q] = side[n];
        return lineDist(g.H, foot[n], g[n]);
      })),
      antipodeError,
      antipodeOnCircle,
      // Parallelogram: the two diagonals have the same midpoint.
      parallelogram: Math.max(...NAMES.map((n) =>
        dist(midpoint(g.H, anti[n]), mids[n]))),
      diagonalOnMedian: Math.max(...NAMES.map((n) => lineDist(mids[n], g.H, anti[n]))),
      // G is the centroid of triangle H, antipode, vertex — the same median
      // divided in the same 2:1 ratio in both triangles of the proof.
      centroidTwice: Math.max(...NAMES.map((n) => {
        const cen = { x: (g.H.x + anti[n].x + g[n].x) / 3, y: (g.H.y + anti[n].y + g[n].y) / 3 };
        return dist(cen, g.G);
      })),
      medianRatio,
      collinear: lineDist(g.G, g.O, g.H),
      ratioGH2GO: Math.abs(dist(g.G, g.H) - 2 * dist(g.G, g.O)),
      circleMean: Math.max(...NAMES.map((n) => Math.abs(dist(g.O, g[n]) - g.r))),
    };
  }

  /** The moves a player can make: drag a corner, tick a box, choose a vertex, reset. */
  function legalMoves(state) {
    return [
      ...NAMES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      ...NAMES.map((name) => ({ type: "select", name })),
      { type: "reset" },
    ];
  }

  /**
   * The position after a move, or null if the move is not allowed. Pressing a
   * corner selects it in the applet before the drag begins, so a point move
   * also sets `selected` to that corner.
   */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (NAMES.some((n) => n !== m.name && dist(p, state[n]) < 12)) return null;
      next = { ...state, [m.name]: p, selected: m.name };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "select") {
      if (!NAMES.includes(m.name)) return null;
      next = { ...state, selected: m.name };
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
    WIDTH, HEIGHT, CENTER, SCALE, START_ANGLES, NAMES, OPTION_KEYS, ANTIPODE, MIDPOINT,
    add, sub, mul, dot, cross, dist, midpoint, finite, clampPoint,
    intersect, findAltitude, findCircumcenter, getCircle, prorate, extend,
    start, compute, residuals, legalMoves, move, result,
  };
})();
