"use strict";

/*
 * BQTLemma — Bui Quang Tuan's lemma of equal areas, as a draggable diagram.
 *
 * A, B, C lie on one line; D and E are on the same side of that line with
 * AD parallel to BE and BD parallel to CE. F is the midpoint of AC. The lemma
 * says [DEM] = ([ABD] + [BCE]) / 2, where [XYZ] is the area of triangle XYZ.
 * The page also notes that [ABD] * [BCE] = [BDE]^2.
 *
 * The one idea the code relies on: the applet keeps its two constraints by
 * rebuilding one point from the other. Dragging D rebuilds E as the crossing
 * of the line through B parallel to AD and the line through C parallel to BD;
 * dragging E rebuilds D as the crossing of the line through A parallel to BE
 * and the line through B parallel to CE. Dragging A or B also rebuilds E,
 * while dragging C rebuilds D — that asymmetry is the applet's own behaviour,
 * and is kept here. F is always the plain midpoint of AC.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BqtLemmaCore, so the page loads it with a plain
 * <script> and porting/check-bqt-lemma.mjs loads it in Node. All positions are
 * plain data and every function returns a new one.
 */
const BqtLemmaCore = (() => {
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const valid = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** The applet's GeoSDoub.GetParallelTo(P,Q,R): through P, parallel to QR. */
  function parallelPoint(p, q, r) {
    return add(p, scale(sub(q, r), 100));
  }

  /** The applet's GeoSDoub.Intersect: ax+by+c=0 lines; NaN if nearly parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** DoubLine.CreateMidPoint(t): A*t + C*(1-t); t is the weight of A. */
  function pointOnAC(A, C, t) {
    return add(scale(A, t), scale(C, 1 - t));
  }

  /** DoubLine.UpdateMidPoint: the projection of B on AC, clamped to [0,1]. */
  function parameterOnAC(A, C, B) {
    const d = sub(A, C);
    const denom = dot(d, d);
    if (denom < EPS) return 1;
    const t = -dot(d, sub(C, B)) / denom;
    return Math.max(0, Math.min(1, t));
  }

  /** F, the midpoint of AC (the applet's Compute method). */
  function midPoint(A, C) {
    return { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
  }

  /** Applet UpgradeD: AD || BE and BD || CE, with E held where it is. */
  function upgradeD(s) {
    return intersect(s.A, parallelPoint(s.A, s.B, s.E),
                     s.B, parallelPoint(s.B, s.C, s.E));
  }

  /** Applet UpgradeE: BE || AD and CE || BD, with D held where it is. */
  function upgradeE(s) {
    return intersect(s.B, parallelPoint(s.B, s.A, s.D),
                     s.C, parallelPoint(s.C, s.B, s.D));
  }

  /** Unsigned triangle area, from the cross product (twice as fast as Heron). */
  function area(p, q, r) {
    return Math.abs(cross(sub(q, p), sub(r, p))) / 2;
  }

  /** Signed area, positive for counter-clockwise order in screen coordinates. */
  function signedArea(p, q, r) {
    return cross(sub(q, p), sub(r, p)) / 2;
  }

  /** Shortest distance from P to the infinite line XY. */
  function distToLine(P, X, Y) {
    const len = distance(X, Y);
    if (len < EPS) return Infinity;
    return Math.abs(cross(sub(Y, X), sub(P, X))) / len;
  }

  /**
   * The position of a new diagram. The default matches BQTLemmaCanvas.init on
   * its default 400x300 canvas: A=(80,240), C=(320,240), B at t=0.4 along AC,
   * D=(400/3,60), and E then rebuilt from D by UpgradeE.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const coef = o.coef === undefined ? 0.6 : o.coef;
    let s = {
      A: o.A ? { ...o.A } : { x: width / 5, y: height - height / 5 },
      C: o.C ? { ...o.C } : { x: width - width / 5, y: height - height / 5 },
      D: o.D ? { ...o.D } : { x: width / 3, y: height / 5 },
      E: o.E ? { ...o.E } : null,
      coef,
    };
    s.B = o.B ? { ...o.B } : pointOnAC(s.A, s.C, 1 - coef);
    if (s.E) s.D = upgradeD(s);
    else s.E = upgradeE(s);
    return s;
  }

  /**
   * Move one named handle exactly as UpgradePoints does. A, B and C keep the
   * B parameter on AC; moving C rebuilds D, the others rebuild E. Moving D
   * rebuilds E and moving E rebuilds D. The old position is not changed.
   */
  function withPoint(s, name, p) {
    const next = {
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
      D: { ...s.D }, E: { ...s.E }, coef: s.coef,
    };
    const q = { x: p.x, y: p.y };
    if (name === "A" || name === "C") {
      next[name] = q;
      next.B = pointOnAC(next.A, next.C, 1 - next.coef);
      if (name === "A") next.E = upgradeE(next);
      else next.D = upgradeD(next);
    } else if (name === "B") {
      next.B = pointOnAC(s.A, s.C, parameterOnAC(s.A, s.C, q));
      next.coef = 1 - parameterOnAC(s.A, s.C, next.B);
      next.E = upgradeE(next);
    } else if (name === "D") {
      next.D = q;
      next.E = upgradeE(next);
    } else if (name === "E") {
      next.E = q;
      next.D = upgradeD(next);
    } else {
      return s;
    }
    return next;
  }

  /** Every number the page draws or talks about, from this position. */
  function measurements(s) {
    const F = midPoint(s.A, s.C);
    const a = area(s.A, s.B, s.D);
    const b = area(s.B, s.C, s.E);
    const d = area(s.D, s.E, F);
    const aed = area(s.A, s.E, s.D);
    const cde = area(s.C, s.D, s.E);
    const bde = area(s.B, s.D, s.E);
    return {
      A: s.A, B: s.B, C: s.C, D: s.D, E: s.E, F,
      areas: { ABD: a, BCE: b, DEM: d, AED: aed, CDE: cde, BDE: bde },
      halfSum: (a + b) / 2,
      product: a * b,
      square: bde * bde,
      atMidpoint: distance(s.B, F) <= 1e-6 * Math.max(1, distance(s.A, s.C)),
      altitudes: {
        A: distToLine(s.A, s.D, s.E),
        B: distToLine(s.B, s.D, s.E),
        C: distToLine(s.C, s.D, s.E),
        F: distToLine(F, s.D, s.E),
      },
      valid: [s.A, s.B, s.C, s.D, s.E, F].every(valid),
    };
  }

  /** The page's own assertions, checked at this position. */
  function claims(s) {
    const m = measurements(s);
    if (!m.valid) return null;
    const scaleRef = Math.max(distance(s.A, s.C), distance(s.D, s.E), 1);
    const tol = 1e-7 * scaleRef * scaleRef;
    const close = (u, v) => Math.abs(u - v) <= tol;
    return {
      main: close(m.areas.DEM, m.halfSum),
      trapezoidABD: close(m.areas.ABD, m.areas.AED),
      trapezoidBCE: close(m.areas.BCE, m.areas.CDE),
      halfAltitude: close(m.altitudes.F, (m.altitudes.A + m.altitudes.C) / 2),
      product: close(m.product, m.square),
      midpoint: distance(m.F, midPoint(s.A, s.C)) < 1e-12,
      collinear: Math.abs(signedArea(s.A, s.B, s.C)) < 1e-7,
      sameSide: signedArea(s.A, s.B, s.D) * signedArea(s.A, s.B, s.E) > 0,
      parallels: Math.abs(cross(sub(s.D, s.A), sub(s.E, s.B))) <= tol &&
                 Math.abs(cross(sub(s.D, s.B), sub(s.E, s.C))) <= tol,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, midPoint, pointOnAC, parameterOnAC,
    parallelPoint, intersect, upgradeD, upgradeE,
    area, signedArea, distToLine, measurements, claims, result,
  };
})();
