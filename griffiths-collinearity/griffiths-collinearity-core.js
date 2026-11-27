"use strict";

/*
 * Pedal Collinearities, from Alexander Bogomolny's applet GriffithsCollinearity.
 *
 * A straight line (the applet's MoveableLineAdvanced) cuts the three sides of
 * triangle ABC at P, Q and R. From each of P, Q and R we drop a perpendicular
 * to each of the three sides; the three feet lie on a pedal circle. The page
 * claims that these three circles are coaxal: they have two common points and
 * their centres are collinear. Griffiths' theorem is the special case where
 * the line goes through the circumcentre; this applet lets the line go anywhere.
 *
 * The code follows the applet's Compute() chain literally: GeoSDoub.Intersect
 * for the side/line crossings, NearestPoint for the feet, GetCircle
 * (FindCircumcenter plus the mean of the three radii), FindAxis through
 * CTKGeometryPlus.DefineLine and GeoSDoub.Intersect of the first two circles
 * for the common points. No DOM, no window, one global; the page and
 * porting/check-griffiths-collinearity.mjs both load this file.
 */
const GriffithsCollinearityCore = (() => {
  // The page embeds the applet with WIDTH=500 HEIGHT=400 (its own default is
  // 400 by 250). The old canvas actually lost a few pixels to the checkbox
  // row; the construction does not depend on that difference.
  const VIEW = { width: 500, height: 400 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDistance = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const distanceToLine = (p, a, b) =>
    distance(a, b) < 1e-12 ? distance(p, a) : Math.abs(cross(a, b, p)) / distance(a, b);

  function clampPoint(p) {
    return {
      x: clamp(Number(p.x) || 0, 0, VIEW.width),
      y: clamp(Number(p.y) || 0, 0, VIEW.height),
    };
  }

  /** GeoSDoub.Intersect(DoubLine, DoubLine): NaN coordinates for |det| < 1. */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (c1 * a2 - c2 * a1) / det;
    return { x, y };
  }

  /** GeoSDoub.NearestPoint: the foot on ab, or p itself for a side under sqrt(0.1). */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** GeoSDoub.FindCircumcenter, then GetCircle's mean of the three radii. */
  function circleOf(a, b, c) {
    if (!a || !b || !c) return null;
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const d1 = sub(b, a), d2 = sub(c, b);
    const det = d1.x * d2.y - d1.y * d2.x;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    const q = sub(m2, m1);
    const t = (q.x * d2.x + q.y * d2.y) / det;
    const centre = { x: m1.x - d1.y * t, y: m1.y + d1.x * t };
    const r = (distance(centre, a) + distance(centre, b) + distance(centre, c)) / 3;
    return Number.isFinite(r) ? { c: centre, r } : null;
  }

  /** The circle through the three side midpoints (used only in the maths). */
  function ninePointCircle(a, b, c) {
    return circleOf(midpoint(a, b), midpoint(b, c), midpoint(c, a));
  }

  /** GeoSDoub.Intersect(DoubCircle, DoubCircle), written as a quadratic. */
  function circleIntersections(c0, r0, c1, r1) {
    if (![c0.x, c0.y, c1.x, c1.y, r0, r1].every(Number.isFinite)) return [];
    const dx = c1.x - c0.x, dy = c1.y - c0.y;
    const d = Math.hypot(dx, dy);
    if (!d || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - a * a;
    if (h2 < -1e-7) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const ux = dx / d, uy = dy / d;
    const base = { x: c0.x + ux * a, y: c0.y + uy * a };
    if (h < 1e-9) return [base];
    return [
      { x: base.x - uy * h, y: base.y + ux * h },
      { x: base.x + uy * h, y: base.y - ux * h },
    ];
  }

  /** InsideTest.IsInside(a,b,c): the angle at a is at least a right angle. */
  function inside(a, b, c) {
    return (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y) <= 0;
  }

  /** CTKGeometryPlus.DefineLine: choose the pair that spans the three centres. */
  function defineLine(p0, p1, p2) {
    if (inside(p1, p0, p2)) return [p0, p2];
    if (inside(p2, p0, p1)) return [p0, p1];
    return [p1, p2];
  }

  /** DoubLine.SetBounds / MoveableLineAdvanced.SqueezeIn: line on the border. */
  function clipLine(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) < 1e-12) return [a, b];
    let lo = -Infinity, hi = Infinity;
    if (Math.abs(dx) >= 1e-12) {
      const t0 = -a.x / dx, t1 = (VIEW.width - a.x) / dx;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
    if (Math.abs(dy) >= 1e-12) {
      const t0 = -a.y / dy, t1 = (VIEW.height - a.y) / dy;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [a, b];
    return [
      { x: a.x + dx * lo, y: a.y + dy * lo },
      { x: a.x + dx * hi, y: a.y + dy * hi },
    ];
  }

  /** The line's two border points from Canvas.init(). */
  function initialLine() {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const s = Math.min(VIEW.width, VIEW.height) / 5;
    const p = { x: cx + 2.5 * s * Math.cos(-3.6), y: cy + 2.5 * s * Math.sin(-3.6) };
    return clipLine(p, { x: VIEW.width - p.x, y: VIEW.height - p.y });
  }

  /** The starting triangle from Canvas.init(). */
  function start(options) {
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const s = Math.min(VIEW.width, VIEW.height) / 5;
    const at = (angle, scale) => ({ x: cx + scale * s * Math.cos(angle), y: cy + scale * s * Math.sin(angle) });
    return {
      A: at(-1.6, 1), B: at(-4.0, 1), C: at(0.5, 1.1),
      line: initialLine(),
      options: Object.assign({ names: true, circles: false, perps: false }, options || {}),
      explored: false,
    };
  }

  /** Move a triangle vertex, rotate a line end, or slide the whole line. */
  function move(state, name, point) {
    if (!["A", "B", "C", "line1", "line2", "lineMid"].includes(name)) return state;
    const p = clampPoint(point);
    const next = Object.assign({}, state, { explored: true });
    if (name === "A" || name === "B" || name === "C") {
      next[name] = p;
    } else if (name === "line1") {
      next.line = clipLine(p, state.line[1]);
    } else if (name === "line2") {
      next.line = clipLine(state.line[0], p);
    } else {
      const before = midpoint(state.line[0], state.line[1]);
      const d = sub(p, before);
      next.line = clipLine(add(state.line[0], d), add(state.line[1], d));
    }
    return next;
  }

  function setOption(state, name, value) {
    if (!["names", "circles", "perps"].includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: Boolean(value) }),
      explored: true,
    });
  }

  function reset(state) {
    return start(state.options);
  }

  function legalMoves() {
    return ["A", "B", "C", "line1", "line2", "lineMid"];
  }

  /** This is a picture, not a game: exploring it finishes the record. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** Compute(), method for method, on a plain-data state. */
  function geometry(state) {
    const sides = [[state.B, state.C], [state.C, state.A], [state.A, state.B]];
    const l0 = state.line[0], l1 = state.line[1];
    const feet = sides.map(([a, b]) => lineIntersection(a, b, l0, l1));
    // Intersection[i][j] is Feet[j] when j == i, otherwise the foot of Feet[j]
    // on side i. These nine points are the three pedal circles' ingredients.
    const intersection = feet.map((f, i) => sides.map(([a, b], j) => {
      if (!f) return null;
      return j === i ? f : foot(f, a, b);
    }));
    const circles = intersection.map((row) => circleOf(row[0], row[1], row[2]));
    const real = circles.filter(Boolean);
    let axis = null, common = [];
    if (real.length === 3) {
      try {
        axis = clipLine(...defineLine(real[0].c, real[1].c, real[2].c));
      } catch (_) { axis = null; } // the applet catches this and keeps the old line
    }
    if (circles[0] && circles[1]) {
      try {
        common = circleIntersections(circles[0].c, circles[0].r, circles[1].c, circles[1].r);
      } catch (_) { common = []; }
    }
    return {
      A: state.A, B: state.B, C: state.C, line: state.line,
      feet, intersection, circles, axis, common,
      nine: ninePointCircle(state.A, state.B, state.C),
      options: state.options,
    };
  }

  function describe(state) {
    const g = geometry(state);
    if (g.feet.some((f) => !f)) {
      return "The line is parallel to a side, so one of P, Q and R is missing. Move the line a little.";
    }
    if (g.circles.some((c) => !c)) {
      return "The three feet on one pedal circle line up, so that circle cannot be drawn. Move a point.";
    }
    if (!g.common.length) {
      return "P, Q and R are on the sides of the triangle; the three pedal circles have no visible common point here.";
    }
    return `P, Q and R lie on the three sides. Their pedal circles meet at two points, and their three centres lie on one line.`;
  }

  return {
    VIEW, start, move, setOption, reset, legalMoves, result, geometry, describe,
    add, sub, mul, dot, cross, distance, sqDistance, midpoint, distanceToLine,
    clamp, clampPoint, lineIntersection, foot, circleOf, ninePointCircle,
    circleIntersections, inside, defineLine, clipLine, initialLine,
  };
})();
