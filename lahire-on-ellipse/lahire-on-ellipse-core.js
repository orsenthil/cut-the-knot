"use strict";

/*
 * La Hire's Theorem in Ellipse — the geometry of Bogomolny's applet.
 *
 * Two points A and B sit outside an ellipse. The two tangents from A touch it
 * at C and D; the two from B touch it at E and F. La Hire's theorem says that
 * B lies on the chord CD exactly when A lies on the chord EF. The chords are
 * the polars of A and B; in stretched coordinates u=(x−cx)/a, v=(y−cy)/b the
 * polar of P is u·uP + v·vP = 1, a symmetric equation in P and the variable
 * point, which is the whole reason the implication works both ways.
 *
 * The one idea the code relies on: the applet computes the tangent points from
 * a point by stretching the ellipse into a circle of radius 1000, drawing the
 * two tangents to that circle with a helper circle, and stretching back. Every
 * geometric quantity here is transcribed from CTKEllipse.Tangent2From,
 * GeoSDoub.IntersectCirclesX/Y, GeoSDoub.Dist(DoubPoint, DoubLine),
 * CTKEllipse.MaintainRect and LaHireOnEllipseCanvas.CheckTouch.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, LahireOnEllipseCore, so the page loads it with a plain
 * <script> and porting/check-lahire-on-ellipse.mjs loads it in Node. The
 * position is plain data, and every function takes a position and returns new
 * values; nothing passed in changes.
 */
const LahireOnEllipseCore = (() => {
  const EPS = 1e-9;
  /* The embedded applet is 600x450; getParameterInfo says 400x300 will do too. */
  const VIEW = { width: 600, height: 450 };
  /* LaHireOnEllipseCanvas.CheckTouch: GeoSDoub.Dist(A, LineB) < 1. */
  const TOUCH = 1;
  const CIRCLE_R = 1000;

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** CTKEllipse(MoveablePoint[]) and EllipseUpdated. */
  function ellipseFrom(V) {
    const center = { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 };
    return { center, A: (V[1].x - V[0].x) / 2, B: (V[1].y - V[2].y) / 2 };
  }

  /** The ellipse expression, 1 on the curve: (x−cx)²/a² + (y−cy)²/b². */
  function ellipseValue(e, p) {
    return ((p.x - e.center.x) / e.A) ** 2 + ((p.y - e.center.y) / e.B) ** 2;
  }

  /* GeoSDoub.IntersectCirclesX, from the bytecode: solve y = m*x + b. */
  function circleIntersectionsX(a, b) {
    const m = -(a.y - b.y) / (a.x - b.x);
    const intercept = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y -
      a.r * a.r + b.r * b.r) / 2 / (a.x - b.x);
    const h = intercept - a.x;
    const A = m * m + 1;
    const k = m * h - a.y;
    const c = h * h + a.y * a.y - a.r * a.r;
    const disc = k * k - A * c;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / A, y2 = (-k - root) / A;
    return [{ x: m * y1 + intercept, y: y1 }, { x: m * y2 + intercept, y: y2 }];
  }

  /* GeoSDoub.IntersectCirclesY: the vertical-radical-axis branch. */
  function circleIntersectionsY(a, b) {
    const m = -(a.x - b.x) / (a.y - b.y);
    const intercept = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x -
      a.r * a.r + b.r * b.r) / 2 / (a.y - b.y);
    const h = intercept - a.y;
    const A = m * m + 1;
    const k = m * h - a.x;
    const c = h * h + a.x * a.x - a.r * a.r;
    const disc = k * k - A * c;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    const x1 = (-k + root) / A, x2 = (-k - root) / A;
    return [{ x: x1, y: m * x1 + intercept }, { x: x2, y: m * x2 + intercept }];
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle), including its dispatch. */
  function circleIntersections(a, b) {
    if (Math.abs(a.x - b.x) > 1) return circleIntersectionsX(a, b);
    if (Math.abs(a.y - b.y) > 1) return circleIntersectionsY(a, b);
    return [copy(a), copy(a)];
  }

  /** CTKEllipse.Tangent2From(P): the two contact points, or null. */
  function tangentPoints(e, p) {
    if (!finite(p) || Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return null;
    const u = {
      x: ((p.x - e.center.x) / e.A) * CIRCLE_R,
      y: ((p.y - e.center.y) / e.B) * CIRCLE_R,
    };
    const big = { x: 0, y: 0, r: CIRCLE_R };
    /* The bytecode pushes SqDist(centre, u) − R² (not the other way round). */
    const power = sqDist(big, u) - big.r * big.r;
    if (!(power > 0)) return null; // P is on or inside the ellipse
    const helper = { x: u.x, y: u.y, r: Math.sqrt(power) };
    const hits = circleIntersections(big, helper);
    if (hits.length < 2 || !finite(hits[0]) || !finite(hits[1])) return null;
    return hits.map((q) => ({
      x: e.center.x + (q.x * e.A) / CIRCLE_R,
      y: e.center.y + (q.y * e.B) / CIRCLE_R,
    }));
  }

  /** The line through two points, in the applet's DoubLine(p, q) form. */
  const line = (p, q) => ({ p: copy(p), q: copy(q) });

  /**
   * GeoSDoub.Dist(DoubPoint, DoubLine): perpendicular distance to the whole
   * line, not just the segment. A point within 0.316 px of the first endpoint
   * is reported as 0 by the applet.
   */
  function distToLine(p, l) {
    if (!l || !finite(p) || !finite(l.p) || !finite(l.q)) return Infinity;
    if (sqDist(l.p, p) < 0.1) return 0;
    const dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS * EPS) return 0;
    const t = (dx * (p.x - l.p.x) + dy * (p.y - l.p.y)) / len2;
    return Math.hypot(l.p.x + t * dx - p.x, l.p.y + t * dy - p.y);
  }

  /**
   * LaHireOnEllipseCanvas.Compute: the four contact points, the two chords and
   * the applet's one-pixel "touch" test. The applet would throw if LineA exists
   * while LineB does not; here a missing chord simply cannot touch.
   */
  function compute(state) {
    const e = ellipseFrom(state.V);
    const fromA = tangentPoints(e, state.A);
    const fromB = tangentPoints(e, state.B);
    const ok = (pts) => pts && pts.length === 2 && finite(pts[0]) && finite(pts[1]);
    const C = ok(fromA) ? copy(fromA[0]) : null;
    const D = ok(fromA) ? copy(fromA[1]) : null;
    const E = ok(fromB) ? copy(fromB[0]) : null;
    const F = ok(fromB) ? copy(fromB[1]) : null;
    const lineA = C && D ? line(C, D) : null;
    const lineB = E && F ? line(E, F) : null;
    const touchDistance = lineA && lineB ? distToLine(state.A, lineB) : null;
    const touch = Boolean(lineA && touchDistance !== null && touchDistance < TOUCH);
    return { ellipse: e, C, D, E, F, lineA, lineB, touchDistance, touch };
  }

  /** The polar of P in stretched coordinates: u·uP + v·vP = 1. */
  function polarCoefficients(e, p) {
    return { x: (p.x - e.center.x) / (e.A * e.A), y: (p.y - e.center.y) / (e.B * e.B) };
  }

  /** Left side of the polar equation of P, evaluated at Q. */
  function polarResidual(e, p, q) {
    const n = polarCoefficients(e, p);
    return n.x * (q.x - e.center.x) + n.y * (q.y - e.center.y) - 1;
  }

  /** Exact distance from Q to the polar of P, using the symmetric residual. */
  function polarDistance(e, p, q) {
    const n = polarCoefficients(e, p);
    return Math.abs(polarResidual(e, p, q)) / Math.hypot(n.x, n.y);
  }

  /**
   * CTKEllipse.MaintainRect: dragging a corner mirrors it across both centre
   * lines, so the centre of the ellipse never moves.
   */
  function maintainRect(V, index, p) {
    const center = ellipseFrom(V).center;
    const dx = center.x - p.x, dy = center.y - p.y;
    const v = V.map(copy);
    v[index] = copy(p); // Mover.UpdateLocation moved the selected point first
    const set = (i, x, y) => { v[i].x = x; v[i].y = y; };
    if (index === 0) {
      set(1, center.x + dx, center.y - dy);
      set(2, center.x + dx, center.y + dy);
      set(3, center.x - dx, center.y + dy);
    } else if (index === 1) {
      set(0, center.x + dx, center.y - dy);
      set(2, center.x - dx, center.y + dy);
      set(3, center.x + dx, center.y + dy);
    } else if (index === 2) {
      set(0, center.x + dx, center.y + dy);
      set(1, center.x - dx, center.y + dy);
      set(3, center.x + dx, center.y - dy);
    } else if (index === 3) {
      set(0, center.x - dx, center.y + dy);
      set(1, center.x + dx, center.y + dy);
      set(2, center.x + dx, center.y - dy);
    }
    return v;
  }

  /** The start position of the applet embedded at 600x450 on its page. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    /* The applet divides the size by 2.5 and 1.5 as doubles, but by 8 as ints. */
    const sx = width / 2.5, sy = height / 1.5;
    const rx = Math.trunc(width / 8), ry = Math.trunc(height / 8);
    if (o.V && o.A && o.B) {
      return {
        view: { width, height }, V: o.V.map(copy),
        A: copy(o.A), B: copy(o.B),
        names: Boolean(o.names), explored: Boolean(o.explored),
      };
    }
    const V = [
      { x: sx - rx, y: sy + ry }, { x: sx + rx, y: sy + ry },
      { x: sx + rx, y: sy - ry }, { x: sx - rx, y: sy - ry },
    ];
    const h = Math.hypot(rx, ry);
    return {
      view: { width, height }, V,
      A: { x: sx + 3 * h, y: sy },
      B: { x: sx, y: sy - 2 * h },
      names: o.names === undefined ? true : Boolean(o.names),
      explored: false,
    };
  }

  /** The applet only accepts drags inside Rectangle(10,10,W−20,H−20). */
  function clamp(p, state) {
    const view = (state && state.view) || VIEW;
    return {
      x: Math.max(10, Math.min(view.width - 10, p.x)),
      y: Math.max(10, Math.min(view.height - 10, p.y)),
    };
  }

  /** Keep a dragged rectangle corner away from the centre lines and the edge. */
  function clampCorner(p, state) {
    const q = clamp(p, state);
    const e = ellipseFrom(state.V);
    const dx = q.x - e.center.x, dy = q.y - e.center.y;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    return {
      x: e.center.x + sx * Math.max(11, Math.abs(dx)),
      y: e.center.y + sy * Math.max(11, Math.abs(dy)),
    };
  }

  /** Move one named handle: V0..V3 reshape the ellipse, A and B slide freely. */
  function move(state, name, p) {
    const next = {
      view: { ...state.view }, V: state.V.map(copy),
      A: copy(state.A), B: copy(state.B),
      names: state.names, explored: state.explored,
    };
    if (name[0] === "V") {
      const index = Number(name.slice(1));
      if (!Number.isInteger(index) || index < 0 || index > 3) return next;
      next.V = maintainRect(next.V, index, p);
    } else if (name === "A" || name === "B") {
      next[name] = clamp(p, state);
    } else {
      return next;
    }
    if (compute(next).touch) next.explored = true;
    return next;
  }

  /**
   * A modern convenience, not a button in the applet: put B on the polar of A.
   * On that line the stretched distance from the ellipse centre is
   * sqrt(1/|UA|² + s²), so stepping s past sqrt(1 − 1/|UA|²) puts B outside.
   * Of the two sides we take the one that stays inside the drawing rectangle.
   */
  function placeB(state) {
    const e = ellipseFrom(state.V);
    const ua = {
      x: (state.A.x - e.center.x) / e.A,
      y: (state.A.y - e.center.y) / e.B,
    };
    const len = Math.hypot(ua.x, ua.y);
    if (!(len > 1)) return state; // A must have tangents first
    const threshold = Math.sqrt(1 - 1 / (len * len));
    const base = {
      x: e.center.x + (ua.x / (len * len)) * e.A,
      y: e.center.y + (ua.y / (len * len)) * e.B,
    };
    const dir = { x: (-ua.y / len) * e.A, y: (ua.x / len) * e.B };
    const candidates = [];
    for (const sign of [1, -1]) {
      for (const extra of [0.08, 0.5, 2, 6]) {
        const q = {
          x: base.x + sign * dir.x * (threshold + extra),
          y: base.y + sign * dir.y * (threshold + extra),
        };
        const c = clamp(q, state);
        if (Math.abs(c.x - q.x) < 1e-6 && Math.abs(c.y - q.y) < 1e-6 &&
            ellipseValue(e, q) > 1 && dist(q, state.A) > 1) candidates.push(q);
      }
    }
    if (!candidates.length) return state;
    candidates.sort((p, q) => dist(p, state.B) - dist(q, state.B));
    return move(state, "B", candidates[0]);
  }

  /** All the page's claims, measured on the current diagram. */
  function claims(state) {
    const g = compute(state);
    const e = g.ellipse;
    const scale = Math.max(1, Math.abs(e.A), Math.abs(e.B)) * 1e-6;
    const exact = 1e-7 * Math.max(1, Math.abs(e.A), Math.abs(e.B),
      Math.abs(e.center.x), Math.abs(e.center.y));

    const touchPoint = (p) => finite(p) && Math.abs(ellipseValue(e, p) - 1) < 1e-6;
    const contactPoints = [g.C, g.D, g.E, g.F].every(touchPoint);
    const onPolars = Boolean(g.lineA && g.lineB) &&
      Math.abs(polarResidual(e, state.A, g.C)) < exact &&
      Math.abs(polarResidual(e, state.A, g.D)) < exact &&
      Math.abs(polarResidual(e, state.B, g.E)) < exact &&
      Math.abs(polarResidual(e, state.B, g.F)) < exact;

    /* The page's exact claim, and its converse, in signed-distance form. */
    const residual = polarResidual(e, state.A, state.B);
    const bOnCD = Boolean(g.lineA) && polarDistance(e, state.A, state.B) < exact;
    const aOnEF = Boolean(g.lineB) && polarDistance(e, state.B, state.A) < exact;
    const implication = !bOnCD || aOnEF;

    /* The applet's own one-pixel test, driven by the computed chord EF. */
    const lineAgreement = Boolean(g.lineA && g.lineB) &&
      distToLine(g.C, g.lineA) < scale && distToLine(g.D, g.lineA) < scale &&
      distToLine(g.E, g.lineB) < scale && distToLine(g.F, g.lineB) < scale;
    return {
      ...g, contactPoints, onPolars, bOnCD, aOnEF, implication,
      lineAgreement, residual,
      signedB: g.lineA ? residual / Math.hypot(
        polarCoefficients(e, state.A).x, polarCoefficients(e, state.A).y) : null,
      signedA: g.lineB ? residual / Math.hypot(
        polarCoefficients(e, state.B).x, polarCoefficients(e, state.B).y) : null,
    };
  }

  /** Status text for an illustration; there is no win or loss here. */
  function describe(state) {
    const c = claims(state);
    if (!c.lineA || !c.lineB) {
      return "Move both A and B outside the oval to draw their tangents.";
    }
    if (c.touch) {
      return "B is on CD and A is on EF. Both chords of contact carry the other point: La Hire's theorem holds here.";
    }
    if (c.bOnCD) {
      return "B is on CD, but A is still " + c.touchDistance.toFixed(1) +
        " px from EF. Keep dragging or press Put B on CD.";
    }
    return "Drag B onto the line CD, or press Put B on CD, and watch what happens to EF and A.";
  }

  /** The position handed to Track, in board units. */
  function position(state) {
    const c = claims(state);
    return {
      V: state.V.map(copy), A: copy(state.A), B: copy(state.B),
      ellipse: c.ellipse, C: c.C, D: c.D, E: c.E, F: c.F,
      touch: c.touch, names: state.names, explored: state.explored,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, TOUCH, CIRCLE_R,
    sqDist, dist, copy, finite, ellipseFrom, ellipseValue,
    circleIntersectionsX, circleIntersectionsY, circleIntersections,
    tangentPoints, line, distToLine, compute, polarCoefficients,
    polarResidual, polarDistance, maintainRect, start, clamp, clampCorner,
    move, placeB, claims, describe, position, result,
  };
})();
