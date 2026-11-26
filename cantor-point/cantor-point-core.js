"use strict";

/*
 * CantorPoint — the illustration behind Bogomolny's "Cantor's Theorem".
 *
 * Drag the corners of a triangle. The tangent to its circumcircle at each
 * vertex is the side of the tangential triangle opposite that vertex. Draw
 * from the midpoint of the opposite side a line perpendicular to that tangent:
 * the three lines always meet at one point, the centre of the nine-point
 * circle. This common point is Cantor's point.
 *
 * The one idea the code relies on: put the origin at the circumcenter O. With
 * z_A, z_B, z_C the vertices, the midpoint of BC is (z_B+z_C)/2 and the
 * nine-point centre is N = (z_A+z_B+z_C)/2, so N - m_A = z_A/2 is parallel to
 * the radius OA and therefore perpendicular to the tangent at A. In ordinary
 * coordinates the same point is (A+B+C-O)/2, which is also the circumcenter
 * of the three side midpoints. For an inscribed n-gon the same sum divided by
 * n-1 gives the general Cantor point from the page's remark.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CantorPointCore, so the page loads it with a
 * plain <script> and porting/check-cantor-point.mjs loads it in Node. All
 * functions take plain data and return new objects; nothing passed in changes.
 */
const CantorPointCore = (() => {
  const EPS = 1e-9;

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dot = (a, b, c) => (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The applet's init(): a circle of radius min(w,h)/4 at the canvas centre,
   *  with the three vertices at the angles -1.6, -4 and -0.2 radians. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = width / 2, cy = height / 2;
    const radius = Math.min(width, height) / 4;
    const at = (angle) => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    return { A: at(-1.6), B: at(-4), C: at(-0.2) };
  }

  /** Circumcenter by solving the two perpendicular-bisector equations. The
   *  applet intersects two bisectors as lines; this is the same point by a
   *  different route, so the logic test can compare the two transcriptions. */
  function circumcenter(A, B, C) {
    const ax = B.x - A.x, ay = B.y - A.y;
    const bx = C.x - A.x, by = C.y - A.y;
    const det = 2 * (ax * by - ay * bx);
    if (!Number.isFinite(det) || Math.abs(det) < EPS) return { x: NaN, y: NaN };
    const aa = ax * ax + ay * ay;
    const bb = bx * bx + by * by;
    return { x: A.x + (aa * by - bb * ay) / det, y: A.y + (ax * bb - bx * aa) / det };
  }

  /** Intersection of the infinite lines P1P2 and P3P4 (parametric form). */
  function intersect(p1, p2, p3, p4) {
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
    const det = d1.x * d2.y - d1.y * d2.x;
    if (!Number.isFinite(det) || Math.abs(det) < EPS) return { x: NaN, y: NaN };
    const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / det;
    return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
  }

  /** A point on the tangent to the circle centred O at v. Rotating the radius
   *  the other way from the applet still gives the very same tangent line. */
  function tangentPoint(v, O) {
    const dx = O.x - v.x, dy = O.y - v.y;
    return { x: v.x + dy, y: v.y - dx };
  }

  function isDegenerate(s) {
    if (!finite(s.A) || !finite(s.B) || !finite(s.C)) return true;
    if (Math.abs(cross(s.A, s.B, s.C)) < 1e-7) return true;
    if (!finite(circumcenter(s.A, s.B, s.C))) return true;
    return Math.min(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A)) < EPS;
  }

  /** Every object the page draws and every number it describes. */
  function construct(s) {
    const A = s.A, B = s.B, C = s.C;
    if (isDegenerate(s)) return { degenerate: true };

    const O = circumcenter(A, B, C);
    const R = dist(O, A);

    const tanA = tangentPoint(A, O), tanB = tangentPoint(B, O), tanC = tangentPoint(C, O);

    // The tangential triangle: tAB is the intersection of the tangents at A
    // and B (applet L6), tBC at B and C (L7), tCA at C and A (L8).
    const tAB = intersect(A, tanA, B, tanB);
    const tBC = intersect(B, tanB, C, tanC);
    const tCA = intersect(C, tanC, A, tanA);

    // Midpoints of the three sides; mA is opposite A, and so on.
    const mA = mid(B, C), mB = mid(C, A), mC = mid(A, B);

    // Cantor's line from a midpoint is parallel to the radius of the opposite
    // vertex, hence perpendicular to the tangent that vertex lies on.
    const rA = { x: A.x - O.x, y: A.y - O.y };
    const rB = { x: B.x - O.x, y: B.y - O.y };
    const rC = { x: C.x - O.x, y: C.y - O.y };
    const lineA = { x: mA.x + rA.x, y: mA.y + rA.y };
    const lineB = { x: mB.x + rB.x, y: mB.y + rB.y };
    const lineC = { x: mC.x + rC.x, y: mC.y + rC.y };

    // The feet on the tangents (the applet's S15, S16 and S17).
    const footA = intersect(mA, lineA, A, tanA);
    const footB = intersect(mB, lineB, B, tanB);
    const footC = intersect(mC, lineC, C, tanC);

    // Cantor's point: the page's complex-number formula, in real coordinates.
    const P = { x: (A.x + B.x + C.x - O.x) / 2, y: (A.y + B.y + C.y - O.y) / 2 };
    // The nine-point centre is the circumcenter of the three midpoints and
    // its radius is half the circumradius.
    const N = circumcenter(mA, mB, mC);
    const r9 = dist(N, mA);

    return {
      degenerate: false, A, B, C, O, R,
      tanA, tanB, tanC, tAB, tBC, tCA,
      mA, mB, mC, rA, rB, rC, lineA, lineB, lineC,
      footA, footB, footC, P, N, r9,
    };
  }

  /** The page's claims, each measured independently at this triangle. */
  function claims(s) {
    const c = construct(s);
    const no = {
      circumcircle: false, tangentsPerpendicular: false, tangentialTriangle: false,
      feetOnTangents: false, linesPerpendicularToTangents: false,
      concurrent: false, atNinePointCenter: false, ninePointRadius: false, all: false,
    };
    if (c.degenerate) return no;

    const scale = Math.max(1, 2 * c.R);
    const tol = 1e-7 * scale;
    const onLine = (p, x, y) =>
      finite(p) && Math.abs(cross(x, y, p)) / dist(x, y) <= tol;
    // A right angle at a vertex makes the two opposite tangents parallel, so
    // that vertex of the tangential triangle is at infinity: there is nothing
    // to check there, but the other two vertices still lie on their tangents.
    const tangentVertex = (p, oneVertex, oneTangent, otherVertex, otherTangent) =>
      !finite(p) || (onLine(p, oneVertex, oneTangent) && onLine(p, otherVertex, otherTangent));
    const dotVec = (u, v) => u.x * v.x + u.y * v.y;

    // Intersect two Cantor lines; a third line through the same point means
    // all three concur, whatever the shape of the triangle.
    const Q = intersect(c.mA, c.lineA, c.mB, c.lineB);
    const lineDirA = { x: c.lineA.x - c.mA.x, y: c.lineA.y - c.mA.y };
    const lineDirB = { x: c.lineB.x - c.mB.x, y: c.lineB.y - c.mB.y };
    const lineDirC = { x: c.lineC.x - c.mC.x, y: c.lineC.y - c.mC.y };
    const tangentDirA = { x: c.tanA.x - c.A.x, y: c.tanA.y - c.A.y };
    const tangentDirB = { x: c.tanB.x - c.B.x, y: c.tanB.y - c.B.y };
    const tangentDirC = { x: c.tanC.x - c.C.x, y: c.tanC.y - c.C.y };

    const flags = {
      circumcircle:
        Math.abs(dist(c.O, c.A) - dist(c.O, c.B)) < tol &&
        Math.abs(dist(c.O, c.A) - dist(c.O, c.C)) < tol,
      tangentsPerpendicular:
        Math.abs(dot(c.A, c.tanA, c.O)) <= tol * dist(c.A, c.tanA) &&
        Math.abs(dot(c.B, c.tanB, c.O)) <= tol * dist(c.B, c.tanB) &&
        Math.abs(dot(c.C, c.tanC, c.O)) <= tol * dist(c.C, c.tanC),
      tangentialTriangle:
        tangentVertex(c.tAB, c.A, c.tanA, c.B, c.tanB) &&
        tangentVertex(c.tBC, c.B, c.tanB, c.C, c.tanC) &&
        tangentVertex(c.tCA, c.C, c.tanC, c.A, c.tanA),
      feetOnTangents:
        onLine(c.footA, c.A, c.tanA) && onLine(c.footB, c.B, c.tanB) &&
        onLine(c.footC, c.C, c.tanC),
      linesPerpendicularToTangents:
        Math.abs(dotVec(tangentDirA, lineDirA)) <= tol &&
        Math.abs(dotVec(tangentDirB, lineDirB)) <= tol &&
        Math.abs(dotVec(tangentDirC, lineDirC)) <= tol,
      concurrent:
        finite(Q) && onLine(Q, c.mA, c.lineA) && onLine(Q, c.mB, c.lineB) &&
        onLine(Q, c.mC, c.lineC),
      atNinePointCenter: finite(Q) && dist(Q, c.N) <= tol && dist(c.P, c.N) <= tol,
      ninePointRadius: Math.abs(c.r9 - c.R / 2) <= tol,
    };
    flags.all = Object.keys(flags).every((k) => flags[k]);
    return flags;
  }

  /** The remark on the page: for any polygon inscribed in a circle, one line
   *  per vertex through the centroid of the other vertices, perpendicular to
   *  the tangent there, all concur at (sum of vertices - O)/(n-1). */
  function polygonCantor(points) {
    if (!Array.isArray(points) || points.length < 3) return { degenerate: true };
    const O = circumcenter(points[0], points[1], points[2]);
    if (!finite(O)) return { degenerate: true };
    const n = points.length;
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    const P = { x: (sx - O.x) / (n - 1), y: (sy - O.y) / (n - 1) };
    const lines = points.map((p, i) => {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        gx += points[j].x;
        gy += points[j].y;
      }
      const g = { x: gx / (n - 1), y: gy / (n - 1) };
      return { g, dir: { x: p.x - O.x, y: p.y - O.y }, vertex: p };
    });
    return { degenerate: false, O, P, lines };
  }

  /** A new position with one named point moved; nothing else changes. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    start, circumcenter, intersect, tangentPoint, isDegenerate, construct,
    claims, polygonCantor, withPoint, result, dist, cross, dot, mid, finite,
  };
})();
