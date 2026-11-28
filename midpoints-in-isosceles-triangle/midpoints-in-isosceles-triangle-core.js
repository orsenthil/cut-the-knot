"use strict";

/*
 * MidpointsInIsoscelesTriangle — the droodle behind Bogomolny's applet.
 *
 * In an isosceles triangle ABC (AB = AC), M is the midpoint of BC, H is the
 * foot of the perpendicular from M to AB, and D is the midpoint of HM. The
 * claim on the page is that AD is perpendicular to CH. The applet also draws
 * L, the foot from C to AB, and K, the crossing of AD and CH where it marks
 * the right angle.
 *
 * The one idea the code relies on: because M is the midpoint of BC, its
 * projection H onto AB is the midpoint of B and L (the projection of C). So
 * H is the midpoint of BL, and AD, CH are the medians of two similar right
 * triangles BLC and MHA, turned a quarter turn from each other.
 *
 * The drag rules are the applet's own: A keeps its x coordinate (Fix(1) in
 * CTKMoveableDoub), and moving B or C mirrors the other across the vertical
 * line through A at the same height (UpgradePoints), keeping AB = AC.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, MidpointsInIsoscelesTriangleCore, so the
 * page loads it with a plain <script> and the logic test loads it in Node.
 * Every function takes plain data and returns new objects.
 */
const MidpointsInIsoscelesTriangleCore = (() => {
  const EPS = 1e-9;

  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const dotVec = (u, v) => u.x * v.x + u.y * v.y;

  /** GeoSDoub.NearestPoint: the foot on the infinite line through a and b. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.Intersect: two lines in ax + by + c = 0 form; NaN if parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** The canvas layout from MidpointsInIsoscelesTriangleCanvas.init. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = Math.floor(width / 2); // the applet's integer division
    const top = Math.floor(height / 3);
    const half = width / 4;
    const A = { x: cx, y: top };
    const B = { x: A.x - half, y: height - top };
    const C = { x: A.x + half, y: B.y };
    return { A, B, C };
  }

  /**
   * Move one handle exactly as the applet does after Mover.UpdateLocation and
   * UpgradePoints. A's x is fixed; B and C are mirrored about A.x, at one y.
   */
  function withPoint(state, name, p) {
    const s = { A: { ...state.A }, B: { ...state.B }, C: { ...state.C } };
    if (name === "A") {
      s.A.y = p.y;
      return s;
    }
    if (name === "B") {
      s.B = { x: p.x, y: p.y };
      s.C = { x: 2 * s.A.x - s.B.x, y: s.B.y };
      return s;
    }
    if (name === "C") {
      s.C = { x: p.x, y: p.y };
      s.B = { x: 2 * s.A.x - s.C.x, y: s.C.y };
      return s;
    }
    return s;
  }

  /** The five constructed points of Canvas.Compute, plus its unused midpoint. */
  function compute(state) {
    const { A, B, C } = state;
    const M = midpoint(B, C);
    const H = nearestPoint(M, A, B);
    const D = midpoint(M, H);
    const L = nearestPoint(C, A, B);
    const K = intersect(A, D, C, H);
    const N = midpoint(H, D); // computed by the applet, never drawn
    // The applet moves its label to rounded (M.x, midpoint(H,D).y), with an
    // odd mix of coordinates; that placement is part of Compute.
    const label = { x: Math.round(M.x), y: Math.round(N.y) };
    return { M, H, D, L, K, N, label };
  }

  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** Cosine of the angle between the rays u=(p->q) and v=(r->s). */
  function cosine(p, q, r, s) {
    const u = { x: q.x - p.x, y: q.y - p.y };
    const v = { x: s.x - r.x, y: s.y - r.y };
    const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
    if (nu < EPS || nv < EPS) return NaN;
    return dotVec(u, v) / (nu * nv);
  }

  function isFinitePoint(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  function onLine(p, a, b, tol) {
    if (!isFinitePoint(p)) return false;
    const scale = Math.max(dist(a, b), 1);
    return Math.abs(cross(a, b, p)) / scale <= tol;
  }

  /** Lengths and angles, with tolerances scaled to the size of the diagram. */
  function measurements(state) {
    const { A, B, C } = state;
    const g = compute(state);
    const lengths = {
      AB: dist(A, B), AC: dist(A, C), BC: dist(B, C),
      AM: dist(A, g.M), MH: dist(g.M, g.H),
      BL: dist(B, g.L), LC: dist(g.L, C), HA: dist(g.H, A),
      AD: dist(A, g.D), CH: dist(C, g.H), DE: dist(g.D, g.N),
    };
    const scale = Math.max(lengths.AB, lengths.AC, lengths.BC, 1);
    const small = EPS * scale;
    const flat = Math.abs(cross(A, B, C)) <= small;
    return {
      A, B, C, ...g, lengths, scale,
      degenerate: flat || !isFinitePoint(g.K) ||
        Math.min(lengths.AB, lengths.AC, lengths.MH, dist(g.H, g.D)) <= small,
      cosADCH: cosine(A, g.D, C, g.H),
      cosK: isFinitePoint(g.K) ? cosine(g.K, A, g.K, C) : NaN,
      cosCLAH: cosine(C, g.L, A, g.H),
      cosBLMH: cosine(B, g.L, g.M, g.H),
      cosCHAM: cosine(C, g.H, A, g.M),
      cosBCAM: cosine(B, C, A, g.M),
      doubleArea: Math.abs(cross(A, B, C)),
    };
  }

  /**
   * Every claim on the applet's page, plus the page's own side-perpendicular
   * sentence. `pageCHperpAM` is false in general: the perpendicular pair is
   * BC and AM, not CH and AM.
   */
  function claims(state) {
    const m = measurements(state);
    // A shallow triangle makes K ill-conditioned; 1e-7 is still far below the
    // angle the applet would visibly draw, and far from the page's false pair.
    const tol = 1e-7;
    const perp = (c) => Number.isFinite(c) && Math.abs(c) <= tol;
    const close = (a, b) => Math.abs(a - b) <= tol * Math.max(m.scale, 1);
    const pointClose = (p, q) => isFinitePoint(p) && isFinitePoint(q) && dist(p, q) <= tol * Math.max(m.scale, 1);
    if (m.degenerate) {
      return {
        isosceles: false, MmidBC: false, MHperpAB: false, DmidMH: false,
        ADperpCH: false, rightAngleAtK: false, HmidBL: false,
        CLperpAH: false, BLperpMH: false, BCperpAM: false,
        similarBLC_MHA: false, medians: false, pageCHperpAM: false,
      };
    }
    const r1 = m.lengths.BL / m.lengths.MH;
    const r2 = m.lengths.LC / m.lengths.HA;
    const r3 = m.lengths.BC / m.lengths.AM;
    return {
      isosceles: close(m.lengths.AB, m.lengths.AC),
      MmidBC: pointClose(m.M, midpoint(m.B, m.C)),
      MHperpAB: perp(cosine(m.M, m.H, m.A, m.B)),
      DmidMH: pointClose(m.D, midpoint(m.M, m.H)),
      ADperpCH: perp(m.cosADCH),
      rightAngleAtK: perp(m.cosK) && onLine(m.K, m.A, m.D, tol) && onLine(m.K, m.C, m.H, tol),
      HmidBL: pointClose(m.H, midpoint(m.B, m.L)),
      CLperpAH: perp(m.cosCLAH),
      BLperpMH: perp(m.cosBLMH),
      BCperpAM: perp(m.cosBCAM),
      similarBLC_MHA: close(r1, r2) && close(r2, r3),
      medians: pointClose(m.H, midpoint(m.B, m.L)) && pointClose(m.D, midpoint(m.M, m.H)),
      pageCHperpAM: perp(m.cosCHAM),
    };
  }

  /** An illustration has no win, loss or end condition. */
  function result(/* state */) {
    return null;
  }

  return {
    start, withPoint, compute, nearestPoint, intersect,
    measurements, claims, result, midpoint, dist, dotVec,
  };
})();
