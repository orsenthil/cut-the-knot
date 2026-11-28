"use strict";

/*
 * Lenses in a triangle, from Alexander Bogomolny's applet LensesInTriangle.
 *
 * A circle with the altitude of an equilateral triangle as its radius rolls
 * along the triangle's base. It cuts the two sloping sides in D and E. The
 * applet draws the lens made by reflecting the circle's small arc DE across
 * the chord DE. The page claims that arc DE is always 60 degrees and that the
 * lens stays inside the triangle. Both are true while the circle rolls
 * between the two positions that contain B or C; the Java scrollbar also
 * allows five steps past the right-hand position, where the lens escapes.
 *
 * The key identity: with the centre at (x, 0) and side s, the intersections
 * are ((x - sqrt(3)u)/4, (-sqrt(3)x + 3u)/4) and its mirror image, where
 * u = sqrt(s*s - x*x). Their dot product from the centre is constant, so the
 * angle they subtend is always 60 degrees, whatever x may be.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global so the page loads it with a plain
 * <script> and porting/check-lenses-in-triangle.mjs loads it in Node. The
 * position is plain data and every function returns a new value.
 */
const LensesInTriangleCore = (() => {
  const SQRT3 = Math.sqrt(3);
  const RANGE = Object.freeze({ min: -50, max: 55, step: 1 });

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (v) => Math.round(v);
  const dist2 = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(dist2(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** GeoSDoub.ComputeAngle, transcribed: the angle at `vertex`, unsigned. */
  function angle(vertex, p, q) {
    const a = dist2(vertex, p);
    const b = dist2(vertex, q);
    const c = dist2(p, q);
    const cosine = (a + b - c) / (2 * dist(vertex, p) * dist(vertex, q));
    return Math.acos(clamp(cosine, -1, 1));
  }

  /** CTKGeometryPlus.Prorate, including its small-distance early return. */
  function prorate(p, q, d) {
    const len = dist(p, q);
    if (len < 0.1) return { x: p.x, y: p.y };
    const t = d / len;
    return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
  }

  /** The position a new picture starts from (the applet's initial scrollbar). */
  function start(options = {}) {
    const raw = Number(options.dist);
    const distValue = Number.isFinite(raw) ? raw : 0;
    return {
      dist: clamp(round(distValue), RANGE.min, RANGE.max),
      hint: Boolean(options.hint),
      names: Boolean(options.names),
    };
  }

  /** The scrollbar's whole range, as integer steps. */
  function legalMoves(/* state */) {
    const out = [];
    for (let d = RANGE.min; d <= RANGE.max; d += RANGE.step) out.push(d);
    return out;
  }

  function setDist(state, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return state;
    return { ...state, dist: clamp(round(n), RANGE.min, RANGE.max) };
  }

  function stepDist(state, delta) {
    return setDist(state, state.dist + delta);
  }

  function toggleHint(state) {
    return { ...state, hint: !state.hint };
  }

  function toggleNames(state) {
    return { ...state, names: !state.names };
  }

  /** There is nothing to win or lose in an illustration. */
  function result(/* state */) {
    return null;
  }

  /**
   * The whole construction in board units. `origin` is the apex A; the side
   * points down, as in the Java canvas (y grows downwards).
   */
  function geometry(state, side = 240, origin = { x: 0, y: 0 }) {
    const s = Number(side);
    const h = SQRT3 * s / 2;
    const A = { x: origin.x, y: origin.y };
    const B = { x: A.x - s / 2, y: A.y + h };
    const C = { x: A.x + s / 2, y: A.y + h };
    const x = state.dist * s / 100;
    const r = h;
    const O = { x: A.x + x, y: A.y };

    // GeoSDoub.IntersectX: each line is stored as x = slope*y + intercept,
    // and the line/circle quadratic is solved in full, as in the Java class.
    // Compute then keeps the higher of the two crossings on each side.
    function cross(Bp) {
      const slope = (A.x - Bp.x) / (A.y - Bp.y);
      const intercept = Bp.x - slope * Bp.y;
      const aa = slope * slope + 1;
      const bb = slope * (intercept - O.x) - O.y;
      const cc = O.y * O.y + (intercept - O.x) ** 2 - r * r;
      const disc = bb * bb - aa * cc;
      const root = Math.sqrt(Math.max(0, disc));
      const y0 = (-bb + root) / aa;
      const y1 = (-bb - root) / aa;
      const p0 = { x: slope * y0 + intercept, y: y0 };
      const p1 = { x: slope * y1 + intercept, y: y1 };
      return p0.y > p1.y ? p0 : p1;
    }
    const D = cross(B);
    const E = cross(C);
    const M = midpoint(D, E);

    // Circle2 is the circle O reflected in the chord's midpoint M.
    const O2 = { x: 2 * M.x - O.x, y: 2 * M.y - O.y };
    const Bp = { x: 2 * A.x - C.x, y: 2 * A.y - C.y };
    const Cp = { x: 2 * A.x - B.x, y: 2 * A.y - B.y };

    // The applet rounds both angles to whole degrees before it draws the arc.
    const right = { x: O2.x + 200, y: O2.y };
    const alphaD = round(angle(O2, D, right) * 180 / Math.PI);
    const alphaE = round(angle(O2, E, right) * 180 / Math.PI);
    const arcDegrees = angle(O, D, E) * 180 / Math.PI;
    const tilt = Math.atan2(Math.abs(E.y - D.y), Math.abs(E.x - D.x)) * 180 / Math.PI;

    return {
      side: s, dist: state.dist, A, B, C, O, D, E, M, O2, Bp, Cp,
      r, h, alphaD, alphaE, sweep: alphaE - alphaD, arcDegrees, tilt,
    };
  }

  /** The short way round a circle from p to q, as {start, sweep} radians. */
  function shortArc(centre, p, q) {
    let a = Math.atan2(p.y - centre.y, p.x - centre.x);
    let delta = Math.atan2(q.y - centre.y, q.x - centre.x) - a;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return { start: a, sweep: delta };
  }

  function arcPoints(centre, radius, arc, count = 64) {
    const out = [];
    for (let i = 0; i <= count; i++) {
      const a = arc.start + (arc.sweep * i) / count;
      out.push({ x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a) });
    }
    return out;
  }

  /** True when a point lies in (or on) triangle ABC, whatever its winding. */
  function inTriangle(p, g, eps = 1e-7) {
    const cross = (a, b) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const a = cross(g.A, g.B);
    const b = cross(g.B, g.C);
    const c = cross(g.C, g.A);
    return (a >= -eps && b >= -eps && c >= -eps) || (a <= eps && b <= eps && c <= eps);
  }

  /** Sample both borders of the lens; true when every point is in the triangle. */
  function lensInside(state, side = 240, origin = { x: 0, y: 0 }, count = 64) {
    const g = geometry(state, side, origin);
    const lower = arcPoints(g.O, g.r, shortArc(g.O, g.D, g.E), count);
    const upper = arcPoints(g.O2, g.r, shortArc(g.O2, g.D, g.E), count);
    return [...lower, ...upper].every((p) => inTriangle(p, g));
  }

  /** The line the picture puts under itself; there is no win or loss. */
  function describe(g) {
    const tilt = g.tilt.toFixed(1);
    let text = `Arc DE is ${g.arcDegrees.toFixed(1)}\u00b0 wide; DE leans ${tilt}\u00b0 from the base.`;
    if (g.dist > 50) {
      text += " Past the rolling limit: the lens now crosses the side AC.";
    }
    return text;
  }

  return {
    RANGE,
    start,
    legalMoves,
    setDist,
    stepDist,
    toggleHint,
    toggleNames,
    result,
    geometry,
    shortArc,
    arcPoints,
    inTriangle,
    lensInside,
    describe,
    // exposed for the second bytecode transcription in the logic test
    angle,
    prorate,
    midpoint,
    distance: dist,
  };
})();
