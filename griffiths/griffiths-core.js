"use strict";

/*
 * Griffiths — the geometry in Alexander Bogomolny's applet Griffiths, from
 * "9-point Circle as a Locus of Concurrency" on cut-the-knot.org.
 *
 * A, A2, A3 (labelled A1, A2, A3 on the page) are a triangle, O its
 * circumcentre. P is any point and Q slides on the line OP. The feet of the
 * perpendiculars from P and from Q to the three sides give two pedal circles.
 * The page's claim is that as a point moves on a fixed line through O its
 * pedal circle passes through a fixed point of the nine-point circle. The
 * applet finds that point by intersecting each pedal circle with the
 * nine-point circle and keeping the two intersections that nearly coincide.
 *
 * The code follows GriffithsCanvas.init/Compute and its mouseDragged handler
 * literally: Q starts at 4/3·P − 1/3·O (DoubLine.CreateMidPoint(4/3)), keeps
 * its line parameter when P or the triangle moves, and is projected back onto
 * the line when Q itself is dragged. Every derived value comes from the
 * applet's own methods: FindCircumcenter, NearestPoint, GetCircle, DrawNPC and
 * FindCommon. There is no win or loss: this is a drawing.
 *
 * This file is the logic only: no document, no window, no storage. It defines
 * one global, GriffithsCore, so the page and porting/check-griffiths.mjs can
 * both use it. Positions are plain data and functions never mutate their input.
 */
const GriffithsCore = (() => {
  // The Wayback snapshot of 2006 embeds <APPLET CODE="Griffiths" WIDTH=500
  // HEIGHT=300>. The applet's own WIDTH/HEIGHT parameter note says
  // "(400 seems optimal)", "(250 seems optimal)" but the page wins here.
  const VIEW = { width: 500, height: 300 };
  // Java's min(width,height)/3 is integer division: min(500,300)/3 = 100.
  const R = Math.floor(Math.min(VIEW.width, VIEW.height) / 3);
  // GriffithsCanvas.init: Line.CreateMidPoint(1.3333333333333333).
  const T = 1.3333333333333333;
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Keep a dragged point on the board; the SVG viewBox has these units. */
  function clampPoint(p) {
    return {
      x: clamp(Number(p.x) || 0, 0, VIEW.width),
      y: clamp(Number(p.y) || 0, 0, VIEW.height),
    };
  }

  /*
   * GeoSDoub.FindCircumcenter, written with the same two perpendicular
   * bisectors and the same |det| < 1 guard as GeoSDoub.Intersect. The guard
   * makes a nearly straight triangle produce no geometry, as in the applet.
   */
  function circumcenter(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const u = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
    const v = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
    const a1 = m1.y - u.y, b1 = u.x - m1.x;
    const c1 = m1.x * u.y - m1.y * u.x;
    const a2 = m2.y - v.y, b2 = v.x - m2.x;
    const c2 = m2.x * v.y - m2.y * v.x;
    // GeoSDoub.Intersect divides by a1*b2 − a2*b1 and guards that number.
    const det = a1 * b2 - a2 * b1;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    const o = { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
    return finite(o) ? o : null;
  }

  /** GriffithsCanvas.GetCircle: the centre plus the mean of the three radii. */
  function circleOf(a, b, c) {
    if (!a || !b || !c) return null;
    const o = circumcenter(a, b, c);
    if (!o) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return Number.isFinite(r) ? { c: o, r } : null;
  }

  /** GeoSDoub.NearestPoint: the foot on the whole line XY, not just the side. */
  function nearestPoint(p, x, y) {
    if (sqDist(x, p) < 0.1) return copy(p); // the applet's small-side fallback
    const dx = y.x - x.x, dy = y.y - x.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= EPS) return copy(x);
    const t = (dx * (p.x - x.x) + dy * (p.y - x.y)) / len2;
    return { x: x.x + dx * t, y: x.y + dy * t };
  }

  /** GetPerp(P), in the applet's AB, BC, CA order. */
  function feet(p, a, b, c) {
    return [nearestPoint(p, a, b), nearestPoint(p, b, c), nearestPoint(p, c, a)];
  }

  /*
   * GeoSDoub.Intersect(DoubCircle, DoubCircle), axis by axis just as the
   * bytecode does it: IntersectCirclesX when |dx| > 1, IntersectCirclesY when
   * |dy| > 1, and no usable point when the centres are within a pixel in both
   * coordinates. A negative discriminant also returns no points.
   */
  function circleIntersections(s, t) {
    const dx = s.c.x - t.c.x, dy = s.c.y - t.c.y;
    if (Math.abs(dx) > 1) {
      const k = -dy / dx;
      const x0 = (s.c.x ** 2 - t.c.x ** 2 + s.c.y ** 2 - t.c.y ** 2 - s.r ** 2 + t.r ** 2) /
                 (2 * dx);
      const d = x0 - s.c.x;
      const b = k * d - s.c.y;
      const c = d * d + s.c.y ** 2 - s.r ** 2;
      const disc = b * b - (k * k + 1) * c;
      if (disc < 0 || !Number.isFinite(disc)) return [];
      const h = Math.sqrt(disc);
      const y1 = (-b + h) / (k * k + 1), y2 = (-b - h) / (k * k + 1);
      return [{ x: k * y1 + x0, y: y1 }, { x: k * y2 + x0, y: y2 }];
    }
    if (Math.abs(dy) > 1) {
      const k = -dx / dy;
      const y0 = (s.c.x ** 2 - t.c.x ** 2 + s.c.y ** 2 - t.c.y ** 2 - s.r ** 2 + t.r ** 2) /
                 (2 * dy);
      const d = y0 - s.c.y;
      const b = k * d - s.c.x;
      const c = d * d + s.c.x ** 2 - s.r ** 2;
      const disc = b * b - (k * k + 1) * c;
      if (disc < 0 || !Number.isFinite(disc)) return [];
      const h = Math.sqrt(disc);
      const x1 = (-b + h) / (k * k + 1), x2 = (-b - h) / (k * k + 1);
      return [{ x: x1, y: k * x1 + y0 }, { x: x2, y: k * x2 + y0 }];
    }
    return [];
  }

  /** FindCommon: SqDist < 2 (a radius of sqrt(2) pixels), first pair wins. */
  function findCommon(one, two) {
    for (const p of one || []) {
      for (const q of two || []) {
        if (!p || !q || sqDist(p, q) >= 2) continue;
        return midpoint(p, q);
      }
    }
    return null;
  }

  /** DrawNPC: the circle through the three side midpoints, BC, CA, AB. */
  function ninePointCircle(a, b, c) {
    return circleOf(midpoint(b, c), midpoint(c, a), midpoint(a, b));
  }

  /** Compute(): the two pedal circles, the nine-point circle and their dot. */
  function geometry(state) {
    const O = circumcenter(state.A, state.B, state.C);
    if (!O) return null;
    const PFeet = feet(state.P, state.A, state.B, state.C);
    const QFeet = feet(state.Q, state.A, state.B, state.C);
    const Pcircle = circleOf(PFeet[0], PFeet[1], PFeet[2]);
    const Qcircle = circleOf(QFeet[0], QFeet[1], QFeet[2]);
    const nine = ninePointCircle(state.A, state.B, state.C);
    const common = Pcircle && Qcircle && nine
      ? findCommon(circleIntersections(Pcircle, nine), circleIntersections(Qcircle, nine))
      : null;
    return {
      A: state.A, B: state.B, C: state.C, P: state.P, Q: state.Q, O,
      PFeet, QFeet, Pcircle, Qcircle, nine, common,
      midFeet: [midpoint(state.A, state.B), midpoint(state.B, state.C),
                midpoint(state.C, state.A)],
      circle: circleOf(state.A, state.B, state.C),
      options: state.options,
    };
  }

  /** The line parameter t with Q = t·P + (1−t)·O. */
  function lineParameter(P, O, Q) {
    const d = sub(P, O);
    if (dot(d, d) <= EPS) return null;
    return dot(d, sub(Q, O)) / dot(d, d);
  }

  /** CTKMoveableDoub.UpdateLocation for a point sliding on the line OP. */
  function projectToLine(P, O, raw) {
    const d = sub(P, O);
    if (dot(d, d) <= EPS) return copy(O);
    const t = lineParameter(P, O, raw);
    return add(O, mul(d, t));
  }

  /** The position a new drawing starts from (GriffithsCanvas.init). */
  function start(options) {
    const mid = { x: VIEW.width / 2, y: VIEW.height / 2 };
    const at = (angle, radius) => add(mid, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    const A = at(-1.6, R), B = at(-4.0, R), C = at(-0.2, R);
    // The page passes ShowNames=0, but the constructor sets ShowNames = 1
    // after reading the parameter; the two checkboxes are both off.
    const opts = Object.assign({ perps: false, circles: false }, options || {});
    const P = at(2.0, R / 2);
    const O = circumcenter(A, B, C) || mid;
    const t = opts.t === undefined ? T : opts.t;
    return {
      A, B, C, P, Q: add(O, mul(sub(P, O), t)), t, O,
      options: { perps: Boolean(opts.perps), circles: Boolean(opts.circles) },
      explored: false,
    };
  }

  /** Drag one of the five handles. A/B/C re-centre O and carry Q with it. */
  function move(state, name, point) {
    if (!["A", "B", "C", "P", "Q"].includes(name)) return state;
    const p = clampPoint(point);
    const next = Object.assign({}, state, { [name]: p, explored: true });
    if (name === "A" || name === "B" || name === "C") {
      const O = circumcenter(next.A, next.B, next.C);
      if (O) next.O = O;
      next.Q = add(next.O, mul(sub(next.P, next.O), state.t));
    } else if (name === "P") {
      next.Q = add(next.O, mul(sub(p, next.O), state.t));
    } else {
      const q = projectToLine(next.P, next.O, p);
      const t = lineParameter(next.P, next.O, q);
      if (t !== null) next.t = t;
      next.Q = q;
    }
    return next;
  }

  function setOption(state, name, value) {
    if (!["perps", "circles"].includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: Boolean(value) }),
      explored: true,
    });
  }

  /** Reset the drawing, keeping the player's two checkboxes as they were. */
  function reset(state) {
    return start(Object.assign({}, state.options, { t: T }));
  }

  function legalMoves() {
    return ["A", "B", "C", "P", "Q"];
  }

  /** A demo: exploring it ends the record, but nobody can win or lose. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** The status line: plain words about what is on the board. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "The three triangle dots are in a straight line, so there is no circle to draw. Move one of them.";
    const at = (p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`;
    let text = `Triangle A₁A₂A₃ has its centre O at ${at(g.O)}. P is at ${at(g.P)} and Q is at ${at(g.Q)}, on the same line through O.`;
    text += state.options.circles
      ? (g.common
        ? ` The two pedal circles and the nine-point circle meet at ${at(g.common)}.`
        : " The circles are too close together here to pick out one meeting dot.")
      : " Tick Circles to see the pedal circles and their meeting dot.";
    if (state.options.perps) text += " The perpendiculars are shown.";
    return text;
  }

  return {
    VIEW, R, T, start, move, setOption, reset, legalMoves, result,
    geometry, describe, clampPoint, circumcenter, circleOf, nearestPoint,
    circleIntersections, projectToLine,
  };
})();
