"use strict";

/*
 * Iterations on Euler Lines — the geometry behind Bogomolny's applet
 * EulerToEuler.
 *
 * Drag the corners of a triangle ABC. Its Euler line meets the lines AB and AC
 * at M and N. The page claims that the Euler line of the new triangle AMN is
 * parallel to BC. The code follows the applet's own arithmetic: perpendicular
 * bisectors for the circumcentre, altitudes for the orthocentre, and a line
 * intersection in ax + by + c form whose denominator must exceed one unit.
 * The applet refuses to draw an Euler line when its two centres are less than
 * half a unit apart, which is how it avoids an equilateral triangle's missing
 * Euler line.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, EulerToEulerCore, so the page loads it with a plain
 * <script> and porting/check-euler-to-euler.mjs loads it in Node. Every
 * function takes plain data and returns new objects; nothing passed in changes.
 */
const EulerToEulerCore = (() => {
  /** GeoSDoub.Intersect returns NaN coordinates when |det| < 1 (not 1e-9). */
  const INTERSECT_MIN = 1;
  /** EulerToEulerCanvas.Draw only draws a line when Dist(O, H) > 0.5. */
  const EULER_MIN = 0.5;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const nanPoint = () => ({ x: NaN, y: NaN });

  /* The literal GeoSDoub.Intersect(P1, P2, P3, P4). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y;
    const b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y;
    const b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < INTERSECT_MIN) return nanPoint();
    return {
      x: (b1 * c2 - b2 * c1) / den,
      y: (c1 * a2 - c2 * a1) / den,
    };
  }

  /* EulerToEulerCanvas.MidPoint(P, Q). */
  function midpoint2(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  /* EulerToEulerCanvas.MidPoint(P, Q, R). */
  function midpoint3(p, q, r) {
    return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
  }

  /* GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = midpoint2(p, q);
    const m2 = midpoint2(q, r);
    const v1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const v2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersect(m1, v1, m2, v2);
  }

  /* GeoSDoub.FindAltitude(P, Q, R): the foot from P on line QR. */
  function altitude(p, q, r) {
    const foot = {
      x: p.x + (r.y - q.y),
      y: p.y - (r.x - q.x),
    };
    return intersect(p, foot, q, r);
  }

  /* EulerToEulerCanvas.GetOrthocenter, in the applet's own order. */
  function orthocenter(p, q, r) {
    const h1 = altitude(p, q, r);
    const h2 = altitude(q, p, r);
    return intersect(p, h1, q, h2);
  }

  /**
   * One call of the applet's private Draw(g, P, Q, R, true, colour): the three
   * centres and the Euler line through O and H, which is null for a triangle
   * whose centres are too close (or whose construction went undefined).
   */
  function triangleData(p, q, r) {
    const G = midpoint3(p, q, r);
    const O = circumcenter(p, q, r);
    const H = orthocenter(p, q, r);
    const line = finite(O) && finite(H) && distance(O, H) > EULER_MIN
      ? { p1: O, p2: H }
      : null;
    return { G, O, H, line, defined: Boolean(line) };
  }

  /** The starting triangle, placed exactly as EulerToEulerCanvas.init places it. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C },
      };
    }
    const w = o.width === undefined ? 400 : o.width;
    const h = o.height === undefined ? 300 : o.height;
    const d = Math.min(w, h) / 4;
    const C = {
      x: w / 2 + 2 * d * Math.cos(0.5),
      y: h / 2 + 2 * d * Math.sin(0.5),
    };
    const B = { x: w - C.x, y: C.y };
    const A = { x: (9 * B.x + C.x) / 10, y: h / 2 + d * Math.sin(-1.6) };
    return { A, B, C };
  }

  /** A new position with one named corner moved; input is never changed. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /**
   * The whole diagram: the first Euler line, its crossings with AB and AC, and
   * the Euler line of AMN. M or N is a NaN point when the two lines are
   * parallel within the applet's one-unit tolerance.
   */
  function diagram(state) {
    const { A, B, C } = state;
    const first = triangleData(A, B, C);
    let M = nanPoint();
    let N = nanPoint();
    if (first.line) {
      M = intersect(first.line.p1, first.line.p2, A, B);
      N = intersect(first.line.p1, first.line.p2, A, C);
    }
    const mnFinite = finite(M) && finite(N);
    const second = mnFinite ? triangleData(A, M, N) : triangleData(nanPoint(), nanPoint(), nanPoint());
    return { A, B, C, M, N, first, second, mnFinite };
  }

  /**
   * The page's claim, split into the conditions the applet needs before it can
   * draw the second line. `parallel` is the actual statement on the page.
   */
  function claims(state) {
    const d = diagram(state);
    const mnFinite = d.mnFinite;
    const distinct = mnFinite &&
      distance(d.M, d.A) > 1e-6 && distance(d.N, d.A) > 1e-6 &&
      distance(d.M, d.N) > 1e-6;
    const euler2 = distinct && d.second.defined;
    let parallel = false;
    if (euler2) {
      const u = {
        x: d.second.line.p2.x - d.second.line.p1.x,
        y: d.second.line.p2.y - d.second.line.p1.y,
      };
      const v = { x: d.C.x - d.B.x, y: d.C.y - d.B.y };
      const ul = Math.hypot(u.x, u.y);
      const vl = Math.hypot(v.x, v.y);
      parallel = ul > 0 && vl > 0 &&
        Math.abs(u.x * v.y - u.y * v.x) <= 1e-6 * ul * vl;
    }
    return {
      euler1: d.first.defined,
      mnFinite,
      distinct,
      euler2,
      parallel,
      ready: euler2,
    };
  }

  /** An illustration has no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    INTERSECT_MIN, EULER_MIN, distance, cross, finite, nanPoint,
    intersect, midpoint2, midpoint3, circumcenter, altitude, orthocenter,
    triangleData, start, withPoint, diagram, claims, result,
  };
})();
