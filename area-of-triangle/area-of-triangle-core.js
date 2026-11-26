"use strict";

/*
 * Area Of Triangle, from Alexander Bogomolny's applet AreaOfTriangle.
 *
 * The page puts triangle ABC beside three rectangles: ABQP on the base AB,
 * AHCP on AH and HBQC on HB, where H is the foot of the altitude from C.
 * AH and HB are signed lengths along the base, so they add to AB whether H
 * lies between A and B or outside it. Multiplying by the same altitude gives
 * Area(ABQP) = Area(AHCP) + Area(HBQC), and the triangle is half of ABQP.
 * Rotating ABC through 180 degrees about the midpoint of a side gives the
 * parallelogram whose area is twice the triangle's.
 *
 * H, P and Q are found exactly as GeoSDoub.NearestPoint and GetParallelTo do
 * in the applet: P and Q are the feet of A and B on the line through C
 * parallel to AB. Every function here is DOM-free and takes/returns plain data.
 */
const AreaOfTriangleCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const NAMES = ["A", "B", "C"];
  const OPTION_KEYS = ["showTriangle", "showNames", "showColors"];
  const EPS = 1e-9;

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sqDist = (p, q) => dot(sub(p, q), sub(p, q));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

  /** GeoSDoub.NearestPoint(p, a, b): the foot on the infinite line ab. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, b) < 0.1) return { x: p.x, y: p.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.GetParallelTo(p, a, b), a point on the parallel through p. */
  function parallelPoint(p, a, b) {
    return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
  }

  /** The applet's a(double): Math.round, used to place the "Nice" label. */
  function rounded(p) { return { x: Math.round(p.x), y: Math.round(p.y) }; }

  function centroid(A, B, C) {
    return rounded({ x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 });
  }

  /** Signed shoelace area; its sign is the orientation of the vertex order. */
  function signedArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum / 2;
  }

  /** The applet's opening triangle at WIDTH x HEIGHT (or another board size). */
  function start(options) {
    const o = options || {};
    const w = o.width || WIDTH;
    const h = o.height || HEIGHT;
    const h3 = Math.trunc(h / 3);
    return {
      A: { x: w / 2 - w / 4, y: h / 2 + h3 },
      B: { x: w / 2 + w / 4, y: h / 2 + h3 },
      C: { x: w / 2 + (w / 4) * Math.cos(Math.PI / 3), y: h / 2 - h3 },
      width: w,
      height: h,
      showTriangle: false,
      showNames: false,
      showColors: false,
    };
  }

  /** An illegal move changes nothing; every legal one returns a new position. */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset") return start({ width: state.width, height: state.height });
    if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { [m.key]: m.value });
    }
    if (m.type === "point") {
      if (!NAMES.includes(m.name) || !m.point) return null;
      const { x, y } = m.point;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || x > state.width || y < 0 || y > state.height) return null;
      return Object.assign({}, state, { [m.name]: { x, y } });
    }
    return null;
  }

  /** All the points and areas the picture needs, straight from the applet. */
  function compute(state) {
    const { A, B, C } = state;
    const H = nearestPoint(C, A, B);
    const L = parallelPoint(C, A, B);
    const P = nearestPoint(A, C, L);
    const Q = nearestPoint(B, C, L);

    const e = sub(B, A);
    const len2 = dot(e, e);
    const t = len2 < 0.1 ? 0 : dot(sub(C, A), e) / len2;
    const crossAB = cross(e, sub(C, A));
    const base = Math.sqrt(len2);
    const height = base > EPS ? Math.abs(crossAB) / base : 0;
    const triangleArea = Math.abs(crossAB) / 2;

    // Signed lengths along AB: AH = t*AB, HB = (1-t)*AB.
    const rect = { ABQP: crossAB, AHCP: t * crossAB, HBQC: (1 - t) * crossAB };
    const shoelace = {
      ABQP: signedArea([A, B, Q, P]),
      AHCP: signedArea([A, H, C, P]),
      HBQC: signedArea([H, B, Q, C]),
    };

    return {
      A, B, C, H, P, Q,
      t, cross: crossAB, base, height, triangleArea,
      rectangleArea: Math.abs(crossAB),
      parallelogramArea: Math.abs(crossAB),
      rect, shoelace,
      insideBase: t >= -EPS && t <= 1 + EPS,
      degenerate: Math.abs(crossAB) < EPS,
    };
  }

  /** Turn one side into a parallelogram by a half-turn about its midpoint. */
  function doubling(A, B, C, side) {
    const pairs = { AB: [A, B, C], BC: [B, C, A], CA: [C, A, B] };
    const [U, V, opposite] = pairs[side];
    if (!U) return null;
    const copy = { x: U.x + V.x - opposite.x, y: U.y + V.y - opposite.y };
    const e = sub(V, U);
    const base = Math.sqrt(dot(e, e));
    const altitude = base > EPS ? Math.abs(cross(e, sub(opposite, U))) / base : 0;
    return {
      U, V, opposite, copy,
      area: Math.abs(signedArea([U, opposite, V, copy])),
      base, altitude,
    };
  }

  /** The page's equalities, checked with a relative tolerance. */
  function claims(g) {
    return {
      rectanglesAdd: close(g.rect.ABQP, g.rect.AHCP + g.rect.HBQC),
      triangleIsHalf: close(g.triangleArea, g.rectangleArea / 2),
      baseTimesHeight: close(g.rectangleArea, g.base * g.height),
      shoelaceMatches: close(g.shoelace.ABQP, g.rect.ABQP) &&
        close(g.shoelace.AHCP, g.rect.AHCP) &&
        close(g.shoelace.HBQC, g.rect.HBQC),
      feetArePerpendicular: close(dot(sub(g.C, g.H), sub(g.B, g.A)), 0) &&
        close(dot(sub(g.A, g.P), sub(g.B, g.A)), 0) &&
        close(dot(sub(g.B, g.Q), sub(g.B, g.A)), 0),
    };
  }

  return {
    WIDTH, HEIGHT, NAMES, OPTION_KEYS, EPS,
    add, sub, dot, cross, sqDist, close, nearestPoint, parallelPoint,
    rounded, centroid, signedArea, start, move, compute, doubling, claims,
  };
})();
