"use strict";

/*
 * Euler and Fermat — the illustration on Bogomolny's "Fermat Points and
 * Concurrent Euler Lines" page. Let F and f be the two Fermat-Toricelli
 * points of triangle ABC. The page claims that the Euler lines of all ten
 * triangles made by choosing three of A, B, C, F, f meet at G, the centroid
 * of ABC. The applet draws the three triangles made from F, f and one corner
 * and proves the case of C: the circumcenter O of CFf, the centroid G' of
 * CFf and G are collinear.
 *
 * The arithmetic here follows EulerAndFermatCanvas.Compute from the applet's
 * bytecode: GeoSDoub.Rotate by 60 degrees, GeoSDoub.Intersect (with its
 * |det| < 1 guard), CTKGeometryPlus.Barycenter/Midpoint/Prorate and
 * GeoSDoub.FindCircumcenter. The only deliberate change is that a redraw
 * computes everything afresh; Compute used to keep stale points when the
 * corner had not moved far, which is a drawing optimisation, not the theorem.
 *
 * This file is logic only: no document, no window, no storage. It defines one
 * global, EulerAndFermatCore. Positions are plain data and functions never
 * change the position they are given.
 */
const EulerAndFermatCore = (() => {
  /** The applet's 60-degree turns; Math.PI/3 radians. */
  const TURN = Math.PI / 3;
  /** The starting triangle of init() for a 480x360 drawing area. */
  const START = {
    A: { x: 160, y: 300 }, // W/3, 5H/6
    B: { x: 320, y: 300 }, // 2W/3, 5H/6
    C: { x: 172, y: 60 },  // 0.35833333333333334W, H/6
  };

  const point = (x, y) => ({ x: x, y: y });
  const copy = (p) => point(p.x, p.y);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const barycenter = (p, q, r) => point((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const crossVec = (a, b) => a.x * b.y - a.y * b.x;
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Rotate(P, Q, theta, s): turn Q around P by s * theta. */
  function rotate(p, q, theta, s) {
    const c = Math.cos(theta), n = Math.sin(theta);
    const dx = q.x - p.x, dy = q.y - p.y;
    return point(p.x + c * dx - s * n * dy, p.y + s * n * dx + c * dy);
  }

  /** GeoSDoub.Intersect: NaN for parallel lines (the applet's |det| < 1). */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p, q, r) {
    const m1 = midpoint(p, q), m2 = midpoint(q, r);
    const v1 = point(m1.x + (q.y - p.y), m1.y - (q.x - p.x));
    const v2 = point(m2.x + (r.y - q.y), m2.y - (r.x - q.x));
    return intersect(m1, v1, m2, v2);
  }

  /** CTKGeometryPlus.Prorate: from P towards Q, length t (not the fraction). */
  function prorate(p, q, t) {
    const d = distance(p, q);
    if (d < 0.1) return copy(p);
    const k = t / d;
    return point(p.x + k * (q.x - p.x), p.y + k * (q.y - p.y));
  }

  /** The ordinary angle at q between p and r, in radians. */
  function angle(p, q, r) {
    const u = distance(q, p), v = distance(q, r), w = distance(p, r);
    if (!u || !v || !w) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, (u * u + v * v - w * w) / (2 * u * v))));
  }

  /** Two undirected angles are the same directed angle modulo 180 degrees. */
  function sameAngleModPi(a, b, tol) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.min(Math.abs(a - b), Math.abs(a + b - Math.PI)) <= tol;
  }

  /** The position a visitor starts from, or one supplied point-for-point. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: copy(o.points.A), B: copy(o.points.B), C: copy(o.points.C),
        showNames: Boolean(o.showNames), showAngles: Boolean(o.showAngles),
      };
    }
    const width = o.width === undefined ? 480 : o.width;
    const height = o.height === undefined ? 360 : o.height;
    /* Java's integer division truncates toward zero; these values are positive. */
    return {
      A: point(Math.trunc(width / 3), Math.trunc((height * 5) / 6)),
      B: point(Math.trunc((width * 2) / 3), Math.trunc((height * 5) / 6)),
      C: point(Math.trunc(width * 0.35833333333333334), Math.trunc(height / 6)),
      showNames: Boolean(o.showNames), showAngles: Boolean(o.showAngles),
    };
  }

  /** Move one corner. `name` is "A", "B" or "C". The old position is kept. */
  function withPoint(pos, name, p) {
    const next = { A: copy(pos.A), B: copy(pos.B), C: copy(pos.C),
      showNames: pos.showNames, showAngles: pos.showAngles };
    next[name] = copy(p);
    return next;
  }

  /** Set the two checkboxes; the other options and the corners are kept. */
  function withOptions(pos, options) {
    const o = options || {};
    return {
      A: copy(pos.A), B: copy(pos.B), C: copy(pos.C),
      showNames: o.showNames === undefined ? pos.showNames : Boolean(o.showNames),
      showAngles: o.showAngles === undefined ? pos.showAngles : Boolean(o.showAngles),
    };
  }

  /**
   * Every point Compute() makes. Naming follows the applet and the page:
   * A'B'C' outer and a'b'c' inner Napoleon triangles, F/f the Fermat points,
   * G/G' the centroids of ABC and of CfF, O the circumcenter of CfF,
   * P the intersection of B'C' with a'c', M/m the midpoints of AB and Ff,
   * and F' the reflection of f in M.
   */
  function measure(pos) {
    const A = pos.A, B = pos.B, C = pos.C;
    const Ap = rotate(B, C, TURN, 1), Bp = rotate(C, A, TURN, 1), Cp = rotate(A, B, TURN, 1);
    const Aq = barycenter(Ap, B, C), Bq = barycenter(A, Bp, C), Cq = barycenter(A, B, Cp);
    const ap = rotate(B, C, TURN, -1), bp = rotate(C, A, TURN, -1), cp = rotate(A, B, TURN, -1);
    const aq = barycenter(ap, B, C), bq = barycenter(A, bp, C), cq = barycenter(A, B, cp);
    const Cm = midpoint(A, B);
    const F = barycenter(intersect(A, Ap, B, Bp), intersect(B, Bp, C, Cp), intersect(C, Cp, A, Ap));
    const f = barycenter(intersect(A, ap, B, bp), intersect(B, bp, C, cp), intersect(C, cp, A, ap));
    const fm = midpoint(F, f);
    const G = barycenter(A, B, C);
    const Gp = barycenter(C, F, f);
    const O = circumcenter(C, F, f);
    const P = intersect(Bq, Cq, aq, cq);
    const Fp = prorate(F, Cm, 2 * distance(F, Cm));

    /** G lies on the Euler line of triangle V, F, f exactly when this cross is 0. */
    const euler = (V) => {
      const center = barycenter(V, F, f);
      const circum = circumcenter(V, F, f);
      return { center: center, circum: circum, cross: cross(G, center, circum) };
    };
    return {
      A: A, B: B, C: C,
      Ap: Ap, Bp: Bp, Cp: Cp, Aq: Aq, Bq: Bq, Cq: Cq,
      ap: ap, bp: bp, cp: cp, aq: aq, bq: bq, cq: cq,
      Cm: Cm, F: F, f: f, fm: fm, G: G, Gp: Gp, O: O, P: P, Fp: Fp,
      eulerA: euler(A), eulerB: euler(B), eulerC: euler(C),
    };
  }

  /**
   * The page's claims for one triangle, all as plain booleans. Angles are
   * compared as directed angles modulo 180 degrees, the way the proof uses
   * them, so a supplementary ordinary angle is still the same directed angle.
   */
  function claims(pos) {
    const m = measure(pos);
    const scale = Math.max(distance(m.A, m.B), distance(m.B, m.C), distance(m.C, m.A));
    const areaTol = 1e-7 * scale * scale;
    const pointTol = 1e-7 * scale;
    const names = ["Ap", "Bp", "Cp", "Aq", "Bq", "Cq", "ap", "bp", "cp",
      "aq", "bq", "cq", "Cm", "F", "f", "fm", "G", "Gp", "O", "P", "Fp"];
    const usable = names.every((n) => finite(m[n])) && scale > 0 &&
      Math.abs(cross(m.A, m.B, m.C)) > areaTol;

    // All ten triples from {A,B,C,F,f}: G must lie on each Euler line.
    const points = { A: m.A, B: m.B, C: m.C, F: m.F, f: m.f };
    const keys = Object.keys(points);
    const triples = [];
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++)
        for (let k = j + 1; k < keys.length; k++) triples.push([keys[i], keys[j], keys[k]]);
    const tenOk = triples.map((t) => {
      const [p, q, r] = t.map((key) => points[key]);
      const center = barycenter(p, q, r);
      const circum = circumcenter(p, q, r);
      return finite(circum) && Math.abs(cross(m.G, center, circum)) <= areaTol;
    });

    // Napoleon: both apex triangles are equilateral and share G as centroid.
    const equilateral = (a, b, c) => {
      const x = distance(a, b), y = distance(b, c), z = distance(c, a);
      return x > 0 && Math.abs(x - y) <= pointTol && Math.abs(y - z) <= pointTol;
    };
    const sharedCentroid = (a, b, c) => distance(barycenter(a, b, c), m.G) <= pointTol;

    // The rotation through 120 degrees about G takes O to P.
    const theta = 2 * Math.PI / 3, cs = Math.cos(theta), sn = Math.sin(theta);
    const dx = m.O.x - m.G.x, dy = m.O.y - m.G.y;
    const rotatedO = point(m.G.x + cs * dx + sn * dy, m.G.y - sn * dx + cs * dy);
    const circleCenter = circumcenter(m.O, m.G, m.aq);
    const radius = distance(circleCenter, m.O);

    const u = point(m.Fp.x - m.f.x, m.Fp.y - m.f.y); // F'f
    const v = point(m.O.x - m.G.x, m.O.y - m.G.y);   // GO
    const w = point(m.G.x - m.Gp.x, m.G.y - m.Gp.y); // GG'

    return {
      usable: usable,
      tenCount: tenOk.length,
      tenConcurrent: tenOk.every(Boolean),
      tenOk: tenOk,
      eulerC: Math.abs(m.eulerC.cross) <= areaTol,
      eulerA: Math.abs(m.eulerA.cross) <= areaTol,
      eulerB: Math.abs(m.eulerB.cross) <= areaTol,
      napoleonOuter: equilateral(m.Aq, m.Bq, m.Cq) && sharedCentroid(m.Aq, m.Bq, m.Cq),
      napoleonInner: equilateral(m.aq, m.bq, m.cq) && sharedCentroid(m.aq, m.bq, m.cq),
      rotateOP: distance(rotatedO, m.P) <= pointTol,
      angleOGP: Math.abs(angle(m.O, m.G, m.P) - theta) <= 1e-8,
      concyclic: finite(circleCenter) && Number.isFinite(radius) &&
        Math.abs(distance(circleCenter, m.P) - radius) <= pointTol &&
        Math.abs(distance(circleCenter, m.Bq) - radius) <= pointTol,
      angle1: sameAngleModPi(angle(m.O, m.G, m.Bq), angle(m.O, m.aq, m.Bq), 1e-8),
      angle2: sameAngleModPi(angle(m.O, m.aq, m.Bq), angle(m.P, m.cq, m.Cq), 1e-8),
      angle3: sameAngleModPi(angle(m.P, m.cq, m.Cq), angle(m.f, m.B, m.A), 1e-8),
      angle4: sameAngleModPi(angle(m.f, m.B, m.A), angle(m.f, m.Fp, m.A), 1e-8),
      fPrimeParallel: Math.abs(crossVec(u, v)) <= areaTol,
      gPrimeParallel: Math.abs(crossVec(w, v)) <= areaTol,
    };
  }

  /** An illustration has no win, loss or finished round. */
  function result(pos) {
    return null;
  }

  return {
    TURN: TURN, START: START,
    point: point, copy: copy, distance: distance, midpoint: midpoint,
    barycenter: barycenter, rotate: rotate, intersect: intersect,
    circumcenter: circumcenter, prorate: prorate, angle: angle,
    cross: cross, crossVec: crossVec, finite: finite,
    start: start, withPoint: withPoint, withOptions: withOptions,
    measure: measure, claims: claims, result: result,
  };
})();
