"use strict";

/*
 * BOL1 — Proposition 1 of Archimedes' Book of Lemmas, as Bogomolny's Java
 * applet drew it. Two circles pass through a common point A; CD is a diameter
 * of the small circle and EF is a parallel diameter of the large one. When the
 * circles touch at A (A, O2, O1 on one line), A, D and F lie on one straight
 * line. Dragging A, O1 or O2 changes both circles; dragging C turns the two
 * diameters together.
 *
 * The one idea the code relies on: if u is the unit vector from the small
 * centre O2 to C and the circles touch at A, then O1 = A + r1*w and
 * O2 = A + r2*w for one unit vector w (the internal case has r1 > r2 > 0).
 * So D = A + r2*(w - u), F = A + r1*(w - u) — the same direction from A —
 * and E = A + r1*(w + u), C = A + r2*(w + u). The vector w - u is shared,
 * which is exactly the collinearity. For externally tangent circles the
 * centres lie on opposite sides of A: the applet's labels give A, C, F and
 * A, D, E as the collinear triples instead (see the maths section).
 *
 * The point placement, Extend, GetParallelTo and the E/F choice below follow
 * BOL1Canvas.init / AdjustCircles / AdjustC and GetSecondDiameter from the
 * bytecode. This file is the logic and nothing else: no document, no window,
 * no storage. One global, Bol1Core, plain data in and out; nothing passed in
 * is changed.
 */
const Bol1Core = (() => {
  const EPS = 1e-9;
  const WIDTH = 600;
  const HEIGHT = 450;
  const GAP = 20;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const copy = (p) => ({ x: p.x, y: p.y });

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n < EPS ? null : { x: v.x / n, y: v.y / n };
  }

  /** |sin of the angle| between the rays from v to p and to q. */
  function straightness(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (na < EPS || nb < EPS) return Infinity;
    return Math.abs(cross(a, b)) / (na * nb);
  }

  /** GeoSDoub.GetParallelTo(p, a, b) = p + 100*(a - b). */
  function parallelThrough(p, a, b) {
    return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
  }

  /** BOL1Canvas.AdjustC: put p on the circle, preserving its direction. */
  function onCircle(center, radius, p) {
    const d = distance(center, p);
    if (d < 0.1) {
      // The applet draws a random angle here; a fixed one keeps the record
      // reproducible and has no bearing on the proposition.
      return { x: center.x + radius, y: center.y };
    }
    const t = radius / d;
    return { x: center.x + t * (p.x - center.x), y: center.y + t * (p.y - center.y) };
  }

  /** The starting picture of BOL1Canvas.init on its 600x450 applet. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    if (o.points) {
      return {
        width, height,
        A: copy(o.points.A), O1: copy(o.points.O1),
        O2: copy(o.points.O2), C: copy(o.points.C),
      };
    }
    const cx = width / 2;
    const A = { x: cx, y: GAP };
    const O1 = { x: cx, y: height / 2 };
    const O2 = { x: cx, y: height / 2 - 3 * GAP };
    const r2 = distance(A, O2);
    const C = onCircle(O2, r2, { x: 0, y: height });
    return { width, height, A, O1, O2, C };
  }

  /** The radii follow A whenever A, O1 or O2 moves (AdjustCircles). */
  function radii(s) {
    return { r1: distance(s.A, s.O1), r2: distance(s.A, s.O2) };
  }

  /**
   * One named point moved. Moving A, O1 or O2 rebuilds both circles and puts
   * C back on the new small circle, as the applet's mouseDragged does.
   * Moving C keeps it on that circle (RestrictToCircle).
   */
  function withPoint(s, name, p) {
    const next = {
      width: s.width, height: s.height,
      A: copy(s.A), O1: copy(s.O1), O2: copy(s.O2), C: copy(s.C),
    };
    if (!next[name]) return next;
    next[name] = copy(p);
    const { r2 } = radii(next);
    next.C = onCircle(next.O2, r2, next.C);
    return next;
  }

  /** BOL1Canvas.Extend(C, O2) = 2*O2 - C: the other end of the diameter. */
  function extend(p, center) {
    return { x: 2 * center.x - p.x, y: 2 * center.y - p.y };
  }

  /**
   * The two parallel diameters, with the applet's naming rule: E is the end
   * of the large circle's diameter pointing the same way as C from O2, and F
   * is its opposite. Null when either circle has shrunk to a point.
   */
  function diameters(s) {
    const { r1, r2 } = radii(s);
    const u = unit(sub(s.C, s.O2));
    if (!u || r1 < EPS || r2 < EPS) return null;
    const E = add(s.O1, mul(u, r1));
    const F = sub(s.O1, mul(u, r1));
    return { C: copy(s.C), D: extend(s.C, s.O2), E, F };
  }

  /** Intersection of the infinite lines a->b and c->d, or null if parallel. */
  function lineIntersection(a, b, c, d) {
    const r = sub(b, a), t = sub(d, c);
    const den = cross(r, t);
    if (Math.abs(den) < EPS) return null;
    const k = cross(sub(c, a), t) / den;
    return add(a, mul(r, k));
  }

  /** The point H of the page's proof, drawn by BOL1Canvas.ShowHint. */
  function hint(s, dm) {
    if (!dm) return null;
    const Q = parallelThrough(dm.D, s.A, s.O2);
    return lineIntersection(dm.D, Q, dm.E, dm.F);
  }

  /** Are the three points on one line, to a relative tolerance? */
  function collinear(p, q, r, tol) {
    return straightness(p, q, r) <= (tol === undefined ? 1e-7 : tol);
  }

  /** True when A, O1 and O2 are on a line, i.e. the circles touch at A. */
  function tangent(s, tol) {
    return collinear(s.A, s.O1, s.O2, tol === undefined ? 1e-7 : tol);
  }

  /** "in" when both centres are on the same side of A, "out" otherwise. */
  function touchKind(s) {
    if (!tangent(s)) return "none";
    return dot(sub(s.O1, s.A), sub(s.O2, s.A)) > 0 ? "in" : "out";
  }

  /** Each claim of the applet's page at this configuration. */
  function claims(s) {
    const dm = diameters(s);
    const { r1, r2 } = radii(s);
    const scale = Math.max(r1, r2, 1);
    const tol = 1e-7;
    const on = (p, center, radius) =>
      Boolean(p) && Math.abs(distance(p, center) - radius) <= tol * scale;
    const kind = touchKind(s);
    const H = hint(s, dm);
    const eq = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * scale;
    return {
      tangent: kind !== "none",
      // CD and EF really are parallel diameters of their two circles.
      diameters: Boolean(dm) &&
        on(dm.C, s.O2, r2) && on(dm.D, s.O2, r2) &&
        on(dm.E, s.O1, r1) && on(dm.F, s.O1, r1) &&
        collinear(dm.C, s.O2, dm.D, tol) && collinear(dm.E, s.O1, dm.F, tol),
      parallel: Boolean(dm) &&
        Math.abs(cross(sub(dm.D, dm.C), sub(dm.F, dm.E))) <= tol * scale * scale,
      // The proposition itself, when the two circles touch internally.
      adf: kind === "in" && Boolean(dm) && collinear(s.A, dm.D, dm.F, tol),
      ace: kind === "in" && Boolean(dm) && collinear(s.A, dm.C, dm.E, tol),
      // For external touch the applet's names pair up the other way.
      externalPairs: kind === "out" && Boolean(dm) &&
        collinear(s.A, dm.C, dm.F, tol) && collinear(s.A, dm.D, dm.E, tol),
      // Lengths in the page's hint construction (internal configuration).
      hintLengths: kind === "in" && Boolean(dm) && Boolean(H) &&
        eq(distance(s.O1, H), r2) && eq(distance(s.O2, dm.D), r2) &&
        eq(distance(s.O2, s.A), r2) && eq(distance(H, dm.F), Math.abs(r1 - r2)) &&
        eq(distance(s.O1, s.O2), Math.abs(r1 - r2)) &&
        eq(distance(dm.D, H), Math.abs(r1 - r2)),
    };
  }

  /** An illustration: there is no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    WIDTH, HEIGHT, GAP, EPS,
    add, sub, mul, distance, dot, cross, copy, unit, straightness,
    parallelThrough, onCircle, start, radii, withPoint, extend, diameters,
    lineIntersection, hint, collinear, tangent, touchKind, claims, result,
  };
})();
