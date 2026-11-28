"use strict";

/*
 * InAndCircumcenter — Bogomolny's "A Property of the Line IO".
 *
 * Drag the corners of triangle ABC. Lay the side AB off along the two sides
 * through C: BD = AE = AB, and join D to E. The page asks for two things:
 * DE is perpendicular to the line joining the incenter I to the circumcenter O
 * for every triangle, and DE = IO when angle C is 30 degrees. In general
 * DE = 2·IO·sin(C), which the logic test checks over hundreds of triangles.
 *
 * This file follows InAndCircumcenterCanvas.Compute from the bytecode:
 * FindIncenter and FindCircumcenter from GeoSDoub, PlacePoint for D and E,
 * midpoints of BC and AC, NearestPoint for the hint points, then the two
 * DoubLines IO and DE and their intersection S. The in- and circumcircle
 * radii are the applet's own averages of three centre-to-point distances.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const InAndCircumcenterCore = (() => {
  const EPS = 1e-9;

  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const dot = (u, v) => u.x * v.x + u.y * v.y;

  /** GeoSDoub.FindOrientation: +1 for a positive signed area, else -1. */
  function orientation(p, q, r) {
    const s = cross(p, q, r);
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
    const cos = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * dist(p, q) * dist(p, r));
    return Math.acos(cos); // Java Math.acos: NaN outside [-1, 1]
  }

  /** GeoSDoub.FindIncenter(A, B, C): the bisectors from A and B meet at I. */
  function findIncenter(a, b, c) {
    const hand = orientation(a, b, c);
    const rayA = rotate(a, b, angleAt(a, b, c) / 2, hand);
    const rayB = rotate(b, c, angleAt(b, c, a) / 2, hand);
    return intersect(a, rayA, b, rayB);
  }

  /** GeoSDoub.FindCircumcenter(A, B, C): two perpendicular bisectors. */
  function findCircumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const off1 = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
    const off2 = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
    return intersect(m1, off1, m2, off2);
  }

  /** GeoSDoub.NearestPoint(p, x, y): the foot of the perpendicular to xy. */
  function nearestPoint(p, x, y) {
    const den = sqDist(x, y);
    if (den < 0.1) return { x: p.x, y: p.y };
    const dx = y.x - x.x, dy = y.y - x.y;
    const t = ((p.x - x.x) * dx + (p.y - x.y) * dy) / den;
    return { x: x.x + dx * t, y: x.y + dy * t };
  }

  /** Canvas.PlacePoint(p, q, r): go from p towards r for distance |pq|. */
  function placePoint(p, q, r) {
    const wanted = dist(p, q), have = dist(p, r);
    const t = wanted / have;
    return { x: p.x + (r.x - p.x) * t, y: p.y + (r.y - p.y) * t };
  }

  /** Canvas.GetIncircle / GetCircumcircle: the averaged radius the applet uses. */
  function circle(center, points) {
    let sum = 0;
    for (const p of points) sum += dist(center, p);
    return { center, radius: sum / points.length };
  }

  function incircle(a, b, c) {
    const I = findIncenter(a, b, c);
    const feet = [nearestPoint(I, a, b), nearestPoint(I, b, c), nearestPoint(I, c, a)];
    return { center: I, radius: feet.reduce((s, f) => s + dist(I, f), 0) / 3 };
  }

  function circumcircle(a, b, c) {
    const O = findCircumcenter(a, b, c);
    return { center: O, radius: (dist(O, a) + dist(O, b) + dist(O, c)) / 3 };
  }

  /**
   * Canvas.init() with a 450-by-450 applet (the size on the page). Java's
   * integer divisions matter: A=(150,360), B=(330,300), C=(112,112).
   */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const w = o.width === undefined ? 450 : o.width;
    const h = o.height === undefined ? 450 : o.height;
    return {
      A: { x: Math.floor(w / 3), y: Math.floor((4 * h) / 5) },
      B: { x: Math.floor((11 * w) / 15), y: Math.floor((2 * h) / 3) },
      C: { x: Math.floor(w / 4), y: Math.floor(h / 4) },
    };
  }

  /** A new position with one named corner moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /**
   * A presentation helper, not an applet control: turn B around C until the
   * angle at C is the wanted number of degrees. Both sides meeting at C keep
   * their lengths, so the 30-degree equality can be seen exactly.
   */
  function withAngleC(s, degrees) {
    const v = sub(s.A, s.C), w = sub(s.B, s.C);
    const current = Math.atan2(cross(s.C, s.A, s.B), dot(v, w));
    if (!Number.isFinite(current) || Math.hypot(v.x, v.y) < EPS || Math.hypot(w.x, w.y) < EPS) {
      return { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    }
    const wanted = (current < 0 ? -1 : 1) * (degrees * Math.PI) / 180;
    return withPoint(s, "B", rotate(s.C, s.B, wanted - current, 1));
  }

  function isDegenerate(s) {
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7 ||
      Math.min(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A)) < EPS;
  }

  /** InsideTest.IsInside(p, q, r): q and r lie on the same ray from p. */
  function insideTest(p, q, r) {
    return (q.x - p.x) * (r.x - p.x) + (q.y - p.y) * (r.y - p.y) > 0;
  }

  /** Canvas.DrawExtraLine: extend an endpoint along its side when needed. */
  function extraSegment(p, q, r) {
    if (insideTest(p, q, r)) return [p, q];
    if (insideTest(r, p, q)) return [p, r];
    return null;
  }

  /** The second and third segments of the "three parallel lines" page claim. */
  function parallelLines(s) {
    return {
      A: [placePoint(s.B, s.C, s.A), placePoint(s.C, s.B, s.A)],
      B: [placePoint(s.A, s.C, s.B), placePoint(s.C, s.A, s.B)],
      C: [placePoint(s.A, s.B, s.C), placePoint(s.B, s.A, s.C)],
    };
  }

  /** Everything the applet draws, in Compute's own order. */
  function measurements(s) {
    const inC = incircle(s.A, s.B, s.C);
    const outC = circumcircle(s.A, s.B, s.C);
    const D = placePoint(s.B, s.A, s.C); // BD = AB
    const E = placePoint(s.A, s.B, s.C); // AE = AB
    const Ap = midpoint(s.B, s.C);       // midpoint of BC
    const Bp = midpoint(s.A, s.C);       // midpoint of AC
    const Dp = nearestPoint(outC.center, inC.center, Ap);
    const Ep = nearestPoint(outC.center, inC.center, Bp);
    const X = nearestPoint(inC.center, s.B, s.C);
    const Y = nearestPoint(inC.center, s.A, s.C);
    const IO = [inC.center, outC.center];
    const DE = [D, E];
    const S = intersect(IO[0], IO[1], DE[0], DE[1]);
    const a = dist(s.B, s.C), b = dist(s.C, s.A), c = dist(s.A, s.B);
    const angleC = angleAt(s.C, s.A, s.B);
    const deLength = dist(D, E), ioLength = dist(IO[0], IO[1]);
    const markPoint = dist(inC.center, S) > dist(outC.center, S) ? inC.center : outC.center;
    return {
      A: s.A, B: s.B, C: s.C,
      sides: { a, b, c }, angleC,
      I: inC.center, rIn: inC.radius,
      O: outC.center, rOut: outC.radius,
      D, E, Ap, Bp, Dp, Ep, X, Y, IO, DE, S, markPoint,
      deLength, ioLength, expectedDe: 2 * ioLength * Math.sin(angleC),
      parallels: parallelLines(s),
      extra: [extraSegment(E, s.A, s.C), extraSegment(D, s.B, s.C)],
      doubleArea: Math.abs(cross(s.A, s.B, s.C)),
      degenerate: isDegenerate(s) || ![inC.center, outC.center, D, E, S].every(finite) ||
        !Number.isFinite(angleC) || !Number.isFinite(deLength),
    };
  }

  /** Each claim on the applet's page, measured at this triangle. */
  function claims(s) {
    const m = measurements(s);
    const bad = {
      nonDegenerate: false, bdEqualsAb: false, aeEqualsAb: false,
      iIsIncenter: false, oIsCircumcenter: false, dePerpendicularIo: false,
      deEqualsFormula: false, rightMarkAtS: false, threeParallel: false, all: false,
    };
    if (m.degenerate) return bad;

    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-7 * scale;
    const onRay = (p, x, y) =>
      Math.abs(cross(x, y, p)) <= tol && insideTest(x, p, y) ||
      Math.abs(cross(x, y, p)) <= tol && insideTest(y, p, x);
    const pair = (p, q) => dist(p, q) <= tol;

    const bdEqualsAb = onRay(m.D, s.B, s.C) && Math.abs(dist(m.D, s.B) - m.sides.c) <= tol;
    const aeEqualsAb = onRay(m.E, s.A, s.C) && Math.abs(dist(m.E, s.A) - m.sides.c) <= tol;

    /* Independent incenter: (aA + bB + cC) / (a + b + c), a = |BC|. */
    const { a, b, c } = m.sides;
    const sum = a + b + c;
    const baryI = {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
    const iIsIncenter = pair(m.I, baryI) &&
      [nearestPoint(m.I, s.A, s.B), nearestPoint(m.I, s.B, s.C), nearestPoint(m.I, s.C, s.A)]
        .every((f) => Math.abs(dist(m.I, f) - m.rIn) <= tol);

    const oIsCircumcenter = pair(m.O, findCircumcenter(s.A, s.B, s.C)) &&
      [dist(m.O, s.A), dist(m.O, s.B), dist(m.O, s.C)]
        .every((r) => Math.abs(r - dist(m.O, s.A)) <= tol);

    const dDE = sub(m.DE[1], m.DE[0]), dIO = sub(m.IO[1], m.IO[0]);
    const products = Math.max(1, m.deLength * m.ioLength);
    const dePerpendicularIo = Math.abs(dot(dDE, dIO)) <= tol * products &&
      Math.abs(cross(m.DE[0], m.DE[1], m.S)) <= tol;

    const deEqualsFormula = Math.abs(m.deLength - m.expectedDe) <= tol;
    const markArms = [sub(m.E, m.S), sub(m.markPoint, m.S)];
    const rightMarkAtS = Math.abs(dot(...markArms)) <= tol * Math.max(1, products / 4);

    const dirs = Object.values(m.parallels).map(([p, q]) => sub(q, p));
    let threeParallel = true;
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const den = Math.hypot(dirs[i].x, dirs[i].y) * Math.hypot(dirs[j].x, dirs[j].y);
        if (den < EPS || Math.abs(cross({ x: 0, y: 0 }, dirs[i],
          { x: dirs[j].x, y: dirs[j].y })) > 1e-7 * den) threeParallel = false;
      }
    }

    const out = {
      nonDegenerate: true, bdEqualsAb, aeEqualsAb, iIsIncenter, oIsCircumcenter,
      dePerpendicularIo, deEqualsFormula, rightMarkAtS, threeParallel,
    };
    out.all = Object.values(out).every(Boolean);
    return out;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, withAngleC, isDegenerate, finite, dist, sqDist, midpoint,
    cross, dot, orientation, rotate, intersect, angleAt, findIncenter,
    findCircumcenter, nearestPoint, placePoint, circle, incircle, circumcircle,
    insideTest, extraSegment, parallelLines, measurements, claims, result,
  };
})();
