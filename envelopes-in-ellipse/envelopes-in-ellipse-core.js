"use strict";

/*
 * Envelopes in Ellipse — the geometry of Alexander Bogomolny's applet
 * EnvelopesInEllipse (page "Reflections in Ellipse").
 *
 * A ray leaves T1 on an elliptic mirror towards T2, bounces, and keeps going.
 * The page says there are three cases: through a focus (the ray then alternates
 * between the foci), clear of the focal segment (the chords touch a confocal
 * ellipse), or crossing it (the chords touch a confocal hyperbola).
 *
 * This file is a line-for-line transcription of the arithmetic in
 * EnvelopesInEllipseCanvas.AddReflection and its helpers: CTKEllipse.TangentAt
 * and Intersect (which move the line into a unit circle of radius 1000, cut it
 * there with GeoSDoub.IntersectX/Y, and move the two cuts back), plus
 * GeoSDoub.ReflectPointInLine (rotate about line point m2 by twice the angle
 * with the sign of FindOrientation) and the applet's one-pixel choice in
 * Other(). The initial rectangle corners are width/2 +/- width/3 and
 * height/2 +/- height/3, S sits at angle -pi/4 and T at -pi*random(); this
 * port uses a fixed angle for T so a position can be saved and replayed.
 *
 * No document, no window, no storage: one global, EnvelopesInEllipseCore.
 * The position is plain data; every function returns a new position.
 */
const EnvelopesInEllipseCore = (() => {
  const WIDTH = 400, HEIGHT = 300;        // the applet's "(400 will do)", "(300 will do)"
  const S_ANGLE = -Math.PI / 4;            // init(): EllipseAt(-2.356194490192345)
  const T_ANGLE = -2.1;                    // init(): EllipseAt(-pi*random()), fixed here
  const MIN_HALF = 12;                     // keep the four corners away from the centre
  const UNIT = 1000;                       // CTKEllipse's auxiliary circle radius

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clampAbs = (v) => Math.max(MIN_HALF, Math.abs(v));

  /* GeoSDoub.FindOrientation: sign of the oriented area of triangle A B C. */
  function orientation(a, b, c) {
    const s = cross(b, c) + cross(c, a) + cross(a, b);
    return s > 0 ? 1 : -1;
  }

  /* GeoSDoub.ComputeAngle: the angle at A between B and C (cosine rule). */
  function computeAngle(a, b, c) {
    const num = sqDist(a, b) + sqDist(a, c) - sqDist(b, c);
    const den = 2 * dist(a, b) * dist(a, c);
    if (!(den > 0)) return 0;
    return Math.acos(Math.max(-1, Math.min(1, num / den)));
  }

  /* GeoSDoub.ComputeSignedAngle(A,B,C): used by CTKEllipse.KeepOnEllipse. */
  function signedAngle(a, b, c) {
    let angle = computeAngle(a, b, c);
    const dot = (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
    if (angle > 0.99 && dot < 0) angle = Math.PI;
    return orientation(a, b, c) === 1 ? angle : -angle;
  }

  /* GeoSDoub.Rotate(point, centre, angle, direction), with y growing down. */
  function rotate(p, centre, angle, direction) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const dx = p.x - centre.x, dy = p.y - centre.y;
    return {
      x: centre.x + co * dx - direction * si * dy,
      y: centre.y + direction * si * dx + co * dy,
    };
  }

  /** GeoSDoub.ReflectPointInLine(p, m1, m2). */
  function reflectInLine(p, m1, m2) {
    const angle = computeAngle(m2, p, m1);
    return rotate(p, m2, 2 * angle, orientation(m2, p, m1));
  }

  /* The ellipse held by the four draggable rectangle corners: CTKEllipse's
     constructor and EllipseUpdated, with the bytecode's field names. */
  function ellipseOf(corners) {
    const v = corners;
    return {
      center: { x: (v[0].x + v[1].x) / 2, y: (v[1].y + v[2].y) / 2 },
      a: (v[1].x - v[0].x) / 2,
      b: (v[1].y - v[2].y) / 2,
    };
  }

  function ellipseAt(e, t) {
    return {
      x: e.center.x + e.a * Math.cos(t),
      y: e.center.y + e.b * Math.sin(t),
    };
  }

  /** CTKEllipse.KeepOnEllipse: project a dragged point back onto the ellipse. */
  function keepOnEllipse(e, p) {
    if (!finite(p)) return null;
    const inf = { x: e.center.x + 200, y: e.center.y };
    return ellipseAt(e, signedAngle(e.center, inf, p));
  }

  /** EnvelopesInEllipseCanvas.Compute: the two foci (a circle has them at its centre). */
  function fociOf(e) {
    const a = Math.abs(e.a), b = Math.abs(e.b);
    const big = a <= b ? b : a, small = a <= b ? a : b;
    const c = Math.sqrt(big * big - small * small);
    const finiteC = Number.isFinite(c) ? c : 0;
    if (a <= b) {
      return [
        { x: e.center.x, y: e.center.y - finiteC },
        { x: e.center.x, y: e.center.y + finiteC },
      ];
    }
    return [
      { x: e.center.x - finiteC, y: e.center.y },
      { x: e.center.x + finiteC, y: e.center.y },
    ];
  }

  /** CTKEllipse.TangentAt(p): scaled unit circle, DoubCircle.Tangent, scaled back. */
  function tangentAt(e, p) {
    if (!finite(p)) return null;
    const q = {
      x: (UNIT * (p.x - e.center.x)) / e.a,
      y: (UNIT * (p.y - e.center.y)) / e.b,
    };
    if (Math.abs(Math.sqrt(q.x * q.x + q.y * q.y) - UNIT) > 1) return null;
    /* DoubCircle.Tangent(q) with centre (0,0): (q.x - q.y, q.y + q.x). */
    const t = { x: q.x - q.y, y: q.y + q.x };
    return {
      m1: copy(p),
      m2: {
        x: e.center.x + (t.x * e.a) / UNIT,
        y: e.center.y + (t.y * e.b) / UNIT,
      },
    };
  }

  /* GeoSDoub.IntersectX / IntersectY of a line and the unit circle at (0,0). */
  function circleLineX(m1, m2, r) {
    const m = (m1.x - m2.x) / (m1.y - m2.y); // the applet's local 2
    const b = m2.x - m * m2.y;              // the applet's local 4
    const aa = m * m + 1;                   // local 6
    const bb = m * b;                       // local 8
    const cc = b * b - r * r;               // local 10
    const disc = bb * bb - aa * cc;         // local 12
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
    return [{ x: m * t1 + b, y: t1 }, { x: m * t2 + b, y: t2 }];
  }

  function circleLineY(m1, m2, r) {
    const m = (m1.y - m2.y) / (m1.x - m2.x);
    const b = m2.y - m * m2.x;
    const aa = m * m + 1;
    const bb = m * b;
    const cc = b * b - r * r;
    const disc = bb * bb - aa * cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t1 = (-bb + root) / aa, t2 = (-bb - root) / aa;
    return [{ x: t1, y: m * t1 + b }, { x: t2, y: m * t2 + b }];
  }

  /** CTKEllipse.Intersect(a,b,c): the two cuts of a line with the ellipse. */
  function intersectEllipse(e, coef) {
    const [a, b, c] = coef;
    const s5 = a * e.center.x + b * e.center.y + c;
    const p1 = { x: 0, y: (-s5 / (b * e.b)) * UNIT };
    const p2 = { x: (-s5 / (a * e.a)) * UNIT, y: 0 };
    let cuts = null;
    if (Math.abs(p1.y - p2.y) > 1) cuts = circleLineX(p1, p2, UNIT);
    else if (Math.abs(p1.x - p2.x) > 1) cuts = circleLineY(p1, p2, UNIT);
    if (!cuts) return null;
    return cuts.map((p) => ({
      x: (p.x * e.a) / UNIT + e.center.x,
      y: (p.y * e.b) / UNIT + e.center.y,
    }));
  }

  /** EnvelopesInEllipseCanvas.GetLineCoefs(D, B): a*x + b*y + c = 0. */
  function lineCoefs(D, B) {
    const a = B.y - D.y;
    const dx = B.x - D.x;
    const b = -dx;                       // the bytecode negates local 6 here
    return [a, b, -D.x * a + D.y * dx];
  }

  /** EnvelopesInEllipseCanvas.Other: the cut at least one pixel from p. */
  function other(cuts, p) {
    return dist(cuts[0], p) >= 1 ? cuts[0] : cuts[1];
  }

  /** The new position a new applet opens with. */
  function start(options) {
    const o = options || {};
    const width = Number.isFinite(Number(o.width)) && Number(o.width) >= 4 * MIN_HALF ? Math.trunc(Number(o.width)) : WIDTH;
    const height = Number.isFinite(Number(o.height)) && Number(o.height) >= 4 * MIN_HALF ? Math.trunc(Number(o.height)) : HEIGHT;
    const cx = width / 2, cy = height / 2, hx = width / 3, hy = height / 3;
    const corners = [
      { x: cx - hx, y: cy + hy }, { x: cx + hx, y: cy + hy },
      { x: cx + hx, y: cy - hy }, { x: cx - hx, y: cy - hy },
    ];
    const e = ellipseOf(corners);
    const sAngle = Number.isFinite(Number(o.sAngle)) ? Number(o.sAngle) : S_ANGLE;
    const tAngle = Number.isFinite(Number(o.tAngle)) ? Number(o.tAngle) : T_ANGLE;
    const S = ellipseAt(e, sAngle), T = ellipseAt(e, tAngle);
    return {
      width, height, corners, S, T, points: [copy(S), copy(T)],
      showNames: o.showNames === true, showExtended: o.showExtended === true,
      showReflection: o.showReflection === true,
      moves: 0, explored: false,
    };
  }

  /** Restore the applet's initial position (the page's Reset button). */
  function reset() { return start(); }

  /**
   * EnvelopesInEllipseCanvas.AddReflection, one step:
   *   tangent at the last point, reflect the previous point in it, turn that
   *   image through the last point, cut the ellipse, keep the far intersection.
   */
  function addReflection(s) {
    const n = s.points.length;
    if (n < 2) return s;
    const B = s.points[n - 1], A = s.points[n - 2];
    const e = ellipseOf(s.corners);
    const tangent = tangentAt(e, B);
    if (!tangent) return s;
    const image = reflectInLine(A, tangent.m1, tangent.m2);
    const D = { x: 2 * B.x - image.x, y: 2 * B.y - image.y };
    const cuts = intersectEllipse(e, lineCoefs(D, B));
    if (!cuts) return s;
    const next = other(cuts, B);
    if (!finite(next)) return s;
    return { ...s, points: [...s.points, next], explored: true, moves: s.moves + 1 };
  }

  /** Add one, ten or a hundred reflections, stopping where the applet would. */
  function add(state, count) {
    const n = Math.max(0, Math.min(100, Math.trunc(Number(count) || 1)));
    let next = state;
    for (let i = 0; i < n; i++) {
      const grown = addReflection(next);
      if (grown === next) break;
      next = grown;
    }
    return next;
  }

  /** The applet's Remove last / Remove all: the two starting points stay. */
  function removeLast(state) {
    if (state.points.length <= 2) return state;
    return {
      ...state, points: state.points.slice(0, -1),
      showReflection: false, explored: true, moves: state.moves + 1,
    };
  }

  function removeAll(state) {
    if (state.points.length <= 2 && !state.showReflection) return state;
    return {
      ...state, points: [copy(state.S), copy(state.T)], showReflection: false,
      explored: true, moves: state.moves + 1,
    };
  }

  function withFlag(state, name, on) {
    if (!["showNames", "showExtended", "showReflection"].includes(name)) return state;
    const next = on === true;
    return next === state[name] ? state : { ...state, [name]: next, explored: true, moves: state.moves + 1 };
  }

  /** CTKEllipse.MaintainRect: dragging one corner carries the other three. */
  function setCorner(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index > 3 || !finite(p)) return state;
    const cx = state.width / 2, cy = state.height / 2;
    const hx = clampAbs(cx - p.x), hy = clampAbs(cy - p.y);
    const sx = [-1, 1, 1, -1], sy = [1, 1, -1, -1];
    const corners = sx.map((u, i) => ({ x: cx + u * hx, y: cy + sy[i] * hy }));
    const e = ellipseOf(corners);
    return recompute({
      ...state, corners,
      S: keepOnEllipse(e, state.S), T: keepOnEllipse(e, state.T),
      explored: true, moves: state.moves + 1,
    });
  }

  /** Dragging T1 or T2: CTKEllipse.KeepOnEllipse, then RecomputeReflections. */
  function setRayPoint(state, index, p) {
    if (index !== 0 && index !== 1) return state;
    const e = ellipseOf(state.corners);
    const on = keepOnEllipse(e, p);
    if (!on) return state;
    const S = index === 0 ? on : state.S;
    const T = index === 1 ? on : state.T;
    return recompute({ ...state, S, T, explored: true, moves: state.moves + 1 });
  }

  /** The applet's RecomputeReflections: start with S,T and add them all back. */
  function recompute(state) {
    let next = { ...state, points: [copy(state.S), copy(state.T)] };
    for (let i = 0; i < next.points.length - 2; i++) {
      const grown = addReflection(next);
      if (grown === next) break;
      next = grown;
    }
    return next;
  }

  /** The applet's EnableControls: Remove and Remove all only with bounces. */
  function controlsEnabled(state) { return state.points.length > 2; }

  function segments(state) {
    const out = [];
    for (let i = 0; i + 1 < state.points.length; i++) out.push([state.points[i], state.points[i + 1]]);
    return out;
  }

  /** True when the open segment pq cuts the closed focal segment f1 f2. */
  function crossesFoci(p, q, f1, f2) {
    const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = d(p, q, f1), d2 = d(p, q, f2), d3 = d(f1, f2, p), d4 = d(f1, f2, q);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  /**
   * The page's invariant: reflect F1 in a chord and measure to F2. That
   * distance R is twice the semi-axis of the confocal conic touched by the
   * chord; R > 2c gives an ellipse, R < 2c a hyperbola, R = 2c a focus ray.
   */
  function chordConstant(state, p, q) {
    const e = ellipseOf(state.corners);
    const [f1, f2] = fociOf(e);
    const tangent = { m1: p, m2: q };
    return dist(reflectInLine(f1, tangent.m1, tangent.m2), f2);
  }

  function geometry(state) {
    const e = ellipseOf(state.corners);
    const foci = fociOf(e);
    const c = dist(foci[0], foci[1]) / 2;
    const segs = segments(state);
    const R = segs.length ? chordConstant(state, segs[0][0], segs[0][1]) : 0;
    const tol = Math.max(1e-5, 1e-4 * Math.max(1, c));
    let kind = "unknown";
    if (c < 1e-9) kind = "circle";
    else if (Math.abs(R - 2 * c) <= tol) kind = "focus";
    else kind = R > 2 * c ? "ellipse" : "hyperbola";
    const crossing = segs.some(([p, q]) => crossesFoci(p, q, foci[0], foci[1]));
    return {
      ellipse: e, foci, c, constant: R, semiAxis: R / 2, kind, crossing,
      bounces: Math.max(0, state.points.length - 2),
    };
  }

  /** The proof construction shown when "reflections for a proof" is ticked. */
  function proof(state) {
    const e = ellipseOf(state.corners);
    const [f1, f2] = fociOf(e);
    const p = state.points;
    if (p.length < 3) return null;
    const f1p = reflectInLine(f1, p[0], p[1]);
    const f2p = reflectInLine(f2, p[1], p[2]);
    return {
      f1, f2, f1p, f2p,
      tangent: tangentAt(e, p[1]),
      r1: dist(f1p, f2), r2: dist(f1, f2p),
    };
  }

  /** The status line. There is no win or loss: this is an illustration. */
  function status(state) {
    const g = geometry(state);
    const n = g.bounces;
    const start = n === 0 ? "The ray is ready." : `${n} bounce${n === 1 ? "" : "s"}.`;
    if (g.kind === "focus") return `${start} Each piece passes through a focus, then the other.`;
    if (g.kind === "ellipse") return `${start} Every piece stays clear of the foci and touches a smaller ellipse.`;
    if (g.kind === "hyperbola") return `${start} Every piece crosses between the foci and touches a hyperbola.`;
    return `${start} Drag T1 or T2 to see what the pieces do.`;
  }

  /** The record knows a play has been explored once anything changes. */
  function result(state) { return state.explored ? "done" : null; }

  return {
    WIDTH, HEIGHT, S_ANGLE, T_ANGLE, MIN_HALF, UNIT,
    start, reset, addReflection, add, removeLast, removeAll, withFlag,
    setCorner, setRayPoint, recompute, controlsEnabled,
    ellipseOf, ellipseAt, keepOnEllipse, fociOf, tangentAt, reflectInLine,
    lineCoefs, intersectEllipse, orientation, signedAngle, crossesFoci,
    chordConstant, geometry, proof, segments, status, result,
  };
})();
