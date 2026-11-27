"use strict";

/*
 * Dividing Evenly a Quadrilateral II — Alexander Bogomolny's applet
 * HalfAreaOfQuadrilateral2 ("A Mathematical Droodle", McWorter's construction).
 *
 * Unlike HalfAreaOfQuadrilateral (where the median comes from the midpoint K
 * of diagonal BD), here the parallel to AC is drawn through B or through D to
 * meet the opposite side at E.  M is the midpoint of BE (first case) or DE
 * (second case), and CM is the median of triangle CBE or CDE.  The page claims
 * that one of the two cases always puts M on a side of ABCD and that CM then
 * bisects the quadrilateral's area.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, HalfAreaOfQuadrilateral2Core, so the page
 * loads it with a plain <script> and porting/check-half-area-of-quadrilateral-2.mjs
 * loads it in Node.  All points are plain data in the applet's board units.
 */
const HalfAreaOfQuadrilateral2Core = (() => {
  /* The live page embeds the applet at WIDTH=500 HEIGHT=500 twice (once with
   * ShowNames=0, once with ShowNames=1); Compute() uses those dimensions in
   * init().  The second copy's names-on state is our default. */
  const VIEW = { x: 0, y: 0, width: 500, height: 500 };
  const PAD = 14;                 // room for a handle and its label
  const EPS_VEC = 0.005;          // Side/AreParallel tolerance in Compute()
  const MIN_DIST = 1;             // Compute() returns early below this

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** Keep a corner inside the board, with room for its label and handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * init() on a 500x500 canvas, straight from the bytecode.  The integer
   * divisions are Java `idiv` before `i2d`, so the fractional parts are lost:
   *   A = (W/4, H/2)         = (125, 250)
   *   B = (W/2.5, 7H/8)      = (200, 437)
   *   C = (5W/6, 4H/5)       = (416, 400)
   *   D = (W/2, H/8)         = (250, 62)
   * The panel's "names" checkbox follows the ShowNames=1 copy, "hint" starts
   * unchecked in both copies.
   */
  function start(options) {
    const o = options || {};
    const w = VIEW.width, h = VIEW.height;
    return {
      A: point(Math.floor(w / 4), Math.floor(h / 2)),
      B: point(w / 2.5, Math.floor((7 * h) / 8)),
      C: point(Math.floor((5 * w) / 6), Math.floor((4 * h) / 5)),
      D: point(Math.floor(w / 2), Math.floor(h / 8)),
      options: {
        showNames: o.showNames === undefined ? true : !!o.showNames,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* HalfAreaOfQuadrilateral2Canvas$Side.UnitVector(): (m_2 - m_1)/Length. */
  function unitVector(p, q) {
    const len = dist(p, q);
    return point((q.x - p.x) / len, (q.y - p.y) / len);
  }

  /* AreParallel(Side(A,D), Side(B,D)): compare unit vectors, then opposites. */
  function areParallel(a, d, b, dd) {
    const u = unitVector(a, d);
    const v = unitVector(b, dd);
    if (dist(u, v) < EPS_VEC) return true;
    const opposite = point(-v.x, -v.y);
    return dist(u, opposite) < EPS_VEC;
  }

  /* GeoSDoub.GetParallelTo(p, a, c): p + 100*(a - c). */
  function getParallelTo(p, a, c) {
    return point(p.x + 100 * (a.x - c.x), p.y + 100 * (a.y - c.y));
  }

  /* GeoSDoub.Intersect(p1,p2,q1,q2): line-line determinant; |denom| < 1 is NaN. */
  function intersect(p1, p2, q1, q2) {
    const a = p1.y - p2.y;
    const b = p2.x - p1.x;
    const c = p1.x * p2.y - p1.y * p2.x;
    const d = q1.y - q2.y;
    const e = q2.x - q1.x;
    const f = q1.x * q2.y - q1.y * q2.x;
    const den = a * e - d * b;
    if (Math.abs(den) < 1) return point(NaN, NaN);
    return point((b * f - e * c) / den, (c * d - f * a) / den);
  }

  /* InsideTest.IsInside(p,a,b): (p-a)·(p-b) <= 0, i.e. the disk on diameter
   * ab.  For a point already on line ab this is exactly "between a and b". */
  function inside(p, a, b) {
    return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
  }

  /* The shoelace area, used only to check the page's area claims. */
  function area(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - p.y * q.x;
    }
    return Math.abs(s) / 2;
  }

  /* One of Compute()'s two constructions: from D (parallel to AC meeting AB)
   * or from B (parallel to AC meeting AD).  `vertex` is the side endpoint used
   * with E to form M; `corner` is the other end of that parallel line. */
  function construct(a, b, c, d, from) {
    const parallel = areParallel(a, d, b, d);
    let E, M, vertex, corner, side;
    if (from === "D") {
      E = parallel ? d : intersect(d, getParallelTo(d, a, c), a, b);
      M = midpoint(b, E);
      vertex = b; corner = d; side = "AB";
    } else {
      E = parallel ? b : intersect(b, getParallelTo(b, a, c), a, d);
      M = midpoint(d, E);
      vertex = d; corner = b; side = "AD";
    }
    return { E, M, vertex, corner, side, parallel, onSide: inside(M, a, from === "D" ? b : d) };
  }

  /**
   * Compute() from the applet's bytecode.  All six pair distances must be at
   * least 1.  The first case is chosen when M from D lies on AB; otherwise the
   * applet falls through to the B/AD construction.  Quadri is [A, corner, C, M]
   * and Tri is [vertex, C, M], exactly the arrays the applet fills.
   */
  function compute(a, b, c, d) {
    const cs = [a, b, c, d];
    if (!cs.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const pairs = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]];
    if (pairs.some(([p, q]) => dist(p, q) < MIN_DIST)) return null;

    const fromD = construct(a, b, c, d, "D");
    const fromB = construct(a, b, c, d, "B");
    const chosen = fromD.onSide ? fromD : fromB;
    const quad = [a, chosen.corner, c, chosen.M];
    const tri = [chosen.vertex, c, chosen.M];

    const areaQuad = area([a, b, c, d]);
    const areaTri = area(tri);
    const areaRelevant = area([chosen.vertex, c, chosen.E]);
    const scale = Math.max(1, ...cs.flatMap((p, i) => cs.slice(i + 1).map((q) => dist(p, q))));
    const tol = 1e-9 * scale;
    const quadBisectError = Math.abs(areaQuad - 2 * areaTri);
    const triangleBisectError = Math.abs(areaRelevant - 2 * areaTri);

    /* K is the midpoint of BD; the parallel to AC through K passes through
     * both candidate M's (midline in the triangles BDE and DBE). */
    const K = midpoint(b, d);
    const kLineCrossesSide = fromD.onSide || fromB.onSide;

    return {
      A: a, B: b, C: c, D: d,
      E: chosen.E, M: chosen.M, BorD: chosen.corner, vertex: chosen.vertex,
      side: chosen.side, parallel: chosen.parallel, shortcut: chosen.parallel,
      Quadri: quad, Tri: tri,
      fromD, fromB, K,
      measures: {
        areaQuad, areaTri, areaRelevant, quadBisectError, triangleBisectError,
      },
      claims: {
        triangleBisected: triangleBisectError <= tol,
        quadrilateralBisected: quadBisectError <= tol,
        oneCase: kLineCrossesSide,
        kLineCrossesSide,
        triangleIsQuadrilateral: Math.abs(areaRelevant - areaQuad) <= tol,
      },
      tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a quadrilateral.";
    let text = g.side === "AB"
      ? "The line through D parallel to AC meets AB at E. M is halfway from B to E."
      : "The line through B parallel to AC meets AD at E. M is halfway from D to E.";
    if (g.measures.quadBisectError > g.tol) {
      text += " With these corners almost on one line, the two parts are a little uneven.";
    } else {
      text += " CM cuts off half the shape.";
    }
    if (state.options.hint) {
      text += " The hint shows the parallel through the middle of BD that picks the side.";
    }
    return text;
  }

  return {
    VIEW, PAD, EPS_VEC, MIN_DIST,
    point, add, sub, mul, dot, cross, dist, midpoint, clamp,
    start, reset, move, setOption,
    unitVector, areParallel, getParallelTo, intersect, inside, area, construct,
    compute, geometry, result, describe,
  };
})();
