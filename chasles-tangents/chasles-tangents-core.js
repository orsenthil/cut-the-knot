"use strict";

/*
 * Chasles Tangents — the illustration on Bogomolny's "Chasles' Theorem, a
 * Proof" (applet ChaslesTangents; the proof quoted there is from Eves, p. 256).
 *
 * Four points A, B, C, D sit on a circle (the applet's "proper conic"), and a
 * fixed tangent t touches it at T. The tangent to the circle at X meets t at
 * X'. The page's claim is K(ABCD) = (A'B'C'D') for every point K of the
 * circle: the cross-ratio of the four lines from K does not change as K moves,
 * and it is the cross-ratio of the four points cut out on t by the tangents.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global so the page loads it with a plain <script>
 * and porting/check-chasles-tangents.mjs loads it in Node. The position is
 * plain data, so it can be handed to the player's record and the tutor as it
 * is. Every function returns a new position instead of changing its argument.
 *
 * transcribed from the bytecode: ChaslesTangentsCanvas.Reset (start angles),
 * CorrectPoint (radial projection back to the circle), DoubCircle.Tangent
 * (the second point of each tangent), GeoSDoub.Intersect (line crossings),
 * and ChaslesTangentsCanvas.Compute (A' = t ^ tangent at A, and so on).
 */
const ChaslesTangentsCore = (() => {
  /* Reset(): the six points are put at these angles around the circle. */
  const ANGLES = {
    T: -Math.PI / 2,
    A: Math.PI / 4,
    B: Math.PI / 12,
    C: -Math.PI / 12,
    D: -Math.PI / 4,
    K: (5 * Math.PI) / 6,
  };
  const NAMES = ["T", "A", "B", "C", "D", "K"];
  const PRIME = { A: "Ap", B: "Bp", C: "Cp", D: "Dp" };

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /** The point at angle t on the circle, as Reset's centre + r(cos t, sin t). */
  function circleAt(circle, t) {
    return {
      x: circle.center.x + circle.r * Math.cos(t),
      y: circle.center.y + circle.r * Math.sin(t),
    };
  }

  function angleOn(circle, p) {
    return Math.atan2(p.y - circle.center.y, p.x - circle.center.x);
  }

  /** The position a new applet starts from: the Reset() bytecode's geometry. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    /* Reset(): centre (width/3, 2*height/3), r = min(width, height)/6. */
    const circle = {
      center: { x: width / 3, y: (2 * height) / 3 },
      r: Math.min(width, height) / 6,
    };
    const points = {};
    for (const name of NAMES) points[name] = circleAt(circle, ANGLES[name]);
    return {
      width, height, circle, points,
      showNames: Boolean(o.showNames),
      allowHint: Boolean(o.allowHint),
    };
  }

  /**
   * Drag A, B, C, D, K or T: CorrectPoint pushes the point back along the
   * radius onto the circle, so its angle is what the player really controls.
   */
  function withPoint(s, name, p) {
    if (!NAMES.includes(name) || !finite(p)) return s;
    const o = s.circle.center;
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return s;
    const f = s.circle.r / d;
    return { ...s, points: { ...s.points, [name]: { x: o.x + dx * f, y: o.y + dy * f } } };
  }

  /** Dragging the circle's centre carries every point with it by the same step. */
  function withCenter(s, p) {
    if (!finite(p)) return s;
    const dx = p.x - s.circle.center.x, dy = p.y - s.circle.center.y;
    const points = {};
    for (const name of NAMES) {
      points[name] = { x: s.points[name].x + dx, y: s.points[name].y + dy };
    }
    return { ...s, circle: { ...s.circle, center: copy(p) }, points };
  }

  /** Dragging the circle's radius dot keeps every point at its old angle. */
  function withRadius(s, p) {
    if (!finite(p)) return s;
    const r = dist(s.circle.center, p);
    if (r < 1e-9) return s;
    const f = r / s.circle.r;
    const points = {};
    for (const name of NAMES) {
      const t = angleOn(s.circle, s.points[name]);
      points[name] = {
        x: s.circle.center.x + r * Math.cos(t),
        y: s.circle.center.y + r * Math.sin(t),
      };
    }
    return { ...s, circle: { ...s.circle, r }, points };
  }

  function withNames(s, on) { return { ...s, showNames: Boolean(on) }; }
  function withHint(s, on) { return { ...s, allowHint: Boolean(on) }; }

  /**
   * DoubCircle.Tangent(P): if P is more than 1 unit off the circle, the
   * applet has no tangent and keeps its old line. Otherwise the line through
   * P and (P.x - dy, P.y + dx), where (dx, dy) = P - O: a tangent direction.
   */
  function tangentAt(circle, p) {
    if (!finite(p)) return null;
    const dx = p.x - circle.center.x, dy = p.y - circle.center.y;
    if (Math.abs(Math.hypot(dx, dy) - circle.r) > 1) return null;
    return { a: copy(p), b: { x: p.x - dy, y: p.y + dx } };
  }

  /** GeoSDoub.Intersect of the infinite lines ab and cd (NaN if parallel). */
  function intersect(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return { x: NaN, y: NaN };
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /**
   * ChaslesTangentsCanvas.Compute: the tangents at T, A, B, C, D, then the
   * four crossings A'..D' of those tangents with the fixed tangent t.
   */
  function compute(s) {
    const p = s.points;
    const tangents = { T: tangentAt(s.circle, p.T) };
    for (const name of ["A", "B", "C", "D"]) {
      tangents[name] = tangentAt(s.circle, p[name]);
    }
    const primes = {};
    for (const name of ["A", "B", "C", "D"]) {
      primes[PRIME[name]] = tangents.T && tangents[name]
        ? intersect(tangents.T.a, tangents.T.b, tangents[name].a, tangents[name].b)
        : { x: NaN, y: NaN };
    }
    return { tangents, primes };
  }

  /** Cross-ratio of four collinear points, read along their own line. */
  function crossRatioLine(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return NaN;
    const u = { x: d.x - c.x, y: d.y - c.y };
    const axis = Math.abs(u.x) > Math.abs(u.y) ? "x" : "y";
    const A = a[axis], B = b[axis], C = c[axis], D = d[axis];
    if (Math.abs(C - B) < 1e-12 || Math.abs(D - B) < 1e-12) return NaN;
    return ((C - A) / (C - B)) / ((D - A) / (D - B));
  }

  /** Cross-ratio of the pencil V(a,b;c,d), from signed sines of the angles. */
  function crossRatioPencil(v, a, b, c, d) {
    if (![v, a, b, c, d].every(finite)) return NaN;
    const va = { x: a.x - v.x, y: a.y - v.y };
    const vb = { x: b.x - v.x, y: b.y - v.y };
    const vc = { x: c.x - v.x, y: c.y - v.y };
    const vd = { x: d.x - v.x, y: d.y - v.y };
    const s13 = cross(va, vc) / (Math.hypot(va.x, va.y) * Math.hypot(vc.x, vc.y));
    const s23 = cross(vb, vc) / (Math.hypot(vb.x, vb.y) * Math.hypot(vc.x, vc.y));
    const s14 = cross(va, vd) / (Math.hypot(va.x, va.y) * Math.hypot(vd.x, vd.y));
    const s24 = cross(vb, vd) / (Math.hypot(vb.x, vb.y) * Math.hypot(vd.x, vd.y));
    if (Math.abs(s23) < 1e-12 || Math.abs(s24) < 1e-12) return NaN;
    return (s13 / s23) / (s14 / s24);
  }

  /** Signed angle at v from v->a to v->b, in (-pi, pi]. */
  function signedAngle(v, a, b) {
    const u = { x: a.x - v.x, y: a.y - v.y };
    const w = { x: b.x - v.x, y: b.y - v.y };
    return Math.atan2(cross(u, w), dot(u, w));
  }

  /* Signed angles at one vertex: keep the supplement distinct from equality.
   * K(ABCD) is unchanged by the supplement, but Eves' step (1) is not. */
  function angleDifference(x, y) {
    return ((x - y + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }

  function sameAngle(x, y, tol) {
    return Number.isFinite(x) && Number.isFinite(y) &&
      Math.abs(angleDifference(x, y)) <= tol * Math.PI;
  }

  function near(a, b, tol) {
    return Number.isFinite(a) && Number.isFinite(b) &&
      Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  }

  /**
   * The page's claims at the current configuration:
   *  - K(ABCD) = (A'B'C'D'), the theorem on the page;
   *  - the same value for 24 other choices of K (independence of K);
   *  - Eves' angle step (1) A'OT = 1/2 AOT = AKT, which the page's Note says
   *    does not always hold: `angleAtK` records whether it holds for this K.
   */
  function claims(s) {
    const g = compute(s);
    const p = s.points;
    const q = g.primes;
    const cr = crossRatioLine(q.Ap, q.Bp, q.Cp, q.Dp);
    const crK = crossRatioPencil(p.K, p.A, p.B, p.C, p.D);
    /* The page assumes four distinct points and four distinct crossings; with
     * two of them together the cross-ratio has no meaning. */
    const distinct = (list, tol) => list.every((a, i) =>
      list.slice(i + 1).every((b) => finite(a) && finite(b) && dist(a, b) > tol));
    const tolPoint = 1e-7 * s.circle.r;
    const regular = Object.keys(q).every((k) => finite(q[k])) && Number.isFinite(cr) &&
      distinct(Object.keys(q).map((k) => q[k]), tolPoint) &&
      distinct([p.A, p.B, p.C, p.D], tolPoint);
    const equal = regular && near(crK, cr, 1e-7);
    let independent = regular;
    for (let i = 0; i < 24 && independent; i++) {
      const k = circleAt(s.circle, 0.13 + (i * 2 * Math.PI) / 24);
      independent = near(crossRatioPencil(k, p.A, p.B, p.C, p.D), cr, 1e-7);
    }
    const half = signedAngle(s.circle.center, p.A, p.T) / 2;
    const atPrime = finite(q.Ap)
      ? sameAngle(signedAngle(s.circle.center, q.Ap, p.T), half, 1e-7)
      : false;
    const angleAtK = sameAngle(signedAngle(p.K, p.A, p.T), half, 1e-7);
    return {
      regular, equal, independent, atPrime, angleAtK,
      cr, crK, half, primes: q, tangentT: g.tangents.T,
    };
  }

  /** An illustration cannot be won, lost or finished by a move. */
  function result(/* state */) { return null; }

  return {
    NAMES, ANGLES, circleAt, angleOn, start, withPoint, withCenter, withRadius,
    withNames, withHint, tangentAt, intersect, compute, crossRatioLine,
    crossRatioPencil, signedAngle, angleDifference, sameAngle, claims, result,
  };
})();
