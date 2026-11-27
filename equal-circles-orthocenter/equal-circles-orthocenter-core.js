"use strict";

/*
 * Orthocenter and Three Equal Circles — the geometry of Alexander Bogomolny's
 * applet EqualCirclesOrthocenter (the article is at cut-the-knot.org/
 * Curriculum/Geometry/EqualCirclesOrthocenter.shtml).
 *
 * ABC is a triangle with orthocenter H. The applet draws the three circles
 * through (B,C,H), (C,A,H) and (A,B,H), and marks the point opposite H on
 * each of them: A' on circle BCH, B' on circle CAH, C' on circle ABH. The
 * page's claim is that these three circles have the same radius as the
 * circumcircle of ABC, so their diameters HA', HB', HC' all equal the
 * circumdiameter. Written from the circumcenter O, H = A + B + C - 2O and
 * A' = B + C - A, cyclically; hence A'B'C' is the anticomplementary triangle
 * of ABC, H is its circumcenter and HA' = HB' = HC' = 2R.
 *
 * Every method here is a transcription of the applet's own bytecode:
 * GeoSDoub.NearestPoint for the feet, GeoSDoub.Intersect for H,
 * GeoSDoub.FindCircumcenter and Canvas.GetCircle for the four circles, and
 * CTKGeometryPlus.Prorate for the three antipodes. The opening triangle
 * repeats Canvas.init(): three points on a circle at 60, 144 and 36 degrees,
 * with y increasing downwards.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, EqualCirclesOrthocenterCore, so the page loads it with a plain
 * <script> and porting/check-equal-circles-orthocenter.mjs loads it in Node.
 * Positions are plain data, in SVG user units; functions never mutate them.
 */
const EqualCirclesOrthocenterCore = (() => {
  /** The SVG user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 440, height: 320 };
  const MARGIN = 12;
  const OPTION_KEYS = ["showNames", "showPremise", "showStatement", "showHint"];

  /** Canvas.init(): angles 60°, 144°, 36° and A flipped to negative y. */
  const ANGLES = { A: Math.PI / 3, B: 4 * Math.PI / 5, C: Math.PI / 5 };
  const CX = VIEW.width / 2;
  const CY = Math.round(VIEW.height / 2.5);
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 4;

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: round(clamp(p.x, MARGIN, VIEW.width - MARGIN)),
    y: round(clamp(p.y, MARGIN, VIEW.height - MARGIN)),
  });
  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const reflect = (p, q) => ({ x: 2 * q.x - p.x, y: 2 * q.y - p.y });
  const twiceArea = (a, b, c) => cross(sub(b, a), sub(c, a));

  /** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.NearestPoint(p,a,b): the foot of the perpendicular on line ab. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return copy(p);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
  function findCircumcenter(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const p = { x: ab.x + (b.y - a.y), y: ab.y - (b.x - a.x) };
    const q = { x: bc.x + (c.y - b.y), y: bc.y - (c.x - b.x) };
    return intersect(ab, p, bc, q);
  }

  /** Canvas.GetCircle: circumcenter, then the mean of the three radii. */
  function getCircle(a, b, c) {
    const centre = findCircumcenter(a, b, c);
    if (!finite(centre)) return null;
    return { c: centre, r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
  }

  /** CTKGeometryPlus.Prorate(from, to, length): length along from -> to. */
  function prorate(from, to, length) {
    const d = dist(from, to);
    if (d < 0.1) return copy(from);
    const k = length / d;
    return { x: from.x + k * (to.x - from.x), y: from.y + k * (to.y - from.y) };
  }

  function average(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  /** Canvas.init(), scaled into our viewBox. */
  function opening() {
    const at = (angle, upwards) => ({
      x: CX + RADIUS * Math.cos(angle),
      y: CY + (upwards ? -1 : 1) * RADIUS * Math.sin(angle),
    });
    return { A: at(ANGLES.A, true), B: at(ANGLES.B, false), C: at(ANGLES.C, false) };
  }
  const START = opening();

  /** A fresh triangle; options default to the applet's unchecked boxes. */
  function start(options) {
    const o = options || {};
    const base = opening();
    const state = {
      A: clampPoint(finite(o.A) ? o.A : base.A),
      B: clampPoint(finite(o.B) ? o.B : base.B),
      C: clampPoint(finite(o.C) ? o.C : base.C),
      showNames: o.showNames === true,
      showPremise: o.showPremise === true,
      showStatement: o.showStatement === true,
      showHint: o.showHint === true,
      moves: 0,
      explored: false,
    };
    return state;
  }

  /**
   * "New diagram": the applet's three angles, turned by a random amount and
   * given a slightly different radius. The corners stay comfortably on the
   * board, so the outer triangle and the three circles remain readable.
   */
  function randomStart(rand = Math.random) {
    const turn = (rand() - 0.5) * 0.8;
    const r = RADIUS * (0.86 + rand() * 0.14);
    const stretch = 0.9 + rand() * 0.2;
    const at = (angle, upwards) => ({
      x: CX + r * Math.cos(angle + turn),
      y: CY + (upwards ? -1 : 1) * stretch * r * Math.sin(angle + turn),
    });
    return start({
      A: at(ANGLES.A, true), B: at(ANGLES.B, false), C: at(ANGLES.C, false),
    });
  }

  function moveVertex(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finite(point)) return state;
    return {
      ...state, [name]: clampPoint(point),
      moves: state.moves + 1, explored: true,
    };
  }

  function setOption(state, name, on) {
    if (!OPTION_KEYS.includes(name)) return state;
    return { ...state, [name]: Boolean(on), explored: true };
  }

  /** An illustration has no win or loss: Track marks exploration as "done". */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /**
   * Canvas.Compute(), in the bytecode's own order. An unusable altitude or
   * circle (a flat or right triangle for one of the three circles) gives
   * valid: false rather than NaN coordinates in the drawing.
   */
  function compute(state) {
    if (!state || ![state.A, state.B, state.C].every(finite)) {
      return { valid: false, reason: "corners" };
    }
    const A = state.A, B = state.B, C = state.C;
    const Ha = nearestPoint(A, B, C);
    const Hb = nearestPoint(B, C, A);
    const Hc = nearestPoint(C, A, B);
    const h1 = intersect(A, Ha, B, Hb);
    const h2 = intersect(B, Hb, C, Hc);
    const h3 = intersect(C, Hc, A, Ha);
    if (![h1, h2, h3].every(finite)) return { valid: false, reason: "altitudes" };
    const H = average(h1, h2, h3);
    if (!finite(H)) return { valid: false, reason: "orthocenter" };

    const circleA = getCircle(B, C, H);
    const circleB = getCircle(C, A, H);
    const circleC = getCircle(A, B, H);
    const circle = getCircle(A, B, C);
    if (!circleA || !circleB || !circleC || !circle) return { valid: false, reason: "circles" };
    if (![circleA.r, circleB.r, circleC.r, circle.r].every(Number.isFinite)) {
      return { valid: false, reason: "radius" };
    }

    const Oa = prorate(H, circleA.c, 2 * circleA.r);
    const Ob = prorate(H, circleB.c, 2 * circleB.r);
    const Oc = prorate(H, circleC.c, 2 * circleC.r);
    if (![Oa, Ob, Oc].every(finite)) return { valid: false, reason: "antipodes" };

    return {
      valid: true, reason: null,
      A, B, C, Ha, Hb, Hc, H,
      circleA, circleB, circleC, circle,
      Oa, Ob, Oc,
      outer: [Oa, Ob, Oc],
      triangle: [A, B, C],
    };
  }

  const geometry = compute;

  /** The line under the drawing: the invariant the player can watch. */
  function describe(g) {
    if (!g || !g.valid) return "Move A, B and C so they make a proper triangle.";
    const r = g.circle.r;
    const diameters = [dist(g.H, g.Oa), dist(g.H, g.Ob), dist(g.H, g.Oc)];
    return `The three circles each have radius ${r.toFixed(1)} — the same as ` +
      `ABC's circumcircle. Diameters HA′, HB′ and HC′ are ` +
      `${diameters.map((d) => d.toFixed(1)).join(", ")}.`;
  }
  const label = describe;

  return {
    VIEW, MARGIN, OPTION_KEYS, ANGLES, START,
    start, randomStart, moveVertex, setOption, result,
    compute, geometry, describe, label,
    intersect, nearestPoint, findCircumcenter, getCircle, prorate, average,
    finite, round, clamp, clampPoint, copy, dist, sqDist, dot, sub, cross,
    midpoint, reflect, twiceArea,
  };
})();
