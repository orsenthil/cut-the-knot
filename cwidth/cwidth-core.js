"use strict";

/*
 * Shapes of constant width — the logic behind Alexander Bogomolny's applet
 * "cwidth" (cut-the-knot.org/do_you_know/cwidth.shtml).
 *
 * A Reuleaux triangle: take an equilateral triangle of side s and replace each
 * side by the arc of the circle of radius s centred at the opposite vertex. Its
 * width (the distance between two parallel lines touching it from opposite
 * sides) is s in every direction, so it turns inside a square of side s and
 * always touches all four sides. The applet turns it a few degrees at a time
 * (5 degrees every 100 ms, the angle kept mod 360) and shows three views, chosen
 * by clicking: the triangle turning inside a square that follows it ("rotate"),
 * the triangle held still with the square turning round it ("square"), and the
 * first view without clearing the picture, so the ground the triangle sweeps
 * stays painted ("trace").
 *
 * The applet finds the enclosing square without any calculus: the bounding box of
 * the three vertices, then, where an arc (not a vertex) is the extreme, the
 * opposite side is a vertex and the box is s wide, so the extreme is s away from
 * the opposite one. Which sides need this depends on the angle mod 120: the top
 * and bottom when it is in (30, 90], the left and right when it is above 60 (the
 * applet's own test). This file keeps that method, in real numbers.
 *
 * Page claims checked by the logic test: width s in every direction; the
 * enclosing square has side s at every angle; the area of the Reuleaux triangle,
 * (pi - sqrt(3))/2 s^2, is less than the circle's pi/4 s^2 of the same width; its
 * perimeter is pi s (Barbier); its angles are 120 degrees; every boundary point
 * has another boundary point exactly s away; no two points are farther than s
 * apart; and the area swept inside the square, 2 sqrt(3) + pi/6 - 3 = 0.98770
 * for s = 1, found by counting grid points.
 *
 * No document, no window, no storage. The position is plain data.
 */
const CwidthCore = (() => {
  const MODES = ["rotate", "square", "trace"];
  const START_STEP = 5; // degrees per tick (m_d)
  const TICK_MS = 100;
  const SQRT3 = Math.sqrt(3);
  const RAD = Math.PI / 180;

  /** A new position: angle 0, the first view. */
  function start(options) {
    const o = options || {};
    return {
      angle: Number.isFinite(Number(o.angle)) ? ((Math.trunc(Number(o.angle)) % 360) + 360) % 360 : 0,
      mode: MODES.includes(o.mode) ? o.mode : "rotate",
      step: Number.isFinite(Number(o.step)) ? Math.max(1, Math.min(30, Math.trunc(Number(o.step)))) : START_STEP,
      seen: [MODES.includes(o.mode) ? o.mode : "rotate"],
      moves: 0,
    };
  }

  /** The three vertices for side s, centred on the centroid, before turning (the applet's m_O, y down). */
  function baseVertices(s) {
    const r = s / SQRT3; // circumradius: the applet's m_r
    return [[-s / 2, -r / 2], [s / 2, -r / 2], [0, r]];
  }

  /** The vertices turned by the angle (degrees): the applet's Rotate(). */
  function vertices(angle, s) {
    const c = Math.cos(angle * RAD), n = Math.sin(angle * RAD);
    return baseVertices(s).map(([x, y]) => [x * c + y * n, y * c - x * n]);
  }

  /** The three arcs: centre = vertex i, radius s, from the angle `from` for 60 degrees (the applet's drawArc). */
  function arcs(angle, s) {
    return vertices(angle, s).map((v, i) => ({ centre: v, radius: s, from: angle + 240 * i - 60, sweep: 60 }));
  }

  /** Is the point inside the Reuleaux triangle? It is the intersection of the three discs. */
  function inside(angle, s, x, y) {
    return vertices(angle, s).every(([vx, vy]) => (x - vx) * (x - vx) + (y - vy) * (y - vy) <= s * s * (1 + 1e-12));
  }

  /** The bounding box the applet's way: the vertices' box, then s from the vertex side when an arc is the extreme. */
  function boundsApplet(angle, s) {
    const vs = vertices(angle, s);
    const box = {
      left: Math.min(...vs.map((v) => v[0])), right: Math.max(...vs.map((v) => v[0])),
      top: Math.min(...vs.map((v) => v[1])), bottom: Math.max(...vs.map((v) => v[1])),
    };
    const m = ((angle % 120) + 120) % 120;
    // FindBounds: if m <= 30 or m > 90, the top is taken from the bottom (LU.y = RL.y - R)...
    if (m <= 30 || m > 90) box.top = box.bottom - s;
    // ...and when m > 60, the left from the right (LU.x = RL.x - R).
    if (m > 60) box.left = box.right - s;
    // The applet draws the square from its upper left corner LU with side R, so the other sides follow.
    return { left: box.left, top: box.top, right: box.left + s, bottom: box.top + s };
  }

  /** The true bounding box, found from the support function of the shape in the four axis directions. */
  function boundsTrue(angle, s) {
    return { left: -support(angle, s, 180), right: support(angle, s, 0), top: -support(angle, s, 270), bottom: support(angle, s, 90) };
  }

  /**
   * The support function: the largest extent of the shape along the direction `theta` (degrees),
   * x cos + y sin over the boundary. The boundary is three arcs and three vertices.
   */
  function support(angle, s, theta) {
    const t = theta * RAD;
    const ux = Math.cos(t), uy = Math.sin(t);
    const vs = vertices(angle, s);
    let best = Math.max(...vs.map(([x, y]) => x * ux + y * uy));
    // each arc: centre c, radius s, spanning 60 degrees (the directions pointing to the other two vertices)
    for (let i = 0; i < 3; i++) {
      const [cx, cy] = vs[i];
      const a = vs[(i + 1) % 3], b = vs[(i + 2) % 3];
      const a1 = Math.atan2(a[1] - cy, a[0] - cx), a2 = Math.atan2(b[1] - cy, b[0] - cx);
      // the arc runs between the angles a1 and a2 (60 degrees apart); is the direction t inside that span?
      let d1 = ((t - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), span = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      let lo = 0, hi = span;
      if (span > Math.PI) { // the short way round is from a2 to a1
        d1 = ((t - a2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); hi = 2 * Math.PI - span;
      }
      if (d1 >= lo - 1e-12 && d1 <= hi + 1e-12) best = Math.max(best, cx * ux + cy * uy + s);
    }
    return best;
  }

  /** The width of the shape in a direction: the extent one way plus the extent the other. */
  function width(angle, s, theta) {
    return support(angle, s, theta) + support(angle, s, theta + 180);
  }

  /** The enclosing square for the view: the corner and the side (side s at every angle). */
  function square(state, s) {
    const b = boundsApplet(state.angle, s);
    return { left: b.left, top: b.top, right: b.left + s, bottom: b.top + s };
  }

  /** The area of the Reuleaux triangle: (pi - sqrt 3)/2 s^2. */
  const area = (s) => ((Math.PI - SQRT3) / 2) * s * s;
  /** The perimeter: three arcs of 60 degrees and radius s, that is pi s. */
  const perimeter = (s) => Math.PI * s;
  /** The area swept in the enclosing square when it turns, for side s: 2 sqrt(3) + pi/6 - 3 times s^2. */
  const sweptArea = (s) => (2 * SQRT3 + Math.PI / 6 - 3) * s * s;

  /** The moves: one tick, click for the next view, choose a view, set the angle, set the step. */
  function legalMoves() {
    return [{ type: "tick" }, { type: "click" }, ...MODES.map((value) => ({ type: "mode", value })), { type: "angle", value: 0 }, { type: "step", value: START_STEP }];
  }

  function move(state, m) {
    if (!m) return null;
    let next = null;
    if (m.type === "tick") next = { ...state, angle: (state.angle + state.step) % 360 };
    else if (m.type === "click") next = { ...state, mode: MODES[(MODES.indexOf(state.mode) + 1) % MODES.length] };
    else if (m.type === "mode") {
      if (!MODES.includes(m.value)) return null;
      next = { ...state, mode: m.value };
    } else if (m.type === "angle") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, angle: ((Math.trunc(Number(m.value)) % 360) + 360) % 360 };
    } else if (m.type === "step") {
      if (!Number.isFinite(Number(m.value))) return null;
      next = { ...state, step: Math.max(1, Math.min(30, Math.trunc(Number(m.value)))) };
    }
    if (!next) return null;
    return { ...next, seen: next.seen.includes(next.mode) ? next.seen : [...next.seen, next.mode], moves: state.moves + 1 };
  }

  /** A demo: "done" once every view has been seen. */
  function result(state) {
    return MODES.every((m) => state.seen.includes(m)) ? "done" : null;
  }

  return {
    MODES, START_STEP, TICK_MS, SQRT3,
    start, baseVertices, vertices, arcs, inside, boundsApplet, boundsTrue, support, width, square, area, perimeter, sweptArea, legalMoves, move, result,
  };
})();
