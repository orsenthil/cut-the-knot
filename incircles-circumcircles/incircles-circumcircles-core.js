"use strict";

/*
 * IncirclesCircumcircles — Bogomolny's "A problem with incircles and
 * circumcircles": drag a triangle ABC. I is its incenter; the circumcenters of
 * IBC, ICA and IAB lie on the circumcircle of ABC. Each of those centers is
 * also the second meeting of the corresponding angle bisector with that
 * circle, and the circle centered there through B and C passes through I.
 *
 * The construction follows the bytecode literally: GeoSDoub.FindIncenter
 * rotates a ray at A and B by half an angle and intersects the two rays;
 * GeoSDoub.FindCircumcenter intersects two perpendicular bisectors; each
 * drawn circle uses the applet's own average of the centre-to-point
 * distances. The independent side-length formula for I and the ordinary
 * perpendicular-bisector circumcenter let the logic test check the page's
 * claims without trusting the same arithmetic twice.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, IncirclesCircumcirclesCore, so the page
 * loads it with a plain <script> and porting/check-incircles-circumcircles.mjs
 * loads it in Node. Positions are plain data; nothing passed in is changed.
 */
const IncirclesCircumcirclesCore = (() => {
  const EPS = 1e-9;
  const STEP = 40; // the applet's local k = 40 in Canvas.Reset()

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const dotAt = (v, p, q) => (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);

  /** GeoSDoub.FindOrientation: +1 for a positive signed area, else -1. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: rotate Q about P by angle * handedness. */
  function rotate(p, q, angle, handedness) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: p.x + cs * (q.x - p.x) - handedness * sn * (q.y - p.y),
      y: p.y + handedness * sn * (q.x - p.x) + cs * (q.y - p.y),
    };
  }

  /** GeoSDoub.Intersect: two infinite lines; NaN when the determinant is < 1. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.ComputeAngle: law of cosines at p. */
  function angleAt(p, q, r) {
    const len = distance(p, q) * distance(p, r);
    if (len < EPS) return NaN;
    const cos = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / (2 * len);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.NearestPoint: foot of the perpendicular onto the infinite line xy. */
  function nearestPoint(p, x, y) {
    if (sqDist(x, p) < 0.1) return { x: p.x, y: p.y };
    const dx = y.x - x.x, dy = y.y - x.y;
    const t = (dx * (p.x - x.x) + dy * (p.y - x.y)) / (dx * dx + dy * dy);
    return { x: x.x + dx * t, y: x.y + dy * t };
  }

  /** The applet's GeoSDoub.FindIncenter(A, B, C), transcribed from bytecode. */
  function findIncenter(A, B, Cc) {
    const a = angleAt(A, B, Cc) / 2;
    const b = angleAt(B, Cc, A) / 2;
    const handedness = orientation(A, B, Cc);
    return intersect(A, rotate(A, B, a, handedness), B, rotate(B, Cc, b, handedness));
  }

  /** Independent check: side lengths are the barycentric weights of I. */
  function incenter(s) {
    if (isDegenerate(s)) return null;
    const { a, b, c } = sides(s);
    const sum = a + b + c;
    return {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function findCircumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const off1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const off2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersect(m1, off1, m2, off2);
  }

  /** The applet's DrawCircumcircle: centre plus the mean of three distances. */
  function smallCircle(p, q, r) {
    const center = findCircumcenter(p, q, r);
    if (!finite(center)) return null;
    const radius = (distance(center, p) + distance(center, q) + distance(center, r)) / 3;
    return { center, radius };
  }

  /** The big circle: centre plus the distance to A, as the applet does. */
  function bigCircle(s) {
    const center = findCircumcenter(s.A, s.B, s.C);
    if (!finite(center)) return null;
    return { center, radius: distance(center, s.A) };
  }

  /** The applet's incircle radius: the mean of the three distances to the sides. */
  function incircle(s, I) {
    const foot = nearestPoint;
    const radius = (
      distance(I, foot(I, s.B, s.C)) +
      distance(I, foot(I, s.C, s.A)) +
      distance(I, foot(I, s.A, s.B))
    ) / 3;
    return { center: I, radius };
  }

  /** Canvas.Reset() with a width x height canvas: A=(W/2-4k,H/2), ... . */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    return {
      A: { x: width / 2 - 4 * STEP, y: height / 2 },
      B: { x: width / 2 + 2 * STEP, y: height / 2 + 2 * STEP },
      C: { x: width / 2, y: height / 2 - 2 * STEP },
    };
  }

  /** A new position with one named corner moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  function sides(s) {
    return { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) };
  }

  function doubleArea(s) {
    return Math.abs(cross(s.A, s.B, s.C));
  }

  function isDegenerate(s) {
    const l = sides(s);
    return doubleArea(s) < 1e-7 || Math.min(l.a, l.b, l.c) < EPS;
  }

  /** The second crossing of the infinite line pq with a circle, if any. */
  function secondCircleCross(center, radius, p, q, ref) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS || !finite(center)) return null;
    const t = ((center.x - p.x) * dx + (center.y - p.y) * dy) / len2;
    const f = { x: p.x + dx * t, y: p.y + dy * t };
    const h2 = radius * radius - ((center.x - f.x) ** 2 + (center.y - f.y) ** 2);
    if (h2 < 0) return null;
    const h = Math.sqrt(h2 / len2);
    const first = { x: f.x - dx * h, y: f.y - dy * h };
    const other = { x: f.x + dx * h, y: f.y + dy * h };
    if (ref && distance(first, ref) < distance(other, ref)) return other;
    return first;
  }

  /** Everything the page draws, in the applet's construction order. */
  function measure(s) {
    const I = findIncenter(s.A, s.B, s.C);
    const ok = !isDegenerate(s) && finite(I);
    const inc = ok ? incircle(s, I) : null;
    const big = ok ? bigCircle(s) : null;
    /* DrawAddOns calls (I,A,B) labelled "C", (I,B,C) labelled "A",
       (I,C,A) labelled "B". */
    const small = ok ? {
      C: smallCircle(I, s.A, s.B),
      A: smallCircle(I, s.B, s.C),
      B: smallCircle(I, s.C, s.A),
    } : { A: null, B: null, C: null };

    return {
      A: s.A, B: s.B, C: s.C,
      I, baryI: incenter(s),
      sides: sides(s), doubleArea: doubleArea(s),
      degenerate: !ok,
      incircle: inc, bigCircle: big, small,
      /* Midpoints of BC, CI, IB used in the page's angle argument. */
      mid: ok ? {
        a: midpoint(s.B, s.C), b: midpoint(s.C, I), c: midpoint(I, s.B),
      } : null,
    };
  }

  /** Every claim on the applet's page, tested at this triangle. */
  function claims(s) {
    const m = measure(s);
    const empty = {
      incenterFormula: false, incircleTouchesSides: false, radiiAreTrue: false,
      centersOnCircumcircle: false, centersOnBisectors: false,
      arcMidpoints: false, johnsonCircle: false, angleHalves: false,
      angleBDC: false, concentric: false, all: false,
    };
    if (m.degenerate || !m.bigCircle || !m.baryI) return empty;

    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-6 * scale;
    const close = (u, v) => Number.isFinite(u) && Number.isFinite(v) && Math.abs(u - v) <= tol;
    const onCircle = (p, c) => p && close(distance(c.center, p), c.radius);
    const onLine = (p, x, y) =>
      p && Math.abs(cross(x, y, p)) / (distance(x, y) || 1) <= tol;
    const { A, B, C, I } = m;
    const O = m.bigCircle;
    const small = m.small;

    const triples = {
      A: [I, B, C], B: [I, C, A], C: [I, A, B],
    };
    const allSmall = [small.A, small.B, small.C].every(Boolean);
    const incenterFormula = distance(m.I, m.baryI) <= tol;
    const feet = [nearestPoint(I, B, C), nearestPoint(I, C, A), nearestPoint(I, A, B)];
    const inradius = m.doubleArea / (m.sides.a + m.sides.b + m.sides.c);
    const incircleTouchesSides = feet.every((f) => close(distance(I, f), m.incircle.radius)) &&
      close(m.incircle.radius, inradius);
    const radiiAreTrue = allSmall && Object.keys(triples).every((key) =>
      triples[key].every((p) => close(distance(small[key].center, p), small[key].radius)));

    const centersOnCircumcircle = allSmall &&
      [small.A, small.B, small.C].every((c) => onCircle(c.center, O));
    const centersOnBisectors = allSmall &&
      onLine(small.A.center, A, I) && onLine(small.B.center, B, I) && onLine(small.C.center, C, I);

    /* The second crossing of each bisector with the circumcircle is its centre. */
    const arcMidpoints = allSmall && ["A", "B", "C"].every((key) => {
      const crossPoint = secondCircleCross(O.center, O.radius, s[key], I, s[key]);
      return crossPoint && distance(crossPoint, small[key].center) <= tol;
    });

    /* Johnson: the circle centred at O_A with radius DB = DC passes through I. */
    const johnsonCircle = allSmall &&
      close(distance(small.A.center, B), distance(small.A.center, C)) &&
      close(distance(small.A.center, B), distance(small.A.center, I));

    /* The page's angle equations: MaDMc = IBC = B/2, MaDMb = ICB = C/2. */
    const angleHalves = allSmall && Boolean(m.mid) &&
      close(angleAt(small.A.center, m.mid.a, m.mid.c), angleAt(B, I, C)) &&
      close(angleAt(small.A.center, m.mid.a, m.mid.b), angleAt(C, I, B)) &&
      close(angleAt(B, I, C), angleAt(B, A, C) / 2) &&
      close(angleAt(C, I, B), angleAt(C, A, B) / 2);
    const angleBDC = allSmall &&
      close(angleAt(small.A.center, B, C), angleAt(B, A, C) + angleAt(C, A, B));

    /* The 1988 Olympiad variant: the two circles have the same centre. */
    const centerOfCenters = allSmall
      ? findCircumcenter(small.A.center, small.B.center, small.C.center) : null;
    const concentric = Boolean(centerOfCenters) && finite(centerOfCenters) &&
      distance(centerOfCenters, O.center) <= tol;

    const out = {
      incenterFormula, incircleTouchesSides, radiiAreTrue,
      centersOnCircumcircle, centersOnBisectors, arcMidpoints,
      johnsonCircle, angleHalves, angleBDC, concentric,
    };
    out.all = Object.values(out).every(Boolean);
    return out;
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    STEP, start, withPoint, sides, doubleArea, isDegenerate, distance, sqDist,
    cross, midpoint, orientation, rotate, intersect, angleAt, nearestPoint,
    findIncenter, findCircumcenter, incenter, smallCircle, bigCircle, incircle,
    secondCircleCross, measure, claims, result,
  };
})();
