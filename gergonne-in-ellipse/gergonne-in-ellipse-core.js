"use strict";

/*
 * Gergonne in Ellipse — the geometry behind Bogomolny's illustration.
 *
 * Three points T0,T1,T2 are dragged on an ellipse. The tangents at neighbouring
 * points meet in the three corners of a triangle circumscribed about the ellipse:
 *   A2 = tangent(T0) ∩ tangent(T1),
 *   A0 = tangent(T1) ∩ tangent(T2),
 *   A1 = tangent(T2) ∩ tangent(T0).
 * So A[i] is the corner opposite the touch point T[i]. The lines A[i]—T[i]
 * (the cevians) concur: that meeting point is the Gergonne point. The applet
 * names it G and obtains it as the average of the three pairwise intersections
 * of those cevians; when they concur, that average is their common point.
 *
 * The one idea the code relies on: the applet draws the ellipse as a unit
 * circle stretched by (A,B) and shifted by its centre. The tangent to the
 * circle at u = 1000·((p.x-cx)/A, (p.y-cy)/B), mapped back, is the tangent to
 * the ellipse at p. Line intersections then use the applet's own Cramer solve
 * with its "|det| < 1 means NaN" guard. Dragging a touch point snaps it back
 * onto the ellipse with GeoSDoub's signed angle; dragging a frame corner mirrors
 * the other three corners about the centre and snaps every point onto the new
 * ellipse.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, GergonneInEllipseCore, so the page loads it with a
 * plain <script> and porting/check-gergonne-in-ellipse.mjs loads it in Node.
 * The position is plain data (numbers, arrays and plain objects); functions
 * take a position and return new values, never changing what they were given.
 */
const GergonneInEllipseCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 400, height: 300 };
  /* The three angles passed to CTKEllipse.EllipseAt in the applet's init(). */
  const START_ANGLES = [
    0.15707963267948966,          // π/20
    -2.356194490192345,           // -3π/4
    2.0943951023931953,           // 2π/3
  ];
  const POINT_NAMES = ["A", "B", "C"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** CTKEllipse(MoveablePoint[]) and EllipseUpdated. */
  function ellipseFrom(V) {
    const center = { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 };
    return {
      center,
      /* GeoSDoub.ComputeSignedAngle(center, Inf, u) uses Inf, 200 units right
         of the centre; CTKEllipse keeps that point in its Inf field. */
      inf: { x: center.x + 200, y: center.y },
      A: (V[1].x - V[0].x) / 2,
      B: (V[1].y - V[2].y) / 2,
    };
  }

  /** CTKEllipse.EllipseAt(t). */
  function pointAt(e, t) {
    return { x: e.center.x + e.A * Math.cos(t), y: e.center.y + e.B * Math.sin(t) };
  }

  /** GeoSDoub.FindOrientation(a,b,c): +1 for a left turn, else -1. */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(a,b,c), used by CTKEllipse.KeepOnEllipse. */
  function signedAngle(a, b, c) {
    const cosv = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    const angle = Math.acos(Math.max(-1, Math.min(1, cosv)));
    return orientation(a, b, c) === 1 ? angle : -angle;
  }

  /** CTKEllipse.KeepOnEllipse: slide a dragged point back onto the ellipse. */
  function keepOnEllipse(e, p) {
    if (Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return copy(p);
    const u = { x: (p.x - e.center.x) / e.A, y: (p.y - e.center.y) / e.B };
    if (sqDist(u, { x: 0, y: 0 }) < EPS * EPS) return pointAt(e, 0);
    /* CTKEllipse builds center+u before taking the signed angle, so the
       reference point is one unit-circle radius from the centre. */
    const onUnitCircle = { x: e.center.x + u.x, y: e.center.y + u.y };
    return pointAt(e, signedAngle(e.center, e.inf, onUnitCircle));
  }

  /** CTKEllipse.KeepAllOnEllipse, called after a frame corner moves. */
  function keepAllOnEllipse(e, points) {
    return points.map((p) => keepOnEllipse(e, p));
  }

  /**
   * CTKEllipse.MaintainRect: the dragged frame corner is mirrored across both
   * centre lines, so the ellipse's centre never moves.
   */
  function maintainRect(V, index, p) {
    const center = ellipseFrom(V).center;
    const dx = center.x - p.x, dy = center.y - p.y;
    const v = V.map(copy);
    v[index] = copy(p);
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

  /** The line through two points, in the applet's DoubLine(p, q) form. */
  const line = (p, q) => ({ p: copy(p), q: copy(q) });

  /**
   * GeoSDoub.Intersect(a,b,c,d): line coefficients
   * (a.y-b.y)x + (b.x-a.x)y + (a.x*b.y-a.y*b.x), solved by Cramer's rule.
   * A determinant whose absolute value is below 1 gives NaN in the applet.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  const intersectLines = (l, m) => intersect(l.p, l.q, m.p, m.q);

  /** DoubCircle(0,0,1000).Tangent(u): the tangent direction point at u. */
  function circleTangent(u) {
    const len = dist(u, { x: 0, y: 0 });
    if (Math.abs(len - 1000) > 1) return null;
    return { x: u.x + u.y, y: u.y - u.x };
  }

  /** CTKEllipse.TangentAt(p), including its 1000-unit circle transform. */
  function tangentAt(e, p) {
    if (Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return null;
    const u = {
      x: ((p.x - e.center.x) / e.A) * 1000,
      y: ((p.y - e.center.y) / e.B) * 1000,
    };
    const t = circleTangent(u);
    if (!t) return null;
    const q = {
      x: e.center.x + (t.x * e.A) / 1000,
      y: e.center.y + (t.y * e.B) / 1000,
    };
    return line(p, q);
  }

  /** Signed distance from p to the infinite line through a,b. */
  function distToLine(p, a, b) {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  }

  /**
   * GergonneInEllipseCanvas.Compute: three tangents, their three intersections
   * A[0..2] (opposite the touch points), the three cevians A[i]—T[i], the three
   * pairwise cevian intersections, and G = their barycentre. A null tangent is
   * what makes the applet set NoDraw and suppress the cevian lines and dots.
   */
  function compute(state) {
    const e = ellipseFrom(state.V);
    const tangents = state.P.map((p) => tangentAt(e, p));
    if (!tangents.every(Boolean)) {
      return { ellipse: e, tangents, vertices: [], cevians: [], meetings: [], G: null, noDraw: true };
    }
    /* Bytecode order: A2 from T0/T1, A0 from T1/T2, A1 from T2/T0. */
    const vertices = [
      intersectLines(tangents[1], tangents[2]),
      intersectLines(tangents[2], tangents[0]),
      intersectLines(tangents[0], tangents[1]),
    ];
    const cevians = vertices.map((p, i) => line(p, state.P[i]));
    const meetings = [
      intersectLines(cevians[0], cevians[1]),
      intersectLines(cevians[1], cevians[2]),
      intersectLines(cevians[2], cevians[0]),
    ];
    const G = meetings.every(finite)
      ? {
        x: (meetings[0].x + meetings[1].x + meetings[2].x) / 3,
        y: (meetings[0].y + meetings[1].y + meetings[2].y) / 3,
      }
      : null;
    return { ellipse: e, tangents, vertices, cevians, meetings, G, noDraw: false };
  }

  /**
   * The starting frame and touch points, straight from init(): Rectangle(0,0,w,h),
   * frame at (cx±w/4, cy±h/8), then EllipseAt(π/20, -3π/4, 2π/3).
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    if (o.V && o.P) {
      return {
        view: { width, height },
        V: o.V.map(copy),
        P: o.P.map(copy),
        explored: Boolean(o.explored),
        names: Boolean(o.names),
      };
    }
    const cx = width / 2, cy = height / 2;
    const rx = width / 4, ry = height / 8;
    const V = [
      { x: cx - rx, y: cy + ry },
      { x: cx + rx, y: cy + ry },
      { x: cx + rx, y: cy - ry },
      { x: cx - rx, y: cy - ry },
    ];
    const e = ellipseFrom(V);
    return {
      view: { width, height },
      V,
      P: START_ANGLES.map((t) => pointAt(e, t)),
      explored: false,
      names: false,
    };
  }

  /** Keep a handle inside the drawing area, with a small margin. */
  function clamp(p, state) {
    const view = (state && state.view) || VIEW;
    return {
      x: Math.max(6, Math.min(view.width - 6, p.x)),
      y: Math.max(6, Math.min(view.height - 6, p.y)),
    };
  }

  /**
   * The applet only accepts a frame-corner drag while the pointer is more than
   * 10 px from each centre line (PointIsGood). This is that test as a clamp, so
   * keyboard steps cannot collapse the ellipse either.
   */
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

  /** Move one named handle: V0..V3 reshape the ellipse, A/B/C slide on it. */
  function move(state, name, p) {
    const next = {
      view: { ...state.view }, V: state.V.map(copy), P: state.P.map(copy),
      explored: state.explored, names: state.names,
    };
    if (name[0] === "V") {
      const index = Number(name.slice(1));
      if (!Number.isInteger(index) || index < 0 || index > 3) return next;
      next.V = maintainRect(next.V, index, p);
      next.P = keepAllOnEllipse(ellipseFrom(next.V), next.P);
    } else {
      const index = POINT_NAMES.indexOf(name);
      if (index < 0) return next;
      next.P[index] = keepOnEllipse(ellipseFrom(next.V), p);
    }
    return next;
  }

  const legalMoves = () => ["V0", "V1", "V2", "V3", ...POINT_NAMES];

  /** The page's claims, measured on the current diagram. */
  function claims(state) {
    const g = compute(state);
    const scale = Math.max(1, g.ellipse.center.x, g.ellipse.center.y,
      Math.abs(g.ellipse.A), Math.abs(g.ellipse.B)) * 4;
    const tol = 1e-5 * scale;
    const verticesFinite = g.vertices.length === 3 && g.vertices.every(finite);
    const tangentsFinite = g.tangents.every(Boolean);

    /* Each tangent really touches at its point: the stretched-circle equation. */
    let tangentsTouch = tangentsFinite;
    for (let i = 0; tangentsTouch && i < 3; i++) {
      const l = g.tangents[i], p = state.P[i];
      const test = (q) => Math.abs(
        ((p.x - g.ellipse.center.x) * (q.x - g.ellipse.center.x)) / (g.ellipse.A * g.ellipse.A) +
        ((p.y - g.ellipse.center.y) * (q.y - g.ellipse.center.y)) / (g.ellipse.B * g.ellipse.B) - 1,
      ) < 1e-5;
      tangentsTouch = test(l.p) && test(l.q);
    }

    /* Each triangle corner lies on the two tangents that define it. */
    let verticesOnTangents = verticesFinite && tangentsFinite;
    for (let i = 0; verticesOnTangents && i < 3; i++) {
      const j = (i + 1) % 3;
      verticesOnTangents =
        distToLine(g.vertices[i], g.tangents[j].p, g.tangents[j].q) < tol &&
        distToLine(g.vertices[i], g.tangents[(j + 1) % 3].p, g.tangents[(j + 1) % 3].q) < tol;
    }

    /* Gergonne: all three cevians meet at the point the applet calls G. */
    const meetingsFinite = g.meetings.length === 3 && g.meetings.every(finite);
    const concurrent = Boolean(meetingsFinite && g.G) && g.cevians.every((l) =>
      distToLine(g.G, l.p, l.q) < tol);

    return {
      tangentsTouch, verticesOnTangents, concurrent, verticesFinite,
      meetingsFinite, tangentsFinite, G: g.G, geometry: g,
    };
  }

  /** Status text for the illustration; there is no win or loss. */
  function describe(state) {
    const c = claims(state);
    if (c.geometry.noDraw || !c.tangentsFinite || !c.verticesFinite) {
      return "Keep the three touch points apart so every pair of tangents meets.";
    }
    if (!c.meetingsFinite) {
      return "Two of the lines are nearly parallel here; move a touch point and try again.";
    }
    if (state.explored && c.concurrent) {
      return "The three lines meet at G, the Gergonne point. The ellipse keeps that promise.";
    }
    return `G is at (${Math.round(c.G.x)}, ${Math.round(c.G.y)}). Press Check the theorem to test the third line.`;
  }

  /** The position handed to Track, in board units. */
  function position(state) {
    const c = claims(state);
    return {
      V: state.V.map(copy), P: state.P.map(copy),
      ellipse: c.geometry.ellipse, G: c.G,
      explored: state.explored, names: state.names,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, POINT_NAMES, START_ANGLES,
    ellipseFrom, pointAt, orientation, signedAngle, keepOnEllipse,
    keepAllOnEllipse, maintainRect, line, intersect, intersectLines,
    circleTangent, tangentAt, distToLine, compute, start, clamp, clampCorner,
    move, legalMoves, claims, describe, position, result,
  };
})();
