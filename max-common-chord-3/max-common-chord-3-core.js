"use strict";

/*
 * Max Common Chord 3 — the geometry behind Alexander Bogomolny's applet
 * MaxCommonChord3 (cut-the-knot.org/Curriculum/Geometry/MaxCommonChord3.shtml),
 * the 1975 USAMO problem about two intersecting circles.
 *
 * Two circles through P and Q meet a variable chord AB through P: A is the
 * second point where the first circle meets the line, B the second point on
 * the other circle. The page claims that AP·PB = PQ·PR (intersecting chords),
 * that QR = 2·QN where N is the foot from the circumcentre S of ABQ to PQ,
 * and that the product is greatest when SN is tangent to the circumcircle of
 * E, Q, F — equivalently when S bisects the arc from T to U (QT a diameter).
 *
 * The one idea the code relies on is that S travels on the circumcircle of
 * the two given centres and Q. For a point S on that circle, the circle with
 * centre S through Q cuts the given circles again in A and B, and AB passes
 * through P. The intersections, angles and "other point" choices below
 * follow the applet's GeoSDoub / CTKGeometryPlus calls in bytecode order.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, MaxCommonChord3Core, so the page loads it
 * with a plain <script> and porting/check-max-common-chord-3.mjs loads it in
 * Node. Functions take plain data and return new objects.
 */
const MaxCommonChord3Core = (() => {
  const EPS = 1e-9;

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const cross = (u, v) => u.x * v.y - u.y * v.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finitePoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

  /** GeoSDoub.Intersect: the crossing of the two infinite lines p1p2, p3p4. */
  function intersect(p1, p2, p3, p4) {
    if (!finitePoint(p1) || !finitePoint(p2) || !finitePoint(p3) || !finitePoint(p4)) return null;
    const u = sub(p2, p1), v = sub(p4, p3);
    const det = cross(u, v);
    // GeoSDoub.Intersect refuses a determinant below one, not just zero.
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    const w = sub(p3, p1);
    const t = cross(w, v) / det;
    return { x: p1.x + u.x * t, y: p1.y + u.y * t };
  }

  /**
   * GeoSDoub.Intersect(circle, line): IntersectX when the line is steeper,
   * IntersectY when it is flatter. The order of the two crossings matters:
   * the applet's Other() picks the first unless it is near Q.
   */
  function lineCircle(a, b, c, r) {
    if (!finitePoint(a) || !finitePoint(b) || !finitePoint(c) || !Number.isFinite(r)) return null;
    if (Math.abs(a.y - b.y) > 1) {
      const m = (a.x - b.x) / (a.y - b.y), k = b.x - m * b.y;
      const aa = 1 + m * m, bb = m * (k - c.x) - c.y;
      const cc = c.y * c.y + (k - c.x) * (k - c.x) - r * r;
      const disc = bb * bb - aa * cc;
      if (!Number.isFinite(disc) || disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [{ x: m * t1 + k, y: t1 }, { x: m * t2 + k, y: t2 }];
    }
    if (Math.abs(a.x - b.x) > 1) {
      const m = (a.y - b.y) / (a.x - b.x), k = b.y - m * b.x;
      const aa = 1 + m * m, bb = m * (k - c.y) - c.x;
      const cc = c.x * c.x + (k - c.y) * (k - c.y) - r * r;
      const disc = bb * bb - aa * cc;
      if (!Number.isFinite(disc) || disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [{ x: t1, y: m * t1 + k }, { x: t2, y: m * t2 + k }];
    }
    return null;
  }

  /**
   * GeoSDoub.Intersect(circle, circle): IntersectCirclesX / Y in the order
   * the class file returns them. Keeping that order matters to Other().
   */
  function circleCircle(c1, r1, c2, r2) {
    if (!finitePoint(c1) || !finitePoint(c2) || !Number.isFinite(r1) || !Number.isFinite(r2)) return null;
    if (Math.abs(c1.x - c2.x) > 1) {
      const m = -(c1.y - c2.y) / (c1.x - c2.x);
      const k = ((c1.x ** 2 - c2.x ** 2) + (c1.y ** 2 - c2.y ** 2)
        + r2 * r2 - r1 * r1) / (2 * (c1.x - c2.x));
      const d = k - c1.x;
      const aa = 1 + m * m, bb = m * d - c1.y, cc = d * d + c1.y ** 2 - r1 * r1;
      const disc = bb * bb - aa * cc;
      if (!Number.isFinite(disc) || disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [{ x: m * t1 + k, y: t1 }, { x: m * t2 + k, y: t2 }];
    }
    if (Math.abs(c1.y - c2.y) > 1) {
      const m = -(c1.x - c2.x) / (c1.y - c2.y);
      const k = ((c1.y ** 2 - c2.y ** 2) + (c1.x ** 2 - c2.x ** 2)
        + r2 * r2 - r1 * r1) / (2 * (c1.y - c2.y));
      const d = k - c1.y;
      const aa = 1 + m * m, bb = m * d - c1.x, cc = d * d + c1.x ** 2 - r1 * r1;
      const disc = bb * bb - aa * cc;
      if (!Number.isFinite(disc) || disc < 0) return null;
      const root = Math.sqrt(disc);
      const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
      return [{ x: t1, y: m * t1 + k }, { x: t2, y: m * t2 + k }];
    }
    return [null, null];
  }

  /** GeoSDoub.FindCircumcenter, then GetCircle's average-radius variant. */
  function circumcircle(p, q, r) {
    if (!finitePoint(p) || !finitePoint(q) || !finitePoint(r)) return null;
    const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const a = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const b = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    const c = intersect(m1, a, m2, b);
    if (!c) return null;
    const radius = (dist(c, p) + dist(c, q) + dist(c, r)) / 3;
    if (!Number.isFinite(radius) || radius < EPS) return null;
    return { c, r: radius };
  }

  /** The applet's Other(): the crossing that is not within one unit of ref. */
  function other(points, ref) {
    if (!points || points.length < 2 || !finitePoint(points[0]) || !finitePoint(points[1])) return null;
    return dist(points[0], ref) < 1 ? points[1] : points[0];
  }

  /**
   * When constructing a chord from S the intersections may be returned in
   * either order, so take the one genuinely different from Q. The applet's
   * Other() above keeps its bytecode order for the drawn construction.
   */
  function otherPoint(points, ref) {
    if (!points || !finitePoint(points[0]) || !finitePoint(points[1])) return null;
    return dist(points[0], ref) > dist(points[1], ref) ? points[0] : points[1];
  }

  /** CTKMoveableDoub.RestrictToCircle: the nearest point of a circle. */
  function restrictToCircle(p, circle) {
    const u = sub(p, circle.c), d = Math.hypot(u.x, u.y);
    if (d < EPS) return { x: circle.c.x + circle.r, y: circle.c.y };
    return { x: circle.c.x + (circle.r * u.x) / d, y: circle.c.y + (circle.r * u.y) / d };
  }

  /** The applet's Fix(): put a point back on its circle on the line to P. */
  function fixPoint(point, circle, linePoint, P) {
    if (!circle || dist(linePoint, P) < 1) return point;
    const hits = lineCircle(linePoint, P, circle.c, circle.r);
    const chosen = other(hits, P);
    return chosen || point;
  }

  /** GeoSDoub.ComputeAngle: the angle at v between the rays to p and q. */
  function angle(v, p, q) {
    if (!finitePoint(v) || !finitePoint(p) || !finitePoint(q)) return NaN;
    const a = sub(p, v), b = sub(q, v);
    const den = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (den < EPS) return NaN;
    const cosine = Math.max(-1, Math.min(1, dot(a, b) / den));
    return Math.acos(cosine);
  }

  /** CTKGeometryPlus.Prorate(Q, direction, length). */
  function prorate(p, q, length) {
    const u = sub(q, p), d = Math.hypot(u.x, u.y);
    if (d < 0.1) return p;
    return { x: p.x + (u.x * length) / d, y: p.y + (u.y * length) / d };
  }

  /**
   * The opening picture from Canvas.init(), scaled to any canvas size. The
   * applet uses a 640x460 canvas; the page uses the same fractions in a
   * 400x288 viewBox. B is then put on circle F by Fix(B, F, A) as in init().
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 640 : o.width;
    const height = o.height === undefined ? 460 : o.height;
    const P = { x: (width * 6) / 11, y: height / 2 + height / 10 };
    const Q = { x: width / 2, y: (height * 3) / 5 + height / 5 };
    const A = { x: (width * 3) / 8, y: (height * 4) / 5 };
    const B0 = { x: (width * 18) / 20, y: (height * 3) / 5 + height / 5 };
    const F = circumcircle(B0, P, Q);
    const B = fixPoint(B0, F, A, P);
    return { P, Q, A, B, adjustCircles: false, showNames: false };
  }

  /* ----------------------------------------------------- the construction */

  /**
   * Canvas.Compute(), in the bytecode's order. The guard rejects points that
   * are closer than two units: the applet does not compute a picture then.
   * Derived points that cannot be built are null, never NaN coordinates.
   */
  function auxiliary(state) {
    const blank = { valid: false, E: null, F: null, O: null, U: null, T: null, best: null };
    const { P, Q, A, B } = state;
    if (![A, B, P, Q].every(finitePoint)) return blank;
    if ([dist(A, P), dist(A, Q), dist(B, P), dist(B, Q), dist(P, Q)].some((d) => d < 2)) return blank;
    const E = circumcircle(A, P, Q);
    const F = circumcircle(B, P, Q);
    if (!E || !F) return blank;
    const O = circumcircle(E.c, Q, F.c);
    if (!O) return blank;
    const U = other(lineCircle(P, Q, O.c, O.r), Q);
    const T = prorate(Q, O.c, 2 * O.r);
    return { valid: true, E, F, O, U, T, best: bestPosition({ E, F, O, P, Q, U, T }) };
  }

  function measure(state) {
    const { P, Q, A, B } = state;
    const blank = { valid: false, E: null, F: null, O: null, AB: null, R: null, L: null, M: null,
      S: null, U: null, T: null, N: null, angleDiff: NaN, finished: false, best: null };
    const aux = auxiliary(state);
    if (!aux.valid) return blank;
    const { E, F, O, U, T } = aux;
    const AB = circumcircle(A, B, Q);
    const R = AB ? other(lineCircle(P, Q, AB.c, AB.r), Q) : null;
    // Compute() returns early when P and R almost coincide.
    if (!R || dist(P, R) < 1) return blank;
    const L = other(circleCircle(O.c, O.r, E.c, E.r), Q);
    const M = other(circleCircle(O.c, O.r, F.c, F.r), Q);
    const S = L && M ? intersect(A, L, B, M) : null;
    let N = null;
    if (S && finitePoint(P) && finitePoint(Q)) {
      // CTKGeometryPlus.Perp(P, Q, S): a point ten units along the perpendicular.
      const perp = { x: S.x + (Q.y - P.y) * 10, y: S.y - (Q.x - P.x) * 10 };
      N = intersect(P, Q, S, perp);
    }
    const angleDiff = S && U ? Math.abs(angle(Q, U, S) - angle(Q, S, T)) : NaN;
    const finished = Number.isFinite(angleDiff) && angleDiff < 0.01;

    const best = aux.best;
    const product = dist(A, P) * dist(P, B);
    const pqpr = R ? dist(P, Q) * dist(P, R) : NaN;
    return { valid: true, E, F, O, AB, R, L, M, S, U, T, N, angleDiff, finished, best,
      product, pqpr, QR: R ? dist(Q, R) : NaN, QN: N ? dist(Q, N) : NaN,
      SN: N && S ? dist(S, N) : NaN, SQ: S ? dist(S, Q) : NaN };
  }

  /**
   * The maximum from the page: S is the arc midpoint of T and U, the place
   * where the radius OS is parallel to PQ and SN is tangent to C(O). Pick the
   * of the two candidates that satisfies the applet's angle test, then build
   * the chord belonging to that S.
   */
  function bestPosition(g) {
    const { E, F, O, P, Q, U, T } = g;
    if (!finitePoint(U) || !finitePoint(O.c)) return null;
    const u = sub(U, Q), d = Math.hypot(u.x, u.y);
    if (d < EPS) return null;
    const candidates = [1, -1].map((sign) => ({
      x: O.c.x + (sign * O.r * u.x) / d,
      y: O.c.y + (sign * O.r * u.y) / d,
    }));
    const scored = candidates.map((S) => ({ S, diff: Math.abs(angle(Q, U, S) - angle(Q, S, T)) }));
    scored.sort((a, b) => (Number.isFinite(a.diff) ? a.diff : Infinity) - (Number.isFinite(b.diff) ? b.diff : Infinity));
    const S = scored[0].S;
    const radius = dist(S, Q);
    const A = otherPoint(circleCircle(S, radius, E.c, E.r), Q);
    const B = otherPoint(circleCircle(S, radius, F.c, F.r), Q);
    if (finitePoint(A) && finitePoint(B) && dist(A, Q) > 1 && dist(B, Q) > 1) {
      return { S, A, B, angleDiff: scored[0].diff, product: dist(A, P) * dist(P, B) };
    }
    return { S, A: null, B: null, angleDiff: scored[0].diff, product: NaN };
  }

  /** A point S on the auxiliary circle gives a chord through P. */
  function chordFromS(state, S) {
    const { P, Q, A, B } = state;
    if (!finitePoint(S)) return null;
    const E = circumcircle(A, P, Q), F = circumcircle(B, P, Q);
    if (!E || !F) return null;
    const radius = dist(S, Q);
    const a = otherPoint(circleCircle(S, radius, E.c, E.r), Q);
    const b = otherPoint(circleCircle(S, radius, F.c, F.r), Q);
    if (!finitePoint(a) || !finitePoint(b)) return null;
    return { ...state, A: a, B: b };
  }

  /** A point of C(O) at the given angle, for exploring the whole circle. */
  function pointOnAux(state, radians) {
    const m = auxiliary(state);
    if (!m.valid) return null;
    return { x: m.O.c.x + m.O.r * Math.cos(radians), y: m.O.c.y + m.O.r * Math.sin(radians) };
  }

  /* ------------------------------------------------------- page claims */

  /** Is SN tangent to the auxiliary circle at S? That means OS || PQ. */
  function tangentAt(state, S) {
    const m = measure(state);
    if (!m.valid || !finitePoint(S)) return false;
    const u = sub(m.U, state.Q);
    const v = sub(S, m.O.c);
    const scale = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1;
    return Math.abs(cross(u, v)) / scale < 1e-6;
  }

  /** Claims about the current position and about the maximum, tested in Node. */
  function claims(state) {
    const m = measure(state);
    const falseClaims = { valid: false, chordThroughP: false, qrTwiceQn: false,
      sIsCentre: false, sOnAux: false, intersectingChords: false,
      bestIsArcMidpoint: false, bestIsTangent: false, bestIsMaximum: false };
    if (!m.valid || !m.S || !m.R || !m.N || !m.best || !m.O) return falseClaims;
    const scale = Math.max(dist(state.A, state.P), dist(state.B, state.P), dist(state.P, state.Q), 1);
    const tol = 1e-5 * scale;
    const u = sub(state.B, state.P), v = sub(state.A, state.P);
    const chordCross = Math.abs(cross(u, v)) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1);
    const d = sub(m.U, state.Q), len = Math.hypot(d.x, d.y) || 1;
    const axis = { x: d.x / len, y: d.y / len };
    const maxQN = Math.abs(dot(sub(m.O.c, state.Q), axis)) + m.O.r;
    const bestQN = Math.abs(dot(sub(m.best.S, state.Q), axis));
    return {
      valid: true,
      chordThroughP: chordCross < 1e-6,
      qrTwiceQn: close(m.QR, 2 * m.QN, tol),
      sIsCentre: close(dist(m.S, state.A), dist(m.S, state.Q), tol)
        && close(dist(m.S, state.B), dist(m.S, state.Q), tol),
      sOnAux: close(dist(m.S, m.O.c), m.O.r, tol),
      intersectingChords: close(m.product, m.pqpr, tol * scale),
      bestIsArcMidpoint: Number.isFinite(m.best.angleDiff) && m.best.angleDiff < 1e-6,
      bestIsTangent: tangentAt(state, m.best.S),
      bestIsMaximum: close(bestQN, maxQN, tol),
    };
  }

  /* ------------------------------------------------------------ movement */

  /** Apply an arrow-key or pointer move, with the applet's mode constraints. */
  function withPoint(state, name, p) {
    const q = { x: p.x, y: p.y };
    if (name === "P" || name === "Q") return { ...state, [name]: q };
    if (name === "A") {
      let A = q;
      if (!state.adjustCircles) {
        const E = circumcircle(state.A, state.P, state.Q);
        if (E) A = restrictToCircle(q, E);
      }
      const F = circumcircle(state.B, state.P, state.Q);
      return { ...state, A, B: fixPoint(state.B, F, A, state.P) };
    }
    if (name === "B") {
      let B = q;
      if (!state.adjustCircles) {
        const F = circumcircle(state.B, state.P, state.Q);
        if (F) B = restrictToCircle(q, F);
      }
      const E = circumcircle(state.A, state.P, state.Q);
      return { ...state, A: fixPoint(state.A, E, B, state.P), B };
    }
    return state;
  }

  /** The page has no win or loss: it is an illustration to explore. */
  function result(state) {
    return null;
  }

  return { start, auxiliary, measure, bestPosition, chordFromS, pointOnAux, claims, tangentAt,
    withPoint, result, dist, intersect, lineCircle, circleCircle, circumcircle, other,
    restrictToCircle, fixPoint, angle };
})();
