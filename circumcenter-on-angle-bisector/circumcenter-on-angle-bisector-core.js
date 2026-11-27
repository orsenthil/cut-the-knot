"use strict";

/*
 * CircumcenterOnAngleBisector — Bogomolny's "Circumcenter on Angle Bisector".
 *
 * Drag the corners of a triangle. I is its incenter, E the excenter opposite A,
 * and O the circumcenter of triangle BIC. The theorem on the page says O lies on
 * AI; the applet also shows that O lies on the circumcircle of ABC.
 *
 * The code follows CircumcenterOnAngleBisectorCanvas.Compute from the bytecode:
 * FindAngleBisector rotates a ray by half an angle and intersects it with the
 * opposite side; the incenter is Bi ∩ Ci; the circle through I, B, C is built
 * with FindCircumcenter; the excenter E is Be ∩ Ce, where Be and Ce are the
 * lines through B and C perpendicular to their internal bisectors. The circle's
 * radius is the applet's own average of the three centre-to-point distances.
 *
 * No document, no window, no storage: one global, plain data in and out.
 */
const CircumcenterOnAngleBisectorCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const dir = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
  const onLine = (p, x, y, tol) => Math.abs(cross(x, y, p)) / (distance(x, y) || 1) <= tol;
  const onSegment = (p, x, y, tol) =>
    onLine(p, x, y, tol) &&
    distance(x, p) + distance(p, y) <= distance(x, y) + tol;

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
    const cos = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / (2 * distance(p, q) * distance(p, r));
    if (!Number.isFinite(cos)) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.FindAngleBisector: the foot where the bisector at p meets QR. */
  function findAngleBisector(p, q, r) {
    const half = angleAt(p, q, r) / 2;
    const ray = rotate(p, q, half, orientation(p, q, r));
    return intersect(p, ray, q, r);
  }

  /** Canvas.SetPerpLine(p, q): the line through p perpendicular to pq. */
  function perpThrough(p, q) {
    return { x: p.x + q.y - p.y, y: p.y - q.x + p.x };
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const off1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
    const off2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
    return intersect(m1, off1, m2, off2);
  }

  /** Canvas.GetCircle(I, B, C): centre and the average radius the applet uses. */
  function circle(i, p, q) {
    const center = circumcenter(i, p, q);
    const radius = (distance(center, i) + distance(center, p) + distance(center, q)) / 3;
    return { center, radius };
  }

  /** The canvas's init(): A=(9W/20,H/4), B=(W/3,3H/5), C=(2W/3,3H/5). */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return { A: { ...o.points.A }, B: { ...o.points.B }, C: { ...o.points.C } };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    return {
      A: { x: (width * 9) / 20, y: height / 4 },
      B: { x: width / 3, y: (height * 3) / 5 },
      C: { x: (width * 2) / 3, y: (height * 3) / 5 },
    };
  }

  /** A new position with one named corner moved; the old one is untouched. */
  function withPoint(s, name, p) {
    const next = { A: { ...s.A }, B: { ...s.B }, C: { ...s.C } };
    if (!next[name]) return next;
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  function isDegenerate(s) {
    return Math.abs(cross(s.A, s.B, s.C)) < 1e-7 ||
      Math.min(distance(s.A, s.B), distance(s.B, s.C), distance(s.C, s.A)) < EPS;
  }

  /** Everything the page draws, in the applet's own construction order. */
  function measurements(s) {
    const Bf = findAngleBisector(s.B, s.A, s.C);
    const Cf = findAngleBisector(s.C, s.A, s.B);
    const Af = findAngleBisector(s.A, s.B, s.C);
    const lines = {
      Bi: [s.B, Bf],
      Be: [s.B, perpThrough(s.B, Bf)],
      Ci: [s.C, Cf],
      Ce: [s.C, perpThrough(s.C, Cf)],
      Ai: [s.A, Af],
    };
    const I = intersect(lines.Bi[0], lines.Bi[1], lines.Ci[0], lines.Ci[1]);
    const circ = circle(I, s.B, s.C);
    const K = midpoint(I, s.B), L = midpoint(I, s.C);
    const E = intersect(lines.Be[0], lines.Be[1], lines.Ce[0], lines.Ce[1]);
    const bigCenter = circumcenter(s.A, s.B, s.C);
    const bigRadius = distance(bigCenter, s.A);
    return {
      A: s.A, B: s.B, C: s.C,
      feet: { A: Af, B: Bf, C: Cf },
      lines, I, O: circ.center, r: circ.radius, E, K, L,
      bigCenter, bigRadius,
      sides: { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) },
      doubleArea: Math.abs(cross(s.A, s.B, s.C)),
      degenerate: isDegenerate(s) || ![I, E, circ.center].every(finite),
    };
  }

  /** Shortest distance from p to the infinite line through x and y. */
  function distToLine(p, x, y) {
    const len = distance(x, y);
    return len < EPS ? Infinity : Math.abs(cross(x, y, p)) / len;
  }

  /** Each claim on the applet's page, measured at this triangle. */
  function claims(s) {
    const m = measurements(s);
    const bad = {
      bisectorsHalve: false, feetOnSides: false, iIsIncenter: false,
      oOnAI: false, eOnAI: false, externalPerpendicular: false,
      biciCyclic: false, ieDiameter: false, oOnABCCircle: false,
      chordMidpoints: false, all: false,
    };
    if (m.degenerate) return bad;

    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-6 * scale;
    const angleTol = 1e-5;
    const pair = (p, q) => Math.abs(distance(p, q)) <= tol;

    const vertices = { A: [s.B, s.C], B: [s.A, s.C], C: [s.A, s.B] };
    let bisectorsHalve = true, feetOnSides = true;
    for (const v of ["A", "B", "C"]) {
      const [q, r] = vertices[v];
      const f = m.feet[v];
      const whole = angleAt(s[v], q, r);
      const first = angleAt(s[v], q, f);
      const second = angleAt(s[v], f, r);
      if (!(Math.abs(first - whole / 2) < angleTol && Math.abs(second - whole / 2) < angleTol)) bisectorsHalve = false;
      if (!onSegment(f, q, r, tol)) feetOnSides = false;
    }

    /* The incenter from the barycentric formula, independently of the lines. */
    const { a, b, c } = m.sides;
    const sum = a + b + c;
    const baryI = {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
    const rIn = m.doubleArea / sum;
    const iIsIncenter = pair(m.I, baryI) &&
      [distToLine(m.I, s.B, s.C), distToLine(m.I, s.C, s.A), distToLine(m.I, s.A, s.B)]
        .every((d) => Math.abs(d - rIn) <= tol);

    /* The excenter opposite A, also from the side-length formula. */
    const baryE = {
      x: (-a * s.A.x + b * s.B.x + c * s.C.x) / (-a + b + c),
      y: (-a * s.A.y + b * s.B.y + c * s.C.y) / (-a + b + c),
    };

    const oOnAI = onLine(m.O, s.A, m.I, tol);
    const eOnAI = onLine(m.E, s.A, m.I, tol) && pair(m.E, baryE) &&
      Math.abs(-a + b + c) > EPS;
    const bdir = dir(...m.lines.Bi), bextdir = dir(...m.lines.Be);
    const cdir = dir(...m.lines.Ci), cextdir = dir(...m.lines.Ce);
    const externalPerpendicular =
      Math.abs(dot(bdir, bextdir)) <= tol * distance(s.B, m.feet.B) &&
      Math.abs(dot(cdir, cextdir)) <= tol * distance(s.C, m.feet.C);
    const biciCyclic =
      Math.abs(distance(m.O, m.I) - m.r) <= tol &&
      Math.abs(distance(m.O, s.B) - m.r) <= tol &&
      Math.abs(distance(m.O, s.C) - m.r) <= tol;
    const ieDiameter = pair(midpoint(m.I, m.E), m.O) &&
      Math.abs(distance(m.I, m.E) - 2 * m.r) <= tol;
    const oOnABCCircle = Math.abs(distance(m.O, m.bigCenter) - m.bigRadius) <= tol;
    const chordMidpoints =
      Math.abs(dot(dir(m.O, m.K), dir(m.I, s.B))) <= tol * distance(m.I, s.B) &&
      Math.abs(dot(dir(m.O, m.L), dir(m.I, s.C))) <= tol * distance(m.I, s.C);

    const out = {
      bisectorsHalve, feetOnSides, iIsIncenter, oOnAI, eOnAI,
      externalPerpendicular, biciCyclic, ieDiameter, oOnABCCircle, chordMidpoints,
    };
    out.all = Object.values(out).every(Boolean);
    return out;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, isDegenerate, distance, cross, dot, midpoint,
    orientation, rotate, intersect, angleAt, findAngleBisector,
    perpThrough, circumcenter, circle, measurements, distToLine, claims, result,
  };
})();
