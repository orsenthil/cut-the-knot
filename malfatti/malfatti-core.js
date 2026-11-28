"use strict";

/*
 * Malfatti's problem, from Alexander Bogomolny's applet Malfatti.
 *
 * Given a triangle ABC we want three circles, each touching the other two and
 * two sides of the triangle. The applet draws Steiner's construction: the
 * incenter I, the incircles of IAB, IBC and ICA, their second common internal
 * tangents (meeting at L and cutting the sides at P, M, T), then the incircles
 * of the four-sided regions APLT, BMLP and CTLM. Those three incircles are the
 * Malfatti circles. The code transcribes the applet's own geometry, including
 * its choice of tangent and its averaging of four incenter candidates.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, MalfattiCore. Positions are plain data, so the page
 * can hand them to the shared progress tracker and the tutor.
 */
const MalfattiCore = (() => {
  const EPS = 1e-7;

  const sq = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sq(p, q));
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const circle = (c, r) => ({ x: c.x, y: c.y, r: r });
  const seg = (p, q) => [p, q];

  /* GeoSDoub.FindOrientation: the sign of the cross product (b-a)x(c-a). */
  function orient(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /* GeoSDoub.Rotate: turn point p about centre c by s times theta. */
  function rotate(c, p, theta, s) {
    const co = Math.cos(theta), si = Math.sin(theta);
    const dx = p.x - c.x, dy = p.y - c.y;
    return {
      x: c.x + co * dx - s * si * dy,
      y: c.y + s * si * dx + co * dy,
    };
  }

  /* GeoSDoub.ComputeAngle: the angle at a between b and c. */
  function angle(a, b, c) {
    const num = (sq(a, b) + sq(a, c) - sq(b, c)) / 2;
    const den = dist(a, b) * dist(a, c);
    return Math.acos(Math.max(-1, Math.min(1, num / den)));
  }

  /*
   * GeoSDoub.Intersect of two lines (four points). The applet declares lines
   * parallel when the determinant is smaller than one whole unit, and returns
   * a point with NaN coordinates in that case; keep that, so the drawing hides
   * an impossible construction instead of inventing an intersection.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  const lineIntersect = (l, m) => l && m ? intersect(l[0], l[1], m[0], m[1]) : null;

  /* GeoSDoub.NearestPoint(p,a,b): the foot of the perpendicular on line ab. */
  function foot(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = sq(a, b);
    if (len2 < 0.1) return p;
    const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
    return { x: a.x + vx * t, y: a.y + vy * t };
  }

  const distToLine = (p, l) => dist(p, foot(p, l[0], l[1]));

  /* GeoSDoub.FindIncenter. */
  function incenter(a, b, c) {
    const t1 = angle(a, b, c) / 2, t2 = angle(b, c, a) / 2;
    const s = orient(a, b, c);
    const p = rotate(a, b, t1, s), q = rotate(b, c, t2, s);
    return intersect(a, p, b, q);
  }

  /* GeoSDoub.FindAngleBisector(a,b,c): bisector at a, cut by line bc. */
  function bisector(a, b, c) {
    const t = angle(a, b, c) / 2, s = orient(a, b, c);
    const p = rotate(a, b, t, s);
    return intersect(a, p, b, c);
  }

  /* GeoSDoub.Intersect(DoubCircle,DoubCircle), the X and Y branches. */
  function circleIntersections(c1, c2) {
    const dx = Math.abs(c1.x - c2.x), dy = Math.abs(c1.y - c2.y);
    if (dx > 1) {
      // Solve x = m*y + b for the radical axis, as the applet's X branch does.
      const m = -(c1.y - c2.y) / (c1.x - c2.x);
      const b = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y
        - c1.r * c1.r + c2.r * c2.r) / 2 / (c1.x - c2.x);
      const off = b - c1.x;
      const a = m * m + 1, p = m * off - c1.y;
      const q = off * off + c1.y * c1.y - c1.r * c1.r;
      const disc = p * p - a * q;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const y1 = (-p + root) / a, y2 = (-p - root) / a;
      return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
    }
    if (dy > 1) {
      // Solve y = m*x + b for the radical axis, as the applet's Y branch does.
      const m = -(c1.x - c2.x) / (c1.y - c2.y);
      const b = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x
        - c1.r * c1.r + c2.r * c2.r) / 2 / (c1.y - c2.y);
      const off = b - c1.y;
      const a = m * m + 1, p = m * off - c1.x;
      const q = off * off + c1.x * c1.x - c1.r * c1.r;
      const disc = p * p - a * q;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const x1 = (-p + root) / a, x2 = (-p - root) / a;
      return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
    }
    return [{ x: NaN, y: NaN }, { x: NaN, y: NaN }];
  }

  /* Inversion.Tangent: the two lines from p touching circle c. */
  function tangentsFrom(c, p) {
    const d2 = sq(c, p) - c.r * c.r;
    if (d2 < 0) return null;
    const aux = { x: p.x, y: p.y, r: Math.sqrt(d2) };
    const q = circleIntersections(c, aux);
    if (!q) return null;
    // Java keeps NaN endpoints here; the caller's comparisons then fall back
    // to the common tangent. Do not "fix" those points.
    return [seg(p, q[0]), seg(p, q[1])];
  }

  /* Tangents.GetInternalTangents: both internal tangents of two circles. */
  function internalTangents(c1, c2) {
    const r1 = c1.r, r2 = c2.r, sum = r1 + r2;
    const aux = { x: c1.x, y: c1.y, r: sum };
    const ts = tangentsFrom(aux, c2);
    if (!ts) return null;
    return ts.map((t) => {
      const q = t[1];
      return seg(
        { x: c1.x + (q.x - c1.x) * r1 / sum, y: c1.y + (q.y - c1.y) * r1 / sum },
        { x: c2.x - (q.x - c1.x) * r2 / sum, y: c2.y - (q.y - c1.y) * r2 / sum },
      );
    });
  }

  /* MalfattiCanvas.CommonPoint / CommonTangent. */
  function commonPoint(c1, c2) {
    const s = c1.r + c2.r;
    const t1 = c1.r / s, t2 = c2.r / s;
    return { x: t2 * c1.x + t1 * c2.x, y: t2 * c1.y + t1 * c2.y };
  }
  function commonTangent(c1, c2) {
    const p = commonPoint(c1, c2);
    return seg(p, {
      x: p.x + c1.y - c2.y,
      y: p.y - c1.x + c2.x,
    });
  }

  /* MalfattiCanvas.GetSecondTangents, including its fallback rules. */
  function secondTangent(c1, c2, incircle) {
    if (!c1 || !c2) return null;
    let tangents;
    try {
      tangents = internalTangents(c1, c2);
    } catch (e) {
      tangents = null;
    }
    if (!tangents) {
      if (Math.abs(dist(c1, c2) - c1.r - c2.r) < 1) return commonTangent(c1, c2);
      return null;
    }
    if (dist(tangents[0][0], tangents[0][1]) < 2) return commonTangent(c1, c2);
    for (let i = 0; i < 2; i++) {
      if (incircle && distToLine(incircle, tangents[i]) > 1) return tangents[i];
    }
    return commonTangent(c1, c2);
  }

  /* MalfattiCanvas.ComputeIntersection: the average of the pairwise meets. */
  function threeLinePoint(lines) {
    if (!lines || lines.length < 3) return null;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (!lines[i] || !lines[j]) continue;
      const p = lineIntersect(lines[i], lines[j]);
      if (!finite(p)) continue;
      sx += p.x; sy += p.y; n++;
    }
    return n ? { x: sx / n, y: sy / n } : { x: NaN, y: NaN };
  }

  /* The applet's incircle of a triangle, with the radius averaged over sides. */
  function triangleIncircle(a, b, c) {
    const i = incenter(a, b, c);
    const r = (dist(i, foot(i, b, c)) + dist(i, foot(i, c, a)) + dist(i, foot(i, a, b))) / 3;
    return circle(i, r);
  }

  /* MalfattiCanvas.BisectorCandidate and its fourfold average. */
  function bisectorCandidate(a, b, c, d) {
    const u = bisector(b, a, c), v = bisector(a, b, d);
    return intersect(b, u, a, v);
  }
  function quadrupleIncircle(a, b, c, d) {
    const cands = [
      bisectorCandidate(b, c, d, a),
      bisectorCandidate(c, d, a, b),
      bisectorCandidate(d, a, b, c),
      bisectorCandidate(a, b, c, d),
    ];
    const center = {
      x: (cands[0].x + cands[1].x + cands[2].x + cands[3].x) / 4,
      y: (cands[0].y + cands[1].y + cands[2].y + cands[3].y) / 4,
    };
    const r = (distToLine(center, seg(c, d)) + distToLine(center, seg(d, a))
      + distToLine(center, seg(a, b)) + distToLine(center, seg(b, c))) / 4;
    return circle(center, r);
  }

  /** The whole construction, as plain data. */
  function geometry(state) {
    const { A, B, C } = state;
    const incircle = triangleIncircle(A, B, C);
    const IAB = triangleIncircle(incircle, A, B);
    const IBC = triangleIncircle(incircle, B, C);
    const ICA = triangleIncircle(incircle, C, A);
    const lineAB = secondTangent(IBC, ICA, incircle); // through M and T, by side BC and CA
    const lineBC = secondTangent(ICA, IAB, incircle); // through T and P
    const lineCA = secondTangent(IAB, IBC, incircle); // through P and M
    const Ia = foot(IBC, B, C); // M, on BC
    const Ib = foot(ICA, C, A); // T, on CA
    const Ic = foot(IAB, A, B); // P, on AB
    const L = threeLinePoint([lineAB, lineBC, lineCA]);
    const circleA = quadrupleIncircle(L, Ib, A, Ic);
    const circleB = quadrupleIncircle(L, Ic, B, Ia);
    const circleC = quadrupleIncircle(L, Ia, C, Ib);
    return {
      A, B, C, I: incircle, IAB, IBC, ICA,
      lineAB, lineBC, lineCA, M: Ia, T: Ib, P: Ic, Ia, Ib, Ic, L,
      circleA, circleB, circleC,
      D: commonPoint(circleB, circleC),
      E: commonPoint(circleC, circleA),
      F: commonPoint(circleA, circleB),
    };
  }

  const DEFAULT = {
    A: { x: 400 / 2 - 400 / 3, y: 180 + 120 },
    B: { x: 400 / 2 + 400 / 3, y: 180 + 120 },
    C: { x: 400 / 2 + (400 / 3) * Math.cos(Math.PI / 3),
      y: 180 - (400 / 3) * Math.sin(Math.PI / 3) - 120 / 2 },
  };
  const OPTION_KEYS = ["names", "bisectors", "incircles", "secondTangents"];

  /** The position a new picture starts from (the applet's own point layout). */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const key of OPTION_KEYS) opts[key] = Boolean(o.options && o.options[key]);
    return {
      A: { ...DEFAULT.A }, B: { ...DEFAULT.B }, C: { ...DEFAULT.C },
      options: opts, explored: false,
    };
  }

  /** Move one corner; the other corners and the options are untouched. */
  function move(state, name, p) {
    if (!["A", "B", "C"].includes(name) || !finite(p)) return state;
    return { ...state, [name]: { x: p.x, y: p.y }, explored: true };
  }

  function setOption(state, name, on) {
    if (!OPTION_KEYS.includes(name)) return state;
    return { ...state, options: { ...state.options, [name]: Boolean(on) } };
  }

  function reset(state) {
    return { ...start(), options: { ...state.options } };
  }

  /** Keep the corners inside the drawing and away from a flat triangle. */
  function clamp(p) {
    return { x: Math.max(14, Math.min(386, p.x)), y: Math.max(16, Math.min(344, p.y)) };
  }

  function area(s) {
    return Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x)) / 2;
  }

  const close = (a, b, tol) => Math.abs(a - b) <= tol;

  /**
   * The page's claims, checked on the current triangle, plus a comparison
   * with the incircle-and-two-corner-circles packing from Lob & Richmond.
   */
  function claims(state) {
    const g = geometry(state);
    const cir = [g.circleA, g.circleB, g.circleC];
    const valid = cir.every((c) => finite(c) && Number.isFinite(c.r) && c.r > 0);
    if (!valid) return { valid: false, triangleArea: area(state) };
    // The applet rounds its construction to whole pixels when drawing and its
    // fallback tangent can be a pixel off on nearly tangent circles. Compare
    // with a tolerance of a fraction of a pixel relative to the triangle size.
    const tol = Math.max(0.5, 0.01 * Math.sqrt(area(state)));
    const sides = [seg(state.A, state.B), seg(state.B, state.C), seg(state.C, state.A)];
    const touchesSides = cir.map((c, i) =>
      close(distToLine(c, sides[i]), c.r, tol) && close(distToLine(c, sides[(i + 2) % 3]), c.r, tol));
    const touchesEachOther = [
      close(dist(g.circleA, g.circleB), g.circleA.r + g.circleB.r, tol),
      close(dist(g.circleB, g.circleC), g.circleB.r + g.circleC.r, tol),
      close(dist(g.circleC, g.circleA), g.circleC.r + g.circleA.r, tol),
    ];
    const quads = [
      [state.A, g.P, g.L, g.T],
      [state.B, g.M, g.L, g.P],
      [state.C, g.T, g.L, g.M],
    ];
    const pitot = quads.map((q) => {
      const lengths = [0, 1, 2, 3].map((k) => dist(q[k], q[(k + 1) % 4]));
      // Opposite-side sums can drift by a pixel or two when the second
      // tangent is the applet's fallback. Allow 3% of a typical side.
      const local = Math.max(2, 0.03 * (lengths[0] + lengths[1] + lengths[2] + lengths[3]) / 4);
      return close(lengths[0] + lengths[2], lengths[1] + lengths[3], local);
    });
    const quadIncircle = [g.circleA, g.circleB, g.circleC].map((c, i) => {
      const q = quads[i];
      return q.every((_, k) => close(distToLine(c, seg(q[k], q[(k + 1) % 4])), c.r, tol));
    });
    const concurrent = finite(g.L)
      && [g.lineAB, g.lineBC, g.lineCA].every((l) => l && distToLine(g.L, l) < tol);
    const malt = Math.PI * cir.reduce((s, c) => s + c.r * c.r, 0);
    return {
      valid: true, touchesSides, touchesEachOther, pitot, quadIncircle,
      concurrent, maltattiArea: malt, triangleArea: area(state),
    };
  }

  /** A short spoken report for the status line. */
  function describe(state) {
    const g = geometry(state);
    const cl = claims(state);
    if (!cl.valid || !finite(g.L)) return "Move a corner: the triangle is too thin to draw this construction.";
    const rs = [g.circleA.r, g.circleB.r, g.circleC.r].map((r) => r.toFixed(1)).join(", ");
    return `Malfatti circle radii: ${rs}. The three circles touch each other and two sides each; total area ${cl.maltattiArea.toFixed(0)} square units.`;
  }

  /** The position, in board units, for the player's record and the tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      A: state.A, B: state.B, C: state.C, options: state.options,
      I: g.I, IAB: g.IAB, IBC: g.IBC, ICA: g.ICA,
      M: g.M, P: g.P, T: g.T, L: g.L,
      circles: [g.circleA, g.circleB, g.circleC],
      D: g.D, E: g.E, F: g.F,
    };
  }

  return {
    start, move, setOption, reset, clamp, geometry, claims, describe, position,
    // Pure helpers, handy for the logic test and for a second transcription.
    util: { dist, sq, foot, distToLine, orient, rotate, angle, intersect, incenter,
      bisector, circleIntersections, tangentsFrom, internalTangents,
      commonPoint, commonTangent, secondTangent, triangleIncircle,
      quadrupleIncircle, finite },
    OPTION_KEYS,
  };
})();
