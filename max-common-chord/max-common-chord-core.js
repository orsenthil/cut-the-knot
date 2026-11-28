"use strict";

/*
 * Max Common Chord, from Alexander Bogomolny's applet MaxCommonChord (the
 * 1975 USAMO problem). Two circles meet at P and Q. A chord through P ends at
 * A on the first circle and B on the second; the task is to make AP×PB as
 * large as possible. The applet draws the circles, the chord, the circumcircle
 * ABQ, its second meeting R with line PQ, and the tangents from R to the two
 * circles. The maximum happens when the two tangent points and P are in line.
 *
 * The key idea in this file is a literal transcription of the applet's own
 * arithmetic: GeoSDoub (circumcentres, circle/line and circle/circle cuts),
 * InsideTest, DoubCircle and MaxCommonChordCanvas.Compute, Fix and
 * PointOfTangency. Pixel-sized tolerances are kept: the applet counts two
 * points as the same within one unit, and "P lies between" within 1e-6.
 *
 * This is the geometry and nothing else: no document, no window, no storage.
 * It defines one global, MaxCommonChordCore, so the page loads it with a plain
 * <script> and porting/check-max-common-chord.mjs loads it in Node. Positions
 * are plain data and every function returns a new one.
 */
const MaxCommonChordCore = (() => {
  /** The applet's `<APPLET WIDTH=640 HEIGHT=460>` on the cut-the-knot page. */
  const DEFAULT_WIDTH = 640;
  const DEFAULT_HEIGHT = 460;
  /** GeoSDoub's cut-off for treating a near-zero determinant as parallel. */
  const UNIT_EPS = 1;
  /** CTKMoveableDoub.Prorate's guard. */
  const NEAR_EPS = 0.1;
  /** MaxCommonChordCanvas.Compute's distance guard. */
  const MIN_SEP = 2;
  /** MaxCommonChordCanvas.InBetween's tolerance. */
  const BETWEEN_EPS = 1e-6;

  const idiv = (a, b) => Math.trunc(a / b);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function orientation(p, q, r) {
    const v = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return v > 0 ? 1 : -1;
  }
  /** InsideTest.IsInside(R, P, Q): true while R is on the closed segment PQ. */
  function inside(r, p, q) {
    return (r.x - p.x) * (r.x - q.x) + (r.y - p.y) * (r.y - q.y) <= 0;
  }
  /** MaxCommonChordCanvas.InBetween(a, p, b). */
  function inBetween(a, p, b) {
    if (!a || !b) return false;
    return Math.abs(dist(a, p) + dist(p, b) - dist(a, b)) < BETWEEN_EPS;
  }

  /* ---------------- GeoSDoub's line and circle arithmetic, from the bytecode */

  /** GeoSDoub.Intersect(DoubPoint x4); NaN when the determinant is under one. */
  function lineIntersection(p, q, u, v) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = u.y - v.y, e = v.x - u.x, f = u.x * v.y - u.y * v.x;
    const den = a * e - d * b;
    if (Math.abs(den) < UNIT_EPS) return { x: NaN, y: NaN };
    return { x: (b * f - e * c) / den, y: (c * d - f * a) / den };
  }

  /** GeoSDoub.FindCircumcenter: cut the two perpendicular bisectors. */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const u = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const v = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return lineIntersection(m1, u, m2, v);
  }

  /** MaxCommonChordCanvas.GetCircle; the radius is the mean of three distances. */
  function circle(a, b, c) {
    const center = circumcenter(a, b, c);
    return {
      center,
      radius: (dist(center, a) + dist(center, b) + dist(center, c)) / 3,
    };
  }

  /** GeoSDoub.IntersectX(DoubLine, DoubCircle): solve x = slope*y + B. */
  function lineCircleX(p, q, c) {
    const slope = (p.x - q.x) / (p.y - q.y);
    const B = q.x - slope * q.y;
    const qa = slope * slope + 1;
    const qb = slope * (B - c.center.x) - c.center.y;
    const qc = (B - c.center.x) * (B - c.center.x) +
      c.center.y * c.center.y - c.radius * c.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
    return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
  }

  /** GeoSDoub.IntersectY(DoubLine, DoubCircle): solve y = slope*x + B. */
  function lineCircleY(p, q, c) {
    const slope = (p.y - q.y) / (p.x - q.x);
    const B = q.y - slope * q.x;
    const qa = slope * slope + 1;
    const qb = slope * (B - c.center.y) - c.center.x;
    const qc = (B - c.center.y) * (B - c.center.y) +
      c.center.x * c.center.x - c.radius * c.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
    return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
  }

  /** GeoSDoub.Intersect(DoubLine, DoubCircle), with the applet's one-unit test. */
  function lineCircle(p, q, c) {
    if (Math.abs(p.y - q.y) > UNIT_EPS) return lineCircleX(p, q, c);
    if (Math.abs(p.x - q.x) > UNIT_EPS) return lineCircleY(p, q, c);
    return null;
  }

  /** GeoSDoub.IntersectCirclesX: solve y from x = slope*y + B. */
  function circlesX(a, b) {
    const slope = -(a.center.y - b.center.y) / (a.center.x - b.center.x);
    const B = (a.center.x * a.center.x - b.center.x * b.center.x +
      a.center.y * a.center.y - b.center.y * b.center.y -
      a.radius * a.radius + b.radius * b.radius) / 2 / (a.center.x - b.center.x);
    const h = B - a.center.x;
    const qa = slope * slope + 1;
    const qb = slope * h - a.center.y;
    const qc = h * h + a.center.y * a.center.y - a.radius * a.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const y0 = (-qb + disc) / qa, y1 = (-qb - disc) / qa;
    return [{ x: slope * y0 + B, y: y0 }, { x: slope * y1 + B, y: y1 }];
  }

  /** GeoSDoub.IntersectCirclesY: the same with x and y exchanged. */
  function circlesY(a, b) {
    const slope = -(a.center.x - b.center.x) / (a.center.y - b.center.y);
    const B = (a.center.y * a.center.y - b.center.y * b.center.y +
      a.center.x * a.center.x - b.center.x * b.center.x -
      a.radius * a.radius + b.radius * b.radius) / 2 / (a.center.y - b.center.y);
    const h = B - a.center.y;
    const qa = slope * slope + 1;
    const qb = slope * h - a.center.x;
    const qc = h * h + a.center.x * a.center.x - a.radius * a.radius;
    let disc = qb * qb - qa * qc;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const x0 = (-qb + disc) / qa, x1 = (-qb - disc) / qa;
    return [{ x: x0, y: slope * x0 + B }, { x: x1, y: slope * x1 + B }];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle). */
  function circleCircle(a, b) {
    if (Math.abs(a.center.x - b.center.x) > UNIT_EPS) return circlesX(a, b);
    if (Math.abs(a.center.y - b.center.y) > UNIT_EPS) return circlesY(a, b);
    return [{ x: a.center.x, y: a.center.y }, { x: a.center.x, y: a.center.y }];
  }

  /** MaxCommonChordCanvas.Other: the cut that is not the point already known. */
  function other(pts, known) {
    if (!pts || !pts[0] || !pts[1]) return null;
    return dist(pts[0], known) < UNIT_EPS ? pts[1] : pts[0];
  }

  /* ------------------------------ dragging, as the canvas mouse methods do it */

  /** CTKMoveableDoub with a circle glider: put the new point on the circle. */
  function restrictToCircle(p, c) {
    const d = dist(p, c.center);
    if (d < NEAR_EPS) return { x: p.x, y: p.y };
    const f = c.radius / d;
    return { x: c.center.x + (p.x - c.center.x) * f,
      y: c.center.y + (p.y - c.center.y) * f };
  }

  /**
   * MaxCommonChordCanvas.Fix(target, circle, anchor): put `target` on `circle`
   * at the far cut of line anchor-P, so the chord still goes through P.
   */
  function fix(target, circle, anchor, P) {
    if (dist(anchor, P) < UNIT_EPS) return target;
    const pts = lineCircle(anchor, P, circle);
    const chosen = other(pts, P);
    return chosen ? { x: chosen.x, y: chosen.y } : target;
  }

  /**
   * The canvas init: whole-pixel starting points, then one Fix so that A, P
   * and B start in line. The applet's default radio button is "chord".
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const rawP = { x: idiv(width, 2), y: idiv(height * 2, 5) + idiv(height, 5) };
    const rawQ = { x: idiv(width, 2), y: idiv(height * 3, 5) + idiv(height, 5) };
    const A = { x: idiv(width * 3, 10), y: idiv(height, 2) + idiv(height, 5) };
    const rawB = { x: idiv(width * 7, 10), y: idiv(height * 3, 5) + idiv(height, 5) };
    const F = circle(rawB, rawP, rawQ);
    const B = fix(rawB, F, A, rawP);
    return {
      width, height,
      mode: o.mode === "circles" ? "circles" : "chord",
      P: rawP, Q: rawQ, A, B,
    };
  }

  function reset(state) {
    return start({ width: state.width, height: state.height, mode: state.mode });
  }

  function setMode(state, mode) {
    return { ...state, mode: mode === "circles" ? "circles" : "chord" };
  }

  /** Copy just the four draggable points out of a state. */
  function pointsOf(state) {
    return {
      P: { x: state.P.x, y: state.P.y }, Q: { x: state.Q.x, y: state.Q.y },
      A: { x: state.A.x, y: state.A.y }, B: { x: state.B.x, y: state.B.y },
    };
  }

  /**
   * Drag one of the four handles. P and Q only move (the applet never calls
   * Fix for them). A and B are either glued to their present circle ("chord")
   * or free ("circles"), and then the other end is fixed back through P.
   */
  function movePoint(state, name, point) {
    if (["P", "Q", "A", "B"].indexOf(name) < 0) return state;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return state;
    const p = pointsOf(state);
    if (name === "P" || name === "Q") {
      p[name] = { x: point.x, y: point.y };
      return finiteState(p) ? { ...state, ...p } : state;
    }
    if (name === "A") {
      const E = circle(p.A, p.P, p.Q);
      p.A = state.mode === "chord" ? restrictToCircle(point, E)
        : { x: point.x, y: point.y };
      const F = circle(p.B, p.P, p.Q);
      p.B = fix(p.B, F, p.A, p.P);
    } else {
      const F = circle(p.B, p.P, p.Q);
      p.B = state.mode === "chord" ? restrictToCircle(point, F)
        : { x: point.x, y: point.y };
      const E = circle(p.A, p.P, p.Q);
      p.A = fix(p.A, E, p.B, p.P);
    }
    return finiteState(p) ? { ...state, ...p } : state;
  }

  /** A drag that lands exactly on a nearly collinear triple has no circle. */
  function finiteState(state) {
    return ["P", "Q", "A", "B"].every((name) =>
      Number.isFinite(state[name].x) && Number.isFinite(state[name].y));
  }

  /* ----------------------------- Compute, PointOfTangency and the two results */

  /**
   * MaxCommonChordCanvas.PointOfTangency(R, circle, hint). R is on the radical
   * axis, so the tangent circle about R meets the given circle at two points;
   * the one on the same side of PQ as `hint` is the applet's choice.
   */
  function pointOfTangency(R, c, hint, P, Q) {
    const power = sqDist(R, c.center) - c.radius * c.radius;
    if (power <= 0) return null;
    const aux = { center: { x: R.x, y: R.y }, radius: Math.sqrt(power) };
    const pts = circleCircle(c, aux);
    if (!pts || !pts[0] || !pts[1]) return null;
    return orientation(P, Q, hint) === orientation(P, Q, pts[0]) ? pts[0] : pts[1];
  }

  /** A line as its two defining points, for the SVG layer to draw. */
  const segment = (p, q) => ({ p: { x: p.x, y: p.y }, q: { x: q.x, y: q.y } });

  /**
   * MaxCommonChordCanvas.Compute. `valid` is false for the two early returns
   * (nearly coincident points, or R within one unit of P). When R lies inside
   * PQ the tangents do not exist and the applet blanks them; here they are
   * null. Everything else is the same arithmetic, in the same order.
   */
  function compute(state) {
    const { P, Q, A, B } = state;
    const blank = (reason) => ({
      valid: false, reason, E: null, F: null, ABQ: null, R: null,
      At: null, Bt: null, Pe: null, Pf: null, RA: null, RB: null,
      tangent: null, inside: false, between: false, onChord: false,
      product: 0, pqpr: 0, pq: dist(P, Q),
    });
    if (dist(A, P) < MIN_SEP || dist(A, Q) < MIN_SEP ||
        dist(B, P) < MIN_SEP || dist(B, Q) < MIN_SEP ||
        dist(P, Q) < MIN_SEP) return blank("degenerate");

    const E = circle(A, P, Q);
    const F = circle(B, P, Q);
    const ABQ = circle(A, B, Q);
    const cuts = lineCircle(P, Q, ABQ);
    const R = other(cuts, Q);
    if (!R || dist(P, R) < UNIT_EPS) return blank("r-near-p");
    if (![E, F, ABQ].every((c) => Number.isFinite(c.center.x) &&
        Number.isFinite(c.center.y) && Number.isFinite(c.radius)) ||
        !Number.isFinite(R.x) || !Number.isFinite(R.y)) return blank("collinear");

    const result = {
      valid: true, reason: null, E, F, ABQ, R,
      At: null, Bt: null, Pe: null, Pf: null, RA: null, RB: null,
      tangent: null,
      inside: inside(R, P, Q),
      between: false,
      onChord: inBetween(A, P, B),
      product: dist(A, P) * dist(P, B),
      pqpr: dist(P, Q) * dist(P, R),
      pq: dist(P, Q),
    };
    if (result.inside) return result;

    const At = pointOfTangency(R, E, A, P, Q);
    const Bt = pointOfTangency(R, F, B, P, Q);
    result.At = At;
    result.Bt = Bt;
    if (At) result.RA = segment(R, At);
    if (Bt) result.RB = segment(R, Bt);
    if (At && Bt) {
      result.tangent = segment(At, Bt);
      try {
        result.Pe = other(lineCircle(At, Bt, E), At);
        result.Pf = other(lineCircle(At, Bt, F), Bt);
      } catch (e) {
        // The applet wraps exactly this calculation in a try/catch.
      }
    }
    result.between = inBetween(At, P, Bt);
    return result;
  }

  /** The plain, serialisable position saved for the record and the tutor. */
  function position(state, result) {
    const info = result || compute(state);
    return {
      width: state.width, height: state.height, mode: state.mode,
      P: { x: state.P.x, y: state.P.y }, Q: { x: state.Q.x, y: state.Q.y },
      A: { x: state.A.x, y: state.A.y }, B: { x: state.B.x, y: state.B.y },
      R: info.R ? { x: info.R.x, y: info.R.y } : null,
      At: info.At ? { x: info.At.x, y: info.At.y } : null,
      Bt: info.Bt ? { x: info.Bt.x, y: info.Bt.y } : null,
      product: info.product, pqpr: info.pqpr,
      onChord: info.onChord, between: info.between, valid: info.valid,
    };
  }

  return {
    DEFAULT_WIDTH, DEFAULT_HEIGHT, UNIT_EPS, NEAR_EPS, MIN_SEP, BETWEEN_EPS,
    dist, sqDist, midpoint, orientation, inside, inBetween,
    lineIntersection, circumcenter, circle,
    lineCircleX, lineCircleY, lineCircle, circlesX, circlesY, circleCircle,
    other, restrictToCircle, fix,
    start, reset, setMode, pointsOf, movePoint,
    pointOfTangency, compute, position,
  };
})();
