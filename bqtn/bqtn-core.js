"use strict";

/*
 * BQTN — "A Chain of Touching Circles in a Polygon", a theorem of Bui Quang
 * Tuan that Alexander Bogomolny published as a Java illustration.
 *
 * Put N draggable corners on a circle and pick a point P on the internal
 * angle bisector at the first corner. The first circle is centred at P and
 * touches the first side; each next circle touches the previous one at the
 * same point on a side and has its centre on the next corner's angle
 * bisector. For an odd-sided convex polygon the chain closes: after 2N steps
 * the last circle lands back on the first (the page writes C_2n = C_1). For
 * a regular polygon the whole chain can repeat after a single step.
 *
 * The one idea the code relies on: a circle tangent to a line at T has its
 * centre on the perpendicular at T, and a circle inscribed in an angle has
 * its centre on the angle bisector. The next centre is where those two lines
 * meet. Every step is a straightedge construction, transcribed here from
 * BQTNCanvas.GetNextFirstCircle and GeoSDoub's helpers, so the same rule
 * works however the player drags the corners.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, BqtnCore, so the page loads it with a plain
 * <script> and porting/check-bqtn.mjs loads it in Node. All functions take
 * plain data and return new objects; nothing passed in is changed.
 */
const BqtnCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const N_MIN = 3;
  const N_MAX = 21;
  const MAX_CIRCLES = 2 * N_MAX; // 0..2N circles are drawn in the applet
  const DEFAULT_T = 0.7; // BQTNCanvas.m_Ta
  const EPS = 1e-9;

  /* ------------------------------------------------ the applet's geometry */

  /* GeoSDoub.SqDist / Dist. */
  const sqDist = (p, q) => {
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy;
  };
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /* GeoSDoub.ComputeAngle: unsigned law of cosines at the first point. */
  function computeAngle(A, B, C) {
    const num = sqDist(A, B) + sqDist(A, C) - sqDist(B, C);
    return Math.acos(num / (2 * dist(A, B) * dist(A, C)));
  }

  /* GeoSDoub.FindOrientation: +1 when the signed area is positive, else -1. */
  function orientation(A, B, C) {
    const s = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
    return s > 0 ? 1 : -1;
  }

  /* GeoSDoub.Rotate: turn Q about P by angle, using the orientation as sign. */
  function rotate(P, Q, angle, sense) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: P.x + cs * (Q.x - P.x) - sense * sn * (Q.y - P.y),
      y: P.y + sense * sn * (Q.x - P.x) + cs * (Q.y - P.y),
    };
  }

  /* GeoSDoub.Intersect: ax+by+c=0 lines; |det| < 1 becomes NaN in the applet. */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /* GeoSDoub.FindAngleBisector: rotate one ray by half the angle and cut the far side. */
  function angleBisector(A, B, C) {
    const ray = rotate(A, B, computeAngle(A, B, C) / 2, orientation(A, B, C));
    return intersect(A, ray, B, C);
  }

  /* GeoSDoub.NearestPoint(P, A, B): the foot on the infinite line A->B. */
  function nearestPoint(p, a, b) {
    if (sqDist(a, p) < 0.1) return { x: p.x, y: p.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /* GeoSDoub.Dist(P, DoubLine): distance to the infinite line through A,B. */
  function distToLine(p, a, b) {
    if (sqDist(a, p) < 0.1) return 0;
    return dist(p, nearestPoint(p, a, b));
  }

  /* ------------------------------------------------------------- the state */

  const clampN = (n) => Math.round(Number.isFinite(n) ? Math.max(N_MIN, Math.min(N_MAX, n)) : N_MIN);
  const clampT = (t) => (Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : DEFAULT_T);

  /** BQTNCanvas.Reset: N corners equally spaced on a circle of radius min(W,H)/3. */
  function regularPolygon(n, width, height) {
    const w = Number.isFinite(width) ? width : WIDTH;
    const h = Number.isFinite(height) ? height : HEIGHT;
    const r = Math.min(w, h) / 3;
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const points = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return points;
  }

  /** The position is plain data: the corners, P's parameter and the pair to mark. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? N_MIN : o.n);
    const points = Array.isArray(o.points) && o.points.length === n
      ? o.points.map((p) => ({ x: p.x, y: p.y }))
      : regularPolygon(n, o.width, o.height);
    return {
      n,
      points,
      t: o.t === undefined ? DEFAULT_T : clampT(o.t),
      which: o.which === undefined ? 2 * n : Math.max(0, Math.min(2 * n, Math.round(o.which))),
    };
  }

  /** Reset with a new N: a fresh regular polygon, pair back to "all marked". */
  function withN(s, n) {
    const next = clampN(n);
    return { n: next, points: regularPolygon(next), t: s.t, which: 2 * next };
  }

  function withWhich(s, w) {
    return { n: s.n, points: s.points.map((p) => ({ ...p })), t: s.t,
      which: Math.max(0, Math.min(2 * s.n, Math.round(w))) };
  }

  function withT(s, t) {
    return { n: s.n, points: s.points.map((p) => ({ ...p })), t: clampT(t), which: s.which };
  }

  /** Move one named corner; other fields stay as they were. */
  function withPoint(s, index, p) {
    const points = s.points.map((q) => ({ ...q }));
    if (Number.isInteger(index) && index >= 0 && index < points.length) {
      points[index] = { x: p.x, y: p.y };
    }
    return { n: s.n, points, t: s.t, which: s.which };
  }

  const sides = (s) => s.points.map((p, i) => dist(p, s.points[(i + 1) % s.n]));

  /** True when every side has the same length (the regular case on the page). */
  function isRegular(s) {
    const lens = sides(s);
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    return Number.isFinite(avg) && lens.every((l) => Math.abs(l - avg) <= 1e-9 * avg);
  }

  /**
   * DoubLine.UpdateMidPoint: where a dragged point falls on the V0-L0 line,
   * as the parameter t of P = L0 + t*(V0-L0). The applet clamps t to [0,1]
   * because the bisector is restricted to the segment.
   */
  function parameterAt(s, p) {
    const L = feet(s)[0];
    if (!L || !Number.isFinite(L.x)) return s.t;
    const dx = s.points[0].x - L.x, dy = s.points[0].y - L.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return s.t;
    return clampT(((p.x - L.x) * dx + (p.y - L.y) * dy) / len2);
  }

  /** All feet of the internal angle bisectors, as in BQTNCanvas.CreateBisector. */
  function feet(s) {
    const V = s.points, n = s.n;
    return V.map((p, i) => angleBisector(p, V[(i + n - 1) % n], V[(i + 1) % n]));
  }

  /** DoubLine.CreateMidPoint(t): V0*t + L0*(1-t), with t = m_Ta. */
  function startPoint(s) {
    const f = feet(s)[0];
    return f && Number.isFinite(f.x) ? lerp(f, s.points[0], s.t) : { ...s.points[0] };
  }

  /**
   * The whole chain. circles[k] is the k-th circle drawn (the first is k=0),
   * tangencies[k] is its touch point on side k%n. The last circle is k=2n.
   */
  function chain(s) {
    const V = s.points, n = s.n;
    const L = feet(s);
    const P = startPoint(s);
    let c = { center: { x: P.x, y: P.y }, r: distToLine(P, V[0], V[1]) };
    const circles = [{ center: { ...c.center }, r: c.r, index: 0,
      tangent: nearestPoint(P, V[0], V[1]) }];
    const tangencies = [circles[0].tangent];
    for (let step = 0; step < 2 * n; step++) {
      const side = step % n;
      const T = nearestPoint(c.center, V[side], V[(side + 1) % n]);
      tangencies.push(T);
      const next = (side + 1) % n, next2 = (side + 2) % n;
      const foot = angleBisector(V[next], V[side], V[next2]);
      const center = intersect(T, c.center, V[next], foot);
      c = { center, r: dist(center, T) };
      circles.push({ center, r: c.r, index: step + 1, tangent: T });
    }
    const lens = sides(s);
    const scale = Math.max(...lens, EPS);
    const tol = 1e-6 * scale;
    const finite = circles.every((q) => Number.isFinite(q.center.x) && Number.isFinite(q.center.y)
      && Number.isFinite(q.r) && q.r >= 0);
    const deviation = (a, b) => dist(a.center, b.center) + Math.abs(a.r - b.r);
    let period = null;
    if (finite) {
      for (let k = 1; k < circles.length; k++) {
        if (deviation(circles[0], circles[k]) <= tol) { period = k; break; }
      }
    }
    return {
      vertices: V, feet: L, P, circles, tangencies, scale, tol, finite, period,
      returns: finite && deviation(circles[0], circles[2 * n]) <= tol,
      deviation: finite ? deviation(circles[0], circles[2 * n]) : NaN,
    };
  }

  const measurements = chain;

  /**
   * ShowCircles' colour rule: mark the pair of circles that touch at the
   * step named by Which, or all of them when Which equals 2n. The first
   * circle is handled apart from the loop in the applet, hence index 0.
   */
  function emphasis(s, index) {
    const total = 2 * s.n;
    if (s.which === total) return true;
    if (index === 0) return s.which === 0 || s.which === total - 1;
    return index === s.which || index - 1 === s.which;
  }

  /** The page's claims, each checked at this configuration. */
  function claims(s) {
    const m = chain(s);
    const V = s.points, n = s.n, tol = m.tol;
    const onLine = (p, a, b) => distToLine(p, a, b) <= tol;
    /* tangencies[0] is on side 0; tangencies[k>0] came from step k-1. */
    const tangenciesOnSides = m.finite && m.tangencies.every((T, i) => {
      const side = i === 0 ? 0 : (i - 1) % n;
      return Number.isFinite(T.x) && onLine(T, V[side], V[(side + 1) % n]);
    });
    const centersOnBisectors = m.finite && m.circles.slice(1).every((q, i) => {
      const side = i % n, next = (side + 1) % n;
      const foot = angleBisector(V[next], V[side], V[(side + 2) % n]);
      return Number.isFinite(foot.x) && onLine(q.center, V[next], foot);
    });
    /* Consecutive circles touch at their shared T: each centre is exactly
       one radius away from it (inside or outside the polygon, either way). */
    const consecutiveTouch = m.finite && m.circles.slice(1).every((q, i) => {
      const prev = m.circles[i];
      return Math.abs(dist(prev.center, q.tangent) - prev.r) <= tol
        && Math.abs(dist(q.center, q.tangent) - q.r) <= tol;
    });
    const centralCircle = m.finite && m.circles.every((q) =>
      Math.abs(q.r - m.circles[0].r) <= tol && dist(q.center, m.circles[0].center) <= tol);
    return {
      tangenciesOnSides,
      centersOnBisectors,
      consecutiveTouch,
      returnsAt2N: m.returns,
      chainLength: m.period !== null && m.period >= 1 && m.period <= 2 * n,
      regularLengthOneOrTwoN: !isRegular(s) || m.period === 1 || m.period === 2 * n
        || (n % 2 === 0 && m.period === n),
      all: tangenciesOnSides && centersOnBisectors && consecutiveTouch && m.returns,
      centralChain: centralCircle,
    };
  }

  /** Nothing can be won or lost: this is an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, HEIGHT, N_MIN, N_MAX, MAX_CIRCLES, DEFAULT_T,
    sqDist, dist, computeAngle, orientation, rotate, intersect, angleBisector,
    nearestPoint, distToLine, lerp, clampN, clampT, regularPolygon,
    start, withN, withWhich, withT, withPoint, sides, isRegular, parameterAt,
    feet, startPoint, chain, measurements, emphasis, claims, result,
  };
})();
