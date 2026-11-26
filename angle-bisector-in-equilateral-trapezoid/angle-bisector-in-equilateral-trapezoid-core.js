"use strict";

/*
 * Angle Bisector in an Equilateral (isosceles) Trapezoid, from Alexander
 * Bogomolny's applet AngleBisectorInEquilateralTrapezoid. This is USAMO 2009
 * problem 5: ABCD is a trapezoid with AB || CD inscribed in a circle, G lies
 * inside triangle BCD, rays AG and BG meet the circle again at P and Q, and
 * the line through G parallel to AB meets BD and BC at R and S. Then PQRS is
 * cyclic exactly when BG bisects angle CBD.
 *
 * The code holds the picture as plain points and rebuilds the construction
 * from them: the circumcircle of A, B, C (whose centre lies on the common
 * perpendicular bisector of the two parallel chords, so the reflected
 * fourth vertex is on it too), the second crossings P and Q, and the two
 * intersections R, S of the horizontal through G. The test in
 * porting/check-angle-bisector-in-equilateral-trapezoid.mjs compares all of
 * this with a second, literal transcription of the applet's own Compute()
 * and GetCircle() methods and checks the "if and only if" over many
 * trapezoids.
 *
 * No document, no window, no storage: the page loads this as a plain script
 * and the Node test evaluates it to get the one global defined here.
 */
const AngleBisectorInEquilateralTrapezoidCore = (() => {
  "use strict";

  const EPS = 1e-9;
  const ANGLE_TOL = 1e-6;     // radians, for "BG bisects angle CBD"
  const CYCLE_TOL = 1e-7;     // relative radius error, for "P, Q, R, S cyclic"
  const MIN_DIST = 2;         // the applet refuses to draw when points are < 2px apart
  const VIEW = { width: 400, height: 280 };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Angle at v between v->p and v->q, in radians in [0, PI]. */
  function angle(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y };
    const b = { x: q.x - v.x, y: q.y - v.y };
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (na < EPS || nb < EPS) return 0;
    return Math.acos(clamp((a.x * b.x + a.y * b.y) / (na * nb), -1, 1));
  }

  /** Circumcentre of three points, in the standard determinant form. */
  function circumcenter(A, B, C) {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) < EPS) return null;
    const aa = A.x * A.x + A.y * A.y;
    const bb = B.x * B.x + B.y * B.y;
    const cc = C.x * C.x + C.y * C.y;
    return {
      x: (aa * (B.y - C.y) + bb * (C.y - A.y) + cc * (A.y - B.y)) / d,
      y: (aa * (C.x - B.x) + bb * (A.x - C.x) + cc * (B.x - A.x)) / d,
    };
  }

  /** GetCircle in the applet: circumcentre, radius = mean of the three radii. */
  function circleOf3(A, B, C) {
    const c = circumcenter(A, B, C);
    if (!c) return null;
    return { c, r: (dist(c, A) + dist(c, B) + dist(c, C)) / 3 };
  }

  function lineIntersection(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const den = cross(r, s);
    if (Math.abs(den) < EPS) return null;
    const t = cross({ x: c.x - a.x, y: c.y - a.y }, s) / den;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
  }

  /** Intersections of the infinite line a,b with a circle, by projection. */
  function lineCircle(circle, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const fx = a.x - circle.c.x, fy = a.y - circle.c.y;
    const qa = dx * dx + dy * dy;
    if (qa < EPS) return [];
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - circle.r * circle.r;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return [];
    const root = Math.sqrt(disc);
    return [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]
      .map((t) => ({ x: a.x + dx * t, y: a.y + dy * t }));
  }

  /** The applet's Other(): the crossing that is not the known point. */
  function other(points, known) {
    if (!points.length) return null;
    if (points.length === 1) return points[0];
    return dist(points[0], known) >= 1 ? points[0] : points[1];
  }

  /** Keep G strictly inside triangle BCD (the page's hypothesis). */
  function clampInside(p, B, C, D, margin) {
    const total = cross({ x: C.x - B.x, y: C.y - B.y }, { x: D.x - B.x, y: D.y - B.y });
    const centroid = { x: (B.x + C.x + D.x) / 3, y: (B.y + C.y + D.y) / 3 };
    if (Math.abs(total) < EPS) return centroid;
    let u = cross({ x: C.x - p.x, y: C.y - p.y }, { x: D.x - p.x, y: D.y - p.y }) / total;
    let v = cross({ x: D.x - p.x, y: D.y - p.y }, { x: B.x - p.x, y: B.y - p.y }) / total;
    let w = 1 - u - v;
    const m = margin === undefined ? 0.02 : margin;
    u = Math.max(m, u); v = Math.max(m, v); w = Math.max(m, w);
    const s = u + v + w;
    return {
      x: (u * B.x + v * C.x + w * D.x) / s,
      y: (u * B.y + v * C.y + w * D.y) / s,
    };
  }

  /** Radial projection onto a circle, as MoveablePoint.RestrictToCircle does. */
  function projectOnCircle(p, circle) {
    const dx = p.x - circle.c.x, dy = p.y - circle.c.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS) return { x: circle.c.x + circle.r, y: circle.c.y };
    return { x: circle.c.x + (dx / d) * circle.r, y: circle.c.y + (dy / d) * circle.r };
  }

  function start(options) {
    const w = VIEW.width, h = VIEW.height;
    // Exactly the applet's init(): A=(w/2-w/5, 3h/5), B=(w/2+w/5, A.y),
    // C=(w/2+w/10, h/3), D=(w/2-w/10, C.y), G = barycentre(B,C,D).
    const A = { x: w / 2 - w / 5, y: (3 * h) / 5 };
    const B = { x: w / 2 + w / 5, y: A.y };
    const C = { x: w / 2 + w / 10, y: h / 3 };
    const D = { x: w / 2 - w / 10, y: C.y };
    const G = { x: (B.x + C.x + D.x) / 3, y: (B.y + C.y + D.y) / 3 };
    return {
      A, B, C, D, G,
      options: Object.assign({ names: true, hint: false, mode: "circle" }, options || {}),
      explored: false,
    };
  }

  /** The full construction, or {valid:false} when the applet's guards stop it. */
  function geometry(state) {
    const { A, B, C, D, G } = state;
    const smallest = Math.min(dist(A, B), dist(B, C), dist(C, D),
      dist(G, B), dist(G, A), dist(G, C), dist(G, D));
    if (!(smallest >= MIN_DIST)) return { valid: false, reason: "too-close" };

    const circle = circleOf3(A, B, C);
    if (!circle) return { valid: false, reason: "collinear" };

    // The line through G parallel to AB is horizontal in these coordinates.
    const left = { x: G.x - 1, y: G.y }, right = { x: G.x + 1, y: G.y };
    const R = lineIntersection(B, D, left, right);
    const S = lineIntersection(B, C, left, right);
    if (!R || !S) return { valid: false, reason: "parallel" };

    const P = other(lineCircle(circle, A, G), A);
    const Q = other(lineCircle(circle, B, G), B);
    if (!P || !Q) return { valid: false, reason: "no-crossing" };

    const circleG = circleOf3(Q, P, S);
    const T = lineIntersection(C, D, B, Q);
    return {
      valid: true, A, B, C, D, G, P, Q, R, S, T,
      circle, circleG,
      rsA: { x: G.x - 100, y: G.y },
      rsB: { x: G.x + 100, y: G.y },
      // The applet enables its "hint" only when Q is over the circle centre.
      // For this isosceles trapezoid that is exactly the angle-bisector case.
      finished: Math.abs(Q.x - circle.c.x) < 1,
    };
  }

  /** Normalised distance from S to the circle through P, Q, R. */
  function cyclicResidual(P, Q, R, S) {
    const circle = circleOf3(P, Q, R);
    if (!circle || circle.r < EPS) return NaN;
    return (dist(S, circle.c) - circle.r) / circle.r;
  }

  function measurements(state) {
    const g = geometry(state);
    if (!g.valid) return { valid: false };
    const angleCBG = angle(g.B, g.C, g.G);
    const angleGBD = angle(g.B, g.G, g.D);
    return {
      valid: true,
      angleCBG, angleGBD,
      diff: Math.abs(angleCBG - angleGBD),
      cyclicResidual: cyclicResidual(g.P, g.Q, g.R, g.S),
      qOffset: Math.abs(g.Q.x - g.circle.c.x),
      finished: g.finished,
    };
  }

  /** Does BG bisect CBD, are P Q R S cyclic, and do the two agree? */
  function claims(state) {
    const m = measurements(state);
    if (!m.valid) return { valid: false, bisects: false, cyclic: false, iff: false };
    const bisects = m.diff < ANGLE_TOL;
    const cyclic = Math.abs(m.cyclicResidual) < CYCLE_TOL;
    return {
      valid: true,
      bisects, cyclic,
      iff: bisects === cyclic,
      angleCBG: m.angleCBG, angleGBD: m.angleGBD,
      cyclicResidual: m.cyclicResidual,
      qOffset: m.qOffset,
      finished: m.finished,
    };
  }

  /** "done" is the record's signal that this illustration has been explored. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  function describe(state) {
    const cl = claims(state);
    if (!cl.valid) return "Move the points apart so the circle and the crossing points can be drawn.";
    if (cl.bisects) {
      return "BG cuts angle CBD exactly in half, and P, Q, R, S lie on one circle. The hint is unlocked.";
    }
    return "BG does not cut angle CBD in half, and P, Q, R, S are not on one circle. Press Put G on the bisector to see both happen together.";
  }

  /** A new point, with the applet's two modes and its mirror-image partner. */
  function withPoint(state, name, p) {
    if (["A", "B", "C", "D"].indexOf(name) >= 0) {
      let q = { x: p.x, y: p.y };
      if (state.options.mode === "circle") {
        const g = geometry(state);
        if (g.valid) q = projectOnCircle(q, g.circle);
      }
      const next = Object.assign({}, state, { explored: true });
      if (name === "A" || name === "B") {
        const mid = (state.C.x + state.D.x) / 2;   // AdjustPoint(A,B,C,D)
        next[name] = q;
        next[name === "A" ? "B" : "A"] = { x: 2 * mid - q.x, y: q.y };
      } else {
        const mid = (state.A.x + state.B.x) / 2;   // AdjustPoint(C,D,A,B)
        next[name] = q;
        next[name === "C" ? "D" : "C"] = { x: 2 * mid - q.x, y: q.y };
      }
      next.G = clampInside(next.G, next.B, next.C, next.D);
      return next;
    }
    if (name === "G") {
      return Object.assign({}, state, {
        G: clampInside(p, state.B, state.C, state.D),
        explored: true,
      });
    }
    return state;
  }

  function setOption(state, name, value) {
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: value }),
    });
  }

  function reset(state) {
    return start(state.options);
  }

  /** Foot of the bisector from B on CD; the angle-bisector-theorem split. */
  function bisectorFoot(state) {
    const { B, C, D } = state;
    const BC = dist(B, C), BD = dist(B, D);
    if (BC + BD < EPS) return { x: (C.x + D.x) / 2, y: (C.y + D.y) / 2 };
    return {
      x: (BD * C.x + BC * D.x) / (BC + BD),
      y: (BD * C.y + BC * D.y) / (BC + BD),
    };
  }

  /** Put G on the bisector of angle CBD, t of the way from B to CD. */
  function placeOnBisector(state, t) {
    const f = bisectorFoot(state);
    const s = clamp(t === undefined ? 0.55 : t, 0.02, 0.98);
    return Object.assign({}, state, {
      G: {
        x: state.B.x + (f.x - state.B.x) * s,
        y: state.B.y + (f.y - state.B.y) * s,
      },
      explored: true,
    });
  }

  /** Put G back at the centroid of BCD: inside the triangle, off the bisector. */
  function placeOffBisector(state) {
    const { B, C, D } = state;
    return Object.assign({}, state, {
      G: { x: (B.x + C.x + D.x) / 3, y: (B.y + C.y + D.y) / 3 },
      explored: true,
    });
  }

  function clampToBoard(p) {
    return {
      x: clamp(p.x, 8, VIEW.width - 8),
      y: clamp(p.y, 8, VIEW.height - 8),
    };
  }

  return {
    start, geometry, measurements, claims, result, describe,
    withPoint, setOption, reset, placeOnBisector, placeOffBisector,
    bisectorFoot, clampInside, clampToBoard,
    dist, angle, circumcenter, circleOf3, lineIntersection, lineCircle,
    cyclicResidual, VIEW, EPS, ANGLE_TOL, CYCLE_TOL, MIN_DIST,
  };
})();
