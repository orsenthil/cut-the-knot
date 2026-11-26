"use strict";

/*
 * Angle Bisector In Rectangle, from Alexander Bogomolny's applet
 * AngleBisectorInRectangle (Prasolov, Problems in Planimetry I, p. 12).
 *
 * ABCD is a rectangle. M and N are the midpoints of AD and BC, P lies on the
 * line CD, and Q = AC ∩ MP. The theorem is that MN bisects the angle PNQ:
 * angle QNM = angle MNP, for every rectangle and every P on CD.
 *
 * The one idea the code relies on is that everything can be built with two
 * straightedge operations: a midpoint and an intersection of two lines. The
 * auxiliary point K is where NQ meets the line through the centre O parallel
 * to BC. Then K lies on the perpendicular bisector of MN, so KM = KN, and the
 * proportion MP/MQ = KN/KQ makes KM parallel to NP; the two equalities give
 * the bisection. All positions are plain data, and nothing here touches the
 * DOM, storage or the window.
 */
const AngleBisectorInRectangleCore = (() => {
  const TOL = 1e-8;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const ratio = (a, b) => (b > TOL ? a / b : null);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** GeoSDoub.Intersect: ax+by+c=0 form, with the applet's own parallel test. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** CTKGeometryPlus.GetParallelTo: p + 100·(q-r), a point on the parallel. */
  function parallelPoint(p, q, r) {
    return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
  }

  /** The drawing the applet starts with, for a canvas of the given pixel size. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const w = Math.floor(width / 3);
    const h = Math.floor(height / 4);
    const A = { x: w, y: h };
    const B = { x: A.x, y: height - h };
    const C = { x: width - w, y: B.y };
    const D = { x: C.x, y: A.y };
    const P = { x: C.x, y: A.y - Math.floor(h / 2) };
    return { A, B, C, D, P };
  }

  /** Angle at v between the rays to p and q, in radians. */
  function angleAt(v, p, q) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const norm = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (norm < TOL) return NaN;
    const c = (u.x * w.x + u.y * w.y) / norm;
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  /** The five derived points, in the exact order of Canvas.Compute(). */
  function construct(s) {
    const M = mid(s.A, s.D);
    const N = mid(s.B, s.C);
    const Q = intersect(s.A, s.C, M, s.P);
    const O = mid(s.A, s.C);
    const K = intersect(Q, N, O, parallelPoint(O, s.B, s.C));
    return { M, N, O, Q, K };
  }

  /**
   * A position with one named point moved. The four corners keep the rectangle
   * axis-aligned exactly as Canvas.AdjustPoints does, and P keeps its x fixed
   * (Canvas.Fix(1)), so it slides along CD.
   */
  function withPoint(s, name, p) {
    const q = { x: p.x, y: p.y };
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C }, D: { ...s.D }, P: { ...s.P },
    };
    if (name === "A") {
      next.A = q; next.B.x = q.x; next.D.y = q.y;
    } else if (name === "B") {
      next.B = q; next.A.x = q.x; next.C.y = q.y;
    } else if (name === "C") {
      next.C = q; next.D.x = q.x; next.B.y = q.y; next.P.x = q.x;
    } else if (name === "D") {
      next.D = q; next.C.x = q.x; next.A.y = q.y; next.P.x = q.x;
    } else if (name === "P") {
      next.P = { x: s.C.x, y: q.y };
    }
    return next;
  }

  /** The page's assertions, measured numerically at this diagram. */
  function claims(s) {
    const g = construct(s);
    const onLine = (p, x, y) => Math.abs(cross(x, y, p)) <= TOL;
    const parallelVectors = (a, b) =>
      Math.abs(a.x * b.y - a.y * b.x) <= TOL * (Math.hypot(a.x, a.y) + Math.hypot(b.x, b.y) + 1);

    const valid = finite(g.Q) && finite(g.K) &&
      dist(g.M, s.P) > TOL && dist(g.N, s.P) > TOL;

    const MP = dist(g.M, s.P), MQ = dist(g.M, g.Q);
    const CO = dist(s.C, g.O), OQ = dist(g.O, g.Q);
    const KN = dist(g.K, g.N), KQ = dist(g.K, g.Q), KM = dist(g.K, g.M);
    const NQ = dist(g.N, g.Q);

    const angleQNM = valid ? angleAt(g.N, g.Q, g.M) : NaN;
    const angleMNP = valid ? angleAt(g.N, g.M, s.P) : NaN;
    const r1 = ratio(MP, MQ), r2 = ratio(CO, OQ);
    const r3 = ratio(KN, KQ), r4 = ratio(KN, NQ);
    const eq = (a, b) => a !== null && b !== null && Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

    const NP = { x: s.P.x - g.N.x, y: s.P.y - g.N.y };
    const KMvec = { x: g.M.x - g.K.x, y: g.M.y - g.K.y };

    /*
     * Two cautions about the archived page. Its third proportion reads
     * MP/MQ = KN/NQ, but the construction gives KN/NQ = |p|/|p+t| while
     * MP/MQ = |p|/t: NQ is a typo for KQ, which is what KM || NP needs.
     * It also says "P lies on CD" without saying where on CD. The
     * equality it asks for is only true while P is above the centre O: below
     * O the ray NQ points the other way and MN bisects the EXTERNAL angle at
     * N (angle QNM + angle MNP = 180 degrees). The applet starts P above D,
     * i.e. in the range where the page's equality is true, and dragging the
     * corners keeps it there. Both relations are reported separately.
     */
    const aboveO = valid && s.P.y < g.O.y;
    return {
      valid,
      aboveO,
      angleQNM,
      angleMNP,
      anglesEqual: aboveO && Number.isFinite(angleQNM) &&
        Math.abs(angleQNM - angleMNP) < 1e-9,
      exteriorEqual: valid && !aboveO && Number.isFinite(angleQNM) &&
        Math.abs(angleQNM + angleMNP - Math.PI) < 1e-9,
      midpointM: dist(mid(s.A, s.D), g.M) < TOL,
      midpointN: dist(mid(s.B, s.C), g.N) < TOL,
      midpointO: dist(mid(s.A, s.C), g.O) < TOL,
      QonAC: valid && onLine(g.Q, s.A, s.C),
      QonMP: valid && onLine(g.Q, g.M, s.P),
      KonQN: valid && onLine(g.K, g.Q, g.N),
      KOparallelBC: valid && Math.abs(g.K.y - g.O.y) <=
        TOL * Math.max(1, Math.abs(s.B.x - s.C.x), Math.abs(s.B.y - s.C.y)),
      r_MP_MQ: r1,
      r_CO_OQ: r2,
      r_KN_KQ: r3,
      r_KN_NQ: r4,
      firstProportion: valid && eq(r1, r2),
      secondProportion: valid && eq(r2, r3),
      correctedThird: valid && eq(r1, r3),
      printedThird: valid && eq(r1, r4),
      isosceles: valid && Math.abs(KM - KN) <= TOL * Math.max(1, KM),
      KMparallelNP: valid && parallelVectors(KMvec, NP),
      reflectionCollinear: valid && onLine(
        { x: 2 * g.M.x - s.P.x, y: s.P.y }, g.Q, g.N),
    };
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    start, construct, withPoint, claims, intersect, parallelPoint,
    angleAt, mid, dist, result, TOL,
  };
})();
