"use strict";

/*
 * BOL10 — Archimedes' Book of Lemmas, Proposition 10, as in Bogomolny's applet.
 *
 * TA and TB touch a circle at A and B; the secant TC cuts it at C (and again).
 * The chord BD is drawn through B parallel to TC, AD meets TC at E, and EH is
 * perpendicular to BD. The proposition says EH bisects BD: BH = HD.
 *
 * The one idea the code relies on is that every derived point is an ordinary
 * line/circle intersection. Four points are draggable: O (centre), Bo (a point
 * on the circle that fixes its radius), T (outside the circle) and C (kept on
 * the circle). Moving O or Bo changes the radius and pulls C back onto it,
 * exactly as BOL10Canvas.AdjustCircle / AdjustC do.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol10Core, so the page loads it with a plain <script>
 * and porting/check-bol-10.mjs loads it in Node. All functions take plain data
 * and return new objects; nothing passed in is changed.
 */
const Bol10Core = (() => {
  const EPS = 1e-9;
  const TANGENT_EPS = 1; // GeoSDoub.Other uses one pixel to spot a known point

  const copy = (p) => ({ x: p.x, y: p.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, t) => ({ x: a.x * t, y: a.y * t });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const len = (a) => Math.hypot(a.x, a.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const onCircle = (O, r, p) => Math.abs(dist(p, O) - r) <= 1e-6 * Math.max(1, r);

  function pointOnCircle(O, r, angle) {
    return { x: O.x + r * Math.cos(angle), y: O.y + r * Math.sin(angle) };
  }

  /** C is always pulled back onto the circle; the applet uses a random angle
   *  when it sits at the centre, which is replaced here by the old angle. */
  function projectOnCircle(O, r, p, fallbackAngle) {
    const v = sub(p, O);
    const d = len(v);
    if (d < 0.1) return pointOnCircle(O, r, fallbackAngle || 0);
    return add(O, mul(v, r / d));
  }

  /** Intersections of the infinite line p->q with a circle, by a quadratic. */
  function lineCircle(p, q, O, r) {
    const d = sub(q, p), f = sub(p, O);
    const a = dot(d, d);
    if (a < EPS) return [];
    const b = 2 * dot(f, d), c = dot(f, f) - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [
      add(p, mul(d, (-b + s) / (2 * a))),
      add(p, mul(d, (-b - s) / (2 * a))),
    ];
  }

  /** GeoSDoub.Other: the intersection that is not the point already known.
   *  The root order of a quadratic depends on the direction of the line, so
   *  use distance to decide rather than the array index. */
  function other(points, p) {
    if (!points || !points.length) return null;
    if (points.length === 1) return points[0];
    return dist(points[0], p) >= dist(points[1], p) ? points[0] : points[1];
  }

  /** GeoSDoub.Intersect of two lines; parallel lines give null. */
  function lineIntersection(a, b, c, d) {
    const det = cross(sub(b, a), sub(d, c));
    if (Math.abs(det) < EPS) return null;
    const t = cross(sub(c, a), sub(d, c)) / det;
    return add(a, mul(sub(b, a), t));
  }

  /** GeoSDoub.NearestPoint: foot of the perpendicular, not clipped to BD. */
  function nearest(p, x, y) {
    const d = sub(y, x);
    if (dist(p, x) * dist(p, x) < 0.1) return copy(p);
    const l2 = dot(d, d);
    if (l2 < EPS) return copy(x);
    return add(x, mul(d, dot(sub(p, x), d) / l2));
  }

  /** Tangent points from T. The array order follows the applet's axis-based
   *  circle intersection (larger y first, or larger x for a vertical secant);
   *  A is the second point and B the first. Either labelling gives the lemma. */
  function tangentPoints(O, r, T) {
    const d = sub(T, O), D = len(d);
    if (D <= r + EPS) return null;
    const u = mul(d, 1 / D);
    const base = add(O, mul(u, (r * r) / D));
    const h = (r * Math.sqrt(D * D - r * r)) / D;
    const perp = { x: -u.y, y: u.x };
    const p1 = sub(base, mul(perp, h));
    const p2 = add(base, mul(perp, h));
    if (Math.abs(O.x - T.x) > TANGENT_EPS) {
      return p1.y >= p2.y ? [p1, p2] : [p2, p1];
    }
    if (Math.abs(O.y - T.y) > TANGENT_EPS) {
      return p1.x >= p2.x ? [p1, p2] : [p2, p1];
    }
    return null;
  }

  /** The position a new diagram starts from, placed as BOL10Canvas.init does. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        O: copy(o.points.O), Bo: copy(o.points.Bo),
        T: copy(o.points.T), C: copy(o.points.C),
        radius: o.radius === undefined ? dist(o.points.O, o.points.Bo) : o.radius,
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const third = width / 6; // (width / 2) / 3 in the applet
    const O = { x: width / 2 - third, y: height / 2 };
    const radius = third;
    const Bo = { x: O.x - radius, y: O.y };
    const T = { x: width / 2 + third, y: height / 2 };
    const angle = o.angle === undefined ? 2.2 : o.angle;
    const C = pointOnCircle(O, radius, angle + Math.PI);
    return { O, Bo, T, C, radius };
  }

  /** One dragged point moved; moving O or Bo resizes the circle and pulls C. */
  function withPoint(state, name, p) {
    if (!["O", "Bo", "T", "C"].includes(name)) {
      return {
        O: copy(state.O), Bo: copy(state.Bo), T: copy(state.T),
        C: copy(state.C), radius: state.radius,
      };
    }
    const next = {
      O: copy(state.O), Bo: copy(state.Bo), T: copy(state.T),
      C: copy(state.C), radius: state.radius,
    };
    if (name === "O" || name === "Bo") {
      next[name] = copy(p);
      next.radius = dist(next.Bo, next.O);
      next.C = projectOnCircle(next.O, next.radius, next.C, Math.PI);
    } else if (name === "T") {
      next.T = copy(p);
    } else {
      const v = sub(state.C, state.O);
      next.C = projectOnCircle(state.O, state.radius, p, Math.atan2(v.y, v.x));
    }
    return next;
  }

  /** The whole construction, from the canvas's Draw method. */
  function construct(state) {
    const O = state.O, r = state.radius, T = state.T, C = state.C;
    const result = {
      O: copy(O), radius: r, Bo: copy(state.Bo), T: copy(T), C: copy(C),
      A: null, B: null, C2: null, D: null, E: null, F: null, H: null,
      valid: false, thin: false, reason: null,
    };
    if (!(r > EPS) || !finite(O) || !finite(T) || !finite(C)) {
      result.reason = "radius";
      return result;
    }
    const secant = lineCircle(T, C, O, r);
    result.C2 = other(secant, C); // the second cut of TC with the circle
    const tangents = tangentPoints(O, r, T);
    if (!tangents) {
      result.reason = "tangent"; // T is on or inside the circle
      return result;
    }
    result.B = tangents[0];
    result.A = tangents[1];

    const parallelEnd = add(result.B, sub(C, T)); // BD is parallel to TC
    const chord = lineCircle(result.B, parallelEnd, O, r);
    result.D = other(chord, result.B);
    result.E = lineIntersection(result.A, result.D, C, T);
    result.F = lineIntersection(result.A, result.B, C, T);
    result.H = nearest(result.E, result.B, result.D);
    if (![result.C2, result.D, result.E, result.F, result.H].every(finite)) {
      result.reason = "parallel"; // AD or AB is parallel to the secant
      return result;
    }
    result.valid = true;
    /* The applet's Other() works to one pixel, so a secant that is almost a
     * tangent gives an ill-conditioned picture. Say so rather than claim a
     * midpoint from a chord a fraction of a pixel long. */
    result.thin = dist(C, result.C2) < 2 || dist(result.B, result.D) < 2;
    return result;
  }

  const angleAt = (v, p, q) => {
    if (!finite(v) || !finite(p) || !finite(q)) return NaN;
    const u = sub(p, v), w = sub(q, v);
    const n = len(u) * len(w);
    if (n < EPS) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / n)));
  };

  /** Lengths and angles named in the proposition and its proof. */
  function measurements(state) {
    const c = construct(state);
    const m = { ...c, lengths: {}, angles: {} };
    if (!c.valid) return m;
    const L = m.lengths;
    L.TA = dist(c.T, c.A); L.TB = dist(c.T, c.B);
    L.ET = dist(c.E, c.T); L.TF = dist(c.T, c.F);
    L.EB = dist(c.E, c.B); L.ED = dist(c.E, c.D);
    L.BH = dist(c.B, c.H); L.HD = dist(c.H, c.D);
    L.BD = dist(c.B, c.D);
    const A = m.angles;
    A.TAB = angleAt(c.A, c.T, c.B); A.ABT = angleAt(c.B, c.A, c.T);
    A.ADB = angleAt(c.D, c.A, c.B); A.AET = angleAt(c.E, c.A, c.T);
    A.TEB = angleAt(c.E, c.T, c.B); A.TBF = angleAt(c.B, c.T, c.F);
    A.EDB = angleAt(c.D, c.E, c.B); A.EBD = angleAt(c.B, c.E, c.D);
    return m;
  }

  /** Four points on one circle: the circumcircle of three contains the fourth. */
  function concyclic(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return false;
    const ax = a.x - d.x, ay = a.y - d.y;
    const bx = b.x - d.x, by = b.y - d.y;
    const cx = c.x - d.x, cy = c.y - d.y;
    const det = (ax * ax + ay * ay) * (bx * cy - by * cx)
      - (bx * bx + by * by) * (ax * cy - ay * cx)
      + (cx * cx + cy * cy) * (ax * by - ay * bx);
    return Math.abs(det) <= 1e-6 * Math.max(1, dist(a, d) * dist(b, d) * dist(c, d));
  }

  /** An angle may be reported as its supplement when D lies on the other arc. */
  const sameAngle = (a, b, tol) =>
    Number.isFinite(a) && Number.isFinite(b) &&
    (Math.abs(a - b) <= tol || Math.abs(a + b - Math.PI) <= tol);

  /** Every claim the applet's page makes, at the current configuration. */
  function claims(state) {
    const m = measurements(state);
    const c = m;
    const falseAll = {
      tangentLengths: false, pointsOnCircle: false, bdParallel: false,
      perpendicular: false, midpoint: false, equalSides: false,
      baseAngles: false, powerOfPoint: false, alternateSegment: false,
      parallelAngle: false, similarTriangles: false, cyclic: false,
    };
    if (!c.valid) return falseAll;
    const L = m.lengths, A = m.angles;
    const scale = Math.max(c.radius, L.BD, L.TA, L.ET);
    const tol = 1e-7 * scale;
    const mid = mul(add(c.B, c.D), 0.5);
    const dirBD = sub(c.D, c.B), dirTC = sub(c.C, c.T);
    return {
      tangentLengths: Math.abs(L.TA - L.TB) <= tol,
      pointsOnCircle:
        onCircle(c.O, c.radius, c.A) && onCircle(c.O, c.radius, c.B) &&
        onCircle(c.O, c.radius, c.C) && onCircle(c.O, c.radius, c.D) &&
        onCircle(c.O, c.radius, c.C2),
      bdParallel: Math.abs(cross(dirBD, dirTC)) / (len(dirBD) * len(dirTC)) <= 1e-9,
      perpendicular: Math.abs(dot(sub(c.H, c.E), dirBD)) / (L.EB + L.ED + 1) <= tol,
      midpoint: dist(c.H, mid) <= tol && Math.abs(L.BH - L.HD) <= tol,
      equalSides: Math.abs(L.EB - L.ED) <= tol,
      baseAngles: sameAngle(A.EDB, A.EBD, 1e-7),
      powerOfPoint: Math.abs(L.ET * L.TF - L.TA * L.TA) <= tol,
      alternateSegment: sameAngle(A.TAB, A.ADB, 1e-7) && sameAngle(A.TAB, A.ABT, 1e-7),
      parallelAngle: sameAngle(A.ADB, A.AET, 1e-7),
      similarTriangles: sameAngle(A.TEB, A.TBF, 1e-7) && sameAngle(A.TEB, A.TAB, 1e-7),
      cyclic: concyclic(c.A, c.E, c.B, c.T),
    };
  }

  /** There is nothing to win or lose in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, construct, measurements, claims, result,
    lineCircle, lineIntersection, nearest, tangentPoints, other,
    pointOnCircle, projectOnCircle, angleAt, concyclic,
  };
})();
