"use strict";

/*
 * Gergonne and medial triangles are orthologic — pure geometry, no DOM.
 * Ported from Alexander Bogomolny's applet GergonneMedial, whose page is
 * cut-the-knot.org/Curriculum/Geometry/GergonneMedial.shtml.
 *
 * In triangle ABC, Ma, Mb, Mc are the midpoints of BC, CA, AB. The incircle
 * touches BC, CA, AB at Ga, Gb, Gc (the Gergonne or contact triangle). The
 * applet drops perpendiculars from the midpoints onto the *opposite* sides of
 * that contact triangle — Ma onto GbGc, Mb onto GaGc, Mc onto GaGb — calls
 * their feet D, E, F, and intersects the first two at T. The page claims that
 * the third also passes through T. That is true: the perpendicular from each
 * midpoint is an angle bisector of the medial triangle MaMbMc, and the three
 * bisectors meet at that triangle's incenter, which is (A+B+C-I)/2.
 *
 * The `compute()` function below follows GergonneMedialCanvas.Compute() from
 * the bytecode literally: midpoint, GeoSDoub.FindIncenter (two rotated angle
 * bisectors, intersected), GeoSDoub.NearestPoint (foot on an infinite line),
 * GeoSDoub.Intersect (line intersection with Java's |det| < 1 guard), and the
 * averaged incircle radius. porting/check-gergonne-medial.mjs transcribes the
 * same geometry a second way (side-length tangency points and barycentric
 * incenter) and checks every claim over thousands of triangles.
 *
 * This file defines one global, GergonneMedialCore, and keeps the position as
 * plain data. No document, no window, no storage.
 */
const GergonneMedialCore = (() => {
  /** The applet's canvas is 560x500; Reset scales it to our SVG viewBox. */
  const WIDTH = 420;
  const HEIGHT = 360;
  /** The page's two applets differ only in ShowNames (0 and 1). */
  const DEFAULT_SHOW_NAMES = true;
  const DEFAULT_SHOW_HINT = false;

  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, t) => ({ x: p.x * t, y: p.y * t });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const normal = (p) => ({ x: -p.y, y: p.x });

  /* ---- the GeoSDoub methods used by Compute, transcribed from the bytecode ---- */

  /** GeoSDoub.ComputeAngle(p,q,r): the angle at p, between pq and pr. */
  function angleAt(p, q, r) {
    const num = sqDist(p, q) + sqDist(p, r) - sqDist(q, r);
    const den = 2 * dist(p, q) * dist(p, r);
    return Math.acos(Math.max(-1, Math.min(1, den > EPS ? num / den : 1)));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn in screen coordinates. */
  function orientation(p, q, r) {
    const c = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return c > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn q about center by theta, in the triangle's sense. */
  function rotate(center, q, theta, sense) {
    const co = Math.cos(theta), si = Math.sin(theta);
    const dx = q.x - center.x, dy = q.y - center.y;
    return {
      x: center.x + co * dx - sense * si * dy,
      y: center.y + sense * si * dx + co * dy,
    };
  }

  /** GeoSDoub.Intersect: line pq with line rs; Java returns NaN if |det| < 1. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x;
    const c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x;
    const c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindIncenter: intersect two internal angle bisectors. */
  function findIncenter(a, b, c) {
    const atA = angleAt(a, b, c) / 2;
    const atB = angleAt(b, c, a) / 2;
    const sense = orientation(a, b, c);
    return intersect(a, rotate(a, b, atA, sense), b, rotate(b, c, atB, sense));
  }

  /** GeoSDoub.NearestPoint: orthogonal projection onto the whole line ab. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.1) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /* ------------------------------------ position ----------------------------------- */

  /**
   * GergonneMedialCanvas.Reset() with a canvas of WIDTH x HEIGHT:
   *   r = min(w,h)/3,  cx = w/2, cy = h/2,  angle = PI/3
   *   C = (cx + r cos60, cy - r sin60)
   *   A = (cx - r,       cy + 70)
   *   B = (cx + 1.2 r,   cy + 100)
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const r = Math.min(width, height) / 3;
    const cx = width / 2, cy = height / 2;
    return {
      width, height,
      A: { x: cx - r, y: cy + 70 },
      B: { x: cx + 1.2 * r, y: cy + 100 },
      C: { x: cx + r * Math.cos(Math.PI / 3), y: cy - r * Math.sin(Math.PI / 3) },
      showNames: o.showNames === undefined ? DEFAULT_SHOW_NAMES : !!o.showNames,
      showHint: o.showHint === undefined ? DEFAULT_SHOW_HINT : !!o.showHint,
    };
  }

  /** Reset keeps the current view and option toggles, and rebuilds the triangle. */
  function reset(state, options) {
    const o = options || {};
    return start({
      width: state.width, height: state.height,
      showNames: o.showNames === undefined ? state.showNames : o.showNames,
      showHint: o.showHint === undefined ? state.showHint : o.showHint,
    });
  }

  /** Move one draggable corner; the other corners and options stay put. */
  function withPoint(state, name, point) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return { ...state, [name]: { x: point.x, y: point.y } };
  }

  /** Toggle one of the applet's two checkboxes: "names" or "hint". */
  function withOption(state, name, value) {
    const key = name === "names" ? "showNames" : name === "hint" ? "showHint" : null;
    return key ? { ...state, [key]: !!value } : state;
  }

  /* ------------------------------------ geometry ------------------------------------ */

  /** Everything GergonneMedialCanvas.Compute() draws, plus validity. */
  function compute(state) {
    const { A, B, C } = state;
    const Ma = midpoint(B, C), Mb = midpoint(A, C), Mc = midpoint(A, B);
    const I = findIncenter(A, B, C);
    const Ga = nearestPoint(I, B, C);
    const Gb = nearestPoint(I, A, C);
    const Gc = nearestPoint(I, A, B);
    const D = nearestPoint(Ma, Gb, Gc);
    const E = nearestPoint(Mb, Ga, Gc);
    const F = nearestPoint(Mc, Ga, Gb);
    // Canvas.Compute() intersects Ma-D with Mb-E; T should also lie on Mc-F.
    const T = intersect(Ma, D, Mb, E);
    const radius = (dist(I, Ga) + dist(I, Gb) + dist(I, Gc)) / 3;
    const area = Math.abs(cross(sub(B, A), sub(C, A))) / 2;
    const sideAB = dist(A, B), sideBC = dist(B, C), sideCA = dist(C, A);
    const valid = area > 1e-6 && finite(I) && finite(T) && finite(D) && finite(E) && finite(F)
      && radius > 1e-6 && sideAB > 1e-6 && sideBC > 1e-6 && sideCA > 1e-6
      // Java's NearestPoint and Intersect have guards of 0.1 and 1: when a
      // contact side is shorter than that, the applet's own foot is not a
      // projection, so there is no claim to test in such a flat triangle.
      && sqDist(Ga, Gb) >= 0.1 && sqDist(Gb, Gc) >= 0.1 && sqDist(Gc, Ga) >= 0.1;
    return { A, B, C, Ma, Mb, Mc, I, Ga, Gb, Gc, D, E, F, T, radius, area, valid };
  }

  /** The incenter of the medial triangle: the homothety image (A+B+C-I)/2. */
  function medialIncenter(m) {
    return {
      x: (m.A.x + m.B.x + m.C.x - m.I.x) / 2,
      y: (m.A.y + m.B.y + m.C.y - m.I.y) / 2,
    };
  }

  /** Distance from p to the infinite line through q and r. */
  function distanceToLine(p, q, r) {
    const v = sub(r, q);
    const len = Math.hypot(v.x, v.y);
    if (len < EPS) return dist(p, q);
    return Math.abs(cross(sub(p, q), v)) / len;
  }

  /** Relative size of the dot product of two directions: 0 means perpendicular. */
  function perpError(p, q, r, s) {
    const u = sub(p, q), v = sub(r, s);
    const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
    if (nu < EPS || nv < EPS) return 0;
    return Math.abs(dot(u, v)) / (nu * nv);
  }

  /**
   * Test every claim made by the page and the proof, for a non-degenerate
   * triangle. Returns null for a degenerate one. `tol` is a relative error.
   */
  function claims(state, tol) {
    const eps = tol === undefined ? 1e-7 : tol;
    const m = compute(state);
    if (!m.valid) return null;
    const size = Math.max(dist(m.A, m.B), dist(m.B, m.C), dist(m.C, m.A));
    const near = (p, q) => dist(p, q) <= eps * size;
    const perp = (p, q, r, s) => perpError(p, q, r, s) <= eps;

    // The page's claim: perpendiculars from Ma, Mb, Mc onto opposite sides of
    // the contact triangle. T is the intersection of the first two.
    const firstTwo = near(m.T, intersect(m.Ma, m.D, m.Mb, m.E));
    const thirdPasses = distanceToLine(m.T, m.Mc, m.F) <= eps * size;
    const triple = near(m.T, intersect(m.Mb, m.E, m.Mc, m.F));

    // Groenman's proof: those three lines are the medial triangle's bisectors.
    const atMedialIncenter = near(m.T, medialIncenter(m));

    // The tangents from a vertex are equal, so AI is perpendicular to B'C'.
    const close = (a, b) => Math.abs(a - b) <= eps * size;
    const tangentAtA = close(dist(m.A, m.Gb), dist(m.A, m.Gc));
    const tangentAtB = close(dist(m.B, m.Gc), dist(m.B, m.Ga));
    const tangentAtC = close(dist(m.C, m.Ga), dist(m.C, m.Gb));

    // Maxwell's symmetric conclusion: the perpendiculars from Ga, Gb, Gc to
    // the medial triangle's opposite sides concur at the incenter I.
    const reverseA = perp(m.I, m.Ga, m.Mb, m.Mc);
    const reverseB = perp(m.I, m.Gb, m.Mc, m.Ma);
    const reverseC = perp(m.I, m.Gc, m.Ma, m.Mb);

    return {
      valid: true,
      perpendicularMa: perp(m.Ma, m.D, m.Gb, m.Gc),
      perpendicularMb: perp(m.Mb, m.E, m.Ga, m.Gc),
      perpendicularMc: perp(m.Mc, m.F, m.Ga, m.Gb),
      radiusToSideBC: perp(m.I, m.Ga, m.B, m.C),
      radiusToSideCA: perp(m.I, m.Gb, m.C, m.A),
      radiusToSideAB: perp(m.I, m.Gc, m.A, m.B),
      bisectorAtA: perp(m.I, m.A, m.Gb, m.Gc),
      bisectorAtB: perp(m.I, m.B, m.Gc, m.Ga),
      bisectorAtC: perp(m.I, m.C, m.Ga, m.Gb),
      tangentAtA, tangentAtB, tangentAtC,
      firstTwo, thirdPasses, triple,
      atMedialIncenter,
      reverseA, reverseB, reverseC,
      reverseConcurrence: near(m.I, intersect(m.Ga, add(m.Ga, normal(sub(m.Mc, m.Mb))),
        m.Gb, add(m.Gb, normal(sub(m.Ma, m.Mc))))),
      all: firstTwo && thirdPasses && triple && atMedialIncenter
        && perp(m.Ma, m.D, m.Gb, m.Gc) && perp(m.Mb, m.E, m.Ga, m.Gc)
        && perp(m.Mc, m.F, m.Ga, m.Gb) && tangentAtA && tangentAtB && tangentAtC
        && reverseA && reverseB && reverseC,
    };
  }

  return {
    WIDTH, HEIGHT, DEFAULT_SHOW_NAMES, DEFAULT_SHOW_HINT,
    start, reset, withPoint, withOption, compute, claims,
    // Geometry helpers are exposed so the check can compare them directly.
    midpoint, dist, sqDist, dot, cross, add, sub, scale, normal, finite,
    angleAt, orientation, rotate, intersect, findIncenter, nearestPoint,
    distanceToLine, perpError, medialIncenter,
  };
})();
