"use strict";

/*
 * Circle Center By Ruler — the ruler-only centre construction in Bogomolny's
 * applet CircleCenterByRuler (after H. Steinhaus, Mathematical Snapshots).
 *
 * Two circles meet at M and N. A draggable point A lies on the first circle and
 * a draggable point B' on the second. Draw AM to meet the second circle again
 * at B, draw BN to meet the first circle again at C, and repeat from B' to get
 * A' and C' on the first circle. Then the chords AA' and CC' are equal, the
 * chords AC and A'C' are equal, and the intersections P = AC ∩ A'C' and
 * Q = AA' ∩ CC' lie on a diameter of the first circle. When A' falls on top of
 * A the two lines AA' and CC' become the tangents at A and C, and Q is still
 * on that diameter. Two such diameters meet at the centre O.
 *
 * The code follows the applet's bytecode literally: circumcentres are found
 * by intersecting two perpendicular bisectors, line/circle intersections by
 * the applet's IntersectX/IntersectY split with its one-pixel "Other" test,
 * and the "same point" threshold is also one pixel. The one idea behind the
 * geometry is that inscribed angles standing on the same chord have equal
 * sines, so equal angles give equal chords and the two intersection points
 * are conjugate under the circle's reflection — their line is a diameter.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircleCenterByRulerCore, so the page loads it with a
 * plain <script> and porting/check-circle-center-by-ruler.mjs loads it in Node.
 * All functions take plain data and return new objects; nothing is mutated.
 */
const CircleCenterByRulerCore = (() => {
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** GeoSDoub.Intersect: ax+by+c=0 lines. Java returns NaN for |det| < 1. */
  function intersectLines(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - b2 * c1) / det,
      y: (c1 * a2 - c2 * a1) / det,
    };
  }

  /** GeoSDoub.FindCircumcenter: intersect two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
    const v1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const v2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersectLines(m1, v1, m2, v2);
  }

  /** GetCircle(DoubPoint, DoubPoint, DoubPoint): centre plus mean radius. */
  function circle3(p, q, r) {
    const center = circumcenter(p, q, r);
    return { center, radius: (dist(center, p) + dist(center, q) + dist(center, r)) / 3 };
  }

  /* GeoSDoub.Intersect(DoubLine, DoubCircle) uses y = slope*x + b when the
   * line is not horizontal, and x = slope*y + b otherwise. The order of the
   * two solutions matters to the applet's Other() tie-break, so keep it. */
  function intersectLineCircleX(p, q, circle) {
    const slope = (q.x - p.x) / (q.y - p.y);
    const b = q.x - slope * q.y;
    const A = slope * slope + 1;
    const B = slope * (b - circle.center.x) - circle.center.y;
    const C = circle.center.y * circle.center.y +
      (b - circle.center.x) * (b - circle.center.x) - circle.radius * circle.radius;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-B + root) / A, y2 = (-B - root) / A;
    return [{ x: slope * y1 + b, y: y1 }, { x: slope * y2 + b, y: y2 }];
  }

  function intersectLineCircleY(p, q, circle) {
    const slope = (q.y - p.y) / (q.x - p.x);
    const b = q.y - slope * q.x;
    const A = slope * slope + 1;
    const B = slope * (b - circle.center.y) - circle.center.x;
    const C = circle.center.x * circle.center.x +
      (b - circle.center.y) * (b - circle.center.y) - circle.radius * circle.radius;
    const disc = B * B - A * C;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-B + root) / A, x2 = (-B - root) / A;
    return [{ x: x1, y: slope * x1 + b }, { x: x2, y: slope * x2 + b }];
  }

  function intersectLineCircle(p, q, circle) {
    if (Math.abs(p.y - q.y) > 1) return intersectLineCircleX(p, q, circle);
    if (Math.abs(p.x - q.x) > 1) return intersectLineCircleY(p, q, circle);
    return null;
  }

  /** CircleCenterByRulerCanvas.Other: the crossing that is not `known`. */
  function other(points, known) {
    if (!points || points.length < 2) return null;
    return dist(points[0], known) >= 1 ? points[0] : points[1];
  }

  /** DoubCircle.Tangent: a direction vector for the tangent at a point. */
  function tangent(circle, p) {
    if (Math.abs(dist(circle.center, p) - circle.radius) > 1) return null;
    return { x: p.x + circle.center.y - p.y, y: p.y - (circle.center.x - p.x) };
  }

  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function invalid() {
    return {
      valid: false, circles: null,
      points: { M: null, N: null, A: null, Bp: null, B: null, C: null, Ap: null, Cp: null, P: null, Q: null, O: null },
      lines: null,
    };
  }

  /** The position a new diagram starts from. Uses the applet's init formula. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        M: { ...o.points.M }, N: { ...o.points.N },
        A: { ...o.points.A }, Bp: { ...o.points.Bp },
        showNames: o.showNames !== false,
        showStatement: Boolean(o.showStatement),
        showHint: Boolean(o.showHint),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const step = Math.min(width, height) / 5;
    return {
      M: { x: width / 2, y: height / 2 - step / 5 },
      N: { x: width / 2 + width / 20, y: height / 2 + step / 5 },
      A: { x: (width * 3) / 10, y: height / 2 - step / 10 },
      Bp: { x: (width * 7) / 8, y: height / 2 },
      showNames: o.showNames !== false,
      showStatement: Boolean(o.showStatement),
      showHint: Boolean(o.showHint),
    };
  }

  /** A new position with one named draggable point moved. */
  function withPoint(state, name, p) {
    if (!state[name] || !["M", "N", "A", "Bp"].includes(name)) return state;
    return { ...state, [name]: { x: p.x, y: p.y } };
  }

  /** A new position with one of the applet's three checkboxes flipped. */
  function withOption(state, name, value) {
    if (!["showNames", "showStatement", "showHint"].includes(name)) return state;
    return { ...state, [name]: Boolean(value) };
  }

  /** CircleCenterByRulerCanvas.Compute, with graceful hiding of dead ends. */
  function compute(state) {
    const { M, N, A, Bp } = state;
    if (![M, N, A, Bp].every(finite) || dist(M, N) < 2) return invalid();

    const circleA = circle3(A, M, N);
    const circleB = circle3(Bp, M, N);
    const B = other(intersectLineCircle(A, M, circleB), M);
    const C = other(intersectLineCircle(B || M, N, circleA), N);
    const Ap = other(intersectLineCircle(Bp, M, circleA), M);
    const Cp = other(intersectLineCircle(Bp, N, circleA), N);
    if (![circleA.center, circleB.center, B, C, Ap, Cp].every(finite)) return invalid();
    if (dist(B, Bp) < 2) return invalid(); // the applet's second guard

    /* When A and A' coincide the applet draws the tangents at A and C. */
    const coincident = dist(A, Ap) < 1;
    const dirA = coincident ? tangent(circleA, A) : Ap;
    const dirC = coincident ? tangent(circleA, C) : Cp;
    if (!finite(dirA) || !finite(dirC)) return invalid();

    const P = intersectLines(A, C, Ap, Cp);
    const Q = intersectLines(A, dirA, C, dirC);
    if (!finite(P) || !finite(Q)) return invalid();

    return {
      valid: true,
      circles: { A: circleA, B: circleB },
      points: { M, N, A, Bp, B, C, Ap, Cp, P, Q, O: circleA.center },
      lines: {
        AB: [A, B], BC: [B, C],
        ApBp: [Ap, Bp], BpCp: [Bp, Cp],
        AA: [A, dirA], CC: [C, dirC],
        AC: [A, C], ApCp: [Ap, Cp],
        PQ: [P, Q],
      },
      coincident,
    };
  }

  /** Unsigned angle at v between the rays to p and q (radians). */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y }, w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (norm < EPS) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / norm)));
  }

  /** The four angles drawn by the applet's ShowHint, and their sines. */
  function hintAngles(state) {
    const g = compute(state);
    if (!g.valid) return null;
    const { M, N, A, B, Bp, C, Ap, Cp } = g.points;
    const angles = {
      AMAp: angleAt(M, A, Ap),
      CNCp: angleAt(N, C, Cp),
      BMBp: angleAt(M, B, Bp),
      BNBp: angleAt(N, B, Bp),
    };
    const sines = Object.fromEntries(
      Object.entries(angles).map(([k, v]) => [k, Number.isFinite(v) ? Math.abs(Math.sin(v)) : NaN]),
    );
    return { angles, sines };
  }

  /** The page's claims, measured at one position. */
  function measurements(state) {
    const g = compute(state);
    if (!g.valid) return { valid: false };
    const { A, B, C, Ap, Cp, P, Q, O } = g.points;
    const cross = (P.x - O.x) * (Q.y - O.y) - (P.y - O.y) * (Q.x - O.x);
    const scale = Math.max(dist(P, O), dist(Q, O), 1);
    /* In the tangent branch A' = A and C' = C, so P = AC ∩ A'C' is the
     * intersection of two nearly identical lines and is numerically useless.
     * What survives is that the intersection Q of the tangents lies on the
     * diameter perpendicular to the chord AC. */
    const dot = (Q.x - O.x) * (A.x - C.x) + (Q.y - O.y) * (A.y - C.y);
    const tangentScale = Math.max(dist(Q, O) * dist(A, C), 1);
    const hints = hintAngles(state);
    return {
      valid: true, geometry: g, coincident: g.coincident,
      chordAAp: dist(A, Ap), chordCCp: dist(C, Cp),
      chordAC: dist(A, C), chordApCp: dist(Ap, Cp),
      diameterOffset: Math.abs(cross) / scale,
      tangentDiameterOffset: Math.abs(dot) / tangentScale,
      angleSines: hints.sines,
      angles: hints.angles,
    };
  }

  function claims(state) {
    const m = measurements(state);
    if (!m.valid) return { valid: false, all: false };
    const tol = 1e-6 * Math.max(m.chordAC, m.chordAAp, 1);
    const sinValues = Object.values(m.angleSines);
    const sineSpread = Math.max(...sinValues) - Math.min(...sinValues);
    return {
      valid: true,
      equalShortChords: Math.abs(m.chordAAp - m.chordCCp) <= tol,
      equalLongChords: Math.abs(m.chordAC - m.chordApCp) <= tol,
      diameterThroughPQ: (m.coincident ? m.tangentDiameterOffset : m.diameterOffset) <= 1e-6,
      equalAngleSines: sineSpread <= 1e-6,
      all: Math.abs(m.chordAAp - m.chordCCp) <= tol &&
        Math.abs(m.chordAC - m.chordApCp) <= tol &&
        (m.coincident ? m.tangentDiameterOffset : m.diameterOffset) <= 1e-6 && sineSpread <= 1e-6,
    };
  }

  /** An illustration has no win, loss or finishing move. */
  function result(/* state */) {
    return null;
  }

  return {
    dist, intersectLines, circumcenter, circle3, intersectLineCircle, other, tangent,
    start, withPoint, withOption, compute, angleAt, hintAngles, measurements, claims, result,
  };
})();
