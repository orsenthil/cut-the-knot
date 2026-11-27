"use strict";

/*
 * CircleOnCevian — the illustration behind Bogomolny's "Circles On Cevians".
 *
 * Put a circle on each cevian of a triangle as its diameter. The second point
 * where such a circle meets the opposite side line is the foot of the altitude
 * from that vertex (the angle in a semicircle is right). The applet's remarkable
 * claim, which this page illustrates, is that the radical axis of the circles on
 * two cevians from different vertices passes through the triangle's orthocenter
 * H; with three circles their radical axes meet at H, the radical center.
 *
 * The one idea the code relies on: the power of H in a circle on diameter AP is
 * the signed product HA * HH_a along the altitude. The applet's own proof shows
 * those products are equal for two different vertices, so H has equal power in
 * both circles and lies on their radical axis. Numerically we test that by
 * comparing |H-O|²-r² for each circle, and by intersecting the circles directly
 * (GeoSDoub.IntersectCirclesX/Y) and checking their two common points lie on the
 * same line as H.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircleOnCevianCore, so the page loads it with a plain
 * <script> and porting/check-circle-on-cevian.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const CircleOnCevianCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (p) => ({ x: p.x, y: p.y });
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** The two vertices other than i, in the applet's cyclic order. */
  const other = (i) => [(i + 1) % 3, (i + 2) % 3];

  /* -------------------------------------------------------------- position */

  /**
   * The position a new drawing starts from. The applet's init() places
   * A[0]=(W/6, 6H/7), A[1]=(4W/5, 7H/10), A[2]=(W/2-10, H/10) for its optimal
   * 400x250 canvas, and each P[i] at a random t in [0.4, 0.6] along the side
   * opposite A[i]. A random start cannot be checked or described, so we take
   * the middle t = 0.5 of that same range; everything else is as in init().
   */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: o.points.A.map(copy), P: o.points.P.map(copy),
        N: clamp(o.N === undefined ? 1 : Math.round(o.N), 1, 3),
        showNames: o.showNames === undefined ? true : Boolean(o.showNames),
        showHint: o.showHint === undefined ? true : Boolean(o.showHint),
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const A = [
      { x: width / 6, y: (height * 6) / 7 },
      { x: (width * 4) / 5, y: (height * 7) / 10 },
      { x: width / 2 - 10, y: height / 10 },
    ];
    const P = A.map((_, i) => {
      const [j, k] = other(i);
      return lerp(A[j], A[k], 0.5);
    });
    return {
      A, P,
      N: clamp(o.N === undefined ? 1 : Math.round(o.N), 1, 3),
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
      showHint: o.showHint === undefined ? true : Boolean(o.showHint),
    };
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  /* ------------------------------------------------------- the construction */

  /** GeoSDoub.Dist / SqDist. */
  function sqDist(p, q) {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  }

  /**
   * GeoSDoub.NearestPoint(p, a, b), transcribed from the bytecode: if a is
   * within 0.1 of p return p, otherwise project p onto the infinite line ab.
   * No clamping to the segment: an obtuse triangle's altitude foot lies outside
   * the opposite side, as in the applet.
   */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return copy(p);
    const dx = b.x - a.x, dy = b.y - a.y;
    const dot = dx * (p.x - a.x) + dy * (p.y - a.y);
    const t = dot / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** CircleOnCevianCanvas.GetCircle: the circle with AP as diameter. */
  function circle(s, i) {
    const c = { x: (s.P[i].x + s.A[i].x) / 2, y: (s.P[i].y + s.A[i].y) / 2 };
    return { c, r: distance(s.P[i], s.A[i]) / 2 };
  }

  /** CircleOnCevianCanvas.Draw: H[i] = NearestPoint(A[i], A[j], A[k]). */
  function altitudeFoot(s, i) {
    const [j, k] = other(i);
    return nearestPoint(s.A[i], s.A[j], s.A[k]);
  }

  /**
   * GeoSDoub.Intersect(p1,p2,p3,p4) in ax+by+c=0 form. The applet refuses a
   * determinant below 1; we use the same test, returning null instead of its
   * NaN point so callers can hide the orthocenter of a near-degenerate triangle.
   */
  function lineIntersection(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** CircleOnCevianCanvas.Draw: HH = Intersect(H[0],A[0], H[2],A[2]). */
  function orthocenter(s) {
    const feet = [0, 1, 2].map((i) => altitudeFoot(s, i));
    return lineIntersection(feet[0], s.A[0], feet[2], s.A[2]);
  }

  /** Shortest distance from p to the infinite line through x and y. */
  function distToLine(p, x, y) {
    const len = distance(x, y);
    if (len < EPS) return Infinity;
    return Math.abs(cross(x, y, p)) / len;
  }

  function doubleArea(s) {
    return Math.abs(cross(s.A[0], s.A[1], s.A[2]));
  }

  function isDegenerate(s) {
    if (doubleArea(s) < 1e-7) return true;
    return [0, 1, 2].some((i) => {
      const [j, k] = other(i);
      return distance(s.A[i], s.A[j]) < EPS || distance(s.P[i], s.A[i]) < EPS;
    });
  }

  /** signed power of a point in the circle on cevian i. */
  function power(s, i, p) {
    const z = circle(s, i);
    return sqDist(p, z.c) - z.r * z.r;
  }

  /**
   * The radical axis of circles i and j as { point, dir }, with dir a unit
   * vector along the axis. It is the line GeoSDoub.Intersect(C[i],C[j]) draws
   * through their common points, written in the general form so it exists even
   * when the two circles do not meet: power_i = power_j gives
   * 2(O_j-O_i)·p = |O_j|²-r_j² - |O_i|² + r_i².
   */
  function radicalAxis(s, i, j) {
    const a = circle(s, i), b = circle(s, j);
    const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS) return null;
    const rhs = (b.c.x ** 2 + b.c.y ** 2 - b.r ** 2) - (a.c.x ** 2 + a.c.y ** 2 - a.r ** 2);
    const along = rhs / (2 * d);
    return {
      point: { x: (dx / d) * along, y: (dy / d) * along },
      dir: { x: -dy / d, y: dx / d },
    };
  }

  /** Signed distance of p from the radical axis (positive on one side). */
  function axisDistance(p, axis) {
    if (!axis) return Infinity;
    return axis.dir.x * (p.y - axis.point.y) - axis.dir.y * (p.x - axis.point.x);
  }

  /**
   * Common points of circles i and j, 0, 1 or 2, from the standard intersection
   * formula. The test checks these against a literal second transcription of
   * the applet's IntersectCirclesX/Y.
   */
  function circleIntersections(s, i, j) {
    const a = circle(s, i), b = circle(s, j);
    const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || d > a.r + b.r + EPS || d < Math.abs(a.r - b.r) - EPS) return [];
    const t = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
    const h2 = a.r * a.r - t * t;
    if (h2 < -EPS) return [];
    const base = { x: a.c.x + (dx * t) / d, y: a.c.y + (dy * t) / d };
    const h = Math.sqrt(Math.max(0, h2));
    if (h < 1e-8) return [base];
    return [
      { x: base.x - (dy * h) / d, y: base.y + (dx * h) / d },
      { x: base.x + (dy * h) / d, y: base.y - (dx * h) / d },
    ];
  }

  /* ------------------------------------------------------ moving the points */

  /** The parameter of P[i] along the side opposite A[i]. */
  function footParam(s, i) {
    const [j, k] = other(i);
    const dx = s.A[k].x - s.A[j].x, dy = s.A[k].y - s.A[j].y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return 0.5;
    return clamp(((s.P[i].x - s.A[j].x) * dx + (s.P[i].y - s.A[j].y) * dy) / len2, 0, 1);
  }

  /**
   * Move a corner. The applet's mouseDragged calls L.UpdateMidPoint() on the
   * sides containing that corner, so each opposite-side point keeps its own
   * fraction of the way along its side. We do the same for all three feet.
   */
  function withVertex(s, i, p) {
    if (i < 0 || i > 2) return s;
    const ts = [0, 1, 2].map((k) => footParam(s, k));
    const A = s.A.map(copy);
    A[i] = copy(p);
    const P = A.map((_, k) => {
      const [j, h] = other(k);
      return lerp(A[j], A[h], ts[k]);
    });
    return { ...s, A, P };
  }

  /** Move a cevian foot, clamped to the segment opposite its vertex. */
  function withFoot(s, i, p) {
    if (i < 0 || i > 2) return s;
    const [j, k] = other(i);
    const dx = s.A[k].x - s.A[j].x, dy = s.A[k].y - s.A[j].y;
    const len2 = dx * dx + dy * dy;
    const t = len2 < EPS ? 0.5 : clamp(((p.x - s.A[j].x) * dx + (p.y - s.A[j].y) * dy) / len2, 0, 1);
    const P = s.P.map(copy);
    P[i] = lerp(s.A[j], s.A[k], t);
    return { ...s, P };
  }

  /** Change one of the applet's switches: N in 1..3, or a boolean. */
  function withOption(s, key, value) {
    const next = { ...s };
    if (key === "N") next.N = clamp(Math.round(value), 1, 3);
    else if (key === "showNames" || key === "showHint") next[key] = Boolean(value);
    return next;
  }

  /* --------------------------------------------------- what the page draws */

  /** The pairs whose radical axes the applet draws, for the current N. */
  function shownPairs(s) {
    const all = [[2, 0], [0, 1], [1, 2]];
    if (s.N === 3) return all;
    if (s.N === 2) return [all[0]];
    return [];
  }

  function measurements(s) {
    const circles = [0, 1, 2].map((i) => circle(s, i));
    const feet = [0, 1, 2].map((i) => altitudeFoot(s, i));
    const H = orthocenter(s);
    const pairs = shownPairs(s).map(([i, j]) => ({
      i, j,
      axis: radicalAxis(s, i, j),
      hits: circleIntersections(s, i, j),
    }));
    return {
      A: s.A, P: s.P, N: s.N,
      degenerate: isDegenerate(s), doubleArea: doubleArea(s),
      circles, feet, orthocenter: H, pairs,
      powers: circles.map((z) => (H ? sqDist(H, z.c) - z.r * z.r : NaN)),
    };
  }

  /** Each claim on the applet's page, checked numerically at this diagram. */
  function claims(s) {
    const m = measurements(s);
    const bad = {
      feetOnCircles: false, altitudesConcurrent: false,
      radicalThroughOrthocenter: false, intersectionsOnAxis: false,
      radicalCenter: false,
    };
    if (m.degenerate || !m.orthocenter) return bad;
    const scale = Math.max(
      distance(m.A[0], m.A[1]), distance(m.A[1], m.A[2]), distance(m.A[2], m.A[0]),
    );
    const tol = 1e-6 * scale;
    const H = m.orthocenter;

    // The apex angle in a semicircle is right: each altitude foot lies on its
    // circle and on the opposite side line.
    const feetOnCircles = m.feet.every((f, i) =>
      Math.abs(distance(f, m.circles[i].c) - m.circles[i].r) <= tol &&
      distToLine(f, m.A[other(i)[0]], m.A[other(i)[1]]) <= tol);

    const altitudesConcurrent = m.feet.every((f, i) =>
      distToLine(H, m.A[i], f) <= tol);

    // The page's two cevian theorem, for every pair the applet draws.
    const radicalThroughOrthocenter = m.pairs.every(({ i, j, axis }) =>
      Math.abs(m.powers[i] - m.powers[j]) <= 1e-7 * scale * scale &&
      axis !== null && Math.abs(axisDistance(H, axis)) <= tol);

    // When two circles do meet, their two common points lie on that same axis.
    // The applet only draws the axis in that case; the axis itself exists (and
    // still passes through H) even when the circles are disjoint.
    const intersectionsOnAxis = m.pairs.every(({ axis, hits }) =>
      hits.length !== 2 || hits.every((p) => Math.abs(axisDistance(p, axis)) <= tol));

    // With three cevians the common point is the radical center.
    const radicalCenter = s.N === 3 &&
      Math.max(...m.powers) - Math.min(...m.powers) <= 1e-7 * scale * scale;

    return {
      feetOnCircles, altitudesConcurrent, radicalThroughOrthocenter,
      intersectionsOnAxis, radicalCenter,
    };
  }

  return {
    EPS, start, result, distance, sqDist, lerp, clamp, other, cross,
    nearestPoint, circle, altitudeFoot, lineIntersection, orthocenter,
    distToLine, doubleArea, isDegenerate, power, radicalAxis, axisDistance,
    circleIntersections, footParam, withVertex, withFoot, withOption,
    shownPairs, measurements, claims,
  };
})();
