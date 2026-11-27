"use strict";

/*
 * Five Concyclic Points, from Alexander Bogomolny's applet FiveConcyclicPoints
 * and the cut-the-knot page "Five Concyclic Points" (a problem of Bui Quang
 * Tuan). Two lines L1 = MN and L2 = PQ meet at X. Circles MPX and NPX are cut
 * by the lines QLm and QLn at M1,M2 and N1,N2; those four points lie on a
 * circle (O), which meets L1 at M3,N3. The second intersection of circle MQX
 * with QLm is M4, and of NQX with QLn is N4. The page claims that Q, M3, N3,
 * M4, N4 lie on one circle.
 *
 * The key idea copied from the applet's Compute method is to build that last
 * circle through Q, M3 and N3, then locate M4 and N4 independently. The
 * radical-axis proof explains why they agree. Every construction step below
 * mirrors the applet's own bytecode: GeoSDoub.Intersect (including its
 * |determinant| < 1 cut-off), FindCircumcenter, GetCircle (whose radius is the
 * mean of the three distances to the circumcenter), and the IntersectX /
 * IntersectY split at |y1-y2| <= 1 for circle-line intersections.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, FiveConcyclicPointsCore. The position is plain data - the six
 * draggable points in board units - so it can be saved for the tutor.
 */

const FiveConcyclicPointsCore = (() => {
  // The page embeds the applet at 500 x 450; the AWT panel below the canvas
  // takes about 30px, so the drawing board is 500 x 420 here. The initial
  // points are the applet's exact fractions of the canvas size:
  // M = (3W/5, 4H/5), N = (W/5, H/5), P = (3W/5, H/4),
  // Q = (W/4, 4H/5), Lm = (5W/6, H/6), Ln = (W/2, H/6).
  const WIDTH = 500;
  const HEIGHT = 420;
  const NAMES = ["M", "N", "P", "Q", "Lm", "Ln"];
  const EDGE = 8; // UI keeps a handle fully inside the board

  const START = {
    M: { x: (3 * WIDTH) / 5, y: (4 * HEIGHT) / 5 },
    N: { x: WIDTH / 5, y: HEIGHT / 5 },
    P: { x: (3 * WIDTH) / 5, y: HEIGHT / 4 },
    Q: { x: WIDTH / 4, y: (4 * HEIGHT) / 5 },
    Lm: { x: (5 * WIDTH) / 6, y: HEIGHT / 6 },
    Ln: { x: WIDTH / 2, y: HEIGHT / 6 },
  };

  const copyPoint = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampPoint = (p) => ({
    x: clamp(Number.isFinite(p && p.x) ? p.x : WIDTH / 2, EDGE, WIDTH - EDGE),
    y: clamp(Number.isFinite(p && p.y) ? p.y : HEIGHT / 2, EDGE, HEIGHT - EDGE),
  });

  /** GeoSDoub.Intersect(DoubPoint x4): NaN coordinates when |det| < 1. */
  function intersect(a, b, c, d) {
    const a1 = b.y - a.y, b1 = a.x - b.x, c1 = b.x * a.y - a.x * b.y;
    const a2 = d.y - c.y, b2 = c.x - d.x, c2 = d.x * c.y - c.x * d.y;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** GeoSDoub.FindCircumcenter, transcribed line by line. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const u = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const v = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, u, m2, v);
  }

  /** FiveConcyclicPointsCanvas.GetCircle: mean distance as radius. */
  function circleThrough(a, b, c) {
    const center = circumcenter(a, b, c);
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    return { center, radius };
  }

  /**
   * GeoSDoub.Intersect(DoubCircle, DoubLine). Near-horizontal lines use the
   * y-as-a-function-of-x branch (IntersectY), all others use IntersectX.
   */
  function circleLine(circle, a, b) {
    const c = circle.center;
    let x1, y1, x2, y2;
    if (Math.abs(a.y - b.y) <= 1) {
      const m = (a.y - b.y) / (a.x - b.x);
      const intercept = b.y - m * b.x;
      const qa = m * m + 1;
      const qc = m * (intercept - c.y) - c.x;
      const qd = c.x * c.x + (intercept - c.y) * (intercept - c.y) - circle.radius * circle.radius;
      const disc = qc * qc - qa * qd;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      x1 = (-qc + root) / qa;
      x2 = (-qc - root) / qa;
      y1 = m * x1 + intercept;
      y2 = m * x2 + intercept;
    } else {
      const m = (a.x - b.x) / (a.y - b.y);
      const intercept = b.x - m * b.y;
      const qa = m * m + 1;
      const qc = m * (intercept - c.x) - c.y;
      const qd = c.y * c.y + (intercept - c.x) * (intercept - c.x) - circle.radius * circle.radius;
      const disc = qc * qc - qa * qd;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      y1 = (-qc + root) / qa;
      y2 = (-qc - root) / qa;
      x1 = m * y1 + intercept;
      x2 = m * y2 + intercept;
    }
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  /** Canvas.Other: p[0] unless it is within 1px of the known point. */
  function other(points, known) {
    if (!points) return null;
    return dist(points[0], known) >= 1 ? points[0] : points[1];
  }

  /** The position a new diagram starts from. */
  function start() {
    const s = {};
    for (const name of NAMES) s[name] = copyPoint(START[name]);
    return s;
  }

  /** Move one of the six draggable points; never change the given position. */
  function setPoint(state, name, p) {
    if (!NAMES.includes(name)) return start();
    const next = {};
    for (const key of NAMES) next[key] = copyPoint(state[key]);
    next[name] = clampPoint(p);
    return next;
  }

  /** Everything the page draws, derived from the six handles. */
  function geometry(state) {
    const { M, N, P, Q, Lm, Ln } = state;
    const X = intersect(M, N, P, Q);
    const MPX = circleThrough(M, P, X);
    const NPX = circleThrough(N, P, X);
    const MQX = circleThrough(M, Q, X);
    const NQX = circleThrough(N, Q, X);

    const Mm = circleLine(MPX, Q, Lm);
    const Nn = circleLine(NPX, Q, Ln);
    if (!Mm || !Nn || !finite(X) || !finite(MPX.center) || !finite(NPX.center) ||
        !finite(MQX.center) || !finite(NQX.center)) {
      return { X, MPX, NPX, MQX, NQX, Mm, Nn, valid: false };
    }

    // Compute picks whichever secant is longer to define circle (O).
    const CircleO = dist(Mm[0], Mm[1]) > 2
      ? circleThrough(Mm[0], Mm[1], Nn[0])
      : circleThrough(Nn[0], Nn[1], Mm[0]);
    const S = circleLine(CircleO, M, N); // M3, N3 on MN
    const U = other(circleLine(MQX, Q, Lm), Q); // M4 on QLm
    const V = other(circleLine(NQX, Q, Ln), Q); // N4 on QLn
    const CircleQ = S ? circleThrough(Q, S[0], S[1]) : null;

    const Y = intersect(Q, Lm, M, N); // Lm meets MN
    const Z = intersect(Q, Ln, M, N); // Ln meets MN

    const valid = !!S && !!CircleQ && finite(CircleO.center) &&
      finite(CircleQ.center) && finite(U) && finite(V) && finite(Y) && finite(Z);

    // How far the five claimed points are from their common circle.
    let gap = NaN;
    if (valid) {
      gap = Math.max(...[Q, S[0], S[1], U, V].map((p) => Math.abs(dist(p, CircleQ.center) - CircleQ.radius)));
    }
    let auxGap = NaN;
    if (valid) {
      auxGap = Math.max(...[Mm[0], Mm[1], Nn[0], Nn[1]]
        .map((p) => Math.abs(dist(p, CircleO.center) - CircleO.radius)));
    }
    return {
      X, MPX, NPX, MQX, NQX, Mm, Nn,
      CircleO, CircleQ, S, M3: S && S[0], N3: S && S[1], M4: U, N4: V,
      Y, Z, valid, gap, auxGap,
    };
  }

  /** A compact JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const round = (v) => (Number.isFinite(v) ? Number(v.toFixed(4)) : null);
    const pt = (p) => ({ x: round(p.x), y: round(p.y) });
    const out = {};
    for (const name of NAMES) out[name] = pt(state[name]);
    return out;
  }

  return {
    WIDTH, HEIGHT, NAMES, START, EDGE,
    dist, clamp, clampPoint, intersect, circumcenter, circleThrough, circleLine, other,
    start, setPoint, geometry, position,
  };
})();
