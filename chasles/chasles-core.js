"use strict";

/*
 * Chasles — the illustration behind Bogomolny's "Projective Proof of Pascal's
 * Theorem" (the applet Chasles, written by Alexander Bogomolny with a proof
 * suggested by Hubert Shutrick).
 *
 * Six points A, B, C, D, E, F sit on an ellipse. Chasles' theorem says that
 * the cross-ratio of the pencil of four lines from a point of a conic to four
 * other points of it does not depend on the fifth point. Applied twice, it
 * gives Pascal's theorem: P = AB^DE, Q = CD^FA and R = EF^PQ, S = BC^PQ
 * satisfy R = S. The applet also draws T = AD^PQ and the two points L, M
 * where PQ cuts the conic, which are the endpoints of the pencil's base.
 *
 * The position is plain data: the four draggable rectangle corners that fix
 * the ellipse, the six points on it and the "Show names" flag. Corners mirror
 * as in CTKEllipse.MaintainRect; a point dragged on the ellipse keeps its
 * normalised angle, as in CTKEllipse.KeepOnEllipse. Intersections follow
 * GeoSDoub.Intersect, and the line/conic cut follows CTKEllipse.Intersect.
 * No document, no window, no storage; one global so Node can load this file.
 */
const ChaslesCore = (() => {
  const NAMES = ["A", "B", "C", "D", "E", "F"];
  /* ChaslesCanvas.init: EllipseAt at these six angles. */
  const START_ANGLES = [
    -2.356194490192345,  // -3pi/4
    1.5707963267948966,  //  pi/2
    -0.5235987755982988, // -pi/6
    2.356194490192345,   //  3pi/4
    -1.5707963267948966, // -pi/2
    1.0471975511965976,  //  pi/3
  ];

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const cross = (a, b) => a.x * b.y - a.y * b.x;

  /** CTKEllipse.EllipseUpdated: A = (V1.x-V0.x)/2, B = (V1.y-V2.y)/2. */
  function ellipseFromCorners(V) {
    return {
      cx: (V[0].x + V[1].x) / 2,
      cy: (V[1].y + V[2].y) / 2,
      a: (V[1].x - V[0].x) / 2,
      b: (V[1].y - V[2].y) / 2,
    };
  }

  function ellipseAt(el, t) {
    return { x: el.cx + el.a * Math.cos(t), y: el.cy + el.b * Math.sin(t) };
  }

  /** CTKEllipse.KeepOnEllipse uses the signed angle in normalised coordinates. */
  function angleOnEllipse(el, p) {
    return Math.atan2((p.y - el.cy) / el.b, (p.x - el.cx) / el.a);
  }

  /** GeoSDoub.Intersect of the infinite lines AB and CD (NaN if parallel). */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /**
   * CTKEllipse.Intersect(a, b, c): cut (x-cx)^2/a^2 + (y-cy)^2/b^2 = 1 by
   * ax+by+c = 0. The applet scales to a circle of radius 1000, cuts it there
   * and scales back; the algebra below is the same line/circle cut in closed
   * form. Returns 0, 1 or 2 points, or null when the line misses the ellipse.
   */
  function conicIntersect(el, a, b, c) {
    if (el.a === 0 || el.b === 0) return null;
    const k = a * el.cx + b * el.cy + c;
    const aa = a * el.a, bb = b * el.b;
    const n2 = aa * aa + bb * bb;
    if (n2 < 1e-24 || !Number.isFinite(n2)) return null;
    const t = -k / n2;
    const fx = t * aa, fy = t * bb;                 // foot of the normal
    const h2 = 1 - (fx * fx + fy * fy);             // circle radius scaled to 1
    if (h2 < -1e-12) return null;
    const h = Math.sqrt(Math.max(0, h2)) / Math.sqrt(n2);
    const dx = -bb * h, dy = aa * h;
    const toWorld = (x, y) => ({ x: el.cx + x * el.a, y: el.cy + y * el.b });
    const one = toWorld(fx + dx, fy + dy);
    const two = toWorld(fx - dx, fy - dy);
    return Math.abs(h) < 1e-13 ? [one] : [one, two];
  }

  /** The position a new applet starts from, for a 400x300 canvas by default. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const cx = width / 2, cy = height / 2;
    const dx = width / 3, dy = height / 3;
    const corners = o.corners
      ? o.corners.map(copy)
      : [
          { x: cx - dx, y: cy + dy }, // V0: bottom left
          { x: cx + dx, y: cy + dy }, // V1: bottom right
          { x: cx + dx, y: cy - dy }, // V2: top right
          { x: cx - dx, y: cy - dy }, // V3: top left
        ];
    const el = ellipseFromCorners(corners);
    const points = {};
    NAMES.forEach((name, i) => {
      points[name] = o.points && o.points[name]
        ? ellipseAt(el, angleOnEllipse(el, o.points[name]))
        : ellipseAt(el, START_ANGLES[i]);
    });
    return { width, height, corners, ellipse: el, points, showNames: Boolean(o.showNames) };
  }

  /**
   * Drag one of the four bounding-box corners. The applet refuses a point on
   * the central cross (within 10 px of either centre line), then mirrors the
   * other three corners about the unchanged centre and keeps all six conic
   * points at the same normalised angle. Returns the old state when refused.
   */
  function withCorner(s, index, p) {
    if (!Number.isInteger(index) || index < 0 || index > 3 || !finite(p)) return s;
    const el = s.ellipse;
    if (Math.abs(p.x - el.cx) <= 10 || Math.abs(p.y - el.cy) <= 10) return s;
    const u = el.cx - p.x, v = el.cy - p.y;
    const at = (x, y) => ({ x, y });
    let C;
    if (index === 0) {
      C = [at(p.x, p.y), at(el.cx + u, p.y), at(el.cx + u, el.cy + v), at(p.x, el.cy + v)];
    } else if (index === 1) {
      C = [at(el.cx + u, p.y), at(p.x, p.y), at(p.x, el.cy + v), at(el.cx + u, el.cy + v)];
    } else if (index === 2) {
      C = [at(el.cx + u, el.cy + v), at(p.x, el.cy + v), at(p.x, p.y), at(el.cx + u, p.y)];
    } else {
      C = [at(p.x, el.cy + v), at(el.cx + u, el.cy + v), at(el.cx + u, p.y), at(p.x, p.y)];
    }
    const nextEl = ellipseFromCorners(C);
    const points = {};
    for (const name of NAMES) {
      points[name] = ellipseAt(nextEl, angleOnEllipse(el, s.points[name]));
    }
    return { ...s, corners: C, ellipse: nextEl, points };
  }

  /** Drag A..F: the point is projected back onto the ellipse (KeepOnEllipse). */
  function withPoint(s, name, p) {
    if (!NAMES.includes(name) || !finite(p)) return s;
    const q = ellipseAt(s.ellipse, angleOnEllipse(s.ellipse, p));
    return { ...s, points: { ...s.points, [name]: q } };
  }

  function withNames(s, on) {
    return { ...s, showNames: Boolean(on) };
  }

  /**
   * ChaslesCanvas.Compute, step by step. P = AB^DE, Q = CD^FA, LM = PQ,
   * R = EF^LM, S = BC^LM, T = AD^LM and L,M are where LM cuts the conic.
   * L is the intersection nearer to T, exactly as in the applet.
   */
  function compute(s) {
    const p = s.points;
    const P = intersect(p.A, p.B, p.D, p.E);
    const Q = intersect(p.C, p.D, p.F, p.A);
    const geom = { P, Q, R: null, S: null, T: null, L: null, M: null, line: null };
    if (!finite(P) || !finite(Q) || dist(P, Q) <= 0.1) return geom;

    /* The line PQ, in ax+by+c=0 form, as passed to CTKEllipse.Intersect. */
    const a = Q.y - P.y;
    const dx = Q.x - P.x;
    const b = -dx;
    const c = P.y * dx - P.x * a;
    geom.line = { a, b, c };
    geom.R = intersect(p.E, p.F, P, Q);
    geom.S = intersect(p.B, p.C, P, Q);
    geom.T = intersect(p.A, p.D, P, Q);

    const roots = conicIntersect(s.ellipse, a, b, c);
    if (roots && roots.length) {
      const t = finite(geom.T) ? geom.T : P;
      if (roots.length === 1) {
        geom.L = roots[0];
      } else if (dist(roots[0], t) < dist(roots[1], t)) {
        geom.L = roots[0];
        geom.M = roots[1];
      } else {
        geom.L = roots[1];
        geom.M = roots[0];
      }
    }
    return geom;
  }

  /** Cross-ratio of four collinear points, measured along their own line. */
  function crossRatioLine(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return NaN;
    const u = { x: d.x - c.x, y: d.y - c.y };
    const v = { x: b.x - a.x, y: b.y - a.y };
    const axis = Math.abs(u.x) > Math.abs(u.y) ? "x" : "y";
    const A = a[axis], B = b[axis], Cc = c[axis], D = d[axis];
    if (Math.abs(Cc - B) < 1e-12 || Math.abs(D - B) < 1e-12) return NaN;
    return ((Cc - A) / (Cc - B)) / ((D - A) / (D - B));
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

  function near(x, y, tol) {
    return Number.isFinite(x) && Number.isFinite(y) &&
      Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
  }

  /**
   * Every claim the applet's page makes, at the current configuration.
   * The chain (LQRM) = F(LAEM) = D(LAEM) = (LTPM) = A(LDBM) = C(LDBM)
   * = (LQSM) is Chasles applied twice; equal first and last terms say R = S.
   */
  function claims(s) {
    const g = compute(s);
    const p = s.points;
    const scale = Math.max(s.ellipse.a, s.ellipse.b, 1);
    const tolPoint = 1e-6 * scale;
    const tolRatio = 1e-6;
    const got = {
      regular: [g.P, g.Q, g.R, g.S, g.T, g.L, g.M].every(finite),
      pascal: finite(g.R) && finite(g.S) && dist(g.R, g.S) <= tolPoint,
    };
    if (!got.regular || !got.pascal) {
      return { ...got, chaslesF: false, chaslesA: false, chain: false, all: false };
    }
    const f = crossRatioPencil(p.F, g.L, p.A, p.E, g.M);
    const d = crossRatioPencil(p.D, g.L, p.A, p.E, g.M);
    const a = crossRatioPencil(p.A, g.L, p.D, p.B, g.M);
    const c = crossRatioPencil(p.C, g.L, p.D, p.B, g.M);
    const qr = crossRatioLine(g.L, g.Q, g.R, g.M);
    const qs = crossRatioLine(g.L, g.Q, g.S, g.M);
    const tp = crossRatioLine(g.L, g.T, g.P, g.M);
    got.chaslesF = near(f, d, tolRatio);
    got.chaslesA = near(a, c, tolRatio);
    got.chain = near(qr, f, tolRatio) && near(d, tp, tolRatio) &&
      near(tp, a, tolRatio) && near(c, qs, tolRatio);
    got.all = got.regular && got.pascal && got.chaslesF && got.chaslesA && got.chain;
    return got;
  }

  /** An illustration cannot be won, lost or finished by a move. */
  function result(/* state */) {
    return null;
  }

  return {
    NAMES, start, ellipseAt, angleOnEllipse, ellipseFromCorners,
    withCorner, withPoint, withNames, intersect, conicIntersect,
    compute, crossRatioLine, crossRatioPencil, claims, result,
  };
})();
