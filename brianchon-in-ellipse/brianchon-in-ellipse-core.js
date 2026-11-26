"use strict";

/*
 * Brianchon in Ellipse — the geometry behind Bogomolny's illustration.
 *
 * Six points A..F are dragged on an ellipse. The tangents at neighbouring
 * points meet in the six vertices of a hexagon circumscribed about the ellipse:
 *   AB = tangent(A) ∩ tangent(B), BC = tangent(B) ∩ tangent(C), ... , FA.
 * The three lines joining opposite vertices of that hexagon,
 *   AB—DE,  BC—EF,  CD—FA,
 * always pass through one point S. That is Brianchon's theorem. The applet also
 * lets you drag the four corners of the rectangle that fixes the ellipse; each
 * corner mirrors across the centre, and all six points are snapped back onto
 * the new ellipse.
 *
 * The one idea the code relies on: the applet draws the ellipse as a unit
 * circle that has been stretched by (A, B) and shifted by its centre. A tangent
 * to the circle at u = 1000·((p.x-cx)/A, (p.y-cy)/B), mapped back, is the
 * tangent to the ellipse at p. Intersecting lines then uses the applet's own
 * Cramer solve, with its "|det| < 1 means NaN" guard.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BrianchonCore, so the page loads it with a plain
 * <script> and porting/check-brianchon-in-ellipse.mjs loads it in Node.
 * The position is plain data (numbers, arrays and plain objects), and every
 * function takes a position and returns new values; nothing passed in changes.
 */
const BrianchonCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 400, height: 300 };
  /* The six angles passed to CTKEllipse.EllipseAt in the applet's init(). */
  const START_ANGLES = [
    -2.356194490192345,        // -3π/4
    -1.4279966607226333,
    -0.5235987755982988,       // -π/6
    1.0471975511965976,        // π/3
    1.7135959928671598,
    2.356194490192345,         // 3π/4
  ];
  const POINT_NAMES = ["A", "B", "C", "D", "E", "F"];

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const copy = (p) => ({ x: p.x, y: p.y });

  /** CTKEllipse(MoveablePoint[]): centre from V0/V1 and V1/V2, A and B from V0/V1 and V1/V2. */
  function ellipseFrom(V) {
    const center = { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 };
    return {
      center,
      /* GeoSDoub.ComputeSignedAngle(center, Inf, u) uses Inf 200 units right of
         the centre. The applet keeps that point in CTKEllipse.Inf. */
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

  /** CTKEllipse.KeepAllOnEllipse, called after a rectangle corner moves. */
  function keepAllOnEllipse(e, points) {
    return points.map((p) => keepOnEllipse(e, p));
  }

  /**
   * CTKEllipse.MaintainRect: the dragged rectangle corner is mirrored across
   * both centre lines, so the ellipse's centre never moves.
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
   * GeoSDoub.Intersect(a,b,c,d) from the bytecode: line coefficients
   * (a.y-b.y)x + (b.x-a.x)y + (a.x*b.y-a.y*b.x), solved with Cramer's rule.
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
   * BrianchonInEllipseCanvas.Compute: six tangents, six tangent intersections,
   * three main diagonals, and S = ABDE ∩ BCEF when that point is finite.
   */
  function compute(state) {
    const e = ellipseFrom(state.V);
    const tangents = state.P.map((p) => tangentAt(e, p));
    const at = (i) => tangents[i] && tangents[i].p;
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const l = tangents[i], m = tangents[(i + 1) % 6];
      vertices.push(l && m ? intersectLines(l, m) : { x: NaN, y: NaN });
    }
    const diagonals = [
      line(vertices[0], vertices[3]),
      line(vertices[1], vertices[4]),
      line(vertices[2], vertices[5]),
    ];
    const raw = intersectLines(diagonals[0], diagonals[1]);
    const S = Number.isFinite(raw.x) && Number.isFinite(raw.y) ? raw : null;
    return {
      ellipse: e, tangents, vertices, diagonals, S,
      tangentPoints: state.P.map(at),
    };
  }

  /** The starting rectangle and the six points at the applet's six angles. */
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
    const rx = width / 5, ry = height / 5;
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
   * The applet only accepts a rectangle-corner drag while the pointer is more
   * than 10 px from each centre line (PointIsGood). This is that test as a
   * clamp, so keyboard steps cannot collapse the ellipse either.
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

  /** Move one named handle: V0..V3 reshape the ellipse, A..F slide on it. */
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

  /** The page's claims, measured on the current diagram. */
  function claims(state) {
    const g = compute(state);
    const scale = Math.max(1, g.ellipse.center.x, g.ellipse.center.y,
      Math.abs(g.ellipse.A), Math.abs(g.ellipse.B)) * 4;
    const tol = 1e-5 * scale;
    const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
    const verticesFinite = g.vertices.every(finite);
    const tangentsFinite = g.tangents.every(Boolean);

    /* Each tangent really touches at its point: the stretched-circle equation. */
    let tangentsTouch = tangentsFinite;
    for (let i = 0; tangentsTouch && i < 6; i++) {
      const l = g.tangents[i], p = state.P[i];
      const test = (q) =>
        Math.abs(((p.x - g.ellipse.center.x) * (q.x - g.ellipse.center.x)) / (g.ellipse.A * g.ellipse.A) +
          ((p.y - g.ellipse.center.y) * (q.y - g.ellipse.center.y)) / (g.ellipse.B * g.ellipse.B) - 1) < 1e-5;
      tangentsTouch = test(l.p) && test(l.q);
    }

    /* Each hexagon vertex lies on the two tangents that define it. */
    let verticesOnTangents = verticesFinite && tangentsFinite;
    for (let i = 0; verticesOnTangents && i < 6; i++) {
      const j = (i + 1) % 6;
      verticesOnTangents =
        distToLine(g.vertices[i], g.tangents[i].p, g.tangents[i].q) < tol &&
        distToLine(g.vertices[i], g.tangents[j].p, g.tangents[j].q) < tol;
    }

    /* Brianchon: the first two diagonals meet, and S lies on the third. */
    const concurrent = Boolean(g.S && verticesFinite) &&
      distToLine(g.S, g.diagonals[2].p, g.diagonals[2].q) < tol;

    return {
      tangentsTouch, verticesOnTangents, concurrent, verticesFinite, tangentsFinite,
      S: g.S, geometry: g,
    };
  }

  /** Status text for the illustration; no win or loss is possible. */
  function describe(state) {
    const c = claims(state);
    if (!c.geometry.tangents.every(Boolean) || !c.verticesFinite) {
      return "Move the touching points apart so every pair of tangents meets.";
    }
    if (!c.S) {
      return "The first two diagonals are nearly parallel here; move a point and try again.";
    }
    if (state.explored && c.concurrent) {
      return "The three diagonals meet at one point S. Brianchon's theorem holds for this ellipse.";
    }
    return `S is at (${Math.round(c.S.x)}, ${Math.round(c.S.y)}). Press Check the theorem to test the third diagonal.`;
  }

  /** The position handed to Track, in board units. */
  function position(state) {
    const c = claims(state);
    return {
      V: state.V.map(copy), P: state.P.map(copy),
      ellipse: c.geometry.ellipse,
      S: c.S, explored: state.explored, names: state.names,
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
    tangentAt, distToLine, compute, start, clamp, clampCorner, move,
    claims, describe, position, result,
  };
})();
