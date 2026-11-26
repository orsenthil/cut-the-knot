"use strict";

/*
 * Geometric Optimization — Alexander Bogomolny's applet APMO2009_3, porting a
 * problem from the 2009 Asian Pacific Mathematical Olympiad (page by Vo Duc
 * Dien). Triangle ABC has a fixed horizontal base BC and A is kept on a fixed
 * horizontal line, so its altitude h is constant. The page asks where A gives
 * the largest product AA' * BB' * CC' of the three altitudes, and claims the
 * isosceles position AB = AC (called T below).
 *
 * The key identity is (2 * area)^2 = (AA' * BC)(BB' * AC)(CC' * AB), so with
 * area and BC fixed the product of the altitudes is biggest exactly when
 * AB * AC is smallest. With a = BC/2 and u = A.x - midpoint(BC):
 *
 *     AB^2 * AC^2 = (u^2 + a^2 + h^2)^2 - 4 a^2 u^2,
 *     P(u) = 4 a^2 h^3 / (AB * AC),
 *     R(u) = sqrt(a^2 + ((u^2 + h^2 - a^2) / (2h))^2).
 *
 * Both are minimised/maximised at u = 0 only when h >= a (base <= 2h). When the
 * base is longer than twice the height the true extremum is u = sqrt(a^2-h^2),
 * where angle A is a right angle and the circumradius is just a. The page's
 * claim is therefore false in that range; bestFor() and the logic test say so.
 *
 * The picture follows the applet's Compute(): the feet of the altitudes, the
 * orthocenter, the circumcircle, the midpoints of the sides, T (the isosceles
 * apex) and S (the topmost point of the circumcircle). This is the logic only:
 * no document, no window, no storage. It defines one global, Apmo20093Core.
 */
const Apmo20093Core = (() => {
  const WIDTH = 400;
  const HEIGHT = 260;
  const BASE_Y = 200;             // B and C stay on this horizontal line
  const LINE_X = 24;              // where the draggable height handle sits
  const EDGE = 14;
  const MIN_BASE = 60;
  const MIN_ALT = 24;
  const MAX_ALT = 170;
  const CORNERS = ["A", "B", "C"];
  const HANDLES = ["A", "B", "C", "height"];
  const OPTION_KEYS = ["showNames", "showHint1", "showHint2"];

  /* ---------------------------------------------------- small vector helpers */

  const round = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a handle at a legal spot; B and C stay on the base, A on its line. */
  function clampHandle(name, q, state) {
    if (name === "height") {
      if (!q || !Number.isFinite(q.y)) return null;
      return { x: LINE_X, y: clamp(round(q.y), BASE_Y - MAX_ALT, BASE_Y - MIN_ALT) };
    }
    if (!finite(q)) return null;
    if (name === "A") {
      return { x: clamp(round(q.x), EDGE, WIDTH - EDGE), y: state.A.y };
    }
    if (name === "B") {
      return { x: clamp(round(q.x), EDGE, state.C.x - MIN_BASE), y: BASE_Y };
    }
    if (name === "C") {
      return { x: clamp(round(q.x), state.B.x + MIN_BASE, WIDTH - EDGE), y: BASE_Y };
    }
    return null;
  }

  /** Foot of the perpendicular from p to line a,b (GeoSDoub.NearestPoint). */
  function foot(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 === 0) return { x: a.x, y: a.y };
    return add(a, { x: (d.x * dot(sub(p, a), d)) / len2, y: (d.y * dot(sub(p, a), d)) / len2 });
  }

  /** Intersection of line a,b with line c,d, or null if they are parallel. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-12) return null;
    const t = cross(sub(c, a), s) / den;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  }

  /** Barycenter of three points (CTKGeometryPlus.Barycenter). */
  function barycenter(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  /** Analytic circumcenter; the applet intersects two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    return {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
  }

  /** The applet's DoubCircle (GetCircle): centre + mean of the three radii. */
  function circumcircle(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!center || ![center, a, b, c].every(finite)) return null;
    return { center, radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
  }

  /** Angle at v between the rays to p and q, in radians in [0, PI]. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    return Math.acos(clamp(dot(a, b) / (la * lb), -1, 1));
  }

  /* ------------------------------------------------------- extremal analysis */

  /** Product of altitudes and circumradius of a triangle with half-base a,
   *  height h and apex offset u from the midpoint of BC. These are the closed
   *  forms printed on the page and proved in the math section. */
  function metricsAt(a, h, u) {
    const bc = Math.sqrt(Math.max(0, (u * u + a * a + h * h) ** 2 - 4 * a * a * u * u));
    const k = (u * u + h * h - a * a) / (2 * h);
    return {
      bc,
      product: (4 * a * a * h * h * h) / bc,
      radius: Math.sqrt(a * a + k * k),
      k,
    };
  }

  /** Where the extremum really is. `holds` is the page's claim. */
  function bestFor(base, height) {
    const a = base / 2, h = height;
    const isosceles = { u: 0, kind: "isosceles", ...metricsAt(a, h, 0) };
    const right = a > h
      ? { u: Math.sqrt(a * a - h * h), kind: "right-angle", ...metricsAt(a, h, Math.sqrt(a * a - h * h)) }
      : null;
    const best = right && right.product > isosceles.product + 1e-9 ? right : isosceles;
    return {
      base, height, halfBase: a, isosceles, right, best,
      holds: !right || right.product <= isosceles.product + 1e-9,
      threshold: 2 * h,
    };
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture: A off centre, so the player can look for T. */
  function start(options) {
    let s = {
      A: { x: 140, y: 80 },
      B: { x: 90, y: BASE_Y },
      C: { x: 310, y: BASE_Y },
      showNames: true,    // the applet's ShowNames parameter defaults to 1
      showHint1: false,   // the other two checkboxes start unticked
      showHint2: false,
      moves: 0,
      explored: false,
    };
    const o = options || {};
    for (const name of CORNERS) {
      if (finite(o[name])) s = move(s, { type: "point", name, point: o[name] });
    }
    if (Number.isFinite(o.height)) {
      // `height` is the altitude, measured up from the base line.
      s = move(s, { type: "point", name: "height", point: { x: LINE_X, y: BASE_Y - o.height } });
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") s = { ...s, [key]: o[key] };
    }
    return { ...s, moves: 0, explored: false };
  }

  /** The moves a player can make: four handles, three switches and Reset. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name,
        point: name === "height" ? { x: LINE_X, y: state.A.y } : state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      const p = clampHandle(m.name, m.point, state);
      if (!p) return null;
      if (m.name === "height") next = { ...state, A: { ...state.A, y: p.y } };
      else next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next || !finite(next.A) || !finite(next.B) || !finite(next.C)) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has nothing to win: it counts as played once it was changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* -------------------------------------------------------------- the picture */

  /** Everything the applet's Compute() draws, plus the numbers behind the
   *  extremal claim. Returns { degenerate: true } if the triangle collapses. */
  function compute(state) {
    const A = state.A, B = state.B, C = state.C;
    if (![A, B, C].every(finite) || Math.abs(A.y - B.y) < 2 || dist(B, C) < 2) {
      return { degenerate: true };
    }
    const circle = circumcircle(A, B, C);
    if (!circle) return { degenerate: true };
    const { center: O, radius: r } = circle;

    // The applet's three altitude feet and the (averaged) intersection of the
    // three altitude lines, CTKGeometryPlus.Barycenter.
    const Ah = foot(A, B, C);
    const Bh = foot(B, C, A);
    const Ch = foot(C, A, B);
    const i1 = intersect(A, Ah, B, Bh);
    const i2 = intersect(B, Bh, C, Ch);
    const i3 = intersect(C, Ch, A, Ah);
    if (!i1 || !i2 || !i3) return { degenerate: true };
    const H = barycenter(i1, i2, i3);

    // Midpoints of the sides and of the hint triangles, as in the applet.
    const Am = midpoint(B, C), Bm = midpoint(C, A), Cm = midpoint(A, B);
    const A0m = { x: Am.x, y: 0 };
    const T = { x: Am.x, y: A.y };
    const S = { x: Am.x, y: O.y - r };    // topmost point of the circumcircle
    const circle1 = circumcircle(T, B, C);
    if (!circle1) return { degenerate: true };
    const Tb = midpoint(T, C), Tc = midpoint(T, B);
    const Sb = midpoint(S, C), Sc = midpoint(S, B);

    const base = dist(B, C), height = Math.abs(A.y - B.y);
    const a = base / 2;
    const b = dist(C, A), c = dist(A, B);
    const area = (base * height) / 2;
    const altitudeB = (2 * area) / b;
    const altitudeC = (2 * area) / c;
    const product = height * altitudeB * altitudeC;
    const offset = A.x - Am.x;
    return {
      degenerate: false,
      A, B, C, O, r, circle, circle1,
      Ah, Bh, Ch, H,
      Am, Bm, Cm, A0m, T, S, Tb, Tc, Sb, Sc,
      base, height, a, b, c, area, altitudeB, altitudeC, product, offset,
      angleA: angleAt(A, B, C),
      gap: T.y - S.y,             // >= 0: S is at or above T on the screen
      best: bestFor(base, height),
    };
  }

  /** Geometric residuals of the picture, used by the logic test. */
  function residuals(state, g) {
    if (g.degenerate) return null;
    const { A, B, C } = state;
    const offLine = (p, a, b) => Math.abs(cross(sub(p, a), sub(b, a))) / (dist(a, b) || 1);
    return {
      footOnBase: Math.abs(g.Ah.y - B.y),
      footOnSideB: offLine(g.Bh, C, A),
      footOnSideC: offLine(g.Ch, A, B),
      altitudePerp: Math.abs(dot(sub(A, g.Ah), sub(B, C))),
      radius: Math.max(Math.abs(dist(g.O, A) - g.r), Math.abs(dist(g.O, B) - g.r),
        Math.abs(dist(g.O, C) - g.r)),
      orthocenter: Math.max(Math.abs(cross(sub(g.H, A), sub(g.Ah, A))),
        Math.abs(cross(sub(g.H, B), sub(g.Bh, B)))),
      circle1: Math.abs(dist(g.circle1.center, B) - g.circle1.radius),
      sOnCircle: Math.abs(dist(g.O, g.S) - g.r),
      tOnCircle1: Math.abs(dist(g.circle1.center, g.T) - g.circle1.radius),
      product: Math.abs(g.product - metricsAt(g.a, g.height, g.offset).product),
    };
  }

  return {
    WIDTH, HEIGHT, BASE_Y, LINE_X, EDGE, MIN_BASE, MIN_ALT, MAX_ALT,
    CORNERS, HANDLES, OPTION_KEYS,
    round, clamp, dist, midpoint, finite, foot, intersect, barycenter,
    circumcenter, circumcircle, angleAt, metricsAt, bestFor,
    clampHandle, start, legalMoves, move, result, compute, residuals,
  };
})();
