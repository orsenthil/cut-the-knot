"use strict";

/*
 * Dijkstra's proof of the Pythagorean theorem, as in Alexander Bogomolny's
 * applet Dijkstra. A, B and C can be dragged. From them the applet draws the
 * stripe through C parallel to AB and two lines from C: CL makes the angle at
 * B with CA, and CN makes the angle at A with CB. That makes ACL and BCN
 * similar to ABC, so their areas are b²/c² and a²/c² times the area of ABC.
 * Comparing the three areas compares the three angles, giving
 *
 *     sign(alpha + beta - gamma) = sign(a² + b² - c²).
 *
 * Every point below follows the applet's own Compute() bytecode, using its
 * GeoSDoub helpers (GetParallelTo, NearestPoint, Intersect, Rotate,
 * ComputeAngle, FindOrientation) and InsideTest. Screen y grows downwards,
 * as in the Java canvas. This file is pure data and geometry: no document,
 * no window, no storage, and exactly one global.
 */
const DijkstraCore = (() => {
  const APPLET = { width: 500, height: 450 };
  const BOARD = { width: 500, height: 450, margin: 16 };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const sign = (t) => (t > 0 ? 1 : t < 0 ? -1 : 0);

  /** GeoSDoub.FindOrientation: d > 0 gives 1, everything else gives -1. */
  function findOrientation(p, q, r) {
    const d = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return d > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeAngle: the angle at the FIRST argument. */
  function computeAngle(p, q, r) {
    return Math.acos(
      (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / 2 / dist(p, q) / dist(p, r),
    );
  }

  /** GeoSDoub.Rotate(base, tip, angle, dir); dir +/-1 chooses the turn. */
  function rotate(base, tip, angle, dir) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return pt(
      base.x + c * (tip.x - base.x) - dir * s * (tip.y - base.y),
      base.y + dir * s * (tip.x - base.x) + c * (tip.y - base.y),
    );
  }

  /** GeoSDoub.GetParallelTo(a, b, c) = a + 100·(b - c). */
  const parallel = (a, b, c) => pt(a.x + 100 * (b.x - c.x), a.y + 100 * (b.y - c.y));

  /** GeoSDoub.NearestPoint(p, a, b): the foot of p on line ab. */
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return p; // the applet's own short-circuit
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return pt(a.x + t * dx, a.y + t * dy);
  }

  /** GeoSDoub.Intersect of two infinite lines; NaN when det is below 1. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** InsideTest.IsInside: the angle qpr is at least a right angle. */
  const inside = (p, q, r) => dot(sub(p, q), sub(p, r)) <= 0;

  /** DijkstraCanvas.GetExtremes: keep the two extreme points of three. */
  function extremes(p, q, r) {
    if (inside(q, p, r)) return [p, r];
    if (inside(r, p, q)) return [p, q];
    return [q, r];
  }

  /** Unsigned area of a polygon, by the shoelace formula. */
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  }

  /** The triangle the applet's init() lays out on its 500×450 canvas. */
  function start() {
    const cx = APPLET.width / 2 + APPLET.width / 4;
    const cy = APPLET.height / 2;
    const u = APPLET.width / 8;
    const rise = 30;
    return {
      A: pt(cx - 5 * u, cy + 2 * rise),
      B: pt(cx + u, cy + 2 * rise),
      C: pt(
        cx - u - u * Math.cos(Math.PI / 3),
        cy - u * Math.sin(Math.PI / 3) - rise,
      ),
      show: { areas: false, color: false, hint: false, names: false },
    };
  }

  /** Move one corner, keeping it inside the board. Never changes the input. */
  function withPoint(state, name, p) {
    const q = pt(
      clamp(p.x, BOARD.margin, BOARD.width - BOARD.margin),
      clamp(p.y, BOARD.margin, BOARD.height - BOARD.margin),
    );
    return { ...state, [name]: q };
  }

  /** Preset corners, reached by dragging in the original applet. */
  function preset(name) {
    const base = start();
    if (name === "right") {
      return { ...base, C: pt(100, 172.5) };
    }
    if (name === "acute") {
      return {
        ...base,
        A: pt(120, 320),
        B: pt(380, 320),
        C: pt(250, 320 - 130 * Math.sqrt(3)),
      };
    }
    return base; // "obtuse": the starting triangle
  }

  /** DijkstraPanel.itemStateChanged: color only lives while areas is on. */
  function toggle(state, key) {
    if (!Object.prototype.hasOwnProperty.call(state.show, key)) return state;
    const show = { ...state.show, [key]: !state.show[key] };
    if (key === "areas" && !show.areas) show.color = false;
    if (key === "color" && !show.areas) show.color = false;
    return { ...state, show };
  }

  /** The whole construction, local by local, from DijkstraCanvas.Compute(). */
  function compute(state) {
    const { A, B, C } = state;
    const S1 = parallel(C, A, B);
    const H = nearest(C, A, B);
    const S2 = parallel(B, C, H);
    const S3 = parallel(A, C, H);
    const D = intersect(C, S1, B, S2);
    const E = intersect(C, S1, A, S3);
    const orient = findOrientation(A, B, C);
    const beta = computeAngle(B, C, A);
    const S7 = rotate(C, A, beta, orient);
    const L = intersect(C, S7, A, B);
    const alpha = computeAngle(A, B, C);
    const S10 = rotate(C, B, alpha, -orient);
    const N = intersect(C, S10, A, B);
    const S11 = parallel(L, C, H);
    const K = intersect(E, D, L, S11);
    const S12 = parallel(N, C, H);
    const M = intersect(E, D, N, S12);
    const gamma = computeAngle(C, A, B);
    return {
      A, B, C, H, D, E, L, N, K, M,
      S1, S2, S3, S7, S10, S11, S12,
      orient, alpha, beta, gamma,
    };
  }

  /** Numbers and signs behind the picture, all from one configuration. */
  function measure(state) {
    const q = compute(state);
    const a = dist(q.B, q.C), b = dist(q.A, q.C), c = dist(q.A, q.B);
    const areaABC = polygonArea([q.A, q.B, q.C]);
    const areaACL = finite(q.L) ? polygonArea([q.A, q.C, q.L]) : NaN;
    const areaBCN = finite(q.N) ? polygonArea([q.B, q.C, q.N]) : NaN;
    const angleSum = q.alpha + q.beta - q.gamma;
    const squares = a * a + b * b - c * c;
    const areas = areaACL + areaBCN - areaABC;
    const valid = Number.isFinite(angleSum) && Number.isFinite(squares) &&
      Number.isFinite(areas) && areaABC > 1e-9 &&
      [q.H, q.D, q.E, q.L, q.N, q.K, q.M].every(finite);
    // At gamma = 90° the three differences are exact zero mathematically,
    // but acos and the shoelace sum leave rounding noise of order 1e-16.
    const signEps = (t, eps) => (t > eps ? 1 : t < -eps ? -1 : 0);
    return {
      points: q, a, b, c, areaABC, areaACL, areaBCN,
      angleSum, squares, areas,
      signAngles: signEps(angleSum, 1e-12),
      signSquares: signEps(squares, 1e-12 * c * c),
      signAreas: signEps(areas, 1e-12 * areaABC),
      valid,
    };
  }

  /** The plain line under the board; an illustration has no win or loss. */
  function status(state) {
    const m = measure(state);
    if (!m.valid) return "Move C off the line AB to see the construction.";
    const deg = (m.points.gamma * 180) / Math.PI;
    const where = `gamma is about ${deg.toFixed(1)} degrees`;
    if (m.signAngles < 0) {
      return `${where}: alpha + beta is less than gamma, so a² + b² < c². The two small pieces leave a gap.`;
    }
    if (m.signAngles > 0) {
      return `${where}: alpha + beta is greater than gamma, so a² + b² > c². The two small pieces overlap.`;
    }
    return `${where}: alpha + beta equals gamma, CL and CN coincide, and the two pieces fill the big rectangle exactly.`;
  }

  return {
    APPLET, BOARD, pt, add, sub, dot, dist, sqDist, clamp, finite, sign,
    findOrientation, computeAngle, rotate, parallel, nearest, intersect,
    inside, extremes, polygonArea,
    start, withPoint, preset, toggle, compute, measure, status,
  };
})();
