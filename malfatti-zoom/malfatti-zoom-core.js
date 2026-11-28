"use strict";

/*
 * Malfatti Zoom, from Alexander Bogomolny's applet MalfattiZoom.
 *
 * The picture is Steiner's construction of the three Malfatti circles of a
 * triangle A1 A2 A3, as proved by Hart. Let I be the incenter. The circles
 * c_k inscribed in the triangles I A_i A_j (i, j the two indices other than k)
 * have the bisectors I A_i as common internal tangents. Their *second*
 * internal tangents meet at L and cut the sides A_i A_j at D_k. The incircle
 * of each quadrilateral A_i D_j L D_k is the k-th Malfatti circle. This page
 * follows the applet's own (integer-indexed) construction step by step,
 * including the way it averages four bisector candidates to make each final
 * circle and the zoom similarity about the centre of the board.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MalfattiZoomCore, so the page loads it with
 * a plain <script> and porting/check-malfatti-zoom.mjs loads it in Node.
 * The position is plain data and every function returns a new position.
 */
const MalfattiZoomCore = (() => {
  const EPS = 1e-10;

  /** The applet's radio group: No zoom, 2X, 4X, 6X, 8X. */
  const ZOOMS = [
    { key: "1", label: "No zoom", a: 1 },
    { key: "2", label: "2X", a: 2 },
    { key: "4", label: "4X", a: 4 },
    { key: "6", label: "6X", a: 6 },
    { key: "8", label: "8X", a: 8 },
  ];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });

  /** GeoSDoub.NearestPoint(p, a, b): the foot on the *line* a b. */
  function nearest(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  const distToLine = (p, a, b) => distance(p, nearest(p, a, b));

  /**
   * GeoSDoub.Intersect of two lines, as the applet uses it. It refuses a
   * determinant below 1 (a pixel-scale guard against near-parallel lines)
   * and returns null there; callers skip such a point.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (a2 * c1 - a1 * c2) / det;
    return { x, y };
  }

  /** The incenter, by the usual side-length weights (GeoSDoub.FindIncenter). */
  function incenter(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const s = x + y + z;
    if (s < EPS) return { x: a.x, y: a.y };
    return {
      x: (x * a.x + y * b.x + z * c.x) / s,
      y: (x * a.y + y * b.y + z * c.y) / s,
    };
  }

  /** A point on the internal bisector at v, on the opposite side p q. */
  function bisectorFoot(v, p, q) {
    const u = distance(v, p), w = distance(v, q);
    const s = u + w;
    if (s < EPS) return { x: p.x, y: p.y };
    return { x: (w * p.x + u * q.x) / s, y: (w * p.y + u * q.y) / s };
  }

  /** GeoSDoub.FindAngleBisector(v, p, q), as a point on the bisector line. */
  const angleBisector = (v, p, q) => bisectorFoot(v, p, q);

  /** Applet's GetIncircle: FindIncenter, radius = mean distance to the sides. */
  function incircle(a, b, c) {
    const I = incenter(a, b, c);
    const r = (distToLine(I, b, c) + distToLine(I, c, a) + distToLine(I, a, b)) / 3;
    return { center: I, radius: r };
  }

  /** Applet's CommonPoint: the internal centre of similarity. */
  function commonPoint(c1, c2) {
    const r1 = c1.radius, r2 = c2.radius, s = r1 + r2;
    if (s < EPS) return { x: c1.center.x, y: c1.center.y };
    return {
      x: (r2 * c1.center.x + r1 * c2.center.x) / s,
      y: (r2 * c1.center.y + r1 * c2.center.y) / s,
    };
  }

  /** Applet's CommonTangent: through that centre, perpendicular to the axis. */
  function commonTangent(c1, c2) {
    const P = commonPoint(c1, c2);
    const v = sub(c2.center, c1.center);
    return { a: P, b: { x: P.x - v.y, y: P.y + v.x } };
  }

  /**
   * Tangents.GetInternalTangents: grow c1 to radius r1+r2, draw the tangents
   * from the centre of c2, then shrink each contact point back onto both
   * circles. Returns null when the circles touch or overlap.
   */
  function internalTangents(c1, c2) {
    const r1 = c1.radius, r2 = c2.radius, R = r1 + r2;
    const v = sub(c2.center, c1.center);
    const L = Math.hypot(v.x, v.y);
    if (R < EPS || L <= R + EPS) return null;
    const base = R * R / (L * L), off = R * Math.sqrt(L * L - R * R) / (L * L);
    const perp = { x: -v.y, y: v.x };
    return [1, -1].map((sign) => {
      const t = {
        x: c1.center.x + base * v.x + sign * off * perp.x,
        y: c1.center.y + base * v.y + sign * off * perp.y,
      };
      const along = sub(t, c1.center);
      return {
        a: add(c1.center, mul(along, r1 / R)),
        b: sub(c2.center, mul(along, r2 / R)),
      };
    });
  }

  /** Applet's GetSecondTangents: discard the bisector tangent near I. */
  function secondTangent(c1, c2, main) {
    let lines;
    try {
      lines = internalTangents(c1, c2);
      if (!lines) return commonTangent(c1, c2);
      if (distance(lines[0].a, lines[0].b) < 2) return commonTangent(c1, c2);
      for (const line of lines) {
        if (distToLine(main.center, line.a, line.b) > 1) return line;
      }
      return commonTangent(c1, c2);
    } catch (e) {
      // The applet's own fallback when the tangent construction throws.
      return Math.abs(distance(c1.center, c2.center) - c1.radius - c2.radius) < 1
        ? commonTangent(c1, c2) : null;
    }
  }

  /** Applet's ComputeIntersection: mean of the pairwise line intersections. */
  function concurrency(lines) {
    let sx = 0, sy = 0, n = 0;
    for (let k = 0; k < lines.length; k++) {
      const p = intersect(lines[k].a, lines[k].b,
        lines[(k + 1) % lines.length].a, lines[(k + 1) % lines.length].b);
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        sx += p.x; sy += p.y; n++;
      }
    }
    return n ? { x: sx / n, y: sy / n } : null;
  }

  /** Applet's BisectorCandidate(p1,p2,p3,p4). */
  function bisectorCandidate(p1, p2, p3, p4) {
    const s5 = angleBisector(p2, p1, p3);
    const s6 = angleBisector(p1, p2, p4);
    return intersect(p2, s5, p1, s6);
  }

  const average = (ps) => ({
    x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
    y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
  });

  /** Applet's MulfattiCircle: four bisector candidates and four distances. */
  function malfattiCircle(p1, p2, p3, p4) {
    const candidates = [
      bisectorCandidate(p1, p2, p3, p4),
      bisectorCandidate(p2, p3, p4, p1),
      bisectorCandidate(p3, p4, p1, p2),
      bisectorCandidate(p4, p1, p2, p3),
    ].filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!candidates.length) return null;
    const center = average(candidates);
    const sides = [[p2, p3], [p3, p4], [p4, p1], [p1, p2]];
    const radius = sides.reduce((s, [a, b]) => s + distToLine(center, a, b), 0) / 4;
    return { center, radius };
  }

  /** Applet's Between(p, q, r): is q between p and r (dot product test)? */
  const between = (p, q, r) =>
    (p.x - q.x) * (r.x - q.x) + (p.y - q.y) * (r.y - q.y) <= 0;

  /**
   * The whole construction for one triangle. The index convention is the
   * applet's: side k joins A[(k+1)%3] and A[(k+2)%3], so c_k touches that side.
   */
  function geometry(state) {
    const A = state.A;
    const I = incenter(A[0], A[1], A[2]);
    const main = incircle(A[0], A[1], A[2]);
    const incircles = [
      incircle(I, A[1], A[2]),
      incircle(I, A[2], A[0]),
      incircle(I, A[0], A[1]),
    ];
    const firstTangents = [
      secondTangent(incircles[1], incircles[2], main),
      secondTangent(incircles[2], incircles[0], main),
      secondTangent(incircles[0], incircles[1], main),
    ];
    const D = [
      nearest(incircles[0].center, A[1], A[2]),
      nearest(incircles[1].center, A[2], A[0]),
      nearest(incircles[2].center, A[0], A[1]),
    ];
    const L = concurrency(firstTangents.filter(Boolean));
    if (!L) return null;
    // The applet replaces DE[k] by the line through L and D[k].
    const DE = D.map((d) => ({ a: L, b: d }));
    const circles = [
      malfattiCircle(L, D[1], A[0], D[2]),
      malfattiCircle(L, D[2], A[1], D[0]),
      malfattiCircle(L, D[0], A[2], D[1]),
    ];
    if (circles.some((c) => !c)) return null;
    const P = [
      commonPoint(circles[1], circles[2]),
      commonPoint(circles[2], circles[0]),
      commonPoint(circles[0], circles[1]),
    ];
    const B = [], C = [], E = [], F = [], G = [];
    for (let k = 0; k < 3; k++) {
      const i = (k + 1) % 3, j = (k + 2) % 3;
      B[k] = nearest(circles[i].center, A[i], A[j]);
      C[k] = nearest(circles[j].center, A[i], A[j]);
      const e1 = intersect(D[k], L, A[k], A[j]);
      const e2 = intersect(D[k], L, A[k], A[i]);
      E[k] = e1 && e2 ? (between(D[k], e1, e2) ? e1 : e2) : (e1 || e2);
      G[i] = nearest(incircles[k].center, D[i], L);
      F[j] = nearest(incircles[k].center, D[j], L);
    }
    return {
      A: A.map((p) => ({ x: p.x, y: p.y })), I, main, incircles,
      firstTangents, D, L, DE, circles, P, B, C, E, F, G,
    };
  }

  /** The applet's initial triangle, in board units, for a w by h canvas. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 360 : o.width;
    const height = o.height === undefined ? 360 : o.height;
    const x = width / 2, y = height / 2, s = width / 3, rise = 120;
    return {
      width, height,
      A: [
        { x: x - s, y: y + rise },
        { x: x + s, y: y + rise },
        { x: x + s * Math.cos(Math.PI / 3), y: y - s * Math.sin(Math.PI / 3) - rise / 2 },
      ],
      showNames: o.showNames === undefined ? true : !!o.showNames,
      showBisectors: !!o.showBisectors,
      showIncircles: !!o.showIncircles,
      showSecondTangents: !!o.showSecondTangents,
      zoom: o.zoom || "1",
    };
  }

  /** Reset: the same option settings, but the applet's triangle again. */
  function reset(state) {
    return start({
      width: state.width, height: state.height, zoom: state.zoom,
      showNames: state.showNames, showBisectors: state.showBisectors,
      showIncircles: state.showIncircles,
      showSecondTangents: state.showSecondTangents,
    });
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Move one vertex, keeping every other part of the position. */
  function moveVertex(state, index, point) {
    const i = ((index % 3) + 3) % 3;
    const A = state.A.map((p, k) => k === i
      ? { x: clamp(point.x, 12, state.width - 12), y: clamp(point.y, 12, state.height - 12) }
      : { x: p.x, y: p.y });
    return { ...state, A };
  }

  /** The zoom similarity T(p) = a*p + (b, c), with the board centre fixed. */
  function zoom(state) {
    const a = (ZOOMS.find((z) => z.key === state.zoom) || ZOOMS[0]).a;
    return { a, b: -(a - 1) * state.width / 2, c: -(a - 1) * state.height / 2 };
  }

  const transformPoint = (p, t) => ({ x: t.a * p.x + t.b, y: t.a * p.y + t.c });
  const untransformPoint = (p, t) => ({ x: (p.x - t.b) / t.a, y: (p.y - t.c) / t.a });
  const transformCircle = (c, t) => ({
    center: transformPoint(c.center, t), radius: c.radius * t.a,
  });

  /** Plain data for the player's record and the tutor. */
  const position = (state) => ({
    A: state.A.map((p) => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2) })),
    view: state.zoom,
    layers: {
      names: state.showNames, bisectors: state.showBisectors,
      incircles: state.showIncircles, tangents: state.showSecondTangents,
    },
  });

  // This is a picture with nothing to win or lose.
  const result = () => null;

  return {
    EPS, ZOOMS, distance, sqDist, nearest, distToLine, intersect,
    incenter, bisectorFoot, angleBisector, incircle, commonPoint, commonTangent,
    internalTangents, secondTangent, concurrency, bisectorCandidate, average,
    malfattiCircle, between, geometry, start, reset, moveVertex, zoom,
    transformPoint, untransformPoint, transformCircle, position, result,
  };
})();
