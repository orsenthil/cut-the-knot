"use strict";

/*
 * Coaxal Circles on the Perpendicular Bisector, from Alexander Bogomolny's
 * applet CirclesOnPerpBisector (Geometry section of cut-the-knot.org).
 *
 * ABC is a triangle. O is a point on the perpendicular bisector of BC, and
 * (O) is the circle through B and C centred there. (I) is the circle tangent
 * to AB and AC and internally to (O); (P) is the other such circle, tangent
 * externally to (O) when O lies on the far side of BC from A. S and T mark
 * where the line of centres meets (O). The page's theorem (Unger) says that
 * when (I) is the incircle, such an (O) exists exactly when one of the common
 * internal tangents of (I) and (P) is parallel to BC; the other one is then
 * antiparallel to BC. The chords cut off by AB and AC on every circle through
 * B and C are antiparallel to BC as well.
 *
 * OneOnBisector below follows the applet's bytecode literally: it solves a
 * quadratic in the parameter t along the angle-bisector line, takes the root
 * of smaller absolute value, and makes the radius the mean of the distances
 * from that centre to AB and AC. The internal tangents are built from the
 * internal homothety centre; porting/check-circles-on-perp-bisector.mjs
 * transcribes the applet's inversion construction a second time and checks
 * the two agree.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CirclesOnPerpBisectorCore, so the page loads
 * it with a plain <script> and the Node logic test can load it too. The
 * position is plain data (four draggable points and three display options),
 * so it can be saved and handed to the tutor as it is. Functions return new
 * positions; they never change the one they are given.
 */
const CirclesOnPerpBisectorCore = (() => {
  const W = 360;    // board width, in viewBox units
  const H = 240;    // board height
  const COEF = 0.3; // the applet's opening position along the perpendicular bisector
  const SWEEP = -1.1780972450961724; // the applet's opening angle, -3*pi/8
  const HANDLES = ["A", "B", "C", "O"];
  const OPTIONS = ["showNames", "showTangents", "showHint"];

  /* The opening picture is the applet's Reset(), scaled to our board. */
  function opening() {
    const unit = Math.min(W, H) / 3;
    const cx = W / 2;
    const cy = H / 2;
    const A = {
      x: cx + 1.3 * unit * Math.cos(SWEEP),
      y: cy + 1.3 * unit * Math.sin(SWEEP),
    };
    const B = { x: cx - unit, y: cy * 4 / 3 };
    const C = { x: cx + unit, y: B.y };
    const M = midpoint(B, C);
    const O = prorate(M, perpPoint(M, B, C), 100 * COEF);
    return { A, B, C, O };
  }

  const DEFAULT = opening();

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function copy(p) { return { x: p.x, y: p.y }; }
  function sqDist(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
  function dist(p, q) { return Math.sqrt(sqDist(p, q)); }
  function midpoint(p, q) { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }
  function add(p, q) { return { x: p.x + q.x, y: p.y + q.y }; }
  function sub(p, q) { return { x: p.x - q.x, y: p.y - q.y }; }
  function scale(p, t) { return { x: p.x * t, y: p.y * t }; }
  function dot(p, q) { return p.x * q.x + p.y * q.y; }
  function unit(p) {
    const d = Math.hypot(p.x, p.y);
    return d > 1e-12 ? { x: p.x / d, y: p.y / d } : { x: 0, y: 0 };
  }
  function finite(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }

  /** GeoSDoub.ComputeAngle(A,B,C): the angle at A, in radians. */
  function angleAt(A, B, C) {
    const ab = dist(A, B);
    const ac = dist(A, C);
    if (!ab || !ac) return NaN;
    const cos = (sqDist(A, B) + sqDist(A, C) - sqDist(B, C)) / (2 * ab * ac);
    return Math.acos(clamp(cos, -1, 1));
  }

  /** GeoSDoub.FindOrientation(A,B,C): +1 for a left turn, -1 otherwise. */
  function orientation(A, B, C) {
    const v = C.x * (A.y - B.y) + C.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(about, point, angle, direction). */
  function rotate(about, point, angle, direction) {
    const co = Math.cos(angle);
    const si = Math.sin(angle);
    const dx = point.x - about.x;
    const dy = point.y - about.y;
    return {
      x: about.x + co * dx - direction * si * dy,
      y: about.y + direction * si * dx + co * dy,
    };
  }

  /** GeoSDoub.Intersect of the two lines a-b and c-d (NaN point if parallel). */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (!Number.isFinite(den) || Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
  }

  /** GeoSDoub.FindAngleBisector(A,B,C): where the half-angle ray meets BC. */
  function angleBisectorFoot(A, B, C) {
    const half = angleAt(A, B, C) / 2;
    const turned = rotate(A, B, half, orientation(A, B, C));
    return intersect(A, turned, B, C);
  }

  /** GeoSDoub.NearestPoint(p,a,b): the perpendicular foot on the line ab. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.1) return copy(p);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** CTKGeometryPlus.Prorate(A,B,t): A plus t units towards B. */
  function prorate(A, B, t) {
    const d = dist(A, B);
    if (d < 0.1) return copy(A);
    const k = t / d;
    return { x: A.x + k * (B.x - A.x), y: A.y + k * (B.y - A.y) };
  }

  /** CTKGeometryPlus.Perp(mid,B,C): a point making a perpendicular at mid. */
  function perpPoint(mid, B, C) {
    return { x: mid.x + (B.y - C.y) * 10, y: mid.y - (B.x - C.x) * 10 };
  }

  /** Project a point onto the perpendicular bisector of BC, staying on it. */
  function onBisector(state, q) {
    const M = midpoint(state.B, state.C);
    const dir = unit(sub(perpPoint(M, state.B, state.C), M));
    if (!dir.x && !dir.y) return { x: M.x, y: M.y };
    // Clamp the distance along the line, not each coordinate separately: a
    // corner clamp would push O off the perpendicular bisector.
    let lo = -H * 4, hi = H * 4;
    for (const [axis, size] of [["x", W], ["y", H]]) {
      const step = dir[axis];
      if (Math.abs(step) < 1e-12) {
        if (M[axis] < 4 || M[axis] > size - 4) return { x: M.x, y: M.y };
        continue;
      }
      const a = (4 - M[axis]) / step;
      const b = (size - 4 - M[axis]) / step;
      lo = Math.max(lo, Math.min(a, b));
      hi = Math.min(hi, Math.max(a, b));
    }
    if (lo > hi) return { x: M.x, y: M.y };
    const t = clamp(dot(sub(q, M), dir), lo, hi);
    return { x: M.x + dir.x * t, y: M.y + dir.y * t };
  }

  /** GeoSDoub.Intersect(DoubLine,DoubCircle): crossings of line p-q with c. */
  function lineCircle(p, q, c) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const a = dx * dx + dy * dy;
    if (a < 1e-12) return [];
    const fx = p.x - c.x, fy = p.y - c.y;
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [
      { x: p.x + (-b - s) / (2 * a) * dx, y: p.y + (-b - s) / (2 * a) * dy },
      { x: p.x + (-b + s) / (2 * a) * dx, y: p.y + (-b + s) / (2 * a) * dy },
    ];
  }

  /** Of two crossings of a circle with a line, the one that is not `known`. */
  function other(pts, known) {
    if (!pts || pts.length < 2) return null;
    return dist(pts[0], known) >= dist(pts[1], known) ? pts[0] : pts[1];
  }

  /**
   * Canvas.OneOnBisector(sign), from javap -c. sign=1 gives (I), sign=-1 gives
   * (P). It returns null when the quadratic has no real roots.
   */
  function oneOnBisector(A, B, C, O, radius, footOnBC, half, sign) {
    const u = sub(A, footOnBC);       // Bisector.m_1 - Bisector.m_2
    const p = sub(A, O);              // A - Circle
    const u2 = dot(u, u);
    const a = u2 * Math.cos(half) ** 2;
    const b = dot(u, p) - sign * radius * Math.sqrt(u2) * Math.sin(half);
    const c = dot(p, p) - radius * radius;
    if (Math.abs(a) < 0.01) return null;
    const disc = b * b - a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const r0 = (-b + s) / a;
    const r1 = (-b - s) / a;
    // The applet picks the root nearer A; ties go to the second root.
    const t = Math.abs(r0) < Math.abs(r1) ? r0 : r1;
    const centre = { x: A.x + t * u.x, y: A.y + t * u.y };
    const r = (dist(centre, foot(centre, A, B)) + dist(centre, foot(centre, A, C))) / 2;
    return { x: centre.x, y: centre.y, r, t };
  }

  /**
   * The two common internal tangents of two circles. Their intersection is
   * the internal homothety centre, so each tangent is the line through that
   * point and a tangency point on either circle. `a` and `b` are points on one
   * tangent line; `dir` is its direction.
   */
  function internalTangents(c1, c2) {
    const r1 = c1.r, r2 = c2.r, sum = r1 + r2;
    if (!(sum > 0) || dist(c1, c2) <= sum) return [];
    const H = {
      x: (r2 * c1.x + r1 * c2.x) / sum,
      y: (r2 * c1.y + r1 * c2.y) / sum,
    };
    const reach = Math.sqrt(Math.max(0, sqDist(H, c1) - r1 * r1));
    const pts = circleIntersection(c1, r1, H, reach);
    return pts.map((p) => {
      const q = { x: c2.x - (p.x - c1.x) * r2 / r1, y: c2.y - (p.y - c1.y) * r2 / r1 };
      return { a: p, b: q, dir: unit(sub(q, p)) };
    });
  }

  /** Intersections of two circles (the standard symmetric formula). */
  function circleIntersection(c1, r1, c2, r2) {
    const d = dist(c1, c2);
    if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const base = { x: c1.x + (c2.x - c1.x) * a / d, y: c1.y + (c2.y - c1.y) * a / d };
    if (h < 1e-9) return [base];
    const nx = -(c2.y - c1.y) / d, ny = (c2.x - c1.x) / d;
    return [
      { x: base.x + nx * h, y: base.y + ny * h },
      { x: base.x - nx * h, y: base.y - ny * h },
    ];
  }

  /** The incircle of ABC, used to tell when the theorem's hypothesis holds. */
  function incircle(A, B, C) {
    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const per = a + b + c;
    const centre = {
      x: (a * A.x + b * B.x + c * C.x) / per,
      y: (a * A.y + b * B.y + c * C.y) / per,
    };
    const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
    return { x: centre.x, y: centre.y, r: 2 * area / per };
  }

  /** Reflect the direction BC in the angle bisector at A (antiparallel). */
  function antiparallel(A, footOnBC, B, C) {
    const u = unit(sub(footOnBC, A));
    const v = unit(sub(C, B));
    const k = 2 * dot(v, u);
    return unit({ x: k * u.x - v.x, y: k * u.y - v.y });
  }

  /** How far a tangent line is from being parallel to a direction. */
  function parallelCross(line, direction) {
    const a = unit(line.dir || sub(line.b, line.a));
    const b = unit(direction);
    return Math.abs(a.x * b.y - a.y * b.x);
  }

  /** True when O is on the opposite side of BC from A. */
  function farSide(A, B, C, O) {
    const side = (p) => (C.x - B.x) * (p.y - B.y) - (C.y - B.y) * (p.x - B.x);
    return side(A) * side(O) < 0;
  }

  /** The whole construction, or { valid:false } when it cannot be drawn. */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C, O = state.O;
    const M = midpoint(B, C);
    const R = (dist(O, B) + dist(O, C)) / 2;
    const circle = { x: O.x, y: O.y, r: R };
    const footOnBC = angleBisectorFoot(A, B, C);
    const half = angleAt(A, B, C) / 2;
    const bad = !finite(footOnBC) || !Number.isFinite(R) || !Number.isFinite(half) || R < 1e-6;
    if (bad) {
      return {
        valid: false, A, B, C, O, M, circle, footOnBC: null, half,
        I: null, P: null, S: null, T: null, tangents: [], chord: null,
        antiparallel: null, tangentParallel: false,
      };
    }
    const I = oneOnBisector(A, B, C, O, R, footOnBC, half, 1);
    const P = oneOnBisector(A, B, C, O, R, footOnBC, half, -1);
    const S = I ? prorate(O, I, R) : null;
    const T = P ? prorate(O, P, R) : null;
    const tangents = I && P ? internalTangents(I, P) : [];
    const D = other(lineCircle(A, B, circle), B);
    const E = other(lineCircle(A, C, circle), C);
    const chord = D && E ? { a: D, b: E, dir: unit(sub(E, D)) } : null;
    const anti = antiparallel(A, footOnBC, B, C);
    const bc = sub(C, B);
    return {
      valid: !!I && !!P, A, B, C, O, M, circle, footOnBC, half,
      I, P, S, T, tangents, chord, antiparallel: anti,
      tangentParallel: tangents.some((line) => parallelCross(line, bc) < 1e-7),
      tangentAntiparallel: tangents.some((line) => parallelCross(line, anti) < 1e-7),
      stLine: S && T ? { a: S, b: T, dir: unit(sub(T, S)) } : null,
      farSide: farSide(A, B, C, O),
    };
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const o = options || {};
    const take = (name) => (o[name] && Number.isFinite(o[name].x) && Number.isFinite(o[name].y)
      ? copy(o[name]) : copy(DEFAULT[name]));
    const s = {
      A: take("A"), B: take("B"), C: take("C"), O: take("O"),
      showNames: o.showNames !== false,
      showTangents: !!o.showTangents,
      showHint: !!o.showHint,
      moves: 0,
      toggles: 0,
    };
    s.O = onBisector(s, s.O);
    return s;
  }

  /** The four draggable points. */
  function legalMoves() { return HANDLES.slice(); }

  /** The position after dragging one point, or null if the move is refused. */
  function move(state, m) {
    if (!m) return null;
    const name = m.name || m.point;
    if (typeof name !== "string" || HANDLES.indexOf(name) < 0) return null;
    const p = m.point && typeof m.point === "object" ? m.point : { x: m.x, y: m.y };
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const next = Object.assign({}, state);
    next[name] = {
      x: clamp(p.x, 4, W - 4),
      y: clamp(p.y, 4, H - 4),
    };
    if (name === "O") next.O = onBisector(state, next.O);
    next.moves = state.moves + 1;
    return next;
  }

  /** A small arrow-key step for one point. */
  function nudge(state, name, dx, dy) {
    const p = state[name];
    if (!p) return null;
    return move(state, { name, x: p.x + dx, y: p.y + dy });
  }

  /** Slide O along the perpendicular bisector by `step` units. */
  function slideO(state, step) {
    const M = midpoint(state.B, state.C);
    const dir = unit(sub(perpPoint(M, state.B, state.C), M));
    return move(state, { name: "O", x: state.O.x + dir.x * step, y: state.O.y + dir.y * step });
  }

  /** Set the three display options; toggling one counts as exploring. */
  function setOptions(state, opts) {
    const next = Object.assign({}, state);
    let toggled = false;
    OPTIONS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(opts, k)) {
        const v = !!opts[k];
        if (v !== state[k]) toggled = true;
        next[k] = v;
      }
    });
    if (toggled) next.toggles = state.toggles + 1;
    return next;
  }

  /** Put the four points back, keeping the display options and the counters. */
  function reset(state) {
    const fresh = start({
      showNames: state.showNames,
      showTangents: state.showTangents,
      showHint: state.showHint,
    });
    fresh.moves = state.moves;
    fresh.toggles = state.toggles;
    return fresh;
  }

  /** A demo has no win or loss; it is done once it has been explored. */
  function result(state) {
    return state.moves > 0 && state.toggles > 0 ? "done" : null;
  }

  return {
    start, legalMoves, move, nudge, slideO, setOptions, reset, result, geometry,
    angleAt, orientation, rotate, intersect, angleBisectorFoot, foot, prorate,
    perpPoint, onBisector, lineCircle, other, oneOnBisector, internalTangents,
    circleIntersection, incircle, antiparallel, parallelCross, farSide,
    dist, sqDist, midpoint, unit, add, sub, scale, dot, clamp, finite,
    W, H, COEF, HANDLES, OPTIONS, DEFAULT,
  };
})();
